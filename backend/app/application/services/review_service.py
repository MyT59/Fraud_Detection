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
from sqlalchemy import String, cast, or_
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
        alert = db.query(FraudAlert).filter(
            FraudAlert.id == alert_id
        ).with_for_update().first()
        if not alert:
            raise HTTPException(status_code=404, 
                                detail="Alert not found")
        
        alert_status = alert.status.value if hasattr(alert.status, "value") else str(alert.status)
        if alert_status != "IN_PROGRESS":
            raise HTTPException(status_code=400, 
                                detail="Alert must be IN_PROGRESS and claimed before submitting a review.")
            
        if alert.claimed_by != reviewer_id:
            raise HTTPException(status_code=403, 
                                detail=f"Access Denied: This alert is currently claimed by Analyst ID {alert.claimed_by}")

        review_repo = ReviewRepository(db)
        existing_review = review_repo.get_by_alert_id(alert_id)
        if existing_review:
            raise HTTPException(status_code=400, 
                                detail="Alert already reviewed")

        trx = db.query(Transaction).filter(
            Transaction.id == alert.transaction_id
        ).with_for_update().first()
        if not trx:
            raise HTTPException(status_code=404, 
                                detail="Transaction not found")

        if trx.final_status != TransactionStatusEnum.FLAGGED:
            raise HTTPException(
                status_code=409,
                detail="Only FLAGGED transactions can receive a final analyst review.",
            )

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
            review_started_at=alert.claimed_at or now_utc,
            review_completed_at=now_utc
        )
        try:
            db.add(review)
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Alert already reviewed")
        
        feedback_log = MLFeedbackLog(
            review_id=review.id,
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

def _apply_history_filters(query, reviewed_by=None, decision=None, search=None, sort_by="newest"):
    if reviewed_by is not None:
        query = query.filter(ManualReview.reviewer_id == reviewed_by)
    if decision:
        query = query.filter(ManualReview.decision == decision)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(
            cast(ManualReview.transaction_id, String).ilike(term),
            cast(ManualReview.alert_id, String).ilike(term),
            cast(ManualReview.reviewer_id, String).ilike(term),
            ManualReview.reviewer_name.ilike(term),
        ))
    return query.order_by(
        ManualReview.created_at.asc() if sort_by == "oldest" else ManualReview.created_at.desc()
    )


@log_performance(label="ReviewService.get_review_history")
def get_review_history(db, page: int = 1, limit: int = 10, reviewed_by: int | None = None,
                       decision: str | None = None, search: str | None = None, sort_by: str = "newest"):
    query = db.query(ManualReview).join(Transaction).filter(ManualReview.is_deleted == False)
    query = _apply_history_filters(query, reviewed_by, decision, search, sort_by)
    total = query.count()

    reviews = query \
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
                "original_decision": ((r.transaction_snapshot or {}).get("_review_decision_history") or [{}])[0].get("decision"),
                "overridden_by": r.overridden_by,
                "overridden_at": r.overridden_at,
                "override_reason": r.override_reason,
                "transaction_snapshot": r.transaction_snapshot,
            }
            for r in reviews
        ]
    }


