from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional

# ==========================================
# 1. SCHEMAS REQUEST 
# ==========================================
class AdminCreateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)
    role_id: int = Field(gt=0)
    department: Optional[str] = Field(default=None, max_length=100)
    phone_number: Optional[str] = Field(default=None, max_length=20)
    notes: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("full_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("full_name must not be blank")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

class AdminUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    role_id: Optional[int] = Field(default=None, gt=0)
    department: Optional[str] = Field(default=None, max_length=100)
    phone_number: Optional[str] = Field(default=None, max_length=20)
    notes: Optional[str] = Field(default=None, max_length=2000)


# ==========================================
# 2. SCHEMA RESPONSE 
# ==========================================
class AdminResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool
    is_deleted: bool = False
    is_password_temporary: bool = False
    department: Optional[str] = None
    phone_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone_number: Optional[str] = Field(default=None, max_length=20)
    department: Optional[str] = Field(default=None, max_length=100)
