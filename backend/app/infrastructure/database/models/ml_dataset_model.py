# app/infrastructure/database/models/ml_dataset_model.py

from sqlalchemy import Column, Integer, String, BigInteger, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class MLDataset(Base):
    __tablename__ = "ml_datasets"

    id = Column(Integer, primary_key=True)
    domain = Column(String(50), nullable=False)            # 'agenusa' atau 'nusabill'
    file_name = Column(String(255), nullable=False)        # Nama file asli (misal: data_maret.csv)
    file_path = Column(String(255), nullable=False)        # Lokasi di server (/data/datasets/...)
    
    # Keamanan & Integritas
    checksum_sha256 = Column(String(64), unique=True, nullable=False)
    
    # Metrik Tambahan
    file_size_bytes = Column(BigInteger)
    row_count = Column(Integer)
    is_archived = Column(Boolean, default=False)
    
    uploaded_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    is_used_for_training = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # =========================
    # RELATIONSHIPS & INDEXES
    # =========================
    # Relasi ke history (1 dataset bisa dipakai berkali-kali untuk retrain)
    histories = relationship("RetrainHistory", back_populates="dataset")
    retrain_histories = relationship("RetrainHistory", back_populates="dataset")
# Index untuk mempercepat query "Ambil dataset terbaru untuk domain X"
Index("idx_ml_datasets_lookup", MLDataset.domain, MLDataset.created_at.desc())