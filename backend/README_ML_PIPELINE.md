# ML Pipeline FDS (Isolation + Random Forest)

## Tujuan
Dokumen ini menjelaskan alur ML yang dipakai di backend:
- `Isolation Forest` untuk anomaly scoring transaksi masuk.
- Hasil scoring dikirim ke `manual review`.
- Label final dari admin (`IS_FRAUD`) jadi data training baru.
- `Random Forest` diretrain berkala dan dipakai untuk deteksi fraud realtime.

Ini adalah arsitektur yang tepat untuk kasus kamu karena:
- transaksi baru awalnya tidak berlabel,
- tapi sistem tetap bisa belajar dari feedback manual secara terus-menerus.

---

## Arsitektur Model

### 1) Isolation Forest (Unsupervised)
Per domain:
- `backend/models/agenusa_isolation_forest.pkl`
- `backend/models/nusabill_isolation_forest.pkl`

Fungsi:
- memberi `anomaly_score`,
- memberi prioritas `HIGH_RISK / REVIEW / NORMAL`,
- membantu admin fokus ke transaksi paling mencurigakan.

Catatan:
- model ini untuk `screening` dan `early warning`,
- bukan keputusan final fraud.

### 2) Random Forest (Supervised)
Per domain:
- `backend/models/agenusa_fds_model.pkl`
- `backend/models/nusabill_fds_model.pkl`

Fungsi:
- klasifikasi fraud realtime berdasarkan pola dari data berlabel,
- keputusan utama model supervised (lebih stabil untuk known fraud patterns).

---

## Data & File Utama

### Dataset pattern (berlabel)
- `backend/agenusa_pattern_dataset.csv`
- `backend/nusabill_pattern_dataset.csv`

### Dataset isolation (tanpa label)
- `backend/agenusa_isolation_dataset.csv`
- `backend/nusabill_isolation_dataset.csv`

### Engine
- `backend/isolation_engine.py`
- `backend/fds_engine.py`

### Training script
- `backend/train_isolation_models.py`
- `backend/train_fds_models.py`

### Evaluasi
- `backend/evaluate_isolation_models.py`
- `backend/evaluate_fds_models.py`

---

## End-to-End Workflow

1. Transaksi baru masuk ke endpoint isolation:
   - `POST /isolation/{domain}/score-history`
2. Sistem memberi:
   - `anomaly_score`, `risk_label`, `matched_patterns`, `manual_action`
3. Tim admin review transaksi `HIGH_RISK/REVIEW`.
4. Admin memberi label final:
   - `IS_FRAUD=1` atau `IS_FRAUD=0`
5. Label final diappend ke historical dataset.
6. Retrain Random Forest berkala dari dataset berlabel terbaru.
7. Random Forest dipakai untuk prediksi realtime:
   - `POST /fds/{domain}/label-history`

---

## Jalankan Training & Evaluasi

Dari root project:

```powershell
venv\Scripts\python.exe backend\train_isolation_models.py
venv\Scripts\python.exe backend\evaluate_isolation_models.py
venv\Scripts\python.exe backend\train_fds_models.py
venv\Scripts\python.exe backend\evaluate_fds_models.py
```

Output report:
- `backend/models/isolation_evaluation_report.json`
- `backend/models/isolation_evaluation_summary.md`
- `backend/models/evaluation_report.json`

---

## Rekomendasi Operasional

1. Jangan auto-block hanya dari Isolation Forest.
2. Gunakan Isolation untuk prioritas review + discovery pola baru.
3. Gunakan Random Forest sebagai model keputusan utama realtime.
4. Simpan semua hasil review admin sebagai feedback loop.
5. Tetapkan retraining schedule (mis. mingguan).
6. Monitor metrik utama:
   - Recall fraud
   - Precision fraud
   - False positive rate
   - Drift data

---

## Diskusi Lanjutan (yang perlu diputuskan)

