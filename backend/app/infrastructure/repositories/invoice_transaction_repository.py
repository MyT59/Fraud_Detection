from datetime import datetime
from sqlalchemy.orm import Session

from app.infrastructure.database.models.invoice_transaction_model import (
    InvoiceTransaction
)


class InvoiceTransactionRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        data: dict
    ) -> InvoiceTransaction:

        invoice = InvoiceTransaction(**data)

        self.db.add(invoice)
        self.db.commit()
        self.db.refresh(invoice)

        return invoice

    def bulk_create(
        self,
        records: list[dict]
    ) -> list[InvoiceTransaction]:

        invoices = [
            InvoiceTransaction(**record)
            for record in records
        ]

        self.db.add_all(invoices)
        self.db.commit()

        return invoices

    def get_by_id(
        self,
        invoice_id: int
    ) -> InvoiceTransaction | None:

        return (
            self.db.query(InvoiceTransaction)
            .filter(
                InvoiceTransaction.id == invoice_id
            )
            .first()
        )

    def get_by_invoice_number(
        self,
        no_invoice: str
    ) -> InvoiceTransaction | None:

        return (
            self.db.query(InvoiceTransaction)
            .filter(
                InvoiceTransaction.no_invoice
                == no_invoice
            )
            .first()
        )

    def get_latest(
        self,
        limit: int = 100
    ):

        return (
            self.db.query(InvoiceTransaction)
            .order_by(
                InvoiceTransaction.tanggal_tagihan.desc()
            )
            .limit(limit)
            .all()
        )

    def get_by_customer(
        self,
        customer_id: str,
        limit: int = 100
    ):

        return (
            self.db.query(InvoiceTransaction)
            .filter(
                InvoiceTransaction.customer_id
                == customer_id
            )
            .order_by(
                InvoiceTransaction.tanggal_tagihan.desc()
            )
            .limit(limit)
            .all()
        )

    # ==========================
    # Aggregator Helpers
    # ==========================

    def get_unprocessed(
        self,
        limit: int = 500
    ):

        return (
            self.db.query(InvoiceTransaction)
            .filter(
                InvoiceTransaction.processed_at.is_(None)
            )
            .order_by(
                InvoiceTransaction.tanggal_tagihan.asc()
            )
            .limit(limit)
            .all()
        )

    def mark_processed(
        self,
        invoice_id: int
    ) -> bool:

        invoice = self.get_by_id(invoice_id)

        if not invoice:
            return False

        invoice.processed_at = datetime.utcnow()

        self.db.commit()

        return True

    def mark_many_processed(
        self,
        ids: list[int]
    ) -> None:

        if not ids:
            return

        (
            self.db.query(InvoiceTransaction)
            .filter(
                InvoiceTransaction.id.in_(ids)
            )
            .update(
                {
                    "processed_at": datetime.utcnow()
                },
                synchronize_session=False
            )
        )

        self.db.commit()

    def delete(
        self,
        invoice_id: int
    ) -> bool:

        invoice = self.get_by_id(invoice_id)

        if not invoice:
            return False

        self.db.delete(invoice)
        self.db.commit()

        return True