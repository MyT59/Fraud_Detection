from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.rbac import require_roles
from app.infrastructure.database.session import get_db
from app.application.services.rule_service import (
    create_rule,
    get_rules,
    get_rule_by_id,
    update_rule,
    toggle_rule,
    delete_rule,
    create_rule_builder_service
)

from app.presentation.schemas.rule_schema import (
    RuleCreate,
    RuleUpdate,
    RuleResponse,
    RuleBuilderRequest
)

router = APIRouter(prefix="/rules", tags=["Rule Management"])


@router.post("/", response_model=RuleResponse)
def create_rule_api(data: RuleCreate, db: Session = Depends(get_db), 
                    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))):
    return create_rule(db, data, current_admin)


@router.get("/", response_model=list[RuleResponse])
def get_rules_api(
    service_scope: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    rule_group: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))):
    filters = {
        "service_scope": service_scope,
        "is_active": is_active,
        "rule_group": rule_group,
        "severity": severity,
    }
    return get_rules(db, filters)


@router.get("/{rule_id}", response_model=RuleResponse)
def get_rule_api(rule_id: int, db: Session = Depends(get_db), current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))   ):
    rule = get_rule_by_id(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.put("/{rule_id}", response_model=RuleResponse)
def update_rule_api(rule_id: int, data: RuleUpdate, db: Session = Depends(get_db), current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))):
    rule = update_rule(db, rule_id, data, current_admin)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule

@router.post("/builder", response_model=RuleResponse)
def create_rule_builder(
    data: RuleBuilderRequest,
    db: Session = Depends(get_db),
    current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))
):
    return create_rule_builder_service(db, data, current_admin)

@router.patch("/{rule_id}/toggle", response_model=RuleResponse)
def toggle_rule_api(rule_id: int, db: Session = Depends(get_db), current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))):
    rule = toggle_rule(db, rule_id, current_admin)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.delete("/{rule_id}")
def delete_rule_api(rule_id: int, db: Session = Depends(get_db), current_admin=Depends(require_roles("SUPER_ADMIN", "RISK_MANAGER"))):
    success = delete_rule(db, rule_id, current_admin)
    if not success:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Rule deactivated"}