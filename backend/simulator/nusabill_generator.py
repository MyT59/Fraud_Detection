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
BLACKLISTED_MERCHANT = "PAY-BL-00001"   # type = MERCHANT_ID (kode_pembayaran)


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
        "status_tagihan":     "terbayar",
        "status_akhir":       "SUCCESS",
        "tanggal_rekon":      now + timedelta(hours=1),
        "keterangan":         "Simulasi Nusabill",
        "ip_address":         random.choice(IP_POOL),
        # channel: BUKAN kolom DB, tapi dibaca map_nusabill() → transaction_details
        "channel":            random.choice(["MOBILE", "WEB", "ATM"]),
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
def generate_blacklist_merchant() -> list[dict]:
    inv = _base_invoice()
    inv["kode_pembayaran"] = BLACKLISTED_MERCHANT
    return [inv]


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
        inv["channel"]     = random.choice(["MOBILE", "WEB"])
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
# PUBLIC API
# ============================================================
def get_all_scenarios() -> dict[str, list[dict]]:
    """
    Kembalikan semua skenario simulasi dalam satu dict.
    Siap di-insert ke InvoiceTransactionRepository via _to_db(),
    lalu diproses via DataAggregationService.process_nusabill().
    """
    return {
        "normal":                 generate_normal(20),
        "blacklist_ip":           generate_blacklist_ip(),
        "blacklist_customer":     generate_blacklist_customer(),
        "blacklist_merchant":     generate_blacklist_merchant(),
        "fan_out_spam":           generate_fan_out_spam(),
        "burst_payment":          generate_burst_payment(),
        "high_spike":             generate_high_spike(),
        "underpay":               generate_underpay(),
        "channel_switch":         generate_channel_switch(),
        "early_payment_anomaly":  generate_early_payment_anomaly(),
        "velocity_burst":         generate_velocity_burst(),
        "high_amount":            generate_high_amount(),
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