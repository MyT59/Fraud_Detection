import asyncio
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import func
from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.application.services.activity_log_service import log_activity
from app.presentation.schemas.alert_schema import AlertResponse
from app.domain.entities.target_type import TargetType
from sqlalchemy.orm import joinedload

from app.infrastructure.repositories.alert_repository import AlertRepository
from app.application.services.notification_service import should_send_fraud_alert
from app.infrastructure.repositories.admin_repository import AdminRepository

from app.infrastructure.realtime.redis_pubsub import redis_service
from app.presentation.websocket.connection_manager import manager

# ==========================================
# 🔥 1. HELPER FUNCTIONS (DI LUAR FUNGSI)
# ==========================================

def format_badge(severity):
    return {
        "HIGH": "HIGH RISK",
        "MEDIUM": "MEDIUM RISK",
        "LOW": "LOW RISK"
    }.get(severity, "UNKNOWN")


def format_title(alert):
    if getattr(alert, "alert_type", None) == "RULE":
        return "Rule Engine Triggered"
    elif getattr(alert, "alert_type", None) == "PATTERN":
        return "Fraud Detected"
    elif getattr(alert, "alert_type", None) == "COMBINED":
        return "Fraud & Rule Triggered"
    return alert.title or "Alert"


def format_trx_id(alert):
    service = alert.transaction.service_source if alert.transaction else "UNKNOWN"
    prefix = "AGN" if service == "AGENUSA" else "NUS"
    return f"{prefix}-{str(alert.transaction_id).zfill(6)}"


def format_time(dt):
    if not dt:
        return "unknown"

    diff = datetime.now(timezone.utc) - dt.replace(tzinfo=None)
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

# ==========================================
# 🔥 2. SERVICES
# ==========================================

