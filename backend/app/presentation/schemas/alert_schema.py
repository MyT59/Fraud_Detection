from pydantic import BaseModel
from datetime import datetime

class AlertResponse(BaseModel):
    id: int
    transaction_id: int
    service: str
    severity: str
    priority: float
    status: str
    title: str
    message: str
    created_at: datetime