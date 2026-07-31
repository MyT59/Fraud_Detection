from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from app.infrastructure.database.session import get_db
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.infrastructure.database.enums import PatternSourceEnum

from app.application.services.pattern_learning_service import (
    generate_patterns_from_reviews,
    save_generated_patterns,
    generate_rules_hash,
    find_duplicate_pattern,
)
from app.application.services.pattern_analytics_service import (
    get_pattern_diagnostics_service,
    get_pattern_effectiveness_service,
    get_pattern_statistics
)
from app.application.services.activity_log_service import log_activity 
from app.application.cache.fraud_cache import invalidate_pattern_cache
from app.core.rbac import is_risk_manager, require_roles
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
from app.domain.entities.target_type import TargetType
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)
from app.presentation.schemas.pattern_schema import (
    PatternEffectivenessResponse,
    PatternDiagnosticsResponse,
    PatternCreateRequest,
    PatternUpdateRequest,
    PatternResponse,
)

router = APIRouter(prefix="/patterns", tags=["Pattern Management"])


# =========================
# GENERATE PATTERN (AUTO LEARNING)
# =========================
@router.post("/generate")
@log_performance(label="PatternRoutes.generate_patterns")
def generate_patterns(
    db: Session = Depends(get_db), 
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    patterns = generate_patterns_from_reviews(db)
    count = save_generated_patterns(db, patterns, source=PatternSourceEnum.MANUAL_REVIEW)

    log_activity(
        db=db,
        admin=current_admin,
        action_type=ActivityActionEnum.PATTERN_CREATED,
        module_source=EventSourceEnum.PATTERN_ENGINE,
        severity=SeverityLevelEnum.INFO,
        target_type=TargetType.PATTERN,
        target_id=None,
        details={"generated_count": count, "reason": "Auto pattern generation from manual reviews"}
    )
    db.commit()
    invalidate_pattern_cache()

    return {
        "message": "Pattern candidates generated",
        "generated_count": count
    }


# =========================
# GET ACTIVE PATTERNS
# =========================
@router.get("/categories", dependencies=[Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))])
def get_pattern_categories(db: Session = Depends(get_db)):
    """Return every category currently used by a non-deleted fraud pattern.

    Reports need this list to include custom categories and inactive patterns,
    not just the categories represented by the active-engine cache.
    """
    rows = (
        db.query(FraudPattern.pattern_category)
        .filter(
            FraudPattern.is_deleted == False,
            FraudPattern.pattern_category.isnot(None),
        )
        .distinct()
        .all()
    )
    return sorted(
        {str(row[0]).strip() for row in rows if str(row[0]).strip()},
        key=str.casefold,
    )


@router.get("/", dependencies=[Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))])
@log_performance(label="PatternRoutes.get_active_patterns")
def get_active_patterns(db: Session = Depends(get_db)):
    patterns = db.query(FraudPattern).filter(
        FraudPattern.is_active == True,
        FraudPattern.is_deleted == False,
    ).order_by(FraudPattern.priority.desc(), FraudPattern.id.asc()).all()

    return [
        {
            "id": p.id,
            "pattern_name": p.pattern_name,
            "category": p.pattern_category,
            "pattern_category": p.pattern_category,
            "risk_score": p.risk_score,
            "accuracy": p.accuracy_score,
            "accuracy_score": p.accuracy_score,
            "false_positive_rate": p.false_positive_rate,
            "true_positive": p.true_positive,
            "false_positive": p.false_positive,
            "hit_count": p.hit_count,
            "action": p.action,
            "service": p.service_source,
            "service_source": p.service_source,
            "priority": p.priority,
            "pattern_rules": p.pattern_rules,
            "is_active": p.is_active,
            "is_deleted": p.is_deleted,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            "disabled_at": p.disabled_at.isoformat() if p.disabled_at else None,
        }
        for p in patterns
    ]


# =========================
# GET CANDIDATE PATTERNS
# =========================
@router.get("/candidates", dependencies=[Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))])
def get_candidates(db: Session = Depends(get_db)):
    """Get all inactive, non-deleted patterns so they can be reactivated."""
    patterns = db.query(FraudPattern).filter(
        FraudPattern.is_active == False,
        FraudPattern.is_deleted == False,
    ).order_by(FraudPattern.priority.desc(), FraudPattern.id.asc()).all()

    return [
        {
            "id": p.id,
            "pattern_name": p.pattern_name,
            "category": p.pattern_category,
            "pattern_category": p.pattern_category,
            "risk_score": p.risk_score,
            "accuracy": p.accuracy_score,
            "accuracy_score": p.accuracy_score,
            "false_positive_rate": p.false_positive_rate,
            "true_positive": p.true_positive,
            "false_positive": p.false_positive,
            "hit_count": p.hit_count,
            "action": p.action,
            "service": p.service_source,
            "service_source": p.service_source,
            "priority": p.priority,
            "pattern_rules": p.pattern_rules,
            "is_active": p.is_active,
            "is_deleted": p.is_deleted,
            "pattern_source": p.pattern_source.value if p.pattern_source else "MANUAL_CREATE",
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            "disabled_at": p.disabled_at.isoformat() if p.disabled_at else None,
        }
        for p in patterns
    ]

