from sqlalchemy.orm import Session, joinedload
from app.infrastructure.database.models.fraud_alert_model import FraudAlert

class AlertRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, alert: FraudAlert):
        self.db.add(alert)
        return alert

    def get_by_id(self, alert_id: int):
        return self.db.query(FraudAlert).options(
            joinedload(FraudAlert.transaction)
        ).filter(FraudAlert.id == alert_id).first()

    def get_all(self, query):
        return query.all()
    
    def get_query(self):
        return self.db.query(FraudAlert)
    
    def get_recent(self, limit=5):
        return self.db.query(FraudAlert)\
            .order_by(FraudAlert.created_at.desc())\
            .limit(limit)\
            .all()
    