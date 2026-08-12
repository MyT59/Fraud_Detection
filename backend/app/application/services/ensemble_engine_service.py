from app.infrastructure.database.enums import TransactionStatusEnum
from app.core.config import settings
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)


@log_performance(label="EnsembleEngine.run_ensemble_engine")
def run_ensemble_engine(
    rule_score=0,
    rule_actions=None,
    pattern_score=0,
    pattern_actions=None,
    ml_score=0,
    pattern_violations=None,
    transaction_id=None,
):
    rule_actions = rule_actions or []
    pattern_actions = pattern_actions or []
    pattern_violations = pattern_violations or []

    actions = rule_actions + pattern_actions

    # =========================================================================
    # PRIORITY: HARD BLOCK FROM ENGINES
    # =========================================================================
    if "BLOCK" in pattern_actions:
        logger.warning(
            f"[ENSEMBLE] tx_id={transaction_id} PATTERN_BLOCK — final_score=100 final_status=FRAUD "
            f"rule_score={rule_score} pattern_score={pattern_score} ml_score={ml_score} "
            f"pattern_actions={pattern_actions}"
        )
        return {
            "final_score": 100,
            "final_status": "FRAUD",
            "reason": "PATTERN_BLOCK"
        }
    
    if "BLOCK" in rule_actions:
        logger.warning(
            f"[ENSEMBLE] tx_id={transaction_id} RULE_BLOCK — final_score=100 final_status=FRAUD "
            f"rule_score={rule_score} pattern_score={pattern_score} ml_score={ml_score} "
            f"rule_actions={rule_actions}"
        )
        return {
            "final_score": 100,
            "final_status": "FRAUD",
            "reason": "RULE_BLOCK"
        }
    
    pattern_names = [v.get("name", "") for v in pattern_violations]

    if any("Decline Velocity" in p for p in pattern_names):
        # Abaikan rule konvensional jika pola fraud velocity sudah sangat jelas
        logger.info(
            f"[ENSEMBLE] tx_id={transaction_id} Decline Velocity pattern terdeteksi — "
            f"rule_score di-override dari {rule_score} menjadi 0"
        )
        rule_score = 0
        rule_actions = []

    # =========================================================================
    # COMBINE SCORE (Rule + Pattern + Scaled ML Anomaly Indicator)
    # =========================================================================
    total_score = int(rule_score + pattern_score + ml_score)
    total_score = max(0, min(total_score, 100))

    # =========================================================================
    # ENSEMBLE DECISION LOGIC
    # =========================================================================
    # Non-BLOCK detections must not stop the transaction. High scores without
    # an explicit BLOCK action are flagged for post-transaction review.
    if total_score >= settings.REVIEW_RISK_SCORE_THRESHOLD or "FLAG" in actions or "REVIEW" in actions:
        status = TransactionStatusEnum.FLAGGED.value
    else:
        status = "SAFE"

    logger.info(
        f"[ENSEMBLE] tx_id={transaction_id} final_score={total_score} final_status={status} "
        f"rule_score={rule_score} pattern_score={pattern_score} ml_score={ml_score}"
    )

    return {
        "final_score": total_score,
        "final_status": status,
        "reason": "COMBINED_ENSEMBLE_EVALUATION"
    }
