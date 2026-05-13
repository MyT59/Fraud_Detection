from sqlalchemy import func, distinct
from datetime import timedelta

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern

def evaluate_condition(value, operator, target):
    """
    Fungsi helper untuk mengevaluasi operator logika dari ruleset JSON.
    """
    if value is None:
        return False
        
    try:
        # Normalisasi tipe data: Jika value angka tapi target string (dari JSON), konversi ke float
        if isinstance(value, (int, float)) and isinstance(target, str):
            target = float(target)
            
        if operator == "==": return value == target
        elif operator == "!=": return value != target
        elif operator == ">": return value > target
        elif operator == "<": return value < target
        elif operator == ">=": return value >= target
        elif operator == "<=": return value <= target
        elif operator == "IN": return isinstance(target, (list, set, tuple)) and value in target
        elif operator == "NOT_IN": return isinstance(target, (list, set, tuple)) and value not in target
    except (ValueError, TypeError):
        return False
        
    return False

def run_pattern_engine(db, trx):
    """
    Mengevaluasi transaksi yang masuk terhadap semua pattern aktif di database.
    """
    violations = []
    pattern_ids = []
    risk_score = 0
    actions = []

    if not trx.transaction_time:
        return [], [], 0, []

    # 1. Ambil semua pattern yang aktif
    patterns = db.query(FraudPattern).filter(
        FraudPattern.is_active == True
    ).order_by(
        FraudPattern.priority.desc(),
        FraudPattern.risk_score.desc()
    ).all()

    if not patterns:
        return [], [], 0, []

    # 🔥 CACHE CONTAINER (Lazy Evaluation)
    window_cache = {}
    details = trx.transaction_details or {}

    for pattern in patterns:
        rules = pattern.pattern_rules or {}
        logic = rules.get("logic", "AND")
        conditions = rules.get("conditions", [])
        window_ms = rules.get("time_window_minutes")

        results = []
        
        for cond in conditions:
            field = cond.get("field")
            operator = cond.get("operator")
            target = cond.get("value")

            current_value = None

            # --- 1. STATIC FEATURES ---
            if field == "amount":
                current_value = float(trx.amount or 0)
            elif field == "service_source":
                current_value = trx.service_source
            
            # --- 2. DYNAMIC WINDOW FEATURES (Database Aggregation) ---
            elif window_ms:
                # FIX 2: Gunakan konsistensi cache key (field + window + user)
                cache_key = (field, window_ms, trx.user_account_id)
                
                if cache_key not in window_cache:
                    time_thresh = trx.transaction_time - timedelta(minutes=window_ms)
                    
                    # A. Velocity (Count)
                    if field == "tx_count":
                        res = db.query(func.count(Transaction.id)).filter(
                            Transaction.user_account_id == trx.user_account_id,
                            Transaction.transaction_time >= time_thresh,
                            Transaction.transaction_time <= trx.transaction_time
                        ).scalar() or 0
                        window_cache[cache_key] = res

                    # FIX 1: Burst Support (Sum of Amount)
                    elif field == "total_amount":
                        res = db.query(func.sum(Transaction.amount)).filter(
                            Transaction.user_account_id == trx.user_account_id,
                            Transaction.transaction_time >= time_thresh,
                            Transaction.transaction_time <= trx.transaction_time
                        ).scalar() or 0
                        window_cache[cache_key] = float(res)
                    
                    # B. Fan-In (EDC/Terminal)
                    elif field == "distinct_account_count":
                        terminal_id = details.get("terminal_id")
                        if terminal_id:
                            res = db.query(func.count(distinct(
                                Transaction.transaction_details['issuer_account_number'].astext
                            ))).filter(
                                Transaction.transaction_details['terminal_id'].astext == terminal_id,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).scalar() or 0
                            window_cache[cache_key] = res
                        else:
                            window_cache[cache_key] = 0

                    # C. Fan-Out (Biller/Customer Name)
                    elif field == "distinct_customer_count":
                        res = db.query(func.count(distinct(
                            Transaction.transaction_details['nama_customer'].astext
                        ))).filter(
                            Transaction.user_account_id == trx.user_account_id,
                            Transaction.transaction_time >= time_thresh,
                            Transaction.transaction_time <= trx.transaction_time
                        ).scalar() or 0
                        window_cache[cache_key] = res

                    # D. Failure & Success Recovery
                    elif field in ["failure_count", "has_success_after_failure"]:
                        # Kita cache kedua field sekaligus karena query-nya sama
                        f_key = ("failure_count", window_ms, trx.user_account_id)
                        s_key = ("has_success_after_failure", window_ms, trx.user_account_id)
                        
                        account_number = details.get("issuer_account_number")
                        f_count = 0
                        s_found = False
                        
                        if account_number:
                            recent_trxs = db.query(Transaction).filter(
                                Transaction.transaction_details["issuer_account_number"].astext == account_number,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).order_by(Transaction.transaction_time.desc()).limit(10).all()
                            
                            for t in recent_trxs:
                                rc = (t.transaction_details or {}).get("response_code")
                                if rc != "00":
                                    f_count += 1
                                else:
                                    s_found = True
                                    break
                                    
                        window_cache[f_key] = f_count
                        window_cache[s_key] = s_found

                    # E. Chain Feature: Decline -> Success -> Burst
                    elif field == "chain_decline_success_burst":
                        account_number = details.get("issuer_account_number")
                        chain_detected = False

                        if account_number:
                            recent_trxs = db.query(Transaction).filter(
                                Transaction.transaction_details["issuer_account_number"].astext == account_number,
                                Transaction.transaction_time >= time_thresh,
                                Transaction.transaction_time <= trx.transaction_time
                            ).order_by(Transaction.transaction_time.asc()).all()

                            state = "START"
                            failure_count = 0
                            burst_count = 0

                            for t in recent_trxs:
                                rc = (t.transaction_details or {}).get("response_code")

                                if state == "START":
                                    if rc != "00":
                                        state = "DECLINE"
                                        failure_count = 1

                                elif state == "DECLINE":
                                    if rc != "00":
                                        failure_count += 1
                                    elif failure_count >= 3:
                                        state = "SUCCESS"

                                elif state == "SUCCESS":
                                    if rc == "00":
                                        burst_count += 1
                                        if burst_count >= 3:
                                            chain_detected = True
                                            break
                                    else:
                                        break  # reset kalau balik gagal
                        window_cache[cache_key] = chain_detected
                
                # Ambil nilai dari cache setelah dihitung
                current_value = window_cache.get(cache_key)

            # --- 3. EVALUATION ---
            if current_value is not None:
                results.append(evaluate_condition(current_value, operator, target))
            else:
                results.append(False)

        # Keputusan Pattern Logic (AND / OR)
        if logic == "AND":
            matched = all(results) if results else False
        elif logic == "OR":
            matched = any(results) if results else False
        else:
            matched = False

        if matched:
            violations.append({
                "type": "PATTERN", 
                "name": pattern.pattern_name, 
                "score": pattern.risk_score
            })
            pattern_ids.append(pattern.id)
            # Ambil score tertinggi dari semua pattern yang match
            risk_score = max(risk_score, pattern.risk_score)
            
            if pattern.action:
                actions.append(pattern.action)

    return violations, pattern_ids, risk_score, actions