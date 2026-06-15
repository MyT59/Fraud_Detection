import numpy as np
import pandas as pd
from typing import Any, Optional
from datetime import datetime

from ...core.logging import get_logger

logger = get_logger(__name__)

# ========================================================================
# SNAPSHOT-BASED FEATURE ENGINEERING (NEW)
# ========================================================================

def _safe_divide(a: float, b: float, default: float = 0.0) -> float:
    """Safe division for scalar values."""
    if b == 0:
        return default
    return float(a) / float(b)


def _parse_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """Parse ISO datetime string safely."""
    if not dt_str:
        return None
    try:
        if isinstance(dt_str, datetime):
            return dt_str
        # Handle ISO format
        return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    except Exception:
        return None


def _get_minutes_since_last_transaction(
    current_time: Optional[str],
    historical_transactions: list[dict]
) -> float:
    """
    Calculate minutes since the most recent transaction.
    Returns 9999.0 if no previous transaction found.
    """
    current_dt = _parse_datetime(current_time)
    if not current_dt or not historical_transactions:
        return 9999.0
    
    # Historical transactions are already sorted by time (most recent first)
    if len(historical_transactions) > 0:
        most_recent = historical_transactions[0]
        prev_dt = _parse_datetime(most_recent.get("transaction_time"))
        if prev_dt:
            gap = (current_dt - prev_dt).total_seconds() / 60.0
            return max(0.0, gap)
    
    return 9999.0


def _get_average_amount_last_n(
    historical_transactions: list[dict],
    n: int = 5
) -> float:
    """
    Calculate average transaction amount from last N transactions.
    Excludes the current transaction (snapshot["transaction"]).
    """
    if not historical_transactions:
        return 0.0
    
    amounts = [
        float(tx.get("amount", 0) or 0)
        for tx in historical_transactions[:n]
    ]
    
    return np.mean(amounts) if amounts else 0.0


def _find_last_transaction_with_field(
    historical_transactions: list[dict],
    field: str
) -> Optional[dict]:
    """Find the most recent transaction with a specific field set."""
    for tx in historical_transactions:
        if tx.get(field):
            return tx
    return None


