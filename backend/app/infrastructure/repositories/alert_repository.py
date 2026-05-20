from sqlalchemy import case, func, and_
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
    
    def get_open_queue(self, priority_label: str = None, limit=50):
        """
        Mengambil antrean alert yang masih OPEN.
        Diurutkan berdasarkan prioritas tertinggi (Priority Queue), 
        lalu yang paling lama menunggu (FIFO).
        Mendukung filtering berdasarkan priority label.
        """
        query = self.db.query(FraudAlert)\
            .options(joinedload(FraudAlert.transaction))\
            .filter(FraudAlert.status == "OPEN")

        # =========================
        # FILTERING PRIORITY LABEL
        # =========================
        if priority_label:
            label = priority_label.upper()
            if label == "CRITICAL":
                query = query.filter(FraudAlert.priority >= 90)
            elif label == "HIGH":
                query = query.filter(FraudAlert.priority >= 75, FraudAlert.priority < 90)
            elif label == "MEDIUM":
                query = query.filter(FraudAlert.priority >= 50, FraudAlert.priority < 75)
            elif label == "LOW":
                query = query.filter(FraudAlert.priority < 50)

        # =========================
        # ENTERPRISE QUEUE ORDERING
        # =========================
        return query.order_by(
            FraudAlert.priority.desc(),
            FraudAlert.created_at.asc()
        ).limit(limit).all()

    def get_claimed_by_user(self, user_id: int):
        """
        Mengambil alert yang sedang diinvestigasi oleh user tertentu.
        Diurutkan berdasarkan prioritas tertinggi (Priority Queue).
        """
        return self.db.query(FraudAlert)\
            .options(joinedload(FraudAlert.transaction))\
            .filter(
                FraudAlert.claimed_by == user_id, 
                FraudAlert.status == "IN_PROGRESS"
            )\
            .order_by(
                FraudAlert.priority.desc(),  # 🔥 FIX POIN 7: Highest risk first di antrean analis
                FraudAlert.claimed_at.asc()  # FIFO jika prioritasnya sama
            )\
            .all()
    
    def get_count_by_status(self, status: str) -> int:
        """
        Menghitung total antrean alert berdasarkan status tertentu (e.g., OPEN, IN_PROGRESS).
        """
        return self.db.query(func.count(FraudAlert.id))\
            .filter(FraudAlert.status == status.upper())\
            .scalar() or 0
    
    def get_priority_distribution(self):
        """
        Menghitung matriks distribusi jumlah alert yang masih OPEN berdasarkan level prioritasnya.
        Kalkulasi dieksekusi langsung di level database engine untuk efisiensi tinggi.
        """
        data = self.db.query(
            func.sum(case(((FraudAlert.priority >= 90), 1), else_=0)).label("critical"),
            func.sum(case((and_(FraudAlert.priority >= 75, FraudAlert.priority < 90), 1), else_=0)).label("high"),
            func.sum(case((and_(FraudAlert.priority >= 50, FraudAlert.priority < 75), 1), else_=0)).label("medium"),
            func.sum(case(((FraudAlert.priority < 50), 1), else_=0)).label("low")
        ).filter(FraudAlert.status == "OPEN").first()

        return {
            "CRITICAL": int(data.critical or 0),
            "HIGH": int(data.high or 0),
            "MEDIUM": int(data.medium or 0),
            "LOW": int(data.low or 0)
        }
    