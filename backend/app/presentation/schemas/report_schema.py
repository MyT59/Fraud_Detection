from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.infrastructure.database.enums import (
    ReportTypeEnum,
    ReportFormatEnum,
    ReportStatusEnum,
    TransactionStatusEnum,
    RiskLevelEnum,
)


# ==========================================
# REQUESTS
# ==========================================

class ReportGenerateRequest(BaseModel):
    report_name: str

    report_type: ReportTypeEnum
    format: ReportFormatEnum

    date_from: datetime
    date_to: datetime

    # filters — transaction
    service_source: Optional[str] = None
    final_status: Optional[TransactionStatusEnum] = None
    risk_level: Optional[RiskLevelEnum] = None
    user_account_id: Optional[str] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    min_risk_score: Optional[float] = None
    max_risk_score: Optional[float] = None

    # filters — activity log
    action_type: Optional[str] = None
    action_types: Optional[List[str]] = None
    module_source: Optional[str] = None
    severity: Optional[str] = None

    # filters — fraud pattern
    status: Optional[str] = None
    category: Optional[str] = None

    # filters — blacklist
    blacklist_type: Optional[str] = None
    service_scope: Optional[str] = None
    is_active: Optional[bool] = None
    source: Optional[str] = None

    # filters - manual review
    reviewer_id: Optional[int] = None


# ==========================================
# RESPONSES
# ==========================================

class AdminMiniResponse(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ReportResponse(BaseModel):
    id: UUID
    report_name: str
    report_type: ReportTypeEnum
    format: ReportFormatEnum
    date_from: datetime
    date_to: datetime
    generated_by: Optional[int] = None
    generated_by_admin: Optional[AdminMiniResponse] = None
    status: ReportStatusEnum
    
    # Menampilkan filter apa saja yang tersimpan dalam format Dict/JSONB
    filter_criteria: Optional[dict] = None  # <-- Tambah ini agar FE bisa baca

    file_path: Optional[str] = None
    total_records: int
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ReportListItem(BaseModel):
    id: UUID
    report_name: str
    report_type: ReportTypeEnum
    format: ReportFormatEnum
    status: ReportStatusEnum
    total_records: int

    # Opsional: FE bisa langsung intip filter dari halaman list history
    filter_criteria: Optional[dict] = None

    # Nama admin yang generate report (untuk kolom "By" di Report History)
    generated_by_admin: Optional[AdminMiniResponse] = None

    created_at: datetime
    completed_at: Optional[datetime] = None
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ReportPaginatedResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[ReportListItem]


class ReportDownloadResponse(BaseModel):
    report_id: UUID
    report_name: str
    format: ReportFormatEnum
    download_url: str


class FraudAnalystOptionResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)
