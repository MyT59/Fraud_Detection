from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True)

    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    phone_number = Column(String(20))
    notes = Column(Text)
    password_hash = Column(String(255), nullable=False)
    is_password_temporary = Column(Boolean, default=False)

    role_id = Column(Integer, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)

    is_active = Column(Boolean, default=True, server_default=text("true"))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    department = Column(String(100))
    created_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    role = relationship("Role", back_populates="admins")
    activity_logs = relationship("ActivityLog", back_populates="admin")
    blacklist_items = relationship("BlacklistItem", back_populates="admin")