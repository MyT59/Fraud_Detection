import random
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

TARGET_ROWS = 5000
NUM_CUSTOMERS = 620
FRAUD_PROB = 0.22

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
    payment_date = bill_date + timedelta(days=random.randint(0, 5))
    payment_amount = st["normal_bill"]
    refund_flag = 0
    channel = st["preferred_channel"]
    is_fraud = 0

    if random.random() < FRAUD_PROB:
        fraud_type = random.choice(["underpay", "high_spike", "refund_abuse", "burst", "channel_switch"])
        if fraud_type == "underpay":
            payment_amount = random.randint(1000, 10000)
            is_fraud = 1
        elif fraud_type == "high_spike":
            payment_amount = int(st["normal_bill"] * random.uniform(10, 24))
            is_fraud = 1
        elif fraud_type == "refund_abuse":
            refund_flag = 1
            is_fraud = 1
        elif fraud_type == "channel_switch":
            channel = "API"
            is_fraud = 1
        else:
            burst_n = min(random.randint(3, 5), slots)
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
out = Path(__file__).resolve().parent / "nusabill_pattern_dataset.csv"
df.to_csv(out, index=False)
print(f"Dataset Nusabill dibuat: {len(df)} rows, fraud_rate={df['IS_FRAUD'].mean():.4f}")
