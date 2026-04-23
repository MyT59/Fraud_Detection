from fastapi import Depends, HTTPException
from app.core.security import get_current_user

def require_role(required_role: str):
    def checker(admin=Depends(get_current_user)):
        if admin.role.role_name != required_role:
            raise HTTPException(status_code=403, detail="Forbidden")
        return admin
    return checker