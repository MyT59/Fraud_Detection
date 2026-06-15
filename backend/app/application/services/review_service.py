from app.infrastructure.database.models.manual_review_model import ManualReview
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.application.services.pattern_lifecycle_service import apply_pattern_lifecycle
from app.application.services.activity_log_service import log_activity
from app.domain.entities.target_type import TargetType
from app.infrastructure.database.enums import TransactionStatusEnum

# 🔥 IMPORT ENUM STANDAR V1
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum

from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from sqlalchemy.orm.exc import StaleDataError
from datetime import datetime, timezone
from app.core.logging import get_logger, log_performance

from app.infrastructure.repositories.alert_repository import AlertRepository
from app.infrastructure.repositories.review_repository import ReviewRepository
from app.infrastructure.repositories.transaction_repository import TransactionRepository
from app.infrastructure.database.models.admin_model import Admin
from app.infrastructure.repositories.pattern_repository import PatternRepository
from app.infrastructure.database.models.ml_feedback_log_model import MLFeedbackLog
# Inisialisasi logger pusat untuk service ini
logger = get_logger(__name__)

@log_performance(label="ReviewService.review_transaction")
def review_transaction(db, alert_id: int, reviewer_id: int, decision: str, note: str, confidence: str): 
    allowed = ["SAFE", "FRAUD"]
    decision = decision.upper()
    if decision not in allowed:
        raise HTTPException(status_code=400, 
                            detail=f"Invalid decision: {decision}. Allowed: {allowed}")
    
    allowed_confidence = ["LOW", "MEDIUM", "HIGH"]
    confidence = confidence.upper()  
    if confidence not in allowed_confidence:
        raise HTTPException(status_code=400, 
                            detail=f"Invalid confidence level: {confidence}. Allowed: {allowed_confidence}")

    try:
        alert_repo = AlertRepository(db)
        alert = alert_repo.get_by_id(alert_id)
        if not alert:
            raise HTTPException(status_code=404, 
                                detail="Alert not found")
        
        if alert.status == "RESOLVED":
            raise HTTPException(400, "Alert already resolved")
            
        if alert.status == "OPEN":
            raise HTTPException(status_code=400, 
                                detail="Alert must be claimed before submitting a review. Please claim it first.")
            
        if alert.claimed_by != reviewer_id:
            raise HTTPException(status_code=403, 
                                detail=f"Access Denied: This alert is currently claimed by Analyst ID {alert.claimed_by}")

        review_repo = ReviewRepository(db)
        existing_review = review_repo.get_by_alert_id(alert_id)
        if existing_review:
            raise HTTPException(status_code=400, 
                                detail="Alert already reviewed")

        trx_repo = TransactionRepository(db)
        trx = trx_repo.get_by_id(alert.transaction_id)
        if not trx:
            raise HTTPException(status_code=404, 
                                detail="Transaction not found")

        try:
            target_status = TransactionStatusEnum(decision)
        except ValueError:
            raise HTTPException(status_code=400, 
                                detail="Decision does not match database Enum values")

        transaction_snapshot = {
            "id": trx.id,
            "original_trx_id": trx.original_trx_id,
            "service_source": trx.service_source,
            "user_account_id": trx.user_account_id,
            "amount": float(trx.amount) if trx.amount is not None else 0.0,
            "transaction_time": str(trx.transaction_time) if trx.transaction_time else None,
            "transaction_status": trx.transaction_status,
            "terminal_id": trx.terminal_id,
            "account_number": trx.account_number,
            "merchant_id": trx.merchant_id,
            "ip_address": trx.ip_address,
            "city": trx.city,
            "country": trx.country,
            "transaction_details": trx.transaction_details,
            "anomaly_score": trx.anomaly_score,
            "risk_score": trx.risk_score,
            "risk_level": trx.risk_level,
            "score_breakdown": trx.score_breakdown,
            "is_flagged_ml": trx.is_flagged_ml,
            "violation_reason": trx.violation_reason,
            "violation_rule_ids": trx.violation_rule_ids,
            "violation_pattern_ids": trx.violation_pattern_ids,
            "final_status": str(trx.final_status.value) if trx.final_status else None
        }

        now_utc = datetime.now(timezone.utc)

        # Ambil nama reviewer untuk disimpan sebagai snapshot immutable
        # Tetap aman jika admin tidak ditemukan (SET NULL pada FK)
        reviewer = db.query(Admin).filter(Admin.id == reviewer_id).first()
        reviewer_name_snapshot = reviewer.full_name if reviewer else None

        review = ManualReview(
            transaction_id=trx.id,
            alert_id=alert.id,
            reviewer_id=reviewer_id,
            reviewer_name=reviewer_name_snapshot,  # ✅ Snapshot immutable untuk audit trail
            decision=decision,
            review_note=note,
            decision_confidence=confidence,
            previous_status=str(trx.final_status.value),
            final_status=target_status,
            transaction_snapshot=transaction_snapshot,
            review_started_at=alert.created_at,
            review_completed_at=now_utc
        )
        review_repo.create(review)
        
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="Alert already reviewed")
        
        feedback_log = MLFeedbackLog(
            review_id=None,
            transaction_id=trx.id,
            original_trx_id=trx.original_trx_id,
            service_source=trx.service_source,
            user_account_id=trx.user_account_id,
            amount=trx.amount,
            transaction_time=trx.transaction_time,
            transaction_status=trx.transaction_status,
            terminal_id=trx.terminal_id,
            account_number=trx.account_number,
            merchant_id=trx.merchant_id,
            ip_address=trx.ip_address,
            city=trx.city,
            country=trx.country,
            transaction_details=trx.transaction_details,
            anomaly_score=trx.anomaly_score,
            risk_score=trx.risk_score,
            risk_level=trx.risk_level,
            score_breakdown=trx.score_breakdown,
            is_flagged_ml=trx.is_flagged_ml,
            violation_reason=trx.violation_reason,
            violation_rule_ids=trx.violation_rule_ids,
            violation_pattern_ids=trx.violation_pattern_ids,
            analyst_decision=decision,
            decision_confidence=confidence
        )
        db.add(feedback_log)

        trx.final_status = target_status

        if decision == "FRAUD":
            update_pattern_accuracy(db, trx, True)
        else:
            update_pattern_accuracy(db, trx, False)

        alert.status = "RESOLVED"
        alert.resolved_by = reviewer_id
        alert.resolved_at = now_utc
        action_enum = ActivityActionEnum.REVIEW_REJECTED if decision == "FRAUD" else ActivityActionEnum.REVIEW_APPROVED

        log_activity(
            db=db,
            admin=type("obj", (object,), {"id": reviewer_id})(),
            action_type=action_enum,
            module_source=EventSourceEnum.MANUAL_REVIEW,
            severity=SeverityLevelEnum.INFO,
            target_type=TargetType.TRANSACTION,
            target_id=trx.id,
            ip_address=getattr(trx, "ip_address", None),
            details={"decision": decision, "alert_id": alert.id, "confidence": confidence}
        )

        db.commit()
        db.refresh(review)
        return review

    except HTTPException as http_exc:
        db.rollback()
        raise http_exc
    except StaleDataError:
        db.rollback()
        raise HTTPException(status_code=409, 
                            detail="Race Condition Detected: Kasus ini baru saja diperbarui atau diselesaikan oleh analis lain.")
    except Exception as e:
        db.rollback()
        logger.error(f"[REVIEW ERROR] alert_id={alert_id} reviewer_id={reviewer_id} error={str(e)}",
                      exc_info=True)
        raise HTTPException(status_code=500, 
                            detail="Internal Server Error")

