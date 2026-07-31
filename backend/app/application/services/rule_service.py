from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from datetime import datetime, timezone

from app.infrastructure.database.models.global_rule_model import GlobalRule
from app.infrastructure.database.models.admin_model import Admin
from app.application.services.activity_log_service import log_activity
from app.application.cache.fraud_cache import invalidate_rule_cache
from app.domain.entities.target_type import TargetType
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
from app.core.logging import get_logger, log_performance
from app.presentation.schemas.rule_schema import (
    validate_rule_config_structure,
    validate_rule_config_scope,
    validate_legacy_condition,
    validate_rule_field_scope,
)

logger = get_logger(__name__)


def _validate_persisted_rule(rule: GlobalRule) -> None:
    """Keep partial updates from leaving an active rule unevaluable at runtime."""
    if rule.rule_config is not None:
        validate_rule_config_structure(rule.rule_config)
        validate_rule_config_scope(rule.rule_config, rule.service_scope)
        return
    if not (rule.condition_field and rule.operator and rule.threshold_value is not None):
        raise HTTPException(
            status_code=422,
            detail="Rule harus memiliki rule_config atau condition_field, operator, dan threshold_value",
        )
    validate_legacy_condition(rule.condition_field, rule.operator)
    validate_rule_field_scope(rule.condition_field, rule.service_scope)


@log_performance(label="RuleService.create_rule")
def create_rule(db: Session, data, admin):
    rule = GlobalRule(**data.dict())
    rule.created_by = admin.id

    db.add(rule)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Rule key already exists")

    log_activity(
        db=db, admin=admin,
        action_type=ActivityActionEnum.RULE_CREATED,
        module_source=EventSourceEnum.RULE_ENGINE,
        severity=SeverityLevelEnum.INFO,
        target_type=TargetType.RULE, target_id=rule.id,
        details={"before": {}, "after": {
            "rule_name": rule.rule_name, "rule_key": rule.rule_key,
            "action": rule.action, "severity": rule.severity,
            "is_active": rule.is_active, "rule_config": rule.rule_config
        }, "reason": "Initial rule creation"}
    )

    db.commit()
    db.refresh(rule)
    invalidate_rule_cache()   # ← cache invalidation
    return rule


@log_performance(label="RuleService.get_rules")
def get_rules(db: Session, filters: dict):
    query = db.query(GlobalRule).options(
        selectinload(GlobalRule.admin).selectinload(Admin.role)
    ).filter(GlobalRule.is_deleted == False)

    if filters.get("service_scope"):
        query = query.filter(GlobalRule.service_scope == filters["service_scope"])
    if filters.get("is_active") is not None:
        query = query.filter(GlobalRule.is_active == filters["is_active"])
    if filters.get("rule_group"):
        query = query.filter(GlobalRule.rule_group == filters["rule_group"])
    if filters.get("severity"):
        query = query.filter(GlobalRule.severity == filters["severity"])

    rules = query.order_by(GlobalRule.priority.desc()).all()

    result = []
    for r in rules:
        admin_name = None
        admin_role = None
        if r.admin:
            admin_name = r.admin.full_name
            role_obj   = getattr(r.admin, "role", None)
            if role_obj:
                admin_role = getattr(role_obj, "role_name", None) or getattr(role_obj, "name", None)
        r.created_by_name = admin_name
        r.created_by_role = admin_role
        result.append(r)

    return result


def get_rule_by_id(db: Session, rule_id: int):
    return db.query(GlobalRule).filter(
        GlobalRule.id == rule_id,
        GlobalRule.is_deleted == False,
    ).first()


