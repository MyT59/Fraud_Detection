from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Literal
from datetime import datetime
import math


class TransactionCreate(BaseModel):
    original_trx_id: str = Field(..., min_length=1, max_length=100, example="TEST-001")
    service_source: Literal["AGENUSA", "NUSABILL"] = Field(..., example="AGENUSA")
    user_account_id: str = Field(..., min_length=1, max_length=100, example="USER123")
    amount: float = Field(..., gt=0, le=999_999_999_999)

    transaction_time: Optional[datetime] = None
    transaction_status: Optional[str] = Field(None, max_length=100)

    terminal_id: Optional[str] = None
    account_number: Optional[str] = None
    merchant_id: Optional[str] = None

    ip_address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None

    transaction_details: Optional[Dict] = None

    @field_validator("original_trx_id", "user_account_id", "transaction_status", "terminal_id", "account_number", "merchant_id", "ip_address", "city", "country", mode="before")
    @classmethod
    def strip_text(cls, value):
        if value is None:
            return None
        value = str(value).strip()
        return value or None

    @field_validator("amount")
    @classmethod
    def amount_must_be_finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("amount must be a finite number")
        return value


class TransactionResponse(BaseModel):
    transaction_id: int
    original_trx_id: str
    service_source: str
    amount: float

    risk_score: Optional[float]
    risk_level: Optional[str]
    final_status: str

    alert_created: bool
    violation_reason: Optional[str]

    created_at: datetime

class TransactionListItem(BaseModel):
    id: int
    original_trx_id: str
    service_source: str
    user_account_id: str

    amount: float

    risk_score: Optional[float]
    risk_level: Optional[str]

    final_status: str

    transaction_time: Optional[datetime]

    city: Optional[str]
    country: Optional[str]

    suppressed_count: Optional[int]

class TransactionSummary(BaseModel):
    total_transactions: int
    fraud: int
    flagged: int
    under_review: int
    safe: int

class TransactionListResponse(BaseModel):
    summary: TransactionSummary

    page: int
    size: int
    total_records: int
    total_pages: int

    data: List[TransactionListItem]

class TransactionDetailResponse(BaseModel):
    id: int

    original_trx_id: str
    service_source: str

    user_account_id: str
    account_number: Optional[str]

    amount: float

    transaction_time: Optional[datetime]

    transaction_status: Optional[str]
    final_status: str

    risk_score: Optional[float]
    risk_level: Optional[str]
    anomaly_score: Optional[float]

    violation_reason: Optional[str]

    violation_rule_ids: Optional[list]
    violation_pattern_ids: Optional[list]
    blacklist_matches: Optional[list]
    suppressed_patterns: Optional[list]
    suppressed_pattern_ids: Optional[list]

    ip_address: Optional[str]
    terminal_id: Optional[str]
    merchant_id: Optional[str]

    city: Optional[str]
    country: Optional[str]

    score_breakdown: Optional[dict]

    transaction_details: Optional[dict]

    is_flagged_ml: bool

    created_at: datetime
    updated_at: Optional[datetime]
