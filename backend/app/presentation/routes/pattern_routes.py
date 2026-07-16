from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from app.infrastructure.database.session import get_db
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.infrastructure.database.enums import PatternSourceEnum

from app.application.services.pattern_learning_service import (
    generate_patterns_from_reviews,
    save_generated_patterns
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

    return {
        "message": "Pattern candidates generated",
        "generated_count": count
    }


# =========================
# GET ACTIVE PATTERNS
# =========================
@router.get("/", dependencies=[Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER", "FRAUD_ANALYST"))])
@log_performance(label="PatternRoutes.get_active_patterns")
def get_active_patterns(db: Session = Depends(get_db)):
    patterns = db.query(FraudPattern).filter(
        FraudPattern.is_active == True,
        FraudPattern.is_deleted == False,
    ).all()

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
    """Get pattern candidates from manual reviews and retrain ML (inactive only)"""
    patterns = db.query(FraudPattern).filter(
        FraudPattern.is_active == False,
        FraudPattern.is_deleted == False,
        FraudPattern.pattern_source.in_([PatternSourceEnum.MANUAL_REVIEW, PatternSourceEnum.RETRAIN_ML])
    ).all()

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
    db.commit()
    invalidate_pattern_cache()

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
        new_pattern = FraudPattern(
            pattern_name=payload.pattern_name,
            pattern_category=payload.pattern_category,
            pattern_rules=payload.pattern_rules.model_dump(exclude_none=True),
            risk_score=payload.risk_score,
            action=payload.action,
            service_source=payload.service_source,
            pattern_source=PatternSourceEnum.MANUAL_CREATE,
            is_active=payload.is_active,
            priority=payload.priority
        )
        new_pattern.created_by = current_admin.id

        db.add(new_pattern)
        db.commit()
        db.refresh(new_pattern)
        invalidate_pattern_cache()

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

        return new_pattern

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

    for key, value in update_data.items():
        setattr(pattern, key, value)

    db.commit()
    db.refresh(pattern)
    invalidate_pattern_cache()

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
    db.commit()
    invalidate_pattern_cache()

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
    db.commit()
    invalidate_pattern_cache()

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

    return {"message": "Pattern deactivated"}
