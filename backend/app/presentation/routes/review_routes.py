from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.infrastructure.database.session import get_db
from app.application.services.review_service import get_review_history, review_transaction
from app.core.security import get_current_user
from app.core.rbac import require_roles

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("/")
def create_review(
    alert_id: int,
    decision: str,
    note: str = "",
    db: Session = Depends(get_db),
    user=Depends(require_roles("FRAUD_ANALYST", "RISK_MANAGER"))
):
    return review_transaction(
        db=db,
        alert_id=alert_id,
        reviewer_id=user.id,
        decision=decision,
        note=note
    )

@router.get("/history")
def get_review_history_route(
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    return get_review_history(db, page, limit)