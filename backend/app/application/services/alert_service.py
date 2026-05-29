import asyncio
from datetime import datetime, timezone
from fastapi import HTTPException, BackgroundTasks
from typing import Optional
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
import logging

from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.infrastructure.database.models.admin_model import Admin 
from app.application.services.activity_log_service import log_activity
from app.presentation.schemas.alert_schema import AlertResponse
from app.domain.entities.target_type import TargetType
from sqlalchemy.orm import joinedload

from app.infrastructure.repositories.alert_repository import AlertRepository
from app.application.services.notification_service import should_send_fraud_alert
from app.infrastructure.repositories.admin_repository import AdminRepository
from app.infrastructure.database.enums import TransactionStatusEnum

from app.infrastructure.realtime.redis_pubsub import redis_service
from app.presentation.websocket.connection_manager import manager
from app.infrastructure.repositories.transaction_repository import TransactionRepository

# ENUM STANDAR V1
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def format_badge(severity):
    return {
        "HIGH": "HIGH RISK",
        "MEDIUM": "MEDIUM RISK",
        "LOW": "LOW RISK"
    }.get(severity, "UNKNOWN")


def get_priority_label(priority: float) -> str:
    if priority >= 90: return "CRITICAL"
    elif priority >= 75: return "HIGH"
    elif priority >= 50: return "MEDIUM"
    return "LOW"


def format_title(alert):
    if getattr(alert, "alert_type", None) == "RULE": return "Rule Engine Triggered"
    elif getattr(alert, "alert_type", None) == "PATTERN": return "Fraud Detected"
    elif getattr(alert, "alert_type", None) == "COMBINED": return "Fraud & Rule Triggered"
    return alert.title or "Alert"


def format_trx_id(alert):
    service = alert.transaction.service_source if alert.transaction else "UNKNOWN"
    prefix = "AGN" if service == "AGENUSA" else "NUS"
    return f"{prefix}-{str(alert.transaction_id).zfill(6)}"


def format_time(dt):
    if not dt: return "unknown"
    diff = datetime.now(timezone.utc) - dt.astimezone(timezone.utc)
    minutes = int(diff.total_seconds() / 60)
    if minutes < 1: return "just now"
    if minutes < 60: return f"{minutes} minutes ago"
    hours = minutes // 60
    if hours < 24: return f"{hours} hours ago"
    days = hours // 24
    return f"{days} days ago"

def safe_redis_publish(payload: dict, task_type: str = "ALERT_UPDATED"):
    """
    Helper untuk mengirim data ke Redis secara aman.
    Jika Redis belum terkoneksi, sistem tidak akan crash atau membanjiri log terminal.
    """
    try:
        redis_service.publish("dashboard", payload)
    except Exception as e:
        logger.warning(f"[REDIS OFFLINE] Gagal mengirim broadcast {task_type}. Keperluan realtime stream dilewati.")
        logger.debug(f"Payload yang gagal dikirim: {payload}")

