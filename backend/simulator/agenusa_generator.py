"""
agenusa_generator.py
====================
Generator data simulasi transaksi kartu untuk domain AGENUSA.

Format output: flat dict sesuai struktur SwitchingLog model,
siap di-insert ke repo lalu diproses via map_agenusa() → process_transaction().

Fungsi utama untuk Frontend:
  get_all_scenarios() → dict[str, list[dict]]
"""

import random
import string
from datetime import datetime, timedelta, timezone

from app.infrastructure.database.session import SessionLocal
from app.infrastructure.repositories.switching_log_repository import SwitchingLogRepository

# ============================================================
# CONSTANTS & POOLS
# ============================================================
TERMINALS       = ["71809339", "71809340", "71809341", "71809342"]
ISO_BY_MSG_TYPE = {
    "TRANSFER": {"mti": "0200", "processing_code": "200000"},
    "TARIK_SALDO": {"mti": "0200", "processing_code": "010000"},
    "CEK_SALDO": {"mti": "0100", "processing_code": "310000"},
}
BANK_CODES      = ["014", "008", "009", "002"]
IP_POOL         = ["36.90.120.15", "114.10.20.30", "180.250.50.60"]

# ⚠️ Pastikan sudah ada di tabel blacklist_items sebelum demo
BLACKLISTED_IP       = "99.99.99.99"     # type = IP_ADDRESS
BLACKLISTED_USER     = "USER-BL-00001"   # type = USER_ID (customer_ref_number)
BLACKLISTED_ACCOUNT  = "card_bl_000001"  # type = ACCOUNT_NUMBER
BLACKLISTED_TERMINAL = "TRM_BL_00001"    # type = TERMINAL_ID
BLACKLISTED_MERCHANT = "M_BL_00001"      # type = MERCHANT_ID

# Akun tujuan Money Mule — sesuai IS_MONEY_MULE_DEST di feature_builder.py
MONEY_MULE_DEST = "DST999999"


# ============================================================
# INTERNAL HELPERS
# ============================================================
def _generate_rrn() -> str:
    return "".join(random.choices(string.digits, k=12))


def _base_trx(time_override=None, msg_type: str = "TRANSFER") -> dict:
    """
    Flat dict sesuai field SwitchingLog model.
    map_agenusa() akan memetakan ini ke format Transaction.
    """
    msg_type = str(msg_type or "TRANSFER").upper()
    iso = ISO_BY_MSG_TYPE.get(msg_type, ISO_BY_MSG_TYPE["TRANSFER"])
    trx = {
        "rrn":                  _generate_rrn(),
        "timestamp_db":         time_override or datetime.now(timezone.utc),
        "mti":                  iso["mti"],
        "msg_raw":              "SIMULATED_MSG",
        "stan":                 "".join(random.choices(string.digits, k=6)),
        "terminal_id":          random.choice(TERMINALS),
        "merchant_id":          "M_" + "".join(random.choices(string.digits, k=4)),
        "processing_code":      iso["processing_code"],
        "msg_type":             msg_type,
        "response_code":        "00",
        "account_number":       "ACC" + "".join(random.choices(string.digits, k=8)),
        "dest_account_number":  "ACC" + "".join(random.choices(string.digits, k=8)),
        "customer_ref_number":  "CUST" + "".join(random.choices(string.digits, k=6)),
        "amount":               round(random.uniform(50_000, 2_000_000), 2),
        "issuer_bank":          random.choice(BANK_CODES),
        "dest_bank_code":       random.choice(BANK_CODES),
        "acquirer_code":        "014",
        "ip_address":           random.choice(IP_POOL),
        "issuer_account_number": "CARD" + "".join(random.choices(string.digits, k=8)),
        "fep_id":               "FEP-SIM-01",
    }

    # Hanya transfer yang memiliki rekening tujuan. Cek saldo adalah inquiry,
    # sehingga tidak merepresentasikan perpindahan dana.
    if msg_type != "TRANSFER":
        trx["dest_account_number"] = None
        trx["dest_bank_code"] = None
    if msg_type == "CEK_SALDO":
        trx["amount"] = 0
    return trx


# ============================================================
# SCENARIO 1 — NORMAL
# ============================================================
def generate_normal(count: int = 20) -> list[dict]:
    """Transaksi baseline yang tidak membentuk pola fraud berbasis terminal."""
    batch_id = "".join(random.choices(string.digits, k=6))
    records = []
    for index in range(count):
        trx = _base_trx(
            msg_type=random.choice(["TRANSFER", "TARIK_SALDO", "CEK_SALDO"])
        )
        # Jangan memakai terminal pool acak untuk baseline. Jika 20 transaksi
        # normal dibentuk di waktu yang sama dari hanya empat terminal, pattern
        # distinct_account_count >= 5 dapat terpicu secara tidak sengaja.
        trx["terminal_id"] = f"TERM_NORMAL_{batch_id}_{index:02d}"
        records.append(trx)
    return records


# ============================================================
# SCENARIO 2 — BLACKLIST USER ID
# Target engine : Blacklist Engine → USER_ID
# map_agenusa() : customer_ref_number → user_account_id
# ============================================================
def generate_blacklist_user() -> list[dict]:
    trx = _base_trx()
    trx["customer_ref_number"] = BLACKLISTED_USER
    return [trx]


