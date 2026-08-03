import time
import asyncio
from datetime import datetime, timezone              # ← hapus 'time' dari sini
from fastapi import HTTPException, BackgroundTasks
from typing import Optional
from sqlalchemy import String, func, or_
from sqlalchemy.exc import IntegrityError

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
from app.infrastructure.database.enums import AlertStatusEnum, TransactionStatusEnum
from app.core.rbac import get_role_name

from app.infrastructure.realtime.redis_pubsub import redis_service
from app.presentation.websocket.connection_manager import manager
from app.infrastructure.repositories.transaction_repository import TransactionRepository

from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)


def format_badge(severity):
    return {
        "CRITICAL": "CRITICAL RISK",
        "HIGH": "HIGH RISK",
        "MEDIUM": "MEDIUM RISK",
        "LOW": "LOW RISK",
    }.get(severity, "UNKNOWN")


def get_priority_label(priority: float) -> str:
    if priority >= 90:   return "CRITICAL"
    elif priority >= 75: return "HIGH"
    elif priority >= 50: return "MEDIUM"
    return "LOW"


def format_alert_message(reason: str | None) -> str:
    """Create a human-readable alert message from persisted engine evidence."""
    if not reason:
        return "No suspicious activity detected"

    readable = []
    for item in reason.split(" | "):
        if item.startswith("RULE:"):
            readable.append(item.replace("RULE:", "Rule Triggered: "))
        elif item.startswith("PATTERN:"):
            readable.append(item.replace("PATTERN:", "Pattern Detected: "))
        elif item.startswith("BLACKLIST:"):
            readable.append(item.replace("BLACKLIST:", "Blacklist Match: "))
        elif item.startswith("ML:"):
            readable.append(item.replace("ML:", "ML Anomaly: "))
        else:
            readable.append(item)
    return "User triggered suspicious behaviors:\n- " + "\n- ".join(readable)


def get_safe_alert_type(alert):
    atype = getattr(alert, "alert_type", "UNKNOWN")
    if atype == "UNKNOWN" and alert.transaction:
        reason = alert.transaction.violation_reason or ""
        if "COMBINED_ML" in reason: return "COMBINED_ML"
        if "RULE_ML" in reason:     return "RULE_ML"
        if "PATTERN_ML" in reason:  return "PATTERN_ML"
        if "BLACKLIST:" in reason:  return "BLACKLIST"
        if "RULE:" in reason:       return "RULE"
        if "PATTERN:" in reason:    return "PATTERN"
        if "ML:" in reason:         return "ML"
    return atype


def format_title(alert):
    atype = get_safe_alert_type(alert)
    if atype == "RULE":          return "Rule Engine Triggered"
    elif atype == "PATTERN":     return "Pattern Engine Triggered"
    elif atype == "ML":          return "ML Anomaly Detected"
    elif atype == "COMBINED":    return "Fraud & Rule Triggered"
    elif atype == "BLACKLIST":   return "Blacklist Hit Detected"
    elif atype == "COMBINED_ML": return "Fraud & ML Anomaly Detected"
    elif atype == "RULE_ML":     return "Rule + ML Anomaly Detected"
    elif atype == "PATTERN_ML":  return "Pattern + ML Anomaly Detected"
    return alert.title or "System Alert"


def format_trx_id(alert):
    service = alert.transaction.service_source if alert.transaction else "UNKNOWN"
    prefix  = "AGN" if service == "AGENUSA" else "NUS"
    return f"{prefix}-{str(alert.transaction_id).zfill(6)}"


def format_time(dt):
    if not dt: return "unknown"
    diff    = datetime.now(timezone.utc) - dt.astimezone(timezone.utc)
    minutes = int(diff.total_seconds() / 60)
    if minutes < 1:  return "just now"
    if minutes < 60: return f"{minutes} minutes ago"
    hours = minutes // 60
    if hours < 24:   return f"{hours} hours ago"
    days  = hours // 24
    return f"{days} days ago"


async def safe_redis_publish(payload: dict, task_type: str = "ALERT_UPDATED"):
    try:
        await redis_service.publish("dashboard", payload)
    except Exception as e:
        logger.warning(f"[REDIS OFFLINE] Gagal mengirim broadcast {task_type}. Keperluan realtime stream dilewati.")
        logger.debug(f"Payload yang gagal dikirim: {payload}")


