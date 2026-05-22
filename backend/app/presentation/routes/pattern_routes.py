from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List

from app.infrastructure.database.session import get_db
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern

from app.application.services.pattern_learning_service import (
    generate_patterns_from_reviews,
    save_generated_patterns
)
from app.application.services.pattern_analytics_service import (
    get_pattern_diagnostics_service,
    get_pattern_effectiveness_service,
    get_pattern_statistics
)
# Assuming this is your import path for log_activity
from app.application.services.activity_log_service import log_activity 
from app.core.rbac import is_risk_manager, require_roles
from app.presentation.schemas.pattern_schema import PatternEffectivenessResponse, PatternDiagnosticsResponse

router = APIRouter(prefix="/patterns", tags=["Pattern Management"])


# =========================
# GENERATE PATTERN (AUTO LEARNING)
# =========================
@router.post("/generate")
def generate_patterns(
    db: Session = Depends(get_db), 
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    patterns = generate_patterns_from_reviews(db)
    count = save_generated_patterns(db, patterns)

    log_activity(
        db,
        current_admin,
        "GENERATE_PATTERN",
        "PATTERN",
        None,
        f"{count} patterns generated"
    )

    return {
        "message": "Pattern candidates generated",
        "generated_count": count
    }


# =========================
# GET ACTIVE PATTERNS
# =========================
@router.get("/", dependencies=[Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))])
def get_active_patterns(db: Session = Depends(get_db)):
    patterns = db.query(FraudPattern).filter(
        FraudPattern.is_active == True
    ).all()

    return [
        {
            "id": p.id,
            "pattern_name": p.pattern_name,
            "category": p.pattern_category,
            "risk_score": p.risk_score,
            "accuracy": p.accuracy_score,
            "action": p.action,
            "service": p.service_source
        }
        for p in patterns
    ]


# =========================
# GET CANDIDATE PATTERNS
# =========================
@router.get("/candidates", dependencies=[Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))])
def get_candidates(db: Session = Depends(get_db)):
    patterns = db.query(FraudPattern).filter(
        FraudPattern.is_active == False
    ).all()

    return [
        {
            "id": p.id,
            "pattern_name": p.pattern_name,
            "category": p.pattern_category,
            "risk_score": p.risk_score,
            "accuracy": p.accuracy_score,
            "action": p.action,
            "service": p.service_source
        }
        for p in patterns
    ]

@router.get("/diagnostics", response_model=PatternDiagnosticsResponse)
def get_pattern_diagnostics(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))  
):
    return get_pattern_diagnostics_service(db)

@router.get("/effectiveness", response_model=List[PatternEffectivenessResponse])
def get_patterns_effectiveness(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER")) 
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
        FraudPattern.id == pattern_id
    ).first()

    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    pattern.is_active = True
    db.commit()

    log_activity(
        db,
        current_admin,
        "ACTIVATE_PATTERN",
        "PATTERN",
        pattern.id,
        pattern.pattern_name
    )

    return {"message": "Pattern activated"}

# =========================
# CREATE PATTERN MANUAL
# =========================
@router.post("/manual")
def create_pattern_manual(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    try:
        new_pattern = FraudPattern(
            pattern_name=payload.get("pattern_name"),
            pattern_category=payload.get("pattern_category"),
            pattern_rules=payload.get("pattern_rules"),
            risk_score=payload.get("risk_score", 40),
            action=payload.get("action", "REVIEW"),
            service_source=payload.get("service_source", "ALL"),
            is_active=payload.get("is_active", True)
        )

        db.add(new_pattern)
        db.commit()
        db.refresh(new_pattern) # Refresh to get the generated ID

        log_activity(
            db,
            current_admin,
            "CREATE_PATTERN",
            "PATTERN",
            new_pattern.id,
            new_pattern.pattern_name
        )

        return {"message": "Pattern created manually"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

# =========================
# UPDATE PATTERN
# =========================
@router.put("/{pattern_id}")
def update_pattern(
    pattern_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    pattern = db.query(FraudPattern).filter(
        FraudPattern.id == pattern_id
    ).first()

    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    pattern.pattern_name = payload.get("pattern_name", pattern.pattern_name)
    pattern.pattern_category = payload.get("pattern_category", pattern.pattern_category)
    pattern.pattern_rules = payload.get("pattern_rules", pattern.pattern_rules)
    pattern.risk_score = payload.get("risk_score", pattern.risk_score)
    pattern.action = payload.get("action", pattern.action)
    pattern.service_source = payload.get("service_source", pattern.service_source)
    pattern.is_active = payload.get("is_active", pattern.is_active)

    db.commit()

    log_activity(
        db,
        current_admin,
        "UPDATE_PATTERN",
        "PATTERN",
        pattern.id,
        f"Updated {pattern.pattern_name}"
    )

    return {"message": "Pattern updated"}

# =========================
# PATTERN STATS
# =========================
@router.get("/stats")
def pattern_stats(
    db: Session = Depends(get_db),
    current_admin = Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
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
        FraudPattern.id == pattern_id
    ).first()

    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    pattern.is_active = False
    db.commit()

    # Opted to use DEACTIVATE_PATTERN log here as requested for deactivation
    log_activity(
        db,
        current_admin,
        "DEACTIVATE_PATTERN",
        "PATTERN",
        pattern.id,
        pattern.pattern_name
    )

    return {"message": "Pattern deactivated (soft delete)"}

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
        FraudPattern.id == pattern_id
    ).first()

    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    pattern.is_active = False
    db.commit()

    log_activity(
        db,
        current_admin,
        "DEACTIVATE_PATTERN",
        "PATTERN",
        pattern.id,
        pattern.pattern_name
    )

    return {"message": "Pattern deactivated"}