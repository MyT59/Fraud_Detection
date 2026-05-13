import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.enums import TransactionStatusEnum

from app.application.services.alert_service import create_alert
from app.application.services.rule_engine_service import run_rule_engine
from app.application.services.pattern_engine_service import run_pattern_engine
from app.application.services.blacklist_service import run_blacklist_check
from app.application.services.ensemble_engine_service import run_ensemble_engine
from app.application.services.activity_log_service import log_activity
from app.application.services.ml_realtime_service import (
    enqueue_ml_processing,
)
from app.domain.entities.target_type import TargetType
from app.infrastructure.repositories.transaction_repository import TransactionRepository
from app.infrastructure.database.models.global_rule_model import GlobalRule

logger = logging.getLogger(__name__)


# =========================
# HELPER FUNCTIONS
# =========================
def normalize(value: str | None, to_lower: bool = True):
    if value is None:
        return None
    value = str(value).strip()
    return value.lower() if to_lower else value

def _apply_hard_block(trx: Transaction, violations: list, db: Session, bl_score: float = None):
    """
    Helper untuk menangani eksekusi early return (Blacklist / Rule Block).
    Mencegah duplikasi kode dan memastikan is_flagged_ml di-set sebelum commit.
    """
    trx.risk_score = max(100, bl_score or 100)
    trx.final_status = TransactionStatusEnum.FRAUD
    trx.risk_level = "CRITICAL"

    if violations:
        trx.violation_reason = " | ".join([f"{v['type']}:{v['name']}" for v in violations])

    # FIX BUG #1, #3 & #4: Set flag & buat alert sebelum commit
    trx.is_flagged_ml = True
    create_alert(db, trx)  # Pastikan alert_service HANYA melakukan db.add(alert)

    log_activity(
        db=db,
        admin=None,
        action_type="FLAG_TRANSACTION",
        target_type=TargetType.TRANSACTION,
        target_id=trx.id,
        details=f"Risk score={trx.risk_score}, level={trx.risk_level} (HARD BLOCK)"
    )
    
    db.commit()

    # =========================================================
    # ASYNC ML RUNTIME PROCESSING
    # =========================================================

    enqueue_ml_processing(
        db=db,
        transaction_id=trx.id,
    )
    db.refresh(trx)
    return trx
    

def _determine_risk_level(score: int) -> str:
    """Mapping score ke risk level dengan lebih rapi"""
    if score >= 80: return "CRITICAL"
    if score >= 60: return "HIGH"
    if score >= 40: return "MEDIUM"
    if score >= 20: return "LOW"
    return "SAFE"