# ============================================================
# CREATE ALERT — dengan timing detail
# ============================================================
@log_performance(label="AlertService.create_alert")
def create_alert(db, trx, background_tasks: Optional[BackgroundTasks] = None):
    def determine_alert_type(trx):
        reason        = trx.violation_reason or ""
        has_rule      = "RULE:" in reason
        has_pattern   = "PATTERN:" in reason
        has_blacklist = "BLACKLIST:" in reason
        if getattr(trx, "is_flagged_ml", False):
            if has_rule and has_pattern: return "COMBINED_ML"
            elif has_rule:               return "RULE_ML"
            elif has_pattern:            return "PATTERN_ML"
            return "ML"
        if has_rule and has_pattern: return "COMBINED"
        elif has_blacklist:          return "BLACKLIST"
        elif has_rule:               return "RULE"
        elif has_pattern:            return "PATTERN"
        return "SYSTEM"

    alert_type    = determine_alert_type(trx)
    title_mapping = {
        "RULE": "Rule Engine Triggered", "PATTERN": "Pattern Engine Triggered",
        "ML": "ML Anomaly Detected", "COMBINED": "Fraud & Rule Triggered",
        "BLACKLIST": "Blacklist Hit Detected", "COMBINED_ML": "Fraud & ML Anomaly Detected",
        "RULE_ML": "Rule + ML Anomaly Detected", "PATTERN_ML": "Pattern + ML Anomaly Detected",
    }

    # Serialize alert creation per transaction. Tanpa ini, Rule/Pattern dan ML
    # yang berjalan berdekatan bisa masing-masing membuat alert baru.
    db.query(Transaction).filter(Transaction.id == trx.id).with_for_update().one()
    existing_alert = (
        db.query(FraudAlert)
        .filter(FraudAlert.transaction_id == trx.id)
        .first()
    )
    if existing_alert:
        existing_alert.alert_type = alert_type
        existing_alert.severity = trx.risk_level or existing_alert.severity
        existing_alert.priority = max(
            float(existing_alert.priority or 0),
            float((trx.risk_score or 0) + (10 if trx.final_status == TransactionStatusEnum.FRAUD else 0)),
        )
        existing_alert.title = title_mapping.get(alert_type, existing_alert.title or "System Alert")
        existing_alert.message = format_alert_message(trx.violation_reason)
        if "ML" in alert_type:
            existing_alert.is_escalated = True
        db.flush()
        return existing_alert

    alert = FraudAlert(
        transaction_id = trx.id,
        alert_type     = alert_type,
        severity       = trx.risk_level,
        priority       = (trx.risk_score or 0) + (10 if trx.final_status == "FRAUD" else 0),
        title          = title_mapping.get(alert_type, "System Alert"),
        message        = format_alert_message(trx.violation_reason),
        status         = AlertStatusEnum.OPEN,
    )

    # [TIMING] Alert Insert
    t0 = time.perf_counter()
    alert_repo = AlertRepository(db)
    alert_repo.create(alert)
    db.flush()
    t1 = time.perf_counter()

    # [TIMING] Activity Log
    alert_severity = {
        "CRITICAL": SeverityLevelEnum.CRITICAL, "HIGH": SeverityLevelEnum.HIGH,
        "MEDIUM": SeverityLevelEnum.WARNING, "LOW": SeverityLevelEnum.INFO
    }.get(trx.risk_level, SeverityLevelEnum.WARNING)

    log_activity(
        db=db, admin=None,
        action_type=ActivityActionEnum.ALERT_CREATED,
        module_source=EventSourceEnum.SYSTEM,
        severity=alert_severity,
        target_type=TargetType.ALERT,
        target_id=alert.id,
        details={"transaction_id": trx.id, "risk_score": trx.risk_score,
                 "message": "Alert created successfully by system engine"}
    )
    t2 = time.perf_counter()

    # [TIMING] Redis Publish
    if background_tasks:
        from app.infrastructure.realtime.redis_pubsub import redis_service

        async def _publish():
            t_redis = time.perf_counter()
            try:
                await redis_service.publish("dashboard", {
                    "type": "DASHBOARD_PARTIAL_UPDATE",
                    "alert": {"id": alert.id, "title": alert.title,
                              "description": alert.message, "severity": alert.severity}
                })
            except Exception as e:
                logger.warning(f"[REDIS OFFLINE] Gagal broadcast ALERT_CREATED: {e}")
            finally:
                logger.debug(f"[ALERT] Redis publish={round(time.perf_counter()-t_redis, 4)}s")

        background_tasks.add_task(_publish)

    t3 = time.perf_counter()
    logger.info(
        f"[ALERT] type={alert_type} trx={trx.id} | "
        f"insert={round(t1-t0,4)}s | log={round(t2-t1,4)}s | "
        f"redis_enqueue={round(t3-t2,4)}s | total={round(t3-t0,4)}s"
    )
    return alert


