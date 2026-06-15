"""
pattern_engine_service.py
=========================
Optimasi P3 + P4:
  - FraudPattern diambil dari cache (get_cached_patterns)
  - window_cache deduplicate query window per field
  - detect_pattern_location_jump: cache last_trx per user_account_id
    menggunakan request-scoped dict (bukan global cache)
  - Tidak ada db.commit() — commit di process_transaction()
"""

from sqlalchemy import func, distinct
from sqlalchemy.orm import Session
from datetime import timedelta

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern

from app.application.services.activity_log_service import log_activity
from app.application.cache.fraud_cache import get_cached_patterns
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)

# ── Request-scoped Location Jump cache ──────────────────────────────────────
# Dict ini hidup di level module tapi di-reset per proses aggregation.
# Key: user_account_id → (city, country, transaction_time) dari last_trx
# Cocok untuk simulasi batch (DataAggregationService) karena transaksi
# dari user yang sama akan re-use hasil query pertama.
_location_cache: dict[str, tuple] = {}


def reset_location_cache():
    """
    Kosongkan location cache.
    Dipanggil di awal DataAggregationService.process_agenusa/nusabill/all()
    agar cache tidak stale antar batch run.
    """
    global _location_cache
    _location_cache.clear()
    logger.debug("[CACHE] Location jump cache reset")


def evaluate_condition(value, operator, target):
    if value is None:
        return False
    try:
        if isinstance(value, (int, float)) and isinstance(target, str):
            target = float(target)

        if operator == "==":      return value == target
        elif operator == "!=":    return value != target
        elif operator == ">":     return value > target
        elif operator == "<":     return value < target
        elif operator == ">=":    return value >= target
        elif operator == "<=":    return value <= target
        elif operator == "IN":    return isinstance(target, (list, set, tuple)) and value in target
        elif operator == "NOT_IN": return isinstance(target, (list, set, tuple)) and value not in target
    except (ValueError, TypeError):
        return False
    return False


def detect_pattern_location_jump(db: Session, current_trx: Transaction) -> tuple[bool, str]:
    """
    Mendeteksi 'Pattern Location Jump' (Impossible Travel) menggunakan data GeoIP.

    Optimasi: hasil query last_trx di-cache per user_account_id dalam
    _location_cache (request-scoped). Query DB hanya terjadi 1× per user
    dalam satu batch run.

    Return: (is_violation: bool, reason: str)
    """
    if not current_trx.ip_address or not current_trx.country:
        return False, ""

    user_id = current_trx.user_account_id

    # ── Cek cache dulu ───────────────────────────────────────
    if user_id in _location_cache:
        last_city, last_country, last_time = _location_cache[user_id]
    else:
        last_trx = db.query(Transaction).filter(
            Transaction.user_account_id == user_id,
            Transaction.id != current_trx.id,
            Transaction.country.isnot(None)
        ).order_by(Transaction.transaction_time.desc()).first()

        if not last_trx:
            # Simpan None ke cache agar tidak query lagi untuk user ini
            _location_cache[user_id] = (None, None, None)
            return False, ""

        last_city    = last_trx.city
        last_country = last_trx.country
        last_time    = last_trx.transaction_time
        _location_cache[user_id] = (last_city, last_country, last_time)

    if last_country is None:
        return False, ""

    t1        = current_trx.transaction_time.replace(tzinfo=None)
    t2        = last_time.replace(tzinfo=None)
    time_diff = t1 - t2

    # Skenario 1: Beda Negara dalam < 12 jam
    if current_trx.country != last_country:
        if time_diff < timedelta(hours=12):
            reason = f"Impossible Travel: {last_country} to {current_trx.country} in {time_diff}"
            # Update cache dengan lokasi terbaru
            _location_cache[user_id] = (current_trx.city, current_trx.country, current_trx.transaction_time)
            return True, reason

    # Skenario 2: Beda Kota dalam < 1 jam
    if current_trx.city != last_city and current_trx.country == last_country:
        if time_diff < timedelta(hours=1):
            reason = f"Fast City Jump: {last_city} to {current_trx.city} in {time_diff}"
            _location_cache[user_id] = (current_trx.city, current_trx.country, current_trx.transaction_time)
            return True, reason

    # Update cache dengan lokasi terbaru (tidak anomali)
    _location_cache[user_id] = (current_trx.city, current_trx.country, current_trx.transaction_time)
    return False, ""


