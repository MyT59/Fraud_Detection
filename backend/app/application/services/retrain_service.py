import hashlib
import logging
import pandas as pd
import json
import shutil
import uuid
from datetime import datetime, timezone
import os
from pathlib import Path
from typing import Any, Dict, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from fastapi import UploadFile, HTTPException

from app.paths import MODELS_DIR, DATA_DIR

from functools import wraps

logger = logging.getLogger(__name__)

def log_performance(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

from app.infrastructure.ml.domain_detector import detect_domain
from app.infrastructure.ml.feature_builder import build_features
from app.infrastructure.ml.training import train_from_dataframe 
from app.infrastructure.ml.model_loader import DOMAIN_ISO_CONFIG, invalidate_model_cache
from app.infrastructure.database.models.ml_feedback_log_model import MLFeedbackLog
from app.application.services.pattern_discovery_service import PatternDiscoveryService
from app.application.services.dataset_retention_service import DatasetRetentionService

# Models
from app.infrastructure.database.models.retrain_schedule_model import RetrainSchedule
from app.infrastructure.database.models.retrain_history_model import RetrainHistory
from app.infrastructure.database.models.activity_log_model import ActivityLog
from app.infrastructure.database.models.ml_dataset_model import MLDataset
from app.infrastructure.database.models.ml_model_model import MLModel
from app import domain



class RetrainService:
    def __init__(self, db: Session):
        self.db = db
        self.pattern_discovery = PatternDiscoveryService()

    def _acquire_domain_lock(self, domain: str) -> None:
        """Prevent simultaneous retrains for one domain across API workers."""
        if self.db.bind and self.db.bind.dialect.name == "postgresql":
            lock_key = int(hashlib.sha256(f"retrain:{domain}".encode()).hexdigest()[:16], 16)
            if lock_key >= 2**63:
                lock_key -= 2**64
            acquired = self.db.execute(
                text("SELECT pg_try_advisory_xact_lock(:lock_key)"),
                {"lock_key": lock_key},
            ).scalar()
            if not acquired:
                raise HTTPException(
                    status_code=409,
                    detail=f"Retraining {domain} sedang berjalan. Coba lagi setelah proses selesai.",
                )

    @staticmethod
    def _stage_directory(domain: str, version: str) -> Path:
        path = MODELS_DIR / ".staging" / f"{domain}_{version}"
        path.mkdir(parents=True, exist_ok=False)
        return path

    def _promote_staged_model(self, domain: str, training_result: Dict[str, Any]) -> list[tuple[Path, Optional[Path]]]:
        """Atomically replace runtime files, retaining backups until DB commit."""
        backups = []
        try:
            for source_key, target_key in (("model_path", "model_path"), ("meta_path", "meta_path")):
                source = Path(training_result[source_key])
                target = DOMAIN_ISO_CONFIG[domain][target_key]
                target.parent.mkdir(parents=True, exist_ok=True)
                backup = None
                if target.exists():
                    backup = target.with_name(f".{target.name}.{uuid.uuid4().hex}.bak")
                    shutil.copy2(target, backup)
                os.replace(source, target)
                backups.append((target, backup))
        except Exception:
            self._restore_promoted_model(backups)
            raise
        return backups

    @staticmethod
    def _restore_promoted_model(backups: list[tuple[Path, Optional[Path]]]) -> None:
        for target, backup in reversed(backups):
            if backup and backup.exists():
                os.replace(backup, target)
            elif target.exists():
                target.unlink()

    @staticmethod
    def _discard_model_backups(backups: list[tuple[Path, Optional[Path]]]) -> None:
        for _, backup in backups:
            if backup and backup.exists():
                backup.unlink()

    def _latest_uploaded_dataset(self, domain: str) -> Optional[MLDataset]:
        return (
            self.db.query(MLDataset)
            .filter(MLDataset.domain == domain, MLDataset.is_archived == False)
            .order_by(MLDataset.created_at.desc())
            .first()
        )

    # ==========================================
    # AUDIT LOG HELPER
    # ==========================================
    def _calculate_sha256(self, file_path: str) -> str:
        """Menghitung SHA256 checksum dari sebuah file untuk mencegah duplikasi."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def _log_activity(self, admin_id: Optional[int], action: str, target_type: str, target_id: str, details: str = ""):
        """Mencatat aktivitas admin ke tabel activity_logs."""
        if not admin_id:
            return
        
        new_log = ActivityLog(
            admin_id=admin_id,
            action_type=action,
            target_type=target_type,
            target_id=str(target_id),
            details=details
        )
        self.db.add(new_log)

    def _register_model(
        self,
        domain: str,
        model_path: str,
        anomalies_found: int,
        total_records: int,
        training_meta: dict = None,
        version_name: str | None = None,
    ) -> MLModel:
        """Stage model activation in the current transaction without committing it."""
        
        self.db.query(MLModel).filter(
            MLModel.target_service == domain,
            MLModel.is_active == True
        ).update({"is_active": False})

        contamination = (training_meta or {}).get(
            "contamination",
            DOMAIN_ISO_CONFIG.get(domain, {}).get("contamination", 0.05),
        )
        anomaly_rate = round(anomalies_found / total_records, 4) if total_records > 0 else 0.0
        
        # Ambil thresholds dari meta training jika tersedia
        thresholds = {}
        if training_meta and "thresholds" in training_meta:
            thresholds = training_meta["thresholds"]
        elif training_meta and "meta" in training_meta and "thresholds" in training_meta["meta"]:
            thresholds = training_meta["meta"]["thresholds"]

        version_str = version_name or f"{domain}_v{datetime.now().strftime('%Y%m%d%H%M%S%f')}"

        new_model = MLModel(
            version_name=version_str,
            target_service=domain,
            file_path=model_path,
            # Model hanya diregistrasikan setelah artefak training berhasil dibuat,
            # sehingga versi baru menjadi model aktif dalam transaksi retrain ini.
            is_active=True,
            metrics={
                "algorithm": "IsolationForest",
                "training_samples": total_records,
                "anomalies_detected": anomalies_found,
                "anomaly_rate": anomaly_rate,
                "contamination_rate": contamination,
                "thresholds": thresholds,
            }
        )

        self.db.add(new_model)
        try:
            self.db.flush()
        except IntegrityError:
            logger.exception("Model registration failed due to an integrity constraint")
            raise

        return new_model

    @staticmethod
    def _feedback_to_training_row(feedback: MLFeedbackLog) -> Dict[str, Any]:
        """Build a training row from the columns available on MLFeedbackLog."""
        row = dict(feedback.transaction_details or {})
        excluded = {
            "id",
            "review_id",
            "transaction_id",
            "transaction_details",
            "score_breakdown",
            # Audit/detection output, not raw transaction features. These values
            # are JSON arrays and cannot be used as categorical model inputs.
            "violation_rule_ids",
            "violation_pattern_ids",
            "is_used_for_training",
            "created_at",
        }
        for column in feedback.__table__.columns:
            if column.name not in excluded:
                row[column.name] = getattr(feedback, column.name)
        return row

    @staticmethod
    def _sanitize_training_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        """Make JSON-like cells safe for sklearn categorical preprocessing."""
        sanitized = df.copy()

        def normalize(value: Any) -> Any:
            if isinstance(value, (list, tuple, set, dict)):
                return json.dumps(value, sort_keys=True, default=str)
            return value

        for column in sanitized.columns:
            if sanitized[column].dtype == "object":
                sanitized[column] = sanitized[column].map(normalize)
        return sanitized

    @staticmethod
    def _deduplicate_feedback_by_transaction(feedbacks: List[MLFeedbackLog]) -> List[MLFeedbackLog]:
        """Keep the newest feedback per transaction (query must be newest first)."""
        unique_feedbacks = []
        seen_transaction_ids = set()
        for feedback in feedbacks:
            transaction_id = feedback.transaction_id
            if transaction_id in seen_transaction_ids:
                continue
            seen_transaction_ids.add(transaction_id)
            unique_feedbacks.append(feedback)
        return unique_feedbacks

    @staticmethod
    def _partition_feedback_for_retrain(feedbacks: List[MLFeedbackLog]) -> Dict[str, List[MLFeedbackLog]]:
        """Select cumulative SAFE rows and newly processable FRAUD rows."""
        unique_feedbacks = RetrainService._deduplicate_feedback_by_transaction(feedbacks)
        safe_feedbacks = [
            feedback for feedback in unique_feedbacks
            if str(feedback.analyst_decision).upper() == "SAFE"
        ]
        fraud_feedbacks = [
            feedback for feedback in unique_feedbacks
            if str(feedback.analyst_decision).upper() == "FRAUD"
            and not feedback.is_used_for_training
        ]
        newly_processed_feedbacks = [
            feedback for feedback in feedbacks
            if not feedback.is_used_for_training
        ]
        new_safe_feedbacks = [
            feedback for feedback in safe_feedbacks
            if not feedback.is_used_for_training
        ]
        return {
            "safe_feedbacks": safe_feedbacks,
            "fraud_feedbacks": fraud_feedbacks,
            "newly_processed_feedbacks": newly_processed_feedbacks,
            "new_safe_feedbacks": new_safe_feedbacks,
        }
    
    # ==========================================
    # SCHEDULE CRUD OPERATIONS
    # ==========================================
    @log_performance
    def get_all_schedules(self) -> List[RetrainSchedule]:
        return (
            self.db.query(RetrainSchedule)
            .filter(RetrainSchedule.is_deleted == False)
            .order_by(RetrainSchedule.created_at.desc())
            .all()
        )
    
    @log_performance
    def get_schedule_by_id(self, schedule_id: uuid.UUID) -> Optional[RetrainSchedule]:
        return (
            self.db.query(RetrainSchedule)
            .filter(
                RetrainSchedule.id == schedule_id,
                RetrainSchedule.is_deleted == False,
            )
            .first()
        )

    @log_performance
    def create_schedule(self, data: Dict[str, Any], admin_id: int) -> RetrainSchedule:
        new_schedule = RetrainSchedule(
            name=data.get("name"),
            cron_expr=data.get("cron_expr"),
            domain=data.get("domain", "auto_detect"),
            is_active=data.get("is_active", True),
            created_by=admin_id
        )
        self.db.add(new_schedule)
        self.db.flush() 

        self._log_activity(
            admin_id=admin_id,
            action="CREATE_RETRAIN_SCHEDULE",
            target_type="RETRAIN_SCHEDULE",
            target_id=new_schedule.id,
            details=f"Membuat jadwal: {new_schedule.name} ({new_schedule.cron_expr})"
        )
        
        self.db.commit()
        self.db.refresh(new_schedule)
        return new_schedule

    @log_performance
    def update_schedule(self, schedule_id: uuid.UUID, data: Dict[str, Any], admin_id: int) -> Optional[RetrainSchedule]:
        schedule = self.get_schedule_by_id(schedule_id)
        if not schedule:
            return None

        schedule.name = data.get("name", schedule.name)
        schedule.cron_expr = data.get("cron_expr", schedule.cron_expr)
        schedule.domain = data.get("domain", schedule.domain)
        if "is_active" in data:
            schedule.is_active = data["is_active"]

        self._log_activity(
            admin_id=admin_id,
            action="UPDATE_RETRAIN_SCHEDULE",
            target_type="RETRAIN_SCHEDULE",
            target_id=schedule_id,
            details=f"Mengupdate detail jadwal: {schedule.name}"
        )

        self.db.commit()
        self.db.refresh(schedule)
        return schedule

    @log_performance
    def toggle_schedule_status(self, schedule_id: uuid.UUID, is_active: bool, admin_id: int) -> Optional[RetrainSchedule]:
        schedule = self.get_schedule_by_id(schedule_id)
        if not schedule:
            return None

        schedule.is_active = is_active
        action_name = "ACTIVATE" if is_active else "DEACTIVATE"

        self._log_activity(
            admin_id=admin_id,
            action=f"{action_name}_RETRAIN_SCHEDULE",
            target_type="RETRAIN_SCHEDULE",
            target_id=schedule_id,
            details=f"Mengubah status jadwal '{schedule.name}' menjadi {'Aktif' if is_active else 'Non-Aktif'}"
        )

        self.db.commit()
        return schedule

    @log_performance
    def delete_schedule(self, schedule_id: uuid.UUID, admin_id: int) -> bool:
        schedule = self.get_schedule_by_id(schedule_id)
        if not schedule:
            return False

        name_copy = schedule.name
        schedule.is_active = False
        schedule.is_deleted = True
        schedule.deleted_at = datetime.now(timezone.utc)
        schedule.deleted_by = admin_id

        self._log_activity(
            admin_id=admin_id,
            action="DELETE_RETRAIN_SCHEDULE",
            target_type="RETRAIN_SCHEDULE",
            target_id=schedule_id,
            details=f"Soft delete jadwal retrain: {name_copy}"
        )

        self.db.commit()
        return True

    # ==========================================
    # CORE ML OPERATIONS
    # ==========================================
    async def upload_and_train(self, file: UploadFile, domain: str = "auto_detect", admin_id: Optional[int] = None):
        """
        Refactored: Menangani alur lengkap upload, training, registrasi model, 
        dan pembersihan dataset lama (MLOps lifecycle).
        """
        temp_id = uuid.uuid4().hex[:8]
        safe_filename = Path(file.filename or "dataset.csv").name
        file_path = DATA_DIR / f"upload_{temp_id}_{safe_filename}"
        
        # 1. Simpan file fisik
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(file_path)
        if file_size == 0:
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="File CSV kosong.")
        if file_size > 25 * 1024 * 1024:
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=413, detail="Ukuran CSV maksimal 25 MB.")
        file_checksum = self._calculate_sha256(str(file_path))
        
        # 2. Cek apakah dataset sudah pernah diupload (deduplikasi)
        existing_dataset = self.db.query(MLDataset).filter(MLDataset.checksum_sha256 == file_checksum).first()
        
        try:
            df = pd.read_csv(file_path)
        except Exception as exc:
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail=f"CSV tidak dapat dibaca: {exc}")
        if df.empty:
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="CSV tidak memiliki baris data.")
        row_count = len(df)
        detected_domain = detect_domain(df.columns.tolist())
        if not detected_domain:
            file_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=400,
                detail="Header CSV tidak cocok dengan format Agenusa atau Nusabill.",
            )

        if existing_dataset:
            dataset_record = existing_dataset
            domain = existing_dataset.domain
            os.remove(file_path) # Hapus file temp karena sudah ada di sistem
        else:
            # Auto-detect domain jika diminta; domain eksplisit harus cocok dengan header.
            if domain == "auto_detect":
                domain = detected_domain
            elif domain not in DOMAIN_ISO_CONFIG or domain != detected_domain:
                file_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=400,
                    detail=f"Header CSV terdeteksi sebagai {detected_domain}, bukan {domain}.",
                )

            # Registrasi dataset baru
            dataset_record = MLDataset(
                domain=domain, 
                file_name=safe_filename,
                file_path=str(file_path),
                checksum_sha256=file_checksum, 
                file_size_bytes=file_size,
                row_count=row_count, 
                uploaded_by=admin_id, 
                is_used_for_training=True
            )
            self.db.add(dataset_record)
            self.db.flush() # Ambil ID dataset untuk history nanti

        promotion_backups = []
        stage_dir = None
        transaction_committed = False
        try:
            self._acquire_domain_lock(domain)
            # 3. Eksekusi Training Logic
            feature_df = build_features(domain=domain, df=df)
            # Ambil nilai contamination sesuai domain
            contamination = DOMAIN_ISO_CONFIG[domain]["contamination"]
            model_version = f"{domain}_v{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
            stage_dir = self._stage_directory(domain, model_version)
            training_result = train_from_dataframe(
                domain=domain,
                df=feature_df, 
                contamination=contamination,
                output_dir=stage_dir,
                model_version=model_version,
            )
            
            # Pattern Discovery
            new_patterns_count = self.pattern_discovery.extract_and_save_patterns(
                self.db, domain, training_result["anomaly_df"]
            )

            # 4. Registrasi Model Baru (dengan Race Condition Safety & Active Switching)
            new_model = self._register_model(
                domain=domain,
                model_path=str(DOMAIN_ISO_CONFIG[domain]["model_path"]),
                anomalies_found=training_result["anomalies_found"],
                total_records=row_count,
                training_meta=training_result.get("meta"),
                version_name=model_version,
            )

            # 5. Catat History (Menggunakan model_id dan dataset_id yang baru)
            self._record_history(
                schedule_id=None, 
                trigger_source="manual_upload", 
                status="SUCCESS",
                details={
                    "anomalies_found": training_result["anomalies_found"],
                    "new_patterns_discovered": new_patterns_count,
                    "model_path": training_result["model_path"],
                    "model_version": model_version,
                },
                admin_id=admin_id, 
                dataset_id=dataset_record.id, 
                model_id=new_model.id
            )

            # 6. Bonus: Cleanup & Retention Policy Otomatis
            from app.application.services.dataset_retention_service import DatasetRetentionService
            # Do not let retention commit the model transaction prematurely.
            # Promote staged files immediately before the single DB commit.
            promotion_backups = self._promote_staged_model(domain, training_result)
            self.db.commit()
            transaction_committed = True
            self._discard_model_backups(promotion_backups)
            if stage_dir.exists():
                shutil.rmtree(stage_dir, ignore_errors=True)
            invalidate_model_cache(domain)
            try:
                retention_result = DatasetRetentionService(self.db).cleanup_old_datasets(
                    keep_latest=3, older_than_days=30, remove_files=False
                )
            except Exception as retention_error:
                logger.warning("Dataset retention gagal setelah retrain: %s", retention_error)
                retention_result = {"error": str(retention_error)}
            
            return {
                "status": "success", 
                "model_version": new_model.version_name, 
                "domain": domain,
                "total_records_trained": row_count,
                "anomalies_found": training_result["anomalies_found"],
                "new_patterns_discovered": new_patterns_count,
                "cleanup": retention_result
            }

        except HTTPException:
            if not transaction_committed:
                self.db.rollback()
            if promotion_backups and not transaction_committed:
                self._restore_promoted_model(promotion_backups)
            if stage_dir and stage_dir.exists():
                shutil.rmtree(stage_dir, ignore_errors=True)
            raise
        except Exception as e:
            if not transaction_committed:
                self.db.rollback() # Membatalkan dataset baru jika belum di-commit
            if promotion_backups and not transaction_committed:
                self._restore_promoted_model(promotion_backups)
            if stage_dir and stage_dir.exists():
                shutil.rmtree(stage_dir, ignore_errors=True)
            
            # Catat kegagalan ke history jika dataset sudah terdaftar
            if 'dataset_record' in locals() and not transaction_committed:
                # Jika existing_dataset bernilai None, artinya ini dataset baru yang ikut terhapus saat rollback.
                # Harus menset ID menjadi None agar tidak melanggar Foreign Key constraint database.
                is_new_dataset = existing_dataset is None if 'existing_dataset' in locals() else True
                actual_dataset_id = None if is_new_dataset else dataset_record.id

                self._record_history(
                    schedule_id=None, 
                    trigger_source="manual_upload", 
                    status="FAILED",
                    details={"error": str(e)}, 
                    admin_id=admin_id, 
                    dataset_id=actual_dataset_id # 
                )
                self.db.commit()
            raise HTTPException(status_code=500, detail=f"Training gagal: {str(e)}")

    @log_performance
    def execute_retrain(
        self,
        domain: str,
        schedule_id: Optional[Any] = None,
        trigger_source: str = "MANUAL",
        admin_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Main entry point untuk menjalankan proses retraining dengan data bersih.
        """
        start_time = datetime.now()
        promotion_backups = []
        stage_dir = None
        transaction_committed = False

        try:
            domain = domain.lower()
            if domain not in DOMAIN_ISO_CONFIG:
                raise HTTPException(status_code=400, detail=f"Domain tidak dikenal: {domain}")
            self._acquire_domain_lock(domain)

            # Dataset upload terbaru diprioritaskan; baseline dipakai hanya bila belum ada upload.
            dataset_record = self._latest_uploaded_dataset(domain)
            baseline_path = DATA_DIR / f"{domain}_isolation_dataset.csv"
            source_path = Path(dataset_record.file_path) if dataset_record else baseline_path
            if not source_path.exists():
                raise HTTPException(status_code=404, detail="Dataset training CSV tidak ditemukan")
            df_base = pd.read_csv(source_path)
            if df_base.empty:
                raise HTTPException(status_code=400, detail="Dataset training tidak boleh kosong")

            # Rebuild selalu dimulai dari baseline upload, jadi seluruh feedback SAFE
            # tervalidasi perlu digabung kembali agar pembelajaran normal lama tidak hilang.
            # Query diurutkan terbaru agar bila transaksi pernah direview ulang, keputusan
            # terbarunya yang dipakai untuk data training.
            all_feedbacks = self.db.query(MLFeedbackLog).filter(
                MLFeedbackLog.service_source == domain.upper(),
            ).order_by(
                MLFeedbackLog.created_at.desc(),
                MLFeedbackLog.id.desc(),
            ).all()
            # Isolation Forest hanya belajar baseline normal. Feedback SAFE bersifat
            # kumulatif; feedback FRAUD tidak boleh masuk fit model.
            feedback_partition = self._partition_feedback_for_retrain(all_feedbacks)
            safe_feedbacks = feedback_partition["safe_feedbacks"]
            # Fraud discovery hanya memproses feedback baru. Ini menjaga audit flag
            # is_used_for_training tetap bermakna dan menghindari discovery berulang.
            fraud_feedbacks = feedback_partition["fraud_feedbacks"]
            newly_processed_feedbacks = feedback_partition["newly_processed_feedbacks"]
            new_safe_feedbacks = feedback_partition["new_safe_feedbacks"]
            if safe_feedbacks:
                df_feedback = pd.DataFrame([self._feedback_to_training_row(fb) for fb in safe_feedbacks])
                df_combined = pd.concat([df_base, df_feedback], ignore_index=True)
            else:
                df_combined = df_base.copy()

            df_combined = self._sanitize_training_dataframe(df_combined)
            df_combined.columns = df_combined.columns.str.lower()
            df_combined = df_combined.loc[:, ~df_combined.columns.duplicated()]
            feature_df = build_features(domain, df_combined)
            feature_df.columns = feature_df.columns.str.upper()

            model_version = f"{domain}_v{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
            stage_dir = self._stage_directory(domain, model_version)
            training_result = train_from_dataframe(
                domain=domain,
                df=feature_df,
                contamination=DOMAIN_ISO_CONFIG[domain]["contamination"],
                model_version=model_version,
                output_dir=stage_dir,
            )

            # Discovery dari anomali model tetap dipertahankan untuk menangkap
            # outlier pada baseline/dataset.
            model_anomaly_patterns = self.pattern_discovery.extract_and_save_patterns(
                self.db, domain, training_result["anomaly_df"]
            )

            # Feedback FRAUD yang telah diverifikasi analyst menjadi sumber
            # discovery tersendiri. Data ini tidak masuk ke fit Isolation Forest,
            # tetapi feature builder yang sama dipakai agar aturan kandidat tetap
            # kompatibel dengan runtime pattern engine.
            fraud_feedback_patterns = 0
            if fraud_feedbacks:
                fraud_df = pd.DataFrame([
                    self._feedback_to_training_row(feedback)
                    for feedback in fraud_feedbacks
                ])
                fraud_df = self._sanitize_training_dataframe(fraud_df)
                fraud_df.columns = fraud_df.columns.str.lower()
                fraud_df = fraud_df.loc[:, ~fraud_df.columns.duplicated()]
                fraud_feature_df = build_features(domain, fraud_df)
                fraud_feature_df.columns = fraud_feature_df.columns.str.upper()
                fraud_feedback_patterns = self.pattern_discovery.extract_and_save_patterns(
                    self.db, domain, fraud_feature_df
                )

            new_patterns_count = model_anomaly_patterns + fraud_feedback_patterns

            # Hanya tandai selesai setelah training dan dua jalur discovery sukses.
            # Flag ini menjadi jejak audit; SAFE yang sudah pernah dipakai tetap ikut
            # pada retrain berikutnya karena model dibangun ulang dari baseline.
            for feedback in newly_processed_feedbacks:
                feedback.is_used_for_training = True

            new_model = self._register_model(
                domain=domain,
                model_path=str(DOMAIN_ISO_CONFIG[domain]["model_path"]),
                anomalies_found=training_result.get("anomalies_found", 0),
                total_records=len(df_combined),
                training_meta=training_result.get("meta"),
                version_name=model_version,
            )
            details = {
                "status": "success",
                "domain": domain,
                "dataset_source": "uploaded" if dataset_record else "baseline",
                "total_records_trained": len(df_combined),
                "feedback_records_used": len(safe_feedbacks),
                "cumulative_safe_feedback_records": len(safe_feedbacks),
                "new_safe_feedback_records": len(new_safe_feedbacks),
                "fraud_feedback_discovered": len(fraud_feedbacks),
                "fraud_feedback_excluded_from_ml": len(fraud_feedbacks),
                "anomalies_found": training_result.get("anomalies_found", 0),
                "new_patterns_discovered": new_patterns_count,
                "patterns_from_model_anomalies": model_anomaly_patterns,
                "patterns_from_fraud_feedback": fraud_feedback_patterns,
                "model_version": model_version,
                "duration_seconds": (datetime.now() - start_time).total_seconds(),
            }
            self._record_history(
                schedule_id=schedule_id,
                trigger_source=trigger_source,
                status="SUCCESS",
                details=details,
                admin_id=admin_id,
                model_id=new_model.id,
                dataset_id=dataset_record.id if dataset_record else None,
            )

            promotion_backups = self._promote_staged_model(domain, training_result)
            self.db.commit()
            transaction_committed = True
            self._discard_model_backups(promotion_backups)
            if stage_dir.exists():
                shutil.rmtree(stage_dir, ignore_errors=True)
            invalidate_model_cache(domain)
            return details

        except HTTPException:
            if not transaction_committed:
                self.db.rollback()
            if promotion_backups and not transaction_committed:
                self._restore_promoted_model(promotion_backups)
            if stage_dir and stage_dir.exists():
                shutil.rmtree(stage_dir, ignore_errors=True)
            raise
        except Exception as e:
            if not transaction_committed:
                self.db.rollback()
            if promotion_backups and not transaction_committed:
                self._restore_promoted_model(promotion_backups)
            if stage_dir and stage_dir.exists():
                shutil.rmtree(stage_dir, ignore_errors=True)
            if transaction_committed:
                logger.exception("Error setelah retrain berhasil dikomit: %s", e)
                return details
            self._record_history(
                schedule_id=schedule_id,
                trigger_source=trigger_source,
                status="FAILED",
                details={"error": str(e)},
                admin_id=admin_id,
                dataset_id=dataset_record.id if "dataset_record" in locals() and dataset_record else None,
            )
            self.db.commit()
            raise HTTPException(status_code=500, detail=f"Training gagal: {str(e)}")

    # ==========================================
    # INTERNAL HELPERS
    # ==========================================
    def _record_history(self, schedule_id: Any, trigger_source: str, status: str, details: Dict[str, Any], admin_id: Optional[int] = None, dataset_id: Optional[int] = None, model_id: Optional[int] = None):
        """Menyimpan log hasil eksekusi ke tabel retrain_history."""
        history = RetrainHistory(
            schedule_id=schedule_id,
            trigger_source=trigger_source,
            triggered_by=admin_id,
            status=status,
            anomalies_found=details.get("anomalies_found", 0),
            new_patterns_count=details.get("new_patterns_discovered", 0),
            log_details=details,
            model_version=details.get("model_version") or datetime.now().strftime("%Y.%m.%d.%H%M%S%f"),
            dataset_id=dataset_id,
            model_id=model_id
        )
        self.db.add(history)

    def _get_latest_dataset(self, domain: str) -> Optional[Path]:
        dataset_dir = DATA_DIR / "datasets"

        files = list(dataset_dir.glob(f"*{domain}*.csv"))

        if not files:
            return None

        return max(files, key=lambda p: p.stat().st_mtime)
