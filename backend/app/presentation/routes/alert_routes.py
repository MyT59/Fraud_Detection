from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.infrastructure.database.session import get_db
from app.core.security import get_current_user

from app.application.services.alert_service import (
    claim_alert_service,
    complete_blocked_investigation_service,
    get_all_alerts,
    get_alert_metrics_service,
    get_alert_detail_service,
    get_my_queue_service,
    get_priority_distribution_service,
    release_alert_service,
    update_alert_status_service
)
from app.core.rbac import get_role_name, require_roles
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.application.services.alert_service import get_open_alert_count, get_open_queue_service
from app.application.services.notification_service import should_send_fraud_alert
from app.presentation.schemas.alert_schema import AlertStatusUpdate, AlertPriorityDistributionResponse, BlockedInvestigationRequest
from app.infrastructure.database.enums import AlertStatusEnum

OPERATIONS_ROLES = ("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST")
router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"],
    dependencies=[Depends(require_roles(*OPERATIONS_ROLES))],
)


@router.get("/")
def get_alerts(
    status: AlertStatusEnum | None = None,
    severity: str = None,
    alert_type: str = None, # 🚀 PARAMETER BARU DARI FRONTEND
    service: str = None,
    priority: str = None,
    search: str | None = Query(default=None, max_length=100),
    sort_by: str = Query(default="priority_desc", pattern="^(priority_desc|priority_asc|newest|oldest)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    # 🚀 Teruskan parameter alert_type ke service
    return get_all_alerts(db, status, severity, service, priority, page, limit, alert_type, search, sort_by)

@router.get("/metrics")
def get_alert_metrics(db: Session = Depends(get_db)):
    return get_alert_metrics_service(db)

@router.get("/count")
def get_alert_count(
    respect_preferences: bool = False,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))
):
    if respect_preferences and not should_send_fraud_alert(db, current_admin.id):
        return {"count": 0}
    return {"count": get_open_alert_count(db)}

@router.get("/priority-distribution", response_model=AlertPriorityDistributionResponse)
def get_priority_distribution(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST")) # 🔒 Terbuka untuk seluruh tim operasi fraud
):
    return get_priority_distribution_service(db)

@router.get("/open-queue")
def get_open_queue(
    priority: str = None,
    severity: str = None,
    alert_type: str = None,
    search: str | None = Query(default=None, max_length=100),
    sort_by: str = Query(default="priority_desc", pattern="^(priority_desc|priority_asc|newest|oldest)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    user = Depends(get_current_user) # Proteksi rute agar hanya bisa diakses analis yang login
):
    # 1. Parameter 'priority' diteruskan ke level Service
    return get_open_queue_service(
        db,
        priority_label=priority,
        severity=severity,
        alert_type=alert_type,
        page=page,
        limit=limit,
        search=search,
        sort_by=sort_by,
    )

@router.get("/my-queue")
def get_my_queue(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return get_my_queue_service(
        db,
        user.id,
        page=page,
        limit=limit
    )

@router.get("/{alert_id}")
def get_alert_detail(alert_id: int, db: Session = Depends(get_db)):
    return get_alert_detail_service(db, alert_id)


@router.patch("/{alert_id}/status")
def update_status(
    alert_id: int,
    payload: AlertStatusUpdate,
    background_tasks: BackgroundTasks, # 🚀 PERBAIKAN 1: Hapus "= BackgroundTasks()"
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    return update_alert_status_service(
        db=db,
        alert_id=alert_id,
        status=payload.status,
        resolution_reason=payload.reason,
        actor=current_admin,
        background_tasks=background_tasks,
    )

@router.patch("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    background_tasks: BackgroundTasks, # 🚀 PERBAIKAN 2: Tambahkan parameter ini di sini
    db: Session = Depends(get_db),
    user=Depends(require_roles("FRAUD_ANALYST"))
):
    """Endpoint khusus agar FE bisa panggil /alerts/{id}/resolve dengan mudah"""
    return update_alert_status_service(
        db=db,
        alert_id=alert_id,
        actor=user,
        require_claim_owner=True,
        background_tasks=background_tasks # 🚀 PERBAIKAN 3: Teruskan parameternya ke dalam service
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


@router.post("/{alert_id}/investigate")
def complete_blocked_investigation(
    alert_id: int,
    payload: BlockedInvestigationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user=Depends(require_roles("FRAUD_ANALYST")),
):
    return complete_blocked_investigation_service(
        db=db,
        alert_id=alert_id,
        analyst_id=user.id,
        assessment=payload.assessment,
        confidence=payload.confidence,
        note=payload.note,
        background_tasks=background_tasks,
    )

@router.post("/{alert_id}/release")
def release_alert(
    alert_id: int, 
    db: Session = Depends(get_db), 
    user = Depends(require_roles(*OPERATIONS_ROLES))
):
    return release_alert_service(db, alert_id, user.id, get_role_name(user))

