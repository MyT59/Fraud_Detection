from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user


def get_role_name(admin):
    role = getattr(admin, "role", None)
    return getattr(role, "role_name", role)


# =========================
# GENERIC ROLE CHECK
# =========================
def require_roles(*allowed_roles):
    def checker(admin=Depends(get_current_user)):
        user_role = get_role_name(admin)

        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for role: {user_role}"
            )

        return admin
    return checker

# =========================
# SPECIFIC SHORTCUTS
# =========================

# SUPER ADMIN
def is_super_admin(admin=Depends(get_current_user)):
    if get_role_name(admin) != "SUPER_ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Only Super Admin allowed"
        )
    return admin

# RISK MANAGER
def is_risk_manager(admin=Depends(get_current_user)):
    if get_role_name(admin) != "RISK_MANAGER":
        raise HTTPException(
            status_code=403,
            detail="Only Risk Manager allowed"
        )
    return admin


# FRAUD ANALYST (ADMIN)
def is_fraud_analyst(admin=Depends(get_current_user)):
    if get_role_name(admin) != "FRAUD_ANALYST":
        raise HTTPException(
            status_code=403,
            detail="Only Fraud Analyst allowed"
        )
    return admin
