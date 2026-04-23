from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.security import blacklist_token

from slowapi.util import get_remote_address
from main import limiter

from app.infrastructure.database.session import get_db
from app.application.services.auth_service import login, refresh_access_token
from app.infrastructure.database.models.activity_log_model import ActivityLog

security = HTTPBearer()
router = APIRouter()

router = APIRouter()

@router.post("/login")
@limiter.limit("5/minute")
def login_route(
    request: Request,
    email: str,
    password: str,
    db: Session = Depends(get_db)
):
    result = login(db, email, password)

    # 🔥 tambahin IP ke log
    if result:
        ip = request.client.host

        log = ActivityLog(
            admin_id=result["user"]["id"],
            action_type="LOGIN",
            target_type="ADMIN",
            target_id=str(result["user"]["id"]),
            details=f"Login from IP {ip}"
        )
        db.add(log)
        db.commit()

    return result

@router.post("/refresh")
def refresh_token_route(refresh_token: str):
    return refresh_access_token(refresh_token)

@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    blacklist_token(token)
    return {"message": "Logged out successfully"}