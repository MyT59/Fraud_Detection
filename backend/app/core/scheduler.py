from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from app.application.services.scheduler_service import SchedulerService

# 1. Inisialisasi instance APScheduler secara global di modul ini
# Ini memastikan kita hanya punya SATU scheduler yang berjalan (Singleton)
_scheduler = BackgroundScheduler()
SCHEDULER_STARTED_AT = None

def get_scheduler_service() -> SchedulerService:
    """
    Dependency provider untuk FastAPI.
    Fungsi ini yang kamu panggil di Depends(get_scheduler_service) pada Router.
    """
    return SchedulerService(_scheduler)

def start_scheduler():
    """Fungsi untuk menyalakan mesin scheduler (dipanggil di main.py)"""
    if not _scheduler.running:
        global SCHEDULER_STARTED_AT

        _scheduler.start()
        SCHEDULER_STARTED_AT = datetime.now()
        print("[System] Background Scheduler Started. 🚀")

def shutdown_scheduler():
    """Fungsi untuk mematikan mesin scheduler (dipanggil di main.py)"""
    if _scheduler.running:
        _scheduler.shutdown()
        print("[System] Background Scheduler Shutdown. 🛑")