# ============================================================
# SCENARIO 2 — BLACKLIST IP
# Target engine : Blacklist Engine → IP_ADDRESS
# ============================================================
def generate_blacklist_ip() -> list[dict]:
    trx = _base_trx()
    trx["ip_address"] = BLACKLISTED_IP
    return [trx]


# ============================================================
# SCENARIO 3 — BLACKLIST ACCOUNT NUMBER
# Target engine : Blacklist Engine → ACCOUNT_NUMBER
# ============================================================
def generate_blacklist_account() -> list[dict]:
    trx = _base_trx()
    trx["account_number"]        = BLACKLISTED_ACCOUNT
    trx["issuer_account_number"] = BLACKLISTED_ACCOUNT
    return [trx]


# ============================================================
# SCENARIO 4 — BLACKLIST TERMINAL
# Target engine : Blacklist Engine → TERMINAL_ID
# ============================================================
def generate_blacklist_terminal() -> list[dict]:
    trx = _base_trx()
    trx["terminal_id"] = BLACKLISTED_TERMINAL
    return [trx]


# ============================================================
# SCENARIO 5 — BLACKLIST MERCHANT
# Target engine : Blacklist Engine → MERCHANT_ID
# ============================================================
def generate_blacklist_merchant() -> list[dict]:
    trx = _base_trx()
    trx["merchant_id"] = BLACKLISTED_MERCHANT
    return [trx]


# ============================================================
# SCENARIO 6 — BRUTE FORCE PIN
# Target engine : Pattern Engine (AI Discovery: BRUTE_FORCE) + ML
# Trigger       : wrong-PIN response_code==55 berulang dari kartu yang sama
#                 RAPID_RETRY_DECLINED → IS_DECLINED==1 & GAP_MINUTES<=2
# ============================================================
def generate_bruteforce() -> list[dict]:
    """4 percobaan PIN salah dalam 1 menit (gap ~20 detik), lalu 1 sukses."""
    records   = []
    base_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    card_num  = "CARD_BRUTE_" + "".join(random.choices(string.digits, k=6))
    term_id   = "TERM_BRUTE_001"  # ← dedicated, bukan random.choice(TERMINALS)

    for i in range(4):
        trx = _base_trx(time_override=base_time + timedelta(seconds=i * 20))
        trx["issuer_account_number"] = card_num
        trx["account_number"]        = card_num
        trx["customer_ref_number"]   = card_num
        trx["terminal_id"]           = term_id
        trx["response_code"]         = "55"
        records.append(trx)

    trx_ok = _base_trx(time_override=base_time + timedelta(seconds=90))
    trx_ok["issuer_account_number"] = card_num
    trx_ok["account_number"]        = card_num
    trx_ok["customer_ref_number"]   = card_num
    trx_ok["terminal_id"]           = term_id
    trx_ok["response_code"]         = "00"
    records.append(trx_ok)

    return records


# ============================================================
# SCENARIO 7 — DECLINE VELOCITY
# Target engine : Pattern Engine (DECLINE_VELOCITY)
# Trigger       : failure_count >= 3 dalam TIME_WINDOW 5 menit
#                 risk_score: 85, action: BLOCK
# ============================================================
def generate_decline_velocity() -> list[dict]:
    """5 decline berturut-turut dari kartu yang sama dalam 3 menit."""
    records = []
    base_time    = datetime.now(timezone.utc)
    card_num     = "CARD_DCLN_" + "".join(random.choices(string.digits, k=6))
    decline_codes = ["51", "61", "65", "91", "05"]

    for i in range(5):
        trx = _base_trx(time_override=base_time + timedelta(seconds=i * 30))
        trx["issuer_account_number"] = card_num
        trx["account_number"]        = card_num
        trx["customer_ref_number"]   = card_num
        trx["response_code"]         = random.choice(decline_codes)
        records.append(trx)

    return records


# ============================================================
# SCENARIO 8 — SUPER PATTERN
# Target engine : Pattern Engine (SUPER_PATTERN)
# Trigger       : failure_count>=3 AND has_success_after_failure AND tx_count>=5
#                 risk_score: 95, action: BLOCK
# ============================================================
def generate_super_pattern() -> list[dict]:
    """
    Pattern ID 11 — Agenusa - Super Pattern (Advanced Syndicate Attack)
    Trigger: failure_count>=3 AND has_success_after_failure==true
             AND tx_count>=15 AND total_amount>=50,000,000
             dalam 15 menit — 1 kartu, bukan multi-terminal

    Struktur: 3× decline → 1× success → 12× burst = 16 tx total
    - failure_count = 3 >= 3 ✅
    - has_success_after_failure = True ✅
    - tx_count = 16 >= 15 ✅
    - total_amount = 13 × 4jt = 52 juta >= 50 juta ✅
    - amount 4 juta < 10 juta → lolos Global Rule ✅
    """
    records   = []
    base_time = datetime.now(timezone.utc)
    card_num  = "CARD_SUPER_" + "".join(random.choices(string.digits, k=6))

    # 3× decline berturut-turut
    for i in range(3):
        trx_dec = _base_trx(time_override=base_time + timedelta(seconds=i * 30))
        trx_dec["issuer_account_number"] = card_num
        trx_dec["account_number"]        = card_num
        trx_dec["customer_ref_number"]   = card_num
        trx_dec["response_code"]         = "51"
        trx_dec["amount"]                = 4_000_000
        records.append(trx_dec)

    # 1× success setelah decline → has_success_after_failure=True ✅
    trx_ok = _base_trx(time_override=base_time + timedelta(seconds=100))
    trx_ok["issuer_account_number"] = card_num
    trx_ok["account_number"]        = card_num
    trx_ok["customer_ref_number"]   = card_num
    trx_ok["response_code"]         = "00"
    trx_ok["amount"]                = 4_000_000
    records.append(trx_ok)

    # 12× burst → total tx = 16 >= 15 ✅, total amount = 13 × 4jt = 52 juta >= 50 juta ✅
    for j in range(12):
        trx_burst = _base_trx(time_override=base_time + timedelta(seconds=120 + j * 30))
        trx_burst["issuer_account_number"] = card_num
        trx_burst["account_number"]        = card_num
        trx_burst["customer_ref_number"]   = card_num
        trx_burst["response_code"]         = "00"
        trx_burst["amount"]                = 4_000_000
        records.append(trx_burst)

    return records
