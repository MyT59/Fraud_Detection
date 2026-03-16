"""
retrain_router.py
─────────────────
Router FastAPI untuk Retrain Schedule Management.

Endpoints:
  GET    /retrain/schedules              → list semua schedule
  POST   /retrain/schedules              → buat schedule baru
  PUT    /retrain/schedules/{id}         → update schedule
  DELETE /retrain/schedules/{id}         → hapus schedule
  PATCH  /retrain/schedules/{id}/status  → toggle active/paused
  POST   /retrain/schedules/{id}/run     → trigger manual run
  GET    /retrain/history                → history semua run
  GET    /retrain/status                 → status scheduler (jobs aktif)
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

import io
import tempfile

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

# ── Storage paths ─────────────────────────────────────────────────────────────
BASE_DIR              = Path(__file__).resolve().parent
SCHEDULES_PATH        = BASE_DIR / "retrain_schedules.json"
RETRAIN_HISTORY_PATH  = BASE_DIR / "retrain_history.json"
PATTERN_DISCOVERY_PATH = BASE_DIR / "pattern_discovery.json"

router = APIRouter(prefix="/retrain", tags=["retrain-schedule"])


# ═══════════════════════════════════════════════════════════════════════════════
# Storage helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _load_schedules() -> list[dict[str, Any]]:
    if not SCHEDULES_PATH.exists():
        SCHEDULES_PATH.write_text("[]", encoding="utf-8")
    return json.loads(SCHEDULES_PATH.read_text(encoding="utf-8"))


def _save_schedules(data: list[dict[str, Any]]) -> None:
    SCHEDULES_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _load_history() -> list[dict[str, Any]]:
    if not RETRAIN_HISTORY_PATH.exists():
        RETRAIN_HISTORY_PATH.write_text("[]", encoding="utf-8")
    return json.loads(RETRAIN_HISTORY_PATH.read_text(encoding="utf-8"))


def _save_history(data: list[dict[str, Any]]) -> None:
    RETRAIN_HISTORY_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# ── Pattern discovery storage ─────────────────────────────────────────────────

def _load_patterns() -> list[dict[str, Any]]:
    if not PATTERN_DISCOVERY_PATH.exists():
        PATTERN_DISCOVERY_PATH.write_text("[]", encoding="utf-8")
    return json.loads(PATTERN_DISCOVERY_PATH.read_text(encoding="utf-8"))


def _save_patterns(data: list[dict[str, Any]]) -> None:
    PATTERN_DISCOVERY_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _now_local_str() -> str:
    """Format datetime lokal untuk lastRun/nextRun (WIB UTC+7)."""
    from datetime import timedelta
    now = datetime.now(timezone.utc) + timedelta(hours=7)
    return now.strftime("%Y-%m-%d %H:%M")


def _compute_next_run(schedule: dict[str, Any]) -> str:
    """Hitung nextRun string berdasarkan frequency, day, dan time."""
    from datetime import timedelta
    if schedule.get("status") != "active":
        return "—"

    freq       = schedule.get("frequency", "weekly")
    time_str   = schedule.get("time", "02:00")
    day_of_week = schedule.get("dayOfWeek")
    day_of_month = schedule.get("dayOfMonth")

    try:
        h, m = map(int, time_str.split(":"))
    except Exception:
        h, m = 2, 0

    now = datetime.now(timezone.utc) + timedelta(hours=7)
    today = now.replace(hour=h, minute=m, second=0, microsecond=0)

    WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    if freq == "daily":
        next_run = today if now < today else today + timedelta(days=1)

    elif freq == "weekly":
        target_dow = WEEKDAYS.index(day_of_week) if day_of_week in WEEKDAYS else 0
        current_dow = now.weekday()
        diff = (target_dow - current_dow) % 7
        if diff == 0 and now >= today:
            diff = 7
        next_run = today + timedelta(days=diff)

    elif freq == "monthly":
        try:
            target_day = int(day_of_month or 1)
        except Exception:
            target_day = 1
        candidate = today.replace(day=target_day)
        if candidate <= now:
            # bulan berikutnya
            if now.month == 12:
                candidate = candidate.replace(year=now.year + 1, month=1)
            else:
                candidate = candidate.replace(month=now.month + 1)
        next_run = candidate

    else:
        return "—"

    return next_run.strftime("%Y-%m-%d %H:%M")


# ═══════════════════════════════════════════════════════════════════════════════
# Pydantic schemas
# ═══════════════════════════════════════════════════════════════════════════════

VALID_MODELS = [
    "FraudNet v3.2",
    "AnomalyDetector v1.8",
    "RiskScorer v2.0",
    "PatternClassifier v4.1",
    "BehaviorAnalyzer v2.5",
    "TransactionGuard v1.3",
]

MODEL_TO_DOMAIN = {
    "FraudNet v3.2":        "agenusa",
    "AnomalyDetector v1.8": "nusabill",
    "RiskScorer v2.0":      "agenusa",
    "PatternClassifier v4.1": "nusabill",
    "BehaviorAnalyzer v2.5":  "agenusa",
    "TransactionGuard v1.3":  "nusabill",
}


class ScheduleCreate(BaseModel):
    name:        str = Field(..., min_length=2, max_length=120)
    model:       str
    frequency:   Literal["daily", "weekly", "monthly"]
    dayOfWeek:   Optional[str] = "Monday"
    dayOfMonth:  Optional[str] = "1"
    time:        str = "02:00"
    status:      Literal["active", "paused"] = "active"
    description: Optional[str] = ""


class ScheduleUpdate(BaseModel):
    name:        Optional[str]                              = None
    model:       Optional[str]                              = None
    frequency:   Optional[Literal["daily", "weekly", "monthly"]] = None
    dayOfWeek:   Optional[str]                              = None
    dayOfMonth:  Optional[str]                              = None
    time:        Optional[str]                              = None
    status:      Optional[Literal["active", "paused"]]     = None
    description: Optional[str]                             = None


class StatusPatch(BaseModel):
    status: Literal["active", "paused"]


# ═══════════════════════════════════════════════════════════════════════════════
# CRUD Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/schedules")
def list_schedules() -> dict[str, Any]:
    schedules = _load_schedules()
    # Recompute nextRun saat dibaca agar selalu fresh
    for s in schedules:
        if s.get("status") == "active":
            s["nextRun"] = _compute_next_run(s)
    stats = {
        "total":   len(schedules),
        "active":  sum(1 for s in schedules if s.get("status") == "active"),
        "paused":  sum(1 for s in schedules if s.get("status") == "paused"),
        "daily":   sum(1 for s in schedules if s.get("frequency") == "daily"),
        "weekly":  sum(1 for s in schedules if s.get("frequency") == "weekly"),
        "monthly": sum(1 for s in schedules if s.get("frequency") == "monthly"),
    }
    return {"schedules": schedules, "stats": stats}


@router.post("/schedules", status_code=201)
def create_schedule(payload: ScheduleCreate) -> dict[str, Any]:
    schedules = _load_schedules()

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    new_s: dict[str, Any] = {
        "id":          f"SCH-{uuid.uuid4().hex[:8].upper()}",
        "name":        payload.name,
        "model":       payload.model,
        "frequency":   payload.frequency,
        "dayOfWeek":   payload.dayOfWeek if payload.frequency == "weekly" else None,
        "dayOfMonth":  payload.dayOfMonth if payload.frequency == "monthly" else None,
        "time":        payload.time,
        "status":      payload.status,
        "description": payload.description or "",
        "lastRun":     "—",
        "nextRun":     "—",
        "createdAt":   today,
    }
    new_s["nextRun"] = _compute_next_run(new_s)

    schedules.insert(0, new_s)
    _save_schedules(schedules)

    # Daftarkan ke scheduler jika active
    if new_s["status"] == "active":
        _register_job(new_s)

    return {"message": f"Schedule '{payload.name}' berhasil dibuat.", "schedule": new_s}


@router.put("/schedules/{schedule_id}")
def update_schedule(schedule_id: str, payload: ScheduleUpdate) -> dict[str, Any]:
    schedules = _load_schedules()
    idx = next((i for i, s in enumerate(schedules) if s["id"] == schedule_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' tidak ditemukan.")

    s = schedules[idx]
    update = payload.model_dump(exclude_none=True)

    # Jika frequency berubah, reset day fields
    if "frequency" in update:
        if update["frequency"] != "weekly":
            s["dayOfWeek"] = None
        if update["frequency"] != "monthly":
            s["dayOfMonth"] = None

    s.update(update)
    s["nextRun"] = _compute_next_run(s)
    schedules[idx] = s
    _save_schedules(schedules)

    # Re-register job di scheduler
    _unregister_job(schedule_id)
    if s.get("status") == "active":
        _register_job(s)

    return {"message": f"Schedule '{s['name']}' berhasil diperbarui.", "schedule": s}


@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: str) -> dict[str, Any]:
    schedules = _load_schedules()
    target = next((s for s in schedules if s["id"] == schedule_id), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' tidak ditemukan.")

    _unregister_job(schedule_id)
    _save_schedules([s for s in schedules if s["id"] != schedule_id])
    return {"message": f"Schedule '{target['name']}' berhasil dihapus.", "deleted_id": schedule_id}


@router.patch("/schedules/{schedule_id}/status")
def toggle_status(schedule_id: str, payload: StatusPatch) -> dict[str, Any]:
    schedules = _load_schedules()
    idx = next((i for i, s in enumerate(schedules) if s["id"] == schedule_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' tidak ditemukan.")

    s = schedules[idx]
    old_status    = s.get("status")
    s["status"]   = payload.status
    s["nextRun"]  = _compute_next_run(s)
    schedules[idx] = s
    _save_schedules(schedules)

    _unregister_job(schedule_id)
    if payload.status == "active":
        _register_job(s)

    verb = "diaktifkan" if payload.status == "active" else "di-pause"
    return {
        "message":    f"Schedule '{s['name']}' berhasil {verb}.",
        "schedule_id": schedule_id,
        "old_status":  old_status,
        "new_status":  payload.status,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Manual Run
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/schedules/{schedule_id}/run")
def manual_run(schedule_id: str) -> dict[str, Any]:
    schedules = _load_schedules()
    idx = next((i for i, s in enumerate(schedules) if s["id"] == schedule_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Schedule '{schedule_id}' tidak ditemukan.")

    s = schedules[idx]
    result = _execute_retrain(s, trigger="manual")

    # Update lastRun
    now_str = _now_local_str()
    s["lastRun"] = now_str
    schedules[idx] = s
    _save_schedules(schedules)

    return {
        "message": f"Manual run '{s['name']}' selesai.",
        "schedule_id": schedule_id,
        "result": result,
        "lastRun": now_str,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# History
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/history")
def get_history(
    schedule_id: Optional[str] = None,
    domain: Optional[str] = None,
    limit: int = 50,
) -> dict[str, Any]:
    history = _load_history()
    if schedule_id:
        history = [h for h in history if h.get("schedule_id") == schedule_id]
    if domain:
        history = [h for h in history if h.get("domain") == domain]
    return {
        "history": history[:limit],
        "total": len(history),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Scheduler status
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
def scheduler_status() -> dict[str, Any]:
    """Kembalikan status APScheduler dan daftar job aktif."""
    try:
        from retrain_scheduler import get_scheduler_status
        return get_scheduler_status()
    except Exception as e:
        return {"running": False, "error": str(e), "jobs": []}


# ═══════════════════════════════════════════════════════════════════════════════
# Core retrain execution
# ═══════════════════════════════════════════════════════════════════════════════

def _execute_retrain(schedule: dict[str, Any], trigger: str = "scheduled") -> dict[str, Any]:
    """
    Jalankan retrain untuk model yang ada di schedule.
    Mapping model → domain → train_fds_models / train_isolation_models.
    """
    import traceback

    schedule_id = schedule.get("id", "unknown")
    model_name  = schedule.get("model", "")
    domain      = MODEL_TO_DOMAIN.get(model_name)
    started_at  = _now_iso()

    history_entry: dict[str, Any] = {
        "id":          f"RUN-{uuid.uuid4().hex[:8].upper()}",
        "schedule_id": schedule_id,
        "schedule_name": schedule.get("name", ""),
        "model":       model_name,
        "domain":      domain or "unknown",
        "trigger":     trigger,
        "started_at":  started_at,
        "finished_at": None,
        "status":      "running",
        "metrics":     {},
        "error":       None,
    }

    history = _load_history()
    history.insert(0, history_entry)
    _save_history(history)

    try:
        if domain is None:
            raise ValueError(f"Domain tidak dikenali untuk model '{model_name}'.")

        metrics = _run_training(domain, run_id=history_entry["id"])
        history_entry["status"]      = "success"
        history_entry["metrics"]     = metrics
        history_entry["finished_at"] = _now_iso()

    except Exception as exc:
        history_entry["status"]      = "failed"
        history_entry["error"]       = traceback.format_exc()
        history_entry["finished_at"] = _now_iso()
        print(f"[RetrainScheduler] ERROR schedule={schedule_id}: {exc}")

    # Simpan hasil akhir
    history = _load_history()
    for i, h in enumerate(history):
        if h["id"] == history_entry["id"]:
            history[i] = history_entry
            break
    _save_history(history)

    return history_entry


def _run_training(domain: str, run_id: str | None = None) -> dict[str, Any]:
    """
    Jalankan training ulang RF + Isolation Forest untuk satu domain.
    Setelah selesai, extract feature importances & threshold sebagai
    pattern discovery dan simpan ke pattern_discovery.json.
    """
    from pathlib import Path as _Path

    backend_dir = _Path(__file__).resolve().parent

    import importlib.util, sys

    def _import_script(script_path: _Path, module_name: str):
        spec   = importlib.util.spec_from_file_location(module_name, script_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        return module

    # ── Train Random Forest ──────────────────────────────────────────────────
    train_fds  = _import_script(backend_dir / "train_fds_models.py", "train_fds_models")
    fds_result = train_fds.train_one_model(
        model_name      = domain,
        csv_path        = backend_dir / f"{domain}_pattern_dataset.csv",
        feature_builder = (
            train_fds.build_agenusa_features if domain == "agenusa"
            else train_fds.build_nusabill_features
        ),
        drop_cols = (
            ["TIMESTAMP_DB", "PREV_TIMESTAMP", "PREV_TERMINAL", "ACCOUNT_NUMBER", "STAN"]
            if domain == "agenusa"
            else ["BILL_DATE", "PAYMENT_DATE", "BILL_ID", "CUSTOMER_ID"]
        ),
    )

    # ── Train Isolation Forest ───────────────────────────────────────────────
    train_iso     = _import_script(backend_dir / "train_isolation_models.py", "train_isolation_models")
    contamination = 0.08 if domain == "agenusa" else 0.10
    iso_result    = train_iso.train_one(
        domain        = domain,
        csv_path      = backend_dir / f"{domain}_isolation_dataset.csv",
        contamination = contamination,
    )

    # ── Invalidate lru_cache ─────────────────────────────────────────────────
    try:
        from fds_engine import load_model
        load_model.cache_clear()
        from isolation_engine import load_isolation_model, load_isolation_meta
        load_isolation_model.cache_clear()
        load_isolation_meta.cache_clear()
    except Exception:
        pass

    metrics = {
        "random_forest": {
            "accuracy":        fds_result.get("accuracy"),
            "precision_fraud": fds_result.get("precision_fraud"),
            "recall_fraud":    fds_result.get("recall_fraud"),
            "f1_fraud":        fds_result.get("f1_fraud"),
            "roc_auc":         fds_result.get("roc_auc"),
        },
        "isolation_forest": {
            "contamination":       iso_result.get("contamination"),
            "anomaly_rate":        iso_result.get("anomaly_rate_fit_data"),
            "review_threshold":    iso_result.get("thresholds", {}).get("review_score_threshold"),
            "high_risk_threshold": iso_result.get("thresholds", {}).get("high_risk_score_threshold"),
        },
    }

    # ── Extract & simpan pattern discovery ───────────────────────────────────
    try:
        _extract_and_save_patterns(
            domain     = domain,
            metrics    = metrics,
            iso_result = iso_result,
            trigger    = "scheduled",
            run_id     = run_id,
        )
    except Exception as e:
        print(f"[PatternDiscovery] Gagal extract patterns: {e}")

    return metrics


# ═══════════════════════════════════════════════════════════════════════════════
# Pattern Discovery — Extract & Store
# ═══════════════════════════════════════════════════════════════════════════════

# Mapping feature → nama pattern yang sudah dikenali
_FEATURE_PATTERN_MAP: dict[str, dict[str, str]] = {
    # Agenusa
    "IS_BRUTE_PATTERN":        {"key": "bruteforce_pin_pattern",              "label": "Brute Force PIN Attack",             "domain": "agenusa"},
    "IS_MONEY_MULE_DEST":      {"key": "money_mule_destination",              "label": "Money Mule Destination",             "domain": "agenusa"},
    "TERMINAL_SWITCH_FAST":    {"key": "impossible_travel_terminal_switch",   "label": "Impossible Travel / Terminal Switch","domain": "agenusa"},
    "IS_HIGH_AMOUNT_PATTERN":  {"key": "high_amount_spike",                   "label": "High Amount Spike",                  "domain": "agenusa"},
    "MIDNIGHT_AMOUNT_SPIKE":   {"key": "midnight_unusual_amount",             "label": "Midnight Unusual Amount",            "domain": "agenusa"},
    "RAPID_RETRY_DECLINED":    {"key": "rapid_retry_declined",                "label": "Rapid Retry on Declined",            "domain": "agenusa"},
    "IS_DECLINED":             {"key": "declined_transaction",                "label": "Declined Transaction Pattern",       "domain": "agenusa"},
    "IS_NIGHT_TX":             {"key": "night_transaction",                   "label": "Night Transaction",                  "domain": "agenusa"},
    "AMOUNT_OVER_AVG_RATIO":   {"key": "amount_over_average",                 "label": "Amount Over Average Ratio",          "domain": "agenusa"},
    # Nusabill
    "UNDERPAY_FLAG":           {"key": "underpayment",                        "label": "Underpayment Pattern",               "domain": "nusabill"},
    "HIGH_SPIKE_FLAG":         {"key": "payment_spike",                       "label": "Payment Amount Spike",               "domain": "nusabill"},
    "REFUND_FLAG":             {"key": "refund_abuse_pattern",                "label": "Refund Abuse Pattern",               "domain": "nusabill"},
    "BURST_FLAG":              {"key": "burst_payment_pattern",               "label": "Burst Payment Pattern",              "domain": "nusabill"},
    "CHANNEL_SWITCH_TO_API":   {"key": "sudden_channel_switch_to_api",        "label": "Sudden Channel Switch to API",       "domain": "nusabill"},
    "EARLY_PAYMENT_ANOMALY":   {"key": "payment_date_anomaly",                "label": "Payment Date Anomaly",               "domain": "nusabill"},
    "CHANNEL_API_FLAG":        {"key": "api_channel_usage",                   "label": "API Channel Usage",                  "domain": "nusabill"},
    "PAYMENT_DELAY_DAYS":      {"key": "payment_delay_pattern",               "label": "Payment Delay Pattern",              "domain": "nusabill"},
}

# Threshold importance — feature dengan importance >= ini dianggap "significant"
_IMPORTANCE_THRESHOLD = 0.03


def _extract_and_save_patterns(
    domain:     str,
    metrics:    dict[str, Any],
    iso_result: dict[str, Any],
    trigger:    str = "scheduled",
    run_id:     str | None = None,
) -> dict[str, Any]:
    """
    Extract feature importances dari model RF yang baru dilatih,
    deteksi pattern signifikan, dan simpan ke pattern_discovery.json.

    Format tiap entry yang disimpan sudah siap untuk di-upsert ke DB
    oleh temanmu — cukup ganti _save_patterns() dengan DB insert/upsert.
    """
    import joblib

    model_path  = BASE_DIR / "models" / f"{domain}_fds_model.pkl"
    if not model_path.exists():
        raise FileNotFoundError(f"Model {domain} tidak ditemukan: {model_path}")

    pipeline    = joblib.load(model_path)
    rf_model    = pipeline.named_steps["model"]
    preprocessor = pipeline.named_steps["preprocessor"]

    # ── Ambil nama feature setelah preprocessing ──────────────────────────────
    try:
        feature_names: list[str] = []
        for name, transformer, cols in preprocessor.transformers_:
            if name == "num":
                feature_names.extend(cols)
            elif name == "cat":
                ohe = transformer.named_steps["onehot"]
                feature_names.extend(ohe.get_feature_names_out(cols).tolist())
    except Exception:
        feature_names = [f"feature_{i}" for i in range(len(rf_model.feature_importances_))]

    importances = rf_model.feature_importances_

    # ── Pasangkan feature → importance ───────────────────────────────────────
    feat_imp: dict[str, float] = {
        name: round(float(imp), 6)
        for name, imp in zip(feature_names, importances)
    }

    # ── Identifikasi pattern signifikan ──────────────────────────────────────
    discovered: list[dict[str, Any]] = []
    for feat, imp in sorted(feat_imp.items(), key=lambda x: x[1], reverse=True):
        # Ambil nama feature dasar (sebelum OHE suffix seperti _Mobile, _Web)
        base_feat = feat.split("_")[0] if feat not in _FEATURE_PATTERN_MAP else feat
        # Cek exact match dulu, lalu prefix match
        meta = _FEATURE_PATTERN_MAP.get(feat) or next(
            (v for k, v in _FEATURE_PATTERN_MAP.items() if feat.startswith(k)),
            None
        )
        if imp >= _IMPORTANCE_THRESHOLD:
            discovered.append({
                "feature":    feat,
                "importance": imp,
                "pattern_key":   meta["key"]   if meta else feat.lower(),
                "pattern_label": meta["label"] if meta else feat.replace("_", " ").title(),
                "is_known_pattern": meta is not None,
            })

    # ── Threshold terbaru dari Isolation Forest ───────────────────────────────
    thresholds = iso_result.get("thresholds", {}) if isinstance(iso_result, dict) else {}

    # ── Bangun discovery entry ────────────────────────────────────────────────
    now = _now_iso()
    entry: dict[str, Any] = {
        # ── Identity ─────────────────────────────────────────────────────────
        "id":              f"PAT-{uuid.uuid4().hex[:8].upper()}",
        "run_id":          run_id,
        "domain":          domain,
        "trigger":         trigger,
        "discovered_at":   now,

        # ── Model metrics saat ini ────────────────────────────────────────────
        "model_metrics": {
            "accuracy":        metrics.get("random_forest", {}).get("accuracy"),
            "precision_fraud": metrics.get("random_forest", {}).get("precision_fraud"),
            "recall_fraud":    metrics.get("random_forest", {}).get("recall_fraud"),
            "f1_fraud":        metrics.get("random_forest", {}).get("f1_fraud"),
            "roc_auc":         metrics.get("random_forest", {}).get("roc_auc"),
        },

        # ── Threshold terbaru ─────────────────────────────────────────────────
        "thresholds": {
            "review_score_threshold":    thresholds.get("review_score_threshold"),
            "high_risk_score_threshold": thresholds.get("high_risk_score_threshold"),
        },

        # ── Top feature importances (semua) ───────────────────────────────────
        "feature_importances": dict(
            sorted(feat_imp.items(), key=lambda x: x[1], reverse=True)[:20]
        ),

        # ── Pattern yang signifikan (importance >= threshold) ─────────────────
        "significant_patterns": discovered,

        # ── Summary ───────────────────────────────────────────────────────────
        "summary": {
            "total_features":          len(feat_imp),
            "significant_features":    len(discovered),
            "known_patterns_found":    sum(1 for d in discovered if d["is_known_pattern"]),
            "new_patterns_found":      sum(1 for d in discovered if not d["is_known_pattern"]),
            "top_pattern":             discovered[0]["pattern_label"] if discovered else None,
            "top_feature_importance":  discovered[0]["importance"]    if discovered else None,
        },

        # ── Placeholder untuk DB ──────────────────────────────────────────────
        # TODO (temanmu): ganti _save_patterns() di bawah dengan DB upsert.
        # Gunakan domain + discovered_at sebagai composite key,
        # atau pattern_key + domain untuk upsert per-pattern.
        "db_status": "pending",  # pending | saved
    }

    # ── Simpan ke JSON (placeholder sebelum DB tersedia) ─────────────────────
    patterns = _load_patterns()

    # Hanya simpan 50 entry terbaru per domain agar file tidak membesar
    patterns = [p for p in patterns if p.get("domain") != domain][:49]
    patterns.insert(0, entry)
    _save_patterns(patterns)

    print(
        f"[PatternDiscovery] Domain={domain} | "
        f"significant={entry['summary']['significant_features']} | "
        f"known={entry['summary']['known_patterns_found']} | "
        f"new={entry['summary']['new_patterns_found']}"
    )

    return entry


# ═══════════════════════════════════════════════════════════════════════════════
# Pattern Discovery Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/patterns")
def get_patterns(
    domain: str | None = None,
    limit:  int        = 20,
) -> dict[str, Any]:
    """
    Ambil hasil pattern discovery dari retrain terbaru.

    Query params:
      - domain : filter by 'agenusa' | 'nusabill' (opsional)
      - limit  : jumlah entry (default 20)

    Catatan untuk DB integration (temanmu):
      Ganti _load_patterns() di sini dengan query ke tabel pattern_discovery.
      Contoh: SELECT * FROM pattern_discovery ORDER BY discovered_at DESC LIMIT ?
    """
    patterns = _load_patterns()
    if domain:
        patterns = [p for p in patterns if p.get("domain") == domain]

    return {
        "patterns":    patterns[:limit],
        "total":       len(patterns),
        "note":        (
            "Data ini berasal dari pattern_discovery.json (placeholder). "
            "Sambungkan ke DB saat database pattern sudah tersedia."
        ),
        # ── Agregasi cepat untuk frontend ────────────────────────────────────
        "summary": {
            d: {
                "latest_discovered_at": next(
                    (p["discovered_at"] for p in patterns if p.get("domain") == d), None
                ),
                "latest_top_pattern": next(
                    (p["summary"]["top_pattern"] for p in patterns if p.get("domain") == d), None
                ),
                "latest_f1": next(
                    (p["model_metrics"].get("f1_fraud") for p in patterns if p.get("domain") == d), None
                ),
            }
            for d in ["agenusa", "nusabill"]
        },
    }


@router.get("/patterns/latest")
def get_latest_patterns() -> dict[str, Any]:
    """
    Ambil 1 entry pattern discovery terbaru per domain.
    Berguna untuk dashboard / summary card.
    """
    patterns = _load_patterns()
    result   = {}
    for d in ["agenusa", "nusabill"]:
        entry = next((p for p in patterns if p.get("domain") == d), None)
        result[d] = entry
    return {"latest": result}


# ═══════════════════════════════════════════════════════════════════════════════
# APScheduler bridge (dipanggil dari retrain_scheduler.py)
# ═══════════════════════════════════════════════════════════════════════════════

def _register_job(schedule: dict[str, Any]) -> None:
    """Daftarkan job baru ke APScheduler (jika sudah running)."""
    try:
        from retrain_scheduler import register_schedule_job
        register_schedule_job(schedule)
    except Exception as e:
        print(f"[RetrainRouter] Gagal daftarkan job: {e}")


def _unregister_job(schedule_id: str) -> None:
    """Hapus job dari APScheduler."""
    try:
        from retrain_scheduler import unregister_schedule_job
        unregister_schedule_job(schedule_id)
    except Exception as e:
        print(f"[RetrainRouter] Gagal hapus job: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# Upload CSV & Quick Retrain
# ═══════════════════════════════════════════════════════════════════════════════

# Kolom wajib per domain untuk auto-detect
_AGENUSA_SIGNATURE  = {"TERMINAL_ID", "MERCHANT_ID", "ACCOUNT_NUMBER", "PROCESSING_CODE", "RESPONSE_CODE", "MTI"}
_NUSABILL_SIGNATURE = {"BILL_ID", "CUSTOMER_ID", "BILL_AMOUNT", "BILL_DATE", "PAYMENT_DATE", "BILL_STATUS"}


def _detect_domain(columns: list[str]) -> str | None:
    """Auto-detect domain dari kolom CSV. Return 'agenusa', 'nusabill', atau None."""
    col_set = set(columns)
    score_agenusa  = len(_AGENUSA_SIGNATURE  & col_set)
    score_nusabill = len(_NUSABILL_SIGNATURE & col_set)
    if score_agenusa == 0 and score_nusabill == 0:
        return None
    return "agenusa" if score_agenusa >= score_nusabill else "nusabill"


def _run_training_from_csv(domain: str, csv_path: Path, run_id: str | None = None) -> dict[str, Any]:
    """
    Jalankan training RF + Isolation Forest dari CSV yang diupload.
    CSV dipakai sebagai dataset baru, menggantikan file lama.
    Setelah selesai, extract pattern discovery dan simpan ke JSON.
    """
    import importlib.util, sys, shutil

    backend_dir = BASE_DIR

    def _import_script(script_path: Path, module_name: str):
        spec   = importlib.util.spec_from_file_location(module_name, script_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        return module

    # ── Backup dataset lama ──────────────────────────────────────────────────
    pattern_dst   = backend_dir / f"{domain}_pattern_dataset.csv"
    isolation_dst = backend_dir / f"{domain}_isolation_dataset.csv"

    if pattern_dst.exists():
        shutil.copy2(pattern_dst, pattern_dst.with_suffix(".csv.bak"))
    if isolation_dst.exists():
        shutil.copy2(isolation_dst, isolation_dst.with_suffix(".csv.bak"))

    # ── Salin CSV upload ke kedua dataset ────────────────────────────────────
    shutil.copy2(csv_path, pattern_dst)
    shutil.copy2(csv_path, isolation_dst)

    # ── Train Random Forest ──────────────────────────────────────────────────
    train_fds  = _import_script(backend_dir / "train_fds_models.py", "train_fds_models_quick")
    fds_result = train_fds.train_one_model(
        model_name      = domain,
        csv_path        = pattern_dst,
        feature_builder = (
            train_fds.build_agenusa_features if domain == "agenusa"
            else train_fds.build_nusabill_features
        ),
        drop_cols = (
            ["TIMESTAMP_DB", "PREV_TIMESTAMP", "PREV_TERMINAL", "ACCOUNT_NUMBER", "STAN"]
            if domain == "agenusa"
            else ["BILL_DATE", "PAYMENT_DATE", "BILL_ID", "CUSTOMER_ID"]
        ),
    )

    # ── Train Isolation Forest ───────────────────────────────────────────────
    train_iso     = _import_script(backend_dir / "train_isolation_models.py", "train_isolation_models_quick")
    contamination = 0.08 if domain == "agenusa" else 0.10
    iso_result    = train_iso.train_one(
        domain        = domain,
        csv_path      = isolation_dst,
        contamination = contamination,
    )

    # ── Invalidate cache ─────────────────────────────────────────────────────
    try:
        from fds_engine import load_model
        load_model.cache_clear()
        from isolation_engine import load_isolation_model, load_isolation_meta
        load_isolation_model.cache_clear()
        load_isolation_meta.cache_clear()
    except Exception:
        pass

    metrics = {
        "random_forest": {
            "accuracy":        round(fds_result.get("accuracy", 0), 4),
            "precision_fraud": round(fds_result.get("precision_fraud", 0), 4),
            "recall_fraud":    round(fds_result.get("recall_fraud", 0), 4),
            "f1_fraud":        round(fds_result.get("f1_fraud", 0), 4),
            "roc_auc":         round(fds_result.get("roc_auc", 0), 4),
        },
        "isolation_forest": {
            "contamination":       iso_result.get("contamination"),
            "anomaly_rate":        round(iso_result.get("anomaly_rate_fit_data", 0), 4),
            "review_threshold":    iso_result.get("thresholds", {}).get("review_score_threshold"),
            "high_risk_threshold": iso_result.get("thresholds", {}).get("high_risk_score_threshold"),
        },
    }

    # ── Extract & simpan pattern discovery ───────────────────────────────────
    try:
        _extract_and_save_patterns(
            domain     = domain,
            metrics    = metrics,
            iso_result = iso_result,
            trigger    = "manual_upload",
            run_id     = run_id,
        )
    except Exception as e:
        print(f"[PatternDiscovery] Gagal extract patterns dari CSV upload: {e}")

    return metrics


@router.post("/upload-and-train")
async def upload_and_train(
    file:            UploadFile = File(...),
    domain_override: str        = Form(default=""),
) -> dict[str, Any]:
    """
    Upload CSV dataset → auto-retrain RF + Isolation Forest.

    - file: CSV berisi dataset berlabel (harus ada kolom IS_FRAUD)
    - domain_override: 'agenusa' | 'nusabill' | '' (kosong = auto-detect)
    """
    import pandas as pd
    import traceback

    # ── Validasi file ────────────────────────────────────────────────────────
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File harus berformat CSV (.csv).")

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="File CSV kosong.")

    # ── Parse CSV ────────────────────────────────────────────────────────────
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal membaca CSV: {e}")

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV tidak memiliki data.")

    if "IS_FRAUD" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="Kolom 'IS_FRAUD' tidak ditemukan. Dataset harus sudah berlabel."
        )

    # ── Tentukan domain ──────────────────────────────────────────────────────
    detected_domain = _detect_domain(list(df.columns))

    if domain_override in ("agenusa", "nusabill"):
        domain = domain_override
        domain_source = "manual"
    elif detected_domain:
        domain = detected_domain
        domain_source = "auto"
    else:
        raise HTTPException(
            status_code=400,
            detail=(
                "Tidak bisa mendeteksi domain secara otomatis. "
                "Pilih domain secara manual (agenusa / nusabill)."
            ),
        )

    # ── Simpan ke temp file & train ──────────────────────────────────────────
    started_at = _now_iso()
    run_id     = f"RUN-QK-{uuid.uuid4().hex[:8].upper()}"

    history_entry: dict[str, Any] = {
        "id":            run_id,
        "schedule_id":   None,
        "schedule_name": "Quick Retrain (Upload)",
        "model":         f"{domain} (upload)",
        "domain":        domain,
        "trigger":       "upload",
        "filename":      file.filename,
        "rows":          len(df),
        "fraud_rate":    round(float(df["IS_FRAUD"].mean()), 4),
        "domain_source": domain_source,
        "started_at":    started_at,
        "finished_at":   None,
        "status":        "running",
        "metrics":       {},
        "error":         None,
    }

    history = _load_history()
    history.insert(0, history_entry)
    _save_history(history)

    try:
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
            tmp.write(contents)
            tmp_path = Path(tmp.name)

        metrics = _run_training_from_csv(domain, tmp_path, run_id=history_entry["id"])
        tmp_path.unlink(missing_ok=True)

        history_entry["status"]      = "success"
        history_entry["metrics"]     = metrics
        history_entry["finished_at"] = _now_iso()

    except Exception as exc:
        history_entry["status"]      = "failed"
        history_entry["error"]       = traceback.format_exc()
        history_entry["finished_at"] = _now_iso()
        if 'tmp_path' in locals():
            tmp_path.unlink(missing_ok=True)

    # Update history
    history = _load_history()
    for i, h in enumerate(history):
        if h["id"] == run_id:
            history[i] = history_entry
            break
    _save_history(history)

    if history_entry["status"] == "failed":
        raise HTTPException(
            status_code=500,
            detail=f"Retrain gagal: {history_entry['error']}"
        )

    return {
        "run_id":        run_id,
        "domain":        domain,
        "domain_source": domain_source,
        "filename":      file.filename,
        "rows":          len(df),
        "fraud_rate":    history_entry["fraud_rate"],
        "started_at":    started_at,
        "finished_at":   history_entry["finished_at"],
        "metrics":       metrics,
    }


@router.get("/detect-domain")
async def detect_domain_from_columns(columns: str) -> dict[str, Any]:
    """
    Helper endpoint: kirim nama kolom (comma-separated) → dapat domain suggestion.
    Dipakai frontend saat user upload CSV untuk preview domain sebelum retrain.
    """
    col_list   = [c.strip() for c in columns.split(",") if c.strip()]
    detected   = _detect_domain(col_list)
    col_set    = set(col_list)
    return {
        "detected_domain":   detected,
        "agenusa_matches":   sorted(_AGENUSA_SIGNATURE  & col_set),
        "nusabill_matches":  sorted(_NUSABILL_SIGNATURE & col_set),
        "missing_agenusa":   sorted(_AGENUSA_SIGNATURE  - col_set),
        "missing_nusabill":  sorted(_NUSABILL_SIGNATURE - col_set),
    }


def run_scheduled_retrain(schedule_id: str) -> None:
    """
    Entry point yang dipanggil APScheduler saat schedule triggered.
    Public function agar bisa di-import dari retrain_scheduler.py.
    """
    schedules = _load_schedules()
    schedule  = next((s for s in schedules if s["id"] == schedule_id), None)
    if not schedule:
        print(f"[RetrainScheduler] Schedule {schedule_id} tidak ditemukan, skip.")
        return

    print(f"[RetrainScheduler] Menjalankan retrain terjadwal: {schedule['name']} ({schedule_id})")
    result = _execute_retrain(schedule, trigger="scheduled")

    # Update lastRun setelah selesai
    now_str = _now_local_str()
    schedules = _load_schedules()  # reload fresh
    for i, s in enumerate(schedules):
        if s["id"] == schedule_id:
            schedules[i]["lastRun"] = now_str
            schedules[i]["nextRun"] = _compute_next_run(schedules[i])
            break
    _save_schedules(schedules)

    status = result.get("status", "unknown")
    print(f"[RetrainScheduler] Selesai: {schedule['name']} → {status}")