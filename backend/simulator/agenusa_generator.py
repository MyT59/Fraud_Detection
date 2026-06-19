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
PROCESSING_CODES = ["301000", "401000", "011000"]
BANK_CODES      = ["014", "008", "009", "002"]
IP_POOL         = ["36.90.120.15", "114.10.20.30", "180.250.50.60"]

# ⚠️ Pastikan sudah ada di tabel blacklist_items sebelum demo
BLACKLISTED_IP       = "99.99.99.99"     # type = IP_ADDRESS
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


def _base_trx(time_override=None) -> dict:
    """
    Flat dict sesuai field SwitchingLog model.
    map_agenusa() akan memetakan ini ke format Transaction.
    """
    return {
        "rrn":                  _generate_rrn(),
        "timestamp_db":         time_override or datetime.now(timezone.utc),
        "mti":                  "0200",
        "msg_raw":              "SIMULATED_MSG",
        "stan":                 "".join(random.choices(string.digits, k=6)),
        "terminal_id":          random.choice(TERMINALS),
        "merchant_id":          "M_" + "".join(random.choices(string.digits, k=4)),
        "processing_code":      random.choice(PROCESSING_CODES),
        "msg_type":             "REQ",
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
    }


# ============================================================
# SCENARIO 1 — NORMAL
# ============================================================
def generate_normal(count: int = 20) -> list[dict]:
    """Transaksi normal. Tidak seharusnya memicu engine manapun."""
    return [_base_trx() for _ in range(count)]


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
# Trigger       : IS_BRUTE_PATTERN → processing_code==300000 & response_code==55
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
        trx["processing_code"]       = "300000"
        trx["response_code"]         = "55"
        records.append(trx)

    trx_ok = _base_trx(time_override=base_time + timedelta(seconds=90))
    trx_ok["issuer_account_number"] = card_num
    trx_ok["account_number"]        = card_num
    trx_ok["customer_ref_number"]   = card_num
    trx_ok["terminal_id"]           = term_id
    trx_ok["processing_code"]       = "300000"
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
# Trigger       : IS_NIGHT_TX==1 (jam 0-4 UTC) AND AMOUNT_OVER_AVG_RATIO>=2.0
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
    lalu 1 transaksi raksasa di jam 21:00 UTC (= 04:00 WIB).
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
        trx["dest_account_number"] = MONEY_MULE_DEST
        trx["amount"]              = round(random.uniform(5_000_000, 20_000_000), 2)
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
    """Tarik tunai fisik melebihi batas maksimal Rp 10.000.000."""
    trx = _base_trx()
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
# PUBLIC API
# ============================================================
def get_all_scenarios() -> dict[str, list[dict]]:
    """
    Kembalikan semua skenario simulasi dalam satu dict.
    Siap di-insert ke SwitchingLogRepository,
    lalu diproses via DataAggregationService.process_agenusa().
    """
    return {
        "normal":                        generate_normal(20),
        "blacklist_ip":                  generate_blacklist_ip(),
        "blacklist_account":             generate_blacklist_account(),
        "blacklist_terminal":            generate_blacklist_terminal(),
        "blacklist_merchant":            generate_blacklist_merchant(),
        "bruteforce":                    generate_bruteforce(),
        "decline_velocity":              generate_decline_velocity(),
        "super_pattern":                 generate_super_pattern(),
        "chain_decline_success_burst":   generate_chain_decline_success_burst(),
        "edc_terminal_pooling":          generate_edc_terminal_pooling(),
        "fan_in":                        generate_fan_in(),
        "midnight_spike":                generate_midnight_spike(),
        "velocity_burst":                generate_velocity_burst(),
        "money_mule":                    generate_money_mule(),
        "terminal_switch_fast":          generate_terminal_switch_fast(),
        "high_amount":                   generate_high_amount(),
        "rule_agenusa_max_cash_out":     generate_rule_agenusa_max_cash_out(),
        "rule_agenusa_suspended_bank":   generate_rule_agenusa_suspended_bank(),
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