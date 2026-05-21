from sqlalchemy.orm import Session
from app.infrastructure.database.models.global_rule_model import GlobalRule
from app.application.services.activity_log_service import log_activity
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
# Menggunakan path sesuai instruksi terbaru
from app.domain.entities.target_type import TargetType
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum


def create_rule(db: Session, data, admin):
    rule = GlobalRule(**data.dict())
    rule.created_by = admin.id 
    
    db.add(rule)
    try:
        db.flush()  # Ambil ID tanpa commit dulu
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Rule key already exists")

    # Capture state awal (After)
    snapshot_after = {
        "rule_name": rule.rule_name,
        "rule_key": rule.rule_key,
        "action": rule.action,
        "severity": rule.severity,
        "is_active": rule.is_active,
        "rule_config": rule.rule_config
    }

    log_activity(
        db=db,
        admin=admin,
        action_type=ActivityActionEnum.RULE_CREATED,
        module_source=EventSourceEnum.RULE_ENGINE,
        severity=SeverityLevelEnum.INFO,
        target_type=TargetType.RULE,
        target_id=rule.id,
        details={"before": {}, "after": snapshot_after, "reason": "Initial rule creation"}
    )

    db.commit()  # Single transaction commit untuk rule + activity log
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

    # 1. Simpan State SEBELUM Perubahan (Before Snapshot)
    snapshot_before = {
        "rule_name": rule.rule_name,
        "action": rule.action,
        "severity": rule.severity,
        "is_active": rule.is_active,
        "rule_config": rule.rule_config
    }

    # 2. Lakukan Mutasi Data
    for key, value in data.dict(exclude_unset=True).items():
        setattr(rule, key, value)
    
    db.flush()

    # 3. Simpan State SESUDAH Perubahan (After Snapshot)
    snapshot_after = {
        "rule_name": rule.rule_name,
        "action": rule.action,
        "severity": rule.severity,
        "is_active": rule.is_active,
        "rule_config": rule.rule_config
    }

    # 4. Catat ke Log dengan format terstruktur
    log_activity(
        db=db,
        admin=admin,
        action_type=ActivityActionEnum.RULE_UPDATED,
        module_source=EventSourceEnum.RULE_ENGINE,
        severity=SeverityLevelEnum.WARNING,  # Modifikasi rule bernilai sensitif
        target_type=TargetType.RULE,
        target_id=rule.id,
        details={
            "before": snapshot_before,
            "after": snapshot_after,
            "reason": data.dict().get("update_reason", "Manual configuration update via dashboard")
        }
    )
    
    db.commit()  # Commit tunggal mencegah partial failure
    db.refresh(rule)
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

    snapshot_before = {"is_active": rule.is_active}
    
    rule.is_active = not rule.is_active
    db.flush()

    snapshot_after = {"is_active": rule.is_active}

    log_activity(
        db=db,
        admin=admin,
        action_type=ActivityActionEnum.RULE_UPDATED,
        module_source=EventSourceEnum.RULE_ENGINE,
        severity=SeverityLevelEnum.WARNING,
        target_type=TargetType.RULE,
        target_id=rule.id,
        details={
            "before": snapshot_before,
            "after": snapshot_after,
            "reason": f"Rule status toggled to {rule.is_active}"
        }
    )
    
    db.commit()
    db.refresh(rule)
    return rule


def delete_rule(db: Session, rule_id: int, admin):
    rule = get_rule_by_id(db, rule_id)
    if not rule:
        return None

    snapshot_before = {"is_active": rule.is_active}
    
    # Soft delete sesuai standar enterprise FDS
    rule.is_active = False
    db.flush()
    
    snapshot_after = {"is_active": rule.is_active}

    log_activity(
        db=db,
        admin=admin,
        action_type=ActivityActionEnum.RULE_DELETED,
        module_source=EventSourceEnum.RULE_ENGINE,
        severity=SeverityLevelEnum.HIGH,  
        target_type=TargetType.RULE,
        target_id=rule.id,
        details={
            "before": snapshot_before,
            "after": snapshot_after,
            "reason": "Soft deleted by administrator"
        }
    )
    
    db.commit()
    return True