def create_alert(
    db,
    trx,
    background_tasks: Optional[BackgroundTasks] = None
):

    def determine_alert_type(trx):
        reason = trx.violation_reason or ""
        has_rule = "RULE:" in reason
        has_pattern = "PATTERN:" in reason
        if has_rule and has_pattern: return "COMBINED"
        elif has_rule: return "RULE"
        elif has_pattern: return "PATTERN"
        return "UNKNOWN"
    
    def format_message(reason: str):
        if not reason: return "No suspicious activity detected"
        parts = reason.split(" | ")
        readable = []
        for p in parts:
            if p.startswith("RULE:"): readable.append(p.replace("RULE:", "Rule Triggered: "))
            elif p.startswith("PATTERN:"): readable.append(p.replace("PATTERN:", "Pattern Detected: "))
        return "User triggered suspicious behaviors:\n- " + "\n- ".join(readable)

    alert = FraudAlert(
        transaction_id=trx.id,
        alert_type=determine_alert_type(trx),
        severity=trx.risk_level,
        priority=(trx.risk_score or 0) + (10 if trx.final_status == "FRAUD" else 0),
        title="Fraud Detected",
        message=format_message(trx.violation_reason),
        status="OPEN"
    )

    alert_repo = AlertRepository(db)
    alert_repo.create(alert)
    db.flush()

    alert_severity = {
        "CRITICAL": SeverityLevelEnum.CRITICAL,
        "HIGH": SeverityLevelEnum.HIGH,
        "MEDIUM": SeverityLevelEnum.WARNING,
        "LOW": SeverityLevelEnum.INFO
    }.get(trx.risk_level, SeverityLevelEnum.WARNING)

    log_activity(
        db=db,
        admin=None, 
        action_type=ActivityActionEnum.ALERT_CREATED,
        module_source=EventSourceEnum.SYSTEM,
        severity=alert_severity,
        target_type=TargetType.ALERT,
        target_id=alert.id,  
        details={"transaction_id": trx.id, "risk_score": trx.risk_score, "message": "Alert created successfully by system engine"}
    )

    prefix = "AGN" if trx.service_source == "AGENUSA" else "NUS"
    
    if background_tasks:
        background_tasks.add_task(
            safe_redis_publish,
            {
                "type": "DASHBOARD_PARTIAL_UPDATE",
                "alert": {
                    "id": alert.id, "title": alert.title, "description": alert.message, "severity": alert.severity,
                "badge": alert.severity, "color": "dark-red" if alert.severity == "CRITICAL" else ("red" if alert.severity == "HIGH" else "yellow"),
                "trx_id": f"{prefix}-{str(alert.transaction_id).zfill(6)}", "time": "just now",
                "type": getattr(alert, "alert_type", "UNKNOWN"), "icon": "fraud" if alert.severity in ["CRITICAL", "HIGH"] else "warning"
            },
            "kpi_delta": {
                "total_transactions": 1, "total_fraud": 1 if trx.final_status == "FRAUD" else 0,
                "fraud_agenusa": 1 if trx.service_source == "AGENUSA" and trx.final_status == "FRAUD" else 0,
                "fraud_nusabill": 1 if trx.service_source == "NUSABILL" and trx.final_status == "FRAUD" else 0
            },
            "timeline": {
                "type": "FRAUD" if trx.final_status == "FRAUD" else "SUSPICIOUS",
                "title": f"Fraud Confirmed — {trx.original_trx_id}" if trx.final_status == "FRAUD" else f"Alert Triggered — {trx.original_trx_id}",
                "description": trx.violation_reason, "time": str(datetime.now(timezone.utc)), "actor": "System"
            }
        },
        task_type="ALERT_CREATED" 
    )


def get_all_alerts(db, status: str = None, severity: str = None, service: str = None, priority: str = None, page: int = 1, limit: int = 10):
    alert_repo = AlertRepository(db)
    query = alert_repo.get_query().options(joinedload(FraudAlert.transaction)).join(Transaction)

    if status: query = query.filter(FraudAlert.status == status.upper())
    if severity: query = query.filter(FraudAlert.severity == severity.upper())
    if service: query = query.filter(Transaction.service_source == service.upper())
    if priority:
        label = priority.upper()
        if label == "CRITICAL": query = query.filter(FraudAlert.priority >= 90)
        elif label == "HIGH": query = query.filter(FraudAlert.priority >= 75, FraudAlert.priority < 90)
        elif label == "MEDIUM": query = query.filter(FraudAlert.priority >= 50, FraudAlert.priority < 75)
        elif label == "LOW": query = query.filter(FraudAlert.priority < 50)

    total = query.count()
    alerts = query.order_by(FraudAlert.priority.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "items": [  
            {
                "id": a.id, "transaction_id": a.transaction_id,
                "service": a.transaction.service_source if a.transaction else "UNKNOWN",
                "severity": a.severity, "priority": a.priority or 0, "status": a.status, "created_at": a.created_at,
                "title_raw": a.title, "message_raw": a.message, "title": format_title(a), "description": a.message,
                "badge": format_badge(a.severity), "trx_id": format_trx_id(a), "time": format_time(a.created_at),
                "type": getattr(a, "alert_type", "UNKNOWN"), "icon": "fraud" if a.severity == "HIGH" else "warning"
            }
            for a in alerts
        ]
    }


def get_open_alert_count(db):
    return db.query(FraudAlert).filter(FraudAlert.status == "OPEN").count()


