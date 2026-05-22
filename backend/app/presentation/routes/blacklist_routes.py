from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.application.services.activity_log_service import log_activity
from app.domain.entities.target_type import TargetType
from app.core.rbac import require_roles
from app.infrastructure.database.session import get_db
from app.infrastructure.database.models.blacklist_items_model import BlacklistItem
from app.presentation.schemas.blacklist_schema import (
    BlacklistCreateRequest,
    BlacklistResponse,
    BlacklistListResponse,
    BlacklistReviewSchema,
    BlacklistTypeEnum
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
        is_active=False
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
        action_type="CREATE_BLACKLIST",
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
        action_type="APPROVE_BLACKLIST",
        target_type=TargetType.BLACKLIST,
        target_id=item.id,
        details=f"Approved blacklist: {payload.review_note}"
    )

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
        action_type="REJECT_BLACKLIST",
        target_type=TargetType.BLACKLIST,
        target_id=item.id,
        details=f"Rejected blacklist: {payload.review_note}"
    )

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
        action_type="UPDATE_BLACKLIST",
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
    items = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "data": items
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
    
    # Log Activity
    log_activity(
        db,
        current_admin,
        action_type="DEACTIVATE_BLACKLIST",
        target_type=TargetType.BLACKLIST,
        target_id=item.id,
        details="Deactivated blacklist"
    )

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

    # Log Activity
    log_activity(
        db,
        current_admin,
        action_type="ACTIVATE_BLACKLIST",
        target_type=TargetType.BLACKLIST,
        target_id=item.id,
        details="Activated blacklist"
    )

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
        action_type="DELETE_BLACKLIST",
        target_type=TargetType.BLACKLIST,
        target_id=target_id,
        details="Deleted blacklist"
    )

    return {"message": "Blacklist deleted"}