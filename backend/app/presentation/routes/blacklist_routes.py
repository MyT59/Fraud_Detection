from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.enums import ActivityActionEnum
from app.domain.entities.target_type import TargetType
from app.core.rbac import require_roles
from app.infrastructure.database.session import get_db
from app.infrastructure.database.models.blacklist_items_model import BlacklistItem
from app.presentation.schemas.blacklist_schema import (
    BlacklistCreateRequest,
    BlacklistResponse,
    BlacklistListResponse,
    BlacklistReviewSchema,
    BlacklistTypeEnum,
    BlacklistBulkRequest,
    BlacklistBulkResponse,
)

router = APIRouter(prefix="/blacklist", tags=["Blacklist"])

from sqlalchemy.exc import IntegrityError

# =========================
# ADD BLACKLIST
# =========================
@router.post("/", response_model=BlacklistResponse)
def add_blacklist(
    data: BlacklistCreateRequest,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    item = BlacklistItem(
        value=data.value.strip().lower(),
        type=data.type,
        service_scope=data.service_scope.upper(),
        reason=data.reason,
        source="MANUAL",
        status="PENDING",
        is_active=False,
        added_by=current_admin.id
    )

    db.add(item)

    try:
        db.commit()
        db.refresh(item)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Blacklist already exists"
        )

    # Log Activity
    log_activity(
        db,
        current_admin,
        action_type=ActivityActionEnum.BLACKLIST_CREATED,
        target_type=TargetType.BLACKLIST,
        target_id=item.id,
        details=f"Added {item.type}={item.value}"
    )

    return item