def get_alert_metrics_service(db):
    total = db.query(func.count(FraudAlert.id)).scalar()
    open_count = db.query(func.count(FraudAlert.id)).filter(FraudAlert.status == "OPEN").scalar()
    in_progress = db.query(func.count(FraudAlert.id)).filter(FraudAlert.status == "IN_PROGRESS").scalar()
    resolved = db.query(func.count(FraudAlert.id)).filter(FraudAlert.status == "RESOLVED").scalar()
    fraud_count = db.query(func.count(Transaction.id)).filter(Transaction.final_status == "FRAUD").scalar()
    avg_response_time = db.query(func.avg(func.extract('epoch', FraudAlert.resolved_at - FraudAlert.created_at))).filter(FraudAlert.status == "RESOLVED", FraudAlert.resolved_at.isnot(None)).scalar()
    avg_response_minutes = round((avg_response_time or 0) / 60, 2)

    return {
        "total_alerts": total or 0, "open_alerts": open_count or 0, "in_progress_alerts": in_progress or 0,
        "resolved_alerts": resolved or 0, "fraud_alerts": fraud_count or 0, "avg_response_time_minutes": avg_response_minutes
    }


def get_alert_detail_service(db, alert_id):
    alert = db.query(FraudAlert).options(joinedload(FraudAlert.transaction)).filter(FraudAlert.id == alert_id).first()
    if not alert: raise HTTPException(status_code=404, detail="Alert not found")
    return {
        "id": alert.id, "transaction_id": alert.transaction_id, "severity": alert.severity, "status": alert.status,
        "title": alert.title, "message": alert.message, "created_at": alert.created_at, "resolved_at": alert.resolved_at, "resolved_by": alert.resolved_by,
    }


def update_alert_status_service(db, alert_id, status, user_id, background_tasks: BackgroundTasks):
    alert = db.query(FraudAlert).filter(FraudAlert.id == alert_id).first()
    if not alert: raise HTTPException(status_code=404, detail="Alert not found")

    target_status = status.upper()
    allowed_statuses = ["OPEN", "IN_PROGRESS", "RESOLVED"]
    if target_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed_statuses}")

    valid_transition = {"OPEN": ["IN_PROGRESS", "RESOLVED"], "IN_PROGRESS": ["RESOLVED"], "RESOLVED": []}
    if target_status not in valid_transition.get(alert.status, []):
        raise HTTPException(status_code=400, detail=f"Invalid status transition from {alert.status} to {target_status}")

    if target_status == "IN_PROGRESS":
         raise HTTPException(status_code=400, detail="Use the dedicated /claim endpoint to set alert to IN_PROGRESS")

    alert.status = target_status
    if target_status == "RESOLVED":
        alert.resolved_at = func.now()
        alert.resolved_by = int(user_id)

    db.commit()
    db.refresh(alert)

    background_tasks.add_task(
        safe_redis_publish, 
        {"type": "ALERT_UPDATED", "alert_id": alert.id, "status": alert.status},
        task_type="ALERT_STATUS_UPDATED"
    )
    return {"message": "Alert status updated successfully", "alert_id": alert.id, 
            "new_status": alert.status, "resolved_by": alert.resolved_by, 
            "resolved_at": alert.resolved_at}