# ============================================================
# GET ALL ALERTS (dipanggil dari alert_routes.py)
# ============================================================
@log_performance(label="AlertService.get_all_alerts")
def get_all_alerts(db, status=None, severity=None, service=None, priority=None,
                   page=1, limit=10, alert_type=None, search=None, sort_by="priority_desc"):
    alert_repo = AlertRepository(db)
    query = alert_repo.get_query().options(joinedload(FraudAlert.transaction)).join(Transaction)

    if status:     query = query.filter(FraudAlert.status == status.upper())
    if severity:   query = query.filter(FraudAlert.severity == severity.upper())
    if alert_type: query = query.filter(FraudAlert.alert_type == alert_type.upper())
    if service:    query = query.filter(Transaction.service_source == service.upper())
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(
            FraudAlert.title.ilike(term),
            FraudAlert.message.ilike(term),
            func.cast(FraudAlert.transaction_id, String).ilike(term),
            Transaction.user_account_id.ilike(term),
            Transaction.original_trx_id.ilike(term),
            Transaction.account_number.ilike(term),
            Transaction.merchant_id.ilike(term),
            Transaction.terminal_id.ilike(term),
            Transaction.ip_address.ilike(term),
            Transaction.violation_reason.ilike(term),
        ))
    if priority:
        label = priority.upper()
        if label == "CRITICAL":  query = query.filter(FraudAlert.priority >= 90)
        elif label == "HIGH":    query = query.filter(FraudAlert.priority >= 75, FraudAlert.priority < 90)
        elif label == "MEDIUM":  query = query.filter(FraudAlert.priority >= 50, FraudAlert.priority < 75)
        elif label == "LOW":     query = query.filter(FraudAlert.priority < 50)

    order_map = {
        "priority_desc": (FraudAlert.priority.desc(), FraudAlert.created_at.desc()),
        "priority_asc": (FraudAlert.priority.asc(), FraudAlert.created_at.desc()),
        "newest": (FraudAlert.created_at.desc(),),
        "oldest": (FraudAlert.created_at.asc(),),
    }
    total  = query.count()
    alerts = query.order_by(*order_map[sort_by]) \
                  .offset((page - 1) * limit).limit(limit).all()

    return {
        "page": page, "limit": limit, "total": total,
        "items": [
            {
                "id": a.id, "transaction_id": a.transaction_id,
                "service": a.transaction.service_source if a.transaction else "UNKNOWN",
                "severity": a.severity, "priority": a.priority or 0,
                "status": a.status, "created_at": a.created_at,
                "title_raw": a.title, "message_raw": a.message,
                "title": format_title(a), "description": a.message,
                "badge": format_badge(a.severity), "trx_id": format_trx_id(a),
                "transaction_final_status": (
                    a.transaction.final_status.value
                    if a.transaction and a.transaction.final_status
                    else None
                ),
                "time": format_time(a.created_at),
                "type": getattr(a, "alert_type", "UNKNOWN"),
                "icon": "fraud" if a.severity == "HIGH" else "warning"
            }
            for a in alerts
        ]
    }


# ============================================================
# OPEN ALERT COUNT
# ============================================================
def get_open_alert_count(db):
    return db.query(FraudAlert).filter(
        FraudAlert.status.in_([AlertStatusEnum.OPEN, AlertStatusEnum.REOPENED])
    ).count()


