import asyncio
from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.infrastructure.repositories.transaction_repository import (
    TransactionRepository,
)
from app.infrastructure.database.models.fraud_alert_model import FraudAlert
from app.application.services.transaction_feature_snapshot_service import (
    build_transaction_snapshot,
)
from app.infrastructure.ml.scoring import score_transaction_snapshot
from app.application.services.alert_service import create_alert, format_alert_message
from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.session import SessionLocal
from app.infrastructure.database.enums import (
    ActivityActionEnum,
    SeverityLevelEnum,
    EventSourceEnum,
)
from app.domain.entities.target_type import TargetType
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)


# =====================================================================
# RISK LEVEL → SEVERITY MAPPING (untuk activity log audit trail)
# =====================================================================
_RISK_LEVEL_TO_SEVERITY = {
    "critical": SeverityLevelEnum.CRITICAL,
    "warning": SeverityLevelEnum.WARNING,
    "low": SeverityLevelEnum.INFO,
}


def _log_ml_scoring_activity(db: Session, transaction, scoring_result: dict[str, Any]) -> None:
    """
    Catat hasil ML scoring ke activity_log (immutable audit trail).

    Berbeda dengan transaction.score_breakdown yang bisa ke-overwrite
    saat re-scoring, record di activity_log bersifat append-only —
    sehingga histori "model versi X menilai tx ini = score Y pada waktu Z"
    tetap tersimpan permanen untuk kebutuhan audit forensik.
    """
    risk_level = scoring_result.get("risk_level", "low")
    severity = _RISK_LEVEL_TO_SEVERITY.get(risk_level, SeverityLevelEnum.INFO)

    try:
        log_activity(
            db=db,
            admin=None,
            action_type=ActivityActionEnum.ML_SCORING_COMPLETED,
            module_source=EventSourceEnum.ML,
            severity=severity,
            target_type=TargetType.TRANSACTION,
            target_id=transaction.id,
            details={
                "ml_score": scoring_result.get("score"),
                "is_anomaly": scoring_result.get("is_anomaly"),
                "risk_level": risk_level,
                "patterns": scoring_result.get("patterns", []),
                "domain": scoring_result.get("domain"),
                "model_version": (
                    scoring_result.get("metadata", {}).get("model_version")
                    or scoring_result.get("metadata", {}).get("version")
                ),
                "scored_at": scoring_result.get("metadata", {}).get("scored_at"),
            },
        )
    except Exception as e:
        logger.error(
            f"[ML_REALTIME] tx_id={transaction.id} gagal mencatat activity_log — "
            f"{type(e).__name__}: {e}"
        )