# ==========================================
# 🔥 INVESTIGATION WORKFLOW HARDENING
# ==========================================
def claim_alert_service(db, alert_id, admin_id, background_tasks: BackgroundTasks):
    alert = db.query(FraudAlert).filter(FraudAlert.id == alert_id).with_for_update().first()
    if not alert: raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status != "OPEN": raise HTTPException(status_code=400, detail=f"Cannot claim alert. Current status is {alert.status}")
    if alert.claimed_by:
        if alert.claimed_by == admin_id: return {"message": "You have already claimed this alert"}
        raise HTTPException(status_code=400, detail=f"Alert is already claimed by user_id {alert.claimed_by}")

    alert.claimed_by = admin_id
    alert.claimed_at = datetime.now(timezone.utc)
    alert.status = "IN_PROGRESS"
    trx_repo = TransactionRepository(db)
    trx = trx_repo.get_by_id(alert.transaction_id)
    if trx: trx.final_status = TransactionStatusEnum.UNDER_REVIEW
    actor_admin = db.query(Admin).filter(Admin.id == admin_id).first()

    log_activity(
        db=db,
        admin=actor_admin,
        action_type=ActivityActionEnum.ALERT_CLAIMED,
        module_source=EventSourceEnum.MANUAL_REVIEW,
        severity=SeverityLevelEnum.INFO,
        target_type=TargetType.ALERT,
        target_id=alert.id,
        details={"claimed_by_id": admin_id, "transaction_id": alert.transaction_id, "status": "INVESTIGATION_STARTED"}
    )
    db.commit()
    db.refresh(alert)

    payload = {"event": "ALERT_CLAIMED", "alert_id": alert.id, "claimed_by": admin_id, "message": "..."}
    background_tasks.add_task(safe_redis_publish, payload, task_type="ALERT_CLAIMED")
    return {"message": "Alert successfully claimed", "alert_id": alert.id}
 
def release_alert_service(db, alert_id, admin_id, user_role="FRAUD_ANALYST"):
    alert = db.query(FraudAlert).filter(FraudAlert.id == alert_id).with_for_update().first()
    if not alert: raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status != "IN_PROGRESS": raise HTTPException(status_code=400, detail=f"Cannot release alert. Current status is {alert.status}")
    if alert.claimed_by != admin_id and user_role not in ["SUPER_ADMIN", "RISK_MANAGER"]:
         raise HTTPException(status_code=403, detail="You do not have permission to release this alert")

    old_owner = alert.claimed_by
    alert.claimed_by = None
    alert.claimed_at = None
    alert.status = "OPEN"
    trx_repo = TransactionRepository(db)
    trx = trx_repo.get_by_id(alert.transaction_id)
    if trx: trx.final_status = TransactionStatusEnum.PENDING
    actor_admin = db.query(Admin).filter(Admin.id == admin_id).first()

    log_activity(
        db=db,
        admin=actor_admin,
        action_type=ActivityActionEnum.ALERT_RELEASED,
        module_source=EventSourceEnum.MANUAL_REVIEW,
        severity=SeverityLevelEnum.WARNING, 
        target_type=TargetType.ALERT,
        target_id=alert.id,
        details={"released_by_id": admin_id, "previous_owner_id": old_owner,
                  "transaction_id": alert.transaction_id}
    )

    db.commit()
    db.refresh(alert)
    return {"message": "Alert successfully released", "alert_id": alert.id}


def get_my_queue_service(db, user_id: int):
    alert_repo = AlertRepository(db)
    alerts = alert_repo.get_claimed_by_user(user_id)
    return [
        {
            "id": a.id, "transaction_id": a.transaction_id, "severity": a.severity, "priority": a.priority or 0,
            "priority_label": get_priority_label(a.priority or 0), "status": a.status, "title": format_title(a),
            "description": a.message, "badge": format_badge(a.severity), "trx_id": format_trx_id(a),
            "time": format_time(a.created_at), "claimed_at": format_time(a.claimed_at), "type": getattr(a, "alert_type", "UNKNOWN"),
        }
        for a in alerts
    ]


def get_open_queue_service(db, priority_label: str = None, limit: int = 50):
    alert_repo = AlertRepository(db)
    alerts = alert_repo.get_open_queue(priority_label=priority_label, limit=limit)
    return [
        {
            "id": a.id, "transaction_id": a.transaction_id, "service": a.transaction.service_source if a.transaction else "UNKNOWN",
            "severity": a.severity, "priority": a.priority or 0, "priority_label": get_priority_label(a.priority or 0), 
            "status": a.status, "created_at": a.created_at, "title": format_title(a), "description": a.message,
            "badge": format_badge(a.severity), "trx_id": format_trx_id(a), "time": format_time(a.created_at),
            "type": getattr(a, "alert_type", "UNKNOWN"), "icon": "fraud" if a.severity in ["CRITICAL", "HIGH"] else "warning"
        }
        for a in alerts
    ]


def get_priority_distribution_service(db):
    alert_repo = AlertRepository(db)
    return alert_repo.get_priority_distribution()