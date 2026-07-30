from app.infrastructure.repositories.activity_log_repository import ActivityLogRepository
from app.presentation.schemas.activity_log_schema import ActivityLogPaginatedResponse, ActivityLogResponse
from app.infrastructure.database.models.activity_log_model import ActivityLog
from app.core.rbac import get_role_name

def log_activity(
    db,
    admin,
    action_type: str,
    module_source: str = "SYSTEM",
    severity: str = "INFO",
    target_type: str = None,
    target_id: str = None,
    ip_address: str = None,
    device: str = None,
    browser: str = None,
    session_id: int = None,
    details: dict = None
):
    repo = ActivityLogRepository(db)

    log = ActivityLog(
        admin_id=admin.id if admin else None,
        session_id=session_id,
        action_type=action_type,
        module_source=module_source,
        severity=severity,
        target_type=target_type,
        target_id=str(target_id) if target_id else None,
        ip_address=ip_address,
        device=device,
        browser=browser,
        details=details or {}
    )
    repo.create(log)


def get_activity_logs(
    db,
    current_admin,
    skip=0,
    limit=50,
    action_types=None,
    severity=None,
    start_date=None,
    end_date=None,
    email=None,
    search=None,
):
    repo = ActivityLogRepository(db)
    role = get_role_name(current_admin)
    page = (skip // limit) + 1 if limit > 0 else 1

    if role in ["SUPER_ADMIN", "RISK_MANAGER"]:
        total, logs = repo.get_filtered(
            skip=skip,
            limit=limit,
            action_types=action_types,
            severity=severity,
            start_date=start_date,
            end_date=end_date,
            email=email,
            search=search,
        )
    else:
        total, logs = repo.get_by_admin(current_admin.id, skip, limit)

    items = [
        ActivityLogResponse(
            id=log.id,
            admin_id=log.admin_id,
            session_id=log.session_id,
            action_type=log.action_type,
            module_source=log.module_source,
            severity=log.severity,
            target_type=log.target_type,
            target_id=log.target_id,
            ip_address=log.ip_address,
            device=log.device,
            browser=log.browser,
            details=log.details,
            created_at=log.created_at,
            admin_name=log.admin.full_name if log.admin else None,
            admin_email=log.admin.email if log.admin else None,
        )
        for log in logs
    ]

    return ActivityLogPaginatedResponse(
        total=total,
        page=page,
        limit=limit,
        items=items,
    )


def get_activity_log_summary(db, current_admin):
    """Return exact action counts for the caller's permitted log scope."""
    repo = ActivityLogRepository(db)
    role = get_role_name(current_admin)
    admin_id = None if role in ["SUPER_ADMIN", "RISK_MANAGER"] else current_admin.id
    action_counts = repo.get_action_counts(admin_id=admin_id)
    return {
        "total": sum(action_counts.values()),
        "action_counts": action_counts,
    }