# =====================================================================
# CONCURRENCY LIMITER
# =====================================================================
ML_SEMAPHORE = asyncio.Semaphore(8)


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

    @log_performance(label="MLRealtime.run_ml_scoring_sync")
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
            logger.warning(f"[ML_REALTIME] tx_id={transaction_id} tidak ditemukan — skip scoring")
            return None

        # ===== BUILD SNAPSHOT =====
        # Snapshot berisi: transaction data + historical context
        snapshot = build_transaction_snapshot(self.db, transaction_id)

        if not snapshot:
            logger.warning(f"[ML_REALTIME] tx_id={transaction_id} gagal build snapshot — skip scoring")
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
            logger.error(f"[ML_REALTIME] tx_id={transaction_id} ML scoring error — {type(e).__name__}: {e}")
            return None

    def process_transaction_ml(
        self,
        transaction_id: int,
        force_rescore: bool = False,
    ):
        """
        DEPRECATED: Gunakan process_transaction_ml_async() untuk real-time.

        Synchronous wrapper untuk backward compatibility.
        Fungsi ini akan block sampai ML scoring selesai.

        Untuk production real-time, gunakan:
            await ml_service.process_transaction_ml_async(transaction_id)
        """
        logger.warning(
            f"[ML_REALTIME] process_transaction_ml() is blocking and deprecated. "
            f"Use process_transaction_ml_async() instead. tx_id={transaction_id}"
        )

        # Run async function dalam synchronous context
        # Hanya untuk backward compatibility, bukan untuk production!
        try:
            asyncio.run(
                self.process_transaction_ml_async(
                    transaction_id,
                    force_rescore=force_rescore,
                )
            )
        except RuntimeError:
            # Jika event loop sudah running (misalnya di dalam FastAPI),
            # fallback ke sync version
            self._process_transaction_ml_sync(
                transaction_id,
                force_rescore=force_rescore,
            )

    @log_performance(label="MLRealtime.process_transaction_ml_async")
    async def process_transaction_ml_async(
        self,
        transaction_id: int,
        force_rescore: bool = False,
    ) -> dict[str, Any]:
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
            logger.warning(f"[ML_REALTIME] tx_id={transaction_id} tidak ditemukan — status=not_found")
            return {
                "transaction_id": transaction_id,
                "status": "not_found",
            }

        current_breakdown = dict(transaction.score_breakdown or {})
        if (
            current_breakdown.get("ml_runtime_status") == "PROCESSED"
            and not force_rescore
        ):
            logger.info(
                f"[ML_REALTIME] tx_id={transaction_id} sudah diproses — skip duplicate scoring"
            )
            return {
                "transaction_id": transaction_id,
                "ml_score": current_breakdown.get("ml_score"),
                "is_anomaly": current_breakdown.get("is_anomaly", False),
                "risk_level": current_breakdown.get("risk_level", "low"),
                "patterns": current_breakdown.get("patterns", []),
                "status": "already_processed",
            }

        # ===== RUN ML SCORING (ASYNC, NON-BLOCKING) =====
        logger.info(f"[ML_REALTIME] tx_id={transaction_id} mulai async ML scoring")

        scoring_result = await self._run_ml_scoring(transaction_id)
        logger.debug(f"[ML_REALTIME] tx_id={transaction_id} scoring_result={scoring_result}")

        if not scoring_result:
            logger.error(f"[ML_REALTIME] tx_id={transaction_id} ML scoring gagal — status=ml_error")
            return {
                "transaction_id": transaction_id,
                "status": "ml_error",
            }

        # Another worker may have completed while this worker was scoring.
        self.db.refresh(transaction)
        current_breakdown = dict(transaction.score_breakdown or {})
        if (
            current_breakdown.get("ml_runtime_status") == "PROCESSED"
            and not force_rescore
        ):
            logger.info(
                f"[ML_REALTIME] tx_id={transaction_id} selesai diproses worker lain — skip persist"
            )
            return {
                "transaction_id": transaction_id,
                "ml_score": current_breakdown.get("ml_score"),
                "is_anomaly": current_breakdown.get("is_anomaly", False),
                "risk_level": current_breakdown.get("risk_level", "low"),
                "patterns": current_breakdown.get("patterns", []),
                "status": "already_processed",
            }

        # ===== EXTRACT SCORING RESULTS =====
        ml_score = scoring_result.get("score", 0.0)
        is_anomaly = scoring_result.get("is_anomaly", False)
        risk_level = scoring_result.get("risk_level", "low")
        patterns = scoring_result.get("patterns", [])
        thresholds = scoring_result.get("thresholds", {})

        high_risk_threshold = thresholds.get("high_risk_score_threshold", -0.0009)
        if ml_score <= high_risk_threshold:
            is_anomaly = True
        scoring_result = {**scoring_result, "is_anomaly": is_anomaly}

        # ===== BUILD & PERSIST SELECTED FEATURES INTO transaction_details =====
        # Feature builder returns UPPERCASE keys; pattern engine expects
        # lower-case keys inside transaction.transaction_details (det.get(...)).
        try:
            from app.infrastructure.ml.feature_builder import build_features_from_snapshot

            snapshot = build_transaction_snapshot(self.db, transaction.id)
            if snapshot:
                features = build_features_from_snapshot(snapshot.get("transaction", {}).get("domain"), snapshot)
                # map feature keys (UPPERCASE) -> transaction_details keys (lowercase)
                feature_map = {
                    # Agenusa
                    "IS_NIGHT_TX": "is_night_tx",
                    "AMOUNT_OVER_AVG_RATIO": "amount_over_avg_ratio",
                    "IS_DECLINED": "is_declined",
                    "GAP_MINUTES": "gap_minutes",
                    "DEST_ACCOUNT_NUMBER": "dest_account_number",
                    "TERMINAL_SWITCH_FAST": "terminal_switch_fast",

                    # Nusabill
                    "PAYMENT_GAP_MINUTES": "payment_gap_minutes",
                    "PAYMENT_TO_BILL_RATIO": "payment_to_bill_ratio",
                    "CHANNEL": "channel",
                    "CHANNEL_API_FLAG": "channel_api_flag",
                    "PAYMENT_DELAY_DAYS": "payment_delay_days",
                    "CHANNEL_SWITCH_TO_API": "channel_switch_to_api",
                }

                existing_details = dict(transaction.transaction_details or {})
                for k_src, k_dst in feature_map.items():
                    if k_src in features:
                        # ensure primitive types for JSON storage
                        val = features.get(k_src)
                        if isinstance(val, (int, float, str)) or val is None:
                            existing_details[k_dst] = val
                        else:
                            # cast booleans/np types
                            try:
                                existing_details[k_dst] = int(val)
                            except Exception:
                                existing_details[k_dst] = val

                transaction.transaction_details = existing_details
        except Exception as e:
            logger.exception(f"[ML_REALTIME] tx_id={transaction.id} gagal menyimpan fitur ke transaction_details: {e}")

        # ===== IMMUTABLE AUDIT TRAIL =====
        # Catat hasil scoring ke activity_log (append-only) SEBELUM
        # transaction.score_breakdown di-overwrite, supaya histori
        # keputusan ML per-waktu tetap terjaga untuk audit forensik.
        _log_ml_scoring_activity(self.db, transaction, scoring_result)

        # ===== UPDATE TRANSACTION ML FIELDS =====
        transaction.anomaly_score = ml_score
        transaction.is_flagged_ml = is_anomaly

        existing_breakdown = dict(transaction.score_breakdown or {})
        previous_ml_contribution = float(
            existing_breakdown.pop("ml_risk_contribution", 0) or 0
        )
        if previous_ml_contribution:
            base_risk = max(
                0,
                float(transaction.risk_score or 0) - previous_ml_contribution,
            )
            transaction.risk_score = base_risk
            existing_breakdown["final_score"] = base_risk

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
        if is_anomaly:
            try:
                # Jika ML deteksi anomali dan final_status masih SAFE/FLAGGED,
                # tandai untuk review pasca-transaksi tanpa memblokir transaksi.
                # Jika sudah FRAUD (dari Rule/Pattern), tidak di-downgrade.
                from app.infrastructure.database.enums import TransactionStatusEnum

                current_status = (
                    transaction.final_status.value
                    if hasattr(transaction.final_status, "value")
                    else str(transaction.final_status)
                )

                if current_status in ("SAFE", "FLAGGED", "PENDING", "safe", "flagged", "pending"):
                    transaction.final_status = TransactionStatusEnum.FLAGGED
                    transaction.is_flagged_ml = True

                    # Kontribusikan ML score ke risk_score
                    # Isolation Forest: semakin negatif = semakin anomali
                    # Konversi ke skala 0-100 untuk ditambahkan ke risk_score
                    if risk_level == "critical":
                        ml_risk_contribution = 40
                    elif risk_level == "warning":
                        ml_risk_contribution = 20
                    else:
                        ml_risk_contribution = 10

                    current_risk = float(transaction.risk_score or 0)
                    new_risk = min(100, int(current_risk + ml_risk_contribution))
                    transaction.risk_score = new_risk

                    # Update risk_level jika naik
                    if new_risk >= 80:   transaction.risk_level = "CRITICAL"
                    elif new_risk >= 60: transaction.risk_level = "HIGH"
                    elif new_risk >= 40: transaction.risk_level = "MEDIUM"

                    # Update score_breakdown dengan kontribusi ML
                    existing_breakdown.update({
                        "ml_risk_contribution": ml_risk_contribution,
                        "final_score": new_risk,
                    })

                    logger.info(
                        f"[ML_REALTIME] tx_id={transaction_id} "
                        f"final_status escalation SAFE/FLAGGED -> FLAGGED | "
                        f"risk_score {int(current_risk)} → {new_risk} (+{ml_risk_contribution}) | "
                        f"ML risk_level={risk_level}"
                    )

                # 🔍 Cek apakah alert untuk transaksi ini sudah dibuat oleh engine lain
                existing_alert = (
                    self.db.query(FraudAlert)
                    .filter(FraudAlert.transaction_id == transaction.id)
                    .first()
                )

                if existing_alert:
                    # Jika sudah ada (misal dari Rule/Pattern), naikkan level menjadi COMBINED_ML
                    existing_alert.alert_type = "COMBINED_ML"
                    existing_alert.title = "Fraud & ML Anomaly Detected"
                    existing_alert.message = format_alert_message(transaction.violation_reason)
                    logger.info(f"[ML_REALTIME] tx_id={transaction_id} alert di-upgrade ke COMBINED_ML")
                else:
                    # Jika belum ada alert sama sekali, buat alert baru khusus ML
                    create_alert(
                        db=self.db,
                        trx=transaction,
                        background_tasks=None
                    )
                    logger.info(f"[ML_REALTIME] tx_id={transaction_id} alert ML baru di-escalate")

                synced_alert = self.db.query(FraudAlert).filter(
                    FraudAlert.transaction_id == transaction.id
                ).first()
                if synced_alert:
                    synced_alert.severity = transaction.risk_level or synced_alert.severity
                    synced_alert.priority = max(
                        float(synced_alert.priority or 0), float(transaction.risk_score or 0)
                    )
                    synced_alert.is_escalated = True

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
                logger.error(f"[ML_REALTIME] tx_id={transaction_id} alert escalation error — {type(e).__name__}: {e}")

        transaction.score_breakdown = existing_breakdown

        logger.debug(
            f"[ML_REALTIME] tx_id={transaction_id} before commit — "
            f"anomaly_score={transaction.anomaly_score} is_flagged_ml={transaction.is_flagged_ml} "
            f"score_breakdown={existing_breakdown}"
        )

        self.db.commit()
        self.db.refresh(transaction)

        logger.info(
            f"[ML_REALTIME] tx_id={transaction_id} processing completed — "
            f"score={ml_score:.4f} is_anomaly={is_anomaly} risk_level={risk_level}"
        )

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

    @log_performance(label="MLRealtime.process_transaction_ml_sync")
    def _process_transaction_ml_sync(
        self,
        transaction_id: int,
        force_rescore: bool = False,
    ) -> dict[str, Any]:
        """
        Fallback synchronous version jika asyncio.run() tidak bisa dipakai.

        ⚠️ WARNING: Fungsi ini BLOCKING dan akan freeze event loop!
        Hanya gunakan untuk backward compatibility.
        """
        transaction = self.transaction_repository.get_by_id(transaction_id)

        if not transaction:
            logger.warning(f"[ML_REALTIME][SYNC] tx_id={transaction_id} tidak ditemukan — status=not_found")
            return {
                "transaction_id": transaction_id,
                "status": "not_found",
            }

        current_breakdown = dict(transaction.score_breakdown or {})
        if (
            current_breakdown.get("ml_runtime_status") == "PROCESSED"
            and not force_rescore
        ):
            return {
                "transaction_id": transaction_id,
                "ml_score": current_breakdown.get("ml_score"),
                "is_anomaly": current_breakdown.get("is_anomaly", False),
                "risk_level": current_breakdown.get("risk_level", "low"),
                "patterns": current_breakdown.get("patterns", []),
                "status": "already_processed",
            }

        # ===== RUN ML SCORING SYNCHRONOUSLY (BLOCKING!) =====
        logger.warning(
            f"[ML_REALTIME][SYNC] tx_id={transaction_id} running sync ML scoring — will BLOCK event loop"
        )

        scoring_result = self._run_ml_scoring_sync(transaction_id)

        if not scoring_result:
            logger.error(f"[ML_REALTIME][SYNC] tx_id={transaction_id} ML scoring gagal — status=ml_error")
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

        high_risk_threshold = thresholds.get("high_risk_score_threshold", -0.0009)
        if ml_score <= high_risk_threshold:
            is_anomaly = True
        scoring_result = {**scoring_result, "is_anomaly": is_anomaly}

        # ===== IMMUTABLE AUDIT TRAIL =====
        _log_ml_scoring_activity(self.db, transaction, scoring_result)

        # ===== UPDATE TRANSACTION ML FIELDS =====
        transaction.anomaly_score = ml_score
        transaction.is_flagged_ml = is_anomaly

        existing_breakdown = dict(transaction.score_breakdown or {})

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
        if is_anomaly:
            try:
                # 🔍 Cek apakah alert untuk transaksi ini sudah dibuat oleh engine lain (Sync)
                existing_alert = (
                    self.db.query(FraudAlert)
                    .filter(FraudAlert.transaction_id == transaction.id)
                    .first()
                )

                if existing_alert:
                    existing_alert.alert_type = "COMBINED_ML"
                    existing_alert.title = "Fraud & ML Anomaly Detected"
                    existing_alert.message = format_alert_message(transaction.violation_reason)
                    logger.info(f"[ML_REALTIME][SYNC] tx_id={transaction.id} alert di-upgrade ke COMBINED_ML")
                else:
                    create_alert(
                        db=self.db,
                        trx=transaction,
                        background_tasks=None
                    )
                    logger.info(f"[ML_REALTIME][SYNC] tx_id={transaction.id} alert ML baru di-escalate")

                synced_alert = self.db.query(FraudAlert).filter(
                    FraudAlert.transaction_id == transaction.id
                ).first()
                if synced_alert:
                    synced_alert.severity = transaction.risk_level or synced_alert.severity
                    synced_alert.priority = max(
                        float(synced_alert.priority or 0), float(transaction.risk_score or 0)
                    )
                    synced_alert.is_escalated = True

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
                logger.error(f"[ML_REALTIME][SYNC] tx_id={transaction.id} alert escalation error — {type(e).__name__}: {e}")

        transaction.score_breakdown = existing_breakdown

        logger.debug(
            f"[ML_REALTIME][SYNC] tx_id={transaction_id} before commit — "
            f"anomaly_score={transaction.anomaly_score} is_flagged_ml={transaction.is_flagged_ml} "
            f"score_breakdown={existing_breakdown}"
        )

        self.db.commit()
        self.db.refresh(transaction)

        logger.info(
            f"[ML_REALTIME][SYNC] tx_id={transaction_id} processing completed — "
            f"score={ml_score:.4f} is_anomaly={is_anomaly} risk_level={risk_level}"
        )

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


