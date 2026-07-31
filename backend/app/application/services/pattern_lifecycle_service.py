from datetime import datetime, timezone

from app.application.cache.fraud_cache import invalidate_pattern_cache
from app.application.services.activity_log_service import log_activity
from app.core.logging import get_logger, log_performance
from app.infrastructure.database.enums import (
    ActivityActionEnum,
    EventSourceEnum,
    SeverityLevelEnum,
)

logger = get_logger(__name__)

MIN_SAMPLE = 5
DISABLE_THRESHOLD = 0.4
PROMOTE_THRESHOLD = 0.85
DISABLE_MIN_SAMPLE = 10
PROMOTE_MIN_SAMPLE = 20


@log_performance(label="PatternLifecycle.apply_pattern_lifecycle")
def apply_pattern_lifecycle(db, pattern):
    """Refresh pattern performance and apply safe lifecycle transitions.

    An inactive pattern is never auto-reactivated. The table does not retain a
    reliable disabled-reason, so automatic reactivation could re-enable a
    pattern intentionally disabled by an administrator. It also previously
    reactivated and auto-disabled the same pattern in one execution.
    """
    orig_is_active = pattern.is_active
    orig_action = pattern.action

    tp = pattern.true_positive or 0
    fp = pattern.false_positive or 0
    total = tp + fp

    if pattern.risk_score is None:
        pattern.risk_score = 40

    if total > 0:
        accuracy = tp / total
        pattern.accuracy_score = accuracy
        pattern.false_positive_rate = fp / total
    else:
        accuracy = 0
        pattern.accuracy_score = None
        pattern.false_positive_rate = None

    if total >= MIN_SAMPLE:
        now = datetime.now(timezone.utc)

        if total >= DISABLE_MIN_SAMPLE and accuracy < DISABLE_THRESHOLD:
            was_disabled = not pattern.is_active
            pattern.is_active = False
            pattern.action = "FLAG"
            pattern.disabled_at = now

            if not was_disabled:
                log_activity(
                    db=db,
                    admin=None,
                    action_type=ActivityActionEnum.PATTERN_AUTO_DISABLE,
                    module_source=EventSourceEnum.PATTERN_ENGINE,
                    severity=SeverityLevelEnum.HIGH,
                    target_type="PATTERN",
                    target_id=str(pattern.id),
                    details={
                        "pattern_name": pattern.pattern_name,
                        "accuracy_score": round(accuracy, 2),
                        "reason": (
                            "Accuracy dropped below critical threshold "
                            f"({round(accuracy, 2)} < {DISABLE_THRESHOLD})"
                        ),
                    },
                )

        elif total >= PROMOTE_MIN_SAMPLE and accuracy >= PROMOTE_THRESHOLD:
            # Promotion changes mitigation only for an already-live pattern.
            # Candidates must still be activated explicitly by a manager.
            was_promoted = pattern.is_active and pattern.action == "BLOCK"
            if pattern.is_active:
                pattern.action = "BLOCK"
                if not was_promoted:
                    log_activity(
                        db=db,
                        admin=None,
                        action_type=ActivityActionEnum.PATTERN_AUTO_PROMOTE,
                        module_source=EventSourceEnum.PATTERN_ENGINE,
                        severity=SeverityLevelEnum.HIGH,
                        target_type="PATTERN",
                        target_id=str(pattern.id),
                        details={
                            "pattern_name": pattern.pattern_name,
                            "accuracy_score": round(accuracy, 2),
                            "reason": (
                                "High accuracy promoted to automated BLOCK "
                                f"({round(accuracy, 2)} >= {PROMOTE_THRESHOLD})"
                            ),
                        },
                    )

        elif pattern.is_active and accuracy < 0.6:
            pattern.action = "FLAG"

    if pattern.is_active != orig_is_active or pattern.action != orig_action:
        try:
            invalidate_pattern_cache()
        except Exception:
            logger.exception("Failed to invalidate pattern cache after lifecycle update")
