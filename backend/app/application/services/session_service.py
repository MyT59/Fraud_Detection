from datetime import datetime, timezone
from app.infrastructure.repositories.user_session_repository import UserSessionRepository
from app.infrastructure.database.models.user_session_model import UserSession
from app.core.device_parser import parse_device

# 🔥 IMPORT SERVICE LOG UTAMA & ENUM
from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum


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
        db.flush() # Menggunakan flush untuk mendukung single transaction di level pemanggil

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
    
    # 🚨 FIX: Ambil metadata sesi terlebih dahulu untuk kebutuhan forensik log sebelum dicabut
    session_record = db.query(UserSession).filter(UserSession.id == session_id).first()
    
    # Jalankan fungsi revoke bawaan
    repo.revoke(session_id, current_admin.id)
    db.flush()

    if session_record:
        # 🚨 REKOMENDASI AUDIT WAJIB: Catat administrative forced logout ke log 
        log_activity(
            db=db,
            admin=current_admin, # Admin/Manager yang mengeksekusi tombol revoke
            action_type=ActivityActionEnum.SESSION_REVOKED,
            module_source=EventSourceEnum.AUTH,
            severity=SeverityLevelEnum.WARNING, # Pencabutan sesi paksa bernilai Warning
            target_type="SESSION",
            target_id=str(session_id),
            ip_address=session_record.ip_address,
            device=session_record.device,
            browser=session_record.browser,
            details={
                "target_revoked_admin_id": session_record.admin_id,
                "session_id": session_id,
                "reason": "Forced administrative session termination via management dashboard"
            }
        )
    
    # 🔥 SINGLE TRANSACTION COMMIT
    db.commit()
    return {"message": "Session revoked successfully"}