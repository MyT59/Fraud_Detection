from sqlalchemy import Boolean, Column, BigInteger, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.enums import TransactionStatusEnum
from app.infrastructure.database.enums import ReviewDecisionEnum
from app.infrastructure.database.base import Base
from sqlalchemy.dialects.postgresql import JSONB

class ManualReview(Base):
    __tablename__ = "manual_reviews"

    id = Column(BigInteger, primary_key=True)

    transaction_id = Column(BigInteger, ForeignKey("transactions_feed.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    reviewer_name = Column(String(150), nullable=True)
    alert_id = Column(BigInteger, ForeignKey("fraud_alerts.id", ondelete="CASCADE"), unique=True)

    decision = Column(Enum(ReviewDecisionEnum, name="review_decision_enum"), nullable=False)
    decision_confidence = Column(String(20), nullable=True)
    review_note = Column(Text)

    previous_status = Column(String(50))
    final_status = Column(Enum(TransactionStatusEnum, name="transaction_status_enum"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    review_started_at = Column(DateTime(timezone=True))
    review_completed_at = Column(DateTime(timezone=True))
    transaction_snapshot = Column(JSONB)

    version_id = Column(Integer, default=1, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True) # 👈 Tambahan baru
    
    is_overridden = Column(Boolean, default=False, nullable=False)
    overridden_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    overridden_at = Column(DateTime(timezone=True), nullable=True)
    override_reason = Column(Text, nullable=True)

    __mapper_args__ = {
        "version_id_col": version_id
    }

    transaction = relationship("Transaction", back_populates="reviews")
    alert = relationship("FraudAlert")
    admin = relationship("Admin", foreign_keys=[reviewer_id])
    override_admin = relationship("Admin", foreign_keys=[overridden_by])
    deleted_by_admin = relationship("Admin", foreign_keys=[deleted_by])

