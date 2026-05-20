from sqlalchemy.orm import Session
from app.infrastructure.database.models.global_rule_model import GlobalRule
from app.application.services.activity_log_service import log_activity
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
# Menggunakan path sesuai instruksi terbaru
from app.domain.entities.target_type import TargetType 


def create_rule(db: Session, data, admin):
    rule = GlobalRule(**data.dict())
    rule.created_by = admin.id 
    
    db.add(rule)

    try:
        db.flush()

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Rule key already exists"
        )

    log_activity(
        db,
        admin,
        action_type="CREATE_RULE",
        target_type=TargetType.RULE,
        target_id=rule.id,
        details=f"Created rule: {rule.rule_name}"
    )

    db.commit() 
    db.refresh(rule)
    
    return rule


def get_rules(db: Session, filters: dict):
    query = db.query(GlobalRule)

    if filters.get("service_scope"):
        query = query.filter(GlobalRule.service_scope == filters["service_scope"])

    if filters.get("is_active") is not None:
        query = query.filter(GlobalRule.is_active == filters["is_active"])

    if filters.get("rule_group"):
        query = query.filter(GlobalRule.rule_group == filters["rule_group"])

    if filters.get("severity"):
        query = query.filter(GlobalRule.severity == filters["severity"])

    return query.order_by(GlobalRule.priority.desc()).all()


def get_rule_by_id(db: Session, rule_id: int):
    return db.query(GlobalRule).filter(GlobalRule.id == rule_id).first()


def update_rule(db: Session, rule_id: int, data, admin):
    rule = get_rule_by_id(db, rule_id)
    if not rule:
        return None

    for key, value in data.dict(exclude_unset=True).items():
        setattr(rule, key, value)

    db.commit()
    db.refresh(rule)

    # Log Update
    log_activity(
        db,
        admin,
        action_type="UPDATE_RULE",
        target_type=TargetType.RULE,
        target_id=rule.id,
        details=f"Updated rule: {rule.rule_name}"
    )
    db.commit()
    
    return rule

def create_rule_builder_service(db, data, admin):
    rule = GlobalRule(
        rule_name=data.rule_name,
        rule_key=data.rule_key,
        service_scope=data.service_scope,
        rule_config=data.rule_config.dict(),
        action=data.action,
        severity=data.severity,
        priority=data.priority,
        rule_group=data.rule_group,
        description=data.description,
        created_by=admin.id
    )

    db.add(rule)

    try:
        db.flush()

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Rule key already exists"
        )

    log_activity(
        db,
        admin,
        action_type="CREATE_RULE_BUILDER",
        target_type=TargetType.RULE,
        target_id=rule.id,
        details=f"Created builder rule: {rule.rule_name}"
    )
    
    db.commit()
    db.refresh(rule)

    return rule


def toggle_rule(db: Session, rule_id: int, admin):
    rule = get_rule_by_id(db, rule_id)
    if not rule:
        return None

    rule.is_active = not rule.is_active
    db.commit()
    db.refresh(rule)

    # Log Toggle
    log_activity(
        db,
        admin,
        action_type="TOGGLE_RULE",
        target_type=TargetType.RULE,
        target_id=rule.id,
        details=f"{'Activated' if rule.is_active else 'Deactivated'} rule: {rule.rule_name}"
    )
    db.commit()

    return rule


def delete_rule(db: Session, rule_id: int, admin):
    rule = get_rule_by_id(db, rule_id)
    if not rule:
        return None

    # soft delete
    rule.is_active = False
    
    # Log Delete (Soft)
    log_activity(
        db,
        admin,
        action_type="DELETE_RULE",
        target_type=TargetType.RULE,
        target_id=rule.id,
        details=f"Deactivated rule: {rule.rule_name}"
    )
    
    db.commit()
    return True