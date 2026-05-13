from typing import Any
from .predictor import IsolationPredictor
from .model_loader import load_isolation_meta

predictor = IsolationPredictor()


def score_history_isolation(
    domain: str,
    records: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Pure ML scoring (NO business logic)
    """

    raw_results = predictor.predict_scores(domain, records)
    meta = load_isolation_meta(domain)

    return {
        "domain": domain,
        "total_records": len(raw_results),
        "thresholds": meta["thresholds"],  # kirim ke application
        "results": raw_results,
    }