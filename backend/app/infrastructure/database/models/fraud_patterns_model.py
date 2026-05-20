from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base


class FraudPattern(Base):
    __tablename__ = "fraud_patterns"

    id = Column(Integer, primary_key=True)

    # BASIC INFO
    pattern_name = Column(String(100), nullable=False)
    service_source = Column(String(50), server_default="ALL")
    pattern_category = Column(String(50))

    # CORE LOGIC
    pattern_rules = Column(JSONB, nullable=False)
    rules_hash = Column(String)

    # NEW: DECISION CONTROL
    action = Column(String(20), server_default="FLAG")  # FLAG | REVIEW | BLOCK
    risk_score = Column(Integer, server_default="50")
    priority = Column(Integer, server_default="1")

    # ANALYTICS
    hit_count = Column(Integer, server_default="0")
    true_positive = Column(Integer, server_default="0") 
    false_positive = Column(Integer, server_default="0")
    accuracy_score = Column(Float)
    false_positive_rate = Column(Float)

    # GOVERNANCE
    created_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, server_default=text("true"))

    # TIMESTAMP
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # RELATION
    admin = relationship("Admin")