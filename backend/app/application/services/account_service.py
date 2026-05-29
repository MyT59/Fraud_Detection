from app.infrastructure.repositories.admin_repository import AdminRepository
from app.infrastructure.database.models.admin_model import Admin
from app.infrastructure.database.models.role_model import Role
from app.presentation.schemas.admin_schema import AdminResponse, ProfileUpdateRequest
from app.core.security import verify_password, hash_password
from fastapi import HTTPException
import re
import secrets
import string
from datetime import datetime, timezone

from app.domain.entities.target_type import TargetType

# 🔥 IMPORT SERVICE LOG UTAMA & ENUM
from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum


# PASSWORD VALIDATION
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


# HELPER: COUNT ACTIVE SUPER ADMIN
def count_active_super_admins(repo):
    # Hanya hitung SUPER_ADMIN yang aktif secara fisik dan belum di-soft delete
    return len([
        a for a in repo.get_all()
        if a.role.role_name == "SUPER_ADMIN" and a.is_active and not getattr(a, "is_deleted", False)
    ])


# CREATE ACCOUNT
def create_account(db, full_name, email, password, confirm_password, role_id, created_by, department=None,
                    phone_number=None, notes=None):
    repo = AdminRepository(db)
    existing = repo.get_by_email(email)
    if existing: raise HTTPException(400, "Email already registered")
    if password != confirm_password: raise HTTPException(400, "Password confirmation does not match")
    validate_password(password)

    new_admin = Admin(
        full_name=full_name, email=email, password_hash=hash_password(password),
        role_id=role_id, is_active=True, is_deleted=False,
        department=department, phone_number=phone_number, notes=notes, created_by=created_by
    )
    new_admin = repo.create(new_admin)
    db.flush()

    actor_admin = db.query(Admin).filter(Admin.id == created_by).first()
    log_activity(
        db=db, admin=actor_admin, action_type=ActivityActionEnum.ACCOUNT_CREATED,
        module_source=EventSourceEnum.AUTH, severity=SeverityLevelEnum.INFO,
        target_type=TargetType.ADMIN, target_id=new_admin.id,
        details={"email": new_admin.email, "role_id": role_id, "department": department}
    )
    db.commit()
    return AdminResponse(
        id=new_admin.id, full_name=new_admin.full_name, email=new_admin.email,
        is_active=new_admin.is_active, is_deleted=False, # 🎯 SUNTIKKAN INI
        role=new_admin.role.role_name, department=new_admin.department, 
        phone_number=new_admin.phone_number, notes=new_admin.notes, 
        created_at=new_admin.created_at, last_login_at=new_admin.last_login_at
    )


# ✅ GET ALL (Saring akun yang sudah di-soft delete)
def get_all_accounts(db):
    admins = db.query(Admin).filter(Admin.is_deleted == False).all()
    return [
        AdminResponse(
            id=a.id, full_name=a.full_name, email=a.email, is_active=a.is_active,
            is_deleted=getattr(a, "is_deleted", False), # 🎯 SUNTIKKAN INI
            role=a.role.role_name, department=a.department, phone_number=a.phone_number,
            notes=a.notes, created_at=a.created_at, last_login_at=a.last_login_at
        )
        for a in admins
    ]


def get_my_profile(current_admin):
    return AdminResponse(
        id=current_admin.id, full_name=current_admin.full_name, email=current_admin.email,
        is_active=current_admin.is_active, is_deleted=getattr(current_admin, "is_deleted", False), # 🎯 SUNTIKKAN INI
        role=current_admin.role.role_name, department=current_admin.department, 
        phone_number=current_admin.phone_number, notes=current_admin.notes, 
        created_at=current_admin.created_at, last_login_at=current_admin.last_login_at
    )


def update_my_profile(db, current_admin, full_name=None, phone_number=None, department=None):
    if full_name is not None: current_admin.full_name = full_name
    if phone_number is not None: current_admin.phone_number = phone_number
    if department is not None: current_admin.department = department
    db.commit()
    db.refresh(current_admin)
    return get_my_profile(current_admin)


# ✅ CHANGE PASSWORD
def change_password(db, current_admin, old_password, new_password):
    if not verify_password(old_password, current_admin.password_hash):
        raise HTTPException(400, "Old password is incorrect")

    validate_password(new_password)
    current_admin.password_hash = hash_password(new_password)
    current_admin.is_password_temporary = False
    
    log_activity(
        db=db,
        admin=current_admin,
        action_type=ActivityActionEnum.RULE_UPDATED, # Menggunakan jenis aksi update profil umum
        module_source=EventSourceEnum.AUTH,
        severity=SeverityLevelEnum.INFO,
        target_type=TargetType.ADMIN,
        target_id=current_admin.id,
        details={"email": current_admin.email, "action": "Self password update"}
    )
    db.commit()
    return {"message": "Password updated successfully"}


# 🔍 HELPER: GENERATE TEMP PASSWORD
def generate_temp_password(length=10):
    chars = string.ascii_letters + string.digits + "@$!%*?"
    return ''.join(secrets.choice(chars) for _ in range(length))


# ✅ RESET PASSWORD
def reset_password(db, admin_id, performed_by):
    repo = AdminRepository(db)
    admin = repo.get_by_id(admin_id)

    if not admin or admin.is_deleted:
        raise HTTPException(404, "User not found")

    temp_password = generate_temp_password()
    admin.password_hash = hash_password(temp_password)
    admin.is_password_temporary = True

    actor_admin = db.query(Admin).filter(Admin.id == performed_by).first()

    log_activity(
        db=db,
        admin=actor_admin,
        action_type=ActivityActionEnum.RULE_UPDATED,
        module_source=EventSourceEnum.AUTH,
        severity=SeverityLevelEnum.WARNING, # Reset password memiliki urgensi WARNING
        target_type=TargetType.ADMIN,
        target_id=admin.id,
        details={"email": admin.email, "action": "Administrative password reset"}
    )
    db.commit()
    return {"message": "Temporary password generated", "temporary_password": temp_password}


