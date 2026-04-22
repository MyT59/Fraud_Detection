from sqlalchemy import Column, BigInteger, Integer, String, Text, DateTime, ForeignKey, text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class FraudAlert(Base):
    __tablename__ = "fraud_alerts"

    id = Column(BigInteger, primary_key=True)

    transaction_id = Column(BigInteger, ForeignKey("transactions_feed.id", ondelete="CASCADE"), nullable=False)

    alert_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)

    title = Column(String(150))
    message = Column(Text)

    status = Column(String(30), server_default="UNREAD")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)

    transaction = relationship("Transaction", back_populates="alerts")
    admin = relationship("Admin")