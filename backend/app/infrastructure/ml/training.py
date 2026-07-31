from __future__ import annotations

import json
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
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ...paths import DATA_DIR, MODELS_DIR, PROJECT_ROOT
from .feature_builder import build_features
from .model_loader import DOMAIN_ISO_CONFIG
from ...core.logging import get_logger, log_performance

logger = get_logger(__name__)


def _default_model_version(domain: str) -> str:
    return f"{domain}_v{datetime.now().strftime('%Y%m%d%H%M%S%f')}"


def _build_pipeline(feature_df: pd.DataFrame, contamination: float) -> tuple[Pipeline, list[str], list[str]]:
    numeric_cols = [col for col in feature_df.columns if pd.api.types.is_numeric_dtype(feature_df[col])]
    categorical_cols = [col for col in feature_df.columns if not pd.api.types.is_numeric_dtype(feature_df[col])]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num", 
                Pipeline([
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler())  # 🔥 WAJIB DITAMBAHKAN
                ]), 
                numeric_cols
            ),
            (
                "cat",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore")),
                ]),
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
    if abs(value) < 1e-10:
        return 0.0

    rounded = round(value, decimals)
    if rounded == 0 and value != 0:
        for digits in range(decimals + 1, 8):
            rounded = round(value, digits)
            if rounded != 0:
                return rounded
        return 0.0

    return rounded


@log_performance(label="ML.train_one")
def train_one(
    domain: str,
    csv_path: Path,
    contamination: float,
    output_dir: Path | None = None,
    model_version: str | None = None,
) -> dict[str, Any]:
    output_dir = MODELS_DIR if output_dir is None else output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"[TRAIN] Start — domain={domain} dataset={csv_path} contamination={contamination}")

    config = DOMAIN_ISO_CONFIG[domain]
    data = pd.read_csv(csv_path)
    feature_df = build_features(domain, data)
    x = feature_df.drop(columns=["IS_FRAUD", *config["drop_cols"]], errors="ignore")

    pipeline, numeric_cols, categorical_cols = _build_pipeline(x, contamination=contamination)
    pipeline.fit(x)

    scores = pipeline.decision_function(x)
    pred = pipeline.predict(x)
    anomaly_rate = float((pred == -1).mean())

    high_risk_th = _round_threshold(float(np.quantile(scores, 0.03)), decimals=4)
    review_th = _round_threshold(float(np.quantile(scores, 0.10)), decimals=4)
    if high_risk_th >= review_th:
        logger.error(
            f"[TRAIN] FAILED — domain={domain} threshold order invalid "
            f"(high_risk={high_risk_th} >= review={review_th})"
        )
        raise ValueError(
            "Threshold order invalid: high_risk_score_threshold harus lebih kecil "
            "dari review_score_threshold."
        )

    model_path = output_dir / f"{domain}_isolation_forest.pkl"
    meta_path = output_dir / f"{domain}_isolation_meta.json"
    joblib.dump(pipeline, model_path)

    meta = {
        "version": model_version or _default_model_version(domain),
        "model_version": model_version or _default_model_version(domain),
        "domain": domain,
        "dataset": str(csv_path.relative_to(PROJECT_ROOT)),
        "rows": int(len(x)),
        "contamination": contamination,
        "anomaly_rate_fit_data": anomaly_rate,
        "thresholds": {
            "review_score_threshold": review_th,
            "high_risk_score_threshold": high_risk_th,
        },
        "numeric_features": numeric_cols,
        "categorical_features": categorical_cols,
        "model_path": str(model_path.relative_to(PROJECT_ROOT)),
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    logger.info(
        f"[TRAIN] Done — domain={domain} rows={len(x)} anomaly_rate={anomaly_rate:.4f} "
        f"high_risk_th={high_risk_th} review_th={review_th} model_path={model_path}"
    )

    return meta


@log_performance(label="ML.train_all")
def train_all(output_dir: Path | None = None) -> dict[str, Any]:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target_dir = MODELS_DIR / timestamp if output_dir is None else output_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"[TRAIN_ALL] Start — output_dir={target_dir}")

    summary = {
        "agenusa": train_one(
            domain="agenusa",
            csv_path=DATA_DIR / "agenusa_isolation_dataset.csv",
            contamination=0.08,
            output_dir=target_dir,
        ),
        "nusabill": train_one(
            domain="nusabill",
            csv_path=DATA_DIR / "nusabill_isolation_dataset.csv",
            contamination=0.10,
            output_dir=target_dir,
        ),
    }

    summary_path = target_dir / "isolation_training_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    logger.info(f"[TRAIN_ALL] Done — summary saved to {summary_path}")

    return summary

@log_performance(label="ML.train_from_dataframe")
def train_from_dataframe(
    domain: str,
    df: pd.DataFrame,
    contamination: float,
    output_dir: Path | None = None,
    model_version: str | None = None,
) -> dict[str, Any]:
    """Fungsi khusus untuk Retrain Service yang mengirimkan Dataframe gabungan (CSV + DB)"""
    output_dir = MODELS_DIR if output_dir is None else output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"[RETRAIN] Start — domain={domain} rows={len(df)} contamination={contamination}")

    config = DOMAIN_ISO_CONFIG[domain]
    
    # Feature builder biasanya sudah dipanggil di retrain_service, 
    # tapi kita pastikan kolom yang tidak perlu di-drop
    x = df.drop(columns=["IS_FRAUD", *config["drop_cols"]], errors="ignore")

    pipeline, numeric_cols, categorical_cols = _build_pipeline(x, contamination=contamination)
    pipeline.fit(x)

    scores = pipeline.decision_function(x)
    pred = pipeline.predict(x)
    anomaly_rate = float((pred == -1).mean())
    
    # Hitung threshold
    high_risk_th = _round_threshold(float(np.quantile(scores, 0.03)), decimals=4)
    review_th = _round_threshold(float(np.quantile(scores, 0.10)), decimals=4)

    # Identifikasi baris mana yang dianggap anomali untuk pattern discovery
    df_result = df.copy()
    df_result["IS_ANOMALY"] = (pred == -1).astype(int)
    anomaly_df = df_result[df_result["IS_ANOMALY"] == 1]

    # Save model
    model_path = output_dir / f"{domain}_isolation_forest.pkl"
    meta_path = output_dir / f"{domain}_isolation_meta.json"
    joblib.dump(pipeline, model_path)

    meta = {
        "version": model_version or _default_model_version(domain),
        "model_version": model_version or _default_model_version(domain),
        "domain": domain,
        "dataset": "retrain_hybrid_dataset",
        "rows": int(len(x)),
        "contamination": contamination,
        "anomaly_rate_fit_data": anomaly_rate,
        "thresholds": {
            "review_score_threshold": review_th,
            "high_risk_score_threshold": high_risk_th,
        },
        "numeric_features": numeric_cols,
        "categorical_features": categorical_cols,
        "model_path": str(model_path.relative_to(PROJECT_ROOT)),
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    logger.info(
        f"[RETRAIN] Done — domain={domain} rows={len(x)} anomaly_rate={anomaly_rate:.4f} "
        f"high_risk_th={high_risk_th} review_th={review_th} "
        f"anomalies_found={len(anomaly_df)} model_path={model_path}"
    )

    return {
        "meta": meta,
        "model_path": str(model_path),
        "meta_path": str(meta_path),
        "anomaly_df": anomaly_df,
        "anomalies_found": len(anomaly_df)
    }
