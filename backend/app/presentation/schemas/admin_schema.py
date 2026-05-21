from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional

# ==========================================
# 1. SCHEMAS UNTUK REQUEST (INPUT FRONTEND)
# ==========================================
class AdminCreateRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str
    role_id: int
    department: Optional[str] = None
    phone_number: Optional[str] = None
    notes: Optional[str] = None

class AdminUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    role_id: Optional[int] = None
    department: Optional[str] = None
    phone_number: Optional[str] = None
    notes: Optional[str] = None


# ==========================================
# 2. SCHEMA UNTUK RESPONSE (OUTPUT API)
# ==========================================
class AdminResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool
    is_deleted: bool = False 
    department: Optional[str] = None
    phone_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    department: Optional[str] = None