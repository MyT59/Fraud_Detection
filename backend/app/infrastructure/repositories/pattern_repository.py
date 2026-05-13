from app.infrastructure.database.models.fraud_patterns_model import FraudPattern

class PatternRepository:
    def __init__(self, db):
        self.db = db

    def get_by_id(self, pattern_id):
        return self.db.query(FraudPattern).filter(FraudPattern.id == pattern_id).first()