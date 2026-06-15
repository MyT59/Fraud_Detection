from typing import Any
from .predictor import IsolationPredictor
from .model_loader import load_isolation_meta
from ...core.logging import get_logger, log_performance

logger = get_logger(__name__)

predictor = IsolationPredictor()


# =====================================================================
# NEW API: SNAPSHOT-BASED SCORING (Real-time inference)
# =====================================================================

@log_performance(label="ML.score_transaction_snapshot")
def score_transaction_snapshot(
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    """
    Score satu transaksi dari snapshot JSON.

    Ini adalah entry point utama untuk ML inference real-time.
    Snapshot berisi transaksi current + historical context.

    Args:
        snapshot: JSON snapshot dengan struktur:
            {
                "transaction": {
                    "id": 123,
                    "domain": "agenusa",
                    "account_number": "ACC123",
                    ...
                },
                "historical_context": {
                    "recent_account_transactions": [...]
                },
                "metadata": {...}
            }

    Returns:
        Dict dengan scoring results:
        {
            "transaction_id": 123,
            "domain": "agenusa",
            "score": 0.123456,
            "is_anomaly": False,
            "patterns": ["pattern1"],
            "thresholds": {...},
            "risk_level": "low"  # calculated dari score & thresholds
        }

    Raises:
        ValueError: Jika snapshot invalid atau domain unknown
    """
    if not snapshot:
        logger.error("[SCORE] Snapshot kosong — request ditolak")
        raise ValueError("Snapshot kosong")

    transaction = snapshot.get("transaction", {})
    domain = transaction.get("domain")

    if not domain:
        logger.error(
            f"[SCORE] Domain tidak ditemukan di snapshot — tx_id={transaction.get('id')}"
        )
        raise ValueError("Domain tidak ditemukan di snapshot transaction")

    # ===== PREDICT SCORE =====
    prediction = predictor.predict_score_from_snapshot(snapshot)

    # ===== LOAD METADATA & THRESHOLDS =====
    meta = load_isolation_meta(domain)

    # ===== DETERMINE RISK LEVEL =====
    # Isolation Forest decision_function() menghasilkan nilai di mana:
    #   NEGATIF = anomali (semakin negatif = semakin mencurigakan)
    #   POSITIF = normal
    #
    # Key threshold di meta JSON:
    #   "high_risk_score_threshold": -0.0053  (score <= ini → HIGH_RISK)
    #   "review_score_threshold"   :  0.0014  (score <= ini → REVIEW)
    score = prediction["score"]
    thresholds = meta.get("thresholds", {})

    high_risk_threshold = thresholds.get("high_risk_score_threshold", -0.005)
    review_threshold = thresholds.get("review_score_threshold", 0.001)

    if score <= high_risk_threshold:
        risk_level = "critical"
    elif score <= review_threshold:
        risk_level = "warning"
    else:
        risk_level = "low"

    # ===== BUILD RESPONSE =====
    result = {
        "transaction_id": transaction.get("id"),
        "domain": domain,
        "account_number": transaction.get("account_number"),
        "score": prediction["score"],
        "is_anomaly": prediction["is_anomaly"],
        "patterns": prediction["patterns"],
        "thresholds": thresholds,
        "risk_level": risk_level,
        "metadata": {
            "scored_at": snapshot.get("metadata", {}).get("snapshot_generated_at"),
            "model_version": meta.get("version"),
        }
    }

    logger.info(
        f"[SCORE] tx_id={result['transaction_id']} domain={domain} "
        f"score={result['score']} risk_level={risk_level} "
        f"is_anomaly={result['is_anomaly']} model_version={meta.get('version')}"
    )

    return result


# =====================================================================
# LEGACY API: BATCH-BASED SCORING (Deprecated)
# =====================================================================

@log_performance(label="ML.score_history_isolation")
def score_history_isolation(
    domain: str,
    records: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    DEPRECATED: Gunakan score_transaction_snapshot() untuk real-time.

    Score list of historical records (batch processing).
    Fungsi ini dipertahankan untuk backward compatibility.

    Pure ML scoring (NO business logic)
    """

    raw_results = predictor.predict_scores(domain, records)
    meta = load_isolation_meta(domain)

    logger.info(
        f"[SCORE_HISTORY] domain={domain} total_records={len(raw_results)} "
        f"model_version={meta.get('version')}"
    )

    return {
        "domain": domain,
        "total_records": len(raw_results),
        "thresholds": meta["thresholds"],  # kirim ke application
        "results": raw_results,
    }