@log_performance(label="ReviewService.get_review_history")
def get_review_history(db, page: int = 1, limit: int = 10):
    query = db.query(ManualReview).join(Transaction).filter(ManualReview.is_deleted == False)
    total = query.count()

    reviews = query.order_by(ManualReview.created_at.desc()) \
        .offset((page - 1) * limit) \
        .limit(limit) \
        .all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "transaction_id": r.transaction_id,
                "alert_id": r.alert_id,
                "decision": r.decision,
                "decision_confidence": r.decision_confidence,
                "review_note": r.review_note,
                "previous_status": r.previous_status,
                "final_status": r.final_status,
                "reviewed_by": r.reviewer_id,
                "reviewer_name": r.reviewer_name,
                "created_at": r.created_at,
                "review_started_at": r.review_started_at,
                "review_completed_at": r.review_completed_at,
                "is_overridden": r.is_overridden or False,
                "overridden_by": r.overridden_by,
                "overridden_at": r.overridden_at,
                "override_reason": r.override_reason,
                "transaction_snapshot": r.transaction_snapshot,
            }
            for r in reviews
        ]
    }


@log_performance(label="ReviewService.get_my_review_history")
def get_my_review_history(db, reviewer_id: int, page: int = 1, limit: int = 10):
    """
    Riwayat review milik analis yang sedang login.
    FRAUD_ANALYST hanya bisa lihat history miliknya sendiri.
    """
    review_repo = ReviewRepository(db)
    total, reviews = review_repo.get_history_by_reviewer(reviewer_id, page, limit)

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [
            {
                "id": r.id,
                "transaction_id": r.transaction_id,
                "alert_id": r.alert_id,
                "decision": r.decision,
                "decision_confidence": r.decision_confidence,
                "review_note": r.review_note,
                "previous_status": r.previous_status,
                "final_status": r.final_status,
                "reviewed_by": r.reviewer_id,
                "reviewer_name": r.reviewer_name,
                "created_at": r.created_at,
                "review_started_at": r.review_started_at,
                "review_completed_at": r.review_completed_at,
                "is_overridden": r.is_overridden or False,
                "overridden_by": r.overridden_by,
                "overridden_at": r.overridden_at,
                "override_reason": r.override_reason,
                "transaction_snapshot": r.transaction_snapshot,
            }
            for r in reviews
        ]
    }


