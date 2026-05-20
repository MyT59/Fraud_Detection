from app.infrastructure.repositories.activity_log_repository import ActivityLogRepository
from app.presentation.schemas.activity_log_schema import ActivityLogResponse
from app.infrastructure.database.models.activity_log_model import ActivityLog

def log_activity(db, admin, action_type, target_type, target_id=None, details=None):
    repo = ActivityLogRepository(db)
    
    log = ActivityLog(
        admin_id=admin.id if admin else None,
        action_type=action_type,
        target_type=target_type,
        target_id=str(target_id) if target_id else None,
        details=details
    )
    
  
    repo.create(log)

def get_activity_logs(
    db,
    current_admin,
    skip=0,
    limit=50,
    action_type=None,
    start_date=None,
    end_date=None,
    email=None,
):
    repo = ActivityLogRepository(db)
    role = current_admin.role.role_name

    # 🔴 SUPER ADMIN / 🟠 RISK MANAGER
    if role in ["SUPER_ADMIN", "RISK_MANAGER"]:
        logs = repo.get_filtered(
            skip=skip,
            limit=limit,
            action_type=action_type,
            start_date=start_date,
            end_date=end_date,
            email=email,
        )
    # 🟡 FRAUD ANALYST → hanya miliknya
    else:
        logs = repo.get_by_admin(current_admin.id, skip, limit)

    return [
        ActivityLogResponse(
            id=log.id,
            admin_id=log.admin_id,
            action_type=log.action_type,
            target_type=log.target_type,
            target_id=log.target_id,
            details=log.details,
            created_at=log.created_at,
            admin_name=log.admin.full_name if log.admin else None,
            admin_email=log.admin.email if log.admin else None
        )
        for log in logs
    ]