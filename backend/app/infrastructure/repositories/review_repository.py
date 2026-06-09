from sqlalchemy import func, case, and_
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from app.infrastructure.database.models.manual_review_model import ManualReview
from app.infrastructure.database.models.admin_model import Admin
from app.infrastructure.database.models.fraud_alert_model import FraudAlert

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
    
    def get_decision_counts(self):
        """
        Mengambil agregat total review, serta jumlah keputusan FRAUD dan SAFE.
        Diperlukan untuk menghitung Fraud Confirmation Rate.
        """
        data = self.db.query(
            func.count(ManualReview.id).label("total"),
            func.sum(case((ManualReview.decision == "FRAUD", 1), else_=0)).label("fraud"),
            func.sum(case((ManualReview.decision == "SAFE", 1), else_=0)).label("safe")
        ).first()
        
        return {
            "total": data.total or 0,
            "fraud": int(data.fraud or 0),
            "safe": int(data.safe or 0)
        }

    def get_avg_review_duration_seconds(self):
        """
        Menghitung rata-rata durasi investigasi analis dalam satuan detik (SLA Analytics).
        Formula: AVG(completed_at - started_at)
        """
        return self.db.query(
            func.avg(
                func.extract('epoch', ManualReview.review_completed_at - ManualReview.review_started_at)
            )
        ).filter(
            ManualReview.review_completed_at.isnot(None),
            ManualReview.review_started_at.isnot(None)
        ).scalar() or 0.0
    
    def get_analyst_performance_metrics(self):
        """
        Mengagregasi performa kerja per analis risiko.
        Menghitung jumlah review, durasi rata-rata (SLA), dan fraud yang berhasil diidentifikasi.
        """
        return self.db.query(
            ManualReview.reviewer_id.label("analyst_id"),
            Admin.full_name.label("analyst_name"),
            Admin.email.label("analyst_email"),
            func.count(ManualReview.id).label("reviews_completed"),
            func.avg(
                func.extract('epoch', ManualReview.review_completed_at - ManualReview.review_started_at)
            ).label("avg_review_seconds"),
            func.sum(case((ManualReview.decision == "FRAUD", 1), else_=0)).label("fraud_detected")
        ).join(
            Admin, ManualReview.reviewer_id == Admin.id
        ).group_by(
            ManualReview.reviewer_id, Admin.full_name, Admin.email
        ).order_by(
            func.count(ManualReview.id).desc()  
        ).all()
    
    def get_hourly_reviews_24h(self):
        """
        Menghitung kecepatan penyelesaian review analis tiap jam dalam 24 jam terakhir.
        """
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        truncated_hour = func.date_trunc('hour', ManualReview.review_completed_at)
        
        results = self.db.query(
            truncated_hour.label('hour'),
            func.count(ManualReview.id).label('count')
        ).filter(
            ManualReview.review_completed_at >= since
        ).group_by(
            truncated_hour
        ).order_by(
            truncated_hour.asc()
        ).all()
        
        return [{"hour": str(r.hour), "count": r.count} for r in results]

    def get_daily_fraud_7d(self):
        """
        Menghitung tren harian kasus yang terkonfirmasi FRAUD oleh analis selama 7 hari terakhir.
        """
        since = datetime.now(timezone.utc) - timedelta(days=7)
        truncated_day = func.date_trunc('day', ManualReview.review_completed_at)
        
        results = self.db.query(
            truncated_day.label('day'),
            func.count(ManualReview.id).label('count')
        ).filter(
            ManualReview.review_completed_at >= since,
            ManualReview.decision == "FRAUD"
        ).group_by(
            truncated_day
        ).order_by(
            truncated_day.asc()
        ).all()
        
        return [{"day": r.day.strftime("%Y-%m-%d") if r.day else "", "count": r.count} for r in results]

    def get_queue_growth_7d(self):
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

        # 1. Ambil data incoming (Alerts yang dibuat)
        incoming_data = (
            self.db.query(
                func.date(FraudAlert.created_at).label("day"),
                func.count(FraudAlert.id).label("incoming_count")
            )
            .filter(FraudAlert.created_at >= seven_days_ago)
            .group_by(func.date(FraudAlert.created_at))
            .all()
        )

        # 2. Ambil data resolved (Alerts yang diselesaikan)
        # Menggunakan kolom resolved_at sesuai dengan model database
        resolved_data = (
            self.db.query(
                func.date(FraudAlert.resolved_at).label("day"),
                func.count(FraudAlert.id).label("resolved_count")
            )
            .filter(
                FraudAlert.resolved_at >= seven_days_ago,
                FraudAlert.status == 'RESOLVED'
            )
            .group_by(func.date(FraudAlert.resolved_at))
            .all()
        )

        # 3. Gabungkan data menggunakan dictionary Python
        merged_data = {}

        for row in incoming_data:
            day_str = str(row.day)
            if day_str not in merged_data:
                merged_data[day_str] = {"incoming": 0, "resolved": 0}
            merged_data[day_str]["incoming"] = row.incoming_count

        for row in resolved_data:
            day_str = str(row.day)
            # Karena resolved_at bisa Null sebelum di-cast, pastikan day_str valid
            if day_str and day_str != "None": 
                if day_str not in merged_data:
                    merged_data[day_str] = {"incoming": 0, "resolved": 0}
                merged_data[day_str]["resolved"] = row.resolved_count

        # 4. Format menjadi list of dictionaries
        results = []
        for day_str in sorted(merged_data.keys()):
            results.append({
                "day": day_str,
                "incoming_alerts": merged_data[day_str]["incoming"],
                "resolved_alerts": merged_data[day_str]["resolved"]
            })

        return results