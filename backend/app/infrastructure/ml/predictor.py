import pandas as pd
from typing import Any
from .feature_builder import build_features, get_matched_patterns
from .model_loader import load_isolation_model, DOMAIN_ISO_CONFIG

class IsolationPredictor:
    def predict_scores(self, domain: str, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if domain not in DOMAIN_ISO_CONFIG:
            raise ValueError(f"Domain tidak dikenal: {domain}")
        if not records:
            raise ValueError("Records kosong")

        raw_df = pd.DataFrame(records)
        feature_df = build_features(domain, raw_df)

        config = DOMAIN_ISO_CONFIG[domain]
        model = load_isolation_model(domain)
        x = feature_df.drop(columns=["IS_FRAUD", *config["drop_cols"]], errors="ignore")

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