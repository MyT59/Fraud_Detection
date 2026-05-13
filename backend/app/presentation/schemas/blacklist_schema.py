from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.infrastructure.database.enums import BlacklistTypeEnum


class BlacklistCreateRequest(BaseModel):
    value: str
    type: BlacklistTypeEnum
    service_scope: Optional[str] = "ALL"
    reason: str

class BlacklistReviewSchema(BaseModel):
    review_note: str

class BlacklistResponse(BaseModel):
    id: int
    value: str
    type: BlacklistTypeEnum
    service_scope: str
    reason: str
    review_note: str | None = None
    is_active: bool
    source: str        
    status: str 
    hit_count: int
    created_at: datetime

    class Config:
        from_attributes = True

class BlacklistListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    data: List[BlacklistResponse]