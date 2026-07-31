"""
pattern_learning_service.py
===========================
Pattern candidates are staged in the caller's transaction so model/history
changes and audit logs can be committed atomically.
"""

from app.infrastructure.database.enums import PatternSourceEnum
from datetime import timedelta
from sqlalchemy import func, distinct, text
import json
import hashlib

from app.infrastructure.database.models.manual_review_model import ManualReview
from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)

# =========================
# CONFIG THRESHOLDS
# =========================
TIME_WINDOW        = 5  # minutes
MIN_SUPPORT        = 3  # minimum number of transactions to consider a pattern
VELOCITY_THRESHOLD = 5  # transactions in TIME_WINDOW minutes
AMOUNT_THRESHOLD   = 5_000_000
FAN_IN_THRESHOLD   = 10 # account number
FAN_OUT_THRESHOLD  = 20 # customer


@log_performance(label="PatternLearning.generate_patterns_from_reviews")
def generate_patterns_from_reviews(db):
    reviews_with_trx = db.query(ManualReview, Transaction).join(
        Transaction, ManualReview.transaction_id == Transaction.id
    ).filter(
        ManualReview.decision == "FRAUD"
    ).order_by(
        ManualReview.created_at.desc(),
        ManualReview.id.desc(),
    ).limit(100).all()

    if not reviews_with_trx:
        return []

    velocity_counter      = {}
    amount_counter        = {}
    network_counter       = {}
    decline_counter       = {}
    super_pattern_counter = {}
    user_cache            = {}

    for review, trx in reviews_with_trx:
        if not trx.transaction_time:
            continue

        time_threshold = trx.transaction_time - timedelta(minutes=TIME_WINDOW)
        details        = trx.transaction_details or {}
        service        = trx.service_source

        # 1. VELOCITY
        user_key = (trx.user_account_id, time_threshold, trx.transaction_time)
        if user_key not in user_cache:
            tx_count = db.query(func.count(Transaction.id)).filter(
                Transaction.user_account_id == trx.user_account_id,
                Transaction.transaction_time >= time_threshold,
                Transaction.transaction_time <= trx.transaction_time
            ).scalar() or 0
            user_cache[user_key] = tx_count
        else:
            tx_count = user_cache[user_key]

        if tx_count >= VELOCITY_THRESHOLD:
            key = (service, VELOCITY_THRESHOLD, "velocity")
            velocity_counter[key] = velocity_counter.get(key, 0) + 1

        # 2. HIGH AMOUNT
        amount = float(trx.amount or 0)
        if amount >= AMOUNT_THRESHOLD:
            key = (service, AMOUNT_THRESHOLD, "amount")
            amount_counter[key] = amount_counter.get(key, 0) + 1

        # 3. FAN-IN
        terminal_id = trx.terminal_id
        if terminal_id:
            distinct_accounts = db.query(
                func.count(distinct(Transaction.transaction_details["issuer_account_number"].astext))
            ).filter(
                Transaction.terminal_id == terminal_id,
                Transaction.transaction_time >= time_threshold,
                Transaction.transaction_time <= trx.transaction_time
            ).scalar() or 0
            if distinct_accounts >= FAN_IN_THRESHOLD:
                key = ("FAN_IN", service, FAN_IN_THRESHOLD)
                network_counter[key] = network_counter.get(key, 0) + 1

        # 4. FAN-OUT
        if trx.user_account_id:
            distinct_customers = db.query(
                func.count(distinct(Transaction.transaction_details["nama_customer"].astext))
            ).filter(
                Transaction.user_account_id == trx.user_account_id,
                Transaction.transaction_time >= time_threshold,
                Transaction.transaction_time <= trx.transaction_time
            ).scalar() or 0
            if distinct_customers >= FAN_OUT_THRESHOLD:
                key = ("FAN_OUT", service, FAN_OUT_THRESHOLD)
                network_counter[key] = network_counter.get(key, 0) + 1

        # 5. DECLINE VELOCITY
        account_number = (trx.transaction_details or {}).get("issuer_account_number")
        if account_number:
            time_threshold = trx.transaction_time - timedelta(minutes=TIME_WINDOW)
            recent_trxs = db.query(Transaction).filter(
                Transaction.transaction_details["issuer_account_number"].astext == account_number,
                Transaction.transaction_time >= time_threshold,
                Transaction.transaction_time <= trx.transaction_time
            ).order_by(Transaction.transaction_time.desc()).limit(5).all()

            fail_count = 0
            for t in recent_trxs:
                rc = (t.transaction_details or {}).get("response_code")
                if rc != "00":
                    fail_count += 1
                else:
                    break

            if fail_count >= 3:
                key = ("DECLINE_VELOCITY", trx.service_source, 3)
                decline_counter[key] = decline_counter.get(key, 0) + 1

        # 6. SUPER PATTERN
        if account_number and trx.transaction_time:
            time_threshold = trx.transaction_time - timedelta(minutes=TIME_WINDOW)
            recent_trxs = db.query(Transaction).filter(
                Transaction.transaction_details["issuer_account_number"].astext == account_number,
                Transaction.transaction_time >= time_threshold,
                Transaction.transaction_time <= trx.transaction_time
            ).order_by(Transaction.transaction_time.asc()).limit(100).all()

            failure_count = 0
            success_found = False
            for t in recent_trxs:
                rc = (t.transaction_details or {}).get("response_code")
                if rc != "00":
                    failure_count += 1
                else:
                    success_found = True
                    break

            tx_count = db.query(func.count(Transaction.id)).filter(
                Transaction.transaction_details["issuer_account_number"].astext == account_number,
                Transaction.transaction_time >= time_threshold,
                Transaction.transaction_time <= trx.transaction_time
            ).scalar() or 0

            if failure_count >= 3 and success_found and tx_count >= 5:
                key = ("SUPER_DECLINE_VELOCITY", trx.service_source)
                super_pattern_counter[key] = super_pattern_counter.get(key, 0) + 1

    # ── COMPILE PATTERNS ──────────────────────────────────────
    patterns_created = []

    for (srv, threshold, _), count in velocity_counter.items():
        if count >= MIN_SUPPORT:
            patterns_created.append({
                "pattern_name": f"Auto Velocity {srv} ({threshold}+ tx in {TIME_WINDOW}m)",
                "pattern_category": "VELOCITY",
                "pattern_rules": {"logic": "AND", "time_window_minutes": TIME_WINDOW,
                    "conditions": [{"field": "tx_count", "operator": ">=", "value": threshold}]},
                "risk_score": 40, "action": "FLAG", "service_source": srv
            })

    for (srv, threshold, _), count in amount_counter.items():
        if count >= MIN_SUPPORT:
            patterns_created.append({
                "pattern_name": f"Auto High Amount {srv} ({threshold}+)",
                "pattern_category": "AMOUNT",
                "pattern_rules": {"logic": "AND",
                    "conditions": [{"field": "amount", "operator": ">=", "value": threshold}]},
                "risk_score": 50, "action": "FLAG", "service_source": srv
            })

    for (ptype, srv, threshold), count in network_counter.items():
        if count >= MIN_SUPPORT:
            if ptype == "FAN_IN":
                patterns_created.append({
                    "pattern_name": f"Fan-In Network {srv} ({threshold}+ cards in {TIME_WINDOW}m)",
                    "pattern_category": "NETWORK_FAN_IN",
                    "pattern_rules": {"logic": "AND", "time_window_minutes": TIME_WINDOW,
                        "conditions": [{"field": "distinct_account_count", "operator": ">=", "value": threshold}]},
                    "risk_score": 80, "action": "BLOCK", "service_source": srv
                })
            elif ptype == "FAN_OUT":
                patterns_created.append({
                    "pattern_name": f"Fan-Out Network {srv} ({threshold}+ customers in {TIME_WINDOW}m)",
                    "pattern_category": "NETWORK_FAN_OUT",
                    "pattern_rules": {"logic": "AND", "time_window_minutes": TIME_WINDOW,
                        "conditions": [{"field": "distinct_customer_count", "operator": ">=", "value": threshold}]},
                    "risk_score": 70, "action": "BLOCK", "service_source": srv
                })

    for (ptype, service, threshold), count in decline_counter.items():
        if count >= MIN_SUPPORT:
            patterns_created.append({
                "pattern_name": f"Decline Velocity {service} ({threshold}+ failures)",
                "pattern_category": "DECLINE_VELOCITY",
                "pattern_rules": {"logic": "AND", "time_window_minutes": TIME_WINDOW,
                    "conditions": [{"field": "failure_count", "operator": ">=", "value": threshold}]},
                "risk_score": 85, "action": "BLOCK", "service_source": service
            })

    for (ptype, service), count in super_pattern_counter.items():
        if count >= MIN_SUPPORT:
            patterns_created.append({
                "pattern_name": f"Super Decline + Velocity {service}",
                "pattern_category": "SUPER_PATTERN",
                "pattern_rules": {"logic": "AND", "time_window_minutes": TIME_WINDOW,
                    "conditions": [
                        {"field": "failure_count", "operator": ">=", "value": 3},
                        {"field": "tx_count", "operator": ">=", "value": 5},
                        {"field": "has_success_after_failure", "operator": "==", "value": True}
                    ]},
                "risk_score": 95, "action": "BLOCK", "service_source": service
            })

    return sorted(patterns_created, key=lambda x: x["risk_score"], reverse=True)


