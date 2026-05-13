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
    is_active: bool
    role: str  # Memakai string karena di service kamu passing "new_admin.role.role_name"