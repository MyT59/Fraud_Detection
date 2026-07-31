from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.infrastructure.repositories.transaction_repository import (
    TransactionRepository,
)
from app.infrastructure.ml.domain_detector import detect_domain
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)


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

    @log_performance(label="TransactionFeatureSnapshotService.build_transaction_snapshot")
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
        details = transaction.transaction_details or {}

        # =========================================================
        # HISTORICAL CONTEXT LOOKUP
        # =========================================================

        if domain == "agenusa":
            # Agenusa is a mini-ATM/EDC service. Its behavioural baseline
            # belongs to the external bank card, represented by the issuer
            # account number, rather than the app-side account placeholder.
            recent_account_transactions = self._get_recent_issuer_card_transactions(
                issuer_account_number=details.get("issuer_account_number"),
                fallback_account_number=transaction.account_number,
                limit=10,
            )
        elif domain == "nusabill":
            # Invoice payments have no source account number. Their behavioural
            # features (payment gap and channel switch) must use the paying
            # customer's own transaction history instead.
            recent_account_transactions = self._get_recent_customer_transactions(
                customer_id=transaction.user_account_id,
                limit=10,
            )
        else:
            recent_account_transactions = self._get_recent_account_transactions(
                account_number=transaction.account_number,
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
                
                # --- AGENUSA ---
                "response_code": details.get("response_code"),
                "processing_code": details.get("processing_code"),
                "dest_account_number": details.get("dest_account_number"),
                "mti": details.get("mti"),
                
                # --- NUSABILL ---
                "customer_id": getattr(transaction, "user_account_id", None), 
                "bill_date": details.get("bill_date") or getattr(transaction, "transaction_time", None),
                "payment_date": details.get("payment_date") or getattr(transaction, "transaction_time", None),
                "bill_amount": float(details.get("bill_amount") or transaction.amount or 0), 
                "payment_amount": float(details.get("payment_amount") or transaction.amount or 0), 
                "channel": details.get("channel", "API"),
                "bill_status": details.get("bill_status", "terbayar")
            },
            "historical_context": {
                "recent_account_transactions": recent_account_transactions,
            },
            "metadata": {
                "snapshot_generated_at": datetime.now(
                    timezone.utc
                ).isoformat(),
                "snapshot_version": "v1.1", 
                "snapshot_type": "REALTIME_CONTEXT",
            },
        }

        return snapshot

    # =============================================================
    # INTERNAL HELPERS
    # =============================================================
    def _detect_transaction_domain(self, transaction):
        source = (
            getattr(transaction, "service_source", "")
            .strip()
            .lower()
        )

        if source == "agenusa":
            return "agenusa"
        
        if source == "nusabill":
            return "nusabill"
        
        return None

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

    def _get_recent_customer_transactions(
        self,
        customer_id: str,
        limit: int = 10,
    ):
        """Return recent Nusabill payments for the same customer."""
        transactions = self.transaction_repository.get_recent_transactions_by_user_account(
            user_account_id=customer_id,
            service_source="NUSABILL",
            limit=limit,
        )
        return [self._serialize_transaction(trx) for trx in transactions]

    def _get_recent_issuer_card_transactions(
        self,
        issuer_account_number: str | None,
        fallback_account_number: str | None,
        limit: int = 10,
    ):
        """Return Agenusa history by issuer card, with legacy fallback."""
        if issuer_account_number:
            transactions = self.transaction_repository.get_recent_transactions_by_issuer_account(
                issuer_account_number=issuer_account_number,
                limit=limit,
            )
        else:
            transactions = self.transaction_repository.get_recent_transactions_by_account(
                account_number=fallback_account_number,
                limit=limit,
            )
        return [self._serialize_transaction(trx) for trx in transactions]

    def _serialize_transaction(self, transaction):
        """
        Normalize transaction object.
        """

        return {
            "id": transaction.id,
            "account_number": getattr(transaction, "account_number", None),
            "amount": float(getattr(transaction, "amount", 0) or 0),
            "transaction_time": getattr(transaction, "transaction_time", None),
            "merchant_id": getattr(transaction, "merchant_id", None),
            "terminal_id": getattr(transaction, "terminal_id", None),
            "ip_address": getattr(transaction, "ip_address", None),
            "risk_score": getattr(transaction, "risk_score", None),
            "is_flagged_ml": getattr(transaction, "is_flagged_ml", None),
            # Nusabill: dibutuhkan untuk CHANNEL_SWITCH_TO_API feature
            "channel": (getattr(transaction, "transaction_details", None) or {}).get("channel"),
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