# =========================
# HASH GENERATOR & SAVER
# =========================
def _canonicalize_rules(value):
    """Normalize semantically equivalent rule JSON before hashing."""
    if isinstance(value, list):
        return [_canonicalize_rules(item) for item in value]
    if not isinstance(value, dict):
        return value

    normalized = {key: _canonicalize_rules(item) for key, item in value.items()}
    logic = str(normalized.get("logic", "")).upper()
    conditions = normalized.get("conditions")
    if logic in {"AND", "OR"} and isinstance(conditions, list):
        normalized["conditions"] = sorted(
            conditions,
            key=lambda item: json.dumps(item, sort_keys=True, separators=(",", ":")),
        )
    if normalized.get("operator") in {"IN", "NOT_IN"} and isinstance(normalized.get("value"), list):
        normalized["value"] = sorted(
            normalized["value"],
            key=lambda item: json.dumps(item, sort_keys=True, separators=(",", ":")),
        )
    return normalized


def generate_rules_hash(rules: dict):
    normalized = json.dumps(
        _canonicalize_rules(rules), sort_keys=True, separators=(",", ":")
    )
    return hashlib.md5(normalized.encode()).hexdigest()


def find_duplicate_pattern(
    db,
    rules_hash: str,
    service_source: str,
    exclude_id: int | None = None,
    pattern_rules: dict | None = None,
):
    """Serialize duplicate checks per hash/service without changing the table."""
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        lock_key = int(rules_hash[:16], 16)
        if lock_key >= 2**63:
            lock_key -= 2**64
        db.execute(
            text("SELECT pg_advisory_xact_lock(:lock_key)"),
            {"lock_key": lock_key},
        )

    query = db.query(FraudPattern).filter(
        FraudPattern.rules_hash == rules_hash,
        FraudPattern.service_source == service_source,
        FraudPattern.is_deleted == False,
    )
    if exclude_id is not None:
        query = query.filter(FraudPattern.id != exclude_id)
    duplicate = query.first()
    if duplicate or pattern_rules is None:
        return duplicate

    legacy_query = db.query(FraudPattern).filter(
        (FraudPattern.rules_hash.is_(None)) | (FraudPattern.rules_hash != rules_hash),
        FraudPattern.service_source == service_source,
        FraudPattern.is_deleted == False,
    )
    if exclude_id is not None:
        legacy_query = legacy_query.filter(FraudPattern.id != exclude_id)
    for legacy_pattern in legacy_query.all():
        if generate_rules_hash(legacy_pattern.pattern_rules) == rules_hash:
            legacy_pattern.rules_hash = rules_hash
            return legacy_pattern
    return None