def build_agenusa_features_from_snapshot(snapshot: dict) -> dict:
    """
    Build Agenusa features from a single transaction snapshot.
    
    Snapshot structure:
    {
        "transaction": { current transaction data },
        "historical_context": {
            "recent_account_transactions": [ list of past transactions ]
        }
    }
    
    Returns: dict with all calculated features
    """
    current_tx = snapshot.get("transaction", {})
    historical_context = snapshot.get("historical_context", {})
    # Ambil data mentahnya
    raw_historical_txs = historical_context.get("recent_account_transactions", [])
    # Saring transaksi saat ini agar tidak ikut terhitung (Fix Data Leakage)
    current_tx_id = current_tx.get("id")
    historical_txs = [tx for tx in raw_historical_txs if tx.get("id") != current_tx_id]
    
    features = {}
    
    # ===== BASIC FIELDS =====
    features["TIMESTAMP_DB"] = _parse_datetime(current_tx.get("transaction_time"))
    features["ACCOUNT_NUMBER"] = current_tx.get("account_number")
    features["TERMINAL_ID"] = current_tx.get("terminal_id")
    features["MERCHANT_ID"] = current_tx.get("merchant_id")
    features["AMOUNT"] = float(current_tx.get("amount") or 0)
    features["RESPONSE_CODE"] = current_tx.get("response_code", "00")
    features["PROCESSING_CODE"] = current_tx.get("processing_code")
    features["DEST_ACCOUNT_NUMBER"] = current_tx.get("dest_account_number")
    features["MTI"] = current_tx.get("mti","0200")
    
    # ===== TIME-BASED FEATURES =====
    if features["TIMESTAMP_DB"]:
        features["TX_HOUR"] = features["TIMESTAMP_DB"].hour
        features["TX_DAYOFWEEK"] = features["TIMESTAMP_DB"].weekday()
        features["IS_NIGHT_TX"] = 1 if features["TX_HOUR"] in [0, 1, 2, 3, 4] else 0
    else:
        features["TX_HOUR"] = -1
        features["TX_DAYOFWEEK"] = -1
        features["IS_NIGHT_TX"] = 0
    
    # ===== TEMPORAL FEATURES FROM HISTORICAL DATA =====
    features["GAP_MINUTES"] = _get_minutes_since_last_transaction(
        current_tx.get("transaction_time"),
        historical_txs
    )
    
    # Previous terminal (most recent transaction)
    prev_terminal = None
    if historical_txs:
        prev_tx = historical_txs[0]
        prev_terminal = prev_tx.get("terminal_id")
    
    features["PREV_TERMINAL"] = prev_terminal
    features["TERMINAL_SWITCH_FAST"] = (
        1 if (
            features["GAP_MINUTES"] <= 10.0
            and prev_terminal is not None
            and features["TERMINAL_ID"] != prev_terminal
        ) else 0
    )
    
    # ===== AMOUNT-BASED FEATURES =====
    avg_amount_5 = _get_average_amount_last_n(historical_txs, n=5)
    features["AVG_AMOUNT_5"] = avg_amount_5 if avg_amount_5 > 0 else features["AMOUNT"]
    
    features["AMOUNT_OVER_AVG_RATIO"] = min(
        100.0,
        _safe_divide(features["AMOUNT"], features["AVG_AMOUNT_5"], default=1.0)
    )
    
    # ===== FRAUD PATTERN FLAGS =====
    features["IS_DECLINED"] = 1 if str(current_tx.get("response_code", "00")) != "00" else 0
    
    features["IS_BRUTE_PATTERN"] = (
        1 if (
            str(current_tx.get("processing_code", "")) == "300000"
            and str(current_tx.get("response_code", "00")) == "55"
        ) else 0
    )
    
    features["IS_MONEY_MULE_DEST"] = (
        1 if current_tx.get("dest_account_number") == "DST999999" else 0
    )
    
    features["IS_HIGH_AMOUNT_PATTERN"] = (
        1 if features["AMOUNT_OVER_AVG_RATIO"] >= 8.0 else 0
    )
    
    features["MIDNIGHT_AMOUNT_SPIKE"] = (
        1 if (
            features["IS_NIGHT_TX"] == 1
            and features["AMOUNT_OVER_AVG_RATIO"] >= 2.0
        ) else 0
    )
    
    features["RAPID_RETRY_DECLINED"] = (
        1 if (
            features["IS_DECLINED"] == 1
            and features["GAP_MINUTES"] <= 2.0
        ) else 0
    )
    
    return features


def build_nusabill_features_from_snapshot(snapshot: dict) -> dict:
    """
    Build Nusabill features from a single transaction snapshot.
    
    Snapshot structure:
    {
        "transaction": { current transaction data },
        "historical_context": {
            "recent_account_transactions": [ list of past transactions ]
        }
    }
    
    Returns: dict with all calculated features
    """
    current_tx = snapshot.get("transaction", {})
    historical_context = snapshot.get("historical_context", {})
    # Ambil data mentahnya
    raw_historical_txs = historical_context.get("recent_account_transactions", [])
    # Saring transaksi saat ini agar tidak ikut terhitung (Fix Data Leakage)
    current_tx_id = current_tx.get("id")
    historical_txs = [tx for tx in raw_historical_txs if tx.get("id") != current_tx_id]
    
    features = {}
    
    # ===== BASIC FIELDS =====
    features["BILL_DATE"] = _parse_datetime(current_tx.get("bill_date"))
    features["PAYMENT_DATE"] = _parse_datetime(current_tx.get("payment_date", current_tx.get("transaction_time")))
    features["CUSTOMER_ID"] = current_tx.get("customer_id")
    features["PAYMENT_AMOUNT"] = float(current_tx.get("payment_amount") or 0)
    features["BILL_AMOUNT"] = float(current_tx.get("bill_amount") or 0)
    features["CHANNEL"] = current_tx.get("channel", "API")
    raw_status = str(
        current_tx.get("bill_status", "terbayar")
    ).lower()

    status_mapping = {
        "terbayar": "Paid",
        "paid": "Paid",
        "belum_bayar": "Unpaid",
        "unpaid": "Unpaid",
    }

    features["BILL_STATUS"] = status_mapping.get(raw_status,"Paid")
    
    # ===== PAYMENT TIMING FEATURES =====
    if features["BILL_DATE"] and features["PAYMENT_DATE"]:
        delay_seconds = (features["PAYMENT_DATE"] - features["BILL_DATE"]).total_seconds()
        features["PAYMENT_DELAY_DAYS"] = delay_seconds / 86400.0
    else:
        features["PAYMENT_DELAY_DAYS"] = 0.0
    
    # ===== AMOUNT RATIO FEATURES =====
    features["PAYMENT_TO_BILL_RATIO"] = min(
        100.0,
        _safe_divide(features["PAYMENT_AMOUNT"], features["BILL_AMOUNT"], default=1.0)
    )
    
    features["UNDERPAY_FLAG"] = (
        1 if features["PAYMENT_TO_BILL_RATIO"] < 0.3 else 0
    )
    
    features["HIGH_SPIKE_FLAG"] = (
        1 if features["PAYMENT_TO_BILL_RATIO"] > 4.0 else 0
    )
    
    # ===== CHANNEL FEATURES =====
    features["CHANNEL_API_FLAG"] = 1 if features["CHANNEL"] == "API" else 0
    
    # Previous channel (most recent transaction)
    prev_channel = None
    if historical_txs:
        prev_tx = historical_txs[0]
        prev_channel = prev_tx.get("channel")
    
    features["CHANNEL_SWITCH_TO_API"] = (
        1 if (
            prev_channel is not None
            and prev_channel != "API"
            and features["CHANNEL"] == "API"
        ) else 0
    )
    
    # ===== PAYMENT BURST FEATURES =====
    features["PAYMENT_GAP_MINUTES"] = _get_minutes_since_last_transaction(
        current_tx.get("payment_date", current_tx.get("transaction_time")),
        historical_txs
    )
    
    features["BURST_FLAG"] = (
        1 if features["PAYMENT_GAP_MINUTES"] <= 5.0 else 0
    )
    
    # ===== ANOMALY FLAGS =====
    features["EARLY_PAYMENT_ANOMALY"] = (
        1 if features["PAYMENT_DELAY_DAYS"] < -1.0 else 0
    )
    
    # Refund pattern detection (if marked in historical data)
    features["REFUND_FLAG"] = 0
    if historical_txs and features["PAYMENT_AMOUNT"] < 0:
        features["REFUND_FLAG"] = 1
    
    return features


