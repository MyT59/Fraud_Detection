from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.infrastructure.database.models.activity_log_model import ActivityLog
from app.infrastructure.database.models.admin_model import Admin
from datetime import datetime

class ActivityLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, log: ActivityLog):
        self.db.add(log)

    def get_filtered(
        self,
        skip=0,
        limit=50,
        action_types=None,
        severity=None,
        start_date=None,
        end_date=None,
        email=None,
        search=None,       # global search: action_type, target_id, target_type, email
    ):
        query = (
            self.db.query(ActivityLog)
            .outerjoin(Admin, ActivityLog.admin_id == Admin.id)
            .options(joinedload(ActivityLog.admin))
        )

        if action_types:
            query = query.filter(ActivityLog.action_type.in_(action_types))
        if severity:
            query = query.filter(ActivityLog.severity == severity)
        if start_date:
            query = query.filter(ActivityLog.created_at >= start_date)
        if end_date:
            query = query.filter(ActivityLog.created_at <= end_date)
        if email:
            query = query.filter(Admin.email.ilike(f"%{email}%"))
        if search:
            from sqlalchemy import or_, cast
            from sqlalchemy.dialects.postgresql import TEXT
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    ActivityLog.action_type.ilike(pattern),
                    ActivityLog.target_id.ilike(pattern),
                    ActivityLog.target_type.ilike(pattern),
                    Admin.email.ilike(pattern),
                    Admin.full_name.ilike(pattern),
                    cast(ActivityLog.details, TEXT).ilike(pattern),
                )
            )

        total = query.count()
        items = (
            query.order_by(ActivityLog.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return total, items

    def get_by_admin(self, admin_id, skip=0, limit=50):
        query = self.db.query(ActivityLog).filter(
            ActivityLog.admin_id == admin_id
        )
        total = query.count()
        items = (
            query.order_by(ActivityLog.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return total, items

    def get_recent(self, limit=5):
        return (
            self.db.query(ActivityLog)
            .order_by(ActivityLog.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_action_counts(self, admin_id=None):
        query = self.db.query(
            ActivityLog.action_type,
            func.count(ActivityLog.id),
        )
        if admin_id is not None:
            query = query.filter(ActivityLog.admin_id == admin_id)
        return dict(query.group_by(ActivityLog.action_type).all())