def generate_fan_in() -> list[dict]:
    """12 kartu berbeda di 1 terminal EDC dalam < 5 menit."""
    records         = []
    base_time       = datetime.now(timezone.utc)
    target_terminal = "71809339"

    for i in range(12):
        trx = _base_trx(time_override=base_time + timedelta(seconds=i * 10))
        trx["terminal_id"]           = target_terminal
        trx["issuer_account_number"] = f"CARD_FAN_IN_{i:03d}"
        records.append(trx)

    return records


# ============================================================
# SCENARIO 10 — MIDNIGHT AMOUNT SPIKE
# Target engine : Pattern Engine (AI Discovery: UNUSUAL_TIME) + ML
# Trigger       : IS_NIGHT_TX==1 (jam 00.00-04.59 WIB) AND AMOUNT_OVER_AVG_RATIO>=2.0
#
# Fix timezone: IS_NIGHT_TX cek jam UTC (bukan WIB).
# Jam 03:00 WIB = 20:00 UTC (hari sebelumnya).
# Kita set waktu spike ke 21:00 UTC = 04:00 WIB → masuk range IS_NIGHT_TX (0-4).
#
# Fix riwayat: tambah 5 transaksi nominal kecil sebagai baseline AVG_AMOUNT_5,
# sehingga AMOUNT_OVER_AVG_RATIO transaksi spike >= 2.0.
# ============================================================
def generate_midnight_spike() -> list[dict]:
    """
    5 transaksi siang (nominal kecil) sebagai baseline,
    lalu 1 transaksi raksasa pada 04.00 WIB (21.00 UTC hari sebelumnya).
    """
    records   = []
    now       = datetime.now(timezone.utc)
    card_num  = "CARD_NIGHT_" + "".join(random.choices(string.digits, k=6))

    # Riwayat siang hari — bangun AVG_AMOUNT_5 yang rendah
    for i in range(5):
        day_time = now.replace(hour=8, minute=0, second=0, microsecond=0) - timedelta(hours=i * 2)
        trx = _base_trx(time_override=day_time)
        trx["issuer_account_number"] = card_num
        trx["account_number"]        = card_num
        trx["customer_ref_number"]   = card_num
        trx["amount"]                = round(random.uniform(50_000, 150_000), 2)
        records.append(trx)

    # Transaksi anomali: 21:00 UTC = 04:00 WIB → IS_NIGHT_TX = 1
    # Amount 55 juta vs avg ~100 ribu → ratio >> 2.0 → MIDNIGHT_AMOUNT_SPIKE trigger
    midnight_utc = now.replace(hour=21, minute=0, second=0, microsecond=0)
    trx_spike = _base_trx(time_override=midnight_utc)
    trx_spike["issuer_account_number"] = card_num
    trx_spike["account_number"]        = card_num
    trx_spike["customer_ref_number"]   = card_num
    trx_spike["amount"]                = 55_000_000.00
    records.append(trx_spike)

    return records


# ============================================================
# SCENARIO 11 — VELOCITY BURST
# Target engine : Pattern Engine (VELOCITY) + Rule Engine
# Trigger       : tx_count >= 5 dalam TIME_WINDOW 5 menit
# ============================================================
def generate_velocity_burst() -> list[dict]:
    """8 transaksi dari akun yang sama dalam 4 menit."""
    records   = []
    base_time = datetime.now(timezone.utc)
    card_num  = "CARD_VELO_" + "".join(random.choices(string.digits, k=6))

    for i in range(8):
        trx = _base_trx(time_override=base_time + timedelta(seconds=i * 25))
        trx["issuer_account_number"] = card_num
        trx["account_number"]        = card_num
        trx["customer_ref_number"]   = card_num
        records.append(trx)

    return records


# ============================================================
# SCENARIO 12 — MONEY MULE
# Target engine : ML (IS_MONEY_MULE_DEST)
# Trigger       : dest_account_number == "DST999999"
# ============================================================
def generate_money_mule() -> list[dict]:
    """Transfer ke akun tujuan money mule yang dikenal."""
    records = []
    for _ in range(3):
        trx = _base_trx()
        trx["msg_type"] = "TRANSFER"
        trx["dest_account_number"] = MONEY_MULE_DEST
        trx["amount"]              = round(random.uniform(1_000_000, 4_000_000), 2)
        records.append(trx)
    return records


