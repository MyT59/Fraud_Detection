from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)

from isolation_engine import DOMAIN_ISO_CONFIG, build_features, load_isolation_meta, load_isolation_model


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
MODELS_DIR = BACKEND_DIR / "models"


def confusion_details(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, int]:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}


def metrics_block(y_true: np.ndarray, y_pred: np.ndarray, y_score: np.ndarray) -> dict[str, Any]:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_fraud": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall_fraud": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1_fraud": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_score)),
        "confusion_matrix": confusion_details(y_true, y_pred),
    }


def tune_threshold(y_true: np.ndarray, anomaly_score: np.ndarray) -> dict[str, Any]:
    precision, recall, thresholds = precision_recall_curve(y_true, anomaly_score)
    if len(thresholds) == 0:
        return {"best_threshold": 0.0}

    f1 = np.where((precision + recall) == 0, 0.0, 2 * precision * recall / (precision + recall))
    valid_recall = recall >= 0.85
    if valid_recall.any():
        idx = int(np.argmax(np.where(valid_recall, f1, -1.0)))
    else:
        idx = int(np.argmax(f1))

    threshold = float(thresholds[max(0, idx - 1)]) if idx >= len(thresholds) else float(thresholds[idx])
    return {
        "best_threshold": threshold,
        "selection_notes": "max F1 with recall >= 0.85 if available",
    }


def evaluate_domain(domain: str, labeled_path: Path) -> dict[str, Any]:
    config = DOMAIN_ISO_CONFIG[domain]
    model = load_isolation_model(domain)
    meta = load_isolation_meta(domain)

    df = pd.read_csv(labeled_path)
    feat = build_features(domain, df)
    y_true = feat["IS_FRAUD"].astype(int).to_numpy()
    x = feat.drop(columns=["IS_FRAUD", *config["drop_cols"]], errors="ignore")

    decision_score = model.decision_function(x)
    anomaly_score = -decision_score
    pred_default = (model.predict(x) == -1).astype(int)

    default_metrics = metrics_block(y_true, pred_default, anomaly_score)

    review_th = float(meta["thresholds"]["review_score_threshold"])
    pred_review = (decision_score <= review_th).astype(int)
    review_metrics = metrics_block(y_true, pred_review, anomaly_score)

    tuned = tune_threshold(y_true, anomaly_score)
    tuned_th = float(tuned["best_threshold"])
    pred_tuned = (anomaly_score >= tuned_th).astype(int)
    tuned_metrics = metrics_block(y_true, pred_tuned, anomaly_score)

    fp_mask = (y_true == 0) & (pred_review == 1)
    fn_mask = (y_true == 1) & (pred_review == 0)

    def sample_cases(mask: np.ndarray, top_desc: bool) -> list[dict[str, Any]]:
        idxs = np.where(mask)[0]
        if len(idxs) == 0:
            return []
        ordered = idxs[np.argsort(anomaly_score[idxs])]
        if top_desc:
            ordered = ordered[::-1]
        ordered = ordered[:5]

        fields = (
            ["ACCOUNT_NUMBER", "TIMESTAMP_DB", "AMOUNT", "DEST_ACCOUNT_NUMBER"]
            if domain == "agenusa"
            else ["CUSTOMER_ID", "BILL_ID", "BILL_AMOUNT", "PAYMENT_AMOUNT", "CHANNEL"]
        )
        rows: list[dict[str, Any]] = []
        for i in ordered:
            rec = df.iloc[i].to_dict()
            rows.append(
                {
                    "keys": {k: rec.get(k) for k in fields},
                    "decision_score": round(float(decision_score[i]), 6),
                    "anomaly_score": round(float(anomaly_score[i]), 6),
                    "actual_is_fraud": int(y_true[i]),
                    "predicted_is_fraud_review_th": int(pred_review[i]),
                }
            )
        return rows

    return {
        "dataset": str(labeled_path.relative_to(ROOT_DIR)),
        "rows": int(len(df)),
        "fraud_rate": float(y_true.mean()),
        "isolation_meta": {
            "contamination": float(meta["contamination"]),
            "fit_anomaly_rate": float(meta["anomaly_rate_fit_data"]),
            "default_thresholds": meta["thresholds"],
        },
        "evaluation": {
            "default_model_boundary": default_metrics,
            "review_threshold_boundary": review_metrics,
            "tuned_threshold_on_eval_data": {
                "threshold": tuned_th,
                "metrics": tuned_metrics,
                "selection_notes": tuned["selection_notes"],
            },
        },
        "error_samples_review_threshold": {
            "false_positive_top5": sample_cases(fp_mask, top_desc=True),
            "false_negative_top5": sample_cases(fn_mask, top_desc=False),
        },
    }


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "generated_at_utc": pd.Timestamp.now(tz="UTC").isoformat(),
        "notes": "Evaluasi isolation memakai dataset berlabel untuk benchmarking offline.",
        "domains": {
            "agenusa": evaluate_domain("agenusa", BACKEND_DIR / "agenusa_pattern_dataset.csv"),
            "nusabill": evaluate_domain("nusabill", BACKEND_DIR / "nusabill_pattern_dataset.csv"),
        },
    }

    out_path = MODELS_DIR / "isolation_evaluation_report.json"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Isolation evaluation report tersimpan: {out_path.relative_to(ROOT_DIR)}")
    print(json.dumps(report["domains"], indent=2))


if __name__ == "__main__":
    main()
