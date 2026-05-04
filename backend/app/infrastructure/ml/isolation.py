from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import joblib
import numpy as np
import pandas as pd

from ...paths import MODELS_DIR


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


def _safe_divide(a: pd.Series, b: pd.Series) -> pd.Series:
    out = np.where(b.to_numpy() == 0, 0.0, a.to_numpy() / b.to_numpy())
    return pd.Series(out, index=a.index, dtype=float)


def build_agenusa_features(df: pd.DataFrame) -> pd.DataFrame:
    data = df.copy()
    data["TIMESTAMP_DB"] = pd.to_datetime(data["TIMESTAMP_DB"], errors="coerce")
    data = data.sort_values(["ACCOUNT_NUMBER", "TIMESTAMP_DB"]).reset_index(drop=True)

    data["TX_HOUR"] = data["TIMESTAMP_DB"].dt.hour.fillna(-1).astype(int)
    data["TX_DAYOFWEEK"] = data["TIMESTAMP_DB"].dt.dayofweek.fillna(-1).astype(int)
    data["IS_NIGHT_TX"] = data["TX_HOUR"].isin([0, 1, 2, 3, 4]).astype(int)

    data["PREV_TIMESTAMP"] = data.groupby("ACCOUNT_NUMBER")["TIMESTAMP_DB"].shift(1)
    gap_minutes = (data["TIMESTAMP_DB"] - data["PREV_TIMESTAMP"]).dt.total_seconds() / 60.0
    data["GAP_MINUTES"] = gap_minutes.fillna(9999.0).clip(lower=0.0)

    data["PREV_TERMINAL"] = data.groupby("ACCOUNT_NUMBER")["TERMINAL_ID"].shift(1)
    data["TERMINAL_SWITCH_FAST"] = (
        (data["GAP_MINUTES"] <= 10.0)
        & (data["PREV_TERMINAL"].notna())
        & (data["TERMINAL_ID"] != data["PREV_TERMINAL"])
    ).astype(int)

    rolling_avg = (
        data.groupby("ACCOUNT_NUMBER")["AMOUNT"]
        .transform(lambda s: s.shift(1).rolling(window=5, min_periods=1).mean())
        .fillna(data["AMOUNT"].median())
    )
    data["AVG_AMOUNT_5"] = rolling_avg
    data["AMOUNT_OVER_AVG_RATIO"] = _safe_divide(data["AMOUNT"], data["AVG_AMOUNT_5"]).clip(0.0, 100.0)

    data["IS_DECLINED"] = (data["RESPONSE_CODE"].astype(str) != "00").astype(int)
    data["IS_BRUTE_PATTERN"] = (
        (data["PROCESSING_CODE"].astype(str) == "300000") & (data["RESPONSE_CODE"].astype(str) == "55")
    ).astype(int)
    data["IS_MONEY_MULE_DEST"] = (data["DEST_ACCOUNT_NUMBER"] == "DST999999").astype(int)
    data["IS_HIGH_AMOUNT_PATTERN"] = (data["AMOUNT_OVER_AVG_RATIO"] >= 8.0).astype(int)
    data["MIDNIGHT_AMOUNT_SPIKE"] = (
        (data["IS_NIGHT_TX"] == 1) & (data["AMOUNT_OVER_AVG_RATIO"] >= 2.0)
    ).astype(int)
    data["RAPID_RETRY_DECLINED"] = (
        (data["IS_DECLINED"] == 1) & (data["GAP_MINUTES"] <= 2.0)
    ).astype(int)
    return data


def build_nusabill_features(df: pd.DataFrame) -> pd.DataFrame:
    data = df.copy()
    data["BILL_DATE"] = pd.to_datetime(data["BILL_DATE"], errors="coerce")
    data["PAYMENT_DATE"] = pd.to_datetime(data["PAYMENT_DATE"], errors="coerce")
    data = data.sort_values(["CUSTOMER_ID", "PAYMENT_DATE"]).reset_index(drop=True)

    data["PAYMENT_DELAY_DAYS"] = (
        (data["PAYMENT_DATE"] - data["BILL_DATE"]).dt.total_seconds() / 86400.0
    ).fillna(0.0)
    data["PAYMENT_TO_BILL_RATIO"] = _safe_divide(data["PAYMENT_AMOUNT"], data["BILL_AMOUNT"]).clip(0.0, 100.0)
    data["UNDERPAY_FLAG"] = (data["PAYMENT_TO_BILL_RATIO"] < 0.3).astype(int)
    data["HIGH_SPIKE_FLAG"] = (data["PAYMENT_TO_BILL_RATIO"] > 4.0).astype(int)
    data["CHANNEL_API_FLAG"] = (data["CHANNEL"] == "API").astype(int)

    prev_payment = data.groupby("CUSTOMER_ID")["PAYMENT_DATE"].shift(1)
    data["PAYMENT_GAP_MINUTES"] = (
        (data["PAYMENT_DATE"] - prev_payment).dt.total_seconds() / 60.0
    ).fillna(9999.0)
    data["BURST_FLAG"] = (data["PAYMENT_GAP_MINUTES"] <= 5.0).astype(int)

    prev_channel = data.groupby("CUSTOMER_ID")["CHANNEL"].shift(1)
    data["CHANNEL_SWITCH_TO_API"] = (
        prev_channel.notna() & (prev_channel != "API") & (data["CHANNEL"] == "API")
    ).astype(int)
    data["EARLY_PAYMENT_ANOMALY"] = (data["PAYMENT_DELAY_DAYS"] < -1.0).astype(int)
    return data


def _pattern_reasons(domain: str, row: pd.Series) -> list[str]:
    reasons: list[str] = []
    if domain == "agenusa":
        if row.get("IS_BRUTE_PATTERN", 0) == 1:
            reasons.append("bruteforce_pin_pattern")
        if row.get("IS_MONEY_MULE_DEST", 0) == 1:
            reasons.append("money_mule_destination")
        if row.get("TERMINAL_SWITCH_FAST", 0) == 1:
            reasons.append("impossible_travel_terminal_switch")
        if row.get("IS_HIGH_AMOUNT_PATTERN", 0) == 1:
            reasons.append("high_amount_spike")
        if row.get("MIDNIGHT_AMOUNT_SPIKE", 0) == 1:
            reasons.append("midnight_unusual_amount")
        if row.get("RAPID_RETRY_DECLINED", 0) == 1:
            reasons.append("rapid_retry_declined")
    elif domain == "nusabill":
        if row.get("UNDERPAY_FLAG", 0) == 1:
            reasons.append("underpayment")
        if row.get("HIGH_SPIKE_FLAG", 0) == 1:
            reasons.append("payment_spike")
        if row.get("REFUND_FLAG", 0) == 1:
            reasons.append("refund_abuse_pattern")
        if row.get("BURST_FLAG", 0) == 1:
            reasons.append("burst_payment_pattern")
        if row.get("CHANNEL_SWITCH_TO_API", 0) == 1:
            reasons.append("sudden_channel_switch_to_api")
        if row.get("EARLY_PAYMENT_ANOMALY", 0) == 1:
            reasons.append("payment_date_anomaly")
    return reasons


def get_matched_patterns(domain: str, row: pd.Series | dict[str, Any]) -> list[str]:
    row_series = row if isinstance(row, pd.Series) else pd.Series(row)
    return _pattern_reasons(domain, row_series)


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
