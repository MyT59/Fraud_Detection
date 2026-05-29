import uuid
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class RetrainSchedule(Base):
    __tablename__ = "retrain_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    
    name = Column(String(255), nullable=False)
    cron_expr = Column(String(100), nullable=False)
    domain = Column(String(50), nullable=False)
    
    # Otomatis membuat INDEX idx_retrain_schedule_active
    is_active = Column(Boolean, default=True, server_default=text("true"), index=True)
    
    created_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    last_run_status = Column(String(20), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    history_logs = relationship("RetrainHistory", back_populates="schedule", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "cron_expr": self.cron_expr,
            "domain": self.domain,
            "is_active": self.is_active
        }