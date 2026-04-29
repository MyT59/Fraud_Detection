import random
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

TARGET_ROWS = 5000
NUM_CUSTOMERS = 620
# Lower fraud rate and increase overlap with normal behavior.
FRAUD_PROB = 0.06

base_time = datetime(2026, 1, 1)
customers = [f"CUST{10000+i}" for i in range(NUM_CUSTOMERS)]
states = {
    c: {
        "normal_bill": random.randint(100000, 400000),
        "preferred_channel": random.choice(["Mobile", "Web"]),
        "last_payment_time": base_time + timedelta(days=random.randint(0, 10)),
    }
    for c in customers
}

data: list[list] = []
while len(data) < TARGET_ROWS:
    customer = random.choice(customers)
    st = states[customer]
    slots = TARGET_ROWS - len(data)

    bill_date = st["last_payment_time"] + timedelta(days=30)
    delay_days = random.randint(0, 5)
    if random.random() < 0.06:
        delay_days = random.choice([-1, 0, 1])  # benign early/on-time variance
    payment_date = bill_date + timedelta(days=delay_days)
    payment_amount = st["normal_bill"]
    refund_flag = 0
    channel = st["preferred_channel"]
    is_fraud = 0

    # Harder normal samples: occasional API and slight amount mismatch.
    if random.random() < 0.08:
        channel = "API"
    if random.random() < 0.05:
        payment_amount = int(st["normal_bill"] * random.uniform(0.95, 1.05))

    if random.random() < FRAUD_PROB:
        fraud_type = random.choice(["underpay", "high_spike", "refund_abuse", "burst", "channel_switch"])
        if fraud_type == "underpay":
            payment_amount = int(st["normal_bill"] * random.uniform(0.25, 0.7))
            is_fraud = 1
        elif fraud_type == "high_spike":
            payment_amount = int(st["normal_bill"] * random.uniform(2.0, 6.0))
            is_fraud = 1
        elif fraud_type == "refund_abuse":
            refund_flag = 1
            is_fraud = 1
        elif fraud_type == "channel_switch":
            channel = "API"
            is_fraud = 1
        else:
            burst_n = min(random.randint(2, 3), slots)
            for i in range(burst_n):
                data.append(
                    [
                        f"BILL{random.randint(100000, 999999)}",
                        customer,
                        st["normal_bill"],
                        st["normal_bill"],
                        bill_date,
                        bill_date + timedelta(minutes=i),
                        "API",
                        "Paid",
                        0,
                        1,
                    ]
                )
            st["last_payment_time"] = bill_date + timedelta(minutes=burst_n)
            continue

    data.append(
        [
            f"BILL{random.randint(100000, 999999)}",
            customer,
            st["normal_bill"],
            payment_amount,
            bill_date,
            payment_date,
            channel,
            "Paid",
            refund_flag,
            is_fraud,
        ]
    )
    st["last_payment_time"] = payment_date

columns = ["BILL_ID", "CUSTOMER_ID", "BILL_AMOUNT", "PAYMENT_AMOUNT", "BILL_DATE", "PAYMENT_DATE", "CHANNEL", "BILL_STATUS", "REFUND_FLAG", "IS_FRAUD"]
df = pd.DataFrame(data, columns=columns)
out = Path(__file__).resolve().parents[1] / "Data" / "nusabill_isolation_dataset.csv"
out.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(out, index=False)
print(f"Dataset Nusabill dibuat: {len(df)} rows, fraud_rate={df['IS_FRAUD'].mean():.4f}")