1. SLA manual review:
   - berapa menit/jam untuk transaksi `HIGH_RISK`?
2. Retraining cadence:
   - harian, mingguan, atau volume-based?
3. Gating rule realtime:
   - kapan transaksi ditahan sementara vs langsung lanjut dengan flag?
4. Threshold policy per domain:
   - tetap statis atau auto-calibrated tiap retrain?

---

## Kode Siap Copy (Decision Engine Realtime)

Contoh ini untuk keputusan cepat banking:
- `ALLOW`
- `STEP_UP` (OTP/challenge)
- `TEMP_BLOCK` (sementara, wajib review)

```python
from dataclasses import dataclass
from typing import Any


@dataclass
class PolicyConfig:
    rf_step_up_threshold: float
    rf_block_threshold: float
    iso_review_threshold: float
    iso_block_threshold: float


DOMAIN_POLICY = {
    "agenusa": PolicyConfig(
        rf_step_up_threshold=0.70,
        rf_block_threshold=0.93,
        iso_review_threshold=-0.009879,
        iso_block_threshold=-0.020000,
    ),
    "nusabill": PolicyConfig(
        rf_step_up_threshold=0.65,
        rf_block_threshold=0.90,
        iso_review_threshold=-0.084698,
        iso_block_threshold=-0.120000,
    ),
}

CRITICAL_PATTERNS = {
    "bruteforce_pin_pattern",
    "money_mule_destination",
    "impossible_travel_terminal_switch",
    "refund_abuse_pattern",
    "burst_payment_pattern",
}


def decide_action(
    domain: str,
    rf_score: float,
    iso_decision_score: float,
    matched_patterns: list[str],
    amount: float,
    hard_blacklist_hit: bool = False,
) -> dict[str, Any]:
    cfg = DOMAIN_POLICY[domain]
    has_critical_pattern = any(p in CRITICAL_PATTERNS for p in matched_patterns)

    if hard_blacklist_hit:
        return {"decision": "TEMP_BLOCK", "reason": "hard_blacklist", "priority": "P1"}

    # Tier 1: immediate temp block
    if rf_score >= cfg.rf_block_threshold and (has_critical_pattern or iso_decision_score <= cfg.iso_block_threshold):
        return {"decision": "TEMP_BLOCK", "reason": "rf_high_plus_risk_signal", "priority": "P1"}

    # Tier 2: step-up challenge
    if rf_score >= cfg.rf_step_up_threshold or iso_decision_score <= cfg.iso_review_threshold or has_critical_pattern:
        return {"decision": "STEP_UP", "reason": "medium_risk", "priority": "P2"}

    # Tier 3: allow
    return {"decision": "ALLOW", "reason": "low_risk", "priority": "P3"}
```

Contoh integrasi endpoint FastAPI (pseudo-runtime):

```python
# 1) score dari RF (supervised)
rf_result = score_history(domain, [tx], review_threshold=0.35, high_risk_threshold=0.5)["results"][0]
rf_score = rf_result["ml_fraud_score"]
patterns = rf_result["matched_patterns"]

# 2) score dari Isolation (unsupervised)
iso_result = score_history_isolation(domain, [tx])["results"][0]
iso_decision_score = iso_result["anomaly_score"] * -1  # balik ke decision score jika perlu

# 3) putuskan aksi realtime
decision = decide_action(
    domain=domain,
    rf_score=rf_score,
    iso_decision_score=iso_decision_score,
    matched_patterns=patterns,
    amount=float(tx.get("AMOUNT", tx.get("PAYMENT_AMOUNT", 0))),
    hard_blacklist_hit=False,
)
```

Template payload output yang disarankan:

```json
{
  "decision": "STEP_UP",
  "priority": "P2",
  "reason": "medium_risk",
  "rf_score": 0.81,
  "iso_decision_score": -0.012,
  "matched_patterns": ["money_mule_destination"],
  "manual_review_required": true
}
```
