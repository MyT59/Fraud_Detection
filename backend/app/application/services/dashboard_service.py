import builtins
from collections import Counter
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import case, func

from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)
from datetime import datetime, timedelta, timezone

DASHBOARD_TIMEZONE = ZoneInfo("Asia/Jakarta")

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.infrastructure.database.models.ml_model_model import MLModel
from app.infrastructure.database.models.manual_review_model import ManualReview
from app.infrastructure.database.models.activity_log_model import ActivityLog
from app.infrastructure.database.models.admin_model import Admin # Tambahan untuk resolusi nama aktor

from app.infrastructure.repositories.transaction_repository import TransactionRepository
from app.infrastructure.repositories.alert_repository import AlertRepository
from app.infrastructure.repositories.review_repository import ReviewRepository
from app.infrastructure.repositories.activity_log_repository import ActivityLogRepository
from app.application.services.health_check_service import HealthCheckService

# 🔥 IMPORT ENUM STANDAR V1
from app.infrastructure.database.enums import TimelineTypeEnum, SeverityLevelEnum, EventSourceEnum

def format_badge(severity: str):
    return severity

def format_color(severity: str):
    return {
        "CRITICAL": "dark-red",
        "HIGH": "red",
        "WARNING": "yellow",
        "MEDIUM": "yellow",
        "LOW": "blue",
        "INFO": "blue"
    }.get(severity, "gray")

def format_time(dt):
    if not dt:
        return "unknown"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    now = datetime.now(timezone.utc)
    diff = now - dt
    minutes = int(diff.total_seconds() / 60)

    if minutes < 1: return "just now"
    if minutes < 60: return f"{minutes} minutes ago"
    hours = minutes // 60
    if hours < 24: return f"{hours} hours ago"
    days = hours // 24
    return f"{days} days ago"