@router.get("/diagnostics", response_model=PatternDiagnosticsResponse)
def get_pattern_diagnostics(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))  
):
    return get_pattern_diagnostics_service(db)

@router.get("/effectiveness", response_model=List[PatternEffectivenessResponse])
def get_patterns_effectiveness(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST")) 
):
    return get_pattern_effectiveness_service(db)


# =========================
# ACTIVATE PATTERN
# =========================
@router.patch("/{pattern_id}/activate")
def activate_pattern(
    pattern_id: int, 
    db: Session = Depends(get_db), 
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    pattern = db.query(FraudPattern).filter(
        FraudPattern.id == pattern_id,
        FraudPattern.is_deleted == False,
    ).first()

    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    pattern.is_active = True
    pattern.disabled_at = None

    log_activity(
        db=db,
        admin=current_admin,
        action_type=ActivityActionEnum.PATTERN_ACTIVATED,
        module_source=EventSourceEnum.PATTERN_ENGINE,
        severity=SeverityLevelEnum.INFO,
        target_type=TargetType.PATTERN,
        target_id=pattern.id,
        details={"pattern_name": pattern.pattern_name, "reason": "Manual activation by admin"}
    )
    db.commit()
    invalidate_pattern_cache()

    return {"message": "Pattern activated"}

# =========================
# CREATE PATTERN MANUAL
# =========================
@router.post("/manual", response_model=PatternResponse)
def create_pattern_manual(
    payload: PatternCreateRequest,
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    try:
        pattern_rules = payload.pattern_rules.model_dump(exclude_none=True)
        rules_hash = generate_rules_hash(pattern_rules)
        if find_duplicate_pattern(
            db,
            rules_hash,
            payload.service_source,
            pattern_rules=pattern_rules,
        ):
            raise HTTPException(
                status_code=409,
                detail="Pattern dengan kondisi dan service yang sama sudah tersedia",
            )

        new_pattern = FraudPattern(
            pattern_name=payload.pattern_name,
            pattern_category=payload.pattern_category,
            pattern_rules=pattern_rules,
            rules_hash=rules_hash,
            risk_score=payload.risk_score,
            action=payload.action,
            service_source=payload.service_source,
            pattern_source=PatternSourceEnum.MANUAL_CREATE,
            is_active=payload.is_active,
            priority=payload.priority
        )
        new_pattern.created_by = current_admin.id

        db.add(new_pattern)
        db.flush()

        log_activity(
            db=db,
            admin=current_admin,
            action_type=ActivityActionEnum.PATTERN_CREATED,
            module_source=EventSourceEnum.PATTERN_ENGINE,
            severity=SeverityLevelEnum.INFO,
            target_type=TargetType.PATTERN,
            target_id=new_pattern.id,
            details={"before": {}, "after": {
                "pattern_name": new_pattern.pattern_name,
                "pattern_category": new_pattern.pattern_category,
                "pattern_rules": new_pattern.pattern_rules,
                "risk_score": new_pattern.risk_score,
                "action": new_pattern.action,
                "service_source": new_pattern.service_source,
                "is_active": new_pattern.is_active
            }, "reason": "Manual pattern creation via dashboard"}
        )
        db.commit()
        db.refresh(new_pattern)
        invalidate_pattern_cache()

        return new_pattern

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

# =========================
# UPDATE PATTERN
# =========================
@router.put("/{pattern_id}", response_model=PatternResponse)
def update_pattern(
    pattern_id: int,
    payload: PatternUpdateRequest,
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    pattern = db.query(FraudPattern).filter(
        FraudPattern.id == pattern_id,
        FraudPattern.is_deleted == False,
    ).first()

    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    snapshot_before = {
        "pattern_name": pattern.pattern_name,
        "pattern_category": pattern.pattern_category,
        "pattern_rules": pattern.pattern_rules,
        "risk_score": pattern.risk_score,
        "action": pattern.action,
        "service_source": pattern.service_source,
        "is_active": pattern.is_active,
        "priority": pattern.priority,
    }

    update_data = payload.model_dump(exclude_unset=True)
    if "pattern_rules" in update_data and update_data["pattern_rules"]:
        update_data["pattern_rules"] = payload.pattern_rules.model_dump(exclude_none=True)
        new_hash = generate_rules_hash(update_data["pattern_rules"])
        service_source = update_data.get("service_source", pattern.service_source)
        if find_duplicate_pattern(
            db,
            new_hash,
            service_source,
            exclude_id=pattern.id,
            pattern_rules=update_data["pattern_rules"],
        ):
            raise HTTPException(
                status_code=409,
                detail="Pattern dengan kondisi dan service yang sama sudah tersedia",
            )
        update_data["rules_hash"] = new_hash
    elif "service_source" in update_data:
        current_hash = pattern.rules_hash or generate_rules_hash(pattern.pattern_rules)
        if find_duplicate_pattern(
            db,
            current_hash,
            update_data["service_source"],
            exclude_id=pattern.id,
            pattern_rules=pattern.pattern_rules,
        ):
            raise HTTPException(
                status_code=409,
                detail="Pattern dengan kondisi dan service yang sama sudah tersedia",
            )
        update_data["rules_hash"] = current_hash

    for key, value in update_data.items():
        setattr(pattern, key, value)

    # Keep lifecycle metadata consistent when the general edit form changes
    # status instead of using the dedicated activate/deactivate endpoints.
    if "is_active" in update_data:
        if pattern.is_active:
            pattern.disabled_at = None
        elif snapshot_before["is_active"]:
            pattern.disabled_at = datetime.now(timezone.utc)

    db.flush()

    snapshot_after = {
        "pattern_name": pattern.pattern_name,
        "pattern_category": pattern.pattern_category,
        "pattern_rules": pattern.pattern_rules,
        "risk_score": pattern.risk_score,
        "action": pattern.action,
        "service_source": pattern.service_source,
        "is_active": pattern.is_active,
        "priority": pattern.priority,
    }

    log_activity(
        db=db,
        admin=current_admin,
        action_type=ActivityActionEnum.PATTERN_UPDATED,
        module_source=EventSourceEnum.PATTERN_ENGINE,
        severity=SeverityLevelEnum.WARNING,
        target_type=TargetType.PATTERN,
        target_id=pattern.id,
        details={"before": snapshot_before, "after": snapshot_after, "reason": "Manual pattern update via dashboard"}
    )
    db.commit()
    db.refresh(pattern)
    invalidate_pattern_cache()

    return pattern

# =========================
# PATTERN STATS
# =========================
@router.get("/stats")
def pattern_stats(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))
):
    return get_pattern_statistics(db)

# =========================
# DELETE PATTERN (SOFT DELETE)
# =========================
@router.delete("/{pattern_id}")
def delete_pattern(
    pattern_id: int, 
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    pattern = db.query(FraudPattern).filter(
        FraudPattern.id == pattern_id,
        FraudPattern.is_deleted == False,
    ).first()

    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    pattern.is_active = False
    pattern.is_deleted = True
    pattern.disabled_at = datetime.now(timezone.utc)
    pattern.deleted_at = pattern.disabled_at
    pattern.deleted_by = current_admin.id

    # Opted to use PATTERN_DEACTIVATED log here as requested for deactivation
    log_activity(
        db=db,
        admin=current_admin,
        action_type=ActivityActionEnum.PATTERN_DEACTIVATED,
        module_source=EventSourceEnum.PATTERN_ENGINE,
        severity=SeverityLevelEnum.HIGH,
        target_type=TargetType.PATTERN,
        target_id=pattern.id,
        details={"pattern_name": pattern.pattern_name, "reason": "Soft delete via dashboard"}
    )
    db.commit()
    invalidate_pattern_cache()

    return {"message": "Pattern soft deleted"}

# =========================
# DEACTIVATE PATTERN
# =========================
@router.patch("/{pattern_id}/deactivate")
def deactivate_pattern(
    pattern_id: int, 
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    pattern = db.query(FraudPattern).filter(
        FraudPattern.id == pattern_id,
        FraudPattern.is_deleted == False,
    ).first()

    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    pattern.is_active = False
    pattern.disabled_at = datetime.now(timezone.utc)

    log_activity(
        db=db,
        admin=current_admin,
        action_type=ActivityActionEnum.PATTERN_DEACTIVATED,
        module_source=EventSourceEnum.PATTERN_ENGINE,
        severity=SeverityLevelEnum.HIGH,
        target_type=TargetType.PATTERN,
        target_id=pattern.id,
        details={"pattern_name": pattern.pattern_name, "reason": "Manual deactivation via dashboard"}
    )
    db.commit()
    invalidate_pattern_cache()

    return {"message": "Pattern deactivated"}
