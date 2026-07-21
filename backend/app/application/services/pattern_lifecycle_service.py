from datetime import datetime, timedelta, timezone
from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
from app.core.logging import get_logger, log_performance
from app.application.cache.fraud_cache import invalidate_pattern_cache

logger = get_logger(__name__)

MIN_SAMPLE = 5
DISABLE_THRESHOLD = 0.4
PROMOTE_THRESHOLD = 0.85

DISABLE_MIN_SAMPLE = 10
PROMOTE_MIN_SAMPLE = 20

COOLDOWN_DAYS = 7


@log_performance(label="PatternLifecycle.apply_pattern_lifecycle")
def apply_pattern_lifecycle(db, pattern):
    # Snapshot original values to detect changes that require cache invalidation
    orig_is_active = pattern.is_active
    orig_action = pattern.action
    orig_risk_score = pattern.risk_score

    tp = pattern.true_positive or 0
    fp = pattern.false_positive or 0

    if pattern.risk_score is None:
        pattern.risk_score = 40

    total = tp + fp

    # =========================
    # UPDATE ACCURACY
    # =========================
    if total > 0:
        accuracy = tp / total
        pattern.accuracy_score = accuracy
        pattern.false_positive_rate = fp / total
    else:
        accuracy = 0

    if total < MIN_SAMPLE:
        return

    now = datetime.now(timezone.utc)

    # =========================
    # COOLDOWN RE-ACTIVATE
    # =========================
    if not pattern.is_active and pattern.disabled_at:
        # Normalise ke aware datetime agar perbandingan tidak crash TypeError
        disabled_at = pattern.disabled_at
        if disabled_at.tzinfo is None:
            disabled_at = disabled_at.replace(tzinfo=timezone.utc)
        if now - disabled_at > timedelta(days=COOLDOWN_DAYS):
            pattern.is_active = True
            pattern.disabled_at = None
            
            log_activity(
                db=db, admin=None,
                action_type=ActivityActionEnum.PATTERN_REACTIVATED,
                module_source=EventSourceEnum.PATTERN_ENGINE,
                severity=SeverityLevelEnum.INFO,
                target_type="PATTERN", target_id=str(pattern.id),
                details={"pattern_name": pattern.pattern_name, "msg": "Pattern re-activated after cooling down"}
            )
            # Pattern status changed — invalidate pattern cache so engine reloads
            try:
                invalidate_pattern_cache()
            except Exception:
                logger.exception("Failed to invalidate pattern cache after re-activation")

    # =========================
    # AUTO DISABLE (Kinerja Buruk)
    # =========================
    if total >= DISABLE_MIN_SAMPLE and accuracy < DISABLE_THRESHOLD:
        was_disabled = not pattern.is_active and pattern.action == "FLAG"
        pattern.is_active = False
        pattern.action = "FLAG"
        pattern.disabled_at = now
        
        if not was_disabled:
            log_activity(
                db=db, admin=None,
                action_type=ActivityActionEnum.PATTERN_AUTO_DISABLE,
                module_source=EventSourceEnum.PATTERN_ENGINE,
                severity=SeverityLevelEnum.HIGH,
                target_type="PATTERN", target_id=str(pattern.id),
                details={
                    "pattern_name": pattern.pattern_name,
                    "accuracy_score": round(accuracy, 2),
                    "reason": f"Accuracy dropped below critical threshold ({round(accuracy, 2)} < {DISABLE_THRESHOLD})"
                }
            )
        try:
            invalidate_pattern_cache()
        except Exception:
            logger.exception("Failed to invalidate pattern cache after auto-disable")

    # =========================
    # AUTO PROMOTE 
    # =========================
    elif total >= PROMOTE_MIN_SAMPLE and accuracy >= PROMOTE_THRESHOLD:
        was_promoted = pattern.is_active and pattern.action == "BLOCK"
        pattern.action = "BLOCK"
        pattern.is_active = True
        
        if not was_promoted:
            log_activity(
                db=db, admin=None,
                action_type=ActivityActionEnum.PATTERN_AUTO_PROMOTE,
                module_source=EventSourceEnum.PATTERN_ENGINE,
                severity=SeverityLevelEnum.HIGH,
                target_type="PATTERN", target_id=str(pattern.id),
                details={
                    "pattern_name": pattern.pattern_name,
                    "accuracy_score": round(accuracy, 2),
                    "reason": f"High accuracy performance promoted to automated BLOCK ({round(accuracy, 2)} >= {PROMOTE_THRESHOLD})"
                }
            )
        try:
            invalidate_pattern_cache()
        except Exception:
            logger.exception("Failed to invalidate pattern cache after auto-promote")

    elif accuracy < 0.6:
        pattern.action = "FLAG"

    # risk_score is administrator/model configuration, not an accumulated
    # lifecycle output. Re-scaling the previous score on every review causes
    # exponential decay, so lifecycle only updates accuracy/action/status.
    # If risk_score or action/is_active changed, invalidate cache so pattern engine
    # sees up-to-date values on next transaction.
    try:
        if (
            pattern.is_active != orig_is_active
            or pattern.action != orig_action
            or pattern.risk_score != orig_risk_score
        ):
            invalidate_pattern_cache()
    except Exception:
        logger.exception("Failed to invalidate pattern cache after lifecycle update")
