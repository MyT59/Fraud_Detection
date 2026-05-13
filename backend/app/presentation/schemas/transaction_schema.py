from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime


class TransactionCreate(BaseModel):
    original_trx_id: str = Field(..., example="TEST-001")
    service_source: str = Field(..., example="AGENUSA")
    user_account_id: str = Field(..., example="USER123")
    amount: float = Field(...)

    transaction_time: Optional[datetime] = None

    terminal_id: Optional[str] = None
    account_number: Optional[str] = None
    merchant_id: Optional[str] = None

    ip_address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None

    transaction_details: Optional[Dict] = None


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