@log_performance(label="PatternEngine.run_pattern_engine")
def run_pattern_engine(db, trx):
    violations  = []
    pattern_ids = []
    risk_score  = 0
    actions     = []

    if not trx.transaction_time:
        return [], [], 0, []

    # ── P4: ambil dari cache, bukan query DB per transaksi ──
    patterns = get_cached_patterns(db)

    if not patterns:
        return [], [], 0, []

    window_cache = {}
    details      = trx.transaction_details or {}

    for pattern in patterns:
        rules = pattern.pattern_rules or {}

        if isinstance(rules, list):
            rules = {"logic": "AND", "conditions": rules, "time_window_minutes": None}

        if not isinstance(rules, dict):
            continue

        logic      = rules.get("logic", "AND")
        conditions = rules.get("conditions", [])
        window_ms  = rules.get("time_window_minutes")
        results    = []

        for cond in conditions:
            field         = cond.get("field")
            operator      = cond.get("operator")
            target        = cond.get("value")
            current_value = None

            # ── STATIC FEATURES ──────────────────────────────
            if field == "amount":
                current_value = float(trx.amount or 0)
            elif field == "service_source":
                current_value = trx.service_source

            # ── DYNAMIC WINDOW FEATURES ──────────────────────
            elif window_ms:
                cache_key = (field, window_ms, trx.user_account_id)

                if cache_key not in window_cache:
                    time_thresh = trx.transaction_time - timedelta(minutes=window_ms)

                    if field == "tx_count":
                        res = db.query(func.count(Transaction.id)).filter(
                            Transaction.user_account_id == trx.user_account_id,
                            Transaction.transaction_time >= time_thresh,
                            Transaction.transaction_time <= trx.transaction_time
                        ).scalar() or 0
                        window_cache[cache_key] = res

                    elif field == "total_amount":
                        res = db.query(func.sum(Transaction.amount)).filter(
                            Transaction.user_account_id == trx.user_account_id,
                            Transaction.transaction_time >= time_thresh,
                            Transaction.transaction_time <= trx.transaction_time
                        ).scalar() or 0
                        window_cache[cache_key] = float(res)

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

                    elif field == "distinct_customer_count":
                        res = db.query(func.count(distinct(
                            Transaction.transaction_details['nama_customer'].astext
                        ))).filter(
                            Transaction.user_account_id == trx.user_account_id,
                            Transaction.transaction_time >= time_thresh,
                            Transaction.transaction_time <= trx.transaction_time
                        ).scalar() or 0
                        window_cache[cache_key] = res

                    elif field in ["failure_count", "has_success_after_failure"]:
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
                            failure_count = burst_count = 0

                            for t in recent_trxs:
                                rc = (t.transaction_details or {}).get("response_code")
                                if state == "START":
                                    if rc != "00": state = "DECLINE"; failure_count = 1
                                elif state == "DECLINE":
                                    if rc != "00": failure_count += 1
                                    elif failure_count >= 3: state = "SUCCESS"
                                elif state == "SUCCESS":
                                    if rc == "00":
                                        burst_count += 1
                                        if burst_count >= 3: chain_detected = True; break
                                    else: break

                        window_cache[cache_key] = chain_detected

                current_value = window_cache.get(cache_key)

            if current_value is not None:
                results.append(evaluate_condition(current_value, operator, target))
            else:
                results.append(False)

        if logic == "AND":
            matched = all(results) if results else False
        elif logic == "OR":
            matched = any(results) if results else False
        else:
            matched = False

        if matched:
            violations.append({"type": "PATTERN", "name": pattern.pattern_name, "score": pattern.risk_score})
            pattern_ids.append(pattern.id)
            risk_score = max(risk_score, pattern.risk_score)

            if pattern.action:
                actions.append(pattern.action)

            log_activity(
                db=db, admin=None,
                action_type=ActivityActionEnum.PATTERN_TRIGGERED,
                module_source=EventSourceEnum.PATTERN_ENGINE,
                severity=SeverityLevelEnum.HIGH,
                target_type="TRANSACTION",
                target_id=str(trx.original_trx_id),
                ip_address=getattr(trx, "ip_address", None),
                details={
                    "pattern_id":      pattern.id,
                    "pattern_name":    pattern.pattern_name,
                    "category":        pattern.pattern_category,
                    "action_executed": pattern.action,
                    "score_assigned":  pattern.risk_score
                }
            )

    return violations, pattern_ids, risk_score, actions