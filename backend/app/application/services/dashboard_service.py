from sqlalchemy.orm import Session
from sqlalchemy import case, func
from datetime import datetime, timedelta, timezone

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.infrastructure.database.models.ml_model_model import MLModel
from app.infrastructure.database.models.manual_review_model import ManualReview
from app.infrastructure.database.models.activity_log_model import ActivityLog
from app.infrastructure.repositories.transaction_repository import TransactionRepository
from app.infrastructure.repositories.alert_repository import AlertRepository
from app.infrastructure.repositories.review_repository import ReviewRepository
from app.infrastructure.repositories.activity_log_repository import ActivityLogRepository
from app.application.services.health_check_service import HealthCheckService
from app.application import services

def format_badge(severity: str):
    return severity

def format_color(severity: str):
    return {
        "CRITICAL": "dark-red",
        "HIGH": "red",
        "MEDIUM": "yellow",
        "LOW": "blue"
    }.get(severity, "gray")

def format_time(dt):
    if not dt:
        return "unknown"

    # 🔥 Fix: Normalize ke UTC
    if dt.tzinfo is None:
        # Jika naive (dari SQLAlchemy), anggap sebagai UTC
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        # Jika aware, konversi ke UTC secara aman
        dt = dt.astimezone(timezone.utc)

    now = datetime.now(timezone.utc)
    diff = now - dt

    minutes = int(diff.total_seconds() / 60)

    if minutes < 1:
        return "just now"
    if minutes < 60:
        return f"{minutes} minutes ago"

    hours = minutes // 60
    if hours < 24:
        return f"{hours} hours ago"

    days = hours // 24
    return f"{days} days ago"

