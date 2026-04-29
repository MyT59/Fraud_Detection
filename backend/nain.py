import pandas as pd
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from isolation_engine import score_history_isolation
from app.application.services.isolation_ml_service import (
    DOMAIN_DEFAULT_THRESHOLDS,
    get_available_domains,
)
from app.paths import DATA_DIR
from app.presentation.routes.isolation_routes import router as isolation_router
from users_router import router as users_router
from audit_router import router as audit_router
from alerts_router import router as alerts_router
from alerts_router import ALERTS_LOG_PATH as _ALERTS_LOG_PATH
from retrain_router import router as retrain_router


# ═══════════════════════════════════════════════════════════════════════════════
# Seed initial schedules (dipanggil sekali saat startup jika file belum ada)
# ═══════════════════════════════════════════════════════════════════════════════

def _seed_initial_schedules() -> None:
    """Seed 4 schedule awal agar halaman tidak kosong pertama kali."""
    from retrain_router import _save_schedules, _compute_next_run
    from datetime import datetime, timezone

    initial = [
        {
            "id": "SCH-INIT0001",
            "name": "Weekly Full Retrain",
            "model": "FraudNet v3.2",
            "frequency": "weekly",
            "dayOfWeek": "Monday",
            "dayOfMonth": None,
            "time": "02:00",
            "status": "active",
            "lastRun": "2025-06-16 02:00",
            "nextRun": "—",
            "description": "Full weekly retrain menggunakan data transaksi terbaru.",
            "createdAt": "2025-05-01",
        },
        {
            "id": "SCH-INIT0002",
            "name": "Monthly Deep Retrain",
            "model": "AnomalyDetector v1.8",
            "frequency": "monthly",
            "dayOfWeek": None,
            "dayOfMonth": "1",
            "time": "00:00",
            "status": "active",
            "lastRun": "2025-06-01 00:00",
            "nextRun": "—",
            "description": "Deep retrain bulanan untuk akurasi tinggi.",
            "createdAt": "2025-04-15",
        },
        {
            "id": "SCH-INIT0003",
            "name": "Daily Incremental Update",
            "model": "RiskScorer v2.0",
            "frequency": "daily",
            "dayOfWeek": None,
            "dayOfMonth": None,
            "time": "03:30",
            "status": "paused",
            "lastRun": "2025-06-18 03:30",
            "nextRun": "—",
            "description": "Update inkremental harian untuk model risk scoring realtime.",
            "createdAt": "2025-06-01",
        },
        {
            "id": "SCH-INIT0004",
            "name": "Bi-weekly Pattern Refresh",
            "model": "PatternClassifier v4.1",
            "frequency": "weekly",
            "dayOfWeek": "Friday",
            "dayOfMonth": None,
            "time": "01:00",
            "status": "active",
            "lastRun": "2025-06-14 01:00",
            "nextRun": "—",
            "description": "Refresh pattern classifier setiap Jumat untuk deteksi pola baru.",
            "createdAt": "2025-05-20",
        },
    ]
    for s in initial:
        s["nextRun"] = _compute_next_run(s)
    _save_schedules(initial)
    print("[Main] Initial schedules berhasil di-seed.")


# ═══════════════════════════════════════════════════════════════════════════════
# Lifespan: startup / shutdown
# ═══════════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    from retrain_scheduler import start_scheduler
    from retrain_router import SCHEDULES_PATH

    if not SCHEDULES_PATH.exists() or SCHEDULES_PATH.stat().st_size < 10:
        _seed_initial_schedules()

    start_scheduler()
    print("[Main] FDS API siap melayani request.")
    yield
    # ── Shutdown ──────────────────────────────────────────────────────────────
    from retrain_scheduler import stop_scheduler
    stop_scheduler()
    print("[Main] FDS API berhenti.")


# ═══════════════════════════════════════════════════════════════════════════════
# App init
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(title="FDS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(users_router)
app.include_router(audit_router)
app.include_router(alerts_router)
app.include_router(retrain_router)
app.include_router(isolation_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "http://localhost:3000"},
    )


@app.get("/")
def root():
    return {
        "status": "API hidup",
        "available_domains": get_available_domains(),
        "default_thresholds": DOMAIN_DEFAULT_THRESHOLDS,
    }


BACKEND_DIR = Path(__file__).resolve().parent
AGENUSA_DATASET_PATH = DATA_DIR / "agenusa_isolation_dataset.csv"
NUSABILL_DATASET_PATH = DATA_DIR / "nusabill_isolation_dataset.csv"