# ============================================================
# SCENARIO 13 — TERMINAL SWITCH FAST
# Target engine : ML (TERMINAL_SWITCH_FAST)
# Trigger       : GAP_MINUTES <= 10 AND terminal beda dari transaksi sebelumnya
# ============================================================
def generate_terminal_switch_fast() -> list[dict]:
    """Akun yang sama muncul di 2 terminal berbeda dalam < 5 menit."""
    records   = []
    base_time = datetime.now(timezone.utc)
    card_num  = "CARD_JUMP_" + "".join(random.choices(string.digits, k=6))

    trx1 = _base_trx(time_override=base_time)
    trx1["issuer_account_number"] = card_num
    trx1["account_number"]        = card_num
    trx1["customer_ref_number"]   = card_num
    trx1["terminal_id"]           = "71809339"
    records.append(trx1)

    trx2 = _base_trx(time_override=base_time + timedelta(minutes=3))
    trx2["issuer_account_number"] = card_num
    trx2["account_number"]        = card_num
    trx2["customer_ref_number"]   = card_num
    trx2["terminal_id"]           = "71809342"
    records.append(trx2)

    return records


# ============================================================
# SCENARIO â€” LOCATION JUMP / IMPOSSIBLE TRAVEL
# Target engine : Location Jump detector in pattern_engine_service
# Trigger       : same user changes city within less than one hour
# ============================================================
def generate_location_jump() -> list[dict]:
    """Jakarta → Surabaya in 30 minutes for the same cardholder."""
    base_time = datetime.now(timezone.utc) - timedelta(minutes=30)
    card_num = "CARD_LOCATION_" + "".join(random.choices(string.digits, k=6))
    user_id = "CUST_LOCATION_" + card_num[-6:]

    jakarta = _base_trx(time_override=base_time)
    jakarta.update({
        "issuer_account_number": card_num,
        "account_number": card_num,
        "customer_ref_number": user_id,
        "terminal_id": "TERM_JAKARTA_001",
        "city": "Jakarta",
        "country": "ID",
        "ip_address": "36.90.120.15",
    })

    surabaya = _base_trx(time_override=base_time + timedelta(minutes=30))
    surabaya.update({
        "issuer_account_number": card_num,
        "account_number": card_num,
        "customer_ref_number": user_id,
        "terminal_id": "TERM_SURABAYA_001",
        "city": "Surabaya",
        "country": "ID",
        "ip_address": "114.10.20.30",
    })
    return [jakarta, surabaya]


# ============================================================
# SCENARIO 14 — HIGH AMOUNT
# Target engine : Rule Engine (amount) + ML (IS_HIGH_AMOUNT_PATTERN)
# Trigger       : amount >= 5_000_000 (Rule) + AMOUNT_OVER_AVG_RATIO >= 8.0 (ML)
#
# Fix: tambah 5 transaksi kecil sebagai riwayat historis terlebih dahulu,
# sehingga AVG_AMOUNT_5 rendah dan ratio spike >= 8.0 saat transaksi besar masuk.
# ============================================================
def generate_high_amount() -> list[dict]:
    """
    5 transaksi normal (nominal kecil) sebagai baseline riwayat,
    lalu 1 transaksi dengan nominal sangat besar.
    """
    records  = []
    now      = datetime.now(timezone.utc)
    card_num = "CARD_HIGH_" + "".join(random.choices(string.digits, k=6))

    # Riwayat nominal kecil — AVG_AMOUNT_5 akan sekitar 100 ribu
    for i in range(5):
        trx = _base_trx(time_override=now - timedelta(hours=5 - i))
        trx["issuer_account_number"] = card_num
        trx["account_number"]        = card_num
        trx["customer_ref_number"]   = card_num
        trx["amount"]                = round(random.uniform(50_000, 150_000), 2)
        records.append(trx)

    # Transaksi besar: 80 juta vs avg ~100 ribu → ratio ~800 → IS_HIGH_AMOUNT_PATTERN trigger
    trx_big = _base_trx(time_override=now)
    trx_big["issuer_account_number"] = card_num
    trx_big["account_number"]        = card_num
    trx_big["customer_ref_number"]   = card_num
    trx_big["amount"]                = round(random.uniform(80_000_000, 100_000_000), 2)
    records.append(trx_big)

    return records


# ============================================================
# SCENARIO 15 — CHAIN DECLINE SUCCESS BURST
# Target engine : Pattern Engine (field: chain_decline_success_burst)
# Trigger       : State machine ketat dalam TIME_WINDOW 5 menit:
#                 decline (>=3) → tepat 1 success → burst success (>=3)
#
# Perlu pattern di DB dengan kondisi:
#   {
#     "logic": "AND",
#     "time_window_minutes": 5,
#     "conditions": [
#       {"field": "chain_decline_success_burst", "operator": "==", "value": true}
#     ]
#   }
# ============================================================
def generate_chain_decline_success_burst() -> list[dict]:
    """
    Pattern ID 2 — Agenusa: Critical Card Testing Burst Detection
    Trigger: chain_decline_success_burst==True AND tx_count>=7 dalam 15 menit

    Struktur: 3× decline → 1× success → 4× burst = 8 tx total (>=7)
    Pakai terminal dedicated agar tidak overlap dengan skenario EDC Terminal Pooling.
    """
    records          = []
    base_time        = datetime.now(timezone.utc)
    card_num         = "CARD_CHAIN_" + "".join(random.choices(string.digits, k=6))
    dedicated_terminal = "TERM_CHAIN_001"

    # 3× decline berturut-turut (interval 90 detik)
    for i in range(3):
        trx = _base_trx(time_override=base_time + timedelta(seconds=i * 90))
        trx["issuer_account_number"] = card_num
        trx["account_number"]        = card_num
        trx["customer_ref_number"]   = card_num
        trx["terminal_id"]           = dedicated_terminal
        trx["response_code"]         = "51"
        records.append(trx)

    # 1× success setelah decline
    trx_ok = _base_trx(time_override=base_time + timedelta(minutes=5))
    trx_ok["issuer_account_number"] = card_num
    trx_ok["account_number"]        = card_num
    trx_ok["customer_ref_number"]   = card_num
    trx_ok["terminal_id"]           = dedicated_terminal
    trx_ok["response_code"]         = "00"
    records.append(trx_ok)

    # 4× burst success → chain_detected=True, tx_count=8 >= 7 ✅
    for j in range(4):
        trx_burst = _base_trx(time_override=base_time + timedelta(minutes=6, seconds=j * 60))
        trx_burst["issuer_account_number"] = card_num
        trx_burst["account_number"]        = card_num
        trx_burst["customer_ref_number"]   = card_num
        trx_burst["terminal_id"]           = dedicated_terminal
        trx_burst["response_code"]         = "00"
        trx_burst["amount"]                = round(random.uniform(1_000_000, 5_000_000), 2)
        records.append(trx_burst)

    return records