class DashboardService:

    @staticmethod
    def get_kpi(db: Session):
        # =========================
        # TOTAL PER SERVICE
        # =========================
        agenusa = db.query(func.count(Transaction.id)).filter(
            Transaction.service_source == "AGENUSA"
        ).scalar()

        nusabill = db.query(func.count(Transaction.id)).filter(
            Transaction.service_source == "NUSABILL"
        ).scalar()

        # =========================
        # FRAUD PER SERVICE
        # =========================
        fraud_agenusa = db.query(func.count(Transaction.id)).filter(
            Transaction.service_source == "AGENUSA",
            Transaction.final_status == "FRAUD"
        ).scalar()

        fraud_nusabill = db.query(func.count(Transaction.id)).filter(
            Transaction.service_source == "NUSABILL",
            Transaction.final_status == "FRAUD"
        ).scalar()

        # =========================
        # TOTAL GLOBAL
        # =========================
        total_tx = (agenusa or 0) + (nusabill or 0)
        total_fraud = (fraud_agenusa or 0) + (fraud_nusabill or 0)

        fraud_rate = (total_fraud / total_tx * 100) if total_tx else 0

        # =========================
        # MODEL ACCURACY
        # =========================
        accuracy = db.query(MLModel.accuracy_score)\
            .filter(MLModel.is_active == True)\
            .order_by(MLModel.created_at.desc())\
            .limit(1)\
            .scalar()

        return {
            "total_agenusa": agenusa or 0,
            "total_nusabill": nusabill or 0,
            "fraud_agenusa": fraud_agenusa or 0,
            "fraud_nusabill": fraud_nusabill or 0,
            "fraud_rate": round(fraud_rate, 2),
            "model_accuracy": round(accuracy or 94.2, 2)
        }
    
    @staticmethod
    def get_transaction_trend(db: Session):
        """Memanggil query trend per jam dari TransactionRepository."""
        trx_repo = TransactionRepository(db)
        return trx_repo.get_today_hourly_trend()

    @staticmethod
    def get_fraud_distribution(db: Session):
        fraud = db.query(func.count(Transaction.id)).filter(
            Transaction.final_status == "FRAUD"
        ).scalar()

        legit = db.query(func.count(Transaction.id)).filter(
            Transaction.final_status != "FRAUD"
        ).scalar()

        return {
            "total": (fraud or 0) + (legit or 0),
            "fraud": fraud or 0,
            "legit": legit or 0
        }

    @staticmethod
    def get_recent_alerts(db: Session): # 🔥 Tambahkan @staticmethod
        alert_repo = AlertRepository(db)
        alerts = db.query(FraudAlert)\
            .filter(FraudAlert.status == "OPEN")\
            .order_by(FraudAlert.created_at.desc())\
            .limit(5)\
            .all()
        result = []
        for a in alerts:
            service = getattr(a.transaction, "service_source", "UNK")
            prefix = "AGN" if service == "AGENUSA" else "NUS"
            result.append({
                "id": a.id,
                "transaction_id": a.transaction_id,
                "service": service,
                "severity": a.severity,
                "status": a.status,
                "created_at": a.created_at,
                "title": a.title or "Fraud Detected",
                "description": a.message,
                "badge": format_badge(a.severity), # Bebas panggil langsung
                "color": format_color(a.severity), # Bebas panggil langsung
                "trx_id": f"{prefix}-{str(a.transaction_id).zfill(6)}",
                "time": format_time(a.created_at), # Bebas panggil langsung
                "type": a.alert_type,
                "icon": "fraud" if a.severity in ["CRITICAL", "HIGH"] else "warning"
            })
        return result

    @staticmethod
    def get_top_patterns(db: Session):
        data = db.query(
            Transaction.violation_pattern_ids,
            func.count(Transaction.id)
        ).filter(
            Transaction.violation_pattern_ids.isnot(None)
        ).group_by(
            Transaction.violation_pattern_ids
        ).order_by(
            func.count(Transaction.id).desc()
        ).limit(5).all()

        return [
            {
                "pattern": str(d[0]),
                "count": d[1]
            }
            for d in data
        ]
    
    @staticmethod
    def get_alert_trend(db: Session):
        last_7_days = datetime.now(timezone.utc) - timedelta(days=7)

        data = db.query(
            func.date(FraudAlert.created_at).label("date"),
            func.count(FraudAlert.id)
        ).filter(
            FraudAlert.created_at >= last_7_days
        ).group_by("date").order_by("date").all()

        return {
            "labels": [str(d[0]) for d in data],
            "datasets": [{"label": "Alerts", "data": [d[1] for d in data]}]
        }

    @staticmethod
    def get_system_health(db: Session):
        base_url = "http://127.0.0.1:8000"

        services = HealthCheckService.get_all_services(db)

        # =========================
        # SUMMARY
        # =========================
        total = len(services)
        operational = len([s for s in services if s["status"] == "OPERATIONAL"])
        degraded = len([s for s in services if s["status"] == "DEGRADED"])
        down = len([s for s in services if s["status"] == "DOWN"])

        if down > 0:
            overall = "DOWN"
        elif degraded > 0:
            overall = "DEGRADED"
        else:
            overall = "OPERATIONAL"

        avg_latency = int(
            sum([s["latency"] or 0 for s in services]) / total
        ) if total > 0 else 0

        return {
            "summary": {
                "status": overall,
                "uptime": 99.98,
                "avg_latency": avg_latency
            },
            "counts": {   # 🔥 tambah ini
                "operational": operational,
                "degraded": degraded,
                "down": down
            },
            "updated_at": datetime.now(timezone.utc),
            "services": services
        }
    
    @staticmethod
    def get_transaction_trend_detail(db, range="today", start=None, end=None):
        import calendar

        repo = TransactionRepository(db)
        now = datetime.now(timezone.utc)

        # ================= RANGE =================
        if range == "7d":
            start_date = now - timedelta(days=7)
            end_date = now
            granularity = "daily"
            label_type = "weekday"

        elif range == "30d":
            start_date = now - timedelta(days=30)
            end_date = now
            granularity = "daily"
            label_type = "date"

        elif range == "1y":
            start_date = now - timedelta(days=365)
            end_date = now
            granularity = "monthly"
            label_type = "month"

        elif range == "custom" and start and end:
            start_date = datetime.fromisoformat(start)
            end_date = datetime.fromisoformat(end)

            days = (end_date - start_date).days

            if days <= 1:
                granularity = "hourly"
                label_type = "hour"
            else:
                granularity = "daily"
                label_type = "date"

        else:
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = now
            granularity = "hourly"
            label_type = "hour"

        # ================= PREVIOUS =================
        delta = end_date - start_date
        prev_start = start_date - delta
        prev_end = start_date

        # ================= FETCH =================
        if granularity == "hourly":
            cur_raw = repo.get_trend_hourly(start_date, end_date)
            prev_raw = repo.get_trend_hourly(prev_start, prev_end)

        elif granularity == "daily":
            cur_raw = repo.get_trend_daily(start_date, end_date)
            prev_raw = repo.get_trend_daily(prev_start, prev_end)

        else:  # monthly
            cur_raw = repo.get_trend_monthly(start_date, end_date)
            prev_raw = repo.get_trend_monthly(prev_start, prev_end)

        # ================= FORMAT LABEL =================
        def format_label(d):
            if label_type == "hour":
                return f"{str(d['hour']).zfill(2)}:00"

            if label_type == "weekday":
                dt = datetime.fromisoformat(d["date"])
                return calendar.day_abbr[dt.weekday()]  # Mon

            if label_type == "date":
                dt = datetime.fromisoformat(d["date"])
                return dt.strftime("%d")  # 01, 02

            if label_type == "month":
                return calendar.month_abbr[int(d["month"])]  # Jan

        # ================= FORMAT DATA =================
        def format_data(raw):
            result = []
            for d in raw:
                total = d["total"]
                fraud = d["fraud"]
                legit = total - fraud

                result.append({
                    "label": format_label(d),
                    "transactions": total,
                    "fraud": fraud,
                    "legitimate": legit,
                    "fraud_rate": round((fraud / total * 100) if total else 0, 1)
                })
            return result

        current = format_data(cur_raw)
        previous = format_data(prev_raw)

        # ================= AGGREGATE =================
        def aggregate(data):
            total_tx = sum(d["transactions"] for d in data)
            total_fraud = sum(d["fraud"] for d in data)
            fraud_rate = (total_fraud / total_tx * 100) if total_tx else 0
            return total_tx, total_fraud, fraud_rate

        cur_tx, cur_fraud, cur_rate = aggregate(current)
        prev_tx, prev_fraud, prev_rate = aggregate(previous)

        def growth(cur, prev):
            if prev == 0:
                return 100.0 if cur > 0 else 0.0
            return round((cur - prev) / prev * 100, 2)

        return {
            "granularity": granularity,
            "current": current,
            "previous": previous,
            "growth": {
                "transactions": growth(cur_tx, prev_tx),
                "fraud": growth(cur_fraud, prev_fraud),
                "fraud_rate": growth(cur_rate, prev_rate)
            }
        }
    
    @staticmethod
    def get_activity_timeline(db: Session, type: str = None):
        timeline = []

        trx_repo = TransactionRepository(db)
        alert_repo = AlertRepository(db)
        review_repo = ReviewRepository(db)
        log_repo = ActivityLogRepository(db)

        fraud_trx = trx_repo.get_recent_fraud()
        alerts = db.query(FraudAlert)\
            .filter(FraudAlert.status == "OPEN")\
            .order_by(FraudAlert.created_at.desc())\
            .limit(5)\
            .all()
        reviews = review_repo.get_recent()
        logs = log_repo.get_recent()

        # ================= FRAUD =================
        for t in fraud_trx:
            timeline.append({
                "type": "FRAUD",
                "title": "High-Risk Transaction Blocked",
                "description": f"{t.original_trx_id} automatically blocked by system",
                "created_at": t.created_at,
                "time": format_time(t.created_at),
                "actor": "System",
                "metadata": {
                    "amount": f"Rp {t.amount}" if t.amount else "-",
                    "user": t.user_account_id or "-"
                }
            })

        # ================= ALERT =================
        for a in alerts:
            timeline.append({
                "type": "FRAUD",
                "title": a.title or "Fraud Detected",
                "description": a.message,
                "created_at": a.created_at,
                "time": format_time(a.created_at),
                "actor": "System",
                "metadata": {}
            })

        # ================= REVIEWS =================
        for r in reviews:
            timeline.append({
                "type": "REVIEWS",
                "title": "Transaction Approved",
                "description": f"{r.transaction_id} approved after manual review",
                "created_at": r.created_at,
                "time": format_time(r.created_at),
                "actor": "Admin User",
                "metadata": {
                    "decision": r.decision
                }
            })

        # ================= SYSTEM =================
        for log in logs:
            timeline.append({
                "type": "SYSTEM",
                "title": log.action_type or "System Event",
                "description": log.details or "-",
                "created_at": log.created_at,
                "time": format_time(log.created_at),
                "actor": f"Admin {log.admin_id}" if log.admin_id else "System",
                "metadata": {}
            })

        # ================= SORT =================
        timeline.sort(key=lambda x: x["created_at"], reverse=True)

        # ================= FILTER =================
        if type:
            type = type.upper()
            timeline = [t for t in timeline if t["type"] == type]

        # ================= CLEAN RESPONSE =================
        for t in timeline:
            del t["created_at"]

        return timeline[:20]