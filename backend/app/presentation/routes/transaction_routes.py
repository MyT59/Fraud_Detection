from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Literal

from app.infrastructure.database.session import get_db
from app.application.services.transaction_service import process_transaction
from app.infrastructure.repositories.transaction_repository import (
    TransactionRepository
)
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.presentation.schemas.transaction_schema import (
    TransactionCreate,
    TransactionResponse,
    TransactionListResponse,
    TransactionDetailResponse
)
from app.core.logging import get_logger, log_performance
from app.core.rbac import require_roles
from app.core.rate_limiter import limiter

logger = get_logger(__name__)

# Semua role yang login dapat memantau transaksi. Ingest manual dibatasi di
# endpoint POST agar halaman monitoring tidak menjadi jalur data poisoning.
router = APIRouter(
    prefix="/transactions",
    tags=["Transactions"],
    dependencies=[Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))],
)


def _normalize_status(value):
    if value is None:
        return "FLAGGED"

    raw = getattr(value, "value", value)
    raw = str(raw).replace("TransactionStatusEnum.", "")

    if raw in {"", "PENDING"}:
        return "FLAGGED"

    return raw


def _resolve_suppressed_patterns(details: dict | None, db: Session) -> list[dict]:
    """Return suppressed signals with a human-readable pattern name.

    Older transactions may only contain ``suppressed_pattern_ids``. Resolve
    them at read time so the forensic UI never has to show an unexplained ID.
    """
    details = details or {}
    raw_patterns = details.get("suppressed_patterns") or []
    raw_ids = details.get("suppressed_pattern_ids") or []
    resolved: dict[int, dict] = {}
    missing_ids: set[int] = set()

    for item in raw_patterns:
        if isinstance(item, dict):
            pattern_id = item.get("id")
            try:
                pattern_id = int(pattern_id)
            except (TypeError, ValueError):
                pattern_id = None
            if pattern_id is not None:
                resolved[pattern_id] = {
                    "id": pattern_id,
                    "name": item.get("name") or item.get("pattern_name"),
                    "category": item.get("category") or item.get("pattern_category"),
                }
                if not resolved[pattern_id]["name"]:
                    missing_ids.add(pattern_id)
        else:
            try:
                missing_ids.add(int(item))
            except (TypeError, ValueError):
                continue

    for item in raw_ids:
        try:
            pattern_id = int(item)
        except (TypeError, ValueError):
            continue
        if pattern_id not in resolved:
            resolved[pattern_id] = {"id": pattern_id, "name": None, "category": None}
        if not resolved[pattern_id]["name"]:
            missing_ids.add(pattern_id)

    if missing_ids:
        patterns = db.query(FraudPattern).filter(FraudPattern.id.in_(missing_ids)).all()
        for pattern in patterns:
            resolved[pattern.id] = {
                "id": pattern.id,
                "name": pattern.pattern_name,
                "category": pattern.pattern_category,
            }

    return list(resolved.values())

@router.get(
    "",
    response_model=TransactionListResponse
)
@log_performance(label="TransactionRoutes.get_transactions")
def get_transactions(
    search: str | None = Query(None, max_length=100),
    service_source: Literal["AGENUSA", "NUSABILL"] | None = None,
    final_status: Literal["FLAGGED", "SAFE", "FRAUD"] | None = None,
    risk_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = None,
    is_flagged_ml: bool | None = None,
    city: str | None = Query(None, max_length=50),
    country: str | None = Query(None, max_length=50),
    min_amount: float | None = Query(None, ge=0),
    max_amount: float | None = Query(None, ge=0),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    sort_by: Literal["transaction_time", "amount", "risk_score"] = "transaction_time",
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    if min_amount is not None and max_amount is not None and min_amount > max_amount:
        raise HTTPException(status_code=422, detail="min_amount must not exceed max_amount")
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must not be after end_date")
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
                "suppressed_count": len((trx.transaction_details or {}).get("suppressed_patterns") or []),
            }
            for trx in items
        ]
    }

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

    suppressed_patterns = _resolve_suppressed_patterns(trx.transaction_details, db)

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
        "blacklist_matches": (trx.score_breakdown or {}).get("blacklist_matches", []),
        # Optional suppressed signals for forensic review. Stored inside
        # `transaction_details` by backend processors when applicable.
        "suppressed_patterns": suppressed_patterns,
        "suppressed_pattern_ids": [item["id"] for item in suppressed_patterns],
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
@limiter.limit("30/minute")
def create_transaction(
    request: Request,
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")),
):
    try:
        trx = process_transaction(payload.model_dump(), db)

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

