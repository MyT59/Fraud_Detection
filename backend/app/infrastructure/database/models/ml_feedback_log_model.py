from sqlalchemy import Column, BigInteger, Integer, String, Numeric, Boolean, Text, DateTime, Float, func
from sqlalchemy.dialects.postgresql import JSONB
from app.infrastructure.database.base import Base

class MLFeedbackLog(Base):
    __tablename__ = "ml_feedback_logs"

    id = Column(BigInteger, primary_key=True)
    review_id = Column(BigInteger, nullable=True)
    transaction_id = Column(BigInteger, nullable=False)

    # 🔥 100% MIRRORING FITUR TRANSAKSI (Untuk kebutuhan build_features teman ML)
    original_trx_id = Column(String(100), nullable=False)
    service_source = Column(String(50), nullable=False)
    user_account_id = Column(String(100), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    transaction_time = Column(DateTime(timezone=True), nullable=False)
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
    score_breakdown = Column(JSONB)
    is_flagged_ml = Column(Boolean, default=False)
    violation_reason = Column(Text)
    violation_rule_ids = Column(JSONB)
    violation_pattern_ids = Column(JSONB)

    # 🏷️ TARGET LABELS DARI WORKFLOW INVESTIGASI HUMAN
    analyst_decision = Column(String(20), nullable=False)  # SAFE | FRAUD
    decision_confidence = Column(String(20))               # LOW | MEDIUM | HIGH
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())