# ============================================================
# ALERT METRICS
# ============================================================
@log_performance(label="AlertService.get_alert_metrics_service")
def get_alert_metrics_service(db):
    total        = db.query(func.count(FraudAlert.id)).scalar()
    open_count   = db.query(func.count(FraudAlert.id)).filter(FraudAlert.status == "OPEN").scalar()
    in_progress  = db.query(func.count(FraudAlert.id)).filter(FraudAlert.status == "IN_PROGRESS").scalar()
    resolved     = db.query(func.count(FraudAlert.id)).filter(FraudAlert.status == "RESOLVED").scalar()
    fraud_count  = db.query(func.count(FraudAlert.id)).join(Transaction).filter(Transaction.final_status == "FRAUD").scalar()
    avg_response = db.query(
        func.avg(func.extract('epoch', FraudAlert.resolved_at - FraudAlert.created_at))
    ).filter(FraudAlert.status == "RESOLVED", FraudAlert.resolved_at.isnot(None)).scalar()

    return {
        "total_alerts": total or 0, "open_alerts": open_count or 0,
        "in_progress_alerts": in_progress or 0, "resolved_alerts": resolved or 0,
        "fraud_alerts": fraud_count or 0,
        "avg_response_time_minutes": round((avg_response or 0) / 60, 2)
    }


# ============================================================
# ALERT DETAIL
# ============================================================
@log_performance(label="AlertService.get_alert_detail_service")
def get_alert_detail_service(db, alert_id: int):
    alert_repo = AlertRepository(db)
    a = alert_repo.get_by_id(alert_id)
    if not a:
        raise HTTPException(status_code=404, detail="Alert tidak ditemukan")

    ml_score   = None
    ml_risk_level = None
    is_anomaly = getattr(a.transaction, "is_flagged_ml", False) if a.transaction else False
    ml_patterns = []

    if a.transaction and a.transaction.score_breakdown:
        breakdown   = a.transaction.score_breakdown or {}
        ml_score    = breakdown.get("ml_score")
        ml_risk_level = breakdown.get("ml_risk_level") or breakdown.get("risk_level")
        ml_patterns = breakdown.get("patterns", [])

    txn_data = None
    if a.transaction:
        t = a.transaction
        txn_data = {
            "original_trx_id":     t.original_trx_id,
            "service_source":      t.service_source,
            "user_account_id":     getattr(t, "user_account_id", None),
            "amount":              float(t.amount) if t.amount else 0,
            "transaction_time":    t.transaction_time,
            "city":                getattr(t, "city", None),
            "country":             getattr(t, "country", None),
            "account_number":      getattr(t, "account_number", None),
            "terminal_id":         getattr(t, "terminal_id", None),
            "merchant_id":         getattr(t, "merchant_id", None),
            "ip_address":          getattr(t, "ip_address", None),
            "final_status":        t.final_status.value if t.final_status else None,
            "risk_score":          getattr(t, "risk_score", None),
            "risk_level":          getattr(t, "risk_level", None),
            "anomaly_score":       getattr(t, "anomaly_score", None),
            "is_flagged_ml":       getattr(t, "is_flagged_ml", False),
            "violation_reason":    getattr(t, "violation_reason", None),
            "score_breakdown":     dict(t.score_breakdown) if t.score_breakdown else {},
            "transaction_details": dict(t.transaction_details) if t.transaction_details else {},
        }

    priority_val = a.priority or 0
    if priority_val >= 90:   priority_label = "CRITICAL"
    elif priority_val >= 75: priority_label = "HIGH"
    elif priority_val >= 50: priority_label = "MEDIUM"
    else:                    priority_label = "LOW"

    claimed_by_name  = getattr(a.claimed_admin, "full_name", None) if a.claimed_by and a.claimed_admin else None
    resolved_by_name = getattr(a.resolved_admin, "full_name", None) if a.resolved_by and a.resolved_admin else None

    review_data = None
    if a.reviews:
        active_review = next(
            (r for r in sorted(a.reviews, key=lambda r: r.created_at, reverse=True) if not r.is_deleted),
            None
        )
        if active_review:
            duration_min = None
            if active_review.review_started_at and active_review.review_completed_at:
                delta = active_review.review_completed_at - active_review.review_started_at
                duration_min = round(delta.total_seconds() / 60, 1)
            review_data = {
                "review_id":           active_review.id,
                "decision":            active_review.decision.value if active_review.decision else None,
                "decision_confidence": active_review.decision_confidence,
                "review_note":         active_review.review_note,
                "reviewer_id":         active_review.reviewer_id,
                "reviewer_name":       active_review.reviewer_name,
                "reviewed_at":         active_review.review_completed_at or active_review.created_at,
                "duration_minutes":    duration_min,
                "is_overridden":       active_review.is_overridden,
                "overridden_by":       active_review.overridden_by,
                "overridden_at":       active_review.overridden_at,
                "override_reason":     active_review.override_reason,
            }

    return {
        "id": a.id, "transaction_id": a.transaction_id,
        "type": getattr(a, "alert_type", "system").upper(),
        "severity": a.severity.upper() if a.severity else "LOW",
        "priority": priority_val, "priority_label": priority_label,
        "status": a.status.upper() if a.status else "OPEN",
        "is_escalated": getattr(a, "is_escalated", False),
        "version_id": getattr(a, "version_id", None),
        "title": format_title(a), "message": a.message, "created_at": a.created_at,
        "claimed_at": a.claimed_at, "claimed_by": a.claimed_by, "claimed_by_name": claimed_by_name,
        "resolved_at": a.resolved_at, "resolved_by": a.resolved_by, "resolved_by_name": resolved_by_name,
        "ml_score": ml_score, "ml_risk_level": ml_risk_level,
        "is_anomaly": is_anomaly, "ml_patterns": ml_patterns,
        "review": review_data, "transaction": txn_data
    }


