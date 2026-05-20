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
from sqlalchemy.orm.exc import StaleDataError
import logging
from datetime import datetime, timezone

from app.infrastructure.repositories.alert_repository import AlertRepository
from app.infrastructure.repositories.review_repository import ReviewRepository
from app.infrastructure.repositories.transaction_repository import TransactionRepository
from app.infrastructure.repositories.pattern_repository import PatternRepository
from app.infrastructure.database.models.ml_feedback_log_model import MLFeedbackLog

# Inisialisasi logger untuk memantau error di terminal
logger = logging.getLogger(__name__)

def review_transaction(db, alert_id: int, reviewer_id: int, decision: str, note: str, confidence: str): 
    # 1. VALIDASI INPUT DI AWAL
    allowed = ["SAFE", "FRAUD"]
    decision = decision.upper()
    if decision not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid decision: {decision}. Allowed: {allowed}")
    
    allowed_confidence = ["LOW", "MEDIUM", "HIGH"]
    confidence = confidence.upper()  
    if confidence not in allowed_confidence:
        raise HTTPException(status_code=400, detail=f"Invalid confidence level: {confidence}. Allowed: {allowed_confidence}")

    try:
        alert_repo = AlertRepository(db)
        alert = alert_repo.get_by_id(alert_id)
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        if alert.status == "RESOLVED":
            raise HTTPException(400, "Alert already resolved")
            
        # 🔥 PENGAMANAN BARU: ENFORCE OWNERSHIP
        if alert.status == "OPEN":
            # Jika masih OPEN, tidak bisa di-review langsung. Harus diklaim dulu!
            raise HTTPException(
                status_code=400, 
                detail="Alert must be claimed before submitting a review. Please claim it first."
            )
            
        if alert.claimed_by != reviewer_id:
            # Jika di-claim orang lain, tolak mentah-mentah!
            raise HTTPException(
                status_code=403, 
                detail=f"Access Denied: This alert is currently claimed by Analyst ID {alert.claimed_by}"
            )

        # ❗ CEK DUPLICATE REVIEW
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

        # 🔥 FIX 1: BUAT TRANSACTION SNAPSHOT
        # Mengubah data transaksi saat ini menjadi dictionary untuk disimpan permanen
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
            "transaction_details": trx.transaction_details,  # 🌟 SANGAT KRUSIAL! Menyimpan payload asli JSONB
            "anomaly_score": trx.anomaly_score,
            "risk_score": trx.risk_score,
            "risk_level": trx.risk_level,
            "score_breakdown": trx.score_breakdown,           # Menyimpan breakdown pengetatan skor
            "is_flagged_ml": trx.is_flagged_ml,
            "violation_reason": trx.violation_reason,
            "violation_rule_ids": trx.violation_rule_ids,
            "violation_pattern_ids": trx.violation_pattern_ids,
            "final_status": str(trx.final_status.value) if trx.final_status else None
        }

        # Waktu penyelesaian review
        now_utc = datetime.now(timezone.utc)

        # 5. SIMPAN KE TABEL manual_reviews 
        review = ManualReview(
            transaction_id=trx.id,
            alert_id=alert.id,
            reviewer_id=reviewer_id, 
            decision=decision,
            review_note=note,
            decision_confidence=confidence,
            previous_status=str(trx.final_status.value), 
            final_status=target_status,
            transaction_snapshot=transaction_snapshot,
            review_started_at=alert.created_at, # Menggunakan waktu alert dibuat sebagai patokan mulai (atau bisa dinamis nanti)
            review_completed_at=now_utc
        )
        review_repo.create(review)
        
        # Handle Race Condition via flush & IntegrityError
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="Alert already reviewed")
        
        feedback_log = MLFeedbackLog(
            review_id=None,
            transaction_id=trx.id,
            
            # Mirroring data transaksi
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
            
            # Melampirkan label dari analis
            analyst_decision=decision,
            decision_confidence=confidence
        )
        db.add(feedback_log)

        # 6. UPDATE STATUS TRANSAKSI 
        trx.final_status = target_status

        if decision == "FRAUD":
            update_pattern_accuracy(db, trx, True)
        else:
            update_pattern_accuracy(db, trx, False)

        # 7. UPDATE ALERT 
        alert.status = "RESOLVED"
        alert.resolved_by = reviewer_id
        alert.resolved_at = now_utc

        # 8. LOG ACTIVITY (Tanpa db.commit() di dalamnya)
        log_activity(
            db=db,
            admin=type("obj", (object,), {"id": reviewer_id})(),
            action_type="REVIEW_ALERT",
            target_type=TargetType.TRANSACTION,
            target_id=trx.id,
            details=f"Decision={decision}, AlertID={alert.id}"
        )

        # 🔥 FIX 3: COMMIT SEMUA PERUBAHAN DI AKHIR (Unit of Work)
        db.commit()
        db.refresh(review)

        return review

    except HTTPException as http_exc:
        db.rollback()
        raise http_exc
    except StaleDataError:
        db.rollback()
        raise HTTPException(
            status_code=409, 
            detail="Race Condition Detected: Kasus ini baru saja diperbarui atau diselesaikan oleh analis lain. Mohon refresh halaman antrean Anda."
        )
    except Exception as e:
        db.rollback()
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
    query = db.query(ManualReview).join(Transaction).filter(ManualReview.is_deleted == False)

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