# ========================================================================
# LEGACY PANDAS-BASED FUNCTIONS (DEPRECATED)
# ========================================================================

def _safe_divide_series(a: pd.Series, b: pd.Series) -> pd.Series:
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
        logger.error(
            f"[FEATURE_BUILD] domain=agenusa kolom wajib hilang — missing={missing} "
            f"available={list(data.columns)}"
        )
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
    data["AMOUNT_OVER_AVG_RATIO"] = _safe_divide_series(data["AMOUNT"], data["AVG_AMOUNT_5"]).clip(0.0, 100.0)

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
        logger.error(
            f"[FEATURE_BUILD] domain=nusabill kolom wajib hilang — missing={missing} "
            f"available={list(data.columns)}"
        )
        raise ValueError(
            f"Missing required columns in nusabill: {missing}. "
            f"Available columns: {list(data.columns)}"
        )

    # 🚀 3. FEATURE ENGINEERING
    data["BILL_DATE"] = pd.to_datetime(data["BILL_DATE"], errors="coerce")
    data["PAYMENT_DATE"] = pd.to_datetime(data["PAYMENT_DATE"], errors="coerce")
    data = data.sort_values(["CUSTOMER_ID", "PAYMENT_DATE"]).reset_index(drop=True)
    status_mapping = {
        "terbayar": "Paid",
        "paid": "Paid",
        "belum_bayar": "Unpaid",
        "unpaid": "Unpaid",
    }
    raw_status = data["bill_status"].fillna("terbayar").astype(str).str.lower()
    data["BILL_STATUS"] = raw_status.map(status_mapping).fillna("Paid")
    data["PAYMENT_DELAY_DAYS"] = (
        (data["PAYMENT_DATE"] - data["BILL_DATE"]).dt.total_seconds() / 86400.0
    ).fillna(0.0)
    data["PAYMENT_TO_BILL_RATIO"] = _safe_divide_series(data["PAYMENT_AMOUNT"], data["BILL_AMOUNT"]).clip(0.0, 100.0)
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

