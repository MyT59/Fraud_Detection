from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.infrastructure.repositories.transaction_repository import (
    TransactionRepository,
)
from app.infrastructure.ml.domain_detector import detect_domain


class TransactionFeatureSnapshotService:
    """
    Backend-side snapshot orchestration service.

    Current responsibility:
    - transaction lookup
    - historical transaction retrieval
    - snapshot payload structure
    - normalized transaction context
    - repository abstraction

    NOT responsible yet for:
    - ML feature engineering
    - anomaly scoring
    - velocity calculation
    - behavioral ML features

    Those will later be handled by ML layer.
    """

    def __init__(self, db: Session):
        self.db = db
        self.transaction_repository = TransactionRepository(db)

    def build_transaction_snapshot(self, transaction_id: int):
        """
        Build normalized realtime transaction snapshot.

        This method prepares historical context for ML inference.
        Actual feature engineering is intentionally NOT implemented yet.
        """

        transaction = self.transaction_repository.get_by_id(transaction_id)

        if not transaction:
            return None

        domain = self._detect_transaction_domain(transaction)

        # =========================================================
        # HISTORICAL CONTEXT LOOKUP
        # =========================================================

        recent_account_transactions = self._get_recent_account_transactions(
            account_number=transaction.account_number,
            limit=10,
        )

        recent_device_transactions = self._get_recent_device_transactions(
            device_id=getattr(transaction, "device_id", None),
            limit=10,
        )

        recent_ip_transactions = self._get_recent_ip_transactions(
            ip_address=getattr(transaction, "ip_address", None),
            limit=10,
        )

        # =========================================================
        # NORMALIZED SNAPSHOT PAYLOAD
        # =========================================================

        snapshot = {
            "transaction": {
                "id": transaction.id,
                "account_number": transaction.account_number,
                "amount": float(transaction.amount or 0),
                "merchant_id": getattr(transaction, "merchant_id", None),
                "terminal_id": getattr(transaction, "terminal_id", None),
                "device_id": getattr(transaction, "device_id", None),
                "ip_address": getattr(transaction, "ip_address", None),
                "transaction_time": getattr(
                    transaction,
                    "transaction_time",
                    None,
                ),
                "service_source": getattr(
                    transaction,
                    "service_source",
                    None,
                ),
                "domain": domain,
            },
            "historical_context": {
                "recent_account_transactions": recent_account_transactions,
                "recent_device_transactions": recent_device_transactions,
                "recent_ip_transactions": recent_ip_transactions,
            },
            "metadata": {
                "snapshot_generated_at": datetime.now(
                    timezone.utc
                ).isoformat(),
                "snapshot_version": "v1",
                "snapshot_type": "REALTIME_CONTEXT",
            },
        }

        return snapshot

    # =============================================================
    # INTERNAL HELPERS
    # =============================================================

    def _detect_transaction_domain(self, transaction):
        """
        Detect normalized ML domain.
        """

        try:
            return detect_domain(
                getattr(transaction, "service_source", None)
            )
        except Exception:
            return "unknown"

    def _get_recent_account_transactions(
        self,
        account_number: str,
        limit: int = 10,
    ):
        """
        Retrieve recent transactions by account.

        NOTE:
        Repository query can later be optimized.
        """

        if not account_number:
            return []

        transactions = (
            self.transaction_repository
            .get_recent_transactions_by_account(
                account_number=account_number,
                limit=limit,
            )
        )

        return [
            self._serialize_transaction(trx)
            for trx in transactions
        ]

    def _get_recent_device_transactions(
        self,
        device_id: str,
        limit: int = 10,
    ):
        """
        Retrieve recent transactions by device.
        """

        if not device_id:
            return []

        if not hasattr(
            self.transaction_repository,
            "get_recent_transactions_by_device",
        ):
            return []

        transactions = (
            self.transaction_repository
            .get_recent_transactions_by_device(
                device_id=device_id,
                limit=limit,
            )
        )

        return [
            self._serialize_transaction(trx)
            for trx in transactions
        ]

    def _get_recent_ip_transactions(
        self,
        ip_address: str,
        limit: int = 10,
    ):
        """
        Retrieve recent transactions by IP address.
        """

        if not ip_address:
            return []

        if not hasattr(
            self.transaction_repository,
            "get_recent_transactions_by_ip",
        ):
            return []

        transactions = (
            self.transaction_repository
            .get_recent_transactions_by_ip(
                ip_address=ip_address,
                limit=limit,
            )
        )

        return [
            self._serialize_transaction(trx)
            for trx in transactions
        ]

    def _serialize_transaction(self, transaction):
        """
        Normalize transaction object.
        """

        return {
            "id": transaction.id,
            "account_number": getattr(
                transaction,
                "account_number",
                None,
            ),
            "amount": float(getattr(transaction, "amount", 0) or 0),
            "transaction_time": getattr(
                transaction,
                "transaction_time",
                None,
            ),
            "merchant_id": getattr(
                transaction,
                "merchant_id",
                None,
            ),
            "terminal_id": getattr(
                transaction,
                "terminal_id",
                None,
            ),
            "device_id": getattr(
                transaction,
                "device_id",
                None,
            ),
            "ip_address": getattr(
                transaction,
                "ip_address",
                None,
            ),
            "risk_score": getattr(
                transaction,
                "risk_score",
                None,
            ),
            "is_flagged_ml": getattr(
                transaction,
                "is_flagged_ml",
                None,
            ),
        }


# ================================================================
# PUBLIC HELPER FUNCTIONS
# ================================================================


def build_transaction_snapshot(
    db: Session,
    transaction_id: int,
):
    """
    Public helper for ML runtime services.
    """

    service = TransactionFeatureSnapshotService(db)

    return service.build_transaction_snapshot(
        transaction_id=transaction_id,
    )