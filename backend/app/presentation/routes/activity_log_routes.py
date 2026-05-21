from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime

from app.infrastructure.database.session import get_db
from app.application.services.activity_log_service import get_activity_logs
from app.core.rbac import require_roles
from app.presentation.schemas.activity_log_schema import ActivityLogPaginatedResponse

router = APIRouter(prefix="/activity-logs")


@router.get("/", response_model=ActivityLogPaginatedResponse)
def get_logs(
    # 🎯 QUICK WIN FIX: Ubah 'skip' menjadi 'page' agar seragam di seluruh dashboard frontend! 
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1),
    action_type: str = Query(None),
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    email: str = Query(None),
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))
):
    # Konversi page ke nilai offset offset (skip) yang dimengerti oleh kueri repository
    calculated_skip = (page - 1) * limit

    return get_activity_logs(
        db=db,
        current_admin=current_admin,
        skip=calculated_skip,
        limit=limit,
        action_type=action_type,
        start_date=start_date,
        end_date=end_date,
        email=email
    )