@log_performance(label="ReviewService.get_my_review_metrics_service")
def get_my_review_metrics_service(db, reviewer_id: int):
    """
    Metrics personal milik analis yang sedang login.
    FRAUD_ANALYST lihat stats miliknya sendiri, bukan seluruh tim.
    """
    from app.infrastructure.repositories.alert_repository import AlertRepository

    review_repo = ReviewRepository(db)
    alert_repo  = AlertRepository(db)

    review_counts    = review_repo.get_decision_counts_by_reviewer(reviewer_id)
    avg_duration_sec = review_repo.get_avg_duration_by_reviewer(reviewer_id)

    total_rev = review_counts["total"]
    fraud_cnt = review_counts["fraud"]
    safe_cnt  = review_counts["safe"]

    confirmation_rate  = round((fraud_cnt / total_rev * 100), 2) if total_rev > 0 else 0.0
    avg_duration_min   = round((avg_duration_sec / 60), 2)

    # Alert yang sedang di-klaim oleh analis ini
    in_progress_alerts = db.query(ManualReview).filter(
        ManualReview.reviewer_id == reviewer_id,
        ManualReview.is_deleted == False
    ).count()

    return {
        "total_reviews": total_rev,
        "fraud_count": fraud_cnt,
        "safe_count": safe_cnt,
        "fraud_confirmation_rate": confirmation_rate,
        "avg_review_duration_minutes": avg_duration_min,
        "open_alerts": alert_repo.get_open_alert_count(),
        "in_progress_alerts": in_progress_alerts
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

@log_performance(label="ReviewService.get_review_metrics_service")
def get_review_metrics_service(db):
    review_repo = ReviewRepository(db)
    alert_repo = AlertRepository(db)
    review_counts = review_repo.get_decision_counts()
    avg_duration_seconds = review_repo.get_avg_review_duration_seconds()
    open_alerts = alert_repo.get_count_by_status("OPEN")
    in_progress_alerts = alert_repo.get_count_by_status("IN_PROGRESS")
    total_rev = review_counts["total"]
    fraud_cnt = review_counts["fraud"]
    safe_cnt = review_counts["safe"]
    
    # Hitung Fraud Confirmation Rate dalam %
    confirmation_rate = round((fraud_cnt / total_rev * 100), 2) if total_rev > 0 else 0.0
    
    avg_duration_minutes = round((avg_duration_seconds / 60), 2)
    
    return {
        "total_reviews": total_rev,
        "fraud_count": fraud_cnt,
        "safe_count": safe_cnt,
        "fraud_confirmation_rate": confirmation_rate,
        "avg_review_duration_minutes": avg_duration_minutes,
        "open_alerts": open_alerts,
        "in_progress_alerts": in_progress_alerts
    }

@log_performance(label="ReviewService.get_analyst_performance_service")
def get_analyst_performance_service(db):
    review_repo = ReviewRepository(db)
    metrics = review_repo.get_analyst_performance_metrics()
    
    return [
        {
            "analyst_id": m.analyst_id,
            "analyst_name": m.analyst_name,
            "analyst_email": m.analyst_email,
            "reviews_completed": m.reviews_completed or 0,
            "avg_review_seconds": round(m.avg_review_seconds or 0.0, 2),
            "fraud_detected": int(m.fraud_detected or 0)
        }
        for m in metrics
    ]

@log_performance(label="ReviewService.get_review_timeline_analytics_service")
def get_review_timeline_analytics_service(db):
    """
    Mengorkestrasi pengambilan data analytics lini waktu (time-series)
    dari level infrastruktur (Repository).
    """
    review_repo = ReviewRepository(db)
    
    return {
        "reviews_per_hour_24h": review_repo.get_hourly_reviews_24h(),
        "fraud_per_day_7d": review_repo.get_daily_fraud_7d(),
        "queue_growth_7d": review_repo.get_queue_growth_7d()
    }

# 🔥 TAMBAHAN BARU POIN 14: Soft Delete Review (Compliance Hardening)
@log_performance(label="ReviewService.soft_delete_review_service")
def soft_delete_review_service(db, review_id: int, admin_id: int):
    review = db.query(ManualReview).filter(ManualReview.id == review_id, ManualReview.is_deleted == False).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review history tidak ditemukan")
        
    review.is_deleted = True
    review.deleted_at = datetime.now(timezone.utc)
    review.deleted_by = admin_id 
    
    log_activity(
        db=db,
        admin=type("obj", (object,), {"id": admin_id})(),
        action_type=ActivityActionEnum.SOFT_DELETE_REVIEW,
        module_source=EventSourceEnum.MANUAL_REVIEW,
        severity=SeverityLevelEnum.HIGH,
        target_type=TargetType.TRANSACTION,
        target_id=review.transaction_id,
        details=f"Review ID {review.id} soft deleted for compliance reason by Admin ID {admin_id}."
    )
    db.commit()
    return {"status": "success", "message": "Review history successfully soft deleted for compliance tracking."}

@log_performance(label="ReviewService.override_review_decision_service")
def override_review_decision_service(db, review_id: int, admin_id: int, new_decision: str, reason: str):
    review = db.query(ManualReview).filter(ManualReview.id == review_id, 
                                           ManualReview.is_deleted == False).first()
    if not review:
        raise HTTPException(status_code=404,
                             detail="Review history tidak ditemukan")
        
    new_decision = new_decision.upper()
    if review.decision == new_decision:
        raise HTTPException(status_code=400, 
                            detail=f"Vonis saat ini sudah berstatus {new_decision}. Tidak ada perubahan keputusan.")

    try:
        trx = db.query(Transaction).filter(Transaction.id == review.transaction_id).first()
        alert = db.query(FraudAlert).filter(FraudAlert.id == review.alert_id).first()
        
        snapshot_before = {
            "decision": review.decision,
            "final_status": str(review.final_status.value) if review.final_status else None
        }

        if new_decision == "FRAUD":
            update_pattern_accuracy(db, trx, is_fraud=True) 
            target_status = TransactionStatusEnum.FRAUD
        else:
            update_pattern_accuracy(db, trx, is_fraud=False)
            target_status = TransactionStatusEnum.SAFE

        review.is_overridden = True
        review.overridden_by = admin_id
        review.overridden_at = datetime.now(timezone.utc)
        review.override_reason = reason
        review.decision = new_decision
        review.final_status = target_status
        if trx:
            trx.final_status = target_status
        if alert:
            alert.status = "OVERRIDDEN" 
        snapshot_after = {
            "decision": review.decision,
            "final_status": str(review.final_status.value) if review.final_status else None
        }

        log_activity(
            db=db,
            admin=type("obj", (object,), {"id": admin_id})(),
            action_type=ActivityActionEnum.REVIEW_OVERRIDDEN,
            module_source=EventSourceEnum.MANUAL_REVIEW,
            severity=SeverityLevelEnum.HIGH, 
            target_type=TargetType.TRANSACTION,
            target_id=trx.id,
            ip_address=getattr(trx, "ip_address", None),
            details={
                "before": snapshot_before,
                "after": snapshot_after,
                "reason": reason
            }
        )
        db.commit()
        return {"status": "success", "message": f"Decision successfully overridden to {new_decision}."}
        
    except StaleDataError:
        db.rollback()
        raise HTTPException(status_code=404, detail="Locking Error: Data ini baru saja diubah oleh proses paralel lain.")
    
@log_performance(label="ReviewService.log_false_negative_service")
def log_false_negative_service(db, transaction_id: int, admin_id: int, reason: str):
    """
    Fitur khusus pimpinan untuk menandai transaksi sukses yang ternyata lolos dari ML (False Negative).
    """
    trx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not trx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
        
    if trx.final_status == TransactionStatusEnum.FRAUD:
        raise HTTPException(status_code=400, detail="Transaksi ini memang sudah berstatus FRAUD")

    trx.final_status = TransactionStatusEnum.FRAUD
    trx.violation_reason = f"[FALSE_NEGATIVE_REPORT] {reason}"
    feedback_log = MLFeedbackLog(
        review_id=None, 
        transaction_id=trx.id,
        original_trx_id=trx.original_trx_id,
        service_source=trx.service_source,
        user_account_id=trx.user_account_id,
        amount=trx.amount,
        transaction_time=trx.transaction_time,
        transaction_status=trx.transaction_status,
        terminal_id=trx.terminal_id,
        account_number=trx.account_number,
        merchant_id=trx.merchant_id,
        ip_address=trx.ip_address,
        city=trx.city,
        country=trx.country,
        transaction_details=trx.transaction_details,
        anomaly_score=trx.anomaly_score,
        risk_score=trx.risk_score,
        risk_level=trx.risk_level,
        score_breakdown=trx.score_breakdown,
        is_flagged_ml=trx.is_flagged_ml,
        violation_reason=trx.violation_reason,
        violation_rule_ids=trx.violation_rule_ids,
        violation_pattern_ids=trx.violation_pattern_ids,
        analyst_decision="FRAUD", 
        decision_confidence="HIGH" 
    )
    db.add(feedback_log)

    update_pattern_accuracy(db, trx, is_fraud=True)

    log_activity(
        db=db,
        admin=type("obj", (object,), {"id": admin_id})(),
        action_type=ActivityActionEnum.REPORT_FALSE_NEGATIVE,
        module_source=EventSourceEnum.MANUAL_REVIEW,
        severity=SeverityLevelEnum.HIGH,
        target_type=TargetType.TRANSACTION,
        target_id=trx.id,
        details=f"Transaction reported as False Negative by Risk Manager ID {admin_id}. Reason: {reason}"
    )
    
    db.commit()
    return {"status": "success", 
            "message": "Transaksi berhasil ditandai sebagai False Negative. Dataset retraining telah diperbarui."}