# =========================
# MAIN PROCESS
# =========================
def process_transaction(data: dict, db: Session):
    try:
        # =========================
        # 1. VALIDATION & IDEMPOTENCY
        # =========================
        original_trx_id = data.get("original_trx_id")
        service_source = data.get("service_source").upper()
        user_account_id = data.get("user_account_id")
        amount = data.get("amount")

        if not original_trx_id or not service_source or not user_account_id:
            raise ValueError("original_trx_id, service_source, and user_account_id are required")

        if not isinstance(amount, (int, float)):
            raise ValueError("amount must be a number")

        repo = TransactionRepository(db)
        existing = repo.get_by_original(service_source, original_trx_id)

        if existing:
            return existing

        # =========================
        # 2. CREATE TRANSACTION
        # =========================
        trx = Transaction(
            original_trx_id=original_trx_id,
            service_source = data.get("service_source").upper(),
            user_account_id=normalize(user_account_id),
            amount=amount,
            transaction_time=data.get("transaction_time") or datetime.now(timezone.utc),
            transaction_status="SUCCESS",
            final_status=TransactionStatusEnum.PENDING,
            ip_address=data.get("ip_address"),
            terminal_id=data.get("terminal_id"),
            merchant_id=data.get("merchant_id"),
            account_number=data.get("account_number"),
            transaction_details=data.get("transaction_details")
        )

        repo.create(trx)

        violations = []

        # =========================
        # 3. BLACKLIST ENGINE
        # =========================
        is_blacklisted, bl_violations, bl_score = run_blacklist_check(db, trx)
        violations.extend(bl_violations)

        if is_blacklisted:
            return _apply_hard_block(trx, violations, db, bl_score)

        # =========================
        # 4. RULE ENGINE
        # =========================
        rule_violations, rule_score, rule_actions = run_rule_engine(db, trx)
        violations.extend(rule_violations)
        trx.violation_rule_ids = [
            v["rule_id"] for v in rule_violations
            if "rule_id" in v
        ]   

        if isinstance(rule_actions, str): 
            rule_actions = [rule_actions]

        if "BLOCK" in rule_actions:
            return _apply_hard_block(trx, violations, db, bl_score)

        # =========================
        # 5. PATTERN ENGINE
        # =========================
        pattern_violations, pattern_ids, pattern_score, pattern_actions = run_pattern_engine(db, trx)
        violations.extend(pattern_violations)

        if isinstance(pattern_actions, str): 
            pattern_actions = [pattern_actions]

        # =========================
        # 6. ENSEMBLE ENGINE
        # =========================
        ml_score = 0
        ensemble = run_ensemble_engine(
            rule_score, rule_actions, pattern_score, pattern_actions, ml_score
        )

        trx.risk_score = ensemble.get("final_score", 0)
        trx.final_status = ensemble.get("final_status", TransactionStatusEnum.REVIEW)
        trx.score_breakdown = {
            "rule_score": rule_score,
            "pattern_score": pattern_score,
            "ml_score": ml_score,
            "final_score": trx.risk_score
        }

        # =========================
        # 7. RISK ESCALATION
        # =========================
        if len(pattern_ids) >= 2:
            trx.risk_score = min(100, trx.risk_score + 10)

        if any("Super" in v["name"] or "Decline + Velocity" in v["name"] for v in violations):
             trx.risk_score = min(100, trx.risk_score + 20)

        if trx.risk_score >= 90:
            trx.final_status = TransactionStatusEnum.FRAUD

        # =========================
        # 8. FINALIZE TRANSACTION DATA
        # =========================
        trx.risk_level = _determine_risk_level(trx.risk_score)
        trx.violation_pattern_ids = pattern_ids
        
        if violations:
            trx.violation_reason = " | ".join([f"{v['type']}:{v['name']}" for v in violations])

        # =========================
        # 9. ALERT & COMMIT (FINAL STATE)
        # =========================
        # FIX BUG #1 & #2: Siapkan state dengan utuh, alert tanpa commit, baru final commit
        if trx.final_status in [TransactionStatusEnum.REVIEW, TransactionStatusEnum.FRAUD]:
            trx.is_flagged_ml = True
            create_alert(db, trx)
            
            # 🔥 TAMBAHKAN DI SINI (Normal ML/Rule Flagging)
            log_activity(
                db=db,
                admin=None,
                action_type="FLAG_TRANSACTION",
                target_type=TargetType.TRANSACTION,
                target_id=trx.id,
                details=f"Risk score={trx.risk_score}, level={trx.risk_level}"
            )

        repo.commit()
        repo.refresh(trx)

        return trx

    # =========================
    # ERROR HANDLING
    # =========================
    except IntegrityError:
        db.rollback()
        return db.query(Transaction).filter(
            Transaction.service_source == data.get("service_source"),
            Transaction.original_trx_id == data.get("original_trx_id")
        ).first()

    except Exception as e:
        db.rollback()
        logger.error(
            f"Error processing transaction {data.get('original_trx_id', 'UNKNOWN')}: {str(e)}",
            exc_info=True
        )

        if 'trx' in locals() and getattr(trx, 'id', None):
            logger.info(
                f"[FDS] trx_id={trx.id} | score={getattr(trx, 'risk_score', 'N/A')} "
                f"| level={getattr(trx, 'risk_level', 'N/A')} "
                f"| status={getattr(trx, 'final_status', 'N/A')}"
            )
        else:
            logger.info("[FDS] Failed before transaction creation")

        return None