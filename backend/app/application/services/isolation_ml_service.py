from __future__ import annotations

from typing import Any

from app.domain.entities.ml_domain import DOMAIN_DEFAULT_THRESHOLDS, ML_DOMAIN_CATALOG
from app.infrastructure.ml.scoring import score_history_isolation
from app.application.use_cases.isolation_decision import classify_score, build_summary


def get_available_domains() -> list[str]:
    return [item.name for item in ML_DOMAIN_CATALOG]


def get_domain_catalog() -> list[dict[str, Any]]:
    return [item.to_dict() for item in ML_DOMAIN_CATALOG]

def process_history_isolation(domain: str, records: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Clean ML processing (tanpa ganggu flow lama)
    """
    raw = score_history_isolation(domain, records)

    thresholds = raw["thresholds"]
    results = []

    high = 0
    review = 0

    for item in raw["results"]:
        score = item["score"]

        # decision logic di application layer
        if score <= thresholds["high_risk_score_threshold"]:
            risk_label = "HIGH_RISK"
            manual_action = "MANUAL_REVIEW_PRIORITY"
            high += 1
        elif score <= thresholds["review_score_threshold"]:
            risk_label = "REVIEW"
            manual_action = "MANUAL_REVIEW"
            review += 1
        else:
            risk_label = "NORMAL"
            manual_action = "NO_BLOCK_AUTO"

        results.append({
            **item,
            "risk_label": risk_label,
            "manual_action": manual_action,
        })

    return {
        "domain": domain,
        "total_records": len(results),
        "summary": {
            "high_risk": high,
            "review": review,
            "normal": len(results) - high - review,
            "review_score_threshold": thresholds["review_score_threshold"],
            "high_risk_score_threshold": thresholds["high_risk_score_threshold"],
        },
        "results": results,
    }