@log_performance(label="PatternLearning.save_generated_patterns")
def save_generated_patterns(db, patterns, source=PatternSourceEnum.MANUAL_CREATE):
    if not patterns:
        return 0

    created_count = 0
    new_seen = set()

    for p in patterns:
        rules      = p["pattern_rules"]
        rules_hash = generate_rules_hash(rules)
        service    = p.get("service_source", "ALL")
        key        = (rules_hash, service)

        if key in new_seen:
            continue

        if find_duplicate_pattern(
            db,
            rules_hash,
            service,
            pattern_rules=rules,
        ):
            continue

        new_seen.add(key)
        risk          = p.get("risk_score", 40)
        auto_priority = 10 if risk >= 80 else 5 if risk >= 50 else 1

        new_pattern = FraudPattern(
            pattern_name     = p["pattern_name"],
            pattern_category = p.get("pattern_category"),
            pattern_rules    = rules,
            rules_hash       = rules_hash,
            risk_score       = risk,
            action           = "BLOCK" if str(p.get("action", "FLAG")).upper() == "BLOCK" else "FLAG",
            service_source   = service,
            priority         = auto_priority,
            pattern_source   = source,
            is_active        = False
        )
        db.add(new_pattern)
        created_count += 1

    db.flush()

    return created_count
