import pandas as pd
from typing import Any, Optional
from .feature_builder import (
    build_features,
    build_features_from_snapshot,
    get_matched_patterns,
)
from .model_loader import load_isolation_model, DOMAIN_ISO_CONFIG


class IsolationPredictor:
    """
    Predictor untuk Isolation Forest model.
    Mendukung dua mode:
    1. Snapshot-based: satu transaksi dengan riwayat (NEW - recommended)
    2. Batch-based: list flat dictionaries (LEGACY - deprecated)
    """

    # =====================================================================
    # NEW API: SNAPSHOT-BASED (Real-time inference)
    # =====================================================================

    def predict_score_from_snapshot(
        self,
        snapshot: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Score satu transaksi dari snapshot JSON.

        Args:
            snapshot: Nested JSON snapshot dengan struktur:
                {
                    "transaction": { ... },
                    "historical_context": { ... },
                    "metadata": { ... }
                }

        Returns:
            Dict dengan score dan anomaly flag:
            {
                "score": 0.123456,
                "is_anomaly": False,
                "patterns": ["pattern1", "pattern2"],
                "transaction_id": 123
            }

        Raises:
            ValueError: Jika domain unknown atau snapshot invalid
        """
        # Validasi
        if not snapshot:
            raise ValueError("Snapshot kosong")

        transaction = snapshot.get("transaction", {})
        domain = transaction.get("domain")

        if not domain or domain not in DOMAIN_ISO_CONFIG:
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

        # Ensure feature order matches model training
        required_features = config.get("feature_names", x.columns.tolist())
        x = x[required_features]

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

        return result

    # =====================================================================
    # LEGACY API: BATCH-BASED (Deprecated)
    # =====================================================================

    def predict_scores(
        self,
        domain: str,
        records: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """
        DEPRECATED: Gunakan predict_score_from_snapshot() untuk real-time.

        Score list of records menggunakan batch processing.
        Fungsi ini dipertahankan untuk backward compatibility.

        Args:
            domain: "agenusa" atau "nusabill"
            records: List of flat dictionaries (old format)

        Returns:
            List of prediction results
        """
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

        return results