import asyncio
from datetime import datetime, timezone
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from slowapi.middleware import SlowAPIMiddleware
from app.core.logging import RequestLoggingMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.core.rate_limiter import limiter 
from app.core.scheduler import start_scheduler, shutdown_scheduler, get_scheduler_service
from app.infrastructure.database.session import SessionLocal
from app.infrastructure.database.models.ml_dataset_model import MLDataset
from app.infrastructure.database.models.ml_model_model import MLModel
from app.infrastructure.database.models.retrain_schedule_model import RetrainSchedule
from app.infrastructure.database.models.retrain_history_model import RetrainHistory

# ROUTES
from app.presentation.routes.protected_routes import router as protected_router
from app.presentation.routes.auth_routes import router as auth_router
from app.presentation.routes.account_routes import router as account_router
from app.presentation.routes.alert_routes import router as alert_router
from app.presentation.routes.review_routes import router as review_router
from app.presentation.routes.transaction_routes import router as transaction_router
from app.presentation.routes.blacklist_routes import router as blacklist_router
from app.presentation.routes.dashboard_routes import router as dashboard_router
from app.presentation.routes.pattern_routes import router as pattern_router
from app.presentation.routes.activity_log_routes import router as activity_log_router
from app.presentation.routes.rule_routes import router as rule_router
from app.presentation.routes.notification_routes import router as notification_router
from app.presentation.routes.ws_routes import router as ws_router
from app.presentation.routes.session_routes import router as session_router
from app.presentation.routes.isolation_routes import router as isolation_router
from app.presentation.routes.retrain_routes import router as retrain_router
from app.presentation.routes.analytics_routes import router as analytics_router
from app.presentation.routes.report_routes import router as report_router
from app.presentation.routes.simulator_routes import router as simulator_router

# SERVICES
from app.application.services.dashboard_service import DashboardService
from app.application.services.isolation_ml_service import (
    DOMAIN_DEFAULT_THRESHOLDS,
    get_available_domains,
)
from app.application.services.scheduler_service import run_dataset_retention_task

# INFRASTRUCTURE & MODELS
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.infrastructure.database.session import SessionLocal
from app.application.services.transaction_service import process_transaction
from app.infrastructure.realtime.redis_pubsub import redis_service
from app.presentation.websocket.connection_manager import manager

# ==========================================
# 🔥 LIFESPAN CONFIGURATION
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan manager untuk menangani startup dan shutdown aplikasi.
    Sekarang melakukan restorasi jadwal retrain langsung dari Database & SLA Engine.
    """
    # 1. Start APScheduler
    start_scheduler()
    
    # Ambil instance scheduler service yang sedang berjalan
    scheduler_service = get_scheduler_service()
    
    # ==========================================
    # REGISTRASI DATASET RETENTION JOB
    # ==========================================
    try:
        scheduler_service.scheduler.add_job(
            func=run_dataset_retention_task,
            trigger="cron",
            day_of_week="sun",  # Setiap Minggu
            hour=3,
            minute=0,           # Jam 3 pagi WIB (UTC+7 = 20:00 UTC Sabtu)
            id="dataset_retention_job",
            replace_existing=True,
            name="Dataset Retention Cleanup"
        )
        print("🚀 [System] Dataset Retention Job aktif (Setiap Minggu jam 03:00). ✅")
    except Exception as e:
        print(f"❌ [System] Gagal mendaftarkan Dataset Retention Job: {e}")


    # ==========================================
    # 2. RESTORE SCHEDULES FROM DATABASE
    # ==========================================
    db = SessionLocal()
    try:
        # Ambil jadwal yang statusnya aktif
        schedules = (
            db.query(RetrainSchedule)
            .filter(
                RetrainSchedule.is_active == True,
                RetrainSchedule.is_deleted == False,
            )
            .all()
        )

        count = 0
        for s in schedules:
            # Menggunakan .to_dict() agar kompatibel dengan register_job
            scheduler_service.register_job(s.to_dict())
            count += 1

        print(f"🚀 [System] Berhasil merestorasi {count} jadwal retrain dari database. ✅")
    
    except Exception as e:
        print(f"❌ [System] Gagal merestorasi jadwal saat startup: {e}")
    finally:
        db.close()

    yield
    
    # 3. Shutdown APScheduler
    shutdown_scheduler()

app = FastAPI(
    title="Fraud Detection System API",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # origin React-mu
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def redis_listener():
    async for msg in redis_service.subscribe("dashboard"):
        await manager.broadcast(msg)

# @app.on_event("startup")
# async def startup_event():
#     asyncio.create_task(redis_listener())

#Middleware & Exception Handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# =========================
# REGISTER ROUTES
# =========================
app.include_router(protected_router)
app.include_router(auth_router)
app.include_router(account_router)
app.include_router(alert_router)
app.include_router(dashboard_router)
app.include_router(ws_router)
app.include_router(notification_router)
app.include_router(review_router)
app.include_router(transaction_router)
app.include_router(blacklist_router)
app.include_router(pattern_router)
app.include_router(activity_log_router)
app.include_router(rule_router)
app.include_router(session_router)
app.include_router(isolation_router)
app.include_router(retrain_router)
app.include_router(analytics_router)
app.include_router(report_router)
app.include_router(simulator_router)

# =========================
# HEALTH CHECK (MERGED)
# =========================
@app.get("/")
def root():
    return {
        "message": "FDS API Running 🚀",
        "status": "API hidup",
        "available_domains": get_available_domains(),
        "default_thresholds": DOMAIN_DEFAULT_THRESHOLDS,
    }

# =========================
# TEST DASHBOARD (ALL ENDPOINT)
# =========================
@app.get("/test/dashboard")
def test_dashboard():
    db = SessionLocal()

    try:
        return {
            "kpi": DashboardService.get_kpi(db),
            "transaction_trend": DashboardService.get_transaction_trend(db),
            "fraud_distribution": DashboardService.get_fraud_distribution(db),
            "recent_alerts": DashboardService.get_recent_alerts(db),
            "top_patterns": DashboardService.get_top_patterns(db),
            "alert_trend": DashboardService.get_alert_trend(db)
        }
    finally:
        db.close()


# =========================
# RUN SERVER
# =========================
if __name__ == "__main__":
    uvicorn.run("main:app", reload=True)
