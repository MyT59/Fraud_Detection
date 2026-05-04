from __future__ import annotations

import json
import sys
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

# Setup paths
ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
DATA_DIR = ROOT_DIR / "Playground" / "Data"
MODELS_DIR = ROOT_DIR / "Playground" / "models"

# Add backend to path so we can import app modules.
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.infrastructure.ml.isolation import DOMAIN_ISO_CONFIG, build_features, load_isolation_meta, load_isolation_model  # type: ignore


def round_floats(obj: Any, digits: int = 6) -> Any:
    if isinstance(obj, float):
        return round(obj, digits)
    if isinstance(obj, dict):
        return {k: round_floats(v, digits) for k, v in obj.items()}
    if isinstance(obj, list):
        return [round_floats(v, digits) for v in obj]
    return obj


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


def evaluate_domain(domain: str, data_path: Path) -> dict[str, Any]:
    config = DOMAIN_ISO_CONFIG[domain]
    model = load_isolation_model(domain)
    meta = load_isolation_meta(domain)

    df = pd.read_csv(data_path)
    feat = build_features(domain, df)
    x = feat.drop(columns=["IS_FRAUD", *config["drop_cols"]], errors="ignore")

    # Check if labeled data exists
    has_labels = "IS_FRAUD" in feat.columns and feat["IS_FRAUD"].sum() > 0
    
    if not has_labels:
        # Unsupervised evaluation - just report thresholds from training
        decision_score = model.decision_function(x)
        anomaly_score = -decision_score
        pred_default = (model.predict(x) == -1).astype(int)
        
        return {
            "data_type": "unlabeled",
            "notes": "Dataset tidak memiliki label IS_FRAUD. Hanya report thresholds dari training.",
            "dataset_size": len(x),
            "anomaly_count_at_default": int(pred_default.sum()),
            "anomaly_rate": float(pred_default.mean()),
            "training_metadata": meta,
            "evaluation": {
                "default_model_boundary": {
                    "threshold": None,
                    "precision_fraud": None,
                    "recall_fraud": None,
                    "f1_fraud": None,
                },
                "review_threshold_boundary": {
                    "threshold": meta["thresholds"]["review_score_threshold"],
                    "predictions": int((decision_score <= meta["thresholds"]["review_score_threshold"]).sum()),
                },
                "tuned_threshold_on_eval_data": {
                    "notes": "Tidak bisa di-tune tanpa ground truth",
                    "threshold": None,
                    "metrics": None,
                },
            },
        }
    
    # Labeled data - full evaluation
    y_true = feat["IS_FRAUD"].astype(int).to_numpy()
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
        "dataset": str(data_path.relative_to(ROOT_DIR)),
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


def build_markdown_summary(report: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# Isolation Evaluation Summary")
    lines.append("")
    lines.append(f"- Generated at (UTC): `{report['generated_at_utc']}`")
    lines.append(f"- Notes: {report['notes']}")
    lines.append("")

    for domain, data in report["domains"].items():
        lines.append(f"## {domain}")
        lines.append("")
        if "dataset" in data:
            lines.append(f"- Dataset: `{data['dataset']}`")
        if "rows" in data:
            lines.append(f"- Rows: `{data['rows']}`")
        if "fraud_rate" in data:
            lines.append(f"- Fraud Rate: `{data['fraud_rate']}`")
        if "isolation_meta" in data:
            lines.append(f"- Contamination: `{data['isolation_meta']['contamination']}` | Fit Anomaly Rate: `{data['isolation_meta']['fit_anomaly_rate']}`")
        if data.get("data_type") == "unlabeled":
            lines.append("")
            lines.append(f"- [UNLABELED] {data.get('notes','')}")
            lines.append(f"- Dataset size: {data.get('dataset_size')}")
            lines.append(f"- Anomaly rate (default): {data.get('anomaly_rate')}")
            lines.append("")
            continue
        # Labeled: print metrics
        default_m = data["evaluation"]["default_model_boundary"]
        review_m = data["evaluation"]["review_threshold_boundary"]
        tuned_m = data["evaluation"]["tuned_threshold_on_eval_data"]["metrics"]
        tuned_t = data["evaluation"]["tuned_threshold_on_eval_data"]["threshold"]
        default_th = data["isolation_meta"]["default_thresholds"]

        lines.append("| Scenario | Accuracy | Precision Fraud | Recall Fraud | F1 Fraud | ROC-AUC |")
        lines.append("|---|---:|---:|---:|---:|---:|")
        lines.append(
            f"| Default Model Boundary | {default_m['accuracy']} | {default_m['precision_fraud']} | {default_m['recall_fraud']} | {default_m['f1_fraud']} | {default_m['roc_auc']} |"
        )
        lines.append(
            f"| Review Threshold (`{default_th['review_score_threshold']}`) | {review_m['accuracy']} | {review_m['precision_fraud']} | {review_m['recall_fraud']} | {review_m['f1_fraud']} | {review_m['roc_auc']} |"
        )
        lines.append(
            f"| Tuned Threshold (`{tuned_t}`) | {tuned_m['accuracy']} | {tuned_m['precision_fraud']} | {tuned_m['recall_fraud']} | {tuned_m['f1_fraud']} | {tuned_m['roc_auc']} |"
        )
        lines.append("")

        cm = review_m["confusion_matrix"]
        lines.append(
            f"- Review-threshold confusion matrix: `TN={cm['tn']}, FP={cm['fp']}, FN={cm['fn']}, TP={cm['tp']}`"
        )
        fp_n = len(data["error_samples_review_threshold"]["false_positive_top5"])
        fn_n = len(data["error_samples_review_threshold"]["false_negative_top5"])
        lines.append(f"- Error samples saved: `false_positive_top5={fp_n}`, `false_negative_top5={fn_n}`")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "generated_at_utc": pd.Timestamp.now(tz="UTC").isoformat(),
        "notes": "Evaluasi isolation memakai dataset berlabel untuk benchmarking offline.",
        "domains": {
            "agenusa": evaluate_domain("agenusa", DATA_DIR / "agenusa_isolation_dataset.csv"),
            "nusabill": evaluate_domain("nusabill", DATA_DIR / "nusabill_isolation_dataset.csv"),
        },
    }

    report = round_floats(report, digits=6)
    out_path = MODELS_DIR / "isolation_evaluation_report.json"
    out_md_path = MODELS_DIR / "isolation_evaluation_summary.md"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    out_md_path.write_text(build_markdown_summary(report), encoding="utf-8")

    compact = {}
    for d, v in report["domains"].items():
        if v.get("data_type") == "unlabeled":
            compact[d] = {
                "review_threshold": v["training_metadata"]["thresholds"]["review_score_threshold"],
                "anomaly_rate": v.get("anomaly_rate"),
            }
        else:
            compact[d] = {
                "default_recall": v["evaluation"]["default_model_boundary"]["recall_fraud"],
                "review_recall": v["evaluation"]["review_threshold_boundary"]["recall_fraud"],
                "tuned_recall": v["evaluation"]["tuned_threshold_on_eval_data"]["metrics"]["recall_fraud"],
                "tuned_threshold": v["evaluation"]["tuned_threshold_on_eval_data"]["threshold"],
            }
    print(f"Isolation evaluation report tersimpan: {out_path.relative_to(ROOT_DIR)}")
    print(f"Isolation summary tersimpan: {out_md_path.relative_to(ROOT_DIR)}")
    print(json.dumps(compact, indent=2))


if __name__ == "__main__":
    main()
