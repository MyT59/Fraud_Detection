from sqlalchemy import Column, BigInteger, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(BigInteger, primary_key=True)
    admin_id = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    session_id = Column(Integer, ForeignKey("user_sessions.id", ondelete="SET NULL"), nullable=True)

    action_type = Column(String(50), nullable=False) 
    module_source = Column(String(50), default="SYSTEM") 
    severity = Column(String(20), default="INFO") 
    
    target_type = Column(String(100))
    target_id = Column(String(100))
    
    ip_address = Column(String(50))
    device = Column(String(100))
    browser = Column(String(100))
    
    details = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    admin = relationship("Admin", back_populates="activity_logs")
    session = relationship("UserSession", backref="activity_logs")