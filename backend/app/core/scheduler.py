from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from app.application.services.scheduler_service import SchedulerService

_scheduler = BackgroundScheduler()
SCHEDULER_STARTED_AT = None

def get_scheduler_service() -> SchedulerService:
    return SchedulerService(_scheduler)

def start_scheduler():
    """Fungsi untuk menyalakan mesin scheduler (dipanggil di main.py)"""
    if not _scheduler.running:
        global SCHEDULER_STARTED_AT

        from app.application.services.scheduler_service import run_sla_escalation_task
        _scheduler.add_job(
            func=run_sla_escalation_task,
            trigger="interval",
            minutes=1, 
            id="sla_escalation_engine_worker",
            replace_existing=True,
            name="SLA Escalation Engine Worker"
        )

        _scheduler.start()
        SCHEDULER_STARTED_AT = datetime.now()
        print("[System] Background Scheduler Started. (SLA Escalation Active)")

def shutdown_scheduler():
    if _scheduler.running:
        _scheduler.shutdown()
        print("[System] Background Scheduler Shutdown.")