from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.infrastructure.database.base import Base

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True)
    admin_id = Column(Integer, ForeignKey("admins.id"))

    access_token = Column(Text)
    refresh_token = Column(Text)

    ip_address = Column(String(50))
    user_agent = Column(Text)
    device = Column(String(100))          # ← NEW (parsed device)
    browser = Column(String(100))         # ← NEW (parsed browser)
    is_current = Column(Boolean, default=False)  # ← NEW

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True))
    last_used_at = Column(DateTime(timezone=True))