async def create_alert(db, trx):

    # 1️⃣ HELPER LOKAL UNTUK FORMAT DATA
    def determine_alert_type(trx):
        reason = trx.violation_reason or ""
        has_rule = "RULE:" in reason
        has_pattern = "PATTERN:" in reason

        if has_rule and has_pattern:
            return "COMBINED"
        elif has_rule:
            return "RULE"
        elif has_pattern:
            return "PATTERN"
        else:
            return "UNKNOWN"
    
    def format_message(reason: str):
        if not reason:
            return "No suspicious activity detected"

        parts = reason.split(" | ")
        readable = []

        for p in parts:
            if p.startswith("RULE:"):
                readable.append(p.replace("RULE:", "Rule Triggered: "))
            elif p.startswith("PATTERN:"):
                readable.append(p.replace("PATTERN:", "Pattern Detected: "))

        return "User triggered suspicious behaviors:\n- " + "\n- ".join(readable)

    # 2️⃣ SIMPAN ALERT KE DATABASE
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
    db.flush() # Flush agar id dari alert di-generate tanpa commit keseluruhan

    # 3️⃣ LOGGING AKTIVITAS (CREATE ALERT)
    log_activity(
        db=db,
        admin=None,
        action_type="CREATE_ALERT",
        target_type=TargetType.ALERT,
        target_id=alert.id,  
        details=f"Alert created for transaction {trx.id}"
    )

    # 4️⃣ SIAPKAN PAYLOAD UNTUK REDIS (RICH EVENT)
    prefix = "AGN" if trx.service_source == "AGENUSA" else "NUS"
    
    redis_payload = {
        "type": "DASHBOARD_PARTIAL_UPDATE",
        
        # Data Alert Baru untuk list/table recent alerts
        "alert": {
            "id": alert.id,
            "title": alert.title,
            "description": alert.message,
            "severity": alert.severity,
            "badge": alert.severity,
            "color": "dark-red" if alert.severity == "CRITICAL" else ("red" if alert.severity == "HIGH" else "yellow"),
            "trx_id": f"{prefix}-{str(alert.transaction_id).zfill(6)}",
            "time": "just now",
            "type": getattr(alert, "alert_type", "UNKNOWN"),
            "icon": "fraud" if alert.severity in ["CRITICAL", "HIGH"] else "warning"
        },
        
        # Data Delta untuk mengubah angka KPI secara instan di UI
        "kpi_delta": {
            "total_transactions": 1,
            "total_fraud": 1 if trx.final_status == "FRAUD" else 0,
            "fraud_agenusa": 1 if trx.service_source == "AGENUSA" and trx.final_status == "FRAUD" else 0,
            "fraud_nusabill": 1 if trx.service_source == "NUSABILL" and trx.final_status == "FRAUD" else 0
        },
        
        # Data untuk Activity Timeline di Dashboard
        "timeline": {
            "type": "FRAUD" if trx.final_status == "FRAUD" else "SUSPICIOUS",
            "title": f"Fraud Confirmed — {trx.original_trx_id}" if trx.final_status == "FRAUD" else f"Alert Triggered — {trx.original_trx_id}",
            "description": trx.violation_reason,
            "time": "just now",
            "actor": "System"
        }
    }

    # 5️⃣ PUBLISH KE REDIS PUB/SUB (Broadcast Scalable)
    await redis_service.publish(
        "dashboard",
        {
            "type": "DASHBOARD_PARTIAL_UPDATE",

            "alert": {
                "id": alert.id,
                "title": alert.title,
                "description": alert.message,
                "severity": alert.severity,
                "badge": alert.severity,
                "color": "red",
                "trx_id": f"AGN-{str(alert.transaction_id).zfill(6)}",
                "time": "just now",
                "type": alert.alert_type,
                "icon": "fraud"
            },

            "kpi_delta": {
                "total_agenusa": 1 if trx.service_source == "AGENUSA" else 0,
                "total_nusabill": 1 if trx.service_source == "NUSABILL" else 0,
                "fraud_agenusa": 1 if trx.service_source == "AGENUSA" and trx.final_status == "FRAUD" else 0,
                "fraud_nusabill": 1 if trx.service_source == "NUSABILL" and trx.final_status == "FRAUD" else 0
            },

            "timeline": {
                "title": f"Fraud Detected — {trx.original_trx_id}",
                "description": alert.message,
                "severity": alert.severity,
                "time": str(datetime.now(timezone.utc)),
                "actor": "System"
            }
        }
    )

    # 6️⃣ LOGGING AKTIVITAS NOTIFIKASI
    log_activity(
        db=db,
        admin=None,
        action_type="FRAUD_ALERT_NOTIFICATION",
        target_type=TargetType.ALERT,
        target_id=alert.id,
        details=f"Fraud alert payload published to Redis for {trx.original_trx_id}"
    )

def get_all_alerts(
    db,
    status: str = None,
    severity: str = None,
    service: str = None,
    page: int = 1,
    limit: int = 10
):
    alert_repo = AlertRepository(db)
    query = alert_repo.get_query().options(
        joinedload(FraudAlert.transaction)
    ).join(Transaction)

    # =========================
    # FILTER
    # =========================
    if status:
        query = query.filter(FraudAlert.status == status.upper())

    if severity:
        query = query.filter(FraudAlert.severity == severity.upper())

    if service:
        query = query.filter(Transaction.service_source == service.upper())

    # =========================
    # PAGINATION
    # =========================
    total = query.count()

    alerts = query.order_by(FraudAlert.priority.desc()) \
        .offset((page - 1) * limit) \
        .limit(limit) \
        .all()

    # =========================
    # RESPONSE HYBRID FE READY
    # =========================
    return {
        "page": page,
        "limit": limit,
        "total": total,
        "data": [
            {
                # =========================
                # CORE (RAW DATA)
                # =========================
                "id": a.id,
                "transaction_id": a.transaction_id,
                "service": a.transaction.service_source if a.transaction else "UNKNOWN",
                "severity": a.severity,
                "priority": a.priority or 0,
                "status": a.status,
                "created_at": a.created_at,

                # =========================
                # RAW TEXT (flexible)
                # =========================
                "title_raw": a.title,
                "message_raw": a.message,

                # =========================
                # UI READY (langsung FE pakai)
                # =========================
                "title": format_title(a),
                "description": a.message,
                "badge": format_badge(a.severity),
                "trx_id": format_trx_id(a),
                "time": format_time(a.created_at),

                # =========================
                # OPTIONAL (UI ENHANCEMENT)
                # =========================
                "type": getattr(a, "alert_type", "UNKNOWN"),
                "icon": "fraud" if a.severity == "HIGH" else "warning"
            }
            for a in alerts
        ]
    }

