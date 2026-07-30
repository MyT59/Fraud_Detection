from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, Any, List

class ActivityLogResponse(BaseModel):
    id: int
    admin_id: Optional[int]
    session_id: Optional[int]
    admin_name: Optional[str]
    admin_email: Optional[str]
    action_type: str
    module_source: str
    severity: str
    target_type: Optional[str]
    target_id: Optional[str]
    ip_address: Optional[str]
    device: Optional[str]
    browser: Optional[str]
    details: Optional[Any] = {} 
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Standardized Pagination Metadata untuk Dashboard
class ActivityLogPaginatedResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[ActivityLogResponse]


class ActivityLogSummaryResponse(BaseModel):
    total: int
    action_counts: dict[str, int]
