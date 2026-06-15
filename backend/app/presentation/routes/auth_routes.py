from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.security import blacklist_token
from main import limiter

from app.infrastructure.database.session import get_db
from app.application.services.auth_service import login, refresh_access_token
from app.infrastructure.repositories.user_session_repository import UserSessionRepository
from app.infrastructure.repositories.admin_repository import AdminRepository

from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
from app.domain.entities.target_type import TargetType
from app.core.device_parser import parse_device

security = HTTPBearer()
router = APIRouter()


# ✅ FIX: Schema request body untuk login
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ✅ FIX: Schema request body untuk refresh
class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/login")
@limiter.limit("5/minute")
def login_route(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    # ✅ email & password dari body, bukan query params
    result = login(
        db, body.email, body.password,
        ip=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    return result


@router.post("/refresh")
def refresh_token_route(request: Request, body: RefreshRequest, db: Session = Depends(get_db)):
    # ✅ refresh_token dari body, bukan query params
    return refresh_access_token(
        db, body.refresh_token,
        ip=request.client.host,
        user_agent=request.headers.get("user-agent")
    )


@router.post("/logout")
def logout(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    blacklist_token(token)

    ip = request.client.host
    user_agent = request.headers.get("user-agent")
    device_name, browser_name = parse_device(user_agent)

    repo = UserSessionRepository(db)
    session = repo.get_by_token(token)

    if session:
        admin_repo = AdminRepository(db)
        admin = admin_repo.get_by_id(session.admin_id)

        action = ActivityActionEnum.LOGOUT

        log_activity(
            db=db, admin=admin,
            action_type=action,
            module_source=EventSourceEnum.AUTH,
            severity=SeverityLevelEnum.INFO,
            target_type=TargetType.SESSION,
            target_id=str(session.id),
            session_id=session.id,
            ip_address=ip,
            device=device_name,
            browser=browser_name,
            details={"message": "Session invalidated successfully"}
        )

        repo.revoke(session.id, session.admin_id)
        db.commit()

    return {"message": "Logged out successfully"}