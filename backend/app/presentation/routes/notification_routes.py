from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.infrastructure.database.session import get_db
from app.core.security import get_current_user
from app.application.services.notification_service import get_preferences, update_preferences
from app.presentation.schemas.notification_schema import NotificationUpdateRequest
router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
def get_user_preferences(
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_user)
):
    return get_preferences(db, current_admin)


@router.patch("/")
def update_user_preferences(
    request: NotificationUpdateRequest, 
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_user)
):
    return update_preferences(
        db,
        current_admin,
        fraud_alerts=request.fraud_alerts_enabled,
        push_notifications=request.push_notifications_enabled
    )