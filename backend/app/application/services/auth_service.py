from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.infrastructure.database.models.admin_model import Admin
from app.infrastructure.database.models.activity_log_model import ActivityLog
from app.core.security import verify_password, create_access_token, create_refresh_token
from app.core.login_security import is_locked, register_failed_attempt, reset_attempts
from app.infrastructure.repositories.admin_repository import AdminRepository
from app.domain.entities.target_type import TargetType
from app.infrastructure.database.models.user_session_model import UserSession

# 🔥 IMPORT BARU
from app.core.device_parser import parse_device

def login(db: Session, email: str, password: str, ip: str = None, user_agent: str = None):
    if is_locked(email):
        raise HTTPException(status_code=403, detail="Account temporarily locked")

    repo = AdminRepository(db)
    admin = repo.get_by_email(email)

    if not admin:
        register_failed_attempt(email)
        raise HTTPException(401, "Invalid credentials")

    if not admin.is_active:
        raise HTTPException(403, "Account suspended")

    if not verify_password(password, admin.password_hash):
        register_failed_attempt(email)
        raise HTTPException(401, "Invalid credentials")

    reset_attempts(email)

    admin.last_login_at = datetime.now(timezone.utc)
    db.commit()
    
    # Activity log
    log = ActivityLog(
        admin_id=admin.id,
        action_type="LOGIN",
        target_type=TargetType.ADMIN,
        target_id=str(admin.id),
        details=f"Login from IP {ip}" if ip else "User logged in"
    )
    db.add(log)
    db.commit() 

    # Buat Token Dulu
    access_token = create_access_token({
        "sub": str(admin.id),
        "role": admin.role.role_name
    })
    refresh_token = create_refresh_token({"sub": str(admin.id)})

    # 🔥 NONAKTIFKAN session lama
    db.query(UserSession)\
      .filter(UserSession.admin_id == admin.id, UserSession.is_current == True)\
      .update({"is_current": False})

    # 🔥 CREATE session baru dengan device & user_agent
    device_name = parse_device(user_agent)

    session = UserSession(
        admin_id=admin.id,
        access_token=access_token,
        refresh_token=refresh_token,
        ip_address=ip,
        user_agent=user_agent,
        device=device_name,
        is_current=True,
        last_used_at=datetime.now(timezone.utc)
    )

    db.add(session)
    db.commit()

    if getattr(admin, 'is_password_temporary', False): 
        return {
            "access_token": access_token, 
            "refresh_token": refresh_token,
            "message": "Password is temporary, please change password",
            "require_password_change": True,
            "user": {
                "id": admin.id,
                "email": admin.email,
                "role": admin.role.role_name
            }
        }

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": admin.id,
            "email": admin.email,
            "full_name": admin.full_name,
            "role": admin.role.role_name,
            "department": admin.department 
        }
    }

def refresh_access_token(db: Session, refresh_token: str):
    from app.core.security import decode_token, create_access_token
    from app.infrastructure.repositories.admin_repository import AdminRepository

    payload = decode_token(refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    repo = AdminRepository(db)
    admin = repo.get_by_id(int(payload["sub"]))

    if not admin or not admin.is_active:
        raise HTTPException(status_code=401, detail="Invalid user")

    return {
        "access_token": create_access_token({
            "sub": str(admin.id),
            "role": admin.role.role_name
        })
    }