@router.patch("/{item_id}/approve")
def approve_blacklist(
    item_id: int,
    payload: BlacklistReviewSchema,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):

    item = db.query(BlacklistItem).filter(
        BlacklistItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Blacklist not found")

    item.status = "APPROVED"
    item.is_active = True
    item.review_note = payload.review_note

    log_activity(
        db,
        current_admin,
        action_type=ActivityActionEnum.BLACKLIST_APPROVED,
        target_type=TargetType.BLACKLIST,
        target_id=item.id,
        details=f"Approved blacklist: {payload.review_note}"
    )

    db.commit()
    return {"message": "Blacklist approved"}

@router.patch("/{item_id}/reject")
def reject_blacklist(
    item_id: int,
    payload: BlacklistReviewSchema,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):

    item = db.query(BlacklistItem).filter(
        BlacklistItem.id == item_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Blacklist not found")

    item.status = "REJECTED"
    item.is_active = False
    item.review_note = payload.review_note

    log_activity(
        db,
        current_admin,
        action_type=ActivityActionEnum.BLACKLIST_REJECTED,
        target_type=TargetType.BLACKLIST,
        target_id=item.id,
        details=f"Rejected blacklist: {payload.review_note}"
    )

    db.commit()
    return {"message": "Blacklist rejected"}

# =========================
# UPDATE BLACKLIST
# =========================
@router.put("/{item_id}", response_model=BlacklistResponse)
def update_blacklist(
    item_id: int, 
    data: BlacklistCreateRequest, 
    db: Session = Depends(get_db), 
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):

    item = db.query(BlacklistItem).filter(BlacklistItem.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Blacklist not found")

    # Ambil snapshot data lama sebelum diubah untuk kebutuhan audit trail (Before Snapshot)
    snapshot_before = {
        "value": item.value,
        "type": item.type,
        "service_scope": item.service_scope,
        "reason": item.reason
    }

    # Isi data baru
    item.value = data.value.strip().lower()
    item.type = data.type
    item.service_scope = data.service_scope.upper()
    item.reason = data.reason
    item.status = "PENDING"
    item.is_active = False
    item.review_note = None

    # 🎯 FIX DI SINI: Bungkus dengan try-except untuk menangkap UniqueConstraint Violation
    try:
        db.commit()
        db.refresh(item)
    except IntegrityError:
        db.rollback()  # Batalkan transaksi yang gagal agar koneksi database tidak mengunci
        raise HTTPException(
            status_code=409,
            detail="Kombinasi Tipe, Nilai, dan Scope Blacklist ini sudah terdaftar di data lain!"
        )

    # Log Activity (Sudah disesuaikan ke standar JSONB & Before/After Snapshot)
    log_activity(
        db=db,
        admin=current_admin,
        action_type=ActivityActionEnum.BLACKLIST_UPDATED,
        target_type=TargetType.BLACKLIST,
        target_id=item.id,
        details={
            "before": snapshot_before,
            "after": {
                "value": item.value,
                "type": item.type,
                "service_scope": item.service_scope,
                "reason": item.reason
            }
        }
    )

    return item

# =========================
# BULK IMPORT BLACKLIST
# =========================
@router.post("/bulk", response_model=BlacklistBulkResponse)
def bulk_import_blacklist(
    data: BlacklistBulkRequest,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    success      = 0
    skipped      = 0
    failed       = 0
    skipped_vals = []
    failed_vals  = []

    for item in data.items:
        try:
            normalized_value = item.value.strip().lower()

            exists = db.query(BlacklistItem).filter(
                BlacklistItem.type          == item.type,
                BlacklistItem.value         == normalized_value,
                BlacklistItem.service_scope == item.service_scope.upper(),
            ).first()

            if exists:
                skipped += 1
                skipped_vals.append(item.value)
                continue

            new_item = BlacklistItem(
                value         = normalized_value,
                type          = item.type,
                service_scope = item.service_scope.upper(),
                reason        = item.reason,
                source        = "IMPORT",
                status        = "PENDING",
                is_active     = False,
                added_by      = current_admin.id,
            )
            db.add(new_item)
            db.flush()
            success += 1

        except Exception:
            db.rollback()
            failed += 1
            failed_vals.append(item.value)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Gagal menyimpan bulk import")

    log_activity(
        db,
        current_admin,
        action_type=ActivityActionEnum.BLACKLIST_BULK_IMPORT,
        target_type=TargetType.BLACKLIST,
        target_id=None,
        details={
            "total"  : len(data.items),
            "success": success,
            "skipped": skipped,
            "failed" : failed,
        }
    )

    return {
        "total"         : len(data.items),
        "success"       : success,
        "skipped"       : skipped,
        "failed"        : failed,
        "skipped_values": skipped_vals,
        "failed_values" : failed_vals,
    }


# =========================
# GET BLACKLIST (WITH FILTERS)
# =========================
@router.get("/", response_model=BlacklistListResponse)
def get_blacklist(
    value: str | None = Query(None),
    type: str | None = Query(None),
    service_scope: str | None = Query(None),
    is_active: bool | None = Query(None),
    source: str | None = Query(None),
    status: str | None = Query(None),
    sort_by_hit: str | None = Query(None),  # asc / desc
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    limit = max(1, min(limit, 50))

    query = db.query(BlacklistItem)

    # =========================
    # FILTER
    # =========================
    if value:
        query = query.filter(BlacklistItem.value.ilike(f"%{value.lower()}%"))

    if type:
        query = query.filter(BlacklistItem.type == BlacklistTypeEnum(type))

    if service_scope:
        query = query.filter(
            BlacklistItem.service_scope == service_scope.upper()
        )

    if is_active is not None:
        query = query.filter(BlacklistItem.is_active == is_active)

    if status:
        query = query.filter(BlacklistItem.status == status.upper())

    if source:
        query = query.filter(
            BlacklistItem.source == source.upper()
        )

    # =========================
    # TOTAL (SEBELUM PAGINATION)
    # =========================
    total = query.count()

    # =========================
    # SORTING
    # =========================
    if sort_by_hit == "desc":
        query = query.order_by(BlacklistItem.hit_count.desc())
    elif sort_by_hit == "asc":
        query = query.order_by(BlacklistItem.hit_count.asc())
    else:
        query = query.order_by(BlacklistItem.created_at.desc())

    # =========================
    # PAGINATION
    # =========================
    from sqlalchemy.orm import selectinload
    from app.infrastructure.database.models.admin_model import Admin
    from app.infrastructure.database.models.role_model import Role

    items = query.options(
        selectinload(BlacklistItem.admin).selectinload(Admin.role)
    ).offset(skip).limit(limit).all()

    # Inject added_by info dari relationship admin
    def serialize(item):
        admin_name = None
        admin_role = None
        admin_id   = item.added_by

        if item.admin:
            admin_name = item.admin.full_name
            # Role bisa berupa object dengan field name/role_name
            role_obj = getattr(item.admin, "role", None)
            if role_obj:
                admin_role = getattr(role_obj, "role_name", None) \
                    or getattr(role_obj, "name", None)

        return {
            "id": item.id,
            "value": item.value,
            "type": item.type,
            "service_scope": item.service_scope,
            "reason": item.reason,
            "review_note": item.review_note,
            "is_active": item.is_active,
            "source": item.source,
            "status": item.status,
            "hit_count": item.hit_count,
            "created_at": item.created_at,
            "added_by": admin_id,
            "added_by_name": admin_name,
            "added_by_role": admin_role,
        }

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "data": [serialize(i) for i in items]
    }

# =========================
# DEACTIVATE BLACKLIST
# =========================
@router.patch("/{item_id}/deactivate")
def deactivate_blacklist(item_id: int, db: Session = Depends(get_db), current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))):

    item = db.query(BlacklistItem).filter(BlacklistItem.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Blacklist not found")

    item.is_active = False
    
    log_activity(
        db,
        current_admin,
        action_type=ActivityActionEnum.BLACKLIST_DEACTIVATED,
        target_type=TargetType.BLACKLIST,
        target_id=item.id,
        details="Deactivated blacklist"
    )

    db.commit()
    return {"message": "Blacklist deactivated"}

# =========================
# ACTIVATE BLACKLIST
# =========================
@router.patch("/{item_id}/activate")
def activate_blacklist(item_id: int, db: Session = Depends(get_db), current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))):
    item = db.query(BlacklistItem).filter(BlacklistItem.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Blacklist not found")

    item.is_active = True
    item.status = "APPROVED"

    log_activity(
        db,
        current_admin,
        action_type=ActivityActionEnum.BLACKLIST_ACTIVATED,
        target_type=TargetType.BLACKLIST,
        target_id=item.id,
        details="Activated blacklist"
    )

    db.commit()
    return {"message": "Blacklist activated"}

# =========================
# DELETE BLACKLIST
# =========================
@router.delete("/{item_id}")
def delete_blacklist(item_id: int, db: Session = Depends(get_db), current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))):
    item = db.query(BlacklistItem).filter(BlacklistItem.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Blacklist not found")

    # Ambil ID & data sebelum dihapus untuk logging
    target_id = item.id
    
    db.delete(item)

    # Log Activity
    log_activity(
        db,
        current_admin,
        action_type=ActivityActionEnum.BLACKLIST_DELETED,
        target_type=TargetType.BLACKLIST,
        target_id=target_id,
        details="Deleted blacklist"
    )

    db.commit()
    return {"message": "Blacklist deleted"}