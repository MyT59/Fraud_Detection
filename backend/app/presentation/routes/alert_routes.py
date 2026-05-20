from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.infrastructure.database.session import get_db
from app.core.security import get_current_user

from app.application.services.alert_service import (
    claim_alert_service,
    get_all_alerts,
    get_alert_metrics_service,
    get_alert_detail_service,
    get_my_queue_service,
    get_priority_distribution_service,
    release_alert_service,
    update_alert_status_service
)
from app.core.rbac import require_roles
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.application.services.alert_service import get_open_alert_count, get_open_queue_service
from app.presentation.schemas.alert_schema import AlertStatusUpdate, AlertPriorityDistributionResponse

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/")
def get_alerts(
    status: str = None,
    severity: str = None,
    service: str = None,
    priority: str = None,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    return get_all_alerts(db, status, severity, service, priority, page, limit)


@router.get("/metrics")
def get_alert_metrics(db: Session = Depends(get_db)):
    return get_alert_metrics_service(db)

@router.get("/count")
def get_alert_count(
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))
):
    return {"count": get_open_alert_count(db)}

@router.get("/priority-distribution", response_model=AlertPriorityDistributionResponse)
def get_priority_distribution(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST")) # 🔒 Terbuka untuk seluruh tim operasi fraud
):
    return get_priority_distribution_service(db)

@router.get("/my-queue")
def get_my_queue(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return get_my_queue_service(db, user.id)

@router.get("/open-queue")
def get_open_queue(
    priority: str = None, # Menampung query parameter: ?priority=CRITICAL
    limit: int = 50,
    db: Session = Depends(get_db),
    user = Depends(get_current_user) # Proteksi rute agar hanya bisa diakses analis yang login
):
    # 1. Parameter 'priority' diteruskan ke level Service
    return get_open_queue_service(db, priority_label=priority, limit=limit)

@router.get("/{alert_id}")
def get_alert_detail(alert_id: int, db: Session = Depends(get_db)):
    return get_alert_detail_service(db, alert_id)


@router.patch("/{alert_id}/status")
def update_alert_status(
    alert_id: int,
    request: AlertStatusUpdate,  # 🔥 FIX: Menggunakan schema untuk validasi JSON Body
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return update_alert_status_service(
        db,
        alert_id,
        request.status.value,  # 🔥 Ambil value string dari Enum (.value)
        user.id
    )

@router.patch("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Endpoint khusus agar FE bisa panggil /alerts/{id}/resolve dengan mudah"""
    return update_alert_status_service(
        db,
        alert_id,
        "RESOLVED",
        user.id
    )

@router.post("/{alert_id}/claim")
def claim_alert_route(
    alert_id: int,
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db),
    user = Depends(require_roles("FRAUD_ANALYST"))
):

    return claim_alert_service(
        db=db, 
        alert_id=alert_id, 
        admin_id=user.id,
        background_tasks=background_tasks 
    )

@router.post("/{alert_id}/release")
def release_alert(
    alert_id: int, 
    db: Session = Depends(get_db), 
    user = Depends(get_current_user)
):
    return release_alert_service(db, alert_id, user.id, getattr(user, 'role', 'FRAUD_ANALYST'))