def _pattern_reasons(domain: str, features: dict[str, Any] | pd.Series) -> list[str]:
    """
    Extract pattern reasons from feature dict.
    Works with both dict (snapshot-based) and pd.Series (legacy).
    """
    reasons: list[str] = []
    
    if domain == "agenusa":
        if features.get("IS_BRUTE_PATTERN", 0) == 1:
            reasons.append("bruteforce_pin_pattern")
        if features.get("IS_MONEY_MULE_DEST", 0) == 1:
            reasons.append("money_mule_destination")
        if features.get("TERMINAL_SWITCH_FAST", 0) == 1:
            reasons.append("impossible_travel_terminal_switch")
        if features.get("IS_HIGH_AMOUNT_PATTERN", 0) == 1:
            reasons.append("high_amount_spike")
        if features.get("MIDNIGHT_AMOUNT_SPIKE", 0) == 1:
            reasons.append("midnight_unusual_amount")
        if features.get("RAPID_RETRY_DECLINED", 0) == 1:
            reasons.append("rapid_retry_declined")
    
    elif domain == "nusabill":
        if features.get("UNDERPAY_FLAG", 0) == 1:
            reasons.append("underpayment")
        if features.get("HIGH_SPIKE_FLAG", 0) == 1:
            reasons.append("payment_spike")
        if features.get("REFUND_FLAG", 0) == 1:
            reasons.append("refund_abuse_pattern")
        if features.get("BURST_FLAG", 0) == 1:
            reasons.append("burst_payment_pattern")
        if features.get("CHANNEL_SWITCH_TO_API", 0) == 1:
            reasons.append("sudden_channel_switch_to_api")
        if features.get("EARLY_PAYMENT_ANOMALY", 0) == 1:
            reasons.append("payment_date_anomaly")
    
    return reasons


def get_matched_patterns(domain: str, features: dict[str, Any] | pd.Series) -> list[str]:
    """
    Extract fraud pattern reasons from features.
    Supports both snapshot-based dict and legacy pd.Series formats.
    
    Args:
        domain: "agenusa" or "nusabill"
        features: Feature dict from snapshot-based builder OR pd.Series from legacy builder
    
    Returns:
        List of matched fraud pattern reasons
    """
    return _pattern_reasons(domain, features)


# ========================================================================
# PUBLIC API FUNCTIONS FOR SNAPSHOT-BASED FEATURE ENGINEERING
# ========================================================================

def build_features_from_snapshot(domain: str, snapshot: dict) -> dict[str, Any]:
    """
    Build fraud detection features from a single transaction snapshot.
    
    Args:
        domain: "agenusa" or "nusabill"
        snapshot: Transaction snapshot dict with structure:
            {
                "transaction": { transaction data },
                "historical_context": {
                    "recent_account_transactions": [ historical transactions ]
                }
            }
    
    Returns:
        Dict of calculated features for the current transaction
    
    Raises:
        ValueError if domain is unknown
    """
    if domain == "agenusa":
        return build_agenusa_features_from_snapshot(snapshot)
    elif domain == "nusabill":
        return build_nusabill_features_from_snapshot(snapshot)
    else:
        logger.error(f"[FEATURE_BUILD] Domain tidak dikenal — domain={domain}")
        raise ValueError(f"Domain tidak dikenal: {domain}")


# ========================================================================
# LEGACY API FUNCTIONS FOR BATCH PANDAS-BASED FEATURE ENGINEERING
# ========================================================================

def build_features(domain: str, df: pd.DataFrame) -> pd.DataFrame:
    """
    Legacy function: Build fraud detection features from Pandas DataFrame.
    Sering digunakan oleh retrain_service.py untuk memproses data batch (CSV + DB).
    """
    df = df.copy()
    # 1. Paksa lowercase di awal agar alias kolom dari berbagai source seragam
    df.columns = df.columns.str.lower()

    if domain == "agenusa":
        processed_df = build_agenusa_features(df)
    elif domain == "nusabill":
        processed_df = build_nusabill_features(df)
    else:
        logger.error(f"[FEATURE_BUILD] Domain tidak dikenal — domain={domain}")
        raise ValueError(f"Domain tidak dikenal: {domain}")

    # 🔥 FIX AKURASI: Paksa seluruh kolom hasil akhir menjadi UPPERCASE
    processed_df.columns = processed_df.columns.str.upper()
    
    # 👇 ====== TAMBAHKAN BARIS INI ====== 👇
    # Hapus duplikat kolom akibat bentrokan huruf besar/kecil dari proses di atas
    processed_df = processed_df.loc[:, ~processed_df.columns.duplicated()]
    # 👆 ================================= 👆
    
    return processed_df