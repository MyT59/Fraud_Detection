from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Literal
from datetime import datetime
from app.infrastructure.database.enums import BLACKLIST_ENGINE_TYPES, BlacklistTypeEnum

SHARED_BLACKLIST_TYPES = {
    BlacklistTypeEnum.CUSTOMER_ID,
    BlacklistTypeEnum.IP_ADDRESS,
}

AGENUSA_BLACKLIST_TYPES = {
    BlacklistTypeEnum.USER_ID,
    BlacklistTypeEnum.IP_ADDRESS,
    BlacklistTypeEnum.MERCHANT_ID,
    BlacklistTypeEnum.TERMINAL_ID,
    BlacklistTypeEnum.ACCOUNT_NUMBER,
}


def validate_engine_supported_type(value: BlacklistTypeEnum) -> BlacklistTypeEnum:
    if value not in BLACKLIST_ENGINE_TYPES:
        supported = ", ".join(item.value for item in sorted(BLACKLIST_ENGINE_TYPES, key=lambda item: item.value))
        raise ValueError(f"Blacklist type must be checked by the engine: {supported}")
    return value


class BlacklistCreateRequest(BaseModel):
    value: str = Field(..., min_length=1, max_length=255)
    type: BlacklistTypeEnum
    service_scope: Literal["ALL", "AGENUSA", "NUSABILL"] = "ALL"
    reason: str = Field(..., min_length=1, max_length=2000)

    _validate_type = field_validator("type")(validate_engine_supported_type)

    @field_validator("value", "reason")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value dan reason tidak boleh kosong")
        return value

    @model_validator(mode="after")
    def validate_service_type(self):
        # Nusabill hanya memiliki identifier yang memang tersedia pada payload-nya.
        if self.service_scope == "NUSABILL" and self.type not in SHARED_BLACKLIST_TYPES:
            raise ValueError("Nusabill hanya mendukung blacklist CUSTOMER_ID atau IP_ADDRESS")
        if self.service_scope == "ALL" and self.type not in SHARED_BLACKLIST_TYPES:
            raise ValueError("Blacklist scope ALL hanya mendukung CUSTOMER_ID atau IP_ADDRESS")
        if self.service_scope == "AGENUSA" and self.type not in AGENUSA_BLACKLIST_TYPES:
            raise ValueError("Agenusa mendukung USER_ID, IP_ADDRESS, MERCHANT_ID, TERMINAL_ID, atau ACCOUNT_NUMBER")
        return self

class BlacklistReviewSchema(BaseModel):
    review_note: str = Field(..., min_length=1, max_length=2000)

    @field_validator("review_note")
    @classmethod
    def review_note_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("review_note tidak boleh kosong")
        return value

class BlacklistResponse(BaseModel):
    id: int
    value: str
    type: BlacklistTypeEnum
    service_scope: str
    reason: str
    review_note: str | None = None
    is_active: bool
    is_deleted: bool = False
    source: str        
    status: str 
    hit_count: int
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None
    deleted_by: int | None = None
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
    value: str = Field(..., min_length=1, max_length=255)
    type: BlacklistTypeEnum
    service_scope: Literal["ALL", "AGENUSA", "NUSABILL"] = "ALL"
    reason: str = Field(..., min_length=1, max_length=2000)

    _validate_type = field_validator("type")(validate_engine_supported_type)

    @field_validator("value", "reason")
    @classmethod
    def bulk_text_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value dan reason tidak boleh kosong")
        return value

    @model_validator(mode="after")
    def validate_bulk_service_type(self):
        if self.service_scope == "NUSABILL" and self.type not in SHARED_BLACKLIST_TYPES:
            raise ValueError("Nusabill hanya mendukung blacklist CUSTOMER_ID atau IP_ADDRESS")
        if self.service_scope == "ALL" and self.type not in SHARED_BLACKLIST_TYPES:
            raise ValueError("Blacklist scope ALL hanya mendukung CUSTOMER_ID atau IP_ADDRESS")
        if self.service_scope == "AGENUSA" and self.type not in AGENUSA_BLACKLIST_TYPES:
            raise ValueError("Agenusa mendukung USER_ID, IP_ADDRESS, MERCHANT_ID, TERMINAL_ID, atau ACCOUNT_NUMBER")
        return self

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
