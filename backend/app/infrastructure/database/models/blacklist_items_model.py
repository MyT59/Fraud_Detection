from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey, Enum, Index, text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.enums import BlacklistTypeEnum
from app.infrastructure.database.base import Base

class BlacklistItem(Base):
    __tablename__ = "blacklist_items"

    id = Column(Integer, primary_key=True)
    value = Column(String(255), nullable=False, index=True)
    type = Column(Enum(BlacklistTypeEnum, name="blacklist_type_enum"), nullable=False)
    service_scope = Column(String(50), default="ALL", server_default="ALL")
    is_active = Column(Boolean, default=False, server_default=text("false"))
    is_deleted = Column(Boolean, default=False, server_default=text("false"), nullable=False)
    status = Column(String(20), default="PENDING", server_default="PENDING")
    reason = Column(Text, nullable=False)
    review_note = Column(Text, nullable=True)
    added_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    deleted_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    source = Column(String(20), default="MANUAL", server_default="MANUAL")
    hit_count = Column(Integer, default=0, server_default="0")

    __table_args__ = (
        Index(
            "uq_blacklist_type_value_service_active",
            "type",
            "value",
            "service_scope",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )

    admin = relationship("Admin", back_populates="blacklist_items", foreign_keys=[added_by])
    deleted_by_admin = relationship("Admin", foreign_keys=[deleted_by])
