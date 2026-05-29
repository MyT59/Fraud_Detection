from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class RetrainHistory(Base):
    __tablename__ = "retrain_history"

    id = Column(Integer, primary_key=True)
    
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("retrain_schedules.id", ondelete="SET NULL"), nullable=True)
    execution_time = Column(DateTime(timezone=True), server_default=func.now())
    trigger_source = Column(String(50)) 
    triggered_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20)) 
    
    anomalies_found = Column(Integer, default=0)
    new_patterns_count = Column(Integer, default=0)

    dataset_id = Column(Integer, ForeignKey("ml_datasets.id", ondelete="SET NULL"), nullable=True)
    model_id = Column(Integer, ForeignKey("ml_models.id", ondelete="SET NULL"), nullable=True)
    trigger_metadata = Column(JSONB, server_default='{}') 
    
    log_details = Column(JSONB)
    model_version = Column(String(50))

    schedule = relationship("RetrainSchedule", back_populates="history_logs")
    dataset = relationship("MLDataset", back_populates="retrain_histories")
    model = relationship("MLModel", back_populates="histories")

    __table_args__ = (
        Index('idx_retrain_history_time', execution_time.desc()),
        Index('idx_retrain_history_dataset_id', 'dataset_id'),
        Index('idx_retrain_history_model_id', 'model_id'),
    )