from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from fds_engine import build_agenusa_features, build_nusabill_features, get_matched_patterns


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
MODELS_DIR = BACKEND_DIR / "models"


def build_pipeline(feature_df: pd.DataFrame, target_col: str) -> Pipeline:
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
    return Pipeline([("preprocessor", preprocessor), ("model", model)])


def tune_thresholds(y_true: np.ndarray, y_prob: np.ndarray) -> dict[str, Any]:
    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)
    if len(thresholds) == 0:
        return {"review_threshold": 0.55, "high_risk_threshold": 0.8}

    thresholds = np.concatenate(([0.0], thresholds))
    precision = np.clip(precision, 0.0, 1.0)
    recall = np.clip(recall, 0.0, 1.0)
    f1 = np.where((precision + recall) == 0, 0.0, 2 * (precision * recall) / (precision + recall))

    valid_recall = recall >= 0.85
    if valid_recall.any():
        candidate_idx = np.argmax(np.where(valid_recall, f1, -1.0))
    else:
        candidate_idx = int(np.argmax(f1))
    review_threshold = float(np.clip(thresholds[candidate_idx], 0.05, 0.95))

    valid_precision = precision >= 0.95
    if valid_precision.any():
        high_idx = np.argmax(np.where(valid_precision, recall, -1.0))
    else:
        high_idx = int(np.argmax(precision))
    high_risk_threshold = float(np.clip(thresholds[high_idx], max(review_threshold, 0.5), 0.99))

    if high_risk_threshold < review_threshold:
        high_risk_threshold = min(0.99, max(review_threshold + 0.05, 0.8))

    return {
        "review_threshold": round(review_threshold, 4),
        "high_risk_threshold": round(high_risk_threshold, 4),
        "selection_notes": {
            "review_target": "max F1 with recall >= 0.85 if available",
            "high_risk_target": "high precision zone (>=0.95) with highest recall",
        },
    }


def confusion_details(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, int]:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}