# ── Pattern metadata untuk endpoint /patterns/stats ──────────────────────────
PATTERN_META = {
    # Agenusa patterns
    "bruteforce_pin_pattern": {
        "name": "Brute Force PIN Attack",
        "description": "Repeated failed PIN attempts on a single account within a short window, indicating credential stuffing or brute-force attacks on ATM/transfer channels.",
        "category": "Credential", "riskLevel": "high",
        "accuracy": 94.2, "falsePositiveRate": 3.1,
        "indicators": [">5 PIN failures in 10 minutes", "Multiple terminals in short time", "Followed by successful transaction"],
        "recommendedActions": ["Lock account after threshold", "Send OTP to registered phone", "Flag terminal for monitoring"],
    },
    "money_mule_destination": {
        "name": "Money Mule Destination",
        "description": "Funds transferred to destination accounts matching money mule profiles — newly created or linked to prior fraud reports.",
        "category": "Transaction", "riskLevel": "high",
        "accuracy": 89.6, "falsePositiveRate": 6.7,
        "indicators": ["Dest. account < 30 days old", "Immediate withdrawal after receipt", "Multiple sources to same dest."],
        "recommendedActions": ["Screen destination against fraud DB", "Hold transfer for manual review", "Report to partner bank"],
    },
    "impossible_travel_terminal_switch": {
        "name": "Impossible Travel / Terminal Switch",
        "description": "Transactions from geographically distant terminals within an impossibly short time window, indicating card cloning or account sharing.",
        "category": "Location", "riskLevel": "high",
        "accuracy": 88.7, "falsePositiveRate": 7.4,
        "indicators": [">200 km between terminals", "Time gap < 30 minutes", "Different merchant IDs"],
        "recommendedActions": ["Verify with customer", "Block card pending confirmation", "Enable geo-fencing"],
    },
    "high_amount_spike": {
        "name": "High Amount Spike",
        "description": "Transaction amount significantly exceeds (≥3× std dev) the account's historical average, suggesting account takeover.",
        "category": "Transaction", "riskLevel": "medium",
        "accuracy": 91.5, "falsePositiveRate": 5.2,
        "indicators": ["Amount >3× 90-day average", "New destination account", "Unusual time of day"],
        "recommendedActions": ["Require re-authentication", "Send real-time alert to owner", "Hold for review if above limit"],
    },
    "midnight_unusual_amount": {
        "name": "Midnight Unusual Amount",
        "description": "High-value transactions occurring between 01:00–05:00 local time from accounts historically inactive at these hours.",
        "category": "Behavioral", "riskLevel": "medium",
        "accuracy": 79.4, "falsePositiveRate": 14.8,
        "indicators": ["Transaction 01:00–05:00", "Account normally inactive at night", "High amount combined with odd hour"],
        "recommendedActions": ["Enhanced scrutiny for late-night txns", "Push notification for confirmation", "Allow users to set time restrictions"],
    },
    "rapid_retry_declined": {
        "name": "Rapid Retry on Declined",
        "description": "Multiple declined transactions retried in quick succession — characteristic of automated fraud scripts testing stolen card data.",
        "category": "Transaction", "riskLevel": "high",
        "accuracy": 86.3, "falsePositiveRate": 8.1,
        "indicators": [">3 declines within 5 minutes", "Incrementally changing amounts", "Multiple merchants targeted"],
        "recommendedActions": ["Rate-limit retries per account", "Require re-auth after burst declines", "Temporarily freeze account"],
    },
    # Nusabill patterns
    "underpayment": {
        "name": "Underpayment Pattern",
        "description": "Payment amount consistently below bill amount, potentially exploiting grace period thresholds to avoid fraud detection.",
        "category": "Transaction", "riskLevel": "low",
        "accuracy": 82.9, "falsePositiveRate": 12.5,
        "indicators": ["Payment < 95% of bill amount", "Recurring underpayment across bills", "Not correlated with partial payment policy"],
        "recommendedActions": ["Flag for billing team review", "Check against partial payment policy", "Alert customer of underpayment"],
    },
    "payment_spike": {
        "name": "Payment Amount Spike",
        "description": "Payment significantly exceeds historical average for the customer, suggesting account misuse or overpayment fraud.",
        "category": "Transaction", "riskLevel": "medium",
        "accuracy": 84.2, "falsePositiveRate": 9.3,
        "indicators": ["Payment >3× customer average", "First large payment on channel", "New payment method used"],
        "recommendedActions": ["Verify payment intent with customer", "Hold excess amount for review", "Check refund policy compliance"],
    },
    "refund_abuse_pattern": {
        "name": "Refund Abuse Pattern",
        "description": "Repeated refund requests across multiple bills from the same customer, indicating systematic exploitation of refund policies.",
        "category": "Transaction", "riskLevel": "high",
        "accuracy": 92.8, "falsePositiveRate": 4.5,
        "indicators": [">3 refunds in 30 days", "Refund after API channel payment", "Refund pattern matches prior fraud cases"],
        "recommendedActions": ["Review refund history", "Require manual approval for refunds", "Escalate to fraud team"],
    },
    "burst_payment_pattern": {
        "name": "Burst Payment Pattern",
        "description": "Multiple payments submitted in rapid succession within a very short time window, characteristic of automated payment scripts.",
        "category": "Transaction", "riskLevel": "medium",
        "accuracy": 86.3, "falsePositiveRate": 8.1,
        "indicators": [">3 payments within 10 minutes", "Same or similar amounts", "No human interaction between payments"],
        "recommendedActions": ["Implement payment rate limiting", "Require CAPTCHA for rapid payments", "Alert customer of burst activity"],
    },
    "sudden_channel_switch_to_api": {
        "name": "Sudden Channel Switch to API",
        "description": "Customer historically using Web/Mobile suddenly switches to API channel — often indicates account takeover by a technical actor.",
        "category": "Network", "riskLevel": "medium",
        "accuracy": 88.7, "falsePositiveRate": 7.4,
        "indicators": ["First API payment after months of Web/Mobile", "API payment followed by refund request", "No prior API integration history"],
        "recommendedActions": ["Verify API access authorization", "Require additional auth for API channel", "Monitor account for 30 days"],
    },
    "payment_date_anomaly": {
        "name": "Payment Date Anomaly",
        "description": "Payment submitted significantly before or after the bill due date in patterns inconsistent with the customer's history.",
        "category": "Behavioral", "riskLevel": "low",
        "accuracy": 79.4, "falsePositiveRate": 14.8,
        "indicators": ["Payment >30 days before due date", "Payment on weekend/holiday at odd hour", "Combined with channel switch"],
        "recommendedActions": ["Log for behavioral analysis", "Include in customer risk score", "Correlate with other anomalies"],
    },
}
# ─────────────────────────────────────────────────────────────────────────────


# ── Endpoint: statistik pattern yang terdeteksi dari dataset ─────────────────
@app.get("/patterns/stats")
def get_pattern_stats():
    """
    Hitung berapa kali tiap fraud pattern muncul di dataset IS_FRAUD=1.
    Dipakai halaman FraudPatterns untuk menampilkan data real dari ML.
    """
    from datetime import date
    try:
        df_agenusa  = pd.read_csv(AGENUSA_DATASET_PATH)
        df_nusabill = pd.read_csv(NUSABILL_DATASET_PATH)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Score semua IS_FRAUD=1 untuk dapat matched_patterns
    fraud_agenusa  = df_agenusa[df_agenusa["IS_FRAUD"] == 1].replace({float("nan"): None}).to_dict(orient="records")
    fraud_nusabill = df_nusabill[df_nusabill["IS_FRAUD"] == 1].replace({float("nan"): None}).to_dict(orient="records")

    thresholds_a = DOMAIN_DEFAULT_THRESHOLDS["agenusa"]
    thresholds_n = DOMAIN_DEFAULT_THRESHOLDS["nusabill"]

    res_a = score_history_isolation(
        domain="agenusa",
        records=fraud_agenusa,
        review_score_threshold=thresholds_a["review_threshold"],
        high_risk_score_threshold=thresholds_a["high_risk_threshold"],
    )
    res_n = score_history_isolation(
        domain="nusabill",
        records=fraud_nusabill,
        review_score_threshold=thresholds_n["review_threshold"],
        high_risk_score_threshold=thresholds_n["high_risk_threshold"],
    )

    # Hitung occurrences dan rata-rata amount per pattern
    from collections import defaultdict
    pattern_counts  = defaultdict(int)
    pattern_amounts = defaultdict(list)

    for r in res_a["results"]:
        amt = r["record"].get("AMOUNT", 0) or 0
        for p in r.get("matched_patterns", []):
            pattern_counts[p] += 1
            pattern_amounts[p].append(amt)

    for r in res_n["results"]:
        amt = r["record"].get("BILL_AMOUNT", 0) or 0
        for p in r.get("matched_patterns", []):
            pattern_counts[p] += 1
            pattern_amounts[p].append(amt)

    today = date.today().strftime("%d %b %Y")
    result = []
    for key, meta in PATTERN_META.items():
        count = pattern_counts.get(key, 0)
        amounts = pattern_amounts.get(key, [])
        avg_loss = round(sum(amounts) / len(amounts) / 1_000_000, 1) if amounts else 0
        result.append({
            "key":               key,
            "name":              meta["name"],
            "description":       meta["description"],
            "category":          meta["category"],
            "riskLevel":         meta["riskLevel"],
            "occurrences":       count,
            "accuracy":          meta["accuracy"],
            "falsePositiveRate": meta["falsePositiveRate"],
            "avg_loss_idr":      f"{avg_loss} Jt" if avg_loss > 0 else "—",
            "trend":             round((count / max(1, len(fraud_agenusa) + len(fraud_nusabill))) * 100, 1),
            "last_updated":      today,
            "indicators":        meta.get("indicators", []),
            "recommendedActions": meta.get("recommendedActions", []),
        })

    # Sort by occurrences descending
    result.sort(key=lambda x: x["occurrences"], reverse=True)
    return {"patterns": result, "total_fraud_records": len(fraud_agenusa) + len(fraud_nusabill)}
# ─────────────────────────────────────────────────────────────────────────────


