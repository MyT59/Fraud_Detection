from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Text,
    Numeric,
    DateTime
)
from sqlalchemy.sql import func

from app.infrastructure.database.base import Base


class SwitchingLog(Base):
    __tablename__ = "switching_logs"

    id = Column(BigInteger, primary_key=True, index=True)

    rrn = Column(String(30), nullable=False)

    timestamp_db = Column(DateTime(timezone=True), nullable=False)

    mti = Column(String(10))
    msg_raw = Column(Text)

    stan = Column(String(20))

    terminal_id = Column(String(50))
    merchant_id = Column(String(50))

    processing_code = Column(String(20))

    msg_type = Column(String(20))
    response_code = Column(String(20))

    account_number = Column(String(50))
    dest_account_number = Column(String(50))

    customer_ref_number = Column(String(50))

    amount = Column(Numeric(15, 2), nullable=False)

    issuer_bank = Column(String(50))
    dest_bank_code = Column(String(50))
    acquirer_code = Column(String(50))

    issuer_account_number = Column(String(50))

    de7 = Column(String(20))
    de12 = Column(String(20))
    de13 = Column(String(20))

    fep_id = Column(String(50))

    ip_address = Column(String(50))

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    processed_at = Column(DateTime(timezone=True))