def get_open_alert_count(db):
    return db.query(FraudAlert).filter(FraudAlert.status == "OPEN").count()

def get_alert_metrics_service(db):
    total = db.query(func.count(FraudAlert.id)).scalar()

    open_count = db.query(func.count(FraudAlert.id)).filter(
        FraudAlert.status == "OPEN"
    ).scalar()

    in_progress = db.query(func.count(FraudAlert.id)).filter(
        FraudAlert.status == "IN_PROGRESS"
    ).scalar()

    resolved = db.query(func.count(FraudAlert.id)).filter(
        FraudAlert.status == "RESOLVED"
    ).scalar()

    fraud_count = db.query(func.count(Transaction.id)).filter(
        Transaction.final_status == "FRAUD"
    ).scalar()

    avg_response_time = db.query(
        func.avg(
            func.extract('epoch', FraudAlert.resolved_at - FraudAlert.created_at)
        )
    ).filter(
        FraudAlert.status == "RESOLVED",
        FraudAlert.resolved_at.isnot(None)
    ).scalar()

    avg_response_minutes = round((avg_response_time or 0) / 60, 2)

    return {
        "total_alerts": total or 0,
        "open_alerts": open_count or 0,
        "in_progress_alerts": in_progress or 0,
        "resolved_alerts": resolved or 0,
        "fraud_alerts": fraud_count or 0,
        "avg_response_time_minutes": avg_response_minutes
    }

def get_alert_detail_service(db, alert_id):
    alert = db.query(FraudAlert).options(
        joinedload(FraudAlert.transaction)
    ).filter(FraudAlert.id == alert_id).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return {
        "id": alert.id,
        "transaction_id": alert.transaction_id,
        "severity": alert.severity,
        "status": alert.status,
        "title": alert.title,
        "message": alert.message,
        "created_at": alert.created_at,
        "resolved_at": alert.resolved_at,
        "resolved_by": alert.resolved_by,
    }

def update_alert_status_service(db, alert_id, status, user_id):
    alert = db.query(FraudAlert).filter(FraudAlert.id == alert_id).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    target_status = status.upper()

    allowed_statuses = ["OPEN", "IN_PROGRESS", "RESOLVED"]
    if target_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed_statuses}")

    valid_transition = {
        "OPEN": ["IN_PROGRESS", "RESOLVED"],
        "IN_PROGRESS": ["RESOLVED"],
        "RESOLVED": []
    }

    if target_status not in valid_transition.get(alert.status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from {alert.status} to {target_status}"
        )

    alert.status = target_status

    if target_status == "RESOLVED":
        alert.resolved_at = func.now()
        alert.resolved_by = int(user_id)

    db.commit()
    db.refresh(alert)

    asyncio.create_task(redis_service.publish(
        "dashboard",
        {
            "type": "ALERT_UPDATED",
            "alert_id": alert.id,
            "status": alert.status
        }
    ))

    return {
        "message": "Alert status updated successfully",
        "alert_id": alert.id,
        "new_status": alert.status,
        "resolved_by": alert.resolved_by,
        "resolved_at": alert.resolved_at
    }