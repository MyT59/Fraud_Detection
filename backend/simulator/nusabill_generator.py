"""
nusabill_generator.py
=====================
Generator data simulasi transaksi tagihan/invoice untuk domain NUSABILL.

Format output: flat dict sesuai struktur InvoiceTransaction model,
siap di-insert ke repo lalu diproses via map_nusabill() → process_transaction().

Fungsi utama untuk Frontend:
  get_all_scenarios() → dict[str, list[dict]]
"""

import random
import string
from datetime import datetime, timedelta, timezone

from app.infrastructure.database.session import SessionLocal
from app.infrastructure.repositories.invoice_transaction_repository import InvoiceTransactionRepository

# ============================================================
# CONSTANTS & POOLS
# ============================================================
IP_POOL  = ["114.10.20.30", "180.250.50.60", "36.90.120.15"]
SOF_POOL = ["VIRTUAL_ACCOUNT", "EWALLET", "CREDIT_CARD"]

# ⚠️ Pastikan sudah ada di tabel blacklist_items sebelum demo
BLACKLISTED_IP       = "99.99.99.99"    # type = IP_ADDRESS
BLACKLISTED_CUSTOMER = "CUST-BL-00001"  # type = CUSTOMER_ID


# ============================================================
# INTERNAL HELPERS
# ============================================================
def _generate_invoice_no() -> str:
    return "INV-" + "".join(random.choices(string.digits, k=10))


def _base_invoice(time_override=None) -> dict:
    """
    Flat dict sesuai kolom InvoiceTransaction model.
    map_nusabill() akan memetakan ini ke format Transaction.

    Kolom payment_amount (nullable):
      - Tidak di-set (None) → map_nusabill() fallback ke total_tagihan → transaksi normal
      - Di-set eksplisit    → dipakai untuk skenario high_spike / underpay
    
    Field 'channel' bukan kolom di InvoiceTransaction, tapi dibaca oleh
    map_nusabill() dari data dict langsung → disimpan ke transaction_details["channel"].
    """
    now = time_override or datetime.now(timezone.utc)
    total_tagihan = round(random.uniform(20_000, 500_000), 2)
    return {
        "no_invoice":         _generate_invoice_no(),
        "tanggal_tagihan":    now - timedelta(days=1),
        "tanggal_pembayaran": now,
        "customer_id":        "CUST-" + "".join(random.choices(string.digits, k=5)),
        "nama_customer":      "NUSA_USER_" + "".join(random.choices(string.ascii_uppercase, k=3)),
        "sof":                random.choice(SOF_POOL),
        "total_tagihan":      total_tagihan,
        "payment_amount":     None,   # NULL = normal, mapper fallback ke total_tagihan
        "biaya_admin":        2_500.00,
        "utc_reference":      "REF" + "".join(random.choices(string.digits, k=8)),
        "kode_pembayaran":    "PAY" + "".join(random.choices(string.digits, k=4)),
        # Pembayaran normal harus berawal dari invoice yang belum dibayar.
        # Status `PAID`/`terbayar` khusus untuk skenario double-payment.
        "status_tagihan":     "belum_terbayar",
        "status_akhir":       "SUCCESS",
        "tanggal_rekon":      now + timedelta(hours=1),
        "keterangan":         "Simulasi Nusabill",
        "ip_address":         random.choice(IP_POOL),
        # channel: BUKAN kolom DB, tapi dibaca map_nusabill() → transaction_details
        "channel":            random.choice(["MOBILE_BANKING", "WEB", "ATM"]),
    }


# field yang ada di generator dict tapi BUKAN kolom InvoiceTransaction
# → di-strip sebelum bulk_create, tapi sudah dibaca map_nusabill() sebelumnya
_NON_MODEL_FIELDS = {"channel"}

def _to_db(record: dict) -> dict:
    """Strip field non-kolom sebelum InvoiceTransaction(**record)."""
    return {k: v for k, v in record.items() if k not in _NON_MODEL_FIELDS}


# ============================================================
# SCENARIO 1 — NORMAL
# ============================================================
def generate_normal(count: int = 20) -> list[dict]:
    """Transaksi normal. Tidak seharusnya memicu engine manapun."""
    return [_base_invoice() for _ in range(count)]


# ============================================================
# SCENARIO 2 — BLACKLIST IP
# Target engine : Blacklist Engine → IP_ADDRESS
# ============================================================
def generate_blacklist_ip() -> list[dict]:
    inv = _base_invoice()
    inv["ip_address"] = BLACKLISTED_IP
    return [inv]