# ============================================================
# SCENARIO 16 — EDC TERMINAL POOLING
# Pattern ID 4 — "Agenusa - EDC Terminal Pooling & Card Washing Detection"
# Trigger: distinct_account_count>=5 AND tx_count>=5 dalam 10 menit
# risk_score: 90, action: BLOCK
# ============================================================
def generate_edc_terminal_pooling() -> list[dict]:
    """
    6 kartu berbeda di 1 terminal dalam 8 menit.
    Lebih ringan dari fan_in (butuh 10 kartu) — pattern ini cukup 5 kartu.
    """
    records         = []
    base_time       = datetime.now(timezone.utc)
    target_terminal = "71809340"

    for i in range(6):  # 6 kartu > threshold 5
        trx = _base_trx(time_override=base_time + timedelta(seconds=i * 70))
        trx["terminal_id"]           = target_terminal
        trx["issuer_account_number"] = f"CARD_POOL_{i:03d}"
        trx["account_number"]        = f"CARD_POOL_{i:03d}"
        trx["customer_ref_number"]   = f"CARD_POOL_{i:03d}"
        records.append(trx)

    return records

# ============================================================
# SCENARIO 17 — RULE: AGENUSA MAX CASH OUT
# Target rule : rule_agenusa_max_cash_out (Global Rule)
# Trigger     : amount > 10_000_000
# ============================================================
def generate_rule_agenusa_max_cash_out() -> list[dict]:
    """Contoh tarik saldo yang melewati batas nominal transaksi Agenusa."""
    trx = _base_trx(msg_type="TARIK_SALDO")
    trx["amount"] = round(random.uniform(10_500_000, 15_000_000), 2)
    return [trx]


# ============================================================
# SCENARIO 18 — RULE: AGENUSA SUSPENDED BANK
# Target rule : rule_agenusa_suspended_bank (Global Rule)
# Trigger     : issuer_bank == "BANK_CADANGAN_X"
# ============================================================
def generate_rule_agenusa_suspended_bank() -> list[dict]:
    """Transaksi kartu dari Bank Partner yang sedang ditangguhkan."""
    trx = _base_trx()
    trx["issuer_bank"] = "BANK_CADANGAN_X"
    return [trx]


# ============================================================
# ML SCENARIOS
# Skenario ini mengikuti feature_builder.py, bukan fraud_patterns/global_rules.
# ============================================================
def generate_ml_bruteforce_pin() -> list[dict]:
    """Satu transaksi salah PIN yang menyalakan IS_BRUTE_PATTERN."""
    trx = _base_trx()
    trx["response_code"] = "55"
    trx["amount"] = 750_000
    return [trx]


def generate_ml_rapid_retry_declined() -> list[dict]:
    """Dua decline berjarak satu menit untuk RAPID_RETRY_DECLINED."""
    base_time = datetime.now(timezone.utc)
    card_num = "CARD_ML_RETRY_" + "".join(random.choices(string.digits, k=6))
    records = []
    for i in range(2):
        trx = _base_trx(time_override=base_time + timedelta(minutes=i))
        trx["issuer_account_number"] = card_num
        trx["account_number"] = card_num
        trx["customer_ref_number"] = card_num
        trx["response_code"] = "51"
        trx["amount"] = 500_000
        records.append(trx)
    return records


def generate_ml_midnight_unusual_amount() -> list[dict]:
    """Baseline nominal normal lalu spike 2x pada jam malam WIB (00.00-04.59)."""
    now = datetime.now(timezone.utc)
    card_num = "CARD_ML_NIGHT_" + "".join(random.choices(string.digits, k=6))
    records = []

    for i in range(5):
        trx = _base_trx(time_override=now - timedelta(hours=10 - i))
        trx["issuer_account_number"] = card_num
        trx["account_number"] = card_num
        trx["customer_ref_number"] = card_num
        trx["amount"] = 1_000_000
        records.append(trx)

    # 21.00 UTC = 04.00 WIB, sesuai definisi bisnis feature.
    midnight = now.replace(hour=21, minute=0, second=0, microsecond=0)
    if midnight <= records[-1]["timestamp_db"]:
        midnight += timedelta(days=1)
    trx = _base_trx(time_override=midnight)
    trx["issuer_account_number"] = card_num
    trx["account_number"] = card_num
    trx["customer_ref_number"] = card_num
    trx["amount"] = 2_500_000
    records.append(trx)
    return records


