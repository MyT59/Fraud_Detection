from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.infrastructure.database.session import get_db
from app.application.services.transaction_service import process_transaction

from app.presentation.schemas.transaction_schema import (
    TransactionCreate,
    TransactionResponse
)

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post("/", response_model=TransactionResponse)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
    try:
        trx = process_transaction(payload.dict(), db)

        if not trx:
            raise HTTPException(status_code=500, detail="Transaction processing failed")

        return {
            "transaction_id": trx.id,
            "original_trx_id": trx.original_trx_id,
            "service_source": trx.service_source,
            "amount": float(trx.amount),

            "risk_score": trx.risk_score,
            "risk_level": trx.risk_level,
            "final_status": trx.final_status,

            "alert_created": trx.final_status in ["REVIEW", "FRAUD"],
            "violation_reason": trx.violation_reason,

            "created_at": trx.created_at
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")