# ============================================================
# SCENARIO 3 — BLACKLIST CUSTOMER
# Target engine : Blacklist Engine → CUSTOMER_ID
# ============================================================
def generate_blacklist_customer() -> list[dict]:
    inv = _base_invoice()
    inv["customer_id"] = BLACKLISTED_CUSTOMER
    return [inv]


# ============================================================
# SCENARIO 4 — BLACKLIST MERCHANT (kode_pembayaran)
# Target engine : Blacklist Engine → MERCHANT_ID
# map_nusabill() → merchant_id = kode_pembayaran
# ============================================================
# ============================================================
# SCENARIO 5 — FAN-OUT SPAM BILLING
# Target engine : Pattern Engine (NETWORK_FAN_OUT)
# Trigger       : distinct_customer_count >= 20 dalam 5 menit
#                 risk_score: 70, action: BLOCK
# ============================================================
def generate_fan_out_spam() -> list[dict]:
    """1 user membayar 22 nama customer berbeda dalam < 2 menit."""
    records   = []
    base_time = datetime.now(timezone.utc)
    hacker_id = "CUST-HACKER-001"

    for i in range(22):
        inv = _base_invoice(time_override=base_time + timedelta(seconds=i * 3))
        inv["customer_id"]   = hacker_id
        inv["nama_customer"] = f"VICTIM_NAME_{i}"
        records.append(inv)

    return records


# ============================================================
# SCENARIO 6 — BURST PAYMENT
# Target engine : Pattern Engine (AI Discovery: BURST_ATTACK) + ML
# Trigger       : PAYMENT_GAP_MINUTES <= 5.0 → BURST_FLAG = 1
# ============================================================
def generate_burst_payment() -> list[dict]:
    """6 pembayaran dari 1 customer dalam 2 menit (interval ~20 detik)."""
    records     = []
    base_time   = datetime.now(timezone.utc)
    customer_id = "CUST-BURST-" + "".join(random.choices(string.digits, k=4))

    for i in range(6):
        inv = _base_invoice(time_override=base_time + timedelta(seconds=i * 20))
        inv["customer_id"] = customer_id
        records.append(inv)

    return records


# ============================================================
# SCENARIO 7 — HIGH SPIKE
# Target engine : Pattern Engine (AI Discovery: AMOUNT_ANOMALY) + ML
# Trigger       : PAYMENT_TO_BILL_RATIO > 4.0 → HIGH_SPIKE_FLAG = 1
# payment_amount di-set eksplisit > 4× total_tagihan.
# ============================================================
def generate_high_spike() -> list[dict]:
    """Bayar jauh melebihi tagihan (>4×) — indikasi card testing."""
    records = []
    for _ in range(3):
        inv  = _base_invoice()
        bill = round(random.uniform(50_000, 200_000), 2)
        inv["total_tagihan"]  = bill
        inv["payment_amount"] = round(bill * random.uniform(4.5, 8.0), 2)
        records.append(inv)
    return records


# ============================================================
# SCENARIO 8 — UNDERPAYMENT
# Target engine : ML (UNDERPAY_FLAG)
# Trigger       : PAYMENT_TO_BILL_RATIO < 0.3
# payment_amount di-set eksplisit < 30% total_tagihan.
# ============================================================
def generate_underpay() -> list[dict]:
    """Bayar hanya sebagian kecil tagihan (<30%) — split payment fraud."""
    records = []
    for _ in range(3):
        inv  = _base_invoice()
        bill = round(random.uniform(200_000, 1_000_000), 2)
        inv["total_tagihan"]  = bill
        inv["payment_amount"] = round(bill * random.uniform(0.05, 0.25), 2)
        records.append(inv)
    return records


# ============================================================
# SCENARIO 9 — CHANNEL SWITCH TO API
# Target engine : ML (CHANNEL_SWITCH_TO_API)
# Trigger       : prev_channel != API AND current == API
# Kirim berurutan agar historical context terbentuk.
# ============================================================
def generate_channel_switch() -> list[dict]:
    """3× transaksi via MOBILE/WEB, lalu tiba-tiba pakai API."""
    records     = []
    base_time   = datetime.now(timezone.utc)
    customer_id = "CUST-CHSW-" + "".join(random.choices(string.digits, k=4))

    for i in range(3):
        inv = _base_invoice(time_override=base_time - timedelta(hours=3 - i))
        inv["customer_id"] = customer_id
        inv["channel"]     = random.choice(["MOBILE_BANKING", "WEB"])
        records.append(inv)

    inv_api = _base_invoice(time_override=base_time)
    inv_api["customer_id"] = customer_id
    inv_api["channel"]     = "API"
    records.append(inv_api)

    return records