def get_review_metrics_service(db):
    review_repo = ReviewRepository(db)
    alert_repo = AlertRepository(db)
    
    # 1. Ambil agregat dari repositori
    review_counts = review_repo.get_decision_counts()
    avg_duration_seconds = review_repo.get_avg_review_duration_seconds()
    
    open_alerts = alert_repo.get_count_by_status("OPEN")
    in_progress_alerts = alert_repo.get_count_by_status("IN_PROGRESS")
    
    total_rev = review_counts["total"]
    fraud_cnt = review_counts["fraud"]
    safe_cnt = review_counts["safe"]
    
    # 2. Hitung rasio konfirmasi kecurangan (Fraud Confirmation Rate) dalam %
    confirmation_rate = round((fraud_cnt / total_rev * 100), 2) if total_rev > 0 else 0.0
    
    # Konversi detik ke menit untuk human label
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
        action_type="SOFT_DELETE_REVIEW",
        target_type=TargetType.TRANSACTION,
        target_id=review.transaction_id,
        details=f"Review ID {review.id} soft deleted for compliance reason by Admin ID {admin_id}."
    )
    db.commit()
    return {"status": "success", "message": "Review history successfully soft deleted for compliance tracking."}


# 🔥 TAMBAHAN BARU POIN 15: Review Reopen & Override Mechanism
def override_review_decision_service(db, review_id: int, admin_id: int, new_decision: str, reason: str):
    review = db.query(ManualReview).filter(ManualReview.id == review_id, ManualReview.is_deleted == False).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review history tidak ditemukan")
        
    new_decision = new_decision.upper()
    if review.decision == new_decision:
        raise HTTPException(status_code=400, detail=f"Vonis saat ini sudah berstatus {new_decision}. Tidak ada perubahan keputusan.")

    try:
        trx = db.query(Transaction).filter(Transaction.id == review.transaction_id).first()
        alert = db.query(FraudAlert).filter(FraudAlert.id == review.alert_id).first()
        
        # 1. Jalankan Pipa Koreksi Akurasi Feedback Loop
        if new_decision == "FRAUD":
            update_pattern_accuracy(db, trx, is_fraud=True) 
            target_status = TransactionStatusEnum.FRAUD
        else:
            update_pattern_accuracy(db, trx, is_fraud=False)
            target_status = TransactionStatusEnum.SAFE

        # 2. Rekam Jejak Audit Override
        review.is_overridden = True
        review.overridden_by = admin_id
        review.overridden_at = datetime.now(timezone.utc)
        review.override_reason = reason
        
        review.decision = new_decision
        review.final_status = target_status
        if trx:
            trx.final_status = target_status
            
        # 3. 🔥 FIX POIN 15: Ubah State Lifecycle Alert Menjadi REOPENED / OVERRIDDEN
        if alert:
            # Mengubah status makro alert secara fisik di database sesuai standarisasi state machine
            alert.status = "REOPENED" 

        log_activity(
            db=db,
            admin=type("obj", (object,), {"id": admin_id})(),
            action_type="OVERRIDE_REVIEW_DECISION",
            target_type=TargetType.TRANSACTION,
            target_id=trx.id,
            details=f"Decision overridden to {new_decision}. Alert status escalated to REOPENED by Manager ID {admin_id}."
        )
        db.commit()
        return {"status": "success", "message": f"Decision successfully overridden to {new_decision} and alert state set to REOPENED."}
        
    except StaleDataError:
        db.rollback()
        raise HTTPException(status_code=404, detail="Locking Error: Data ini baru saja diubah oleh proses paralel lain.")
    
def log_false_negative_service(db, transaction_id: int, admin_id: int, reason: str):
    """
    Fitur khusus pimpinan untuk menandai transaksi sukses yang ternyata lolos dari ML (False Negative).
    """
    # 1. Cari data transaksi di feed
    trx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not trx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
        
    if trx.final_status == TransactionStatusEnum.FRAUD:
        raise HTTPException(status_code=400, detail="Transaksi ini memang sudah berstatus FRAUD")

    # 2. Paksa status transaksi berubah menjadi FRAUD (Koreksi status)
    trx.final_status = TransactionStatusEnum.FRAUD
    trx.violation_reason = f"[FALSE_NEGATIVE_REPORT] {reason}"

    # 3. Kirim data koreksi ke Golden Dataset agar teman ML bisa mempelajari pola yang lolos ini
    feedback_log = MLFeedbackLog(
        review_id=None, # Penanda khusus 0 berarti bypass/kebobolan tanpa review manual di antrean
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
        
        # Target label koreksi
        analyst_decision="FRAUD", 
        decision_confidence="HIGH" 
    )
    db.add(feedback_log)

    # 4. Update counter akurasi rule engine (karena kecurangan ini lolos, rule/pattern bernilai salah)
    update_pattern_accuracy(db, trx, is_fraud=True)

    # 5. Catat log audit aktivitas sistem
    log_activity(
        db=db,
        admin=type("obj", (object,), {"id": admin_id})(),
        action_type="REPORT_FALSE_NEGATIVE",
        target_type=TargetType.TRANSACTION,
        target_id=trx.id,
        details=f"Transaction reported as False Negative by Risk Manager ID {admin_id}. Reason: {reason}"
    )
    
    db.commit()
    return {"status": "success", "message": "Transaksi berhasil ditandai sebagai False Negative. Dataset retraining telah diperbarui."}