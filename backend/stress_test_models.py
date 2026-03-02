from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score

from fds_engine import DOMAIN_CONFIG, build_features as build_rf_features, load_model
from isolation_engine import DOMAIN_ISO_CONFIG, build_features as build_iso_features, load_isolation_meta, load_isolation_model


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
MODELS_DIR = BACKEND_DIR / "models"

RF_THRESHOLDS = {
    "agenusa": 0.4892,
    "nusabill": 0.5202,
}


def _metrics(y_true: np.ndarray, y_pred: np.ndarray, y_score: np.ndarray) -> dict[str, float]:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_fraud": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall_fraud": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1_fraud": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_score)),
    }


def _apply_scenario(df: pd.DataFrame, domain: str, scenario: str, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    out = df.copy()
    n = len(out)

    if domain == "agenusa":
        num_col = "AMOUNT"
        time_col = "TIMESTAMP_DB"
        cat_cols = ["TERMINAL_ID", "MERCHANT_ID", "DEST_ACCOUNT_NUMBER"]
    else:
        num_col = "PAYMENT_AMOUNT"
        time_col = "PAYMENT_DATE"
        cat_cols = ["CHANNEL", "BILL_STATUS"]

    if scenario in {"amount_jitter", "combo_shift"}:
        factor = rng.uniform(0.8, 1.25, size=n)
        out[num_col] = (out[num_col].astype(float) * factor).round().astype(int)

    if scenario in {"time_shift", "combo_shift"}:
        ts = pd.to_datetime(out[time_col], errors="coerce")
        out[time_col] = (ts + pd.to_timedelta(rng.integers(-48, 49, size=n), unit="h")).dt.strftime("%Y-%m-%d %H:%M:%S")

    if scenario in {"missing_noise", "combo_shift"}:
        for col in [num_col, *cat_cols]:
            idx = rng.choice(n, size=max(1, int(n * 0.08)), replace=False)
            out.loc[idx, col] = np.nan

    if scenario in {"unseen_category", "combo_shift"}:
        for col in cat_cols:
            idx = rng.choice(n, size=max(1, int(n * 0.12)), replace=False)
            out.loc[idx, col] = f"UNSEEN_{col}"

    return out


def evaluate_domain(domain: str, dataset_path: Path) -> dict[str, Any]:
    raw = pd.read_csv(dataset_path)
    scenarios = ["baseline", "amount_jitter", "time_shift", "missing_noise", "unseen_category", "combo_shift"]

    rf_model = load_model(domain)
    rf_drop = DOMAIN_CONFIG[domain]["drop_cols"]
    rf_threshold = RF_THRESHOLDS[domain]

    iso_model = load_isolation_model(domain)
    iso_drop = DOMAIN_ISO_CONFIG[domain]["drop_cols"]
    iso_meta = load_isolation_meta(domain)
    iso_review_th = float(iso_meta["thresholds"]["review_score_threshold"])

    report: dict[str, Any] = {}
    for i, scenario in enumerate(scenarios):
        scenario_df = raw if scenario == "baseline" else _apply_scenario(raw, domain, scenario, seed=42 + i)

        rf_feat = build_rf_features(domain, scenario_df.copy())
        y_true = rf_feat["IS_FRAUD"].astype(int).to_numpy()
        x_rf = rf_feat.drop(columns=["IS_FRAUD", *rf_drop], errors="ignore")
        rf_prob = rf_model.predict_proba(x_rf)[:, 1]
        rf_pred = (rf_prob >= rf_threshold).astype(int)

        iso_feat = build_iso_features(domain, scenario_df.copy())
        x_iso = iso_feat.drop(columns=["IS_FRAUD", *iso_drop], errors="ignore")
        iso_decision = iso_model.decision_function(x_iso)
        iso_anomaly = -iso_decision
        iso_pred = (iso_decision <= iso_review_th).astype(int)

        report[scenario] = {
            "random_forest": _metrics(y_true, rf_pred, rf_prob),
            "isolation_forest_review_boundary": _metrics(y_true, iso_pred, iso_anomaly),
        }

    return report


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    summary = {
        "generated_at_utc": pd.Timestamp.now(tz="UTC").isoformat(),
        "notes": "Stress test untuk robustness model terhadap noise, drift, missing values, unseen category.",
        "domains": {
            "agenusa": evaluate_domain("agenusa", BACKEND_DIR / "agenusa_pattern_dataset.csv"),
            "nusabill": evaluate_domain("nusabill", BACKEND_DIR / "nusabill_pattern_dataset.csv"),
        },
    }
    out = MODELS_DIR / "stress_test_report.json"
    out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Stress test report tersimpan: {out.relative_to(ROOT_DIR)}")
    print(json.dumps(summary["domains"], indent=2))


if __name__ == "__main__":
    main()
