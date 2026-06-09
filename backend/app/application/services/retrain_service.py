import hashlib
from sqlite3 import IntegrityError
import logging
import pandas as pd
import json
import shutil
import uuid
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, List
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException

from app.paths import MODELS_DIR, DATA_DIR

logger = logging.getLogger(__name__)
from app.infrastructure.ml.domain_detector import detect_domain
from app.infrastructure.ml.feature_builder import build_features
from app.infrastructure.ml.training import train_from_dataframe 
from app.infrastructure.ml.model_loader import load_isolation_model, load_isolation_meta, DOMAIN_ISO_CONFIG
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

    # ==========================================
    # 📝 AUDIT LOG HELPER
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

    def _register_model(self, domain: str, model_path: str, anomalies_found: int, total_records: int) -> MLModel:
        """Helper to handle model versioning, active switching, and metric tracking."""
        
        self.db.query(MLModel).filter(
            MLModel.target_service == domain,
            MLModel.is_active == True
        ).update({"is_active": False})

        contamination = DOMAIN_ISO_CONFIG.get(domain, {}).get("contamination", 0.05)
        
        version_str = f"{domain}_v{datetime.now().strftime('%Y%m%d%H%M%S%f')}"

        new_model = MLModel(
            version_name=version_str,
            target_service=domain,
            file_path=model_path,
            is_active=True,
            metrics={
                "algorithm": "IsolationForest",
                "training_samples": total_records,
                "anomalies_detected": anomalies_found,
                "contamination_rate": contamination
            }
        )

        try:
            self.db.add(new_model)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            
            unique_version = f"{domain}_v{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
            new_model.version_name = unique_version
            
            self.db.add(new_model)
            self.db.commit()
            
        self.db.refresh(new_model)
        return new_model
    
    # ==========================================
    # 📅 SCHEDULE CRUD OPERATIONS
    # ==========================================
    def get_all_schedules(self) -> List[RetrainSchedule]:
        return self.db.query(RetrainSchedule).order_by(RetrainSchedule.created_at.desc()).all()
    
    def get_schedule_by_id(self, schedule_id: uuid.UUID) -> Optional[RetrainSchedule]:
        return (
            self.db.query(RetrainSchedule)
            .filter(RetrainSchedule.id == schedule_id)
            .first()
        )

    def create_schedule(self, data: Dict[str, Any], admin_id: int) -> RetrainSchedule:
        new_schedule = RetrainSchedule(
            name=data.get("name"),
            cron_expr=data.get("cron_expr"),
            domain=data.get("domain", "auto_detect"),
            is_active=True,
            created_by=admin_id
        )
        self.db.add(new_schedule)
        self.db.flush() # Ambil ID sebelum commit

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

    def update_schedule(self, schedule_id: uuid.UUID, data: Dict[str, Any], admin_id: int) -> Optional[RetrainSchedule]:
        schedule = self.db.query(RetrainSchedule).filter(RetrainSchedule.id == schedule_id).first()
        if not schedule:
            return None

        schedule.name = data.get("name", schedule.name)
        schedule.cron_expr = data.get("cron_expr", schedule.cron_expr)
        schedule.domain = data.get("domain", schedule.domain)

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

    def toggle_schedule_status(self, schedule_id: uuid.UUID, is_active: bool, admin_id: int) -> Optional[RetrainSchedule]:
        schedule = self.db.query(RetrainSchedule).filter(RetrainSchedule.id == schedule_id).first()
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

    def delete_schedule(self, schedule_id: uuid.UUID, admin_id: int) -> bool:
        schedule = self.db.query(RetrainSchedule).filter(RetrainSchedule.id == schedule_id).first()
        if not schedule:
            return False

        name_copy = schedule.name
        self.db.delete(schedule)

        self._log_activity(
            admin_id=admin_id,
            action="DELETE_RETRAIN_SCHEDULE",
            target_type="RETRAIN_SCHEDULE",
            target_id=schedule_id,
            details=f"Menghapus jadwal retrain: {name_copy}"
        )

        self.db.commit()
        return True

    # ==========================================
    # 🚀 CORE ML OPERATIONS
    # ==========================================
    async def upload_and_train(self, file: UploadFile, domain: str = "auto_detect", admin_id: Optional[int] = None):
        """
        Refactored: Menangani alur lengkap upload, training, registrasi model, 
        dan pembersihan dataset lama (MLOps lifecycle).
        """
        temp_id = uuid.uuid4().hex[:8]
        file_path = DATA_DIR / f"upload_{temp_id}_{file.filename}"
        
        # 1. Simpan file fisik
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(file_path)
        file_checksum = self._calculate_sha256(str(file_path))
        
        # 2. Cek apakah dataset sudah pernah diupload (deduplikasi)
        existing_dataset = self.db.query(MLDataset).filter(MLDataset.checksum_sha256 == file_checksum).first()
        
        df = pd.read_csv(file_path)
        row_count = len(df)

        if existing_dataset:
            dataset_record = existing_dataset
            domain = existing_dataset.domain
            os.remove(file_path) # Hapus file temp karena sudah ada di sistem
        else:
            # Auto-detect domain jika diminta
            if domain == "auto_detect":
                detected = detect_domain(df.columns.tolist())
                if not detected:
                    os.remove(file_path)
                    raise HTTPException(status_code=400, detail="Gagal auto-detect domain.")
                domain = detected

            # Registrasi dataset baru
            dataset_record = MLDataset(
                domain=domain, 
                file_name=file.filename, 
                file_path=str(file_path),
                checksum_sha256=file_checksum, 
                file_size_bytes=file_size,
                row_count=row_count, 
                uploaded_by=admin_id, 
                is_used_for_training=True
            )
            self.db.add(dataset_record)
            self.db.flush() # Ambil ID dataset untuk history nanti

        try:
            # 3. Eksekusi Training Logic
            feature_df = build_features(domain=domain, df=df)
            # Ambil nilai contamination sesuai domain
            contamination = DOMAIN_ISO_CONFIG.get(domain, {}).get("contamination", 0.05)
            # Gunakan training.py versi baru (Mendukung StandardScaler & Pipeline)
            training_result = train_from_dataframe(
                domain=domain,
                df=feature_df, 
                contamination=contamination
            )
            
            # Pattern Discovery
            new_patterns_count = self.pattern_discovery.extract_and_save_patterns(
                self.db, domain, training_result["anomaly_df"]
            )

            # 4. Registrasi Model Baru (dengan Race Condition Safety & Active Switching)
            new_model = self._register_model(
                domain=domain,
                model_path=training_result["model_path"],
                anomalies_found=training_result["anomalies_found"],
                total_records=row_count
            )

            # 5. Catat History (Menggunakan model_id dan dataset_id yang baru)
            self._record_history(
                schedule_id=None, 
                trigger_source="manual_upload", 
                status="SUCCESS",
                details={
                    "anomalies_found": training_result["anomalies_found"],
                    "new_patterns_discovered": new_patterns_count,
                    "model_path": training_result["model_path"]
                },
                admin_id=admin_id, 
                dataset_id=dataset_record.id, 
                model_id=new_model.id
            )

            # 6. Bonus: Cleanup & Retention Policy Otomatis
            from app.application.services.dataset_retention_service import DatasetRetentionService
            retention_service = DatasetRetentionService(self.db)
            retention_result = retention_service.cleanup_old_datasets(
                keep_latest=3,
                older_than_days=30,
                remove_files=False
            )
            print(f"[Retention Cleanup] {retention_result}")

            # Final Commit untuk semua rangkaian proses
            self.db.commit()
            
            return {
                "status": "success", 
                "model_version": new_model.version_name, 
                "anomalies": training_result["anomalies_found"],
                "cleanup": retention_result
            }

        except Exception as e:
            self.db.rollback() # Membatalkan dataset baru jika belum di-commit
            
            # Catat kegagalan ke history jika dataset sudah terdaftar
            if 'dataset_record' in locals():
                # 👇 ====== TAMBAHKAN LOGIKA PENGECEKAN INI ====== 👇
                # Jika existing_dataset bernilai None, artinya ini dataset baru yang ikut terhapus saat rollback.
                # Kita harus menset ID menjadi None agar tidak melanggar Foreign Key constraint database.
                is_new_dataset = existing_dataset is None if 'existing_dataset' in locals() else True
                actual_dataset_id = None if is_new_dataset else dataset_record.id
                # 👆 ============================================= 👆

                self._record_history(
                    schedule_id=None, 
                    trigger_source="manual_upload", 
                    status="FAILED",
                    details={"error": str(e)}, 
                    admin_id=admin_id, 
                    dataset_id=actual_dataset_id # 🌟 Gunakan ID hasil filter safe-check
                )
                self.db.commit()
            raise HTTPException(status_code=500, detail=f"Training gagal: {str(e)}")

    def execute_retrain(self, domain: str, schedule_id: Optional[int] = None, trigger_source: str = "MANUAL", admin_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Main entry point untuk menjalankan proses retraining dengan data bersih.
        """
        start_time = datetime.now()

        try:
            # 1. Validasi Domain
            if domain not in ["agenusa", "nusabill"]:
                raise HTTPException(status_code=400, detail=f"Domain tidak dikenal: {domain}")

            # 2. Ambil Dataset Baseline dari CSV
            csv_name = f"{domain}_isolation_dataset.csv"
            csv_path = DATA_DIR / csv_name
            if not csv_path.exists():
                raise HTTPException(status_code=404, detail=f"Dataset baseline CSV tidak ditemukan di {csv_path}")

            df_base = pd.read_csv(csv_path)

            # 3. Ambil Data Tambahan dari DB (Feedback)
            feedbacks = self.db.query(MLFeedbackLog).filter(
                MLFeedbackLog.domain == domain,
                MLFeedbackLog.is_used_in_retrain == False
            ).all()

            if feedbacks:
                fb_data = [fb.features_snapshot for fb in feedbacks]
                df_fb = pd.DataFrame(fb_data)
                df_combined = pd.concat([df_base, df_fb], ignore_index=True)
            else:
                df_combined = df_base

            # --- PERBAIKAN: PEMBERSIHAN DATA ---
            # Pastikan kolom seragam (lowercase) sebelum diproses
            df_combined.columns = df_combined.columns.str.lower()
            
            # Hapus kolom duplikat jika ada setelah penggabungan
            df_combined = df_combined.loc[:, ~df_combined.columns.duplicated()]

            # 4. Bangun fitur
            feature_df = build_features(domain, df_combined)
            
            # Pastikan fitur akhir adalah UPPERCASE agar sama persis dengan format runtime
            feature_df.columns = feature_df.columns.str.upper()

            # 5. Jalankan Pelatihan
            contamination_rate = 0.05
            training_result = train_from_dataframe(
                domain=domain,
                feature_df=feature_df,
                contamination=contamination_rate
            )

            # 6. Jalankan Pattern Discovery Auditing (Opsional)
            new_patterns_count = 0
            try:
                trained_model = load_isolation_model(domain)
                config = DOMAIN_ISO_CONFIG[domain]
                x_eval = feature_df.drop(columns=["is_fraud", *config["drop_cols"]], errors="ignore")
                
                preds = trained_model.predict(x_eval)
                feature_df["IS_ANOMALY"] = (preds == -1).astype(int)
                anomaly_df = feature_df[feature_df["IS_ANOMALY"] == 1]

                new_patterns_count = self.pattern_discovery.discover_patterns_from_anomalies(
                    domain=domain,
                    anomaly_df=anomaly_df
                )
            except Exception as e:
                logger.warning(f"Pattern discovery skipped or failed during retrain: {str(e)}")
                new_patterns_count = 0

            # 7. Tandai Feedback di DB bahwa sudah sukses dipakai latihan
            if feedbacks:
                for fb in feedbacks:
                    fb.is_used_in_retrain = True
                    fb.retrained_at = datetime.now(timezone.utc)

            # 8. Catat Histori ke Database Audit Trail
            details = {
                "status": "success",
                "domain": domain,
                "total_records_trained": len(df_combined),
                "feedback_records_used": len(feedbacks),
                "anomalies_found": training_result.get("anomalies_found", 0),
                "new_patterns_discovered": new_patterns_count,
                "duration_seconds": (datetime.now() - start_time).total_seconds()
            }
            
            self._record_history(
                schedule_id=schedule_id,
                trigger_source=trigger_source,
                status="SUCCESS",
                details=details,
                admin_id=admin_id
            )
            
            self.db.commit()
            return details

        except Exception as e:
            self.db.rollback()
            # --- PERBAIKAN: FIX FOREIGNKEYVIOLATION ---
            # Catat error tanpa menyertakan dataset_id yang mungkin menyebabkan FK violation saat rollback
            self._record_history(
                schedule_id=schedule_id,
                trigger_source=trigger_source,
                status="FAILED",
                details={"error": str(e)},
                admin_id=admin_id
            )
            self.db.commit()
            raise HTTPException(status_code=500, detail=f"Training gagal: {str(e)}")

    # ==========================================
    # 🛠️ INTERNAL HELPERS
    # ==========================================
    def _run_training_logic(self, file_path: Path, domain: str) -> Dict[str, Any]:
        """Logika inti ML (Build Features -> Isolation Forest -> Pattern Discovery) dengan ML Feedback Loop."""
        
        # ==========================================
        # 1. BACA DATA HISTORIS DARI CSV (Base Data)
        # ==========================================
        import pandas as pd # Pastikan pd di-import
        df_base = pd.read_csv(file_path)
        
        # Paksa nama kolom CSV jadi lowercase agar cocok dengan Database
        df_base.columns = df_base.columns.str.lower()
        
        if domain == "auto_detect":
            # Asumsi fungsi detect_domain sudah meng-handle lowercase
            domain = detect_domain(df_base.columns.tolist()) or "agenusa"

        # ==========================================
        # 2. EKSTRAKSI GOLDEN DATASET (Feedback Analis)
        # ==========================================
        # Tarik data koreksi fraud dari ml_feedback_logs
        feedbacks = self.db.query(MLFeedbackLog).filter(
            MLFeedbackLog.is_used_for_training == False
        ).all()

        df_combined = df_base.copy()
        
        if feedbacks:
            # Ubah data SQLAlchemy ke List of Dictionaries agar bisa masuk Pandas
            feedback_data = []
            for fb in feedbacks:
                row_dict = {c.name: getattr(fb, c.name) for c in fb.__table__.columns}
                feedback_data.append(row_dict)
            
            df_feedback = pd.DataFrame(feedback_data)
            
            # Gabungkan CSV + Database
            df_combined = pd.concat([df_base, df_feedback], ignore_index=True)
            
            # Ubah tipe Decimal dari PostgreSQL menjadi Float agar Machine Learning tidak crash
            df_combined = df_combined.apply(pd.to_numeric, errors='ignore')

            # Tandai feedback agar tidak dipelajari dua kali di masa depan
            for fb in feedbacks:
                fb.is_used_for_training = True
        else:
            # Tetap pasang pelindung tipe data meski tidak ada feedback baru
            df_combined = df_combined.apply(pd.to_numeric, errors='ignore')

        # ==========================================
        # 3. FEATURE ENGINEERING & TRAINING MODEL
        # ==========================================
        feature_df = build_features(domain, df_combined)

        training_result = self.training_engine.train_and_detect(
            feature_df=feature_df,
            domain=domain
        )

        anomaly_df = training_result["anomaly_df"]
        
        # ==========================================
        # 4. PATTERN DISCOVERY
        # ==========================================
        new_patterns_count = self.pattern_discovery.extract_and_save_patterns(self.db, domain, anomaly_df)

        return {
            "status": "success",
            "domain": domain,
            "total_records": len(df_combined),
            "feedback_records_used": len(feedbacks), # Audit trail
            "anomalies_found": training_result["anomalies_found"],
            "new_patterns_discovered": new_patterns_count,
            "model_path": training_result["model_path"]
        }

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
            model_version=datetime.now().strftime("%Y.%m.%d.%H%M%S%f"),
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