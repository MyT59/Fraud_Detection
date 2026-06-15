from pathlib import Path
from typing import Dict, Any

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.paths import MODELS_DIR
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)


class IsolationTrainingEngine:

    @log_performance(label="ML.IsolationTrainingEngine.train_and_detect")
    def train_and_detect(
        self,
        feature_df: pd.DataFrame,
        domain: str
    ) -> Dict[str, Any]:

        logger.info(
            f"[TRAIN_ENGINE] Start — domain={domain} rows={len(feature_df)}"
        )

        # Ambil hanya numeric feature
        x_numeric = feature_df.select_dtypes(include=["number"]).fillna(0)

        # Train model
        clf = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42
        )

        clf.fit(x_numeric)

        # Save model
        model_path = MODELS_DIR / f"{domain}_isolation_forest.joblib"
        joblib.dump(clf, model_path)

        # Predict anomaly
        preds = clf.predict(x_numeric)

        feature_df = feature_df.copy()
        feature_df["IS_ANOMALY"] = (preds == -1).astype(int)

        anomaly_df = feature_df[
            feature_df["IS_ANOMALY"] == 1
        ]

        logger.info(
            f"[TRAIN_ENGINE] Done — domain={domain} rows={len(feature_df)} "
            f"anomalies_found={len(anomaly_df)} model_path={model_path}"
        )

        return {
            "model_path": str(model_path),
            "anomaly_df": anomaly_df,
            "anomalies_found": len(anomaly_df),
        }