# ============================================================
# UPDATE ALERT STATUS
# ============================================================
@log_performance(label="AlertService.update_alert_status_service")
def update_alert_status_service(
    db,
    alert_id: int,
    actor,
    background_tasks: BackgroundTasks | None = None,
    status: AlertStatusEnum = AlertStatusEnum.RESOLVED,
    require_claim_owner: bool = False,
    resolution_reason: str | None = None,
):
    """Apply only valid state transitions and retain a complete ownership trail."""
    alert = db.query(FraudAlert).filter(FraudAlert.id == alert_id).with_for_update().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert tidak ditemukan")

    current_status = alert.status.value if hasattr(alert.status, "value") else str(alert.status)
    target_status = status.value if hasattr(status, "value") else str(status).upper()
    actor_role = get_role_name(actor)
    transitions = {
        "OPEN": {"RESOLVED", "OVERRIDDEN"},
        "IN_PROGRESS": {"OPEN", "RESOLVED", "OVERRIDDEN"},
        "RESOLVED": {"REOPENED", "OVERRIDDEN"},
        "REOPENED": {"OPEN", "RESOLVED", "OVERRIDDEN"},
        "OVERRIDDEN": {"REOPENED"},
    }
    if target_status == current_status:
        return {"message": f"Alert {alert.id} sudah berstatus {target_status}"}
    if target_status not in transitions.get(current_status, set()):
        raise HTTPException(status_code=409, detail=f"Transisi {current_status} ke {target_status} tidak diizinkan")
    if require_claim_owner and (current_status != "IN_PROGRESS" or alert.claimed_by != actor.id):
        raise HTTPException(status_code=403, detail="Alert harus diklaim oleh Anda sebelum diselesaikan")
    if actor_role == "FRAUD_ANALYST" and target_status != "RESOLVED":
        raise HTTPException(status_code=403, detail="Fraud Analyst hanya dapat menyelesaikan alert yang diklaimnya")

    # A transaction alert must be concluded through Manual Review so the
    # SAFE/FRAUD disposition and ML feedback are retained. This applies to
    # every role; privileged users use OVERRIDDEN with an auditable reason.
    is_transaction_alert = alert.transaction_id is not None
    has_completed_review = any(
        not review.is_deleted and review.decision is not None and review.review_completed_at is not None
        for review in alert.reviews
    )
    if target_status == "RESOLVED" and is_transaction_alert and not has_completed_review:
        raise HTTPException(
            status_code=409,
            detail="Alert transaksi harus diselesaikan melalui Manual Review (SAFE atau FRAUD).",
        )
    if target_status == "OVERRIDDEN":
        if actor_role not in {"SUPER_ADMIN", "RISK_MANAGER"}:
            raise HTTPException(status_code=403, detail="Hanya Risk Manager atau Super Admin yang dapat override alert")
        resolution_reason = (resolution_reason or "").strip()
        if not resolution_reason:
            raise HTTPException(status_code=422, detail="Alasan override wajib diisi")

    if target_status in {"OPEN", "REOPENED"}:
        alert.claimed_by = None
        alert.claimed_at = None
        alert.resolved_by = None
        alert.resolved_at = None
    elif target_status in {"RESOLVED", "OVERRIDDEN"}:
        alert.resolved_by = actor.id
        alert.resolved_at = datetime.now(timezone.utc)

    alert.status = AlertStatusEnum(target_status)
    log_activity(
        db=db,
        admin=actor,
        action_type=ActivityActionEnum.ALERT_UPDATED,
        module_source=EventSourceEnum.MANUAL_REVIEW,
        severity=SeverityLevelEnum.INFO,
        target_type=TargetType.ALERT,
        target_id=alert.id,
        details={
            "previous_status": current_status,
            "status": target_status,
            "updated_by": actor.id,
            "override_reason": resolution_reason if target_status == "OVERRIDDEN" else None,
        },
    )
    db.commit()
    db.refresh(alert)
    if background_tasks:
        background_tasks.add_task(safe_redis_publish, {
            "event": "ALERT_UPDATED", "alert_id": alert.id, "status": target_status,
        }, task_type="ALERT_UPDATED")
    return {"message": f"Status alert {alert.id} berhasil diupdate menjadi {target_status}"}


