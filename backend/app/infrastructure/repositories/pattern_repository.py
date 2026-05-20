from app.infrastructure.database.models.fraud_patterns_model import FraudPattern

class PatternRepository:
    def __init__(self, db):
        self.db = db

    def get_by_id(self, pattern_id):
        return self.db.query(FraudPattern).filter(FraudPattern.id == pattern_id).first()
    
    def get_all_patterns(self):
        """
        Mengambil semua daftar fraud pattern untuk dianalisis efektivitasnya.
        Diurutkan berdasarkan akurasi terendah agar pola bermasalah terlihat duluan.
        """
        return self.db.query(FraudPattern).order_by(FraudPattern.accuracy_score.asc()).all()