def generate_ml_high_amount_spike() -> list[dict]:
    """Baseline kecil lalu nominal 9 juta: ratio ekstrem tetapi di bawah rule 10 juta."""
    now = datetime.now(timezone.utc)
    card_num = "CARD_ML_AMOUNT_" + "".join(random.choices(string.digits, k=6))
    records = []

    for i in range(5):
        trx = _base_trx(time_override=now - timedelta(hours=5 - i))
        trx["issuer_account_number"] = card_num
        trx["account_number"] = card_num
        trx["customer_ref_number"] = card_num
        trx["amount"] = 100_000
        records.append(trx)

    trx = _base_trx(time_override=now)
    trx["issuer_account_number"] = card_num
    trx["account_number"] = card_num
    trx["customer_ref_number"] = card_num
    trx["amount"] = 9_000_000
    records.append(trx)
    return records


def generate_ml_unknown_mixed_outlier() -> list[dict]:
    """
    ML Unexplained Anomaly: kombinasi nilai langka tanpa menyalakan enam
    heuristic pattern Agenusa. Hasil tetap bergantung pada model aktif.
    """
    now = datetime.now(timezone.utc)
    unusual_time = now.replace(hour=23, minute=57, second=0, microsecond=0)
    card_num = "CARD_ML_UNKNOWN_" + "".join(random.choices(string.digits, k=6))

    baseline = _base_trx(time_override=unusual_time - timedelta(minutes=3))
    baseline.update(
        {
            "terminal_id": "TERM_UNSEEN_ML_999",
            "issuer_account_number": card_num,
            "account_number": card_num,
            "customer_ref_number": card_num,
            "amount": 1_000_000,
        }
    )

    outlier = _base_trx(time_override=unusual_time)
    outlier.update(
        {
            "msg_type": "TRANSFER",
            "terminal_id": "TERM_UNSEEN_ML_999",
            "merchant_id": "MERCHANT_UNSEEN_ML_999",
            "issuer_account_number": card_num,
            "account_number": card_num,
            "customer_ref_number": card_num,
            "response_code": "91",
            "dest_account_number": "DEST_UNSEEN_ML_999",
            "amount": 7_900_000,
        }
    )
    return [baseline, outlier]