def process_transaction_ml(
    db: Session,
    transaction_id: int,
    force_rescore: bool = False,
):
    """
    DEPRECATED: Gunakan process_transaction_ml_async().

    Public helper for direct ML runtime execution (blocking).
    """

    service = MLRealtimeService(db)
    return service.process_transaction_ml(transaction_id, force_rescore=force_rescore)


async def process_transaction_ml_async(
    transaction_id: int,
    db: Session = None,
    force_rescore: bool = False,
) -> dict[str, Any]:
    """
    RECOMMENDED: Async ML runtime execution (non-blocking).

    Setiap pemanggilan membuat Session DB sendiri agar aman untuk concurrent
    access (asyncio.gather, background tasks, dll).

    db parameter dipertahankan untuk backward compatibility tapi TIDAK dipakai —
    session selalu dibuat fresh di dalam fungsi ini.

    Semaphore ML_SEMAPHORE membatasi jumlah task yang jalan bersamaan,
    sehingga tidak pernah melebihi pool_size koneksi DB yang tersedia.

    Args:
        transaction_id: ID transaksi untuk di-score
        db: Deprecated, diabaikan. Session dibuat internal.

    Returns:
        Dict hasil ML processing dengan score, risk_level, patterns
    """
    async with ML_SEMAPHORE:
        own_db = SessionLocal()
        try:
            service = MLRealtimeService(own_db)
            return await service.process_transaction_ml_async(
                transaction_id,
                force_rescore=force_rescore,
            )
        finally:
            own_db.close()


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

Setiap step sudah tercatat lewat logger terpusat (app.core.logging.get_logger),
dengan tag berikut di logger "fds" / module path masing-masing:

[ML_REALTIME] tx_id=123 mulai async ML scoring
[ML_REALTIME] tx_id=123 processing completed — score=0.4567 is_anomaly=False risk_level=low
[ML_REALTIME] tx_id=123 alert ML baru di-escalate

Plus [PERF] log otomatis dari @log_performance untuk durasi tiap tahap
(run_ml_scoring_sync, process_transaction_ml_async, dll).

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