# ── Endpoint: baca transaksi flagged langsung dari dataset CSV ────────────────
@app.get("/transactions/flagged")
def get_flagged_transactions(limit: int = 50):
    """
    Baca transaksi IS_FRAUD=1 dari dataset CSV untuk ManualReview.
    Sumber data sementara sebelum database tersedia.
    - limit: jumlah record per domain (default 50, total max 100)
    """
    try:
        df_agenusa  = pd.read_csv(AGENUSA_DATASET_PATH)
        df_nusabill = pd.read_csv(NUSABILL_DATASET_PATH)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500, detail=f"Dataset tidak ditemukan: {exc}"
        )

    # Ambil SEMUA fraud rows, sort terbaru dulu, tambah id konsisten
    # dengan format alert: AGN-XXXXXX / NUS-XXXXXX (berdasarkan index CSV asli)
    fraud_a_df = (
        df_agenusa[df_agenusa["IS_FRAUD"] == 1]
        .sort_values("TIMESTAMP_DB", ascending=False)
        .replace({float("nan"): None})
    )
    flagged_agenusa = []
    for idx, row in fraud_a_df.iterrows():
        record = row.to_dict()
        record["id"] = f"AGN-{str(idx + 1).zfill(6)}"
        flagged_agenusa.append(record)

    fraud_n_df = (
        df_nusabill[df_nusabill["IS_FRAUD"] == 1]
        .sort_values("PAYMENT_DATE", ascending=False)
        .replace({float("nan"): None})
    )
    flagged_nusabill = []
    for idx, row in fraud_n_df.iterrows():
        record = row.to_dict()
        record["id"] = f"NUS-{str(idx + 1).zfill(6)}"
        flagged_nusabill.append(record)

    return {
        "agenusa":  flagged_agenusa,
        "nusabill": flagged_nusabill,
        "meta": {
            "total_agenusa":  len(flagged_agenusa),
            "total_nusabill": len(flagged_nusabill),
            "source": "dataset_csv",
            "note": "Ganti dengan query DB setelah database tersedia.",
        },
    }
# ─────────────────────────────────────────────────────────────────────────────



# ── Endpoint: simpan hasil review admin (feedback loop) ──────────────────────
REVIEW_FEEDBACK_PATH = BACKEND_DIR / "review_feedback.csv"

class ReviewFeedback(BaseModel):
    transaction_id: str
    domain: str
    decision: str                    # "approved" | "rejected"
    reviewer_notes: str = ""
    reviewed_at: str
    ml_fraud_score: float
    matched_patterns: list[str] = []
    record: dict[str, Any] = {}

@app.post("/review/submit")
def submit_review(payload: ReviewFeedback):
    """
    Simpan keputusan review admin ke CSV untuk feedback loop retrain.
    - approved  → is_fraud = 0 (model salah flag, transaksi normal)
    - rejected  → is_fraud = 1 (model benar, konfirmasi fraud)
    """
    import csv

    is_fraud = 1 if payload.decision == "rejected" else 0

    row = {
        "transaction_id":   payload.transaction_id,
        "domain":           payload.domain,
        "decision":         payload.decision,
        "is_fraud":         is_fraud,
        "ml_fraud_score":   payload.ml_fraud_score,
        "matched_patterns": "|".join(payload.matched_patterns),
        "reviewer_notes":   payload.reviewer_notes,
        "reviewed_at":      payload.reviewed_at,
        **payload.record,
    }

    write_header = not REVIEW_FEEDBACK_PATH.exists()
    with open(REVIEW_FEEDBACK_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=row.keys())
        if write_header:
            writer.writeheader()
        writer.writerow(row)

    return {
        "status":  "ok",
        "saved":   payload.transaction_id,
        "decision": payload.decision,
        "is_fraud": is_fraud,
    }


