from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.infrastructure.repositories.transaction_repository import (
    TransactionRepository,
)
from app.application.services.alert_service import create_alert


class MLRealtimeService:
    """
    Backend orchestration skeleton for async ML runtime processing.

    ML logic is intentionally NOT implemented here yet.
    This service currently handles:
    - transaction loading
    - orchestration flow
    - async-ready processing structure
    - transaction ML field updates
    - alert escalation

    Actual ML responsibilities later:
    - realtime feature generation
    - anomaly inference
    - predictor execution
    - score calibration
    - behavioral analysis
    """

    def __init__(self, db: Session):
        self.db = db
        self.transaction_repository = TransactionRepository(db)

    def enqueue_ml_processing(self, transaction_id: int):
        """
        Placeholder enqueue hook.

        Future options:
        - FastAPI BackgroundTasks
        - Celery
        - Redis Queue (later replaced by proper async task queue)
        - Kafka
        - RabbitMQ
        """

        # Temporary direct execution.
        # Replace later with actual async queue.
        self.process_transaction_ml(transaction_id)

    def process_transaction_ml(self, transaction_id: int):
        """
        Async ML processing orchestration.

        Current state:
        - dummy ML result
        - backend orchestration only

        Future ML integration:
        - transaction_feature_snapshot_service
        - predictor.py
        - scoring.py
        """

        transaction = self.transaction_repository.get_by_id(transaction_id)

        if not transaction:
            return None

        # =========================================================
        # TEMPORARY PLACEHOLDER ML RESULT
        # =========================================================
        # Replace later by ML engineer.
        # =========================================================

        ml_score = 0
        is_anomaly = False
        anomaly_reason = None

        # =========================================================
        # UPDATE TRANSACTION ML FIELDS
        # =========================================================

        transaction.unsupervised_score = ml_score
        transaction.is_flagged_ml = is_anomaly

        existing_breakdown = transaction.score_breakdown or {}

        existing_breakdown.update(
            {
                "ml_score": ml_score,
                "ml_processed_at": datetime.now(timezone.utc).isoformat(),
                "ml_runtime_status": "PROCESSED",
                "is_anomaly": is_anomaly,
                "anomaly_reason": anomaly_reason,
            }
        )

        transaction.score_breakdown = existing_breakdown

        # =========================================================
        # ALERT ESCALATION
        # =========================================================
        # Temporary backend orchestration placeholder.
        # ML actual anomaly logic can be connected later.

        anomaly_threshold = 0.8

        if ml_score >= anomaly_threshold:
            is_anomaly = True

        if is_anomaly:
            try:
                create_alert(
                    db=self.db,
                    transaction_id=transaction.id,
                    alert_type="ML_ANOMALY",
                    severity="HIGH",
                    title="ML Anomaly Detected",
                    description=(
                        "Batch/Realtime ML engine detected "
                        "suspicious transaction behavior."
                    ),
                    source="ML_RUNTIME",
                )

                existing_breakdown.update(
                    {
                        "alert_escalated": True,
                        "alert_escalated_at": datetime.now(
                            timezone.utc
                        ).isoformat(),
                    }
                )

            except Exception as e:
                existing_breakdown.update(
                    {
                        "alert_escalation_error": str(e),
                    }
                )

        self.db.commit()
        self.db.refresh(transaction)

        return {
            "transaction_id": transaction.id,
            "ml_score": ml_score,
            "is_anomaly": is_anomaly,
            "status": "processed",
        }


# ================================================================
# HELPER FUNCTIONS
# ================================================================


def enqueue_ml_processing(db: Session, transaction_id: int):
    """
    Public helper used by transaction_service.py
    """

    service = MLRealtimeService(db)
    return service.enqueue_ml_processing(transaction_id)



def process_transaction_ml(db: Session, transaction_id: int):
    """
    Public helper for direct ML runtime execution.
    """

    service = MLRealtimeService(db)
    return service.process_transaction_ml(transaction_id)