# ============================================================
# SCENARIO 10 — EARLY PAYMENT ANOMALY
# Target engine : ML (EARLY_PAYMENT_ANOMALY)
# Trigger       : PAYMENT_DELAY_DAYS < -1.0 (bayar sebelum tagihan terbit)
# ============================================================
def generate_early_payment_anomaly() -> list[dict]:
    """Bayar 2 hari sebelum tagihan resmi terbit."""
    records = []
    now     = datetime.now(timezone.utc)
    for _ in range(3):
        inv = _base_invoice()
        inv["tanggal_tagihan"]    = now + timedelta(days=2)
        inv["tanggal_pembayaran"] = now
        records.append(inv)
    return records


# ============================================================
# SCENARIO 11 — VELOCITY BURST
# Target engine : Pattern Engine (VELOCITY) + Rule Engine
# Trigger       : tx_count >= 5 dalam 5 menit
# ============================================================
def generate_velocity_burst() -> list[dict]:
    """8 pembayaran dari customer yang sama dalam 4 menit."""
    records     = []
    base_time   = datetime.now(timezone.utc)
    customer_id = "CUST-VELO-" + "".join(random.choices(string.digits, k=4))

    for i in range(8):
        inv = _base_invoice(time_override=base_time + timedelta(seconds=i * 25))
        inv["customer_id"] = customer_id
        records.append(inv)

    return records


# ============================================================
# SCENARIO 13 — HIGH VELOCITY SMURFING
# Pattern ID 3 — "Nusabill - High-Velocity Split Payment Anomaly (Smurfing)"
# Trigger: tx_count>=5 AND total_amount>=24,999,998 dalam 8 menit
# risk_score: 80, action: REVIEW
# ============================================================
def generate_smurfing() -> list[dict]:
    """
    6 pembayaran besar dari 1 customer dalam 7 menit.
    Total amount > 25 juta (memenuhi total_amount>=24,999,998).
    Setiap invoice ~5 juta → total 6 × 5 juta = ~30 juta.
    """
    records     = []
    base_time   = datetime.now(timezone.utc)
    customer_id = "CUST-SMURF-" + "".join(random.choices(string.digits, k=4))

    for i in range(6):  # tx_count=6 >= 5 ✅
        inv = _base_invoice(time_override=base_time + timedelta(seconds=i * 60))
        inv["customer_id"]    = customer_id
        # ~5 juta per transaksi → total ~30 juta >= 24,999,998 ✅
        amount = round(random.uniform(4_500_000, 6_000_000), 2)
        inv["total_tagihan"]  = amount
        inv["payment_amount"] = amount
        records.append(inv)

    return records


# ============================================================
# SCENARIO 14 — FAKE INVOICE BLAST
# Pattern ID 6 — "Nusabill - Tuned Fake Invoice Blast Detection (Low Nominal Trap)"
# Trigger: distinct_customer_count>=20 AND amount>=250,000 dalam 6 menit
# risk_score: 85, action: REVIEW
# Berbeda dari fan_out_spam (nominal bebas) — ini butuh amount >= 250.000
# ============================================================
def generate_fake_invoice_blast() -> list[dict]:
    """
    1 user membayar tagihan 22 nama customer berbeda dalam < 5 menit,
    masing-masing minimal 250.000 (sesuai threshold pattern ID 6).
    """
    records   = []
    base_time = datetime.now(timezone.utc)
    hacker_id = "CUST-BLAST-" + "".join(random.choices(string.digits, k=4))

    for i in range(22):  # distinct_customer_count=22 >= 20 ✅
        inv = _base_invoice(time_override=base_time + timedelta(seconds=i * 12))
        inv["customer_id"]   = hacker_id
        inv["nama_customer"] = f"BLAST_VICTIM_{i:03d}"
        amount = round(random.uniform(250_000, 500_000), 2)  # amount >= 250.000 ✅
        inv["total_tagihan"]  = amount
        inv["payment_amount"] = amount
        records.append(inv)

    return records


