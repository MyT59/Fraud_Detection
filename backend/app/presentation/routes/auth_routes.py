from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.security import blacklist_token
from main import limiter

from app.infrastructure.database.session import get_db
from app.application.services.auth_service import login, refresh_access_token
from app.infrastructure.repositories.user_session_repository import UserSessionRepository
from app.infrastructure.repositories.admin_repository import AdminRepository

# 🔥 IMPORT LOG UTAMA & ENUM UNTUK ROUTE LOGOUT
from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
from app.core.device_parser import parse_device

security = HTTPBearer()
router = APIRouter()

@router.post("/login")
@limiter.limit("5/minute")
def login_route(request: Request, email: str, password: str, db: Session = Depends(get_db)):
    result = login(
        db, email, password, 
        ip=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    return result


@router.post("/refresh")
def refresh_token_route(request: Request, refresh_token: str, db: Session = Depends(get_db)):
    # Meneruskan data request IP & UA ke token refresh service
    return refresh_access_token(
        db, refresh_token,
        ip=request.client.host,
        user_agent=request.headers.get("user-agent")
    )


@router.post("/logout")
def logout(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    blacklist_token(token)
    
    ip = request.client.host
    user_agent = request.headers.get("user-agent")
    device_name = parse_device(user_agent)

    repo = UserSessionRepository(db)
    session = repo.get_by_token(token)
    
    if session:
        admin_repo = AdminRepository(db)
        admin = admin_repo.get_by_id(session.admin_id)
        
        # Tentukan jenis aksi: Apakah dia logout sendiri, atau sesinya dipaksa keluar (Revoke)?
        # Jika admin_id yang me-request cocok dengan pemilik sesi, statusnya LOGOUT biasa.
        # Catatan: Implementasi current_admin opsional dipasang via dependency jika dibutuhkan.
        action = ActivityActionEnum.LOGOUT 

        # 🚨 REKOMENDASI AUDIT: Catat aksi keluar / pencabutan token ke log sebelum dihapus
        log_activity(
            db=db, admin=admin,
            action_type=action,
            module_source=EventSourceEnum.AUTH,
            severity=SeverityLevelEnum.INFO,
            target_type="SESSION",
            target_id=str(session.id),
            session_id=session.id,
            ip_address=ip, device=device_name,
            details={"message": "Session invalidated successfully"}
        )
        
        # Eksekusi pencabutan status aktif sesi di DB
        repo.revoke(session.id, session.admin_id)
        db.commit() # Commit satu transaksi penutupan sesi + pembuatan audit log
        
    return {"message": "Logged out successfully"}