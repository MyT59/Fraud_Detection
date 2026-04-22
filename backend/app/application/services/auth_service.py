from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.infrastructure.database.models.admin_model import Admin
from app.infrastructure.database.models.activity_log_model import ActivityLog
from app.core.security import verify_password, create_access_token, create_refresh_token
from app.core.login_security import is_locked, register_failed_attempt, reset_attempts

def login(db: Session, email: str, password: str):

    if is_locked(email):
        raise HTTPException(status_code=403, detail="Account temporarily locked")

    admin = db.query(Admin).filter(Admin.email == email).first()

    if not admin or not verify_password(password, admin.password_hash):
        register_failed_attempt(email)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    reset_attempts(email)

    access_token = create_access_token({"sub": str(admin.id)})
    refresh_token = create_refresh_token({"sub": str(admin.id)})

    # activity log
    log = ActivityLog(
        admin_id=admin.id,
        action_type="LOGIN",
        target_type="ADMIN",
        target_id=str(admin.id),
        details="User logged in"
    )
    db.add(log)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": admin.id,
            "email": admin.email,
            "role": admin.role.role_name
        }
    }


def refresh_access_token(refresh_token: str):
    from app.core.security import decode_token, create_access_token

    payload = decode_token(refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    return {
        "access_token": create_access_token({"sub": payload["sub"]})
    }