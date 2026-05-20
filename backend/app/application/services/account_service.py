from app.infrastructure.repositories.admin_repository import AdminRepository
from app.infrastructure.database.models.admin_model import Admin
from app.infrastructure.database.models.role_model import Role
from app.presentation.schemas.admin_schema import AdminResponse, ProfileUpdateRequest
from app.core.security import verify_password, hash_password
from app.application.services.activity_log_service import log_activity
from fastapi import HTTPException
import re
import secrets
import string

from app.domain.entities.target_type import TargetType


# 🔐 PASSWORD VALIDATION
def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    if not re.search(r"[A-Z]", password):
        raise HTTPException(400, "Password must contain uppercase letter")

    if not re.search(r"[a-z]", password):
        raise HTTPException(400, "Password must contain lowercase letter")

    if not re.search(r"[0-9]", password):
        raise HTTPException(400, "Password must contain number")

    if not re.search(r"[@$!%*?&]", password):
        raise HTTPException(400, "Password must contain special character")


# 🔍 HELPER: COUNT ACTIVE SUPER ADMIN
def count_active_super_admins(repo):
    return len([
        a for a in repo.get_all()
        if a.role.role_name == "SUPER_ADMIN" and a.is_active
    ])


# ✅ CREATE ACCOUNT
def create_account(db, full_name, email, password, confirm_password, role_id, created_by, department=None, phone_number=None, notes=None):
    repo = AdminRepository(db)

    existing = repo.get_by_email(email)
    if existing:
        raise HTTPException(400, "Email already registered")
    if password != confirm_password:
        raise HTTPException(400, "Password confirmation does not match")

    # 🔥 FIX: validate password
    validate_password(password)

    new_admin = Admin(
        full_name=full_name,
        email=email,
        password_hash=hash_password(password),
        role_id=role_id,
        is_active=True,
        department=department,
        phone_number=phone_number,
        notes=notes,
        created_by=created_by
    )

    new_admin = repo.create(new_admin)

    # Logging
    log_activity(
        db,
        admin=Admin(id=created_by),  # actor
        action_type="CREATE_ACCOUNT",
        target_type=TargetType.ADMIN,
        target_id=new_admin.id,
        details=f"Created account {new_admin.email}"
    )

    return AdminResponse(
        id=new_admin.id,
        full_name=new_admin.full_name,
        email=new_admin.email,
        is_active=new_admin.is_active,
        role=new_admin.role.role_name,

        department=new_admin.department,
        phone_number=new_admin.phone_number,
        notes=new_admin.notes,

        created_at=new_admin.created_at,
        last_login_at=new_admin.last_login_at
    )


# ✅ GET ALL
def get_all_accounts(db):
    repo = AdminRepository(db)
    admins = repo.get_all()

    return [
    AdminResponse(
        id=a.id,
        full_name=a.full_name,
        email=a.email,
        is_active=a.is_active,
        role=a.role.role_name,

        department=a.department,
        phone_number=a.phone_number,
        notes=a.notes,

        created_at=a.created_at,
        last_login_at=a.last_login_at
    )
    for a in admins
]

def get_my_profile(current_admin):
    return AdminResponse(
        id=current_admin.id,
        full_name=current_admin.full_name,
        email=current_admin.email,
        is_active=current_admin.is_active,
        role=current_admin.role.role_name,

        department=current_admin.department,
        phone_number=current_admin.phone_number,
        notes=current_admin.notes,

        created_at=current_admin.created_at,
        last_login_at=current_admin.last_login_at
    )

def update_my_profile(
    db,
    current_admin,
    full_name=None,
    phone_number=None,
    department=None
):
    if full_name is not None:
        current_admin.full_name = full_name

    if phone_number is not None:
        current_admin.phone_number = phone_number

    if department is not None:
        current_admin.department = department

    db.commit()
    db.refresh(current_admin)

    return AdminResponse(
        id=current_admin.id,
        full_name=current_admin.full_name,
        email=current_admin.email,
        is_active=current_admin.is_active,
        role=current_admin.role.role_name,

        department=current_admin.department,
        phone_number=current_admin.phone_number,
        notes=current_admin.notes,

        created_at=current_admin.created_at,
        last_login_at=current_admin.last_login_at
    )

# ✅ CHANGE PASSWORD
def change_password(db, current_admin, old_password, new_password):
    if not verify_password(old_password, current_admin.password_hash):
        raise HTTPException(400, "Old password is incorrect")

    validate_password(new_password)

    current_admin.password_hash = hash_password(new_password)
    current_admin.is_password_temporary = False
    db.commit()

    # Logging
    log_activity(
        db,
        admin=current_admin,
        action_type="CHANGE_PASSWORD",
        target_type=TargetType.ADMIN,
        target_id=current_admin.id,
        details="Password changed"
    )

    return {"message": "Password updated successfully"}


