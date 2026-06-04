from datetime import datetime, timedelta, timezone
from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum

MIN_SAMPLE = 5
DISABLE_THRESHOLD = 0.4
PROMOTE_THRESHOLD = 0.85

DISABLE_MIN_SAMPLE = 10
PROMOTE_MIN_SAMPLE = 20

DECAY_RATE = 0.98
COOLDOWN_DAYS = 7


def apply_pattern_lifecycle(db, pattern):
    tp = pattern.true_positive or 0
    fp = pattern.false_positive or 0

    if pattern.risk_score is None:
        pattern.risk_score = 40

    # =========================
    # DECAY (SAFE)
    # =========================
    tp = max(1, int(tp * DECAY_RATE)) if tp > 0 else 0
    fp = max(1, int(fp * DECAY_RATE)) if fp > 0 else 0

    pattern.true_positive = tp
    pattern.false_positive = fp

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
        if now - pattern.disabled_at > timedelta(days=COOLDOWN_DAYS):
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

    # =========================
    # AUTO DISABLE (Kinerja Buruk)
    # =========================
    if total >= DISABLE_MIN_SAMPLE and accuracy < DISABLE_THRESHOLD:
        pattern.is_active = False
        pattern.action = "FLAG"
        pattern.disabled_at = now
        
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

    # =========================
    # AUTO PROMOTE 
    # =========================
    elif total >= PROMOTE_MIN_SAMPLE and accuracy >= PROMOTE_THRESHOLD:
        pattern.action = "BLOCK"
        pattern.is_active = True
        
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

    elif accuracy < 0.6:
        pattern.action = "REVIEW"

    base_score = pattern.risk_score or 40
    new_score = int(base_score * accuracy)
    new_score = max(10, min(new_score, 100))

    pattern.risk_score = new_score