# UPDATE ACCOUNT
def update_account(db, admin_id, full_name=None, role_id=None, department=None, phone_number=None, 
                   notes=None, updated_by=None):
    repo = AdminRepository(db)
    admin = repo.get_by_id(admin_id)
    if not admin or admin.is_deleted: raise HTTPException(404, "User not found")

    if admin.role.role_name == "SUPER_ADMIN" and role_id:
        new_role = db.query(Role).filter(Role.id == role_id).first()
        if new_role and new_role.role_name != "SUPER_ADMIN":
            if count_active_super_admins(repo) <= 1:
                raise HTTPException(400, "Cannot change role of the last Super Admin")

    snapshot_before = {"full_name": admin.full_name, "role_id": admin.role_id, "department": admin.department}
    if full_name: admin.full_name = full_name
    if role_id: admin.role_id = role_id
    if department: admin.department = department
    if phone_number is not None: admin.phone_number = phone_number
    if notes is not None: admin.notes = notes

    repo.update()
    db.flush()

    snapshot_after = {"full_name": admin.full_name, "role_id": admin.role_id, "department": admin.department}
    actor_admin = db.query(Admin).filter(Admin.id == updated_by).first()

    log_activity(
        db=db, 
        admin=actor_admin, 
        action_type=ActivityActionEnum.ACCOUNT_ROLE_CHANGED if role_id else ActivityActionEnum.RULE_UPDATED,
        module_source=EventSourceEnum.AUTH, 
        severity=SeverityLevelEnum.WARNING, 
        target_type=TargetType.ADMIN, 
        target_id=admin.id,
        details={"before": snapshot_before, "after": snapshot_after, "email": admin.email}
    )
    db.commit()
    return AdminResponse(
        id=admin.id, 
        full_name=admin.full_name, 
        email=admin.email,
        is_active=admin.is_active, 
        is_deleted=getattr(admin, "is_deleted", False), # 🎯 SUNTIKKAN INI
        role=admin.role.role_name, 
        department=admin.department, 
        phone_number=admin.phone_number,
        notes=admin.notes, 
        created_at=admin.created_at, 
        last_login_at=admin.last_login_at
    )


# SUSPEND / ACTIVATE
def set_account_status(db, admin_id, is_active: bool, performed_by):
    repo = AdminRepository(db)
    admin = repo.get_by_id(admin_id)
    if not admin or admin.is_deleted: raise HTTPException(404, "User not found")

    if admin.role.role_name == "SUPER_ADMIN" and not is_active:
        if count_active_super_admins(repo) <= 1:
            raise HTTPException(400, "Cannot suspend the last Super Admin")

    admin.is_active = is_active
    repo.update()
    db.flush()

    status_enum = ActivityActionEnum.ACCOUNT_SUSPENDED if not is_active else ActivityActionEnum.ACCOUNT_CREATED
    actor_admin = db.query(Admin).filter(Admin.id == performed_by).first()

    log_activity(
        db=db, 
        admin=actor_admin, 
        action_type=status_enum, 
        module_source=EventSourceEnum.AUTH,
        severity=SeverityLevelEnum.HIGH if not is_active else SeverityLevelEnum.INFO,
        target_type=TargetType.ADMIN, 
        target_id=admin.id, 
        details={"email": admin.email, "target_status_active": is_active}
    )
    db.commit()
    return AdminResponse(
        id=admin.id, 
        full_name=admin.full_name, 
        email=admin.email,
        is_active=admin.is_active, 
        is_deleted=getattr(admin, "is_deleted", False), 
        role=admin.role.role_name, 
        department=admin.department, 
        phone_number=admin.phone_number,
        notes=admin.notes, 
        created_at=admin.created_at, 
        last_login_at=admin.last_login_at
    )


# SOFT DELETE ACCOUNT (Integritas Forensik) 
def delete_account(db, admin_id, performed_by):
    repo = AdminRepository(db)
    admin = repo.get_by_id(admin_id)

    if not admin or admin.is_deleted:
        raise HTTPException(404, "User not found")

    # Amankan dari penghapusan Super Admin satu-satunya
    if admin.role.role_name == "SUPER_ADMIN":
        if count_active_super_admins(repo) <= 1:
            raise HTTPException(400, "Cannot delete the last Super Admin")

    # EKSEKUSI LIFECYCLE SOFT DELETE 
    admin.is_deleted = True
    admin.is_active = False 
    admin.deleted_at = datetime.now(timezone.utc)
    admin.deleted_by = performed_by
    
    repo.update()
    db.flush()

    actor_admin = db.query(Admin).filter(Admin.id == performed_by).first()

    # Catat ke log dengan tingkat bahaya CRITICAL karena penghapusan bersifat permanen di mata sistem
    log_activity(
        db=db,
        admin=actor_admin,
        action_type=ActivityActionEnum.ACCOUNT_SUSPENDED, 
        module_source=EventSourceEnum.AUTH,
        severity=SeverityLevelEnum.CRITICAL, 
        target_type=TargetType.ADMIN,
        target_id=admin.id,
        details={
            "email": admin.email,
            "full_name": admin.full_name,
            "reason": "Account archived and soft deleted to preserve forensic trail integrity"
        }
    )
    
    db.commit() 
    return {"message": "Account successfully archived and soft deleted"}