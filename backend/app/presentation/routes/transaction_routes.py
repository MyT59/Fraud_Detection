from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.infrastructure.database.session import get_db
from app.application.services.transaction_service import process_transaction
from app.infrastructure.repositories.transaction_repository import (
    TransactionRepository
)
from app.application.services.pattern_engine_service import detect_suppressed_patterns
from app.presentation.schemas.transaction_schema import (
    TransactionCreate,
    TransactionResponse,
    TransactionListResponse,
    TransactionDetailResponse
)
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _normalize_status(value):
    if value is None:
        return "FLAGGED"

    raw = getattr(value, "value", value)
    raw = str(raw).replace("TransactionStatusEnum.", "")

    if raw in {"", "PENDING"}:
        return "FLAGGED"

    return raw

@router.get(
    "",
    response_model=TransactionListResponse
)
@log_performance(label="TransactionRoutes.get_transactions")
def get_transactions(
    search: str | None = None,
    service_source: str | None = None,
    final_status: str | None = None,
    risk_level: str | None = None,
    is_flagged_ml: bool | None = None,
    city: str | None = None,
    country: str | None = None,
    min_amount: float | None = None,
    max_amount: float | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    sort_by: str = "transaction_time",
    sort_order: str = "desc",
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db)
):
    repo = TransactionRepository(db)
    final_status = _normalize_status(final_status) if final_status else None

    items, total = repo.get_transactions(
        search=search,
        service_source=service_source,
        final_status=final_status,
        risk_level=risk_level,
        is_flagged_ml=is_flagged_ml,
        city=city,
        country=country,
        min_amount=min_amount,
        max_amount=max_amount,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        size=size,
    )

    summary = repo.get_transaction_summary()

    return {
        "summary": summary,
        "page": page,
        "size": size,
        "total_records": total,
        "total_pages": (total + size - 1) // size,
        "data": [
            {
                "id": trx.id,
                "original_trx_id": trx.original_trx_id,
                "service_source": trx.service_source,
                "user_account_id": trx.user_account_id,
                "amount": float(trx.amount),
                "risk_score": trx.risk_score,
                "risk_level": trx.risk_level,
                "final_status": _normalize_status(trx.final_status),
                "transaction_time": trx.transaction_time,
                "city": trx.city,
                "country": trx.country,
                "suppressed_count": len(detect_suppressed_patterns(db, trx)),
            }
            for trx in items
        ]
    }

@router.get("/debug/suppressed_example")
def get_suppressed_example():
    """Smoke endpoint for frontend QA: returns an example suppressed_patterns
    payload so analysts can verify UI rendering without needing backend
    suppression logic to be triggered in production.
    """
    example = {
        "suppressed_patterns": [
            {"id": 101, "name": "Low Confidence Pattern A", "reason": "manual_suppress"},
            {"id": 202, "name": "Historical Pattern B", "reason": "auto_disable"},
            {"pattern_name": "Weird Channel Spike", "notes": "meta info here"},
        ],
        "suppressed_pattern_ids": [101, 202]
    }
    return example

@router.get(
    "/{transaction_id}",
    response_model=TransactionDetailResponse
)
def get_transaction_detail(
    transaction_id: int,
    db: Session = Depends(get_db)
):
    repo = TransactionRepository(db)

    trx = repo.get_by_id(transaction_id)

    if not trx:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    return {
        "id": trx.id,
        "original_trx_id": trx.original_trx_id,
        "service_source": trx.service_source,

        "user_account_id": trx.user_account_id,
        "account_number": trx.account_number,

        "amount": float(trx.amount),

        "transaction_time": trx.transaction_time,

        "transaction_status": trx.transaction_status,
        "final_status": _normalize_status(trx.final_status),

        "risk_score": trx.risk_score,
        "risk_level": trx.risk_level,
        "anomaly_score": trx.anomaly_score,

        "violation_reason": trx.violation_reason,
        "violation_rule_ids": trx.violation_rule_ids,
        "violation_pattern_ids": trx.violation_pattern_ids,
        # Optional suppressed signals for forensic review. Stored inside
        # `transaction_details` by backend processors when applicable.
        "suppressed_patterns": (trx.transaction_details or {}).get("suppressed_patterns"),
        "suppressed_pattern_ids": (trx.transaction_details or {}).get("suppressed_pattern_ids"),
        "ip_address": trx.ip_address,
        "terminal_id": trx.terminal_id,
        "merchant_id": trx.merchant_id,

        "city": trx.city,
        "country": trx.country,

        "score_breakdown": trx.score_breakdown,
        "transaction_details": trx.transaction_details,

        "is_flagged_ml": trx.is_flagged_ml,

        "created_at": trx.created_at,
        "updated_at": trx.updated_at,
    }

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
            "final_status": _normalize_status(trx.final_status),

            "alert_created": _normalize_status(trx.final_status) in ["FLAGGED", "FRAUD"],
            "violation_reason": trx.violation_reason,

            "created_at": trx.created_at
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

