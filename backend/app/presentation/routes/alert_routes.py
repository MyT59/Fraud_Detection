from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.infrastructure.database.session import get_db
from app.core.security import get_current_user

from app.application.services.alert_service import (
    get_all_alerts,
    get_alert_metrics_service,
    get_alert_detail_service,
    update_alert_status_service
)
from app.core.rbac import require_roles
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.application.services.alert_service import get_open_alert_count

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/")
def get_alerts(
    status: str = None,
    severity: str = None,
    service: str = None,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    return get_all_alerts(db, status, severity, service, page, limit)


@router.get("/metrics")
def get_alert_metrics(db: Session = Depends(get_db)):
    return get_alert_metrics_service(db)

@router.get("/count")
def get_alert_count(
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))
):
    return {"count": get_open_alert_count(db)}

@router.get("/{alert_id}")
def get_alert_detail(alert_id: int, db: Session = Depends(get_db)):
    return get_alert_detail_service(db, alert_id)


@router.patch("/{alert_id}/status")
def update_alert_status(
    alert_id: int,
    status: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return update_alert_status_service(
        db,
        alert_id,
        status,
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