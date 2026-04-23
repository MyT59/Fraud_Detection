import logging
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.blacklist_items_model import BlacklistItem
from app.infrastructure.database.models.global_rule_model import GlobalRule
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.infrastructure.database.enums import TransactionStatusEnum

# Setup Logger untuk standardisasi production
logger = logging.getLogger(__name__)

# HELPER
def evaluate_rule(value, operator, threshold):
    try:
        val_float = float(value)
        threshold_float = float(threshold)
    except (ValueError, TypeError):
        return False

    if operator == ">":
        return val_float > threshold_float
    elif operator == "<":
        return val_float < threshold_float
    elif operator == ">=":
        return val_float >= threshold_float
    elif operator == "<=":
        return val_float <= threshold_float
    elif operator == "=":
        return val_float == threshold_float

    return False

# MAIN PROCESS
def process_transaction(data: dict, db: Session):

    try:
        # IDEMPOTENCY CHECK
        existing = db.query(Transaction).filter(
            Transaction.service_source == data["service_source"],
            Transaction.original_trx_id == data["original_trx_id"]
        ).first()

        if existing:
            return existing  # skip duplicate
        if not data.get("original_trx_id"):
            raise ValueError("original_trx_id required")

        if not data.get("service_source"):
            raise ValueError("service_source required")

        if not data.get("user_account_id"):
            raise ValueError("user_account_id required")

        amount = data.get("amount")

        if not isinstance(amount, (int, float)):
            raise ValueError("amount must be number")

        if amount < 0:
            raise ValueError("amount cannot be negative")

        # INSERT
        trx = Transaction(
            original_trx_id=data["original_trx_id"],
            service_source=data["service_source"].upper(),
            user_account_id=data["user_account_id"],
            amount=amount,
            transaction_time=data.get("transaction_time", datetime.utcnow()),
            transaction_status="SUCCESS"
        )

        db.add(trx)
        db.flush()

        # INIT
        violations = []
        risk_score = 0

        # BLACKLIST
        blacklist = db.query(BlacklistItem).filter(
            BlacklistItem.value == trx.user_account_id,
            BlacklistItem.is_active == True
        ).first()

        if blacklist:
            violations.append({
                "type": "BLACKLIST",
                "name": blacklist.reason
            })
            risk_score = 100
            if v["type"] == "BLACKLIST":
                formatted.append(f"BLACKLIST:{v['name']}")
                
            trx.risk_score = risk_score
            trx.risk_level = "HIGH"
            trx.final_status = TransactionStatusEnum.FRAUD
            formatted = []
            for v in violations:
                if v["type"] == "RULE":
                    formatted.append(f"RULE:{v['name']}")
                elif v["type"] == "PATTERN":
                    formatted.append(f"PATTERN:{v['name']}({v.get('value','')})")
            trx.violation_reason = " | ".join(formatted)

            db.commit()
            db.refresh(trx)
            return trx 

        # RULE ENGINE
        rules = db.query(GlobalRule).filter(
            GlobalRule.is_active == True
        ).order_by(GlobalRule.priority.desc()).limit(50).all()

        for rule in rules:

            # service scope
            if rule.service_scope != "ALL" and rule.service_scope != trx.service_source:
                continue

            value = getattr(trx, rule.condition_field, None)

            if value is None:
                continue

            if evaluate_rule(value, rule.operator, rule.threshold_value):

                violations.append({"type": "RULE","name": rule.rule_name})
                trx.violation_rule_id = rule.id

                if rule.severity == "HIGH":
                    risk_score += 50
                elif rule.severity == "MEDIUM":
                    risk_score += 30
                else:
                    risk_score += 10

        # PATTERN ENGINE
        patterns = db.query(FraudPattern).filter(
            FraudPattern.is_active == True
        ).limit(50).all()
        pattern_ids = []

        for pattern in patterns:

            # service filter
            if pattern.service_source != "ALL" and pattern.service_source != trx.service_source:
                continue

            rules = pattern.pattern_rules

            time_window = rules.get("time_window_minutes", 5)
            time_threshold = trx.transaction_time - timedelta(minutes=time_window)

            # Cegah Memory Leak/OOM
            recent_stats = db.query(
                func.count(Transaction.id).label("tx_count"),
                func.sum(Transaction.amount).label("total_amount")
            ).filter(
                Transaction.user_account_id == trx.user_account_id,
                Transaction.transaction_time >= time_threshold
            ).first()

            # Mapping hasil dari Database ke variabel asli
            tx_count = recent_stats.tx_count or 0
            total_amount = recent_stats.total_amount or 0


            # VELOCITY
            if rules.get("type") == "VELOCITY":
                if tx_count >= rules.get("min_tx_count", 3):
                    violations.append({
                        "type": "PATTERN",
                        "name": pattern.pattern_name,
                        "value": tx_count
                    })
                    risk_score += rules.get("risk_score", 40)
                    pattern_ids.append(pattern.id)



            # BURST
            elif rules.get("type") == "BURST":
                if total_amount >= rules.get("min_total_amount", 0):
                    violations.append({
                        "type": "PATTERN",
                        "name": pattern.pattern_name,
                        "value": int(total_amount)
                    })
                    risk_score += rules.get("risk_score", 40)
                    pattern_ids.append(pattern.id)


        # FINAL DECISION
        trx.risk_score = risk_score

        if risk_score >= 100:
            trx.risk_level = "HIGH"
            trx.final_status = TransactionStatusEnum.FRAUD
        elif risk_score >= 50:
            trx.risk_level = "MEDIUM"
            trx.final_status = TransactionStatusEnum.REVIEW
        elif risk_score > 0:
            trx.risk_level = "LOW"
            trx.final_status = TransactionStatusEnum.REVIEW
        else:
            trx.risk_level = "SAFE"
            trx.final_status = TransactionStatusEnum.SAFE

        if violations:
            formatted = []
            for v in violations:
                if v["type"] == "RULE":
                    formatted.append(f"RULE:{v['name']}")
                elif v["type"] == "PATTERN":
                    formatted.append(f"PATTERN:{v['name']}({v.get('value','')})")
            trx.violation_reason = " | ".join(formatted)

        if pattern_ids:
             trx.violation_pattern_id = pattern_ids[0]  

        # COMMIT (ATOMIC)
        db.commit()
        db.refresh(trx)

        return trx

    except IntegrityError:
        db.rollback()

        # fallback kalau race condition duplicate
        return db.query(Transaction).filter(
            Transaction.service_source == data["service_source"],
            Transaction.original_trx_id == data["original_trx_id"]
        ).first()

    except Exception as e:
        db.rollback()
        logger.error(f"Error processing transaction {data.get('original_trx_id')}: {str(e)}", exc_info=True)
        logger.info(
    f"[FDS] trx_id={trx.id} | score={trx.risk_score} | level={trx.risk_level} | status={trx.final_status}"
)
        return None