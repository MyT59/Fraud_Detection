from fastapi import APIRouter, Depends, Body 
from sqlalchemy.orm import Session
from typing import Optional

from app.infrastructure.database.session import get_db
from app.application.services.account_service import (
    change_password,
    create_account,
    get_all_accounts,
    reset_password,
    update_account,
    set_account_status,
    delete_account,
    get_my_profile,
    update_my_profile
)
from app.core.rbac import require_roles
from app.presentation.schemas.admin_schema import AdminCreateRequest, AdminUpdateRequest, AdminResponse, ProfileUpdateRequest

router = APIRouter(prefix="/accounts", tags=["Accounts"])

# CREATE ACCOUNT
@router.post("/", response_model=AdminResponse)
def create(
    request: AdminCreateRequest,  
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN"))
):
    return create_account(
        db=db,
        full_name=request.full_name,
        email=request.email,
        password=request.password,
        confirm_password=request.confirm_password,
        role_id=request.role_id,
        created_by=current_admin.id,
        department=request.department,
        phone_number=request.phone_number,
        notes=request.notes
    )

# GET ALL
@router.get("/", response_model=list[AdminResponse])
def get_all(
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN"))
):
    return get_all_accounts(db)

# GET MY PROFILE
@router.get("/me", response_model=AdminResponse)
def get_my_profile_route(
    current_admin=Depends(
        require_roles(
            "SUPER_ADMIN",
            "RISK_MANAGER",
            "FRAUD_ANALYST"
        )
    )
):
    return get_my_profile(current_admin)

# UPDATE MY PROFILE
@router.patch("/me", response_model=AdminResponse)
def update_my_profile_route(
    request: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_admin=Depends(
        require_roles(
            "SUPER_ADMIN",
            "RISK_MANAGER",
            "FRAUD_ANALYST"
        )
    )
):
    return update_my_profile(
        db=db,
        current_admin=current_admin,
        full_name=request.full_name,
        phone_number=request.phone_number,
        department=request.department
    )

@router.post("/change-password")
def change_password_route(
    old_password: str,
    new_password: str,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))
):
    return change_password(db, current_admin, old_password, new_password)

# UPDATE ACCOUNT
@router.patch("/{admin_id}", response_model=AdminResponse)
def update(
    admin_id: int,
    request: AdminUpdateRequest, 
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN"))
):
    return update_account(
        db=db,
        admin_id=admin_id,
        full_name=request.full_name,
        role_id=request.role_id,
        updated_by=current_admin.id,
        department=request.department,
        phone_number=request.phone_number,
        notes=request.notes
    )

@router.post("/{admin_id}/reset-password")
def reset_password_route(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN"))
):
    return reset_password(db, admin_id, current_admin.id)

# UPDATE STATUS (SUSPEND / ACTIVATE)
@router.patch("/{admin_id}/status", response_model=AdminResponse)
def update_status(
    admin_id: int,
    is_active: bool = True,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN"))
):
    return set_account_status(
        db,
        admin_id,
        is_active,
        current_admin.id  
    )

@router.delete("/{admin_id}")
def delete(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN"))
):
    return delete_account(db, admin_id, current_admin.id)