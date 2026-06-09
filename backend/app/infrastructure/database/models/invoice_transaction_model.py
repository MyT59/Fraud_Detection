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


class InvoiceTransaction(Base):
    __tablename__ = "invoice_transactions"

    id = Column(BigInteger, primary_key=True, index=True)

    no_invoice = Column(String(50), nullable=False)

    tanggal_tagihan = Column(DateTime(timezone=True), nullable=False)

    tanggal_pembayaran = Column(DateTime(timezone=True))

    customer_id = Column(String(50), nullable=False)

    nama_customer = Column(String(100), nullable=False)

    sof = Column(String(50))

    total_tagihan = Column(
        Numeric(15, 2),
        nullable=False
    )

    biaya_admin = Column(
        Numeric(15, 2),
        default=0
    )

    utc_reference = Column(String(100))

    kode_pembayaran = Column(String(50))

    status_tagihan = Column(String(30))

    status_akhir = Column(String(30))

    tanggal_rekon = Column(DateTime(timezone=True))

    keterangan = Column(Text)

    ip_address = Column(String(50))

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    processed_at = Column(DateTime(timezone=True))