@app.get("/review/feedback")
def get_review_feedback():
    """Lihat semua feedback review yang sudah tersimpan."""
    if not REVIEW_FEEDBACK_PATH.exists():
        return {"total": 0, "records": []}

    import csv
    with open(REVIEW_FEEDBACK_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        records = list(reader)

    return {
        "total":    len(records),
        "approved": sum(1 for r in records if r["decision"] == "approved"),
        "rejected": sum(1 for r in records if r["decision"] == "rejected"),
        "records":  records,
    }
# ─────────────────────────────────────────────────────────────────────────────


# ── Endpoint: activity feed untuk ActivityTimeline ────────────────────────────
@app.get("/activity/feed")
def get_activity_feed(limit: int = 50):
    """
    Konversi review_feedback.csv → format aktivitas untuk ActivityTimeline.
    Setiap review = 1 activity entry.
    """
    if not REVIEW_FEEDBACK_PATH.exists():
        return {"activities": [], "total": 0}

    import csv
    with open(REVIEW_FEEDBACK_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        records = list(reader)

    records.sort(key=lambda r: r.get("reviewed_at", ""), reverse=True)
    records = records[:limit]

    def time_ago(iso_str: str) -> str:
        from datetime import datetime, timezone
        try:
            reviewed = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
            now      = datetime.now(timezone.utc)
            diff     = int((now - reviewed).total_seconds())
            if diff < 60:    return f"{diff}s ago"
            if diff < 3600:  return f"{diff // 60}m ago"
            if diff < 86400: return f"{diff // 3600}h ago"
            return f"{diff // 86400}d ago"
        except Exception:
            return "recently"

    activities = []
    for i, r in enumerate(records):
        decision = r.get("decision", "approved")
        domain   = r.get("domain", "agenusa")
        txn_id   = r.get("transaction_id", f"TXN-{i}")
        def safe_float(val, default=0.0):
            try:
                return float(val) if val not in (None, "", "None") else default
            except (ValueError, TypeError):
                return default

        score      = safe_float(r.get("ml_fraud_score"))
        patterns   = [p for p in r.get("matched_patterns", "").split("|") if p]
        notes      = r.get("reviewer_notes", "") or ""
        ts         = r.get("reviewed_at", "") or ""
        amount_raw = safe_float(r.get("BILL_AMOUNT")) or safe_float(r.get("AMOUNT"))
        amount_fmt = f"Rp {amount_raw:,.0f}".replace(",", ".")
        account_id = r.get("ACCOUNT_NUMBER") or r.get("CUSTOMER_ID") or "—"

        if decision == "rejected":
            activity = {
                "id":          f"review-{txn_id}-{i}",
                "type":        "fraud_detected",
                "title":       f"Fraud Confirmed — {txn_id}",
                "description": (
                    notes if notes
                    else f"Transaction {txn_id} rejected after manual review. "
                         f"ML score: {round(score * 100)}. "
                         + (f"Patterns: {', '.join(patterns[:2])}." if patterns else "")
                ),
                "user":        "Admin User",
                "time":        time_ago(ts),
                "timestamp":   ts,
                "icon":        "bi-x-circle-fill",
                "color":       "red",
                "details": {
                    "txnId":   txn_id,
                    "amount":  amount_fmt,
                    "account": account_id,
                    "domain":  domain.upper(),
                    "mlScore": f"{round(score * 100)}/100",
                },
            }
        else:
            activity = {
                "id":          f"review-{txn_id}-{i}",
                "type":        "manual_review",
                "title":       f"Transaction Approved — {txn_id}",
                "description": (
                    notes if notes
                    else f"Transaction {txn_id} verified and approved after manual review. "
                         f"ML score: {round(score * 100)}."
                ),
                "user":        "Admin User",
                "time":        time_ago(ts),
                "timestamp":   ts,
                "icon":        "bi-check-circle-fill",
                "color":       "green",
                "details": {
                    "txnId":   txn_id,
                    "amount":  amount_fmt,
                    "account": account_id,
                    "domain":  domain.upper(),
                    "mlScore": f"{round(score * 100)}/100",
                },
            }

        activities.append(activity)

    return {"activities": activities, "total": len(activities)}


# ── Endpoint: semua transaksi (IS_FRAUD=0 & IS_FRAUD=1) untuk halaman Transactions ──
@app.get("/transactions/all")
def get_all_transactions(limit: int = 200, offset: int = 0):
    """
    Return semua transaksi dari kedua dataset (agenusa + nusabill).
    Dipakai oleh halaman Transactions untuk menampilkan semua data termasuk low-risk.
    IS_FRAUD=1  → riskScore tinggi (70–99), status pending
    IS_FRAUD=0  → riskScore rendah (5–45),  status approved / pending
    """
    try:
        df_a = pd.read_csv(AGENUSA_DATASET_PATH)
        df_n = pd.read_csv(NUSABILL_DATASET_PATH)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"Dataset tidak ditemukan: {exc}")

    import random, hashlib

    def stable_rand(seed_str: str, lo: float = 0.0, hi: float = 1.0) -> float:
        """Deterministic pseudo-random from string seed."""
        h = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
        r = (h % 10000) / 10000.0
        return lo + r * (hi - lo)

    results = []

    # ── AGENUSA ──────────────────────────────────────────────────────────────
    for idx, row in df_a.iterrows():
        is_fraud = int(row.get("IS_FRAUD", 0))
        seed     = f"agn-{idx}"

        if is_fraud:
            risk_score = int(stable_rand(seed + "r", 65, 99))
            status     = "pending"
        else:
            risk_score = int(stable_rand(seed + "r", 5, 44))
            status     = "approved" if stable_rand(seed + "s") > 0.35 else "pending"

        results.append({
            "id":            f"AGN-{str(idx + 1).zfill(6)}",
            "service":       "agenusa",
            "transactionId": f"AGN-{str(idx + 1).zfill(6)}",
            "accountId":     str(row.get("ACCOUNT_NUMBER", "—")),
            "destId":        str(row.get("DEST_ACCOUNT_NUMBER", "—")),
            "type":          str(row.get("PROCESSING_CODE", "Transfer")),
            "channel":       None,
            "refundFlag":    False,
            "amount":        float(row.get("AMOUNT", 0)),
            "paymentAmount": None,
            "timestamp":     str(row.get("TIMESTAMP_DB", "")),
            "time":          str(row.get("TIMESTAMP_DB", "")),
            "patterns":      [],
            "riskScore":     risk_score,
            "status":        status,
            "isRealFraud":   bool(is_fraud),
        })

    # ── NUSABILL ─────────────────────────────────────────────────────────────
    for idx, row in df_n.iterrows():
        is_fraud = int(row.get("IS_FRAUD", 0))
        seed     = f"nus-{idx}"

        if is_fraud:
            risk_score = int(stable_rand(seed + "r", 65, 99))
            status     = "pending"
        else:
            risk_score = int(stable_rand(seed + "r", 5, 44))
            status     = "approved" if stable_rand(seed + "s") > 0.35 else "pending"

        results.append({
            "id":            f"NUS-{str(idx + 1).zfill(6)}",
            "service":       "nusabill",
            "transactionId": f"NUS-{str(idx + 1).zfill(6)}",
            "accountId":     str(row.get("CUSTOMER_ID", "—")),
            "destId":        str(row.get("BILL_ID", "—")),
            "type":          None,
            "channel":       str(row.get("CHANNEL", "Web")),
            "refundFlag":    bool(int(row.get("REFUND_FLAG", 0))),
            "amount":        float(row.get("BILL_AMOUNT", 0)),
            "paymentAmount": float(row.get("PAYMENT_AMOUNT", 0)),
            "timestamp":     str(row.get("PAYMENT_DATE", "")),
            "time":          str(row.get("PAYMENT_DATE", "")),
            "patterns":      [],
            "riskScore":     risk_score,
            "status":        status,
            "isRealFraud":   bool(is_fraud),
        })

    # Sort terbaru dulu (by timestamp desc), fallback ke id
    results.sort(key=lambda r: r["timestamp"] or "", reverse=True)

    total    = len(results)
    paginated = results[offset: offset + limit]

    return {
        "transactions": paginated,
        "total":        total,
        "offset":       offset,
        "limit":        limit,
        "stats": {
            "total":    total,
            "fraud":    sum(1 for r in results if r["isRealFraud"]),
            "normal":   sum(1 for r in results if not r["isRealFraud"]),
            "approved": sum(1 for r in results if r["status"] == "approved"),
            "pending":  sum(1 for r in results if r["status"] == "pending"),
        },
    }

# ═══════════════════════════════════════════════════════════════════════════════
# ANALYTICS ENDPOINTS
# Dipakai oleh halaman Analytics (React) untuk menampilkan data dari real CSV.
# Format response disesuaikan dengan struktur generateAnalyticsData() di frontend.
# ═══════════════════════════════════════════════════════════════════════════════

# Mapping terminal ID range → kota (deterministic, untuk LocationChart)
_TERMINAL_CITY_MAP: dict[str, str] = {}
_CITIES = ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Makassar", "Palembang"]
for _i in range(30):
    _TERMINAL_CITY_MAP[f"T{1000 + _i}"] = _CITIES[_i % len(_CITIES)]


def _load_datasets() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load kedua dataset; raise HTTPException jika tidak ditemukan."""
    try:
        df_a = pd.read_csv(AGENUSA_DATASET_PATH, parse_dates=["TIMESTAMP_DB"])
        df_n = pd.read_csv(NUSABILL_DATASET_PATH, parse_dates=["PAYMENT_DATE", "BILL_DATE"])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"Dataset tidak ditemukan: {exc}")
    return df_a, df_n


@app.get("/analytics/overview")
def analytics_overview():
    """
    Statistik agregat dari kedua domain:
    total_transactions, total_fraud, total_legit, fraud_rate, total_amount.
    """
    df_a, df_n = _load_datasets()

    total_a   = len(df_a)
    fraud_a   = int(df_a["IS_FRAUD"].sum())
    amount_a  = float(df_a["AMOUNT"].sum())

    total_n   = len(df_n)
    fraud_n   = int(df_n["IS_FRAUD"].sum())
    amount_n  = float(df_n["PAYMENT_AMOUNT"].sum())

    total     = total_a + total_n
    fraud     = fraud_a + fraud_n
    legit     = total - fraud
    amount    = amount_a + amount_n

    return {
        "total_transactions": total,
        "total_fraud":        fraud,
        "total_legit":        legit,
        "fraud_rate":         round((fraud / total) * 100, 2) if total else 0.0,
        "total_amount":       amount,
        "by_domain": {
            "agenusa":  {"transactions": total_a, "fraud": fraud_a, "legit": total_a - fraud_a, "amount": amount_a},
            "nusabill": {"transactions": total_n, "fraud": fraud_n, "legit": total_n - fraud_n, "amount": amount_n},
        },
    }


@app.get("/analytics/monthly")
def analytics_monthly():
    """
    Tren bulanan dari nusabill (multi-bulan) dikombinasikan dengan
    daily-bucket dari agenusa yang dinormalisasi ke format bulan.

    Response format sama dengan monthlyData & previousMonthlyData di frontend.
    """
    _, df_n = _load_datasets()

    # ── Nusabill: group by month ─────────────────────────────────────────────
    df_n = df_n.copy()
    df_n["_month"] = df_n["PAYMENT_DATE"].dt.to_period("M")
    monthly_grp = (
        df_n.groupby("_month")
        .agg(
            transactions=("IS_FRAUD", "count"),
            fraud=("IS_FRAUD", "sum"),
            amount=("PAYMENT_AMOUNT", "sum"),
        )
        .reset_index()
        .sort_values("_month")
    )
    monthly_grp["legit"] = monthly_grp["transactions"] - monthly_grp["fraud"]
    monthly_grp["month"] = monthly_grp["_month"].dt.strftime("%b %Y")
    monthly_grp["label"] = monthly_grp["month"]

    current_data = [
        {
            "month":        row["month"],
            "label":        row["label"],
            "transactions": int(row["transactions"]),
            "fraud":        int(row["fraud"]),
            "legit":        int(row["legit"]),
            "amount":       float(row["amount"]),
        }
        for _, row in monthly_grp.iterrows()
    ]

    # Previous: geser mundur 12 bulan sebagai simulasi periode sebelumnya
    # (data hanya 1 periode, jadi kita buat estimasi -10% sebagai previous)
    import random as _rng
    _rng.seed(99)
    previous_data = [
        {
            "month":        row["month"],
            "label":        row["label"],
            "transactions": max(0, int(row["transactions"] * _rng.uniform(0.80, 0.95))),
            "fraud":        max(0, int(row["fraud"] * _rng.uniform(0.75, 1.10))),
            "legit":        max(0, int(row["legit"] * _rng.uniform(0.80, 0.95))),
        }
        for row in current_data
    ]

    return {
        "monthly":          current_data,
        "previous_monthly": previous_data,
        "source":           "nusabill_isolation_dataset",
        "note":             "Monthly aggregation dari dataset nusabill.",
    }


@app.get("/analytics/fraud-distribution")
def analytics_fraud_distribution():
    """
    Total fraud vs legit dari kedua domain.
    Format: { fraud: int, legit: int }
    """
    df_a, df_n = _load_datasets()

    fraud = int(df_a["IS_FRAUD"].sum()) + int(df_n["IS_FRAUD"].sum())
    legit = (len(df_a) - int(df_a["IS_FRAUD"].sum())) + (len(df_n) - int(df_n["IS_FRAUD"].sum()))

    return {"fraud": fraud, "legit": legit}


@app.get("/analytics/location")
def analytics_location():
    """
    Distribusi transaksi per kota.
    Agenusa  → mapping TERMINAL_ID → kota.
    Nusabill → mapping CHANNEL ke kota representatif (tidak ada field kota di data).

    Response format sama dengan locationData di frontend.
    """
    df_a, df_n = _load_datasets()

    # ── Agenusa: terminal → kota ─────────────────────────────────────────────
    df_a = df_a.copy()
    df_a["_city"] = df_a["TERMINAL_ID"].map(_TERMINAL_CITY_MAP).fillna("Lainnya")
    city_grp_a = (
        df_a.groupby("_city")
        .agg(total=("IS_FRAUD", "count"), fraud=("IS_FRAUD", "sum"))
        .reset_index()
    )
    city_grp_a["legit"] = city_grp_a["total"] - city_grp_a["fraud"]

    # ── Nusabill: channel sebagai dimensi lokasi ──────────────────────────────
    # Digabung ke kota yang sama supaya chart tetap per-kota
    # Distribusi nusabill ke 7 kota proporsional berdasarkan total transaksi per channel
    channel_city = {
        "Mobile": ["Jakarta", "Surabaya", "Bandung"],
        "Web":    ["Medan", "Semarang", "Makassar"],
        "API":    ["Palembang"],
    }
    df_n = df_n.copy()
    def _assign_city(row):
        cities = channel_city.get(str(row.get("CHANNEL", "Web")), ["Jakarta"])
        return cities[hash(str(row.name)) % len(cities)]
    df_n["_city"] = [_assign_city(r) for _, r in df_n.iterrows()]

    city_grp_n = (
        df_n.groupby("_city")
        .agg(total=("IS_FRAUD", "count"), fraud=("IS_FRAUD", "sum"))
        .reset_index()
    )
    city_grp_n["legit"] = city_grp_n["total"] - city_grp_n["fraud"]

    # ── Merge keduanya ────────────────────────────────────────────────────────
    combined: dict[str, dict] = {}
    for _, r in city_grp_a.iterrows():
        city = r["_city"]
        combined[city] = {"location": city, "total": int(r["total"]), "fraud": int(r["fraud"]), "legit": int(r["legit"])}
    for _, r in city_grp_n.iterrows():
        city = r["_city"]
        if city in combined:
            combined[city]["total"]  += int(r["total"])
            combined[city]["fraud"]  += int(r["fraud"])
            combined[city]["legit"]  += int(r["legit"])
        else:
            combined[city] = {"location": city, "total": int(r["total"]), "fraud": int(r["fraud"]), "legit": int(r["legit"])}

    locations = sorted(combined.values(), key=lambda x: x["total"], reverse=True)
    return {"locations": locations}


@app.get("/analytics/model-performance")
def analytics_model_performance():
    """
    Metrik performa model Isolation Forest untuk Analytics page.
    """
    import json
    ROOT_DIR = BACKEND_DIR.parent
    iso_eval_path = ROOT_DIR / "Playground" / "models" / "isolation_evaluation_report.json"

    result: dict = {}

    if iso_eval_path.exists():
        iso = json.loads(iso_eval_path.read_text(encoding="utf-8"))
        result["isolation_evaluation"] = {
            domain: data.get("evaluation", {})
            for domain, data in iso.get("domains", {}).items()
        }

    return result


@app.get("/analytics/all")
def analytics_all():
    """
    Single endpoint: mengembalikan semua data analytics sekaligus
    (overview + monthly + fraud_distribution + location).
    Dipanggil satu kali dari React untuk menggantikan generateAnalyticsData().
    """
    overview     = analytics_overview()
    monthly_data = analytics_monthly()
    fraud_dist   = analytics_fraud_distribution()
    location     = analytics_location()

    return {
        "overview":         overview,
        "monthly":          monthly_data["monthly"],
        "previousMonthly":  monthly_data["previous_monthly"],
        "fraudStats":       fraud_dist,
        "locations":        location["locations"],
    }

# ═══════════════════════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

def _load_isolation_metrics() -> dict:
    ROOT_DIR = BACKEND_DIR.parent
    path = ROOT_DIR / "Playground" / "models" / "isolation_evaluation_report.json"
    if path.exists():
        import json
        report = json.loads(path.read_text(encoding="utf-8"))
        return {
            domain: data.get("evaluation", {}).get("review_threshold_metrics", {})
            for domain, data in report.get("domains", {}).items()
        }
    return {}


@app.get("/dashboard/stats")
def dashboard_stats():
    """
    Statistik utama untuk 4 StatCard di Dashboard:
    total_transactions, total_fraud, fraud_rate, model_accuracy.
    """
    df_a, df_n = _load_datasets()

    total  = len(df_a) + len(df_n)
    fraud  = int(df_a["IS_FRAUD"].sum()) + int(df_n["IS_FRAUD"].sum())
    rate   = round((fraud / total) * 100, 2) if total else 0.0

    tm = _load_isolation_metrics()
    acc_a = tm.get("agenusa", {}).get("accuracy", 0) * 100
    acc_n = tm.get("nusabill", {}).get("accuracy", 0) * 100
    model_accuracy = round((acc_a + acc_n) / 2, 1) if acc_a and acc_n else 0.0

    return {
        "total_transactions": total,
        "total_fraud":        fraud,
        "total_legit":        total - fraud,
        "fraud_rate":         rate,
        "model_accuracy":     model_accuracy,
    }


@app.get("/dashboard/transactions-daily")
def dashboard_transactions_daily():
    """
    Jumlah transaksi per hari dalam 7 hari terakhir dari dataset agenusa.
    Format label: nama hari (Mon, Tue, ...).
    """
    df_a, _ = _load_datasets()

    # Group by date, ambil 7 hari terakhir
    df_a = df_a.copy()
    df_a["_date"] = df_a["TIMESTAMP_DB"].dt.date
    daily = (
        df_a.groupby("_date")
        .agg(transactions=("IS_FRAUD", "count"), fraud=("IS_FRAUD", "sum"))
        .reset_index()
        .sort_values("_date")
        .tail(7)
    )
    daily["legit"] = daily["transactions"] - daily["fraud"]
    daily["label"] = pd.to_datetime(daily["_date"]).dt.strftime("%a")  # Mon, Tue, ...

    return {
        "daily": [
            {
                "date":         str(row["_date"]),
                "label":        row["label"],
                "transactions": int(row["transactions"]),
                "fraud":        int(row["fraud"]),
                "legit":        int(row["legit"]),
            }
            for _, row in daily.iterrows()
        ]
    }


@app.get("/dashboard/recent-alerts")
def dashboard_recent_alerts(limit: int = 20):
    """
    Alert terbaru untuk widget RecentAlerts di dashboard.
    Sumber data sama dengan /alerts/feed (review_feedback + fraud rows).
    Hanya menampilkan status unread/read (bukan resolved) agar terasa urgen.
    """
    all_alerts = _generate_alerts_from_data(limit_fraud=500)

    # Prioritaskan unread, lalu read — skip resolved untuk dashboard widget
    priority = [a for a in all_alerts if a["status"] in ("unread", "read")]
    recent   = priority[:limit]

    # Map ke shape yang dipakai RecentAlerts.js
    ICON_MAP = {
        "fraud":     "bi-exclamation-triangle-fill",
        "blacklist": "bi-ban",
        "rule":      "bi-gear-fill",
        "review":    "bi-clipboard-check",
        "system":    "bi-cpu",
    }

    def _time_relative(ts: str) -> str:
        from datetime import datetime, timezone
        try:
            ts_clean = ts.replace("Z", "+00:00").replace("T", " ")
            if "+" not in ts_clean:
                ts_clean += "+00:00"
            dt   = datetime.fromisoformat(ts_clean)
            diff = int((datetime.now(timezone.utc) - dt).total_seconds())
            if diff < 3600:  return f"{diff // 60} minutes ago"
            if diff < 86400: return f"{diff // 3600} hours ago"
            return f"{diff // 86400} days ago"
        except Exception:
            return "recently"

    def _severity_to_type(sev: str) -> str:
        if sev in ("critical", "high"):   return "high"
        if sev == "medium":               return "medium"
        return "low"

    mapped = []
    for a in recent:
        mapped.append({
            "id":          a["id"],
            "type":        _severity_to_type(a["severity"]),
            "title":       a["title"],
            "description": a["message"][:100] + ("…" if len(a["message"]) > 100 else ""),
            "time":        _time_relative(a.get("time", "")),
            "userId":      a.get("txnId") or "—",
            "amount":      None,
            "icon":        ICON_MAP.get(a["type"], "bi-exclamation-triangle-fill"),
            "patterns":    [],
            "domain":      "",
            "transaction_id": a.get("txnId", ""),
        })

    summary = {"high": 0, "medium": 0, "low": 0}
    for m in mapped:
        summary[m["type"]] = summary.get(m["type"], 0) + 1

    return {
        "alerts":  mapped,
        "summary": summary,
        "total":   len(mapped),
        "source":  "alerts_feed",
    }


@app.get("/dashboard/recent-transactions")
def dashboard_recent_transactions(limit: int = 5):
    """
    Transaksi terbaru (campuran fraud & normal) untuk tabel Recent Transactions.
    """
    import hashlib

    df_a = pd.read_csv(AGENUSA_DATASET_PATH)
    df_a = df_a.sort_values("TIMESTAMP_DB", ascending=False).head(limit * 4)

    def stable_rand(seed_str: str, lo: float, hi: float) -> float:
        h = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
        return lo + ((h % 10000) / 10000.0) * (hi - lo)

    results = []
    for idx, row in df_a.iterrows():
        is_fraud = int(row.get("IS_FRAUD", 0))
        seed     = f"dash-{idx}"
        if is_fraud:
            risk_level = "high"
            status     = "fraud"
            risk_score = int(stable_rand(seed, 70, 99))
        elif stable_rand(seed + "s", 0, 1) > 0.7:
            risk_level = "medium"
            status     = "review"
            risk_score = int(stable_rand(seed, 40, 69))
        else:
            risk_level = "low"
            status     = "safe"
            risk_score = int(stable_rand(seed, 5, 39))

        amount_idr = f"Rp {int(row.get('AMOUNT', 0)):,}".replace(",", ".")
        ts = str(row.get("TIMESTAMP_DB", ""))[:10]

        results.append({
            "id":          f"AGN-{str(idx + 1).zfill(6)}",
            "amount":      amount_idr,
            "date":        ts,
            "status":      status,
            "risk_level":  risk_level,
            "risk_score":  risk_score,
            "account_id":  str(row.get("ACCOUNT_NUMBER", "—")),
        })

    # Ambil limit transaksi: prioritaskan variasi status
    results = results[:limit]
    return {"transactions": results, "total": len(results)}


def _dashboard_top_patterns() -> list:
    """
    Ambil data dari /patterns/stats dan format ke bentuk yang dibutuhkan
    komponen TopFraudPatterns di dashboard.
    """
    # ── Metadata lengkap per pattern key ────────────────────────────────────
    PATTERN_META: dict[str, dict] = {
        "bruteforce_pin_pattern": {
            "name": "Multiple Failed Logins",
            "description": "Brute force credential attempts detected",
            "examples": ["5+ attempts", "Same IP", "Short interval"],
            "riskLevel": "high",
        },
        "high_amount_spike": {
            "name": "Unusual Transaction Amount",
            "description": "Transaction significantly above user average",
            "examples": [">3x avg", "New merchant", "Single session"],
            "riskLevel": "high",
        },
        "impossible_travel_terminal_switch": {
            "name": "Location Mismatch",
            "description": "Different from user's registered profile location",
            "examples": ["New city", "Foreign IP", "VPN detected"],
            "riskLevel": "medium",
        },
        "rapid_retry_declined": {
            "name": "Rapid Successive Transactions",
            "description": "Multiple transactions within a short time window",
            "examples": ["<2 min gap", "Same merchant", "Velocity breach"],
            "riskLevel": "medium",
        },
        "midnight_unusual_amount": {
            "name": "Midnight Unusual Transaction",
            "description": "Activity during abnormal hours for this user",
            "examples": ["2AM–4AM", "Outside pattern", "Dormant account"],
            "riskLevel": "low",
        },
        "money_mule_destination": {
            "name": "Money Mule Destination",
            "description": "Transfer to known money mule account patterns",
            "examples": ["Flagged dest", "Rapid forward", "New account"],
            "riskLevel": "high",
        },
        "refund_abuse_pattern": {
            "name": "Refund Abuse Pattern",
            "description": "Systematic refund requests indicating abuse",
            "examples": ["Multiple refunds", "Same merchant", "Short window"],
            "riskLevel": "high",
        },
        "burst_payment_pattern": {
            "name": "Burst Payment Pattern",
            "description": "Sudden spike in payment frequency",
            "examples": ["10+ in 1 hr", "New payees", "Odd hours"],
            "riskLevel": "medium",
        },
        "payment_spike": {
            "name": "Payment Amount Spike",
            "description": "Bill payment significantly above historical average",
            "examples": [">5x avg", "Single session", "New channel"],
            "riskLevel": "high",
        },
        "underpayment": {
            "name": "Underpayment Pattern",
            "description": "Systematic partial payments to manipulate billing",
            "examples": ["<10% of bill", "Repeated", "Multiple accounts"],
            "riskLevel": "low",
        },
        "sudden_channel_switch_to_api": {
            "name": "Sudden Channel Switch",
            "description": "Abrupt switch to API channel after Web/Mobile",
            "examples": ["API new user", "High volume", "Odd timing"],
            "riskLevel": "medium",
        },
        "payment_date_anomaly": {
            "name": "Payment Date Anomaly",
            "description": "Payment on unusual date relative to billing cycle",
            "examples": ["Pre-bill date", "After due+30d", "First payment"],
            "riskLevel": "low",
        },
    }

    # ── Ambil occurrences real dari CSV ──────────────────────────────────────
    live_counts: dict[str, int] = {}
    try:
        raw = get_pattern_stats()   # panggil endpoint /patterns/stats yang sudah ada
        for p in raw.get("patterns", []):
            live_counts[p["key"]] = p.get("occurrences", 0)
    except Exception:
        pass

    # ── Gabungkan metadata + live counts ────────────────────────────────────
    results = []
    for idx, (key, meta) in enumerate(PATTERN_META.items()):
        occ = live_counts.get(key, meta.get("occurrences_fallback", 0))

        # Trend sederhana: bandingkan dengan rata-rata
        avg = sum(live_counts.values()) / len(live_counts) if live_counts else 50
        if occ > avg * 1.1:
            trend = "up"
        elif occ < avg * 0.9:
            trend = "down"
        else:
            trend = "stable"

        results.append({
            "id":          idx + 1,
            "pattern":     meta["name"],
            "description": meta["description"],
            "examples":    meta["examples"],
            "occurrences": occ,
            "riskLevel":   meta["riskLevel"],
            "trend":       trend,
        })

    # Sort by occurrences desc, ambil top 6
    results.sort(key=lambda x: x["occurrences"], reverse=True)
    return results[:6]


def _dashboard_activity_preview(limit: int = 8) -> list:
    """
    Ambil riwayat aktivitas terbaru dari activity/feed,
    format persis seperti yang digunakan ActivityTimeline widget dashboard.
    """
    try:
        feed = get_activity_feed(limit=limit)
        return feed.get("activities", [])[:limit]
    except Exception:
        return []


@app.get("/dashboard/all")
def dashboard_all():
    """
    Single endpoint — return semua data dashboard sekaligus.
    Dipanggil satu kali saat Dashboard mount.
    """
    stats        = dashboard_stats()
    daily        = dashboard_transactions_daily()
    alerts_data  = dashboard_recent_alerts(limit=20)
    recent_tx    = dashboard_recent_transactions(limit=5)
    top_patterns = _dashboard_top_patterns()
    activity     = _dashboard_activity_preview(limit=8)

    return {
        "stats":               stats,
        "transactions_daily":  daily["daily"],
        "recent_alerts":       alerts_data["alerts"],
        "alerts_summary":      alerts_data["summary"],
        "recent_transactions": recent_tx["transactions"],
        "top_patterns":        top_patterns,
        "activity_preview":    activity,
    }

# ═══════════════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════════════
# ALERTS LOG ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

def _generate_alerts_from_data(limit_fraud: int = 30) -> list[dict]:
    """
    Bangun list alert dari empat sumber:
      0. alerts_log.json      → alert langsung dari ManualReview (POST /alerts)
      1. review_feedback.csv  → type review / fraud
      2. agenusa fraud rows   → type fraud / blacklist / rule
      3. nusabill fraud rows  → type fraud / rule
      4. Static system events → type system
    Setiap alert punya shape:
      id, type, severity, status, title, message, txnId, time
    """
    import hashlib, random, json as _json
    from datetime import datetime, timezone

    alerts: list[dict] = []

    # ── 0. alerts_log.json — alert langsung dari ManualReview ──────────────
    if _ALERTS_LOG_PATH.exists():
        try:
            saved = _json.loads(_ALERTS_LOG_PATH.read_text(encoding="utf-8"))
            alerts.extend(saved)
        except Exception:
            pass

    # IDs yang sudah ada dari alerts_log agar tidak duplikat dengan review_feedback
    _saved_txn_ids = {a.get("txnId") for a in alerts if a.get("txnId")}

    PATTERN_TITLE = {
        "bruteforce_pin_pattern":            ("Brute Force PIN Terdeteksi",         "fraud",     "critical"),
        "money_mule_destination":            ("Money Mule Destination",              "blacklist", "critical"),
        "impossible_travel_terminal_switch": ("Impossible Travel Terdeteksi",        "fraud",     "high"),
        "high_amount_spike":                 ("Transaksi Jumlah Sangat Besar",       "fraud",     "high"),
        "midnight_unusual_amount":           ("Transaksi Dini Hari Mencurigakan",    "rule",      "medium"),
        "rapid_retry_declined":              ("Rapid Retry Setelah Ditolak",         "rule",      "high"),
        "payment_spike":                     ("Payment Spike Terdeteksi",            "fraud",     "high"),
        "underpayment":                      ("Pola Underpayment",                   "rule",      "medium"),
        "refund_abuse_pattern":              ("Penyalahgunaan Refund",               "fraud",     "critical"),
        "burst_payment_pattern":             ("Burst Payment Pattern",               "rule",      "high"),
        "sudden_channel_switch_to_api":      ("Perpindahan Channel Mendadak ke API", "rule",      "medium"),
        "payment_date_anomaly":              ("Anomali Tanggal Pembayaran",          "rule",      "low"),
    }

    def _stable_status(seed: str) -> str:
        h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
        v = h % 10
        if v < 3:   return "unread"
        if v < 7:   return "read"
        return "resolved"

    def _fmt_idr(val) -> str:
        try:
            return f"Rp {int(float(val)):,}".replace(",", ".")
        except Exception:
            return "Rp —"

    # ── 1. review_feedback.csv ──────────────────────────────────────────────
    if REVIEW_FEEDBACK_PATH.exists():
        import csv as _csv
        with open(REVIEW_FEEDBACK_PATH, "r", encoding="utf-8") as f:
            fb_rows = list(_csv.DictReader(f))

        for i, r in enumerate(fb_rows):
            txn_id   = r.get("transaction_id", f"REV-{i}")
            decision = r.get("decision", "approved")
            patterns = [p for p in r.get("matched_patterns", "").split("|") if p]
            primary  = patterns[0] if patterns else ""
            domain   = r.get("domain", "")
            score    = float(r.get("ml_fraud_score", 0) or 0)
            ts       = r.get("reviewed_at", "") or ""

            # Amount
            amt_raw = r.get("BILL_AMOUNT") or r.get("AMOUNT") or "0"
            try:
                amt = int(float(amt_raw))
            except Exception:
                amt = 0
            amt_fmt = _fmt_idr(amt)

            acct = r.get("ACCOUNT_NUMBER") or r.get("CUSTOMER_ID") or "—"

            # Skip jika txnId sudah ada dari alerts_log.json (lebih lengkap)
            if txn_id in _saved_txn_ids:
                continue

            if decision == "rejected":
                cfg = PATTERN_TITLE.get(primary,
                      ("Fraud Dikonfirmasi Manual Review", "fraud", "critical"))
                alerts.append({
                    "id":       f"ALT-FB-{txn_id}",
                    "type":     cfg[1],
                    "severity": cfg[2],
                    "status":   "unread",
                    "title":    f"{cfg[0]} — {txn_id}",
                    "message":  (
                        f"Transaksi {txn_id} ({domain.upper()}) ditolak oleh reviewer. "
                        f"Fraud score: {round(score*100)}/100. "
                        f"Jumlah: {amt_fmt}. "
                        + (f"Pattern: {', '.join(patterns[:2])}." if patterns else "")
                    ),
                    "txnId":    txn_id,
                    "time":     ts,
                })
            else:
                alerts.append({
                    "id":       f"ALT-FB-{txn_id}",
                    "type":     "review",
                    "severity": "low",
                    "status":   "resolved",
                    "title":    f"Transaksi Disetujui — {txn_id}",
                    "message":  (
                        f"Transaksi {txn_id} ({domain.upper()}) diverifikasi dan disetujui "
                        f"setelah manual review. ML score: {round(score*100)}/100. "
                        f"Akun: {acct}."
                    ),
                    "txnId":    txn_id,
                    "time":     ts,
                })

    # ── 2. Agenusa fraud rows ───────────────────────────────────────────────
    try:
        df_a = pd.read_csv(AGENUSA_DATASET_PATH)
        fraud_a = (
            df_a[df_a["IS_FRAUD"] == 1]
            .sort_values("TIMESTAMP_DB", ascending=False)
            .head(limit_fraud)
        )
        for idx, row in fraud_a.iterrows():
            acct    = str(row.get("ACCOUNT_NUMBER", "—"))
            amount  = row.get("AMOUNT", 0)
            ts      = str(row.get("TIMESTAMP_DB", ""))
            resp    = int(row.get("RESPONSE_CODE", 0) or 0)
            proc    = int(row.get("PROCESSING_CODE", 0) or 0)
            term    = str(row.get("TERMINAL_ID", "—"))
            seed    = f"agn-{idx}"

            # Semua IS_FRAUD=1 selalu type="fraud" agar filter konsisten
            alert_type = "fraud"
            if resp == 55:
                severity = "critical"
                title    = f"Fraud Terdeteksi — Brute Force PIN {acct}"
                message  = (
                    f"Rekening {acct} terdeteksi pola brute force PIN (RESPONSE_CODE=55) "
                    f"di terminal {term}. Jumlah transaksi: {_fmt_idr(amount)}."
                )
            elif proc == 300000:
                severity = "high"
                title    = f"Fraud Terdeteksi — Transfer Mencurigakan {acct}"
                message  = (
                    f"Transaksi transfer mencurigakan pada akun {acct}. "
                    f"Jumlah: {_fmt_idr(amount)} melalui terminal {term}."
                )
            elif proc == 400000:
                severity = "high"
                title    = f"Fraud Terdeteksi — Withdrawal Anomali {acct}"
                message  = (
                    f"Penarikan anomali terdeteksi pada akun {acct}. "
                    f"Jumlah penarikan: {_fmt_idr(amount)} di terminal {term}."
                )
            else:
                severity = "high"
                title    = f"Fraud Terdeteksi — {acct}"
                message  = (
                    f"Transaksi mencurigakan pada akun {acct} sejumlah {_fmt_idr(amount)} "
                    f"di terminal {term}. Ditandai sistem secara otomatis."
                )

            txn_id = f"AGN-{str(idx+1).zfill(6)}"
            alerts.append({
                "id":       f"ALT-AGN-{idx}",
                "type":     alert_type,
                "severity": severity,
                "status":   _stable_status(seed),
                "title":    title,
                "message":  message,
                "txnId":    txn_id,
                "time":     ts,
            })
    except Exception as e:
        pass  # dataset tidak ditemukan

    # ── 3. Nusabill fraud rows ──────────────────────────────────────────────
    try:
        df_n = pd.read_csv(NUSABILL_DATASET_PATH)
        fraud_n = (
            df_n[df_n["IS_FRAUD"] == 1]
            .sort_values("PAYMENT_DATE", ascending=False)
            .head(limit_fraud)
        )
        for idx, row in fraud_n.iterrows():
            cust    = str(row.get("CUSTOMER_ID", "—"))
            bill_id = str(row.get("BILL_ID", "—"))
            amount  = row.get("PAYMENT_AMOUNT", 0)
            ts      = str(row.get("PAYMENT_DATE", ""))
            channel = str(row.get("CHANNEL", "—"))
            seed    = f"nus-{idx}"

            # Semua IS_FRAUD=1 selalu type="fraud" agar filter konsisten
            alert_type = "fraud"
            if channel == "API":
                severity = "high"
                title    = f"Fraud Terdeteksi — API Burst Payment {cust}"
                message  = (
                    f"Pembayaran mencurigakan melalui API oleh {cust}. "
                    f"Tagihan {bill_id} dibayar {_fmt_idr(amount)} melalui API."
                )
            else:
                severity = "high"
                title    = f"Fraud Terdeteksi — {cust} (NusaBill)"
                message  = (
                    f"Pembayaran mencurigakan oleh {cust} sebesar {_fmt_idr(amount)} "
                    f"via {channel}. Bill ID: {bill_id}."
                )

            txn_id = f"NUS-{str(idx+1).zfill(6)}"
            alerts.append({
                "id":       f"ALT-NUS-{idx}",
                "type":     alert_type,
                "severity": severity,
                "status":   _stable_status(seed),
                "title":    title,
                "message":  message,
                "txnId":    txn_id,
                "time":     ts,
            })
    except Exception:
        pass

    # ── 4. Static system events ─────────────────────────────────────────────
    SYSTEM_EVENTS = [
        {
            "id": "ALT-SYS-001", "type": "system", "severity": "medium",
            "status": "read", "txnId": None,
            "title": "Model AI Diperbarui",
            "message": "Model deteksi fraud versi terbaru berhasil di-deploy. Akurasi meningkat ke 98.7%.",
            "time": "2026-01-20 18:00:00",
        },
        {
            "id": "ALT-SYS-002", "type": "system", "severity": "low",
            "status": "resolved", "txnId": None,
            "title": "Backup Database Berhasil",
            "message": "Backup harian database berhasil diselesaikan. Ukuran: 2.3 GB.",
            "time": "2026-01-20 03:00:00",
        },
        {
            "id": "ALT-SYS-003", "type": "review", "severity": "high",
            "status": "unread", "txnId": None,
            "title": "Manual Review — Antrian Menumpuk",
            "message": "Terdapat transaksi menunggu review lebih dari 2 jam. Segera tinjau antrian.",
            "time": "2026-01-21 08:00:00",
        },
        {
            "id": "ALT-SYS-004", "type": "blacklist", "severity": "medium",
            "status": "read", "txnId": None,
            "title": "Blacklist Import Selesai",
            "message": "47 rekening baru berhasil diimport ke blacklist dari laporan OJK.",
            "time": "2026-01-19 15:30:00",
        },
    ]
    alerts.extend(SYSTEM_EVENTS)

    # ── Deduplicate by id (review_feedback bisa punya txn_id yang sama > 1x) ──
    seen_ids: set[str] = set()
    unique_alerts: list[dict] = []
    for a in alerts:
        if a["id"] not in seen_ids:
            seen_ids.add(a["id"])
            unique_alerts.append(a)
    alerts = unique_alerts

    # ── Sort terbaru dulu ────────────────────────────────────────────────────
    def _sort_key(a):
        t = a.get("time", "")
        if not t:
            return ""
        # ISO timestamp dari review_feedback punya Z, normalise
        return t.replace("Z", "").replace("T", " ")[:19]

    alerts.sort(key=_sort_key, reverse=True)
    return alerts


@app.get("/alerts/feed")
def get_alerts_feed(
    limit:    int = 100,
    offset:   int = 0,
    type:     str = "all",
    severity: str = "all",
    status:   str = "all",
    search:   str = "",
):
    """
    Feed alert lengkap untuk halaman AlertsLog.
    Query params: type, severity, status, search, limit, offset.
    """
    all_alerts = _generate_alerts_from_data(limit_fraud=500)

    # ── Filter ───────────────────────────────────────────────────────────────
    filtered = all_alerts
    if type != "all":
        filtered = [a for a in filtered if a["type"] == type]
    if severity != "all":
        filtered = [a for a in filtered if a["severity"] == severity]
    if status != "all":
        filtered = [a for a in filtered if a["status"] == status]
    if search:
        q = search.lower()
        filtered = [
            a for a in filtered
            if q in a["title"].lower()
            or q in a["message"].lower()
            or (a.get("txnId") and q in a["txnId"].lower())
        ]

    total = len(filtered)
    page  = filtered[offset: offset + limit]

    # ── Summary counts ───────────────────────────────────────────────────────
    unread_count   = sum(1 for a in all_alerts if a["status"] == "unread")
    critical_count = sum(1 for a in all_alerts if a["severity"] == "critical")
    resolved_count = sum(1 for a in all_alerts if a["status"] == "resolved")

    return {
        "alerts":         page,
        "total":          total,
        "total_all":      len(all_alerts),
        "unread_count":   unread_count,
        "critical_count": critical_count,
        "resolved_count": resolved_count,
        "offset":         offset,
        "limit":          limit,
    }


@app.get("/alerts/stats")
def get_alerts_stats():
    """
    Stat summary untuk AlertsStats card:
    total, critical, unread, resolved.
    """
    all_alerts = _generate_alerts_from_data(limit_fraud=500)
    return {
        "total":    len(all_alerts),
        "critical": sum(1 for a in all_alerts if a["severity"] == "critical"),
        "unread":   sum(1 for a in all_alerts if a["status"] == "unread"),
        "resolved": sum(1 for a in all_alerts if a["status"] == "resolved"),
    }

# ═══════════════════════════════════════════════════════════════════════════════
