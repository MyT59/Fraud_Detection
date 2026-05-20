from sqlalchemy import Column, BigInteger, Enum, Integer, String, Text, DateTime, ForeignKey, text, Float, Boolean
from app.infrastructure.database.enums import AlertStatusEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class FraudAlert(Base):
    __tablename__ = "fraud_alerts"

    id = Column(BigInteger, primary_key=True)

    transaction_id = Column(BigInteger, ForeignKey("transactions_feed.id", ondelete="CASCADE"), nullable=False)

    alert_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)
    priority = Column(Float)

    title = Column(String(150))
    message = Column(Text)

    status = Column(Enum(AlertStatusEnum, name="alert_status_enum"), server_default=AlertStatusEnum.OPEN)
    is_escalated = Column(Boolean, default=False, server_default=text("false"))
    version_id = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)

    __mapper_args__ = {
        "version_id_col": version_id
    }
    claimed_by = Column(
        Integer,
        ForeignKey("admins.id", ondelete="SET NULL"),
        nullable=True
    )
    claimed_at = Column(DateTime(timezone=True), nullable=True)

    claimed_admin = relationship(
    "Admin",
    foreign_keys=[claimed_by]
    )

    resolved_admin = relationship(
        "Admin",
        foreign_keys=[resolved_by]
    )

    transaction = relationship(
        "Transaction",
        back_populates="alerts"
    )

    reviews = relationship(
        "ManualReview",
        back_populates="alert"
    )