# ============================================================
# CLAIM & RELEASE
# ============================================================
@log_performance(label="AlertService.claim_alert_service")
def claim_alert_service(db, alert_id, admin_id, background_tasks: BackgroundTasks):
    alert = db.query(FraudAlert).filter(FraudAlert.id == alert_id).with_for_update().first()
    if not alert: raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status not in {AlertStatusEnum.OPEN, AlertStatusEnum.REOPENED}:
        raise HTTPException(status_code=400, detail=f"Cannot claim alert. Current status is {alert.status}")
    if alert.claimed_by:
        if alert.claimed_by == admin_id: return {"message": "You have already claimed this alert"}
        raise HTTPException(status_code=400, detail=f"Alert is already claimed by user_id {alert.claimed_by}")

    alert.claimed_by = admin_id
    alert.claimed_at = datetime.now(timezone.utc)
    alert.status     = "IN_PROGRESS"

    actor_admin = db.query(Admin).filter(Admin.id == admin_id).first()
    log_activity(
        db=db, admin=actor_admin,
        action_type=ActivityActionEnum.ALERT_CLAIMED,
        module_source=EventSourceEnum.MANUAL_REVIEW,
        severity=SeverityLevelEnum.INFO,
        target_type=TargetType.ALERT, target_id=alert.id,
        details={"claimed_by_id": admin_id, "transaction_id": alert.transaction_id,
                 "status": "INVESTIGATION_STARTED"}
    )
    db.commit()
    db.refresh(alert)

    payload = {"event": "ALERT_CLAIMED", "alert_id": alert.id, "claimed_by": admin_id, "message": "..."}
    background_tasks.add_task(safe_redis_publish, payload, task_type="ALERT_CLAIMED")
    return {"message": "Alert successfully claimed", "alert_id": alert.id}


@log_performance(label="AlertService.release_alert_service")
def release_alert_service(db, alert_id, admin_id, user_role="FRAUD_ANALYST"):
    alert = db.query(FraudAlert).filter(FraudAlert.id == alert_id).with_for_update().first()
    if not alert: raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status != "IN_PROGRESS":
        raise HTTPException(status_code=400, detail=f"Cannot release alert. Current status is {alert.status}")
    if alert.claimed_by != admin_id and user_role not in ["SUPER_ADMIN", "RISK_MANAGER"]:
        raise HTTPException(status_code=403, detail="You do not have permission to release this alert")

    old_owner        = alert.claimed_by
    alert.claimed_by = None
    alert.claimed_at = None
    alert.status     = "OPEN"

    trx_repo = TransactionRepository(db)
    trx      = trx_repo.get_by_id(alert.transaction_id)
    if trx: trx.final_status = TransactionStatusEnum.FLAGGED

    actor_admin = db.query(Admin).filter(Admin.id == admin_id).first()
    log_activity(
        db=db, admin=actor_admin,
        action_type=ActivityActionEnum.ALERT_RELEASED,
        module_source=EventSourceEnum.MANUAL_REVIEW,
        severity=SeverityLevelEnum.WARNING,
        target_type=TargetType.ALERT, target_id=alert.id,
        details={"released_by_id": admin_id, "previous_owner_id": old_owner,
                 "transaction_id": alert.transaction_id}
    )
    db.commit()
    db.refresh(alert)
    return {"message": "Alert successfully released", "alert_id": alert.id}