# ============================================================
# SCENARIO 12 — HIGH AMOUNT
# Target engine : Rule Engine (amount) + Pattern Engine (AMOUNT)
# Trigger       : amount >= AMOUNT_THRESHOLD (5_000_000)
# ============================================================
def generate_high_amount() -> list[dict]:
    """Satu pembayaran dengan nominal sangat besar."""
    inv = _base_invoice()
    big = round(random.uniform(50_000_000, 200_000_000), 2)
    inv["total_tagihan"]  = big
    inv["payment_amount"] = big
    return [inv]

# ============================================================
# SCENARIO 15 — RULE: NUSABILL REPAYMENT BLOCK
# Target rule : rule_nusabill_repayment_block (Global Rule)
# Trigger     : status_tagihan == "PAID"
# ============================================================
# ============================================================
# SCENARIO 16 — RULE: NUSABILL MAX UNVERIFIED BILL
# Target rule : rule_nusabill_max_unverified_bill (Global Rule)
# Trigger     : amount > 5_000_000 (Untuk Unverified KYC Biller)
# ============================================================
def generate_rule_nusabill_max_unverified_bill() -> list[dict]:
    """Tagihan dari Biller yang belum KYC melebihi threshold Rp 5.000.000."""
    inv = _base_invoice()
    big_amount = round(random.uniform(5_500_000, 10_000_000), 2)
    inv["total_tagihan"]  = big_amount
    inv["payment_amount"] = big_amount
    return [inv]


# ============================================================
# SCENARIO 17 — VELOCITY BURST API ABUSE
# Pattern ID 13 — "Nusabill - Velocity Burst (API Abuse / Bulk Anomaly)"
# Trigger: tx_count>=100 dalam 5 menit
# risk_score: 75, action: REVIEW
# ============================================================
def generate_api_abuse() -> list[dict]:
    """
    1 customer membombardir 105 transaksi dalam < 5 menit via API.
    tx_count=105 >= 100 ✅, interval ~2.7 detik → semua dalam 5 menit ✅
    """
    records     = []
    base_time   = datetime.now(timezone.utc)
    customer_id = "CUST-API-" + "".join(random.choices(string.digits, k=4))

    for i in range(105):  # 105 tx >= 100 ✅
        inv = _base_invoice(time_override=base_time + timedelta(seconds=i * 2.7))
        inv["customer_id"] = customer_id
        inv["channel"]     = "API"
        records.append(inv)

    return records


# ============================================================
# ML SCENARIOS
# REFUND_FLAG sengaja tidak disediakan karena Nusabill tidak punya fitur refund.
# ============================================================
def generate_ml_unknown_mixed_outlier() -> list[dict]:
    """
    ML Unexplained Anomaly: kombinasi nilai langka tanpa menyalakan heuristic
    Nusabill yang dikenal. Hasil tetap bergantung pada model aktif.
    """
    now = datetime.now(timezone.utc)
    inv = _base_invoice(time_override=now)
    inv.update(
        {
            "tanggal_tagihan": now - timedelta(days=365),
            "tanggal_pembayaran": now,
            "total_tagihan": 4_900_000,
            "payment_amount": 4_900_000,
            "channel": "KIOSK_OFFLINE_UNSEEN",
            "status_tagihan": "belum_bayar",
            "sof": "UNSEEN_SETTLEMENT_RAIL",
            "kode_pembayaran": "PAY-ML-UNSEEN-999",
        }
    )
    return [inv]


