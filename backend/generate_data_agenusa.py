import random
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

TARGET_ROWS = 5000
NUM_USERS = 320
FRAUD_PROB = 0.24

base_time = datetime(2026, 1, 1)
terminals = [f"T{1000+i}" for i in range(30)]
merchants = [f"M{2000+i}" for i in range(20)]
dest_accounts = [f"DST{300000+i}" for i in range(200)]
accounts = [f"ACCT{100000+i}" for i in range(NUM_USERS)]

states = {
    acc: {
        "normal_amount": random.randint(50000, 350000),
        "last_terminal": random.choice(terminals),
        "last_time": base_time + timedelta(minutes=random.randint(0, 60 * 24 * 20)),
    }
    for acc in accounts
}


def add_row(data: list, acc: str, st: dict, stan: int, *, is_fraud: int, processing: str, response: str, dest: str | None = None, amount: int | None = None, terminal: str | None = None, gap_min: int | None = None, force_hour: int | None = None) -> int:
    terminal = terminal or st["last_terminal"]
    timestamp = st["last_time"] + timedelta(minutes=gap_min if gap_min is not None else random.randint(5, 240))
    if force_hour is not None:
        timestamp = timestamp.replace(hour=force_hour, minute=random.randint(0, 59))
    amount = amount if amount is not None else max(20000, int(np.random.normal(st["normal_amount"], 22000)))
    dest = dest or random.choice(dest_accounts)

    data.append(
        [
            terminal,
            random.choice(merchants),
            acc,
            dest,
            timestamp,
            int(amount),
            stan,
            processing,
            response,
            "0200",
            is_fraud,
        ]
    )
    st["last_terminal"] = terminal
    st["last_time"] = timestamp
    return stan + 1


data: list[list] = []
stan = 100000
while len(data) < TARGET_ROWS:
    acc = random.choice(accounts)
    st = states[acc]
    slots = TARGET_ROWS - len(data)

    if random.random() > FRAUD_PROB:
        stan = add_row(data, acc, st, stan, is_fraud=0, processing=random.choice(["010000", "400000"]), response="00")
        continue

    fraud_type = random.choice(["midnight", "impossible_travel", "bruteforce", "money_mule", "high_amount"])
    if fraud_type == "midnight":
        stan = add_row(data, acc, st, stan, is_fraud=1, processing="010000", response="00", force_hour=random.choice([1, 2, 3, 4]), amount=int(st["normal_amount"] * random.uniform(1.8, 3.0)))
    elif fraud_type == "impossible_travel":
        new_terminal = random.choice([t for t in terminals if t != st["last_terminal"]])
        stan = add_row(data, acc, st, stan, is_fraud=1, processing="010000", response="00", terminal=new_terminal, gap_min=random.randint(1, 8))
    elif fraud_type == "bruteforce":
        for _ in range(min(random.randint(3, 5), slots)):
            stan = add_row(data, acc, st, stan, is_fraud=1, processing="300000", response="55", gap_min=1)
            if len(data) >= TARGET_ROWS:
                break
    elif fraud_type == "money_mule":
        for _ in range(min(random.randint(2, 4), slots)):
            stan = add_row(data, acc, st, stan, is_fraud=1, processing="400000", response="00", dest="DST999999", gap_min=2)
            if len(data) >= TARGET_ROWS:
                break
    else:
        stan = add_row(data, acc, st, stan, is_fraud=1, processing="010000", response="00", amount=int(st["normal_amount"] * random.uniform(10, 18)), gap_min=random.randint(5, 35))

columns = ["TERMINAL_ID", "MERCHANT_ID", "ACCOUNT_NUMBER", "DEST_ACCOUNT_NUMBER", "TIMESTAMP_DB", "AMOUNT", "STAN", "PROCESSING_CODE", "RESPONSE_CODE", "MTI", "IS_FRAUD"]
df = pd.DataFrame(data, columns=columns).sort_values(["ACCOUNT_NUMBER", "TIMESTAMP_DB"]).reset_index(drop=True)
df["TIMESTAMP_DB"] = pd.to_datetime(df["TIMESTAMP_DB"]).dt.strftime("%Y-%m-%d %H:%M:%S")
out = Path(__file__).resolve().parent / "agenusa_pattern_dataset.csv"
df.to_csv(out, index=False)
print(f"Dataset Agenusa dibuat: {len(df)} rows, fraud_rate={df['IS_FRAUD'].mean():.4f}")
