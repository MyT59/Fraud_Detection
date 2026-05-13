import numpy as np
import pandas as pd
from typing import Any

def _safe_divide(a: pd.Series, b: pd.Series) -> pd.Series:
    out = np.where(b.to_numpy() == 0, 0.0, a.to_numpy() / b.to_numpy())
    return pd.Series(out, index=a.index, dtype=float)

def build_agenusa_features(df: pd.DataFrame) -> pd.DataFrame:
    data = df.copy()

    # 🔥 1. NORMALIZATION
    COLUMN_ALIASES = {
        "timestamp_db": "TIMESTAMP_DB",
        "transaction_time": "TIMESTAMP_DB",
        "account_number": "ACCOUNT_NUMBER",
        "terminal_id": "TERMINAL_ID",
        "amount": "AMOUNT",
        "response_code": "RESPONSE_CODE",
        "processing_code": "PROCESSING_CODE",
        "dest_account_number": "DEST_ACCOUNT_NUMBER"
    }

    for old_col, new_col in COLUMN_ALIASES.items():
        if old_col in data.columns and new_col not in data.columns:
            data[new_col] = data[old_col]

    # ✅ 2. VALIDATION
    required_cols = [
        "TIMESTAMP_DB", 
        "ACCOUNT_NUMBER", 
        "TERMINAL_ID", 
        "AMOUNT", 
        "RESPONSE_CODE", 
        "PROCESSING_CODE", 
        "DEST_ACCOUNT_NUMBER"
    ]
    
    missing = [c for c in required_cols if c not in data.columns]
    if missing:
        raise ValueError(
            f"Missing required columns in agenusa: {missing}. "
            f"Available columns: {list(data.columns)}"
        )

    # 🚀 3. FEATURE ENGINEERING
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

    # 🔥 1. NORMALIZATION
    COLUMN_ALIASES = {
        "bill_date": "BILL_DATE",
        "payment_date": "PAYMENT_DATE",
        "customer_id": "CUSTOMER_ID",
        "payment_amount": "PAYMENT_AMOUNT",
        "bill_amount": "BILL_AMOUNT",
        "channel": "CHANNEL"
    }

    for old_col, new_col in COLUMN_ALIASES.items():
        if old_col in data.columns and new_col not in data.columns:
            data[new_col] = data[old_col]

    # ✅ 2. VALIDATION
    required_cols = [
        "BILL_DATE", 
        "PAYMENT_DATE", 
        "CUSTOMER_ID", 
        "PAYMENT_AMOUNT", 
        "BILL_AMOUNT", 
        "CHANNEL"
    ]
    
    missing = [c for c in required_cols if c not in data.columns]
    if missing:
        raise ValueError(
            f"Missing required columns in nusabill: {missing}. "
            f"Available columns: {list(data.columns)}"
        )

    # 🚀 3. FEATURE ENGINEERING
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