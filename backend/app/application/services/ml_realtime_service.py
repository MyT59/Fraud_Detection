import asyncio
from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.infrastructure.repositories.transaction_repository import (
    TransactionRepository,
)
from app.application.services.transaction_feature_snapshot_service import (
    build_transaction_snapshot,
)
from app.infrastructure.ml.scoring import score_transaction_snapshot
from app.application.services.alert_service import create_alert


class MLRealtimeService:
    """
    Backend orchestration untuk async ML runtime processing.

    Responsibilities:
    - transaction loading
    - orchestration flow
    - async-ready processing structure
    - transaction ML field updates
    - alert escalation

    ML Pipeline:
    1. Ambil transaction dari DB
    2. Build snapshot (transaction + historical context)
    3. Score snapshot menggunakan Isolation Forest (BLOCKING)
       - WAJIB dibungkus asyncio.to_thread() agar tidak freeze FastAPI
    4. Update transaction dengan score & flags
    5. Escalate alert jika anomaly terdeteksi
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

    # =====================================================================
    # PRIVATE: SYNC BLOCKING ML SCORING
    # =====================================================================
    # Fungsi ini BLOCKING karena scikit-learn Isolation Forest tidak support async.
    # JANGAN panggil langsung dari async context! Gunakan asyncio.to_thread().

    def _run_ml_scoring_sync(
        self,
        transaction_id: int,
    ) -> Optional[dict[str, Any]]:
        """
        Synchronous ML scoring logic (BLOCKING).

        ⚠️ WARNING: Fungsi ini BLOCKING dan akan lock thread selama processing.
        Jangan panggil dari async context tanpa asyncio.to_thread()!

        Proses:
        1. Build snapshot: transaction + historical context
        2. Score snapshot menggunakan Isolation Forest
        3. Return scoring result

        Args:
            transaction_id: ID transaksi untuk di-score

        Returns:
            Dict hasil scoring dari score_transaction_snapshot(),
            atau None jika transaksi tidak ditemukan
        """
        # ===== LOAD TRANSACTION =====
        transaction = self.transaction_repository.get_by_id(transaction_id)

        if not transaction:
            return None

        # ===== BUILD SNAPSHOT =====
        # Snapshot berisi: transaction data + historical context
        snapshot = build_transaction_snapshot(self.db, transaction_id)

        if not snapshot:
            return None

        # ===== RUN ML SCORING (BLOCKING) =====
        # Isolation Forest decision_function bersifat blocking.
        # Panggilan ini akan lock thread sampai selesai.
        scoring_result = score_transaction_snapshot(snapshot)

        return scoring_result

    # =====================================================================
    # PUBLIC: ASYNC ML SCORING WRAPPER
    # =====================================================================

    async def _run_ml_scoring(
        self,
        transaction_id: int,
    ) -> Optional[dict[str, Any]]:
        """
        Async wrapper untuk blocking ML scoring.

        Menggunakan asyncio.to_thread() untuk menjalankan _run_ml_scoring_sync()
        di thread pool terpisah, sehingga tidak freeze event loop FastAPI.

        ⚠️ KRUSIAL: Tanpa asyncio.to_thread(), seluruh aplikasi akan freeze saat ML processing!

        Args:
            transaction_id: ID transaksi untuk di-score

        Returns:
            Dict hasil scoring, atau None jika error
        """
        try:
            # Jalankan blocking function di thread pool
            # Event loop tetap responsive untuk request lain
            scoring_result = await asyncio.to_thread(
                self._run_ml_scoring_sync,
                transaction_id,
            )
            return scoring_result

        except Exception as e:
            print(f"❌ ML scoring error untuk tx {transaction_id}: {str(e)}")
            return None

    def process_transaction_ml(self, transaction_id: int):
        """
        DEPRECATED: Gunakan process_transaction_ml_async() untuk real-time.

        Synchronous wrapper untuk backward compatibility.
        Fungsi ini akan block sampai ML scoring selesai.

        Untuk production real-time, gunakan:
            await ml_service.process_transaction_ml_async(transaction_id)
        """
        print(
            f"⚠️  WARNING: process_transaction_ml() is blocking and deprecated. "
            f"Use process_transaction_ml_async() instead."
        )

        # Run async function dalam synchronous context
        # Hanya untuk backward compatibility, bukan untuk production!
        try:
            asyncio.run(
                self.process_transaction_ml_async(transaction_id)
            )
        except RuntimeError:
            # Jika event loop sudah running (misalnya di dalam FastAPI),
            # fallback ke sync version
            self._process_transaction_ml_sync(transaction_id)

    async def process_transaction_ml_async(self, transaction_id: int) -> dict[str, Any]:
        """
        Async ML processing orchestration (RECOMMENDED).

        Alur:
        1. Load transaction
        2. Run ML scoring (async, non-blocking)
        3. Update transaction dengan score & flags
        4. Trigger alert jika anomaly

        Args:
            transaction_id: ID transaksi untuk di-process

        Returns:
            Dict dengan hasil processing
        """
        transaction = self.transaction_repository.get_by_id(transaction_id)

        if not transaction:
            return {
                "transaction_id": transaction_id,
                "status": "not_found",
            }

        # ===== RUN ML SCORING (ASYNC, NON-BLOCKING) =====
        print(f"🔄 Starting async ML scoring untuk tx {transaction_id}...")

        scoring_result = await self._run_ml_scoring(transaction_id)

        if not scoring_result:
            return {
                "transaction_id": transaction_id,
                "status": "ml_error",
            }

        # ===== EXTRACT SCORING RESULTS =====
        ml_score = scoring_result.get("score", 0.0)
        is_anomaly = scoring_result.get("is_anomaly", False)
        risk_level = scoring_result.get("risk_level", "low")
        patterns = scoring_result.get("patterns", [])
        thresholds = scoring_result.get("thresholds", {})

        # ===== UPDATE TRANSACTION ML FIELDS =====
        transaction.unsupervised_score = ml_score
        transaction.is_flagged_ml = is_anomaly

        existing_breakdown = transaction.score_breakdown or {}

        existing_breakdown.update(
            {
                "ml_score": ml_score,
                "ml_processed_at": datetime.now(timezone.utc).isoformat(),
                "ml_runtime_status": "PROCESSED",
                "is_anomaly": is_anomaly,
                "risk_level": risk_level,
                "patterns": patterns,
                "thresholds": thresholds,
            }
        )

        transaction.score_breakdown = existing_breakdown

        # ===== ALERT ESCALATION =====
        critical_threshold = thresholds.get("critical", 0.7)

        if ml_score >= critical_threshold:
            is_anomaly = True

        if is_anomaly:
            try:
                create_alert(
                    db=self.db,
                    transaction_id=transaction.id,
                    alert_type="ML_ANOMALY",
                    severity="HIGH",
                    title=f"ML Anomaly Detected ({risk_level.upper()})",
                    description=(
                        f"ML engine detected suspicious transaction behavior. "
                        f"Score: {ml_score:.4f}, Risk: {risk_level}, "
                        f"Patterns: {', '.join(patterns) if patterns else 'None'}"
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

                print(f"🚨 Alert escalated untuk tx {transaction_id}")

            except Exception as e:
                existing_breakdown.update(
                    {
                        "alert_escalation_error": str(e),
                    }
                )
                print(f"❌ Alert escalation error: {str(e)}")

        self.db.commit()
        self.db.refresh(transaction)

        print(f"✅ ML processing completed untuk tx {transaction_id}: score={ml_score:.4f}, anomaly={is_anomaly}")

        return {
            "transaction_id": transaction.id,
            "ml_score": ml_score,
            "is_anomaly": is_anomaly,
            "risk_level": risk_level,
            "patterns": patterns,
            "status": "processed",
        }

    # =====================================================================
    # PRIVATE: SYNC FALLBACK (backward compatibility)
    # =====================================================================

    def _process_transaction_ml_sync(self, transaction_id: int) -> dict[str, Any]:
        """
        Fallback synchronous version jika asyncio.run() tidak bisa dipakai.

        ⚠️ WARNING: Fungsi ini BLOCKING dan akan freeze event loop!
        Hanya gunakan untuk backward compatibility.
        """
        transaction = self.transaction_repository.get_by_id(transaction_id)

        if not transaction:
            return {
                "transaction_id": transaction_id,
                "status": "not_found",
            }

        # ===== RUN ML SCORING SYNCHRONOUSLY (BLOCKING!) =====
        print(
            f"⚠️  WARNING: Running sync ML scoring untuk tx {transaction_id}. "
            f"This will BLOCK the event loop!"
        )

        scoring_result = self._run_ml_scoring_sync(transaction_id)

        if not scoring_result:
            return {
                "transaction_id": transaction_id,
                "status": "ml_error",
            }

        # ===== EXTRACT SCORING RESULTS =====
        ml_score = scoring_result.get("score", 0.0)
        is_anomaly = scoring_result.get("is_anomaly", False)
        risk_level = scoring_result.get("risk_level", "low")
        patterns = scoring_result.get("patterns", [])
        thresholds = scoring_result.get("thresholds", {})

        # ===== UPDATE TRANSACTION ML FIELDS =====
        transaction.unsupervised_score = ml_score
        transaction.is_flagged_ml = is_anomaly

        existing_breakdown = transaction.score_breakdown or {}

        existing_breakdown.update(
            {
                "ml_score": ml_score,
                "ml_processed_at": datetime.now(timezone.utc).isoformat(),
                "ml_runtime_status": "PROCESSED",
                "is_anomaly": is_anomaly,
                "risk_level": risk_level,
                "patterns": patterns,
                "thresholds": thresholds,
            }
        )

        transaction.score_breakdown = existing_breakdown

        # ===== ALERT ESCALATION =====
        critical_threshold = thresholds.get("critical", 0.7)

        if ml_score >= critical_threshold:
            is_anomaly = True

        if is_anomaly:
            try:
                create_alert(
                    db=self.db,
                    transaction_id=transaction.id,
                    alert_type="ML_ANOMALY",
                    severity="HIGH",
                    title=f"ML Anomaly Detected ({risk_level.upper()})",
                    description=(
                        f"ML engine detected suspicious transaction behavior. "
                        f"Score: {ml_score:.4f}, Risk: {risk_level}, "
                        f"Patterns: {', '.join(patterns) if patterns else 'None'}"
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
            "risk_level": risk_level,
            "patterns": patterns,
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
    DEPRECATED: Gunakan process_transaction_ml_async().

    Public helper for direct ML runtime execution (blocking).
    """

    service = MLRealtimeService(db)
    return service.process_transaction_ml(transaction_id)