# ============================================================
# PUBLIC API
# ============================================================
def get_scenario_catalog() -> dict[str, dict]:
    """Metadata scenario pattern aktif; diselaraskan dengan fraud_patterns."""
    catalog = {
        "normal": {
            "title": "Agenusa - Normal Transactions",
            "category": "Baseline",
            "description": "Dua puluh transaksi normal ",
            "target_engines": [],
            "trigger_conditions": [],
            "expected_result": "SAFE",
            "transaction_count": 20,
        },
        "blacklist_user": {
            "title": "Agenusa - Blacklist USER_ID",
            "category": "Blacklist",
            "description": "Transaksi dari user ID yang terdapat pada blacklist Agenusa.",
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["customer_ref_number == 'USER-BL-00001'"],
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },
        "blacklist_ip": {
            "title": "Agenusa - Blacklist IP_ADDRESS",
            "category": "Blacklist",
            "description": "Transaksi berasal dari alamat IP yang diblacklist.",
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["ip_address == '99.99.99.99'"],
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },
        "blacklist_terminal": {
            "title": "Agenusa - Blacklist TERMINAL_ID",
            "category": "Blacklist",
            "description": "Transaksi berasal dari terminal EDC yang diblacklist.",
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["terminal_id == 'TRM_BL_00001'"],
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },
        "blacklist_merchant": {
            "title": "Agenusa - Blacklist MERCHANT_ID",
            "category": "Blacklist",
            "description": "Transaksi berasal dari merchant yang diblacklist.",
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["merchant_id == 'M_BL_00001'"],
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },
        "blacklist_account": {
            "title": "Agenusa - Blacklist ACCOUNT_NUMBER",
            "category": "Blacklist",
            "description": "Transaksi menggunakan rekening atau kartu yang diblacklist.",
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["account_number == 'card_bl_000001'"],
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },
        "chain_decline_success_burst": {
            "title": "Agenusa - Critical Card Testing Burst Detection",
            "category": "Carding & Brute Force",
            "description": (
                "Tiga decline beruntun, satu transaksi sukses, lalu burst "
                "transaksi sukses dari kartu yang sama."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "chain_decline_success_burst == true",
                "tx_count >= 7 dalam 15 menit",
            ],
            "fraud_pattern": {
                "id": 2,
                "risk_score": 95,
                "priority": 10,
                "action": "BLOCK",
                "logic": "AND",
                "time_window_minutes": 15,
            },
            "expected_result": "FRAUD",
            "transaction_count": 8,
        },
        "edc_terminal_pooling": {
            "title": "Agenusa - EDC Terminal Pooling & Card Washing Detection",
            "category": "Merchant Collusion & Terminal Abuse",
            "description": (
                "Enam kartu berbeda digunakan pada terminal EDC yang sama "
                "dalam window sepuluh menit."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "distinct_account_count >= 5 dalam 10 menit",
            ],
            "fraud_pattern": {
                "id": 4,
                "risk_score": 90,
                "priority": 10,
                "action": "BLOCK",
                "logic": "AND",
                "time_window_minutes": 10,
            },
            "expected_result": "FRAUD",
            "transaction_count": 6,
        },
        "location_jump": {
            "title": "Agenusa - Fast City Jump (Impossible Travel)",
            "category": "Behavioral Anomaly",
            "description": (
                "Kartu dan pengguna yang sama bertransaksi di Jakarta lalu Surabaya "
                "dalam selang 30 menit."
            ),
            "target_engines": ["Location Jump Detector"],
            "trigger_conditions": [
                "same user_account_id",
                "city changes within less than 1 hour",
            ],
            "expected_result": "FLAGGED",
            "transaction_count": 2,
        },
        "bruteforce": {
            "title": "Agenusa - Account Takeover & Brute Force PIN Guessing",
            "category": "Account Takeover Suspect",
            "description": (
                "Empat kegagalan PIN beruntun diikuti satu transaksi sukses "
                "dari kartu yang sama."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "failure_count >= 3",
                "has_success_after_failure >= true",
                "window 10 menit",
            ],
            "fraud_pattern": {
                "id": 5,
                "risk_score": 75,
                "priority": 5,
                "action": "REVIEW",
                "logic": "AND",
                "time_window_minutes": 10,
            },
            "expected_result": "FLAGGED",
            "transaction_count": 5,
        },
        "fan_in": {
            "title": "Agenusa - Fan-In Syndicate (Massive Card Pooling)",
            "category": "Merchant Collusion & Syndicate",
            "description": (
                "Dua belas kartu berbeda digunakan pada satu terminal EDC "
                "untuk memenuhi pola massive card pooling."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "distinct_account_count >= 10",
                "tx_count >= 11 dalam 15 menit",
            ],
            "fraud_pattern": {
                "id": 9,
                "risk_score": 100,
                "priority": 10,
                "action": "BLOCK",
                "logic": "AND",
                "time_window_minutes": 15,
            },
            "expected_result": "FRAUD",
            "transaction_count": 12,
        },
        "velocity_burst": {
            "title": "Agenusa - Velocity Burst (High-Frequency Card Usage)",
            "category": "Velocity Attack & Shopping Spree",
            "description": (
                "Delapan transaksi berfrekuensi tinggi dari kartu yang sama "
                "dalam window lima menit."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": ["tx_count >= 6 dalam 5 menit"],
            "fraud_pattern": {
                "id": 10,
                "risk_score": 85,
                "priority": 8,
                "action": "BLOCK",
                "logic": "AND",
                "time_window_minutes": 5,
            },
            "expected_result": "FRAUD",
            "transaction_count": 8,
        },
        "super_pattern": {
            "title": "Agenusa - Super Pattern (Advanced Syndicate Attack)",
            "category": "Syndicate & Multi-Vector Attack",
            "description": (
                "Kombinasi decline-success, velocity tinggi, dan akumulasi "
                "nominal besar pada kartu yang sama."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "failure_count >= 3",
                "has_success_after_failure == true",
                "tx_count >= 15",
                "total_amount >= 50,000,000 dalam 15 menit",
            ],
            "fraud_pattern": {
                "id": 11,
                "risk_score": 100,
                "priority": 10,
                "action": "BLOCK",
                "logic": "AND",
                "time_window_minutes": 15,
            },
            "expected_result": "FRAUD",
            "transaction_count": 16,
        },
        "ml_bruteforce_pin": {
            "title": "ML - Brute Force PIN Signal",
            "category": "ML Feature Anomaly",
            "description": "Menyalakan feature IS_BRUTE_PATTERN tanpa memenuhi burst pattern tabel.",
            "target_engines": ["ML Engine"],
            "trigger_conditions": [
                "response_code == '55'",
            ],
            "ml_pattern": {"key": "bruteforce_pin_pattern"},
            "expected_result": "ML ANOMALY / FLAGGED",
            "transaction_count": 1,
        },
        "ml_rapid_retry_declined": {
            "title": "ML - Rapid Retry Declined",
            "category": "ML Feature Anomaly",
            "description": "Dua decline cepat dari kartu yang sama tanpa mencapai failure_count pattern.",
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["IS_DECLINED == 1", "GAP_MINUTES <= 2"],
            "ml_pattern": {"key": "rapid_retry_declined"},
            "expected_result": "ML ANOMALY / FLAGGED",
            "transaction_count": 2,
        },
        "ml_money_mule_destination": {
            "title": "ML - Money Mule Destination",
            "category": "ML Feature Anomaly",
            "description": "Transaksi menuju rekening tujuan khusus yang dikenali feature ML.",
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["dest_account_number == 'DST999999'"],
            "ml_pattern": {"key": "money_mule_destination"},
            "expected_result": "ML ANOMALY / FLAGGED",
            "transaction_count": 3,
        },
        "ml_terminal_switch_fast": {
            "title": "ML - Fast Terminal Switch",
            "category": "ML Feature Anomaly",
            "description": "Kartu yang sama berpindah terminal dalam waktu yang sangat singkat.",
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["GAP_MINUTES <= 10", "terminal_id berubah"],
            "ml_pattern": {"key": "impossible_travel_terminal_switch"},
            "expected_result": "ML ANOMALY / FLAGGED",
            "transaction_count": 2,
        },
        "ml_high_amount_spike": {
            "title": "ML - Extreme Amount Spike",
            "category": "ML Feature Anomaly",
            "description": "Nominal 9 juta dibanding baseline 100 ribu, tetap di bawah global rule 10 juta.",
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["AMOUNT_OVER_AVG_RATIO >= 8"],
            "ml_pattern": {"key": "high_amount_spike"},
            "expected_result": "ML ANOMALY / FLAGGED",
            "transaction_count": 6,
        },
        "ml_midnight_unusual_amount": {
            "title": "ML - Midnight Unusual Amount",
            "category": "ML Feature Anomaly",
            "description": "Lonjakan nominal pada jam 00.00-04.59 UTC dibanding histori kartu.",
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["IS_NIGHT_TX == 1", "AMOUNT_OVER_AVG_RATIO >= 2"],
            "ml_pattern": {"key": "midnight_unusual_amount"},
            "expected_result": "ML ANOMALY / FLAGGED",
            "transaction_count": 6,
        },
        "ml_unknown_mixed_outlier": {
            # Key lama dipertahankan agar request/history simulator tetap kompatibel.
            "title": "ML - Unexplained Anomaly",
            "category": "Unexplained ML Anomaly",
            "description": (
                "ML menilai kombinasi terminal, merchant, processing code, MTI, "
                "tujuan, waktu, dan nominal sebagai anomali, tetapi belum ada "
                "pattern bernama yang menjelaskannya."
            ),
            "target_engines": ["ML Engine"],
            "trigger_conditions": [
                "kombinasi feature berada di luar distribusi training",
                "is_anomaly == true dan patterns == []",
            ],
            "ml_pattern": {"key": None, "unknown": True},
            "expected_result": "ML ANOMALY (MODEL-DEPENDENT)",
            "transaction_count": 2,
        },
        "rule_agenusa_max_cash_out": {
            "title": "Agenusa - Batas Nominal Transaksi",
            "category": "AMOUNT_LIMIT",
            "description": (
                "Membatasi tarik saldo atau transfer sekali jalan melalui "
                "Agenusa maksimal Rp10.000.000 untuk menjaga likuiditas dan "
                "memitigasi kesalahan input nominal."
            ),
            "target_engines": ["Rule Engine"],
            "trigger_conditions": ["amount > 10,000,000"],
            "global_rule": {
                "id": 2,
                "rule_key": "rule_agenusa_max_cash_out",
                "rule_group": "AMOUNT_LIMIT",
                "action": "BLOCK",
                "severity": "CRITICAL",
                "priority": 100,
                "rule_config": {
                    "field": "amount",
                    "value": 10_000_000,
                    "operator": ">",
                },
            },
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },
        "rule_agenusa_suspended_bank": {
            "title": "Agenusa - Penangguhan Interkoneksi Bank Partner",
            "category": "VELOCITY",
            "description": (
                "Menghentikan transaksi kartu dari bank partner yang sedang "
                "ditangguhkan karena gangguan settlement atau investigasi regulator."
            ),
            "target_engines": ["Rule Engine"],
            "trigger_conditions": [
                "transaction_details.issuer_bank == 'BANK_CADANGAN_X'",
            ],
            "global_rule": {
                "id": 3,
                "rule_key": "rule_agenusa_suspended_bank",
                "rule_group": "VELOCITY",
                "action": "BLOCK",
                "severity": "HIGH",
                "priority": 90,
                "rule_config": {
                    "field": "transaction_details.issuer_bank",
                    "value": "BANK_CADANGAN_X",
                    "operator": "=",
                },
            },
            "expected_result": "FRAUD",
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
    Siap di-insert ke SwitchingLogRepository,
    lalu diproses via DataAggregationService.process_agenusa().
    """
    return {
        "normal": generate_normal(),
        "blacklist_user": generate_blacklist_user(),
        "blacklist_ip": generate_blacklist_ip(),
        "blacklist_terminal": generate_blacklist_terminal(),
        "blacklist_merchant": generate_blacklist_merchant(),
        "blacklist_account": generate_blacklist_account(),
        "chain_decline_success_burst": generate_chain_decline_success_burst(),
        "edc_terminal_pooling": generate_edc_terminal_pooling(),
        "bruteforce": generate_bruteforce(),
        "fan_in": generate_fan_in(),
        "velocity_burst": generate_velocity_burst(),
        "super_pattern": generate_super_pattern(),
        "ml_bruteforce_pin": generate_ml_bruteforce_pin(),
        "ml_rapid_retry_declined": generate_ml_rapid_retry_declined(),
        "ml_money_mule_destination": generate_money_mule(),
        "ml_terminal_switch_fast": generate_terminal_switch_fast(),
        "location_jump": generate_location_jump(),
        "ml_high_amount_spike": generate_ml_high_amount_spike(),
        "ml_midnight_unusual_amount": generate_ml_midnight_unusual_amount(),
        "ml_unknown_mixed_outlier": generate_ml_unknown_mixed_outlier(),
        "rule_agenusa_max_cash_out": generate_rule_agenusa_max_cash_out(),
        "rule_agenusa_suspended_bank": generate_rule_agenusa_suspended_bank(),
    }


# ============================================================
# STANDALONE RUNNER
# ============================================================
if __name__ == "__main__":
    scenarios = get_all_scenarios()
    total = sum(len(v) for v in scenarios.values())

    records = []
    for name, txs in scenarios.items():
        records.extend(txs)

    db = SessionLocal()
    try:
        repo = SwitchingLogRepository(db)
        repo.bulk_create(records)
        print(f"✅ Berhasil generate {total} log transaksi Agenusa fiktif ke database!")
        for name, txs in scenarios.items():
            print(f"    [{name}] → {len(txs)} transaksi")
    finally:
        db.close()
