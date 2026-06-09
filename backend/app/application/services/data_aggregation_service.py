import asyncio
from sqlalchemy.orm import Session

from app.application.services.transaction_service import process_transaction
from app.application.services.ml_realtime_service import process_transaction_ml_async

from app.infrastructure.repositories.switching_log_repository import (
    SwitchingLogRepository
)
from app.infrastructure.repositories.invoice_transaction_repository import (
    InvoiceTransactionRepository
)
from app.application.mappers.agenusa_mapper import map_agenusa
from app.application.mappers.nusabill_mapper import map_nusabill


class DataAggregationService:

    def __init__(self, db: Session):
        self.db = db
        self.switching_repo = SwitchingLogRepository(db)
        self.invoice_repo = InvoiceTransactionRepository(db)

    # ==================================
    # AGENUSA
    # ==================================

    async def process_agenusa(self, limit: int = 500):
        records = self.switching_repo.get_unprocessed(limit=limit)

        processed_ids = []
        ml_tasks = []

        for record in records:
            print("RRN =", record.rrn)
            print("CUS =", record.customer_ref_number)
            print("AMOUNT =", record.amount)
            payload = map_agenusa(record.__dict__)
            print("Payload =", payload)

            trx = process_transaction(payload, self.db)

            if trx:
                processed_ids.append(record.id)
                # Kumpulkan semua ML task, jalankan setelah loop selesai
                ml_tasks.append(
                    process_transaction_ml_async(transaction_id=trx.id)
                )

        self.switching_repo.mark_many_processed(processed_ids)

        # Jalankan semua ML scoring secara concurrent (paralel antar transaksi)
        if ml_tasks:
            await asyncio.gather(*ml_tasks, return_exceptions=True)

        return len(processed_ids)

    # ==================================
    # NUSABILL
    # ==================================

    async def process_nusabill(self, limit: int = 500):
        records = self.invoice_repo.get_unprocessed(limit=limit)

        processed_ids = []
        ml_tasks = []

        for record in records:
            payload = map_nusabill(record.__dict__)
            print("Payload =", payload)

            trx = process_transaction(payload, self.db)

            if trx:
                processed_ids.append(record.id)
                ml_tasks.append(
                    process_transaction_ml_async(transaction_id=trx.id)
                )

        self.invoice_repo.mark_many_processed(processed_ids)

        if ml_tasks:
            await asyncio.gather(*ml_tasks, return_exceptions=True)

        return len(processed_ids)

    # ==================================
    # ALL
    # ==================================

    async def process_all(self):
        agenusa_count = await self.process_agenusa()
        nusabill_count = await self.process_nusabill()

        return {
            "agenusa": agenusa_count,
            "nusabill": nusabill_count,
            "total": agenusa_count + nusabill_count
        }