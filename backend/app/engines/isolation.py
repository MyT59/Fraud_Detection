from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import joblib
import pandas as pd

from ..paths import MODELS_DIR
from .fds import build_agenusa_features, build_nusabill_features, get_matched_patterns

DOMAIN_ISO_CONFIG: dict[str, dict[str, Any]] = {
    "agenusa": {
        "model_path": MODELS_DIR / "agenusa_isolation_forest.pkl",
        "meta_path": MODELS_DIR / "agenusa_isolation_meta.json",
        "drop_cols": ["TIMESTAMP_DB", "PREV_TIMESTAMP", "PREV_TERMINAL", "ACCOUNT_NUMBER", "STAN"],
    },
    "nusabill": {
        "model_path": MODELS_DIR / "nusabill_isolation_forest.pkl",
        "meta_path": MODELS_DIR / "nusabill_isolation_meta.json",
        "drop_cols": ["BILL_DATE", "PAYMENT_DATE", "BILL_ID", "CUSTOMER_ID"],
    },
}


def build_features(domain: str, df: pd.DataFrame) -> pd.DataFrame:
    if domain == "agenusa":
        return build_agenusa_features(df)
    if domain == "nusabill":
        return build_nusabill_features(df)
    raise ValueError(f"Domain tidak dikenal: {domain}")


@lru_cache(maxsize=4)
def load_isolation_model(domain: str):
    config = DOMAIN_ISO_CONFIG.get(domain)
    if not config:
        raise ValueError(f"Domain tidak dikenal: {domain}")
    model_path = config["model_path"]
    if not model_path.exists():
        raise FileNotFoundError(f"Model isolation tidak ditemukan: {model_path}")
    return joblib.load(model_path)


@lru_cache(maxsize=4)
def load_isolation_meta(domain: str) -> dict[str, Any]:
    config = DOMAIN_ISO_CONFIG.get(domain)
    if not config:
        raise ValueError(f"Domain tidak dikenal: {domain}")
    meta_path = config["meta_path"]
    if not meta_path.exists():
        raise FileNotFoundError(f"Meta isolation tidak ditemukan: {meta_path}")
    return json.loads(meta_path.read_text(encoding="utf-8"))


def score_history_isolation(
    domain: str,
    records: list[dict[str, Any]],
    review_score_threshold: float | None = None,
    high_risk_score_threshold: float | None = None,
) -> dict[str, Any]:
    if domain not in DOMAIN_ISO_CONFIG:
        raise ValueError(f"Domain tidak dikenal: {domain}")
    if not records:
        raise ValueError("Records kosong")

    raw_df = pd.DataFrame(records)
    feature_df = build_features(domain, raw_df)

    config = DOMAIN_ISO_CONFIG[domain]
    model = load_isolation_model(domain)
    meta = load_isolation_meta(domain)
    x = feature_df.drop(columns=["IS_FRAUD", *config["drop_cols"]], errors="ignore")

    default_review = float(meta["thresholds"]["review_score_threshold"])
    default_high = float(meta["thresholds"]["high_risk_score_threshold"])
    review_th = default_review if review_score_threshold is None else review_score_threshold
    high_th = default_high if high_risk_score_threshold is None else high_risk_score_threshold
    if review_th < high_th:
        raise ValueError("review_score_threshold tidak boleh lebih kecil dari high_risk_score_threshold")

    scores = model.decision_function(x)
    preds = model.predict(x)

    results: list[dict[str, Any]] = []
    high_risk = 0
    review = 0
    for idx, row in feature_df.iterrows():
        anomaly_score = float(scores[idx])
        if anomaly_score <= high_th:
            risk_label = "HIGH_RISK"
            manual_action = "MANUAL_REVIEW_PRIORITY"
            high_risk += 1
        elif anomaly_score <= review_th:
            risk_label = "REVIEW"
            manual_action = "MANUAL_REVIEW"
            review += 1
        else:
            risk_label = "NORMAL"
            manual_action = "NO_BLOCK_AUTO"

        results.append(
            {
                "record": raw_df.iloc[idx].to_dict(),
                "anomaly_score": round(anomaly_score, 6),
                "is_anomaly": int(preds[idx] == -1),
                "risk_label": risk_label,
                "matched_patterns": get_matched_patterns(domain, row),
                "manual_action": manual_action,
            }
        )

    return {
        "domain": domain,
        "total_records": len(results),
        "summary": {
            "high_risk": high_risk,
            "review": review,
            "normal": len(results) - high_risk - review,
            "review_score_threshold": review_th,
            "high_risk_score_threshold": high_th,
            "default_thresholds": meta["thresholds"],
        },
        "results": results,
    }
