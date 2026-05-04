from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.application.services.isolation_ml_service import get_domain_catalog
from app.infrastructure.ml.dependencies import get_score_isolation_history_use_case
from app.presentation.schema.isolation_schema import IsolationHistoryRequest


router = APIRouter(tags=["isolation-ml"])


@router.get("/isolation/domains")
def list_domains() -> dict:
    return {"domains": get_domain_catalog()}


@router.post("/isolation/{domain}/score-history")
def score_history_with_isolation(domain: str, payload: IsolationHistoryRequest) -> dict:
    try:
        use_case = get_score_isolation_history_use_case()
        return use_case.execute(
            domain=domain,
            records=payload.records,
            review_score_threshold=payload.review_score_threshold,
            high_risk_score_threshold=payload.high_risk_score_threshold,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
