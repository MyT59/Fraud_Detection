import random
from datetime import datetime, timedelta

from app.infrastructure.database.session import SessionLocal
from app.infrastructure.repositories.switching_log_repository import (
    SwitchingLogRepository
)

TERMINALS = [
    "71809339",
    "71809340",
    "71809341",
    "71809342",
]

PROCESSING_CODES = [
    "301000",  # cek saldo
    "401000",  # transfer
    "011000",  # tarik tunai
]

BANK_CODES = [
    "014",
    "008",
    "009",
    "002",
]

IP_POOL = [
    "36.90.120.15",
    "36.90.120.16",
    "36.90.120.17",
    "114.10.20.30",
    "180.250.50.60",
]

# Deterministik count untuk memastikan pattern fraud selalu terbentuk
SCENARIO_COUNTS = {
    "normal": 40,
    "high_amount": 10,
    "money_mule": 10,
    "midnight_spike": 0, # Sesuai permintaan formasi test pertamamu (tidak ada midnight di list)
    "brute_force": 10,
    "rapid_retry": 2,    # x 5 = 10 tx
    "super_pattern": 2,  # x 6 = 12 tx
    "fan_in": 1,         # x 15 = 15 tx
    "rule_killer": 10,
}


def random_account():
    return "6013" + "".join(str(random.randint(0, 9)) for _ in range(12))


def random_rrn():
    return "".join(str(random.randint(0, 9)) for _ in range(12))


def random_stan():
    return "".join(str(random.randint(0, 9)) for _ in range(6))


# ==========================================
# BASE TRANSACTION GENERATOR
# ==========================================

def generate_normal_transaction():
    amount = random.randint(10000, 500000)

    return {
        "rrn": random_rrn(),
        "timestamp_db": datetime.utcnow(),
        "mti": "200",
        "msg_raw": None,
        "stan": random_stan(),
        "terminal_id": random.choice(TERMINALS),
        "merchant_id": f"MER{random.randint(1000,9999)}",
        "processing_code": random.choice(PROCESSING_CODES),
        "msg_type": "1",
        "response_code": "00",
        "account_number": random_account(),
        "dest_account_number": random_account(),
        "customer_ref_number": f"CUS{random.randint(10000,99999)}",
        "amount": amount,
        "issuer_bank": random.choice(BANK_CODES),
        "dest_bank_code": random.choice(BANK_CODES),
        "acquirer_code": "987304",
        "issuer_account_number": random_account(),
        "de7": None,
        "de12": None,
        "de13": None,
        "fep_id": "FEPBankingOSSW1",
        "ip_address": random.choice(IP_POOL),
    }


# ==========================================
# SCENARIO GENERATORS (SINGLE TRANSACTION)
# ==========================================

def generate_high_amount():
    tx = generate_normal_transaction()
    # FIX: Dinaikkan di atas threshold 15M agar memicu rule
    tx["amount"] = random.randint(20_000_000, 50_000_000)
    return tx


def generate_money_mule():
    tx = generate_normal_transaction()
    tx["dest_account_number"] = "DST999999"
    tx["amount"] = random.randint(1_000_000, 5_000_000)
    return tx


def generate_midnight_spike():
    tx = generate_high_amount()
    now = datetime.utcnow()
    tx["timestamp_db"] = now.replace(
        hour=random.randint(0, 3),
        minute=random.randint(0, 59)
    )
    return tx


def generate_bruteforce():
    tx = generate_normal_transaction()
    tx["processing_code"] = "300000"
    tx["response_code"] = "55"
    return tx


def generate_rule_killer():
    # Mengumpulkan semua atribut fatal dalam 1 transaksi
    tx = generate_normal_transaction()
    tx["amount"] = 75_000_000
    tx["merchant_id"] = "HIGH_RISK"
    tx["ip_address"] = "10.10.10.10" # Memastikan Location Jump Triggered
    return tx


