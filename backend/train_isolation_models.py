from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from isolation_engine import DOMAIN_ISO_CONFIG, build_features


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
MODELS_DIR = BACKEND_DIR / "models"


def _build_pipeline(feature_df: pd.DataFrame, contamination: float) -> tuple[Pipeline, list[str], list[str]]:
    numeric_cols = [col for col in feature_df.columns if pd.api.types.is_numeric_dtype(feature_df[col])]
    categorical_cols = [col for col in feature_df.columns if not pd.api.types.is_numeric_dtype(feature_df[col])]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imputer", SimpleImputer(strategy="median"))]), numeric_cols),
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_cols,
            ),
        ]
    )

    model = IsolationForest(
        n_estimators=350,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )
    pipeline = Pipeline([("preprocessor", preprocessor), ("model", model)])
    return pipeline, numeric_cols, categorical_cols


def train_one(domain: str, csv_path: Path, contamination: float) -> dict[str, Any]:
    config = DOMAIN_ISO_CONFIG[domain]
    data = pd.read_csv(csv_path)
    feat = build_features(domain, data)
    x = feat.drop(columns=["IS_FRAUD", *config["drop_cols"]], errors="ignore")

    pipeline, numeric_cols, categorical_cols = _build_pipeline(x, contamination=contamination)
    pipeline.fit(x)

    scores = pipeline.decision_function(x)
    pred = pipeline.predict(x)
    anomaly_rate = float((pred == -1).mean())

    review_th = float(np.quantile(scores, 0.10))
    high_risk_th = float(np.quantile(scores, 0.03))

    model_path = config["model_path"]
    meta_path = config["meta_path"]
    joblib.dump(pipeline, model_path)
    meta = {
        "domain": domain,
        "dataset": str(csv_path.relative_to(ROOT_DIR)),
        "rows": int(len(x)),
        "contamination": contamination,
        "anomaly_rate_fit_data": anomaly_rate,
        "thresholds": {
            "review_score_threshold": review_th,
            "high_risk_score_threshold": high_risk_th,
        },
        "numeric_features": numeric_cols,
        "categorical_features": categorical_cols,
        "model_path": str(model_path.relative_to(ROOT_DIR)),
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    summary: dict[str, Any] = {}

    summary["agenusa"] = train_one(
        domain="agenusa",
        csv_path=BACKEND_DIR / "agenusa_isolation_dataset.csv",
        contamination=0.08,
    )
    summary["nusabill"] = train_one(
        domain="nusabill",
        csv_path=BACKEND_DIR / "nusabill_isolation_dataset.csv",
        contamination=0.10,
    )

    summary_path = MODELS_DIR / "isolation_training_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("Training isolation selesai. Artefak:")
    print(f"- {summary['agenusa']['model_path']}")
    print(f"- {summary['nusabill']['model_path']}")
    print(f"- {summary_path.relative_to(ROOT_DIR)}")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
