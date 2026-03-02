from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from fds_engine import build_agenusa_features, build_nusabill_features


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
MODELS_DIR = BACKEND_DIR / "models"

def _build_pipeline(feature_df: pd.DataFrame, target_col: str) -> tuple[Pipeline, list[str], list[str]]:
    numeric_cols = [
        col
        for col in feature_df.columns
        if col != target_col and pd.api.types.is_numeric_dtype(feature_df[col])
    ]
    categorical_cols = [
        col
        for col in feature_df.columns
        if col != target_col and not pd.api.types.is_numeric_dtype(feature_df[col])
    ]

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

    model = RandomForestClassifier(
        n_estimators=350,
        max_depth=14,
        min_samples_leaf=2,
        random_state=42,
        class_weight="balanced_subsample",
        n_jobs=-1,
    )

    pipeline = Pipeline([("preprocessor", preprocessor), ("model", model)])
    return pipeline, numeric_cols, categorical_cols


def train_one_model(
    model_name: str,
    csv_path: Path,
    feature_builder,
    drop_cols: list[str],
    target_col: str = "IS_FRAUD",
) -> dict[str, Any]:
    data = pd.read_csv(csv_path)
    data = feature_builder(data)

    y = data[target_col].astype(int)
    x = data.drop(columns=[target_col, *drop_cols], errors="ignore")

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.25, random_state=42, stratify=y
    )

    pipeline, numeric_cols, categorical_cols = _build_pipeline(x_train, target_col=target_col)
    pipeline.fit(x_train, y_train)

    y_pred = pipeline.predict(x_test)
    y_prob = pipeline.predict_proba(x_test)[:, 1]

    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    auc = roc_auc_score(y_test, y_prob)

    model_path = MODELS_DIR / f"{model_name}_fds_model.pkl"
    joblib.dump(pipeline, model_path)

    return {
        "model_name": model_name,
        "dataset": str(csv_path.relative_to(ROOT_DIR)),
        "rows": int(len(data)),
        "fraud_rate": float(y.mean()),
        "numeric_features": numeric_cols,
        "categorical_features": categorical_cols,
        "accuracy": float(report["accuracy"]),
        "precision_fraud": float(report["1"]["precision"]),
        "recall_fraud": float(report["1"]["recall"]),
        "f1_fraud": float(report["1"]["f1-score"]),
        "roc_auc": float(auc),
        "model_path": str(model_path.relative_to(ROOT_DIR)),
    }


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    metrics: dict[str, Any] = {}
    metrics["agenusa"] = train_one_model(
        model_name="agenusa",
        csv_path=BACKEND_DIR / "agenusa_pattern_dataset.csv",
        feature_builder=build_agenusa_features,
        drop_cols=["TIMESTAMP_DB", "PREV_TIMESTAMP", "PREV_TERMINAL", "ACCOUNT_NUMBER", "STAN"],
    )
    metrics["nusabill"] = train_one_model(
        model_name="nusabill",
        csv_path=BACKEND_DIR / "nusabill_pattern_dataset.csv",
        feature_builder=build_nusabill_features,
        drop_cols=["BILL_DATE", "PAYMENT_DATE", "BILL_ID", "CUSTOMER_ID"],
    )

    metrics_path = MODELS_DIR / "training_metrics.json"
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print("Training selesai. Artefak tersimpan:")
    print(f"- {metrics['agenusa']['model_path']}")
    print(f"- {metrics['nusabill']['model_path']}")
    print(f"- {metrics_path.relative_to(ROOT_DIR)}")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