# ==========================================
# SCENARIO GENERATORS (MULTI TRANSACTION)
# ==========================================

def generate_rapid_retry():
    records = []
    
    # Kunci semua identitas ke mode attacker
    account = "ACC_ATTACKER"
    customer = "CUS_ATTACKER"
    terminal = "RETRY_TERM"
    
    base_time = datetime.utcnow()

    for i in range(5):
        tx = generate_normal_transaction()
        tx["account_number"] = account
        tx["issuer_account_number"] = account
        tx["customer_ref_number"] = customer
        tx["terminal_id"] = terminal
        tx["timestamp_db"] = base_time + timedelta(seconds=i * 20)
        tx["response_code"] = "55"
        records.append(tx)

    return records


def generate_super_pattern():
    records = []
    
    # Kunci semua identitas ke mode attacker
    account = "ACC_ATTACKER"
    customer = "CUS_ATTACKER"
    
    base_time = datetime.utcnow()

    for i in range(3):
        tx = generate_normal_transaction()
        tx["account_number"] = account
        tx["issuer_account_number"] = account
        tx["customer_ref_number"] = customer
        tx["response_code"] = "55"
        tx["timestamp_db"] = base_time + timedelta(seconds=i * 20)
        records.append(tx)

    for i in range(3):
        tx = generate_normal_transaction()
        tx["account_number"] = account
        tx["issuer_account_number"] = account
        tx["customer_ref_number"] = customer
        tx["response_code"] = "00"
        tx["timestamp_db"] = base_time + timedelta(minutes=1) + timedelta(seconds=i * 20)
        records.append(tx)

    return records


def generate_fan_in():
    records = []
    terminal = "COLLUSION_TERM"

    for _ in range(15):
        tx = generate_normal_transaction()
        tx["terminal_id"] = terminal
        tx["issuer_account_number"] = random_account()
        records.append(tx)

    return records


# ==========================================
# MAIN EXECUTION
# ==========================================

def generate_transactions():
    records = []

    # ==========================
    # NORMAL
    # ==========================
    for _ in range(SCENARIO_COUNTS["normal"]):
        records.append(generate_normal_transaction())

    # ==========================
    # HIGH AMOUNT
    # ==========================
    for _ in range(SCENARIO_COUNTS["high_amount"]):
        records.append(generate_high_amount())

    # ==========================
    # MONEY MULE
    # ==========================
    for _ in range(SCENARIO_COUNTS["money_mule"]):
        records.append(generate_money_mule())

    # ==========================
    # MIDNIGHT SPIKE
    # ==========================
    for _ in range(SCENARIO_COUNTS["midnight_spike"]):
        records.append(generate_midnight_spike())

    # ==========================
    # BRUTE FORCE
    # ==========================
    for _ in range(SCENARIO_COUNTS["brute_force"]):
        records.append(generate_bruteforce())

    # ==========================
    # RULE KILLER
    # ==========================
    for _ in range(SCENARIO_COUNTS["rule_killer"]):
        records.append(generate_rule_killer())

    # ==========================
    # RAPID RETRY
    # ==========================
    for _ in range(SCENARIO_COUNTS["rapid_retry"]):
        records.extend(generate_rapid_retry())

    # ==========================
    # SUPER PATTERN
    # ==========================
    for _ in range(SCENARIO_COUNTS["super_pattern"]):
        records.extend(generate_super_pattern())

    # ==========================
    # FAN IN
    # ==========================
    for _ in range(SCENARIO_COUNTS["fan_in"]):
        records.extend(generate_fan_in())

    # Shuffle dataset agar polanya tersebar secara natural
    random.shuffle(records)

    db = SessionLocal()

    try:
        repo = SwitchingLogRepository(db)
        repo.bulk_create(records)
        print(f"✅ Inserted {len(records)} highly structured transactions for fraud testing.")
    finally:
        db.close()


if __name__ == "__main__":
    generate_transactions()