async def process_transaction_ml_async(
    db: Session,
    transaction_id: int,
) -> dict[str, Any]:
    """
    RECOMMENDED: Async ML runtime execution (non-blocking).

    Gunakan ini di FastAPI endpoint untuk non-blocking ML scoring.

    Example dalam FastAPI endpoint:
        @app.post("/api/transactions/{tx_id}/score")
        async def score_transaction(tx_id: int, db: Session = Depends(get_db)):
            result = await process_transaction_ml_async(db, tx_id)
            return result

    Args:
        db: Database session
        transaction_id: ID transaksi untuk di-score

    Returns:
        Dict hasil ML processing dengan score, risk_level, patterns
    """
    service = MLRealtimeService(db)
    return await service.process_transaction_ml_async(transaction_id)


# ================================================================
# USAGE EXAMPLES
# ================================================================
"""
┌─────────────────────────────────────────────────────────────┐
│  ML REALTIME SERVICE - INTEGRATION GUIDE                   │
└─────────────────────────────────────────────────────────────┘

🔥 CRITICAL: ASYNCIO.TO_THREAD() WAJIB DIGUNAKAN!

Masalah:
  - Isolation Forest scikit-learn bersifat BLOCKING (synchronous)
  - Jika tidak dibungkus asyncio.to_thread(), event loop FastAPI AKAN FREEZE
  - Semua request lain akan menunggu sampai ML selesai

Solusi:
  - Gunakan asyncio.to_thread() untuk menjalankan ML di thread pool terpisah
  - Event loop tetap responsive untuk request lain
  - FastAPI tidak akan freeze


█ ===== CONTOH 1: FASTAPI ENDPOINT (RECOMMENDED) =====

from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from app.application.services.ml_realtime_service import process_transaction_ml_async

app = FastAPI()

@app.post("/api/transactions/{tx_id}/score")
async def score_transaction(
    tx_id: int,
    db: Session = Depends(get_db)
):
    \"\"\"
    Real-time ML scoring endpoint.
    
    ✅ Async → asyncio.to_thread() → blocking ML dipindahkan ke thread pool
    ✅ Event loop tetap responsive
    ✅ Multiple requests bisa diproses concurrent
    \"\"\"
    result = await process_transaction_ml_async(db, tx_id)
    return result

# Contoh response:
# {
#     "transaction_id": 123,
#     "ml_score": 0.456789,
#     "is_anomaly": false,
#     "risk_level": "warning",
#     "patterns": ["high_amount_spike"],
#     "status": "processed"
# }


█ ===== CONTOH 2: BACKGROUND TASK (FastAPI) =====

from fastapi import BackgroundTasks

@app.post("/api/transactions")
async def create_transaction(
    transaction_data: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    \"\"\"Queue ML scoring sebagai background task.\"\"\"
    # Create transaction first
    tx = create_transaction_in_db(db, transaction_data)
    
    # Queue ML scoring (non-blocking)
    background_tasks.add_task(
        asyncio.run,
        process_transaction_ml_async(db, tx.id)
    )
    
    return {"transaction_id": tx.id, "status": "queued_for_scoring"}


█ ===== CONTOH 3: CELERY TASK (Future) =====

from celery import shared_task
from app.application.services.ml_realtime_service import process_transaction_ml

@shared_task
def score_transaction_async(transaction_id: int):
    \"\"\"
    Celery task untuk distributed ML scoring.
    Bisa di-scale ke multiple workers.
    \"\"\"
    from app.infrastructure.database import SessionLocal
    db = SessionLocal()
    try:
        result = process_transaction_ml(db, transaction_id)
        return result
    finally:
        db.close()


█ ===== ALUR DATA =====

Transaction Created
         ↓
build_transaction_snapshot()  ← transaction_feature_snapshot_service.py
         ↓
snapshot = {
    "transaction": {...},
    "historical_context": {...}
}
         ↓
asyncio.to_thread(
    _run_ml_scoring_sync()
)
         ↓
build_features_from_snapshot()  ← feature_builder.py
         ↓
score_transaction_snapshot()  ← scoring.py
         ↓
Isolation Forest.predict()  ← scikit-learn (BLOCKING)
         ↓
Update transaction fields
         ↓
Create alert (jika anomaly)
         ↓
Return result


█ ===== MONITORING & LOGGING =====

Setiap step sudah ada logging:

🔄 Starting async ML scoring untuk tx 123...
✅ ML processing completed untuk tx 123: score=0.4567, anomaly=False
🚨 Alert escalated untuk tx 123
✅ Alert escalated untuk tx 123

Untuk debugging:
- Check ml_score di transaction.score_breakdown
- Check is_flagged_ml di transaction
- Check alerts table untuk detail escalation


█ ===== PERFORMANCE TIPS =====

1. Jangan panggil _run_ml_scoring_sync() langsung dari async context!
   ❌ BAD:  await _run_ml_scoring_sync(tx_id)
   ✅ GOOD: await asyncio.to_thread(_run_ml_scoring_sync, tx_id)

2. Gunakan BackgroundTasks atau Queue jika ingin non-blocking:
   background_tasks.add_task(process_transaction_ml, db, tx_id)

3. Monitor thread pool size jika traffic tinggi:
   - Default asyncio.to_thread() gunakan default executor
   - Bisa customize ThreadPoolExecutor ukuran sesuai kebutuhan

4. Set timeout jika ML processing terlalu lama:
   try:
       result = await asyncio.wait_for(
           process_transaction_ml_async(db, tx_id),
           timeout=30.0  # 30 seconds max
       )
   except asyncio.TimeoutError:
       print("ML scoring timeout!")
"""