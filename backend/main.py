import asyncio
from datetime import datetime, timezone
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
import uvicorn

from slowapi.middleware import SlowAPIMiddleware
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
from app.presentation.routes import session_routes
from app.presentation.routes.isolation_routes import router as isolation_router
from app.presentation.routes.retrain_routes import router as retrain_router

# SERVICES
from app.application.services.dashboard_service import DashboardService
from app.application.services.isolation_ml_service import (
    DOMAIN_DEFAULT_THRESHOLDS,
    get_available_domains,
)

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
    Sekarang melakukan restorasi jadwal retrain langsung dari Database.
    """
    # 1. Start APScheduler
    start_scheduler()
    
    # 2. RESTORE SCHEDULES FROM DATABASE
    db = SessionLocal()
    try:
        # Ambil jadwal yang statusnya aktif
        schedules = (
            db.query(RetrainSchedule)
            .filter(RetrainSchedule.is_active == True)
            .all()
        )

        scheduler_service = get_scheduler_service()
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
app.include_router(session_routes.router)
app.include_router(isolation_router)
app.include_router(retrain_router)


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
# OPTIONAL: QUICK TEST ENDPOINT
# (buat generate transaksi + alert)
# =========================
@app.get("/test/generate")
def generate_test():
    db = SessionLocal()

    try:
        data = {
            "original_trx_id": str(uuid.uuid4()),
            "service_source": "AGENUSA",
            "user_account_id": "USER_API_TEST",
            "amount": 2000000,
            "transaction_time": datetime.now(timezone.utc)
        }

        trx = process_transaction(data, db)

        return {
            "trx_id": trx.id,
            "score": trx.risk_score,
            "status": trx.final_status,
            "reason": trx.violation_reason
        }

    finally:
        db.close()

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