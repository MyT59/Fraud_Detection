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

def get_safe_alert_type(alert):
    """Fungsi penyelamat: Membaca ulang tipe jika di DB terlanjur tersimpan UNKNOWN"""
    atype = getattr(alert, "alert_type", "UNKNOWN")
    if atype == "UNKNOWN" and alert.transaction:
        reason = alert.transaction.violation_reason or ""
        if "COMBINED_ML" in reason: return "COMBINED_ML"
        if "RULE_ML" in reason: return "RULE_ML"
        if "PATTERN_ML" in reason: return "PATTERN_ML"
        if "BLACKLIST:" in reason: return "BLACKLIST"
        if "RULE:" in reason: return "RULE"
        if "PATTERN:" in reason: return "PATTERN"
        if "ML:" in reason: return "ML"
    return atype

def format_title(alert):
    """Menentukan judul dinamis di Frontend"""
    atype = get_safe_alert_type(alert)
    
    if atype == "RULE": return "Rule Engine Triggered"
    elif atype == "PATTERN": return "Pattern Engine Triggered"
    elif atype == "ML": return "ML Anomaly Detected"
    elif atype == "COMBINED": return "Fraud & Rule Triggered"
    elif atype == "BLACKLIST": return "Blacklist Hit Detected"
    
    # 🚀 TAMBAHAN BARU UNTUK KOMBINASI ML ENGINE
    elif atype == "COMBINED_ML": return "Fraud & ML Anomaly Detected"
    elif atype == "RULE_ML": return "Rule + ML Anomaly Detected"
    elif atype == "PATTERN_ML": return "Pattern + ML Anomaly Detected"
    
    return alert.title or "System Alert"


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
        has_blacklist = "BLACKLIST:" in reason

        # ML Runtime
        if getattr(trx, "is_flagged_ml", False):
            if has_rule and has_pattern:
                return "COMBINED_ML"

            elif has_rule:
                return "RULE_ML"

            elif has_pattern:
                return "PATTERN_ML"

            return "ML"

        if has_rule and has_pattern:
            return "COMBINED"
        elif has_blacklist:
            return "BLACKLIST"
        elif has_rule:
            return "RULE"
        elif has_pattern:
            return "PATTERN"
            

        return "SYSTEM"
    
    def format_message(reason: str):
        if not reason: return "No suspicious activity detected"
        parts = reason.split(" | ")
        readable = []
        for p in parts:
            if p.startswith("RULE:"): readable.append(p.replace("RULE:", "Rule Triggered: "))
            elif p.startswith("PATTERN:"): readable.append(p.replace("PATTERN:", "Pattern Detected: "))
        return "User triggered suspicious behaviors:\n- " + "\n- ".join(readable)

    alert_type = determine_alert_type(trx)

    title_mapping = {
        "RULE": "Rule Engine Triggered",
        "PATTERN": "Pattern Engine Triggered",
        "ML": "ML Anomaly Detected",
        "COMBINED": "Fraud & Rule Triggered",
        "BLACKLIST": "Blacklist Hit Detected",
        "COMBINED_ML": "Fraud & ML Anomaly Detected",
        "RULE_ML": "Rule + ML Anomaly Detected",
        "PATTERN_ML": "Pattern + ML Anomaly Detected",
    }

    alert = FraudAlert(
        transaction_id=trx.id,
        alert_type=alert_type,
        severity=trx.risk_level,
        priority=(trx.risk_score or 0) + (10 if trx.final_status == "FRAUD" else 0),
        title=title_mapping.get(alert_type, "System Alert"),
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


def get_all_alerts(db, status: str = None, severity: str = None, service: str = None, priority: str = None, page: int = 1, limit: int = 10, alert_type: str = None):
    alert_repo = AlertRepository(db)
    query = alert_repo.get_query().options(joinedload(FraudAlert.transaction)).join(Transaction)

    if status: query = query.filter(FraudAlert.status == status.upper())
    if severity: query = query.filter(FraudAlert.severity == severity.upper())
    
    # 🚀 LOGIKA FILTER BARU UNTUK TIPE ALERT
    if alert_type: query = query.filter(FraudAlert.alert_type == alert_type.upper())
    
    if service: query = query.filter(Transaction.service_source == service.upper())
    if priority:
        label = priority.upper()
        if label == "CRITICAL": query = query.filter(FraudAlert.priority >= 90)
        elif label == "HIGH": query = query.filter(FraudAlert.priority >= 75, FraudAlert.priority < 90)
        elif label == "MEDIUM": query = query.filter(FraudAlert.priority >= 50, FraudAlert.priority < 75)
        elif label == "LOW": query = query.filter(FraudAlert.priority < 50)

    total = query.count()
    # Lanjutannya biarkan sama seperti aslinya...
    alerts = query.order_by(FraudAlert.priority.desc(), FraudAlert.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

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


def get_alert_detail_service(db, alert_id: int):
    alert_repo = AlertRepository(db)
    a = alert_repo.get_by_id(alert_id)
    if not a:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Alert tidak ditemukan")
    
    # 🚀 Ekstrak data ML secara aman dari transaction.score_breakdown
    ml_score = None
    is_anomaly = getattr(a.transaction, "is_flagged_ml", False) if a.transaction else False
    ml_patterns = []

    if a.transaction and a.transaction.score_breakdown:
        breakdown = a.transaction.score_breakdown or {}
        ml_score = breakdown.get("ml_score")
        ml_patterns = breakdown.get("patterns", [])

    txn_data = None
    if a.transaction:
        txn_data = {
            "original_trx_id": a.transaction.original_trx_id,
            "service_source": a.transaction.service_source,
            "amount": float(a.transaction.amount) if a.transaction.amount else 0,
            "account_number": getattr(a.transaction, "account_number", "-"),
            "merchant_id": getattr(a.transaction, "merchant_id", "-"),
            "ip_address": getattr(a.transaction, "ip_address", "-"),
            "risk_score": getattr(a.transaction, "risk_score", 0),
            "violation_reason": getattr(a.transaction, "violation_reason", "-")
        }

    return {
        "id": a.id,
        "transaction_id": a.transaction_id,
        "type": getattr(a, "alert_type", "system").upper(),
        "severity": a.severity.upper() if a.severity else "LOW",
        "priority": a.priority or 0,
        "status": a.status.upper() if a.status else "OPEN",
        "title": format_title(a), # 🚀 Ambil title dinamis agar konsisten di log & detail
        "message": a.message,
        "created_at": a.created_at,
        "claimed_at": a.claimed_at,
        "resolved_at": a.resolved_at,
        "resolved_by": a.resolved_by, 
        
        # 🚀 Suntikkan top-level ML properties
        "ml_score": ml_score,
        "is_anomaly": is_anomaly,
        "ml_patterns": ml_patterns,
        
        "transaction": txn_data
    }


def update_alert_status_service(db, alert_id: int, status: str, user_id: int, background_tasks: BackgroundTasks):
    alert_repo = AlertRepository(db)
    alert = alert_repo.get_by_id(alert_id)
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert tidak ditemukan")

    target_status = status.upper()

    # 🚀 PROTEKSI 1: Analis Biasa WAJIB Claim Dulu
    # Jika alert masih OPEN dan mau di-RESOLVED...
    if alert.status == "OPEN" and target_status == "RESOLVED":
        # Cek role user di database (opsional, tapi disarankan)
        admin_repo = AdminRepository(db)
        user = admin_repo.get_by_id(user_id)
        
        # Asumsikan Role ID 1 adalah Super Admin, Role ID 2 adalah Risk Manager
        # Jika bukan Manager/Admin (misal Role 3: Fraud Analyst), TOLAK!
        if user and user.role_id not in [1, 2]: 
            raise HTTPException(
                status_code=403, 
                detail="Akses Ditolak: Anda harus melakukan 'Claim' terlebih dahulu sebelum dapat menutup kasus ini."
            )

    # 🚀 PROTEKSI 2: Hanya pemilik kasus yang boleh Resolve
    if target_status == "RESOLVED":
        if alert.claimed_by is not None and alert.claimed_by != user_id:
            # Jika user yang mau resolve bukan Super Admin/Risk Manager
             admin_repo = AdminRepository(db)
             user = admin_repo.get_by_id(user_id)
             if user and user.role_id not in [1, 2]:
                raise HTTPException(
                    status_code=403, 
                    detail="Akses Ditolak: Kasus ini sedang dikerjakan oleh analis lain."
                )
        
        alert.resolved_by = user_id
        alert.resolved_at = datetime.now(timezone.utc)

    alert.status = target_status
    db.commit()
    db.refresh(alert)

    # Panggil log activity
    background_tasks.add_task(
        log_activity,
        db=db,
        admin_id=user_id,
        action=ActivityActionEnum.UPDATE,
        target_type=TargetType.ALERT,
        target_id=alert.id,
        description=f"Mengubah status alert menjadi {target_status}"
    )

    return {"message": f"Status alert {alert.id} berhasil diupdate menjadi {target_status}"}


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


def get_my_queue_service(db, user_id: int, page: int = 1, limit: int = 10):
    alert_repo = AlertRepository(db)
    # Ambil semua data list dari repo
    all_alerts = alert_repo.get_my_queue(user_id=user_id)
    
    # 🚀 HITUNG TOTAL DATA ASLI
    total = len(all_alerts)
    
    # 🚀 LAKUKAN SLICING LIST BERDASARKAN PAGE & LIMIT
    start_offset = (page - 1) * limit
    end_offset = start_offset + limit
    paginated_alerts = all_alerts[start_offset:end_offset]

    items = [
        {
            "id": a.id, 
            "transaction_id": a.transaction_id, 
            "service": a.transaction.service_source if a.transaction else "UNKNOWN",
            "severity": a.severity, 
            "priority": a.priority or 0, 
            "priority_label": get_priority_label(a.priority or 0), 
            "status": a.status, 
            "created_at": a.created_at, 
            "title": format_title(a), 
            "message": a.message, 
            "badge": format_badge(a.severity), 
            "trx_id": format_trx_id(a),
            "type": getattr(a, "alert_type", "UNKNOWN") 
        }
        for a in paginated_alerts # Loop menggunakan data yang sudah dipaginasi
    ]

    # 🚀 RETURN SESUAI ARSITEKTUR STRUKTUR BARU
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit
    }


def get_open_queue_service(db, priority_label: str = None, page: int = 1, limit: int = 50):
    # 🚀 Tambahkan parameter page dan limit di parameter fungsi atas
    
    query = db.query(FraudAlert).filter(FraudAlert.status == "OPEN")
    
    if priority_label:
        label = priority_label.upper()
        if label == "CRITICAL": query = query.filter(FraudAlert.priority >= 90)
        elif label == "HIGH": query = query.filter(FraudAlert.priority >= 75, FraudAlert.priority < 90)
        elif label == "MEDIUM": query = query.filter(FraudAlert.priority >= 50, FraudAlert.priority < 75)
        elif label == "LOW": query = query.filter(FraudAlert.priority < 50)

    # 🚀 1. Hitung total antrean OPEN yang tersedia
    total = query.count()
    
    # 🚀 2. Ambil chunk data sesuai halaman aktif analis
    alerts = (
        query
        .order_by(FraudAlert.priority.desc(), FraudAlert.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    
    items = [
        {
            "id": a.id, 
            "transaction_id": a.transaction_id, 
            "service": a.transaction.service_source if a.transaction else "UNKNOWN",
            "severity": a.severity, 
            "priority": a.priority or 0, 
            "priority_label": get_priority_label(a.priority or 0), 
            "status": a.status, 
            "created_at": a.created_at, 
            "title": format_title(a), 
            "message": a.message, 
            "badge": format_badge(a.severity), 
            "trx_id": format_trx_id(a),
            "type": getattr(a, "alert_type", "UNKNOWN")
        }
        for a in alerts
    ]

    # 🚀 3. Return dengan struktur standar arsitektur baru
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit
    }


def get_priority_distribution_service(db):
    alert_repo = AlertRepository(db)
    return alert_repo.get_priority_distribution()