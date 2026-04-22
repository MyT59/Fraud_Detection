from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey, Enum, UniqueConstraint, text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.enums import BlacklistTypeEnum
from app.infrastructure.database.base import Base

class BlacklistItem(Base):
    __tablename__ = "blacklist_items"

    id = Column(Integer, primary_key=True)

    value = Column(String(100), nullable=False, index=True)
    type = Column(Enum(BlacklistTypeEnum, name="blacklist_type_enum"), nullable=False)

    service_scope = Column(String(50), default="ALL", server_default="ALL")
    is_active = Column(Boolean, default=True, server_default=text("true"))

    reason = Column(Text, nullable=False)

    added_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('type', 'value', 'service_scope', name='uq_blacklist_type_value_service'),
    )

    admin = relationship("Admin", back_populates="blacklist_items")