# ============================================================
# PUBLIC API
# ============================================================
def get_scenario_catalog() -> dict[str, dict]:
    """Metadata scenario pattern aktif; diselaraskan dengan fraud_patterns."""
    catalog = {
        "normal": {
            "title": "Nusabill - Normal Invoices",
            "category": "Baseline",
            "description": "Dua puluh pembayaran invoice normal ",
            "target_engines": [],
            "trigger_conditions": [],
            "expected_result": "SAFE",
            "transaction_count": 20,
        },
        "blacklist_customer": {
            "title": "Nusabill - Blacklist CUSTOMER_ID",
            "category": "Blacklist",
            "description": "Pembayaran dilakukan oleh customer ID yang diblacklist.",
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["customer_id == 'CUST-BL-00001'"],
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },
        "blacklist_ip": {
            "title": "Nusabill - Blacklist IP_ADDRESS",
            "category": "Blacklist",
            "description": "Pembayaran berasal dari alamat IP yang diblacklist.",
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["ip_address == '99.99.99.99'"],
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },
        "smurfing": {
            "title": "Nusabill - High-Velocity Split Payment Anomaly (Smurfing)",
            "category": "Money Laundering & Split Transaction",
            "description": (
                "Enam pembayaran dari customer yang sama dengan akumulasi "
                "lebih dari Rp24.999.998 dalam window delapan menit."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "tx_count >= 5",
                "total_amount >= 24,999,998 dalam 8 menit",
            ],
            "fraud_pattern": {
                "id": 3,
                "risk_score": 80,
                "priority": 7,
                "action": "REVIEW",
                "logic": "AND",
                "time_window_minutes": 8,
            },
            "expected_result": "FLAGGED",
            "transaction_count": 6,
        },
        "fake_invoice_blast": {
            "title": "Nusabill - Tuned Fake Invoice Blast Detection (Low Nominal Trap)",
            "category": "Billing Scam & Bulk Invoicing",
            "description": (
                "Dua puluh dua invoice untuk nama customer berbeda dengan "
                "pembayaran minimal Rp250.000 dalam enam menit."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "distinct_customer_count >= 20",
                "amount >= 250,000 dalam 6 menit",
            ],
            "fraud_pattern": {
                "id": 6,
                "risk_score": 85,
                "priority": 5,
                "action": "REVIEW",
                "logic": "AND",
                "time_window_minutes": 6,
            },
            "expected_result": "FLAGGED",
            "transaction_count": 22,
        },
        "fan_out_spam": {
            "title": "Nusabill - Fan-Out Spam (Fake Invoice Mass Blast)",
            "category": "Phishing & Spam",
            "description": (
                "Satu customer ID digunakan untuk dua puluh dua nama customer "
                "berbeda dan sedikitnya dua puluh transaksi dalam lima menit."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "distinct_customer_count >= 20",
                "tx_count >= 20 dalam 5 menit",
            ],
            "fraud_pattern": {
                "id": 12,
                "risk_score": 80,
                "priority": 7,
                "action": "REVIEW",
                "logic": "AND",
                "time_window_minutes": 5,
            },
            "expected_result": "FLAGGED",
            "transaction_count": 22,
        },
        "api_abuse": {
            "title": "Nusabill - Velocity Burst (API Abuse / Bulk Anomaly)",
            "category": "System Abuse & Rate Limit Evasion",
            "description": (
                "Seratus lima transaksi dari customer yang sama melalui "
                "channel API dalam window lima menit."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": ["tx_count >= 100 dalam 5 menit"],
            "fraud_pattern": {
                "id": 13,
                "risk_score": 75,
                "priority": 7,
                "action": "REVIEW",
                "logic": "AND",
                "time_window_minutes": 5,
            },
            "expected_result": "FLAGGED",
            "transaction_count": 105,
        },
        "ml_burst_payment": {
            "title": "ML - Burst Payment",
            "category": "ML Feature Anomaly",
            "description": "Pembayaran berulang dari customer yang sama dengan gap maksimum lima menit.",
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["PAYMENT_GAP_MINUTES <= 5", "BURST_FLAG == 1"],
            "ml_pattern": {"key": "burst_payment_pattern"},
            "expected_result": "ML ANOMALY / FLAGGED",
            "transaction_count": 6,
        },
        "ml_payment_spike": {
            "title": "ML - Unusual High Payment",
            "category": "ML Feature Anomaly",
            "description": "Nominal pembayaran jauh melampaui nilai invoice.",
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["PAYMENT_TO_BILL_RATIO > 4"],
            "ml_pattern": {"key": "payment_spike"},
            "expected_result": "ML ANOMALY / FLAGGED",
            "transaction_count": 3,
        },
        "ml_underpayment": {
            "title": "ML - Underpayment Anomaly",
            "category": "ML Feature Anomaly",
            "description": "Pembayaran kurang dari tiga puluh persen nilai invoice.",
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["PAYMENT_TO_BILL_RATIO < 0.3"],
            "ml_pattern": {"key": "underpayment"},
            "expected_result": "ML ANOMALY / FLAGGED",
            "transaction_count": 3,
        },
        "ml_channel_switch_to_api": {
            "title": "ML - Sudden Channel Switch to API",
            "category": "ML Feature Anomaly",
            "description": "Customer beralih mendadak dari channel biasa ke API.",
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["previous channel != API", "current channel == API"],
            "ml_pattern": {"key": "sudden_channel_switch_to_api"},
            "expected_result": "ML ANOMALY / FLAGGED",
            "transaction_count": 4,
        },
        "ml_early_payment_anomaly": {
            "title": "ML - Early Payment Date Anomaly",
            "category": "ML Feature Anomaly",
            "description": "Pembayaran dilakukan lebih dari satu hari sebelum tanggal invoice.",
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["PAYMENT_DELAY_DAYS < -1"],
            "ml_pattern": {"key": "payment_date_anomaly"},
            "expected_result": "ML ANOMALY / FLAGGED",
            "transaction_count": 3,
        },
        "ml_unknown_mixed_outlier": {
            # Key lama dipertahankan agar request/history simulator tetap kompatibel.
            "title": "ML - Unexplained Anomaly",
            "category": "Unexplained ML Anomaly",
            "description": (
                "ML menilai kombinasi umur tagihan, channel, payment rail, "
                "merchant, dan nominal sebagai anomali, tetapi belum ada "
                "pattern bernama yang menjelaskannya."
            ),
            "target_engines": ["ML Engine"],
            "trigger_conditions": [
                "kombinasi feature berada di luar distribusi training",
                "is_anomaly == true dan patterns == []",
            ],
            "ml_pattern": {"key": None, "unknown": True},
            "expected_result": "ML ANOMALY (MODEL-DEPENDENT)",
            "transaction_count": 1,
        },
        "rule_nusabill_max_unverified_bill": {
            "title": "Nusabill - Pembayaran Bernilai Tinggi",
            "category": "NUSABILL_HIGH_PAYMENT",
            "description": (
                "Menandai pembayaran Virtual Account di atas Rp5.000.000 "
                "untuk pemeriksaan Fraud Analyst."
            ),
            "target_engines": ["Rule Engine"],
            "trigger_conditions": ["amount > 5,000,000"],
            "global_rule": {
                "id": 5,
                "rule_key": "rule_nusabill_max_unverified_bill",
                "rule_group": "NUSABILL_HIGH_PAYMENT",
                "action": "REVIEW",
                "severity": "MEDIUM",
                "priority": 50,
                "rule_config": {
                    "field": "amount",
                    "value": 5_000_000,
                    "operator": ">",
                },
            },
            "expected_result": "FLAGGED",
            "transaction_count": 1,
        },
    }
    for scenario in catalog.values():
        for target_key in ("fraud_pattern", "global_rule"):
            target = scenario.get(target_key)
            if target and target.get("action") == "REVIEW":
                target["action"] = "FLAG"
    return catalog


def get_all_scenarios() -> dict[str, list[dict]]:
    """
    Kembalikan semua skenario simulasi dalam satu dict.
    Siap di-insert ke InvoiceTransactionRepository via _to_db(),
    lalu diproses via DataAggregationService.process_nusabill().
    """
    return {
        "normal": generate_normal(),
        "blacklist_customer": generate_blacklist_customer(),
        "blacklist_ip": generate_blacklist_ip(),
        "smurfing": generate_smurfing(),
        "fake_invoice_blast": generate_fake_invoice_blast(),
        "fan_out_spam": generate_fan_out_spam(),
        "api_abuse": generate_api_abuse(),
        "ml_burst_payment": generate_burst_payment(),
        "ml_payment_spike": generate_high_spike(),
        "ml_underpayment": generate_underpay(),
        "ml_channel_switch_to_api": generate_channel_switch(),
        "ml_early_payment_anomaly": generate_early_payment_anomaly(),
        "ml_unknown_mixed_outlier": generate_ml_unknown_mixed_outlier(),
        "rule_nusabill_max_unverified_bill": generate_rule_nusabill_max_unverified_bill(),
    }


# ============================================================
# STANDALONE RUNNER
# ============================================================
if __name__ == "__main__":
    scenarios = get_all_scenarios()
    total     = sum(len(v) for v in scenarios.values())

    records = []
    for name, txs in scenarios.items():
        records.extend(txs)

    random.shuffle(records)

    db = SessionLocal()
    try:
        repo = InvoiceTransactionRepository(db)
        repo.bulk_create([_to_db(r) for r in records])
        print(f"✅ Berhasil generate {total} invoice Nusabill fiktif ke database!")
        for name, txs in scenarios.items():
            print(f"    [{name}] → {len(txs)} transaksi")
    finally:
        db.close()
