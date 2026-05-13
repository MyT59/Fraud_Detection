from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime

from app.infrastructure.database.session import get_db
from app.application.services.activity_log_service import get_activity_logs
from app.core.rbac import require_roles

router = APIRouter(prefix="/activity-logs")


@router.get("/")
def get_logs(
    skip: int = 0,
    limit: int = 50,
    action_type: str = Query(None),
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    email: str = Query(None),
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))
):
    return get_activity_logs(
        db,
        current_admin,
        skip,
        limit,
        action_type,
        start_date,
        end_date,
        email
    )