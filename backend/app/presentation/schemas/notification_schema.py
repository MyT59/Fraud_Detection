from pydantic import BaseModel
from typing import Optional

class NotificationUpdateRequest(BaseModel):
    fraud_alerts_enabled: Optional[bool] = None
    push_notifications_enabled: Optional[bool] = None