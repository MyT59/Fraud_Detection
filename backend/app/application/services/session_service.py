from datetime import datetime, timezone
from app.infrastructure.repositories.user_session_repository import UserSessionRepository
from app.infrastructure.database.models.user_session_model import UserSession
from app.core.device_parser import parse_device


def create_session(db, admin, access_token, refresh_token, ip, user_agent):
    repo = UserSessionRepository(db)

    repo.deactivate_current_sessions(admin.id)

    device, browser = parse_device(user_agent)

    session = UserSession(
        admin_id=admin.id,
        access_token=access_token,
        refresh_token=refresh_token,
        ip_address=ip,
        user_agent=user_agent,
        device=device,
        browser=browser,
        is_current=True,
        last_used_at=datetime.now(timezone.utc)
    )

    MAX_SESSIONS = 3

    sessions = repo.get_active_sessions(admin.id)

    if len(sessions) >= MAX_SESSIONS:
        oldest = sorted(sessions, key=lambda x: x.created_at)[0]
        oldest.is_active = False
        oldest.is_current = False
        db.commit()

    return repo.create(session)


def get_sessions(db, current_admin):
    repo = UserSessionRepository(db)
    sessions = repo.get_active_sessions(current_admin.id)

    return [
        {
            "id": s.id,
            "device": s.device,
            "ip": s.ip_address,
            "last_used": s.last_used_at,
            "is_current": s.is_current
        }
        for s in sessions
    ]


def revoke_session(db, session_id, current_admin):
    repo = UserSessionRepository(db)
    repo.revoke(session_id, current_admin.id)

    return {"message": "Session revoked"}