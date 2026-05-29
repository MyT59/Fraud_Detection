# app/infrastructure/database/models/ml_model_model.py

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, text
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class MLModel(Base):
    __tablename__ = "ml_models"

    id = Column(Integer, primary_key=True)

    version_name = Column(String(100), nullable=False)
    target_service = Column(String(100), nullable=False)

    file_path = Column(String(255), nullable=False)

    metrics = Column(JSONB, server_default='{}')

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, server_default=text("true"))

    histories = relationship("RetrainHistory", back_populates="model")