from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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
    report_name: str = Field(min_length=1, max_length=255)

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

    @field_validator("report_name")
    @classmethod
    def validate_report_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Report name cannot be empty")
        return value

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.date_from.tzinfo is None or self.date_from.utcoffset() is None:
            raise ValueError("date_from must include a timezone offset")
        if self.date_to.tzinfo is None or self.date_to.utcoffset() is None:
            raise ValueError("date_to must include a timezone offset")
        if self.date_from > self.date_to:
            raise ValueError("date_to must be later than or equal to date_from")
        if self.min_amount is not None and self.min_amount < 0:
            raise ValueError("min_amount cannot be negative")
        if self.max_amount is not None and self.max_amount < 0:
            raise ValueError("max_amount cannot be negative")
        if self.min_amount is not None and self.max_amount is not None and self.min_amount > self.max_amount:
            raise ValueError("max_amount must be greater than or equal to min_amount")
        if self.min_risk_score is not None and not 0 <= self.min_risk_score <= 100:
            raise ValueError("min_risk_score must be between 0 and 100")
        if self.max_risk_score is not None and not 0 <= self.max_risk_score <= 100:
            raise ValueError("max_risk_score must be between 0 and 100")
        if self.min_risk_score is not None and self.max_risk_score is not None and self.min_risk_score > self.max_risk_score:
            raise ValueError("max_risk_score must be greater than or equal to min_risk_score")
        return self


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

