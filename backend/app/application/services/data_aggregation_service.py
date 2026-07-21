from sqlalchemy.orm import Session

from app.application.services.transaction_service import process_transaction

from app.infrastructure.repositories.switching_log_repository import SwitchingLogRepository
from app.infrastructure.repositories.invoice_transaction_repository import InvoiceTransactionRepository
from app.application.mappers.agenusa_mapper import map_agenusa
from app.application.mappers.nusabill_mapper import map_nusabill
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)


class DataAggregationService:

    def __init__(self, db: Session):
        self.db           = db
        self.switching_repo = SwitchingLogRepository(db)
        self.invoice_repo   = InvoiceTransactionRepository(db)

    # ==================================
    # AGENUSA
    # ==================================
    @log_performance(label="DataAggregationService.process_agenusa")
    async def process_agenusa(self, limit: int = 500):
        from app.application.services.pattern_engine_service import reset_location_cache
        reset_location_cache()   # ← bersihkan location cache antar batch

        records = self.switching_repo.get_unprocessed(limit=limit)

        processed_ids = []
        for record in records:
            if not record.rrn:
                continue

            payload = map_agenusa(record.__dict__)
            logger.debug(f"[AGENUSA] Processing RRN={record.rrn} amount={record.amount}")

            trx = process_transaction(payload, self.db)

            if trx:
                processed_ids.append(record.id)

        self.switching_repo.mark_many_processed(processed_ids)

        logger.info(f"[AGENUSA] Processed {len(processed_ids)} records")
        return len(processed_ids)

    # ==================================
    # NUSABILL
    # ==================================
    @log_performance(label="DataAggregationService.process_nusabill")
    async def process_nusabill(self, limit: int = 500):
        from app.application.services.pattern_engine_service import reset_location_cache
        reset_location_cache()   # ← bersihkan location cache antar batch

        records = self.invoice_repo.get_unprocessed(limit=limit)

        processed_ids = []
        for record in records:
            if not record.no_invoice:
                continue

            payload = map_nusabill(record.__dict__)
            logger.debug(f"[NUSABILL] Processing INV={record.no_invoice} amount={record.total_tagihan}")

            trx = process_transaction(payload, self.db)

            if trx:
                processed_ids.append(record.id)

        self.invoice_repo.mark_many_processed(processed_ids)

        logger.info(f"[NUSABILL] Processed {len(processed_ids)} records")
        return len(processed_ids)

    # ==================================
    # ALL
    # ==================================
    @log_performance(label="DataAggregationService.process_all")
    async def process_all(self):
        agenusa_count  = await self.process_agenusa()
        nusabill_count = await self.process_nusabill()

        return {
            "agenusa":  agenusa_count,
            "nusabill": nusabill_count,
            "total":    agenusa_count + nusabill_count
        }
