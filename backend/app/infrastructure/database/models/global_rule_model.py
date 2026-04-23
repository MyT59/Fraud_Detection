from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class GlobalRule(Base):
    __tablename__ = "global_rules"

    id = Column(Integer, primary_key=True)

    rule_name = Column(String(100), nullable=False)
    rule_key = Column(String(100), unique=True, nullable=False)

    service_scope = Column(String(50), server_default="ALL")

    condition_field = Column(String(100))
    operator = Column(String(20))
    threshold_value = Column(String(100))

    rule_config = Column(JSONB)

    action = Column(String(20), nullable=False)
    severity = Column(String(20), server_default="MEDIUM")
    priority = Column(Integer, server_default="0")

    description = Column(Text)

    is_active = Column(Boolean, default=True, server_default=text("true"))

    created_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    admin = relationship("Admin")