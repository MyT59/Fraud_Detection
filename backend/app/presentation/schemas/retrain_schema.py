# app/presentation/schemas/retrain_schema.py

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Literal, Dict, Any
from datetime import datetime
import uuid

# ==========================================
# 🕒 SCHEMAS UNTUK JADWAL (SCHEDULE)
# ==========================================

class ScheduleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120, example="Retrain Mingguan Agenusa")
    cron_expr: str = Field(..., min_length=9, max_length=100, example="0 0 * * 0")
    domain: Literal["agenusa", "nusabill"] = Field(..., example="agenusa")
    is_active: bool = True

class ScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    cron_expr: Optional[str] = Field(None, min_length=9, max_length=100)
    domain: Optional[Literal["agenusa", "nusabill"]] = None
    is_active: Optional[bool] = None

class StatusUpdate(BaseModel):
    is_active: bool

class ScheduleResponse(BaseModel):
    id: uuid.UUID
    name: str
    cron_expr: str
    domain: str
    is_active: bool
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[int] = None
    
    # 🔥 TAMBAHAN BARU: Kirim status terakhir ke Frontend
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True) 

# ==========================================
# 📜 SCHEMAS UNTUK RIWAYAT (HISTORY)
# ==========================================

class RetrainHistoryResponse(BaseModel):
    id: int
    schedule_id: Optional[uuid.UUID] = None
    execution_time: datetime
    trigger_source: str
    triggered_by: Optional[int] = None
    status: str
    anomalies_found: int
    new_patterns_count: int
    log_details: Optional[Dict[str, Any]] = None
    model_version: Optional[str] = None
    dataset_id: Optional[int] = None
    model_id: Optional[int] = None
    trigger_metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)
