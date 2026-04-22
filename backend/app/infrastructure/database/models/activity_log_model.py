from sqlalchemy import Column, BigInteger, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(BigInteger, primary_key=True)

    admin_id = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)

    action_type = Column(String(100), nullable=False)
    target_type = Column(String(100))
    target_id = Column(String(100))
    details = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    admin = relationship("Admin", back_populates="activity_logs")