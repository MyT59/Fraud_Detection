from app.infrastructure.database.models.manual_review_model import ManualReview
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.application.services.pattern_lifecycle_service import apply_pattern_lifecycle
from app.application.services.activity_log_service import log_activity
from app.domain.entities.target_type import TargetType
from app.infrastructure.database.enums import TransactionStatusEnum
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
import logging
from datetime import datetime, timezone

from app.infrastructure.repositories.alert_repository import AlertRepository
from app.infrastructure.repositories.review_repository import ReviewRepository
from app.infrastructure.repositories.transaction_repository import TransactionRepository
from app.infrastructure.repositories.pattern_repository import PatternRepository

# Inisialisasi logger untuk memantau error di terminal
logger = logging.getLogger(__name__)

def review_transaction(db, alert_id: int, reviewer_id: int, decision: str, note: str):
    # 1. VALIDASI INPUT DI AWAL (Penting agar tidak membuang resource query)
    allowed = ["SAFE", "FRAUD"]
    decision = decision.upper()
    if decision not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid decision: {decision}. Allowed: {allowed}")

    try:
        # 2. AMBIL DATA ALERT
        alert_repo = AlertRepository(db)
        alert = alert_repo.get_by_id(alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        # 🔥 FIX 2: Urutan validasi diperbaiki (RESOLVED dulu baru OPEN)
        if alert.status == "RESOLVED":
            raise HTTPException(400, "Alert already resolved")
        
        if alert.status == "OPEN":
            alert.status = "IN_PROGRESS"

        # ❗ CEK DUPLICATE REVIEW (Pengecekan awal)
        review_repo = ReviewRepository(db)
        existing_review = review_repo.get_by_alert_id(alert_id)

        if existing_review:
            raise HTTPException(status_code=400, detail="Alert already reviewed")

        # 3. AMBIL DATA TRANSAKSI
        trx_repo = TransactionRepository(db)
        trx = trx_repo.get_by_id(alert.transaction_id)
        if not trx:
            raise HTTPException(status_code=404, detail="Transaction not found")

        # 4. KONVERSI STRING KE ENUM OBJECT
        try:
            target_status = TransactionStatusEnum(decision)
        except ValueError:
            raise HTTPException(status_code=400, detail="Decision does not match database Enum values")

        # 5. SIMPAN KE TABEL manual_reviews 
        review = ManualReview(
            transaction_id=trx.id,
            alert_id=alert.id,
            reviewer_id=reviewer_id, 
            decision=decision,
            review_note=note,
            previous_status=str(trx.final_status.value), 
            final_status=target_status
        )
        review_repo.create(review)
        
        # 🔥 FIX 1: Handle Race Condition via flush & IntegrityError
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="Alert already reviewed")

        # 6. UPDATE STATUS TRANSAKSI 
        trx.final_status = target_status

        if decision == "FRAUD":
            update_pattern_accuracy(db, trx, True)
        else:
            update_pattern_accuracy(db, trx, False)

        # 7. UPDATE ALERT 
        alert.status = "RESOLVED"
        alert.resolved_by = reviewer_id
        alert.resolved_at = datetime.now(timezone.utc)

        # 8. COMMIT SEMUA PERUBAHAN
        db.commit()
        db.refresh(review)

        log_activity(
            db=db,
            admin=type("obj", (object,), {"id": reviewer_id})(),
            action_type="REVIEW_ALERT",
            target_type=TargetType.TRANSACTION,
            target_id=trx.id,
            details=f"Decision={decision}, AlertID={alert.id}"
        )

        return review

    except HTTPException as http_exc:
        # Tangkap kembali HTTPException agar tidak dianggap error 500
        db.rollback()
        raise http_exc
    except Exception as e:
        db.rollback()
        # 🔥 FIX 4: Logger diperkuat untuk trace error di production
        logger.error(
            f"[REVIEW ERROR] alert_id={alert_id} reviewer_id={reviewer_id} error={str(e)}",
            exc_info=True
        )
        raise HTTPException(status_code=500, detail="Internal Server Error: Check database constraints (Admin ID existence or Enum mismatch)")

def get_review_history(
    db,
    page: int = 1,
    limit: int = 10
):
    query = db.query(ManualReview).join(Transaction)

    total = query.count()

    reviews = query.order_by(ManualReview.created_at.desc()) \
        .offset((page - 1) * limit) \
        .limit(limit) \
        .all()

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "data": [
            {
                "id": r.id,
                "transaction_id": r.transaction_id,
                "alert_id": r.alert_id,
                "decision": r.decision,
                "review_note": r.review_note,
                "previous_status": r.previous_status,
                "final_status": r.final_status,
                "reviewed_by": r.reviewer_id,
                "created_at": r.created_at
            }
            for r in reviews
        ]
    }

def update_pattern_accuracy(db, trx, is_fraud: bool):
    if not isinstance(trx.violation_pattern_ids, list) or not trx.violation_pattern_ids:
        return
    
    # 2. Inisialisasi PatternRepository
    pattern_repo = PatternRepository(db)

    for pattern_id in trx.violation_pattern_ids:
        # 3. Ganti db.query menjadi memanggil repository
        pattern = pattern_repo.get_by_id(pattern_id)

        if not pattern:
            continue

        # =========================
        # UPDATE COUNTER
        # =========================
        if is_fraud:
            pattern.true_positive = (pattern.true_positive or 0) + 1
        else:
            pattern.false_positive = (pattern.false_positive or 0) + 1

        # =========================
        # UPDATE ACCURACY
        # =========================
        tp = pattern.true_positive or 0
        fp = pattern.false_positive or 0
        total = tp + fp

        if total > 0:
            pattern.accuracy_score = tp / total
            pattern.false_positive_rate = fp / total

        # =========================
        # APPLY LIFECYCLE
        # =========================
        apply_pattern_lifecycle(db, pattern)