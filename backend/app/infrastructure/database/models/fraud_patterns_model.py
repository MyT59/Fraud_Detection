from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class FraudPattern(Base):
    __tablename__ = "fraud_patterns"

    id = Column(Integer, primary_key=True)

    pattern_name = Column(String(100), nullable=False)

    service_source = Column(String(50), server_default="ALL")
    pattern_type = Column(String(100))

    pattern_rules = Column(JSONB, nullable=False)

    accuracy_score = Column(Float)
    false_positive_rate = Column(Float)

    created_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)

    is_active = Column(Boolean, default=True, server_default=text("true"))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    admin = relationship("Admin")