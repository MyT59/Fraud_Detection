"""
retrain_scheduler.py
────────────────────
APScheduler integration untuk menjalankan retrain secara otomatis
sesuai schedule yang disimpan di retrain_schedules.json.

Dipanggil saat FastAPI startup melalui lifespan event di main.py.

Flow:
  1. Startup → load semua active schedules dari JSON
  2. Register setiap schedule sebagai APScheduler job
  3. Saat job triggered → panggil run_scheduled_retrain(schedule_id)
  4. Saat create/update/delete schedule → update job di scheduler
"""

from __future__ import annotations

from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

# ── Singleton scheduler ───────────────────────────────────────────────────────
_scheduler: BackgroundScheduler | None = None

WEEKDAY_MAP = {
    "Monday":    "mon",
    "Tuesday":   "tue",
    "Wednesday": "wed",
    "Thursday":  "thu",
    "Friday":    "fri",
    "Saturday":  "sat",
    "Sunday":    "sun",
}


def get_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="Asia/Jakarta")
    return _scheduler


# ═══════════════════════════════════════════════════════════════════════════════
# Startup / Shutdown
# ═══════════════════════════════════════════════════════════════════════════════

def start_scheduler() -> None:
    """
    Dipanggil saat FastAPI startup.
    Load semua active schedule dan daftarkan ke APScheduler.
    """
    from retrain_router import _load_schedules

    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
        print("[RetrainScheduler] APScheduler started.")

    schedules = _load_schedules()
    active = [s for s in schedules if s.get("status") == "active"]
    print(f"[RetrainScheduler] Mendaftarkan {len(active)} schedule aktif...")

    for s in active:
        try:
            _add_job(scheduler, s)
            print(f"  ✓ Registered: {s['name']} ({s['id']}) — {_describe_schedule(s)}")
        except Exception as e:
            print(f"  ✗ Gagal register {s['name']}: {e}")

    print(f"[RetrainScheduler] Total jobs aktif: {len(scheduler.get_jobs())}")


def stop_scheduler() -> None:
    """Dipanggil saat FastAPI shutdown."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        print("[RetrainScheduler] APScheduler stopped.")
    _scheduler = None


# ═══════════════════════════════════════════════════════════════════════════════
# Job management
# ═══════════════════════════════════════════════════════════════════════════════

def register_schedule_job(schedule: dict[str, Any]) -> None:
    """Daftarkan atau update satu schedule ke APScheduler."""
    scheduler = get_scheduler()
    if not scheduler.running:
        return
    job_id = schedule["id"]
    # Hapus dulu kalau sudah ada
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    _add_job(scheduler, schedule)
    print(f"[RetrainScheduler] Job registered: {schedule['name']} — {_describe_schedule(schedule)}")


def unregister_schedule_job(schedule_id: str) -> None:
    """Hapus job dari APScheduler."""
    scheduler = get_scheduler()
    if scheduler.running and scheduler.get_job(schedule_id):
        scheduler.remove_job(schedule_id)
        print(f"[RetrainScheduler] Job removed: {schedule_id}")


def get_scheduler_status() -> dict[str, Any]:
    """Kembalikan status scheduler dan list job aktif."""
    scheduler = get_scheduler()
    if not scheduler.running:
        return {"running": False, "jobs": []}

    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "job_id":       job.id,
            "name":         job.name or job.id,
            "next_run_utc": next_run.isoformat() if next_run else None,
            "trigger":      str(job.trigger),
        })

    return {
        "running": True,
        "job_count": len(jobs),
        "jobs": jobs,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _add_job(scheduler: BackgroundScheduler, schedule: dict[str, Any]) -> None:
    """Buat CronTrigger dari schedule dict dan tambahkan ke scheduler."""
    from retrain_router import run_scheduled_retrain

    job_id  = schedule["id"]
    trigger = _build_cron_trigger(schedule)

    scheduler.add_job(
        func         = run_scheduled_retrain,
        trigger      = trigger,
        args         = [job_id],
        id           = job_id,
        name         = schedule.get("name", job_id),
        replace_existing = True,
        misfire_grace_time = 3600,  # toleransi 1 jam jika server sempat mati
    )


def _build_cron_trigger(schedule: dict[str, Any]) -> CronTrigger:
    """Konversi schedule dict → APScheduler CronTrigger."""
    freq = schedule.get("frequency", "weekly")
    time_str = schedule.get("time", "02:00")

    try:
        hour, minute = map(int, time_str.split(":"))
    except Exception:
        hour, minute = 2, 0

    if freq == "daily":
        return CronTrigger(hour=hour, minute=minute, timezone="Asia/Jakarta")

    elif freq == "weekly":
        dow = WEEKDAY_MAP.get(schedule.get("dayOfWeek", "Monday"), "mon")
        return CronTrigger(day_of_week=dow, hour=hour, minute=minute, timezone="Asia/Jakarta")

    elif freq == "monthly":
        try:
            day = int(schedule.get("dayOfMonth") or 1)
        except (ValueError, TypeError):
            day = 1
        # Clamp agar tidak > 28 (aman untuk semua bulan)
        day = min(day, 28)
        return CronTrigger(day=day, hour=hour, minute=minute, timezone="Asia/Jakarta")

    else:
        # Fallback: weekly Monday 02:00
        return CronTrigger(day_of_week="mon", hour=2, minute=0, timezone="Asia/Jakarta")


def _describe_schedule(schedule: dict[str, Any]) -> str:
    """Human-readable deskripsi schedule untuk logging."""
    freq = schedule.get("frequency", "weekly")
    time = schedule.get("time", "02:00")
    if freq == "daily":
        return f"Setiap hari {time} WIB"
    elif freq == "weekly":
        return f"Setiap {schedule.get('dayOfWeek', 'Monday')} {time} WIB"
    elif freq == "monthly":
        return f"Tanggal {schedule.get('dayOfMonth', '1')} setiap bulan {time} WIB"
    return f"{freq} {time} WIB"