# 🔍 HELPER: GENERATE TEMP PASSWORD
def generate_temp_password(length=10):
    chars = string.ascii_letters + string.digits + "@$!%*?"
    return ''.join(secrets.choice(chars) for _ in range(length))


# ✅ RESET PASSWORD
def reset_password(db, admin_id, performed_by):
    repo = AdminRepository(db)
    admin = repo.get_by_id(admin_id)

    if not admin:
        raise HTTPException(404, "User not found")

    temp_password = generate_temp_password()

    admin.password_hash = hash_password(temp_password)
    admin.is_password_temporary = True
    db.commit()

    # Logging
    log_activity(
        db,
        admin=Admin(id=performed_by),
        action_type="RESET_PASSWORD",
        target_type=TargetType.ADMIN,
        target_id=admin.id,
        details=f"Temporary password generated for {admin.email}"
    )

    return {
        "message": "Temporary password generated",
        "temporary_password": temp_password  # ⚠️ hanya untuk demo
    }


# ✅ UPDATE ACCOUNT
def update_account(db, admin_id, full_name=None, role_id=None, department=None, phone_number=None, notes=None, updated_by=None):
    repo = AdminRepository(db)
    admin = repo.get_by_id(admin_id)

    if not admin:
        raise HTTPException(404, "User not found")

    # 🔥 PROTECT LAST SUPER ADMIN (ROLE CHANGE)
    if admin.role.role_name == "SUPER_ADMIN" and role_id:
        new_role = db.query(Role).filter(Role.id == role_id).first()

        if new_role and new_role.role_name != "SUPER_ADMIN":
            if count_active_super_admins(repo) <= 1:
                raise HTTPException(400, "Cannot change role of the last Super Admin")

    if full_name:
        admin.full_name = full_name
    if role_id:
        admin.role_id = role_id
    if department:
        admin.department = department
    if phone_number is not None:
        admin.phone_number = phone_number
    if notes is not None:
        admin.notes = notes

    repo.update()

    # Logging
    log_activity(
        db,
        admin=Admin(id=updated_by),
        action_type="UPDATE_ACCOUNT",
        target_type=TargetType.ADMIN,
        target_id=admin.id,
        details=f"Updated account {admin.email}"
    )

    return AdminResponse(
        id=admin.id,
        full_name=admin.full_name,
        email=admin.email,
        is_active=admin.is_active,
        role=admin.role.role_name,

        department=admin.department,
        phone_number=admin.phone_number,
        notes=admin.notes,

        created_at=admin.created_at,
        last_login_at=admin.last_login_at
    )


# ✅ SUSPEND / ACTIVATE
def set_account_status(db, admin_id, is_active: bool, performed_by):
    repo = AdminRepository(db)
    admin = repo.get_by_id(admin_id)

    if not admin:
        raise HTTPException(404, "User not found")

    # 🔥 PROTECT LAST SUPER ADMIN (SUSPEND)
    if admin.role.role_name == "SUPER_ADMIN" and not is_active:
        if count_active_super_admins(repo) <= 1:
            raise HTTPException(400, "Cannot suspend the last Super Admin")

    admin.is_active = is_active
    repo.update()

    status_text = "activated" if is_active else "suspended"

    # Logging
    log_activity(
        db,
        admin=Admin(id=performed_by),
        action_type="UPDATE_STATUS",
        target_type=TargetType.ADMIN,
        target_id=admin.id,
        details=f"Account {admin.email} {status_text}"
    )

    return AdminResponse(
        id=admin.id,
        full_name=admin.full_name,
        email=admin.email,
        is_active=admin.is_active,
        role=admin.role.role_name,

        department=admin.department,
        phone_number=admin.phone_number,
        notes=admin.notes,

        created_at=admin.created_at,
        last_login_at=admin.last_login_at
    )

# 🗑️ DELETE ACCOUNT
def delete_account(db, admin_id, performed_by):
    repo = AdminRepository(db)
    admin = repo.get_by_id(admin_id)

    if not admin:
        raise HTTPException(404, "User not found")

    # 🔥 PROTECT LAST SUPER ADMIN
    if admin.role.role_name == "SUPER_ADMIN":
        if count_active_super_admins(repo) <= 1:
            raise HTTPException(400, "Cannot delete the last Super Admin")

    repo.delete(admin)

    # Logging
    log_activity(
        db,
        admin=Admin(id=performed_by),
        action_type="DELETE_ACCOUNT",
        target_type=TargetType.ADMIN,
        target_id=admin.id,
        details=f"Deleted account {admin.email}"
    )

    return {"message": "Account deleted"}