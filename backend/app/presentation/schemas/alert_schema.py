from typing import Literal, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from app.infrastructure.database.enums import AlertStatusEnum

class AlertStatusUpdate(BaseModel):
    status: AlertStatusEnum
    reason: Optional[str] = Field(default=None, max_length=1000)


class BlockedInvestigationRequest(BaseModel):
    """Post-block investigation; it never changes the automatic decision."""
    assessment: Literal["VALID_BLOCK", "POTENTIAL_FALSE_POSITIVE"]
    confidence: Literal["LOW", "MEDIUM", "HIGH"]
    note: str = Field(..., min_length=1, max_length=1000)
class AlertResponse(BaseModel):
    id: int
    transaction_id: int
    service: str
    severity: str
    priority: Optional[float] = 0
    priority_label: str
    status: AlertStatusEnum
    title: str
    message: str
    created_at: datetime
    type: str #
    transaction_final_status: Optional[str] = None

class AlertPriorityDistributionResponse(BaseModel):
    critical: int # 🚀 Ubah ke huruf kecil semua
    high: int
    medium: int
    low: int