class DashboardService:

    @staticmethod
    @log_performance
    def get_kpi(db: Session):
        # 1 aggregate query menggantikan 4 query COUNT terpisah
        row = db.query(
            func.count(Transaction.id).label("total"),
            func.sum(
                case((Transaction.service_source == "AGENUSA", 1), else_=0)
            ).label("agenusa"),
            func.sum(
                case((Transaction.service_source == "NUSABILL", 1), else_=0)
            ).label("nusabill"),
            func.sum(
                case(((Transaction.service_source == "AGENUSA") & (Transaction.final_status == "FRAUD"), 1), else_=0)
            ).label("fraud_agenusa"),
            func.sum(
                case(((Transaction.service_source == "NUSABILL") & (Transaction.final_status == "FRAUD"), 1), else_=0)
            ).label("fraud_nusabill"),
        ).one()

        agenusa      = int(row.agenusa or 0)
        nusabill     = int(row.nusabill or 0)
        fraud_agenusa = int(row.fraud_agenusa or 0)
        fraud_nusabill = int(row.fraud_nusabill or 0)

        total_tx    = int(row.total or 0)
        total_fraud = fraud_agenusa + fraud_nusabill
        fraud_rate  = (total_fraud / total_tx * 100) if total_tx else 0

        latest_active_model = db.query(MLModel)\
            .filter(MLModel.is_active == True)\
            .order_by(MLModel.created_at.desc())\
            .first()
        anomaly_rate = None

        if latest_active_model and latest_active_model.metrics:
            raw_rate = latest_active_model.metrics.get("anomaly_rate")
            if raw_rate is not None:
                try:
                    anomaly_rate = float(raw_rate)
                    # Normalise: kalau dalam bentuk desimal (0.05) → persen (5.0)
                    if anomaly_rate < 1.0:
                        anomaly_rate = anomaly_rate * 100
                except (ValueError, TypeError):
                    anomaly_rate = None

        return {
            "total_agenusa": agenusa or 0,
            "total_nusabill": nusabill or 0,
            "fraud_agenusa": fraud_agenusa or 0,
            "fraud_nusabill": fraud_nusabill or 0,
            "fraud_rate": round(fraud_rate, 2),
            "anomaly_rate": round(anomaly_rate, 2) if anomaly_rate is not None else None
        }
    
    @staticmethod
    def get_transaction_trend(db: Session):
        return DashboardService.get_transaction_trend_detail(db, range="today")

    @staticmethod
    def get_transaction_trend_detail(
        db: Session,
        range: str = "today",
        start: str = None,
        end: str = None,
    ):
        now = datetime.now(DASHBOARD_TIMEZONE)
        anchor = now
        range_key = (range or "today").lower()

        def parse_date(value, fallback):
            if not value:
                return fallback
            try:
                return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=DASHBOARD_TIMEZONE)
            except (TypeError, ValueError) as exc:
                raise ValueError("Format tanggal harus YYYY-MM-DD") from exc

        def is_fraud_expr():
            return case((Transaction.final_status == "FRAUD", 1), else_=0)

        local_transaction_time = func.timezone("Asia/Jakarta", Transaction.transaction_time)

        if range_key == "today":
            start_dt = anchor.replace(hour=0, minute=0, second=0, microsecond=0)
            end_dt = anchor.replace(hour=23, minute=59, second=59, microsecond=999999)
            rows = (
                db.query(
                    func.extract("hour", local_transaction_time).label("hour"),
                    func.count(Transaction.id).label("total"),
                    func.sum(is_fraud_expr()).label("fraud"),
                )
                .filter(Transaction.transaction_time >= start_dt)
                .filter(Transaction.transaction_time <= end_dt)
                .group_by("hour")
                .order_by("hour")
                .all()
            )
            by_hour = {int(r.hour): r for r in rows}
            return [
                {
                    "hour": hour,
                    "total": int(by_hour.get(hour).total or 0) if hour in by_hour else 0,
                    "fraud": int(by_hour.get(hour).fraud or 0) if hour in by_hour else 0,
                }
                for hour in builtins.range(24)
            ]

        if range_key in ("weekly", "7d"):
            days = 7
            end_dt = anchor.replace(hour=23, minute=59, second=59, microsecond=999999)
            start_dt = (end_dt - timedelta(days=days - 1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        elif range_key in ("monthly", "30d"):
            days = 30
            end_dt = anchor.replace(hour=23, minute=59, second=59, microsecond=999999)
            start_dt = (end_dt - timedelta(days=days - 1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        elif range_key == "custom":
            if not start or not end:
                raise ValueError("Tanggal awal dan akhir wajib diisi untuk rentang kustom")
            default_start = (anchor - timedelta(days=7)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            start_dt = parse_date(start, default_start)
            end_dt = parse_date(end, anchor).replace(
                hour=23, minute=59, second=59, microsecond=999999
            )
            if end_dt < start_dt:
                start_dt, end_dt = end_dt.replace(hour=0, minute=0, second=0, microsecond=0), start_dt.replace(
                    hour=23, minute=59, second=59, microsecond=999999
                )
            requested_days = (end_dt.date() - start_dt.date()).days + 1
            if requested_days > 366:
                raise ValueError("Rentang kustom maksimal 366 hari")
            days = requested_days
        elif range_key in ("yearly", "1y"):
            month_starts = []
            for offset in builtins.range(11, -1, -1):
                year = anchor.year
                month = anchor.month - offset
                while month <= 0:
                    month += 12
                    year -= 1
                month_starts.append(datetime(year, month, 1, tzinfo=DASHBOARD_TIMEZONE))
            start_dt = month_starts[0]
            end_dt = anchor.replace(hour=23, minute=59, second=59, microsecond=999999)
            rows = (
                db.query(
                    func.extract("year", local_transaction_time).label("year"),
                    func.extract("month", local_transaction_time).label("month"),
                    func.count(Transaction.id).label("total"),
                    func.sum(is_fraud_expr()).label("fraud"),
                )
                .filter(Transaction.transaction_time >= start_dt)
                .filter(Transaction.transaction_time <= end_dt)
                .group_by("year", "month")
                .order_by("year", "month")
                .all()
            )
            by_month = {(int(r.year), int(r.month)): r for r in rows}
            return [
                {
                    "year": month_start.year,
                    "month": month_start.month,
                    "total": int(by_month.get((month_start.year, month_start.month)).total or 0)
                    if (month_start.year, month_start.month) in by_month
                    else 0,
                    "fraud": int(by_month.get((month_start.year, month_start.month)).fraud or 0)
                    if (month_start.year, month_start.month) in by_month
                    else 0,
                }
                for month_start in month_starts
            ]
        else:
            raise ValueError("Range tidak didukung")

        def fetch_daily_rows(start_range, end_range):
            return (
                db.query(
                    func.date(local_transaction_time).label("date"),
                    func.count(Transaction.id).label("total"),
                    func.sum(is_fraud_expr()).label("fraud"),
                )
                .filter(Transaction.transaction_time >= start_range)
                .filter(Transaction.transaction_time <= end_range)
                .group_by("date")
                .order_by("date")
                .all()
            )

        rows = fetch_daily_rows(start_dt, end_dt)
        by_date = {r.date.isoformat(): r for r in rows}
        result = []
        for idx in builtins.range(days):
            day = (start_dt + timedelta(days=idx)).date()
            key = day.isoformat()
            row = by_date.get(key)
            result.append(
                {
                    "date": key,
                    "total": int(row.total or 0) if row else 0,
                    "fraud": int(row.fraud or 0) if row else 0,
                }
            )
        return result

    @staticmethod
    def get_fraud_distribution(db: Session):
        row = db.query(
            func.count(Transaction.id).label("total"),
            func.sum(case((Transaction.final_status == "FRAUD", 1), else_=0)).label("fraud"),
            func.sum(case((Transaction.final_status == "FLAGGED", 1), else_=0)).label("flagged"),
            func.sum(case((Transaction.final_status == "SAFE", 1), else_=0)).label("safe"),
        ).one()
        return {
            "total": int(row.total or 0),
            "fraud": int(row.fraud or 0),
            "flagged": int(row.flagged or 0),
            "safe": int(row.safe or 0),
        }

    @staticmethod
    def get_recent_alerts(db: Session):
        alerts = db.query(FraudAlert).filter(FraudAlert.status == "OPEN").order_by(FraudAlert.created_at.desc()).limit(5).all()
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
                "badge": format_badge(a.severity),
                "color": format_color(a.severity),
                "trx_id": f"{prefix}-{str(a.transaction_id).zfill(6)}",
                "time": format_time(a.created_at),
                "type": a.alert_type,
                "icon": "fraud" if a.severity in ["CRITICAL", "HIGH"] else "warning"
            })
        return result

    @staticmethod
    @log_performance
    def get_top_patterns(db: Session):
        pattern_hits = Counter()
        rows = db.query(Transaction.violation_pattern_ids).filter(
            Transaction.violation_pattern_ids.isnot(None)
        ).all()
        for (pattern_ids,) in rows:
            if isinstance(pattern_ids, list):
                for pattern_id in pattern_ids:
                    try:
                        pattern_hits.update([int(pattern_id)])
                    except (TypeError, ValueError):
                        logger.warning("Ignoring invalid pattern ID in transaction history: %r", pattern_id)

        if not pattern_hits:
            return []

        pattern_master = {
            pattern.id: pattern
            for pattern in db.query(FraudPattern).filter(FraudPattern.is_deleted == False).all()
        }
        result = []
        for pattern_id, count in pattern_hits.most_common(5):
            pattern = pattern_master.get(pattern_id)
            if not pattern:
                continue
            result.append({
                "pattern_id": pattern.id,
                "pattern_name": pattern.pattern_name,
                "category": pattern.pattern_category,
                "risk_score": pattern.risk_score,
                "count": count,
            })
        return result
    
    @staticmethod
    def get_alert_trend(db: Session):
        last_7_days = datetime.now(timezone.utc) - timedelta(days=7)
        data = db.query(
            func.date(FraudAlert.created_at).label("date"), func.count(FraudAlert.id)
        ).filter(FraudAlert.created_at >= last_7_days).group_by("date").order_by("date").all()
        return {"labels": [str(d[0]) for d in data], "datasets": [{"label": "Alerts", "data": [d[1] for d in data]}]}

    @staticmethod
    @log_performance
    def get_system_health(db: Session):
        services = HealthCheckService.get_all_services(db)
        total = len(services)
        operational = len([s for s in services if s["status"] == "OPERATIONAL"])
        degraded = len([s for s in services if s["status"] == "DEGRADED"])
        down = len([s for s in services if s["status"] == "DOWN"])

        overall = "DOWN" if down > 0 else "DEGRADED" if degraded > 0 else "OPERATIONAL"
        avg_latency = int(sum([s["latency"] or 0 for s in services]) / total) if total > 0 else 0

        return {
            "summary": {"status": overall, "uptime": None, "avg_latency": avg_latency},
            "counts": {"operational": operational, "degraded": degraded, "down": down},
            "updated_at": datetime.now(timezone.utc),
            "services": services
        }
    
    @staticmethod
    @log_performance
    def get_activity_timeline(db: Session, type: str = None):
        timeline = []
        fraud_trx = TransactionRepository(db).get_recent_fraud(limit=20)
        alerts = db.query(FraudAlert).filter(FraudAlert.status == "OPEN")\
                   .order_by(FraudAlert.created_at.desc()).limit(20).all()
        reviews = db.query(ManualReview).options(joinedload(ManualReview.admin))\
                    .order_by(ManualReview.created_at.desc()).limit(20).all()
        logs = db.query(ActivityLog).options(joinedload(ActivityLog.admin))\
                 .order_by(ActivityLog.created_at.desc()).limit(20).all()

        for t in fraud_trx:
            timeline.append({
                "type": TimelineTypeEnum.TIMELINE_FRAUD.value, 
                "title": "Transaction Confirmed as Fraud",
                "description": f"Transaction {t.original_trx_id} is marked as fraud",
                "created_at": t.created_at,
                "time": format_time(t.created_at),
                "actor": "System",
                "severity": SeverityLevelEnum.CRITICAL.value,  
                "source": EventSourceEnum.PATTERN_ENGINE.value, 
                "metadata": {"amount": f"Rp {t.amount}" if t.amount else "-", "user": t.user_account_id or "-"}
            })

        for a in alerts:
            timeline.append({
                "type": TimelineTypeEnum.TIMELINE_ALERT.value, 
                "title": a.title or "Fraud Alert Triggered",
                "description": a.message,
                "created_at": a.created_at,
                "time": format_time(a.created_at),
                "actor": "System",
                "severity": a.severity if a.severity else SeverityLevelEnum.HIGH.value, 
                "source": EventSourceEnum.RULE_ENGINE.value, 
                "metadata": {"alert_id": a.id}
            })

        for r in reviews:
            rev_severity = SeverityLevelEnum.HIGH.value if r.decision == "FRAUD" else SeverityLevelEnum.INFO.value
            timeline.append({
                "type": TimelineTypeEnum.TIMELINE_REVIEW.value, 
                "title": f"Transaction Marked as {r.decision.capitalize()}",
                "description": f"Trx ID {r.transaction_id} resolved by investigator",
                "created_at": r.created_at,
                "time": format_time(r.created_at), 
                "actor": r.admin.full_name if r.admin else f"Analyst ID {r.reviewer_id}", 
                "severity": rev_severity,
                "source": EventSourceEnum.MANUAL_REVIEW.value,
                "metadata": {"decision": r.decision, "note": r.review_note}
            })

        for log in logs:
            timeline.append({
                "type": TimelineTypeEnum.TIMELINE_SECURITY.value if log.module_source == "AUTH" else TimelineTypeEnum.TIMELINE_SYSTEM.value,
                "title": log.action_type.replace("_", " ").title() if log.action_type else "System Security Event",
                "description": str(log.details) if log.details else "-",
                "created_at": log.created_at,
                "time": format_time(log.created_at),
                "actor": log.admin.full_name if log.admin else "System/Autonomous",
                "severity": log.severity if log.severity else SeverityLevelEnum.INFO.value, 
                "source": log.module_source if log.module_source else EventSourceEnum.SYSTEM.value, 
                "metadata": {"target_type": log.target_type, "target_id": log.target_id}
            })


        timeline.sort(key=lambda x: x["created_at"], reverse=True)
        if type:
            aliases = {
                "FRAUD": TimelineTypeEnum.TIMELINE_FRAUD.value,
                "FRAUD_DETECTED": TimelineTypeEnum.TIMELINE_FRAUD.value,
                "ALERT": TimelineTypeEnum.TIMELINE_ALERT.value,
                "REVIEW": TimelineTypeEnum.TIMELINE_REVIEW.value,
                "MANUAL_REVIEW": TimelineTypeEnum.TIMELINE_REVIEW.value,
                "SECURITY": TimelineTypeEnum.TIMELINE_SECURITY.value,
                "SYSTEM": TimelineTypeEnum.TIMELINE_SYSTEM.value,
            }
            normalized_type = aliases.get(type.upper(), type.upper())
            timeline = [t for t in timeline if t["type"] == normalized_type]

        for t in timeline:
            del t["created_at"]

        return timeline[:20]
