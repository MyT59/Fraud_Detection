import logging
from datetime import datetime, timezone, timedelta
import logging
from typing import Dict, Any, List
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.infrastructure.database.session import SessionLocal
from app.application.services.retrain_service import RetrainService
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.application.services.activity_log_service import log_activity
from app.domain.entities.target_type import TargetType
from app.infrastructure.database.models.retrain_schedule_model import RetrainSchedule

logger = logging.getLogger(__name__)

def run_sla_escalation_task():
    """
    Background worker yang berjalan periodik untuk mencari alert HIGH/CRITICAL 
    yang terlantar di antrean OPEN > 10 menit, lalu mendongkrak prioritasnya.
    """
    db = SessionLocal()
    try:
        # Tentukan ambang batas waktu SLA (10 menit yang lalu)
        sla_threshold = datetime.now(timezone.utc) - timedelta(minutes=10)
        
        # Cari alert OPEN, HIGH/CRITICAL, yang dibuat sebelum waktu batas, dan belum dieskalasi
        overdue_alerts = db.query(FraudAlert).filter(
            FraudAlert.status == "OPEN",
            FraudAlert.severity.in_(["HIGH", "CRITICAL"]),
            FraudAlert.created_at <= sla_threshold,
            FraudAlert.is_escalated == False
        ).all()
        
        if not overdue_alerts:
            return

        for alert in overdue_alerts:
            old_priority = alert.priority or 0.0
            
            # Eksekusi Eskalasi: Berikan penalti +20 poin agar melesat ke atas antrean
            alert.priority = old_priority + 20.0  
            alert.is_escalated = True
            alert.title = f"[ESCALATED] {alert.title or 'Fraud Detected'}"
            
            # Catat log aktivitas sistem (Aktor: None / System Engine)
            log_activity(
                db=db,
                admin=None, 
                action_type="SLA_ESCALATION",
                target_type=TargetType.ALERT,
                target_id=alert.id,
                details=f"Alert breached 10m SLA. Priority bumped from {old_priority} to {alert.priority}"
            )
            
        db.commit()
        logger.info(f"⚡ [SLA Engine] Berhasil mengeksalasi {len(overdue_alerts)} alert yang terlantar ke puncak antrean.")
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ [SLA Engine] Kebobolan error saat mengeksalasi SLA: {e}")
    finally:
        db.close()

def scheduled_retrain_task(schedule_dict: Dict[str, Any]):
    db = SessionLocal()
    schedule_id = str(schedule_dict.get('id')) 
    
    try:
        logger.info(f"[Scheduler] Memulai retrain otomatis untuk: {schedule_dict.get('name')} ({schedule_id})")
        
        retrain_service = RetrainService(db)
        # 1. Eksekusi Proses ML
        result = retrain_service.execute_retrain(schedule_dict=schedule_dict, trigger="scheduled")
        
        # 🔥 2. UPDATE CACHE DASHBOARD (Berhasil)
        schedule_obj = db.query(RetrainSchedule).filter(RetrainSchedule.id == schedule_id).first()
        if schedule_obj:
            schedule_obj.last_run_at = datetime.now(timezone.utc)
            schedule_obj.last_run_status = "SUCCESS" if result.get("status") == "success" else "FAILED"
            db.commit()

        logger.info(f"[Scheduler] Retrain {schedule_id} selesai dengan status: {schedule_obj.last_run_status}")
        
    except Exception as e:
        logger.error(f"[Scheduler] Error saat menjalankan job {schedule_id}: {e}")
        
        # 🔥 UPDATE CACHE DASHBOARD (Gagal Sistem)
        schedule_obj = db.query(RetrainSchedule).filter(RetrainSchedule.id == schedule_id).first()
        if schedule_obj:
            schedule_obj.last_run_at = datetime.now(timezone.utc)
            schedule_obj.last_run_status = "FAILED"
            db.commit()
    finally:
        db.close()

class SchedulerService:
    def __init__(self, scheduler: BackgroundScheduler):
        self.scheduler = scheduler

    def register_job(self, schedule_dict: Dict[str, Any]) -> None:
        schedule_id = str(schedule_dict.get("id"))
        cron_expr = schedule_dict.get("cron_expr")
        
        if not cron_expr:
            logger.error(f"❌ Schedule {schedule_id} tidak punya cron expression.")
            return

        try:
            trigger = CronTrigger.from_crontab(cron_expr)
            job = self.scheduler.add_job(
                func=scheduled_retrain_task,
                trigger=trigger,
                args=[schedule_dict],
                id=schedule_id,
                replace_existing=True,
                name=f"Retrain Job - {schedule_dict.get('name', schedule_id)}"
            )
            
            # 🔥 UPDATE CACHE: Simpan waktu 'Next Run' ke Database
            db = SessionLocal()
            try:
                schedule_obj = db.query(RetrainSchedule).filter(RetrainSchedule.id == schedule_id).first()
                if schedule_obj:
                    schedule_obj.next_run_at = job.next_run_time
                    db.commit()
            finally:
                db.close()

            logger.info(f"✅ Job {schedule_id} diregister. Next run: {job.next_run_time}")
            
        except Exception as e:
            logger.error(f"❌ Gagal mendaftarkan job {schedule_id}: {e}")
            raise ValueError(f"Gagal setup cron trigger: {str(e)}")

    def unregister_job(self, schedule_id: str) -> None:
        schedule_id = str(schedule_id)
        try:
            if self.scheduler.get_job(schedule_id):
                self.scheduler.remove_job(schedule_id)
                
                # 🔥 UPDATE CACHE: Kosongkan 'Next Run' karena jadwal dimatikan (is_active = False)
                db = SessionLocal()
                try:
                    schedule_obj = db.query(RetrainSchedule).filter(RetrainSchedule.id == schedule_id).first()
                    if schedule_obj:
                        schedule_obj.next_run_at = None
                        db.commit()
                finally:
                    db.close()
                    
                logger.info(f"🗑️ Job {schedule_id} berhasil dihapus dari scheduler.")
            else:
                logger.warning(f"⚠️ Job {schedule_id} tidak ditemukan di scheduler memori.")
        except Exception as e:
            logger.error(f"❌ Gagal menghapus job {schedule_id}: {e}")
            raise e

    def get_jobs(self) -> List[Dict[str, Any]]:
        jobs = self.scheduler.get_jobs()
        job_list = [
            {
                "id": job.id,
                "name": job.name,
                "trigger": str(job.trigger),
                "next_run": (job.next_run_time.isoformat() if job.next_run_time else None),
                "pending": getattr(job, "pending", False),
                "executor": getattr(job, "executor", "default"),
                "func_ref": (f"{job.func.__module__}.{job.func.__name__}" if hasattr(job, "func") else None),
            }
            for job in jobs
        ]
        return job_list

    def get_active_jobs(self) -> List[Dict[str, Any]]:
        jobs = self.scheduler.get_jobs()
        return [
            {
                "id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None
            }
            for job in jobs
        ]