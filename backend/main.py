from app.infrastructure.database.session import SessionLocal
from app.application.services.transaction_service import process_transaction
import uuid
import time


db = SessionLocal()

print("\n===== PATTERN TEST: BURST =====")

db = SessionLocal()

for i in range(3):
    trx = process_transaction({
        "original_trx_id": str(uuid.uuid4()),
        "service_source": "AGENUSA",
        "user_account_id": "USER_BURST",
        "amount": 1500000
    }, db)

    print(f"{i+1}. Score:", trx.risk_score, "| Reason:", trx.violation_reason)

db.close()