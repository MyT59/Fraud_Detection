"""Centralised final decision policy for the fraud-detection pipeline."""

from app.core.config import settings
from app.infrastructure.database.enums import TransactionStatusEnum


def decide_score_based_status(
    risk_score: float,
    requires_review: bool = False,
) -> TransactionStatusEnum:
    """Return the automatic status after all deterministic scores are combined.

    Hard blocks (active blacklist or an explicit BLOCK action) retain their
    precedence in ``transaction_service``.  This policy only handles the
    score-based path: safe, analyst-review, and automatic fraud decisions.
    """
    if risk_score >= settings.AUTO_FRAUD_SCORE_THRESHOLD:
        return TransactionStatusEnum.FRAUD
    if requires_review or risk_score >= settings.REVIEW_RISK_SCORE_THRESHOLD:
        return TransactionStatusEnum.FLAGGED
    return TransactionStatusEnum.SAFE


def reached_auto_fraud_threshold(risk_score: float) -> bool:
    return risk_score >= settings.AUTO_FRAUD_SCORE_THRESHOLD


def decision_thresholds() -> dict[str, int]:
    """Expose the applied policy in an auditable transaction breakdown."""
    return {
        "review_risk_score_threshold": settings.REVIEW_RISK_SCORE_THRESHOLD,
        "auto_fraud_score_threshold": settings.AUTO_FRAUD_SCORE_THRESHOLD,
    }
