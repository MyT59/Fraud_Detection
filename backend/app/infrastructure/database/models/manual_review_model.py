from sqlalchemy import Column, BigInteger, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.enums import TransactionStatusEnum
from app.infrastructure.database.base import Base

class ManualReview(Base):
    __tablename__ = "manual_reviews"

    id = Column(BigInteger, primary_key=True)

    transaction_id = Column(BigInteger, ForeignKey("transactions_feed.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)

    decision = Column(String(50), nullable=False)
    review_note = Column(Text)

    previous_status = Column(String(50))
    final_status = Column(Enum(TransactionStatusEnum, name="transaction_status_enum"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("Transaction", back_populates="reviews")
    admin = relationship("Admin")