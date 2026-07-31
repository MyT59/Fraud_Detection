from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.infrastructure.database.session import get_db
from app.application.services.review_service import (
    get_review_history,
    get_my_review_history,
    get_my_review_metrics_service,
    log_false_negative_service,
    override_review_decision_service,
    review_transaction,
    get_review_metrics_service,
    get_analyst_performance_service,
    get_review_timeline_analytics_service,
    soft_delete_review_service
)

from app.presentation.schemas.review_schema import ReviewRequest, ReviewDecision, ReviewMetricsResponse, MyReviewMetricsResponse, AnalystPerformanceResponse, ReviewTimelineAnalyticsResponse, ReviewOverrideRequest, FalseNegativeReportRequest, ReviewHistoryPaginatedResponse

from app.core.rbac import require_roles

router = APIRouter(
    prefix="/reviews",
    tags=["Reviews"]
)


@router.post("/")
def create_review(
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("FRAUD_ANALYST"))
):
    review = review_transaction(
        db=db,
        alert_id=payload.alert_id,
        reviewer_id=current_admin.id,
        decision=payload.decision.value,      
        note=payload.note,
        confidence=payload.decision_confidence.value  
    )
    return {
        "status": "success",
        "message": "Review successfully submitted",
        "review_id": review.id
    }

@router.get("/metrics", response_model=ReviewMetricsResponse)
def get_review_metrics(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))  
):
    return get_review_metrics_service(db)

@router.get("/analyst-performance", response_model=List[AnalystPerformanceResponse])
def get_analyst_performance(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))  # 🔒 Proteksi Manajemen
):
    return get_analyst_performance_service(db)

@router.get("/history", response_model=ReviewHistoryPaginatedResponse)
def get_review_history_route(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    reviewed_by: Optional[int] = Query(None, ge=1),
    decision: Optional[ReviewDecision] = None,
    search: Optional[str] = Query(None, max_length=100),
    sort_by: str = Query("newest", pattern="^(newest|oldest)$"),
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("RISK_MANAGER", "SUPER_ADMIN"))
):
    return get_review_history(db, page, limit, reviewed_by, decision.value if decision else None, search, sort_by)


@router.get("/my-history", response_model=ReviewHistoryPaginatedResponse)
def get_my_review_history_route(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    decision: Optional[ReviewDecision] = None,
    search: Optional[str] = Query(None, max_length=100),
    sort_by: str = Query("newest", pattern="^(newest|oldest)$"),
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("FRAUD_ANALYST", "RISK_MANAGER", "SUPER_ADMIN"))
):
    """
    Riwayat review milik analis yang sedang login.
    FRAUD_ANALYST hanya lihat history miliknya sendiri.
    """
    return get_my_review_history(db, current_admin.id, page, limit, decision.value if decision else None, search, sort_by)


@router.get("/my-metrics", response_model=MyReviewMetricsResponse)
def get_my_review_metrics(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("FRAUD_ANALYST", "RISK_MANAGER", "SUPER_ADMIN"))
):
    """
    Metrics personal milik analis yang sedang login.
    Semua role bisa akses — masing-masing lihat stats miliknya sendiri.
    """
    return get_my_review_metrics_service(db, current_admin.id)

@router.get("/timeline-analytics", response_model=ReviewTimelineAnalyticsResponse)
def get_review_timeline_analytics(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))  # 🔒 Amankan hak akses makro
):
    return get_review_timeline_analytics_service(db)

@router.delete("/{review_id}")
def soft_delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")) # 🔒 Proteksi Ketat
):
    return soft_delete_review_service(db, review_id, current_admin.id)

@router.post("/{review_id}/override")
def override_review_decision(
    review_id: int,
    payload: ReviewOverrideRequest,
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")) # 🔒 Proteksi Ketat Pimpinan
):
    return override_review_decision_service(
        db=db,
        review_id=review_id,
        admin_id=current_admin.id,
        new_decision=payload.new_decision.value,
        reason=payload.reason
    )

@router.post("/transactions/{transaction_id}/report-fraud")
def report_false_negative(
    transaction_id: int,
    payload: FalseNegativeReportRequest,
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")) # 🔒 Hanya untuk pimpinan
):
    return log_false_negative_service(
        db=db,
        transaction_id=transaction_id,
        admin_id=current_admin.id,
        reason=payload.reason
    )
