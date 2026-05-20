from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from enum import Enum

class AlertStatusEnum(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    REOPENED = "REOPENED"     # Tambahkan ini
    OVERRIDDEN = "OVERRIDDEN"

class AlertStatusUpdate(BaseModel):
    status: AlertStatusEnum
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

class AlertPriorityDistributionResponse(BaseModel):
    CRITICAL: int
    HIGH: int
    MEDIUM: int
    LOW: int