from datetime import datetime, timezone

from sqlalchemy import (
    Column, BigInteger, Integer, String, Numeric, Boolean, Text,
    DateTime, ForeignKey, Enum, UniqueConstraint, text, Float
)
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.enums import TransactionStatusEnum
from app.infrastructure.database.base import Base

class Transaction(Base):
    __tablename__ = "transactions_feed"

    id = Column(BigInteger, primary_key=True)
    original_trx_id = Column(String(100), nullable=False)
    service_source = Column(String(50), nullable=False)
    user_account_id = Column(String(100), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    transaction_time = Column(DateTime(timezone=True))
    transaction_status = Column(String(100))
    terminal_id = Column(String(100))
    account_number = Column(String(100))
    merchant_id = Column(String(100))
    ip_address = Column(String(50))
    city = Column(String(50))
    country = Column(String(50))
    transaction_details = Column(JSONB)
    anomaly_score = Column(Float)
    risk_score = Column(Float)
    risk_level = Column(String(50))
    score_breakdown = Column(MutableDict.as_mutable(JSONB),default=dict)
    is_flagged_ml = Column(Boolean, default=False, server_default=text("false"))
    violation_reason = Column(Text)
    violation_rule_ids = Column(JSONB)
    violation_pattern_ids = Column(JSONB)
    final_status = Column(
        Enum(TransactionStatusEnum, name="transaction_status_enum"),
        server_default="FLAGGED"
    )
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)) 
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("service_source", "original_trx_id"),
    )

    alerts = relationship("FraudAlert", back_populates="transaction")
    reviews = relationship("ManualReview", back_populates="transaction")
