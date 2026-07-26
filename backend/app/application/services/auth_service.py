from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.infrastructure.database.models.admin_model import Admin
from app.core.security import verify_password, create_access_token, create_refresh_token
from app.core.login_security import is_locked, register_failed_attempt, reset_attempts
from app.infrastructure.repositories.admin_repository import AdminRepository
from app.domain.entities.target_type import TargetType
from app.infrastructure.database.models.user_session_model import UserSession
from app.core.device_parser import parse_device

from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)

@log_performance
def login(db: Session, email: str, password: str, ip: str = None, user_agent: str = None):
    email = email.strip().lower()
    device_name, browser_name = parse_device(user_agent)
    if device_name == "Unknown":
        device_name = "Unknown Device"

    # BRUTE FORCE DETECTION
    if is_locked(email):
        log_activity(
            db=db, admin=None,
            action_type=ActivityActionEnum.ACCOUNT_LOCKED,
            module_source=EventSourceEnum.AUTH,
            severity=SeverityLevelEnum.CRITICAL,
            target_type=TargetType.ADMIN,
            ip_address=ip, device=device_name, browser=browser_name,
            details={"email": email, "reason": "Brute force attempts threshold exceeded"}
        )
        db.commit()
        raise HTTPException(status_code=403, detail="Account temporarily locked")

    repo = AdminRepository(db)
    admin = repo.get_by_email(email)

    # GAGAL LOGIN: EMAIL TIDAK DITEMUKAN
    if not admin:
        register_failed_attempt(email)
        log_activity(
            db=db, admin=None,
            action_type=ActivityActionEnum.LOGIN_FAILED,
            module_source=EventSourceEnum.AUTH,
            severity=SeverityLevelEnum.HIGH,
            target_type=TargetType.ADMIN,
            ip_address=ip, device=device_name, browser=browser_name,
            details={"email": email, "reason": "Invalid Email Address"}
        )
        db.commit()
        raise HTTPException(401, "Invalid credentials")

    if not admin.is_active or getattr(admin, "is_deleted", False):
        raise HTTPException(403, "Account suspended")

    # GAGAL LOGIN: PASSWORD SALAH
    if not verify_password(password, admin.password_hash):
        register_failed_attempt(email)
        log_activity(
            db=db, admin=admin,
            action_type=ActivityActionEnum.LOGIN_FAILED,
            module_source=EventSourceEnum.AUTH,
            severity=SeverityLevelEnum.HIGH,
            target_type=TargetType.ADMIN,
            target_id=str(admin.id),
            ip_address=ip, device=device_name, browser=browser_name,
            details={"email": email, "reason": "Invalid Password"}
        )
        db.commit()
        raise HTTPException(401, "Invalid credentials")

    # --- JIKA SUKSES LOGIN ---
    reset_attempts(email)
    admin.last_login_at = datetime.now(timezone.utc)

    db.query(UserSession)\
      .filter(UserSession.admin_id == admin.id, UserSession.is_active == True)\
      .update({"is_active": False, "is_current": False})  

    # Buat Token Baru
    access_token = create_access_token({
        "sub": str(admin.id),
        "role": admin.role.role_name
    })
    refresh_token = create_refresh_token({"sub": str(admin.id)})

    session = UserSession(
        admin_id=admin.id,
        access_token=access_token,
        refresh_token=refresh_token,
        ip_address=ip,
        user_agent=user_agent,
        device=device_name,
        browser=browser_name,
        is_active=True,   
        is_current=True,
        last_used_at=datetime.now(timezone.utc)
    )
    db.add(session)
    db.flush()

    log_activity(
        db=db, admin=admin,
        action_type=ActivityActionEnum.LOGIN,
        module_source=EventSourceEnum.AUTH,
        severity=SeverityLevelEnum.INFO,
        target_type=TargetType.ADMIN,
        target_id=str(admin.id),
        session_id=session.id,
        ip_address=ip, device=device_name, browser=browser_name,
        details={"email": email, "status": "Success authentication"}
    )

    db.commit()

    if getattr(admin, 'is_password_temporary', False):
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "require_password_change": True,
            "user": {"id": admin.id, "email": admin.email, "role": admin.role.role_name}
        }

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": admin.id, "email": admin.email, "full_name": admin.full_name,
            "role": admin.role.role_name, "department": admin.department
        }
    }


@log_performance
def refresh_access_token(db: Session, refresh_token: str, ip: str = None, user_agent: str = None):
    from app.core.security import decode_token, create_access_token

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    repo = AdminRepository(db)
    admin = repo.get_by_id(int(payload["sub"]))

    if not admin or not admin.is_active or getattr(admin, "is_deleted", False):
        raise HTTPException(status_code=401, detail="Invalid user")

    # ✅ FIX: filter pakai is_active (konsisten)
    session = db.query(UserSession).filter(
        UserSession.refresh_token == refresh_token,
        UserSession.admin_id == admin.id,
        UserSession.is_active == True,
    ).first()

    if not session:
        raise HTTPException(status_code=401, detail="Session revoked or expired")

    new_access_token = create_access_token({
        "sub": str(admin.id),
        "role": admin.role.role_name
    })

    session.access_token = new_access_token
    session.last_used_at = datetime.now(timezone.utc)
    db.flush()

    dev_name, brw_name = parse_device(user_agent)

    log_activity(
        db=db, admin=admin,
        action_type=ActivityActionEnum.TOKEN_REFRESHED,
        module_source=EventSourceEnum.AUTH,
        severity=SeverityLevelEnum.INFO,
        target_type=TargetType.ADMIN,
        session_id=session.id,
        ip_address=ip,
        device=dev_name,
        browser=brw_name,
        details={"info": "Access token rotated successfully"}
    )
    db.commit()

    return {"access_token": new_access_token}