@log_performance(label="ReviewService.get_my_review_history")
def get_my_review_history(db, reviewer_id: int, page: int = 1, limit: int = 10,
                          decision: str | None = None, search: str | None = None, sort_by: str = "newest"):
    """
    Riwayat review milik analis yang sedang login.
    FRAUD_ANALYST hanya bisa lihat history miliknya sendiri.
    """
    query = db.query(ManualReview).join(Transaction).filter(
        ManualReview.reviewer_id == reviewer_id,
        ManualReview.is_deleted == False,
    )
    query = _apply_history_filters(query, decision=decision, search=search, sort_by=sort_by)
    total = query.count()
    reviews = query.offset((page - 1) * limit).limit(limit).all()

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
                "original_decision": ((r.transaction_snapshot or {}).get("_review_decision_history") or [{}])[0].get("decision"),
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

    # Alert yang sedang di-claim oleh analis ini, bukan jumlah history review.
    in_progress_alerts = db.query(FraudAlert).filter(
        FraudAlert.claimed_by == reviewer_id,
        FraudAlert.status == "IN_PROGRESS",
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
    
    pattern_repo = PatternRepository(db)

    for pattern_id in trx.violation_pattern_ids:
        pattern = pattern_repo.get_by_id(pattern_id)

        if not pattern:
            continue

        if is_fraud:
            pattern.true_positive = (pattern.true_positive or 0) + 1
        else:
            pattern.false_positive = (pattern.false_positive or 0) + 1

        tp = pattern.true_positive or 0
        fp = pattern.false_positive or 0
        total = tp + fp

        if total > 0:
            pattern.accuracy_score = tp / total
            pattern.false_positive_rate = fp / total

        apply_pattern_lifecycle(db, pattern)


def undo_pattern_accuracy(db, trx, was_fraud: bool):
    """
    Mengurangi counter TP atau FP sebelum override diterapkan.
    Dipanggil oleh override_review_decision_service() untuk mencegah
    double counting — keputusan lama di-undo, baru keputusan baru ditambah.

    Args:
        was_fraud: True jika keputusan lama adalah FRAUD (kurangi TP),
                   False jika keputusan lama adalah SAFE (kurangi FP).
    """
    if not isinstance(trx.violation_pattern_ids, list) or not trx.violation_pattern_ids:
        return

    pattern_repo = PatternRepository(db)

    for pattern_id in trx.violation_pattern_ids:
        pattern = pattern_repo.get_by_id(pattern_id)

        if not pattern:
            continue

        if was_fraud:
            # Undo TP: kurangi true_positive, minimal 0
            pattern.true_positive = max(0, (pattern.true_positive or 0) - 1)
        else:
            # Undo FP: kurangi false_positive, minimal 0
            pattern.false_positive = max(0, (pattern.false_positive or 0) - 1)

        # Hitung ulang accuracy setelah undo
        tp = pattern.true_positive or 0
        fp = pattern.false_positive or 0
        total = tp + fp

        if total > 0:
            pattern.accuracy_score = tp / total
            pattern.false_positive_rate = fp / total
        else:
            # Reset ke None jika tidak ada sample lagi
            pattern.accuracy_score = None
            pattern.false_positive_rate = None

        # Decision override can change lifecycle eligibility. Re-evaluate so
        # action/status and the active-pattern cache match the corrected counts.
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
                                           ManualReview.is_deleted == False).with_for_update().first()
    if not review:
        raise HTTPException(status_code=404,
                             detail="Review history tidak ditemukan")
        
    new_decision = new_decision.upper()
    if review.decision == new_decision:
        raise HTTPException(status_code=400, 
                            detail=f"Vonis saat ini sudah berstatus {new_decision}. Tidak ada perubahan keputusan.")

    try:
        trx = db.query(Transaction).filter(Transaction.id == review.transaction_id).with_for_update().first()
        alert = db.query(FraudAlert).filter(FraudAlert.id == review.alert_id).with_for_update().first()
        if not trx:
            raise HTTPException(status_code=404, detail="Transaction terkait review tidak ditemukan")
        
        snapshot_before = {
            "decision": review.decision,
            "final_status": str(review.final_status.value) if review.final_status else None
        }
        audit_snapshot = dict(review.transaction_snapshot or {})
        decision_history = list(audit_snapshot.get("_review_decision_history") or [])
        decision_history.append({
            "decision": review.decision,
            "final_status": snapshot_before["final_status"],
            "overridden_at": datetime.now(timezone.utc).isoformat(),
            "overridden_by": admin_id,
            "reason": reason,
        })
        audit_snapshot["_review_decision_history"] = decision_history
        review.transaction_snapshot = audit_snapshot

        if new_decision == "FRAUD":
            # [FIX] Undo counter keputusan lama sebelum tambah yang baru.
            # Sebelumnya override hanya menambah counter baru tanpa mengurangi
            # counter lama — menyebabkan double counting:
            # contoh: review SAFE (FP+1) lalu override ke FRAUD (TP+1)
            # hasilnya TP=1 FP=1 padahal seharusnya TP=1 FP=0.
            if review.decision == "SAFE":
                undo_pattern_accuracy(db, trx, was_fraud=False)
            update_pattern_accuracy(db, trx, is_fraud=True)
            target_status = TransactionStatusEnum.FRAUD
        else:
            # Override dari FRAUD ke SAFE: undo TP lama, tambah FP baru
            if review.decision == "FRAUD":
                undo_pattern_accuracy(db, trx, was_fraud=True)
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
            alert.resolved_by = admin_id
            alert.resolved_at = datetime.now(timezone.utc)
            alert.claimed_by = None
            alert.claimed_at = None

        # Feedback harus mengikuti keputusan akhir agar dataset retraining tidak
        # mempertahankan label sebelum override. Review baru sudah menyimpan FK
        # review_id; record lama tanpa FK dibiarkan untuk menghindari mutasi data
        # yang tidak dapat dipastikan asalnya.
        db.query(MLFeedbackLog).filter(
            MLFeedbackLog.review_id == review.id
        ).update({
            "analyst_decision": new_decision,
            "decision_confidence": "HIGH",
        }, synchronize_session=False)
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
        raise HTTPException(status_code=409, detail="Data ini baru saja diubah oleh proses paralel lain.")
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error("[REVIEW OVERRIDE ERROR] review_id=%s error=%s", review_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal Server Error")
    
@log_performance(label="ReviewService.log_false_negative_service")
def log_false_negative_service(db, transaction_id: int, admin_id: int, reason: str):
    """
    Fitur khusus pimpinan untuk menandai transaksi sukses yang ternyata lolos dari ML (False Negative).
    """
    trx = db.query(Transaction).filter(Transaction.id == transaction_id).with_for_update().first()
    if not trx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
        
    current_status = (
        trx.final_status.value
        if isinstance(trx.final_status, TransactionStatusEnum)
        else str(trx.final_status or "").replace("TransactionStatusEnum.", "").upper()
    )
    if current_status != TransactionStatusEnum.SAFE.value:
        raise HTTPException(
            status_code=400,
            detail="False Negative hanya dapat dilaporkan untuk transaksi berstatus SAFE yang lolos dari deteksi.",
        )

    existing_review = db.query(ManualReview).filter(
        ManualReview.transaction_id == trx.id,
        ManualReview.is_deleted == False
    ).with_for_update().first()

    trx.final_status = TransactionStatusEnum.FRAUD
    trx.risk_level = "CRITICAL"
    trx.risk_score = max(float(trx.risk_score or 0), 90.0)
    trx.violation_reason = f"[FALSE_NEGATIVE_REPORT] {reason}"
    feedback_log = MLFeedbackLog(
        review_id=existing_review.id if existing_review else None,
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
    if existing_review:
        # Koreksi label feedback dan counter hasil keputusan SAFE sebelumnya.
        db.query(MLFeedbackLog).filter(
            MLFeedbackLog.review_id == existing_review.id
        ).update({
            "analyst_decision": "FRAUD",
            "decision_confidence": "HIGH",
            # Keputusan SAFE sebelumnya telah berubah menjadi FRAUD. Tandai ulang
            # agar fraud feedback tersebut masuk jalur pattern discovery berikutnya.
            "is_used_for_training": False,
        }, synchronize_session=False)
        if existing_review.decision == "SAFE":
            undo_pattern_accuracy(db, trx, was_fraud=False)
        if existing_review.decision != "FRAUD":
            update_pattern_accuracy(db, trx, is_fraud=True)
    else:
        db.add(feedback_log)
        update_pattern_accuracy(db, trx, is_fraud=True)

    # Pastikan confirmed fraud terlihat kembali di Alert Center. Jika alert lama
    # sudah terminal, buka kembali sebagai REOPENED dan hapus kepemilikan lama.
    alert = db.query(FraudAlert).filter(
        FraudAlert.transaction_id == trx.id
    ).with_for_update().first()
    if alert:
        alert.status = "REOPENED"
        alert.resolved_at = None
        alert.resolved_by = None
        alert.claimed_at = None
        alert.claimed_by = None
        alert.severity = "CRITICAL"
        alert.priority = max(float(alert.priority or 0), float(trx.risk_score or 90))
        alert.title = "Confirmed False Negative"
        alert.message = f"Transaction was confirmed as fraud after bypassing initial detection: {reason}"
    else:
        from app.application.services.alert_service import create_alert
        create_alert(db, trx)

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
