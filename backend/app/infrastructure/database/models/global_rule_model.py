from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class GlobalRule(Base):
    __tablename__ = "global_rules"

    id = Column(Integer, primary_key=True)

    rule_name = Column(String(100), nullable=False)
    rule_key = Column(String(100), nullable=False)

    service_scope = Column(String(50), server_default="ALL")

    condition_field = Column(String(100))
    operator = Column(String(20))
    threshold_value = Column(String(100))

    rule_config = Column(JSONB)

    action = Column(String(20), nullable=False)
    severity = Column(String(20), server_default="MEDIUM")
    priority = Column(Integer, server_default="0")

    rule_group = Column(String(50), nullable=True)
    hit_count = Column(Integer, default=0, server_default="0")

    description = Column(Text)

    is_active = Column(Boolean, default=True, server_default=text("true"))
    is_deleted = Column(Boolean, default=False, server_default=text("false"), nullable=False)

    created_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    deleted_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    admin = relationship("Admin", foreign_keys=[created_by])
    deleted_by_admin = relationship("Admin", foreign_keys=[deleted_by])

    __table_args__ = (
        Index(
            "uq_global_rules_rule_key_active",
            "rule_key",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )
