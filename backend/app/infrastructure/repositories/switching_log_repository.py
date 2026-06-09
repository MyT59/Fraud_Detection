from datetime import datetime
from sqlalchemy.orm import Session

from app.infrastructure.database.models.switching_log_model import (
    SwitchingLog
)


class SwitchingLogRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, data: dict) -> SwitchingLog:
        log = SwitchingLog(**data)

        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)

        return log

    def bulk_create(
        self,
        records: list[dict]
    ) -> list[SwitchingLog]:

        logs = [
            SwitchingLog(**record)
            for record in records
        ]

        self.db.add_all(logs)
        self.db.commit()

        return logs

    def get_by_id(
        self,
        log_id: int
    ) -> SwitchingLog | None:

        return (
            self.db.query(SwitchingLog)
            .filter(SwitchingLog.id == log_id)
            .first()
        )

    def get_by_rrn(
        self,
        rrn: str
    ) -> SwitchingLog | None:

        return (
            self.db.query(SwitchingLog)
            .filter(SwitchingLog.rrn == rrn)
            .first()
        )

    def get_latest(
        self,
        limit: int = 100
    ) -> list[SwitchingLog]:

        return (
            self.db.query(SwitchingLog)
            .order_by(SwitchingLog.timestamp_db.desc())
            .limit(limit)
            .all()
        )

    def get_by_customer(
        self,
        customer_ref_number: str,
        limit: int = 100
    ):

        return (
            self.db.query(SwitchingLog)
            .filter(
                SwitchingLog.customer_ref_number
                == customer_ref_number
            )
            .order_by(
                SwitchingLog.timestamp_db.desc()
            )
            .limit(limit)
            .all()
        )

    def get_by_account(
        self,
        account_number: str,
        limit: int = 100
    ):

        return (
            self.db.query(SwitchingLog)
            .filter(
                SwitchingLog.account_number
                == account_number
            )
            .order_by(
                SwitchingLog.timestamp_db.desc()
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
    ) -> list[SwitchingLog]:

        return (
            self.db.query(SwitchingLog)
            .filter(
                SwitchingLog.processed_at.is_(None)
            )
            .order_by(
                SwitchingLog.timestamp_db.asc()
            )
            .limit(limit)
            .all()
        )

    def mark_processed(
        self,
        log_id: int
    ) -> bool:

        log = self.get_by_id(log_id)

        if not log:
            return False

        log.processed_at = datetime.utcnow()

        self.db.commit()

        return True

    def mark_many_processed(
        self,
        ids: list[int]
    ) -> None:

        if not ids:
            return

        (
            self.db.query(SwitchingLog)
            .filter(
                SwitchingLog.id.in_(ids)
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
        log_id: int
    ) -> bool:

        log = self.get_by_id(log_id)

        if not log:
            return False

        self.db.delete(log)
        self.db.commit()

        return True