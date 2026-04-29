from __future__ import annotations

import json
import sys
from datetime import datetime
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

# Setup paths
ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
DATA_DIR = ROOT_DIR / "Playground" / "Data"
MODELS_DIR = ROOT_DIR / "Playground" / "models"

# Add backend to path so we can import isolation_engine
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Import from backend isolation_engine
from isolation_engine import DOMAIN_ISO_CONFIG, build_features  # type: ignore


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


def _round_threshold(value: float, decimals: int = 4) -> float:
    """Round threshold ke nilai yang meaningful (stabil secara statistik).
    
    Strategy:
    - Jika |value| < 1e-10, set ke 0.0
    - Else, round ke N decimals yang meaningful
    """
    if abs(value) < 1e-10:
        return 0.0
    
    # Round ke N decimals
    rounded = round(value, decimals)
    
    # Jika hasil 0 karena pembulatan, coba dengan more decimals
    if rounded == 0 and value != 0:
        for d in range(decimals + 1, 8):
            rounded = round(value, d)
            if rounded != 0:
                return rounded
        return 0.0
    
    return rounded


def train_one(domain: str, csv_path: Path, contamination: float, output_dir: Path | None = None) -> dict[str, Any]:
    if output_dir is None:
        output_dir = MODELS_DIR
    
    config = DOMAIN_ISO_CONFIG[domain]
    data = pd.read_csv(csv_path)
    feat = build_features(domain, data)
    x = feat.drop(columns=["IS_FRAUD", *config["drop_cols"]], errors="ignore")

    pipeline, numeric_cols, categorical_cols = _build_pipeline(x, contamination=contamination)
    pipeline.fit(x)

    scores = pipeline.decision_function(x)
    pred = pipeline.predict(x)  # -1 = anomaly, 1 = normal
    anomaly_rate = float((pred == -1).mean())

    # Generate thresholds from quantiles (CORRECT ORDER)
    # Lower quantile (0.03) = more negative scores = MORE ANOMALOUS = HIGH RISK ✅
    # Higher quantile (0.10) = less negative scores = LESS ANOMALOUS = REVIEW ✅
    high_risk_th_raw = float(np.quantile(scores, 0.03))
    review_th_raw = float(np.quantile(scores, 0.10))
    
    # Round to meaningful values (human-readable & statistically stable)
    high_risk_th = _round_threshold(high_risk_th_raw, decimals=4)
    review_th = _round_threshold(review_th_raw, decimals=4)
    
    # Verify correct ordering: high_risk_th < review_th
    assert high_risk_th < review_th, (
        f"ERROR: Threshold order inverted! "
        f"high_risk_th={high_risk_th} HARUS < review_th={review_th}"
    )

    # Save to versioned directory
    model_path = output_dir / f"{domain}_isolation_forest.pkl"
    meta_path = output_dir / f"{domain}_isolation_meta.json"
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
    # Create versioned directory with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    versioned_dir = MODELS_DIR / timestamp
    versioned_dir.mkdir(parents=True, exist_ok=True)
    
    summary: dict[str, Any] = {}

    summary["agenusa"] = train_one(
        domain="agenusa",
        csv_path=DATA_DIR / "agenusa_isolation_dataset.csv",
        contamination=0.08,
        output_dir=versioned_dir,
    )
    summary["nusabill"] = train_one(
        domain="nusabill",
        csv_path=DATA_DIR / "nusabill_isolation_dataset.csv",
        contamination=0.10,
        output_dir=versioned_dir,
    )

    summary_path = versioned_dir / "isolation_training_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("Training isolation selesai. Artefak:")
    print(f"- Version: {timestamp}")
    print(f"- Location: {versioned_dir.relative_to(ROOT_DIR)}/")
    print(f"- {summary['agenusa']['model_path']}")
    print(f"- {summary['nusabill']['model_path']}")
    print(f"- {summary_path.relative_to(ROOT_DIR)}")
    print("\nTraining Summary:")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
