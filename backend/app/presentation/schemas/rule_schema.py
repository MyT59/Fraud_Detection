from pydantic import BaseModel, field_validator
from typing import Optional
from typing import List, Union, Optional
from pydantic import BaseModel, model_validator


from app.infrastructure.database.enums import (
    RuleOperatorEnum,
    ServiceScopeEnum,
    RuleActionEnum,
    RuleSeverityEnum,
)


def normalize_rule_action(value):
    raw = value.value if isinstance(value, RuleActionEnum) else value
    raw = str(raw or "FLAG").upper()
    return RuleActionEnum.BLOCK if raw == "BLOCK" else RuleActionEnum.FLAG


class RuleBase(BaseModel):
    rule_name: str
    rule_key: str
    service_scope: ServiceScopeEnum = ServiceScopeEnum.ALL

    condition_field: Optional[str] = None
    operator: Optional[RuleOperatorEnum] = None
    threshold_value: Optional[str] = None
    rule_config: Optional[dict] = None

    action: RuleActionEnum
    severity: RuleSeverityEnum = RuleSeverityEnum.MEDIUM
    priority: int = 0
    rule_group: Optional[str] = None

    description: Optional[str] = None

    @field_validator("action", mode="before")
    @classmethod
    def action_only_block_or_flag(cls, v):
        return normalize_rule_action(v)


class RuleCreate(RuleBase):
    pass


def validate_rule_config_structure(config: dict) -> dict:
    """Reject malformed JSON rules before an update reaches the rule engine."""
    if not isinstance(config, dict):
        raise ValueError("rule_config must be an object")

    keys = set(config)
    if "field" in keys:
        expected = {"field", "operator", "value"}
        if keys != expected:
            raise ValueError("A rule condition must contain only field, operator, and value")
        if not isinstance(config["field"], str) or not config["field"].strip():
            raise ValueError("rule_config.field must be a non-empty string")
        try:
            RuleOperatorEnum(config["operator"])
        except (TypeError, ValueError) as exc:
            raise ValueError("rule_config.operator is invalid") from exc
        if isinstance(config["value"], (dict, list, bool)) or config["value"] is None:
            raise ValueError("rule_config.value must be a string or number")
        return config

    if keys not in ({"AND"}, {"OR"}):
        raise ValueError("A rule group must contain exactly one AND or OR key")

    conditions = config.get("AND") if "AND" in config else config.get("OR")
    if not isinstance(conditions, list) or not conditions:
        raise ValueError("A rule group must contain at least one condition")
    for condition in conditions:
        validate_rule_config_structure(condition)
    return config


class RuleUpdate(BaseModel):
    rule_name: Optional[str] = None
    service_scope: Optional[ServiceScopeEnum] = None

    condition_field: Optional[str] = None
    operator: Optional[RuleOperatorEnum] = None
    threshold_value: Optional[str] = None
    rule_config: Optional[dict] = None

    action: Optional[RuleActionEnum] = None
    severity: Optional[RuleSeverityEnum] = None
    priority: Optional[int] = None
    rule_group: Optional[str] = None

    description: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("action", mode="before")
    @classmethod
    def action_only_block_or_flag(cls, v):
        if v is None:
            return v
        return normalize_rule_action(v)

    @field_validator("rule_config")
    @classmethod
    def rule_config_must_be_evaluable(cls, value):
        if value is None:
            return value
        return validate_rule_config_structure(value)

from datetime import datetime
from typing import Optional

class RuleResponse(RuleBase):
    id: int
    is_active: bool
    is_deleted: bool = False
    hit_count: int = 0
    rule_config: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    created_by: Optional[int] = None
    deleted_by: Optional[int] = None
    created_by_name: Optional[str] = None
    created_by_role: Optional[str] = None

    class Config:
        from_attributes = True

# leaf condition
class Condition(BaseModel):
    field: str
    operator: RuleOperatorEnum
    value: Union[str, int, float]

# recursive group
class ConditionGroup(BaseModel):
    AND: Optional[List[Union["Condition", "ConditionGroup"]]] = None
    OR: Optional[List[Union["Condition", "ConditionGroup"]]] = None

    @model_validator(mode="after")
    def validate_group(self):
        if not self.AND and not self.OR:
            raise ValueError("ConditionGroup must contain AND or OR")
        return self


class RuleBuilderRequest(BaseModel):
    rule_name: str
    rule_key: str
    service_scope: ServiceScopeEnum = ServiceScopeEnum.ALL

    # Menerima single condition (Condition) maupun nested group (ConditionGroup)
    # Pydantic akan mencoba Condition dulu; jika gagal (tidak ada field/operator/value), fallback ke ConditionGroup
    rule_config: Union[Condition, ConditionGroup]

    action: RuleActionEnum
    severity: RuleSeverityEnum = RuleSeverityEnum.MEDIUM
    priority: int = 0
    rule_group: Optional[str] = None
    description: Optional[str] = None

    @field_validator("action", mode="before")
    @classmethod
    def action_only_block_or_flag(cls, v):
        return normalize_rule_action(v)