# ============================================================
# QUEUE SERVICES
# ============================================================
@log_performance(label="AlertService.get_my_queue_service")
def get_my_queue_service(db, user_id: int, page: int = 1, limit: int = 10):
    query = db.query(FraudAlert).options(joinedload(FraudAlert.transaction)).filter(
        FraudAlert.claimed_by == user_id,
        FraudAlert.status == AlertStatusEnum.IN_PROGRESS,
    )
    total = query.count()
    paginated = query.order_by(
        FraudAlert.priority.desc(), FraudAlert.claimed_at.asc()
    ).offset((page - 1) * limit).limit(limit).all()

    items = [
        {
            "id": a.id, "transaction_id": a.transaction_id,
            "service": a.transaction.service_source if a.transaction else "UNKNOWN",
            "severity": a.severity, "priority": a.priority or 0,
            "priority_label": get_priority_label(a.priority or 0),
            "status": a.status, "created_at": a.created_at,
            "title": format_title(a), "message": a.message,
            "badge": format_badge(a.severity), "trx_id": format_trx_id(a),
            "transaction_final_status": (
                a.transaction.final_status.value
                if a.transaction and a.transaction.final_status
                else None
            ),
            "type": getattr(a, "alert_type", "UNKNOWN")
        }
        for a in paginated
    ]
    return {"items": items, "total": total, "page": page, "limit": limit}


@log_performance(label="AlertService.get_open_queue_service")
def get_open_queue_service(
    db,
    priority_label: str = None,
    severity: str = None,
    alert_type: str = None,
    page: int = 1,
    limit: int = 50,
    search: str | None = None,
    sort_by: str = "priority_desc",
):
    query = db.query(FraudAlert).options(joinedload(FraudAlert.transaction)).join(Transaction).filter(
        FraudAlert.status.in_([AlertStatusEnum.OPEN, AlertStatusEnum.REOPENED])
    )

    if severity:
        query = query.filter(FraudAlert.severity == severity.upper())

    if alert_type:
        query = query.filter(FraudAlert.alert_type == alert_type.upper())

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(
            FraudAlert.title.ilike(term),
            FraudAlert.message.ilike(term),
            func.cast(FraudAlert.transaction_id, String).ilike(term),
            Transaction.user_account_id.ilike(term),
            Transaction.original_trx_id.ilike(term),
            Transaction.account_number.ilike(term),
            Transaction.merchant_id.ilike(term),
            Transaction.terminal_id.ilike(term),
            Transaction.ip_address.ilike(term),
            Transaction.violation_reason.ilike(term),
        ))

    if priority_label:
        label = priority_label.upper()
        if label == "CRITICAL":  query = query.filter(FraudAlert.priority >= 90)
        elif label == "HIGH":    query = query.filter(FraudAlert.priority >= 75, FraudAlert.priority < 90)
        elif label == "MEDIUM":  query = query.filter(FraudAlert.priority >= 50, FraudAlert.priority < 75)
        elif label == "LOW":     query = query.filter(FraudAlert.priority < 50)

    order_map = {
        "priority_desc": (FraudAlert.priority.desc(), FraudAlert.created_at.desc()),
        "priority_asc": (FraudAlert.priority.asc(), FraudAlert.created_at.desc()),
        "newest": (FraudAlert.created_at.desc(),),
        "oldest": (FraudAlert.created_at.asc(),),
    }
    total  = query.count()
    alerts = (
        query.order_by(*order_map[sort_by])
        .offset((page - 1) * limit).limit(limit).all()
    )

    items = [
        {
            "id": a.id, "transaction_id": a.transaction_id,
            "service": a.transaction.service_source if a.transaction else "UNKNOWN",
            "severity": a.severity, "priority": a.priority or 0,
            "priority_label": get_priority_label(a.priority or 0),
            "status": a.status, "created_at": a.created_at,
            "title": format_title(a), "message": a.message,
            "badge": format_badge(a.severity), "trx_id": format_trx_id(a),
            "transaction_final_status": (
                a.transaction.final_status.value
                if a.transaction and a.transaction.final_status
                else None
            ),
            "type": getattr(a, "alert_type", "UNKNOWN")
        }
        for a in alerts
    ]
    return {"items": items, "total": total, "page": page, "limit": limit}


def get_priority_distribution_service(db):
    alert_repo = AlertRepository(db)
    return alert_repo.get_priority_distribution()
