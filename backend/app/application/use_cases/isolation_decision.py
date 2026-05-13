from typing import Any


def classify_score(score: float, thresholds: dict[str, float]) -> tuple[str, str]:
    review_th = thresholds["review_score_threshold"]
    high_th = thresholds["high_risk_score_threshold"]

    if score <= high_th:
        return "HIGH_RISK", "MANUAL_REVIEW_PRIORITY"
    elif score <= review_th:
        return "REVIEW", "MANUAL_REVIEW"
    else:
        return "NORMAL", "NO_BLOCK_AUTO"


def build_summary(results: list[dict[str, Any]], thresholds: dict[str, float]) -> dict[str, Any]:
    high = sum(1 for r in results if r["risk_label"] == "HIGH_RISK")
    review = sum(1 for r in results if r["risk_label"] == "REVIEW")

    return {
        "high_risk": high,
        "review": review,
        "normal": len(results) - high - review,
        "review_score_threshold": thresholds["review_score_threshold"],
        "high_risk_score_threshold": thresholds["high_risk_score_threshold"],
    }