from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid
from datetime import datetime, timezone

import app.core.scheduler as scheduler_core

from app.infrastructure.database.session import get_db
from app.application.services.retrain_service import RetrainService
from app.application.services.scheduler_service import SchedulerService
from app.core.scheduler import get_scheduler_service
from app.core.security import get_current_user
from app.core.rbac import is_super_admin 
from app.infrastructure.database.models.admin_model import Admin
from app.infrastructure.database.models.retrain_history_model import RetrainHistory

from app.presentation.schemas.retrain_schema import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse, 
    StatusUpdate,
    RetrainHistoryResponse
)

router = APIRouter(prefix="/retrain", tags=["ML Retraining"])

# ==========================================
# 📅 1. LIST SEMUA JADWAL
# ==========================================
@router.get("/schedules")
def list_schedules(db: Session = Depends(get_db), current_admin: Admin = Depends(is_super_admin)) -> List[ScheduleResponse]:
    service = RetrainService(db)
    return service.get_all_schedules()

@router.get("/status")
def scheduler_status(
    db: Session = Depends(get_db), 
    scheduler_service: SchedulerService = Depends(get_scheduler_service),
    current_admin: Admin = Depends(is_super_admin)
):
    jobs = scheduler_service.get_jobs()
    uptime_seconds = None

    if scheduler_core.SCHEDULER_STARTED_AT:
        uptime_seconds = int(
            (datetime.now() - scheduler_core.SCHEDULER_STARTED_AT).total_seconds()
        )

    successful_jobs = db.query(RetrainHistory).filter(RetrainHistory.status == "SUCCESS").count()
    failed_jobs = db.query(RetrainHistory).filter(RetrainHistory.status == "FAILED").count()

    last_history = db.query(RetrainHistory).order_by(RetrainHistory.execution_time.desc()).first()
    last_run = last_history.execution_time.isoformat() if last_history else None

    # 🔥 UPDATE: Response jadi lebih bersih dan terprediksi
    return {
        "scheduler_running": scheduler_service.scheduler.running,
        "uptime_seconds": uptime_seconds,
        "last_run": last_run,
        "successful_jobs": successful_jobs,
        "failed_jobs": failed_jobs,
        "total_jobs": len(jobs), 
        "jobs": jobs 
    }

    # ✅ RESPONSE FINAL
@router.get("/health")
def retrain_health(
    scheduler_service: SchedulerService = Depends(get_scheduler_service),
    current_admin: Admin = Depends(is_super_admin),
):
    return {
        "status": (
            "healthy"
            if scheduler_service.scheduler.running
            else "unhealthy"
        )
    }

@router.get("/metrics")
def retrain_metrics(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(is_super_admin)
):
    from app.infrastructure.database.models.retrain_history_model import RetrainHistory

    # 🔥 UPDATE: Pindahkan beban komputasi dari RAM Python (list comprehension) ke Engine Database (SQL)
    total_retrains = db.query(RetrainHistory).count()
    successful = db.query(RetrainHistory).filter(RetrainHistory.status == "SUCCESS").count()

    success_rate = (
        round((successful / total_retrains) * 100, 2)
        if total_retrains > 0
        else 0
    )

    # 🔥 UPDATE: Gunakan func.sum() dari SQLAlchemy untuk menjumlahkan
    total_patterns_generated = db.query(func.sum(RetrainHistory.new_patterns_count)).scalar() or 0

    return {
        "total_retrains": total_retrains,
        "success_rate": success_rate,
        "total_patterns_generated": total_patterns_generated
    }

# ==========================================
# ➕ 2. BUAT JADWAL BARU
# ==========================================
@router.post("/schedules", status_code=status.HTTP_201_CREATED)
def create_schedule(
    data: ScheduleCreate, 
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(is_super_admin),
    scheduler_service: SchedulerService = Depends(get_scheduler_service)
):
    service = RetrainService(db)
    try:
        scheduler_service.validate_cron_expr(data.cron_expr)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    new_schedule = service.create_schedule(data.dict(), admin_id=current_admin.id)
    if new_schedule.is_active:
        try:
            scheduler_service.register_job(new_schedule.to_dict())
        except ValueError as exc:
            service.toggle_schedule_status(new_schedule.id, False, admin_id=current_admin.id)
            raise HTTPException(status_code=503, detail=str(exc))
    
    return new_schedule