@log_performance(label="RuleService.update_rule")
def update_rule(db: Session, rule_id: int, data, admin):
    rule = get_rule_by_id(db, rule_id)
    if not rule:
        return None

    snapshot_before = {
        "rule_name": rule.rule_name, "action": rule.action,
        "severity": rule.severity, "is_active": rule.is_active,
        "rule_config": rule.rule_config
    }

    for key, value in data.dict(exclude_unset=True).items():
        setattr(rule, key, value)
    try:
        _validate_persisted_rule(rule)
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Rule key already exists")
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    snapshot_after = {
        "rule_name": rule.rule_name, "action": rule.action,
        "severity": rule.severity, "is_active": rule.is_active,
        "rule_config": rule.rule_config
    }

    log_activity(
        db=db, admin=admin,
        action_type=ActivityActionEnum.RULE_UPDATED,
        module_source=EventSourceEnum.RULE_ENGINE,
        severity=SeverityLevelEnum.WARNING,
        target_type=TargetType.RULE, target_id=rule.id,
        details={"before": snapshot_before, "after": snapshot_after,
                 "reason": data.dict().get("update_reason", "Manual configuration update via dashboard")}
    )

    db.commit()
    db.refresh(rule)
    invalidate_rule_cache()   # ← cache invalidation
    return rule


@log_performance(label="RuleService.create_rule_builder_service")
def create_rule_builder_service(db, data, admin):
    if hasattr(data.rule_config, "model_dump"):
        rule_config_dict = data.rule_config.model_dump(exclude_none=True)
    else:
        rule_config_dict = data.rule_config.dict(exclude_none=True)

    rule = GlobalRule(
        rule_name=data.rule_name, rule_key=data.rule_key,
        service_scope=data.service_scope, rule_config=rule_config_dict,
        action=data.action, severity=data.severity, priority=data.priority,
        rule_group=data.rule_group, description=data.description,
        created_by=admin.id
    )
    db.add(rule)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Rule key already exists")

    log_activity(
        db=db, admin=admin,
        action_type=ActivityActionEnum.RULE_CREATED,
        module_source=EventSourceEnum.RULE_ENGINE,
        severity=SeverityLevelEnum.INFO,
        target_type=TargetType.RULE, target_id=rule.id,
        details={"before": {}, "after": {"rule_name": rule.rule_name, "rule_config": rule_config_dict},
                 "reason": "Created via rule builder"}
    )

    db.commit()
    db.refresh(rule)
    invalidate_rule_cache()   # ← cache invalidation
    return rule


@log_performance(label="RuleService.toggle_rule")
def toggle_rule(db: Session, rule_id: int, admin):
    rule = get_rule_by_id(db, rule_id)
    if not rule:
        return None

    snapshot_before = {"is_active": rule.is_active}
    rule.is_active = not rule.is_active
    db.flush()

    log_activity(
        db=db, admin=admin,
        action_type=ActivityActionEnum.RULE_UPDATED,
        module_source=EventSourceEnum.RULE_ENGINE,
        severity=SeverityLevelEnum.WARNING,
        target_type=TargetType.RULE, target_id=rule.id,
        details={"before": snapshot_before, "after": {"is_active": rule.is_active},
                 "reason": f"Rule status toggled to {rule.is_active}"}
    )

    db.commit()
    db.refresh(rule)
    invalidate_rule_cache()   # ← cache invalidation
    return rule


@log_performance(label="RuleService.delete_rule")
def delete_rule(db: Session, rule_id: int, admin):
    rule = get_rule_by_id(db, rule_id)
    if not rule:
        return None

    snapshot_before = {"is_active": rule.is_active, "is_deleted": rule.is_deleted}
    rule.is_active = False
    rule.is_deleted = True
    rule.deleted_at = datetime.now(timezone.utc)
    rule.deleted_by = admin.id
    db.flush()

    log_activity(
        db=db, admin=admin,
        action_type=ActivityActionEnum.RULE_DELETED,
        module_source=EventSourceEnum.RULE_ENGINE,
        severity=SeverityLevelEnum.HIGH,
        target_type=TargetType.RULE, target_id=rule.id,
        details={"before": snapshot_before, "after": {
            "is_active": False,
            "is_deleted": True,
            "deleted_by": admin.id,
        },
                 "reason": "Soft deleted by administrator"}
    )

    db.commit()
    invalidate_rule_cache()   # ← cache invalidation
    return True
