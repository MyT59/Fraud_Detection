from pydantic import BaseModel, field_validator
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
    added_by: int | None = None
    added_by_name: str | None = None   # nama admin yang menambahkan
    added_by_role: str | None = None   # role admin yang menambahkan

    class Config:
        from_attributes = True

class BlacklistListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    data: List[BlacklistResponse]

class BlacklistBulkItem(BaseModel):
    value: str
    type: BlacklistTypeEnum
    service_scope: Optional[str] = "ALL"
    reason: str

class BlacklistBulkRequest(BaseModel):
    items: List[BlacklistBulkItem]

    @field_validator("items")
    @classmethod
    def items_not_empty(cls, v):
        if not v:
            raise ValueError("items tidak boleh kosong")
        if len(v) > 500:
            raise ValueError("Maksimal 500 item per bulk import")
        return v

class BlacklistBulkResponse(BaseModel):
    total: int
    success: int
    skipped: int
    failed: int
    skipped_values: List[str]
    failed_values: List[str]