# ==========================================
# ✏️  3. UPDATE JADWAL (FULL UPDATE)
# ==========================================
@router.put("/schedules/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: uuid.UUID,
    data: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(is_super_admin),
    scheduler_service: SchedulerService = Depends(get_scheduler_service)
):
    service = RetrainService(db)
    update_data = data.dict(exclude_unset=True)
    if "cron_expr" in update_data:
        try:
            scheduler_service.validate_cron_expr(update_data["cron_expr"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    updated = service.update_schedule(schedule_id, update_data, admin_id=current_admin.id)

    if not updated:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Re-register job di scheduler dengan config terbaru
    if updated.is_active:
        try:
            scheduler_service.register_job(updated.to_dict())
        except ValueError as exc:
            service.toggle_schedule_status(updated.id, False, admin_id=current_admin.id)
            raise HTTPException(status_code=503, detail=str(exc))
    else:
        scheduler_service.unregister_job(str(updated.id))

    return updated

# ==========================================
# 🔄 3. TOGGLE AKTIF/NON-AKTIF
# ==========================================
@router.patch("/schedules/{schedule_id}/status")
def toggle_status(
    schedule_id: uuid.UUID,
    data: StatusUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(is_super_admin),
    scheduler_service: SchedulerService = Depends(get_scheduler_service)
):
    service = RetrainService(db)
    updated = service.toggle_schedule_status(schedule_id, data.is_active, admin_id=current_admin.id)
    
    if not updated:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Update di mesin scheduler
    if data.is_active:
        try:
            scheduler_service.register_job(updated.to_dict())
        except ValueError as exc:
            service.toggle_schedule_status(updated.id, False, admin_id=current_admin.id)
            raise HTTPException(status_code=503, detail=str(exc))
    else:
        scheduler_service.unregister_job(str(updated.id))
        
    return {"message": f"Schedule {'activated' if data.is_active else 'deactivated'}"}

# ==========================================
# 🗑️ 4. HAPUS JADWAL
# ==========================================
@router.delete("/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(is_super_admin),
    scheduler_service: SchedulerService = Depends(get_scheduler_service)
):
    service = RetrainService(db)
    success = service.delete_schedule(schedule_id, admin_id=current_admin.id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found")
    scheduler_service.unregister_job(str(schedule_id))
        
    return {"message": "Schedule deleted successfully"}

# ==========================================
# ⚡ 5. RUN NOW (MANUAL TRIGGER)
# ==========================================
@router.post("/schedules/{schedule_id}/run")
def run_now(
    schedule_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(is_super_admin)
):
    service = RetrainService(db)
    # Ambil data schedule

    sched = service.get_schedule_by_id(schedule_id)
    
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    # Eksekusi manual harus memperbarui metadata schedule seperti job terjadwal.
    try:
        result = service.execute_retrain(
            domain=sched.domain,
            schedule_id=sched.id,
            trigger_source="manual",
            admin_id=current_admin.id,
        )
        sched.last_run_at = datetime.now(timezone.utc)
        sched.last_run_status = "SUCCESS" if result.get("status") == "success" else "FAILED"
        db.commit()
    except Exception:
        # execute_retrain dapat melakukan rollback atas transaksi training-nya.
        # Ambil ulang schedule dan simpan status gagal secara terpisah agar UI
        # tetap memiliki jejak percobaan manual terakhir.
        db.rollback()
        failed_schedule = service.get_schedule_by_id(schedule_id)
        if failed_schedule:
            failed_schedule.last_run_at = datetime.now(timezone.utc)
            failed_schedule.last_run_status = "FAILED"
            db.commit()
        raise

    return {"message": "Manual retraining finished", "result": result}

# ==========================================
# 📤 6. UPLOAD DATASET & TRAIN
# ==========================================
@router.post("/upload")
async def upload_and_train(
    domain: str = Form("auto_detect"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(is_super_admin)
):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    service = RetrainService(db)
    result = await service.upload_and_train(file, domain, admin_id=current_admin.id)
    return result


# ==========================================
# 📊 MODEL STATS (Anomaly Rate, Threshold, Contamination)
# ==========================================
@router.get("/model-stats")
def get_model_stats(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(is_super_admin)
):
    from app.infrastructure.database.models.ml_model_model import MLModel as MLModelDB

    domains = ["agenusa", "nusabill"]
    result = {}

    for domain in domains:
        model = (
            db.query(MLModelDB)
            .filter(MLModelDB.target_service == domain, MLModelDB.is_active == True)
            .order_by(MLModelDB.created_at.desc())
            .first()
        )
        if model:
            metrics = model.metrics or {}
            result[domain] = {
                "version": model.version_name,
                "created_at": model.created_at.isoformat() if model.created_at else None,
                "training_samples": metrics.get("training_samples"),
                "anomalies_detected": metrics.get("anomalies_detected"),
                "anomaly_rate": metrics.get("anomaly_rate"),
                "contamination_rate": metrics.get("contamination_rate"),
                "thresholds": metrics.get("thresholds", {}),
            }
        else:
            result[domain] = None

    return result

# ==========================================
# 📜 7. LIHAT HISTORY
# ==========================================
@router.get("/history")
def get_history(db: Session = Depends(get_db), current_admin: Admin = Depends(is_super_admin)) -> List[RetrainHistoryResponse]:
    from app.infrastructure.database.models.retrain_history_model import RetrainHistory
    history = db.query(RetrainHistory).order_by(RetrainHistory.execution_time.desc()).limit(50).all()
    return [RetrainHistoryResponse.from_orm(item) for item in history]
