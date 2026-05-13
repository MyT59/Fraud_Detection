from sqlalchemy.orm import Session, joinedload
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
        action_type=None,
        start_date: datetime = None,
        end_date: datetime = None,
        email: str = None,
    ):
        query = (
            self.db.query(ActivityLog)
            .outerjoin(Admin, ActivityLog.admin_id == Admin.id)
            .options(joinedload(ActivityLog.admin))
        )

        if action_type:
            query = query.filter(ActivityLog.action_type == action_type)

        if start_date:
            query = query.filter(ActivityLog.created_at >= start_date)

        if end_date:
            query = query.filter(ActivityLog.created_at <= end_date)

        if email:
            query = query.filter(Admin.email.ilike(f"%{email}%"))

        return (
            query.order_by(ActivityLog.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_admin(self, admin_id, skip=0, limit=50):
        return (
            self.db.query(ActivityLog)
            .filter(ActivityLog.admin_id == admin_id)
            .order_by(ActivityLog.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_recent(self, limit=5):
        return self.db.query(ActivityLog)\
            .order_by(ActivityLog.created_at.desc())\
            .limit(limit)\
            .all()