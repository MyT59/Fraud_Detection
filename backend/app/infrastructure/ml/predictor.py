import pandas as pd
from typing import Any, Optional
from .feature_builder import (
    build_features,
    build_features_from_snapshot,
    align_runtime_features,
    get_matched_patterns,
)
from .model_loader import load_isolation_model, DOMAIN_ISO_CONFIG
from ...core.logging import get_logger, log_performance

logger = get_logger(__name__)


class IsolationPredictor:

    # =====================================================================
    # NEW API: SNAPSHOT-BASED (Real-time inference)
    # =====================================================================

    @log_performance(label="ML.predict_score_from_snapshot")
    def predict_score_from_snapshot(
        self,
        snapshot: dict[str, Any],
    ) -> dict[str, Any]:
        # Validasi
        if not snapshot:
            logger.error("[PREDICT] Snapshot kosong — request ditolak")
            raise ValueError("Snapshot kosong")

        transaction = snapshot.get("transaction", {})
        domain = transaction.get("domain")

        if not domain or domain not in DOMAIN_ISO_CONFIG:
            logger.error(
                f"[PREDICT] Domain tidak dikenal atau tidak ada — "
                f"tx_id={transaction.get('id')} domain={domain}"
            )
            raise ValueError(f"Domain tidak dikenal atau tidak ada: {domain}")

        # ===== BUILD FEATURES DARI SNAPSHOT =====
        features_dict = build_features_from_snapshot(domain, snapshot)

        # ===== CONVERT DICT → 1-ROW DATAFRAME =====
        feature_df = pd.DataFrame([features_dict])

        # ===== PREDICT =====
        config = DOMAIN_ISO_CONFIG[domain]
        model = load_isolation_model(domain)

        # Drop non-feature columns
        x = feature_df.drop(
            columns=["IS_FRAUD", *config["drop_cols"]],
            errors="ignore"
        )
        x = align_runtime_features(domain, x)

        if hasattr(model, "feature_names_in_"):
            trained_features = set(model.feature_names_in_)
            runtime_features = set(x.columns)
            missing = trained_features - runtime_features
            extra = runtime_features - trained_features

            if missing or extra:
                logger.warning(
                    f"[ML_FEATURE_MISMATCH] domain={domain} "
                    f"tx_id={transaction.get('id')} missing={missing} extra={extra}"
                )

            logger.debug(
                f"[ML_FEATURE_DEBUG] domain={domain} "
                f"trained_features={sorted(trained_features)} "
                f"runtime_features={sorted(runtime_features)}"
            )

        # Get predictions
        score = float(model.decision_function(x)[0])
        pred = model.predict(x)[0]

        # ===== BUILD RESULT =====
        result = {
            "score": round(score, 6),
            "is_anomaly": bool(pred == -1),
            "patterns": get_matched_patterns(domain, features_dict),
            "transaction_id": transaction.get("id"),
            "account_number": transaction.get("account_number"),
        }

        logger.info(
            f"[PREDICT] tx_id={result['transaction_id']} domain={domain} "
            f"score={result['score']} is_anomaly={result['is_anomaly']} "
            f"patterns={result['patterns']}"
        )

        return result

    # =====================================================================
    # LEGACY API: BATCH-BASED
    # =====================================================================

    @log_performance(label="ML.predict_scores_batch")
    def predict_scores(
        self,
        domain: str,
        records: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if domain not in DOMAIN_ISO_CONFIG:
            raise ValueError(f"Domain tidak dikenal: {domain}")
        if not records:
            raise ValueError("Records kosong")

        raw_df = pd.DataFrame(records)
        feature_df = build_features(domain, raw_df)

        config = DOMAIN_ISO_CONFIG[domain]
        model = load_isolation_model(domain)
        x = feature_df.drop(
            columns=["IS_FRAUD", *config["drop_cols"]],
            errors="ignore"
        )
        x = align_runtime_features(domain, x)

        scores = model.decision_function(x)
        preds = model.predict(x)

        results: list[dict[str, Any]] = []
        for idx, row in feature_df.iterrows():
            anomaly_score = float(scores[idx])
            results.append(
                {
                    "score": round(anomaly_score, 6),
                    "is_anomaly": bool(preds[idx] == -1),
                    "patterns": get_matched_patterns(domain, row),
                }
            )

        anomaly_count = sum(1 for r in results if r["is_anomaly"])
        logger.info(
            f"[PREDICT_BATCH] domain={domain} total={len(results)} "
            f"anomalies={anomaly_count}"
        )

        return results
