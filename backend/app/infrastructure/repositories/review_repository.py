from sqlalchemy.orm import Session
from app.infrastructure.database.models.manual_review_model import ManualReview

class ReviewRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, review: ManualReview):
        self.db.add(review)
        self.db.flush()
        return review

    def get_by_alert_id(self, alert_id: int):
        return self.db.query(ManualReview).filter(
            ManualReview.alert_id == alert_id
        ).first()
    
    def get_recent(self, limit=5):
        return self.db.query(ManualReview)\
            .order_by(ManualReview.created_at.desc())\
            .limit(limit)\
            .all()