def evaluate_domain(
    domain: str,
    csv_path: Path,
    feature_builder,
    drop_cols: list[str],
    unique_id_cols: list[str],
    key_fields: list[str],
) -> dict[str, Any]:
    df_raw = pd.read_csv(csv_path)
    df_feat = feature_builder(df_raw)
    y = df_feat["IS_FRAUD"].astype(int).to_numpy()

    def run_variant(extra_drop_cols: list[str]) -> dict[str, Any]:
        x = df_feat.drop(columns=["IS_FRAUD", *drop_cols, *extra_drop_cols], errors="ignore")
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores: list[dict[str, float]] = []
        for train_idx, test_idx in skf.split(x, y):
            x_train, x_test = x.iloc[train_idx], x.iloc[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]
            pipe = build_pipeline(x_train, target_col="IS_FRAUD")
            pipe.fit(x_train, y_train)
            y_prob = pipe.predict_proba(x_test)[:, 1]
            y_pred = (y_prob >= 0.5).astype(int)
            cv_scores.append(
                {
                    "accuracy": float(accuracy_score(y_test, y_pred)),
                    "precision_fraud": float(precision_score(y_test, y_pred, zero_division=0)),
                    "recall_fraud": float(recall_score(y_test, y_pred, zero_division=0)),
                    "f1_fraud": float(f1_score(y_test, y_pred, zero_division=0)),
                    "roc_auc": float(roc_auc_score(y_test, y_prob)),
                }
            )

        x_train, x_holdout, y_train, y_holdout = train_test_split(
            x, y, test_size=0.25, random_state=42, stratify=y
        )
        pipe = build_pipeline(x_train, target_col="IS_FRAUD")
        pipe.fit(x_train, y_train)

        y_prob_holdout = pipe.predict_proba(x_holdout)[:, 1]
        tuned = tune_thresholds(y_holdout, y_prob_holdout)
        review_threshold = tuned["review_threshold"]
        y_pred_review = (y_prob_holdout >= review_threshold).astype(int)

        return {
            "cross_validation": {
                "folds": 5,
                "scores": cv_scores,
                "mean": {
                    "accuracy": float(np.mean([m["accuracy"] for m in cv_scores])),
                    "precision_fraud": float(np.mean([m["precision_fraud"] for m in cv_scores])),
                    "recall_fraud": float(np.mean([m["recall_fraud"] for m in cv_scores])),
                    "f1_fraud": float(np.mean([m["f1_fraud"] for m in cv_scores])),
                    "roc_auc": float(np.mean([m["roc_auc"] for m in cv_scores])),
                },
                "std": {
                    "accuracy": float(np.std([m["accuracy"] for m in cv_scores])),
                    "precision_fraud": float(np.std([m["precision_fraud"] for m in cv_scores])),
                    "recall_fraud": float(np.std([m["recall_fraud"] for m in cv_scores])),
                    "f1_fraud": float(np.std([m["f1_fraud"] for m in cv_scores])),
                    "roc_auc": float(np.std([m["roc_auc"] for m in cv_scores])),
                },
            },
            "holdout": {
                "accuracy": float(accuracy_score(y_holdout, y_pred_review)),
                "precision_fraud": float(precision_score(y_holdout, y_pred_review, zero_division=0)),
                "recall_fraud": float(recall_score(y_holdout, y_pred_review, zero_division=0)),
                "f1_fraud": float(f1_score(y_holdout, y_pred_review, zero_division=0)),
                "roc_auc": float(roc_auc_score(y_holdout, y_prob_holdout)),
                "confusion_matrix": confusion_details(y_holdout, y_pred_review),
            },
            "threshold_recommendation": tuned,
            "holdout_idx": x_holdout.index.to_numpy(),
            "y_prob_holdout": y_prob_holdout,
            "y_pred_holdout": y_pred_review,
            "y_true_holdout": y_holdout,
        }

    with_ids = run_variant(extra_drop_cols=[])
    without_ids = run_variant(extra_drop_cols=unique_id_cols)

    holdout_idx = with_ids["holdout_idx"]
    holdout_feat = df_feat.loc[holdout_idx].copy().reset_index(drop=True)
    holdout_raw = df_raw.loc[holdout_idx].copy().reset_index(drop=True)
    holdout_feat["Y_TRUE"] = with_ids["y_true_holdout"]
    holdout_feat["Y_PROB"] = with_ids["y_prob_holdout"]
    holdout_feat["Y_PRED"] = with_ids["y_pred_holdout"]
    holdout_feat["MATCHED_PATTERNS"] = holdout_feat.apply(lambda row: get_matched_patterns(domain, row), axis=1)

    fraud_only = holdout_feat[holdout_feat["Y_TRUE"] == 1]
    pattern_counts: dict[str, int] = {}
    for patterns in fraud_only["MATCHED_PATTERNS"]:
        for p in patterns:
            pattern_counts[p] = pattern_counts.get(p, 0) + 1

    fraud_total = int(len(fraud_only))
    fraud_with_pattern = int((fraud_only["MATCHED_PATTERNS"].apply(len) > 0).sum())

    def sample_cases(mask: pd.Series, top_desc: bool) -> list[dict[str, Any]]:
        idxs = holdout_feat[mask].sort_values("Y_PROB", ascending=not top_desc).head(5).index
        rows: list[dict[str, Any]] = []
        for idx in idxs:
            record = holdout_raw.loc[idx].to_dict()
            slim_record = {k: record.get(k) for k in key_fields}
            rows.append(
                {
                    "keys": slim_record,
                    "score": round(float(holdout_feat.loc[idx, "Y_PROB"]), 6),
                    "matched_patterns": holdout_feat.loc[idx, "MATCHED_PATTERNS"],
                    "actual_is_fraud": int(holdout_feat.loc[idx, "Y_TRUE"]),
                    "predicted_is_fraud": int(holdout_feat.loc[idx, "Y_PRED"]),
                }
            )
        return rows

    fp_mask = (holdout_feat["Y_TRUE"] == 0) & (holdout_feat["Y_PRED"] == 1)
    fn_mask = (holdout_feat["Y_TRUE"] == 1) & (holdout_feat["Y_PRED"] == 0)

    with_mean = with_ids["cross_validation"]["mean"]
    without_mean = without_ids["cross_validation"]["mean"]
    holdout_with = with_ids["holdout"]
    holdout_without = without_ids["holdout"]

    compare_delta = {
        "cv_recall_delta_without_ids": float(without_mean["recall_fraud"] - with_mean["recall_fraud"]),
        "cv_precision_delta_without_ids": float(without_mean["precision_fraud"] - with_mean["precision_fraud"]),
        "cv_f1_delta_without_ids": float(without_mean["f1_fraud"] - with_mean["f1_fraud"]),
        "cv_auc_delta_without_ids": float(without_mean["roc_auc"] - with_mean["roc_auc"]),
        "holdout_recall_delta_without_ids": float(holdout_without["recall_fraud"] - holdout_with["recall_fraud"]),
        "holdout_precision_delta_without_ids": float(
            holdout_without["precision_fraud"] - holdout_with["precision_fraud"]
        ),
        "holdout_f1_delta_without_ids": float(holdout_without["f1_fraud"] - holdout_with["f1_fraud"]),
        "holdout_auc_delta_without_ids": float(holdout_without["roc_auc"] - holdout_with["roc_auc"]),
    }

    return {
        "dataset": str(csv_path.relative_to(ROOT_DIR)),
        "rows": int(len(df_raw)),
        "fraud_rate": float(np.mean(y)),
        "model_comparison": {
            "with_ids": {
                "cross_validation": with_ids["cross_validation"],
                "holdout": with_ids["holdout"],
                "threshold_recommendation": with_ids["threshold_recommendation"],
            },
            "without_unique_ids": {
                "dropped_unique_id_cols": unique_id_cols,
                "cross_validation": without_ids["cross_validation"],
                "holdout": without_ids["holdout"],
                "threshold_recommendation": without_ids["threshold_recommendation"],
            },
            "delta_without_unique_ids_minus_with_ids": compare_delta,
        },
        "pattern_validation": {
            "fraud_rows_in_holdout": fraud_total,
            "fraud_rows_with_any_pattern": fraud_with_pattern,
            "pattern_coverage_rate": float((fraud_with_pattern / fraud_total) if fraud_total else 0.0),
            "pattern_counts_on_fraud_rows": dict(sorted(pattern_counts.items(), key=lambda item: item[1], reverse=True)),
        },
        "error_samples": {
            "false_positive_top5": sample_cases(fp_mask, top_desc=True),
            "false_negative_top5": sample_cases(fn_mask, top_desc=False),
        },
    }


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {
        "generated_at_utc": pd.Timestamp.now(tz="UTC").isoformat(),
        "domains": {},
        "notes": "Model dipakai untuk labeling dan manual review. Keputusan block tetap manual.",
    }
    report["domains"]["agenusa"] = evaluate_domain(
        domain="agenusa",
        csv_path=BACKEND_DIR / "agenusa_pattern_dataset.csv",
        feature_builder=build_agenusa_features,
        drop_cols=["TIMESTAMP_DB", "PREV_TIMESTAMP", "PREV_TERMINAL"],
        unique_id_cols=["ACCOUNT_NUMBER", "STAN"],
        key_fields=["ACCOUNT_NUMBER", "TIMESTAMP_DB", "AMOUNT", "DEST_ACCOUNT_NUMBER", "PROCESSING_CODE", "RESPONSE_CODE"],
    )
    report["domains"]["nusabill"] = evaluate_domain(
        domain="nusabill",
        csv_path=BACKEND_DIR / "nusabill_pattern_dataset.csv",
        feature_builder=build_nusabill_features,
        drop_cols=["BILL_DATE", "PAYMENT_DATE"],
        unique_id_cols=["BILL_ID", "CUSTOMER_ID"],
        key_fields=["CUSTOMER_ID", "BILL_ID", "BILL_AMOUNT", "PAYMENT_AMOUNT", "CHANNEL", "REFUND_FLAG"],
    )

    out_path = MODELS_DIR / "evaluation_report.json"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Evaluation report tersimpan: {out_path.relative_to(ROOT_DIR)}")
    print(json.dumps(report["domains"], indent=2))


if __name__ == "__main__":
    main()
