from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.infrastructure.repositories.user_session_repository import UserSessionRepository
from app.application.services.session_service import get_sessions
from app.core.security import get_current_user, get_db
from app.presentation.schemas.session_schema import SessionResponse
from app.application.services.session_service import revoke_session

router = APIRouter()

@router.get("/sessions", response_model=list[SessionResponse])
def get_sessions_route(
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_user)
):
    return get_sessions(db, current_admin)


@router.post("/{session_id}/revoke")
def revoke_admin_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_user)
):
    return revoke_session(
        db=db, 
        session_id=session_id, 
        current_admin=current_admin
    )