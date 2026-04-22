from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.core.rbac import require_role

router = APIRouter()

# 🔓 basic protected
@router.get("/me")
def get_me(admin=Depends(get_current_user)):
    return {
        "id": admin.id,
        "email": admin.email,
        "role": admin.role.role_name
    }

# 🔐 RBAC test
@router.get("/admin-only")
def admin_only(admin=Depends(require_role("SUPER_ADMIN"))):
    return {"message": "Only admin can access"}