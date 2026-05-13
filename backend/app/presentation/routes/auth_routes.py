from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.security import blacklist_token

from slowapi.util import get_remote_address
from main import limiter

from app.infrastructure.database.session import get_db
from app.application.services.auth_service import login, refresh_access_token
from app.infrastructure.database.models.activity_log_model import ActivityLog
from app.infrastructure.repositories.user_session_repository import UserSessionRepository

security = HTTPBearer()
router = APIRouter()

@router.post("/login")
@limiter.limit("5/minute")
def login_route(
    request: Request,
    email: str,
    password: str,
    db: Session = Depends(get_db)
):
    # 🔥 KIRIM IP DAN USER AGENT KE SERVICE
    result = login(
        db, 
        email, 
        password, 
        ip=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    return result

@router.post("/refresh")
def refresh_token_route(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    return refresh_access_token(db, refresh_token)

@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    blacklist_token(token)  # Tetap pertahankan kalau masih dipakai
    
    # 🔥 Nonaktifkan sesi di database
    repo = UserSessionRepository(db)
    session = repo.get_by_token(token)
    if session:
        repo.revoke(session.id, session.admin_id)
        
    return {"message": "Logged out successfully"}