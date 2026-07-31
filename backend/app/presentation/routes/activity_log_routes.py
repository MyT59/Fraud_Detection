from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.infrastructure.database.session import get_db
from app.application.services.activity_log_service import get_activity_logs, get_activity_log_summary
from app.core.rbac import require_roles
from app.presentation.schemas.activity_log_schema import ActivityLogPaginatedResponse, ActivityLogSummaryResponse

router = APIRouter(prefix="/activity-logs")


@router.get("/summary", response_model=ActivityLogSummaryResponse)
def get_log_summary(
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST")),
):
    return get_activity_log_summary(db, current_admin)


@router.get("/audit", response_model=ActivityLogPaginatedResponse)
def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action_type: Optional[str] = Query(None),
    action_types: Optional[List[str]] = Query(None),
    severity: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    email: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN")),
):
    """Administrative audit trail; intentionally restricted to Super Admin."""
    combined_action_types = list(action_types or [])
    if action_type and action_type not in combined_action_types:
        combined_action_types.append(action_type)
    return get_activity_logs(
        db=db,
        current_admin=current_admin,
        skip=(page - 1) * limit,
        limit=limit,
        action_types=combined_action_types or None,
        severity=severity,
        start_date=start_date,
        end_date=end_date,
        email=email,
        search=search,
    )


@router.get("/", response_model=ActivityLogPaginatedResponse)
def get_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action_type: Optional[str] = Query(None),           # backward compat — single
    action_types: Optional[List[str]] = Query(None),    # baru — multi
    severity: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    email: Optional[str] = Query(None),
    search: Optional[str] = Query(None),                # baru — global search
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))
):
    # Merge action_type (lama) dan action_types (baru) jadi satu list
    combined_action_types = list(action_types or [])
    if action_type and action_type not in combined_action_types:
        combined_action_types.append(action_type)

    calculated_skip = (page - 1) * limit

    return get_activity_logs(
        db=db,
        current_admin=current_admin,
        skip=calculated_skip,
        limit=limit,
        action_types=combined_action_types or None,
        severity=severity,
        start_date=start_date,
        end_date=end_date,
        email=email,
        search=search,
    )
