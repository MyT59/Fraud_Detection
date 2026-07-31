from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Union, Optional


from app.infrastructure.database.enums import (
    RuleOperatorEnum,
    ServiceScopeEnum,
    RuleActionEnum,
    RuleSeverityEnum,
)


RULE_FIELDS = frozenset({
    "amount", "transaction_time", "ip_address", "city", "country",
    "risk_score", "anomaly_score", "risk_level", "merchant_id",
    "terminal_id", "account_number", "transaction_details.issuer_bank",
    "transaction_details.issuer_account_number", "transaction_details.dest_account_number",
    "transaction_details.sof", "transaction_details.channel",
    "transaction_details.bill_amount", "transaction_details.payment_amount",
    "transaction_details.biaya_admin", "transaction_details.bill_status",
})
NUMERIC_RULE_FIELDS = frozenset({
    "amount", "risk_score", "anomaly_score", "transaction_details.bill_amount",
    "transaction_details.payment_amount", "transaction_details.biaya_admin",
})
TEXT_RULE_FIELDS = RULE_FIELDS - NUMERIC_RULE_FIELDS - {"transaction_time"}
UNIVERSAL_RULE_FIELDS = frozenset({
    "amount", "transaction_time", "ip_address", "city", "country",
    "risk_score", "anomaly_score", "risk_level",
})
AGENUSA_RULE_FIELDS = UNIVERSAL_RULE_FIELDS | frozenset({
    "merchant_id", "terminal_id", "account_number",
    "transaction_details.issuer_bank", "transaction_details.issuer_account_number",
    "transaction_details.dest_account_number",
})
NUSABILL_RULE_FIELDS = UNIVERSAL_RULE_FIELDS | frozenset({
    "transaction_details.sof", "transaction_details.channel",
    "transaction_details.bill_amount", "transaction_details.payment_amount",
    "transaction_details.biaya_admin", "transaction_details.bill_status",
})


def normalize_rule_action(value):
    raw = value.value if isinstance(value, RuleActionEnum) else value
    raw = str(raw or "FLAG").upper()
    return RuleActionEnum.BLOCK if raw == "BLOCK" else RuleActionEnum.FLAG


class RuleBase(BaseModel):
    rule_name: str = Field(..., min_length=1, max_length=100)
    rule_key: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9_]+$")
    service_scope: ServiceScopeEnum = ServiceScopeEnum.ALL

    condition_field: Optional[str] = None
    operator: Optional[RuleOperatorEnum] = None
    threshold_value: Optional[str] = None
    rule_config: Optional[dict] = None

    action: RuleActionEnum
    severity: RuleSeverityEnum = RuleSeverityEnum.MEDIUM
    priority: int = Field(default=0, ge=0, le=100)
    rule_group: Optional[str] = Field(default=None, max_length=50)

    description: Optional[str] = None

    @field_validator("action", mode="before")
    @classmethod
    def action_only_block_or_flag(cls, v):
        return normalize_rule_action(v)

    @field_validator("rule_config")
    @classmethod
    def rule_config_must_be_evaluable(cls, value):
        if value is None:
            return value
        return validate_rule_config_structure(value)

    @model_validator(mode="after")
    def requires_complete_condition(self):
        if self.rule_config is not None:
            validate_rule_config_scope(self.rule_config, self.service_scope)
            return self
        if not (self.condition_field and self.operator and self.threshold_value is not None):
            raise ValueError("Rule harus memiliki rule_config atau condition_field, operator, dan threshold_value")
        validate_legacy_condition(self.condition_field, self.operator)
        validate_rule_field_scope(self.condition_field, self.service_scope)
        return self


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
        if config["field"] not in RULE_FIELDS:
            raise ValueError("rule_config.field is not supported by the rule engine")
        try:
            operator = RuleOperatorEnum(config["operator"])
        except (TypeError, ValueError) as exc:
            raise ValueError("rule_config.operator is invalid") from exc
        if isinstance(config["value"], (dict, list, bool)) or config["value"] is None:
            raise ValueError("rule_config.value must be a string or number")
        validate_legacy_condition(config["field"], operator)
        return config

    if keys not in ({"AND"}, {"OR"}):
        raise ValueError("A rule group must contain exactly one AND or OR key")

    conditions = config.get("AND") if "AND" in config else config.get("OR")
    if not isinstance(conditions, list) or not conditions:
        raise ValueError("A rule group must contain at least one condition")
    for condition in conditions:
        validate_rule_config_structure(condition)
    return config


def _allowed_fields_for_scope(service_scope) -> frozenset:
    scope = getattr(service_scope, "value", service_scope)
    if scope == "AGENUSA":
        return AGENUSA_RULE_FIELDS
    if scope == "NUSABILL":
        return NUSABILL_RULE_FIELDS
    return UNIVERSAL_RULE_FIELDS


def validate_rule_field_scope(field: str, service_scope) -> None:
    if field not in _allowed_fields_for_scope(service_scope):
        scope = getattr(service_scope, "value", service_scope)
        raise ValueError(f"{field} is not available for {scope} rules")


def validate_rule_config_scope(config: dict, service_scope) -> None:
    """Keep service-specific payload fields out of the wrong Rule Builder scope."""
    if "field" in config:
        validate_rule_field_scope(config["field"], service_scope)
        return
    conditions = config.get("AND") if "AND" in config else config.get("OR", [])
    for condition in conditions:
        validate_rule_config_scope(condition, service_scope)


def validate_legacy_condition(field: str, operator) -> None:
    """Only numeric/time fields may use ordered comparisons."""
    if field not in RULE_FIELDS:
        raise ValueError("condition_field is not supported by the rule engine")
    raw_operator = operator.value if isinstance(operator, RuleOperatorEnum) else operator
    if field in TEXT_RULE_FIELDS and raw_operator not in {"=", "!="}:
        raise ValueError("Text fields only support = or != operators")


class RuleUpdate(BaseModel):
    rule_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    service_scope: Optional[ServiceScopeEnum] = None

    condition_field: Optional[str] = None
    operator: Optional[RuleOperatorEnum] = None
    threshold_value: Optional[str] = None
    rule_config: Optional[dict] = None

    action: Optional[RuleActionEnum] = None
    severity: Optional[RuleSeverityEnum] = None
    priority: Optional[int] = Field(default=None, ge=0, le=100)
    rule_group: Optional[str] = Field(default=None, max_length=50)

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

    @model_validator(mode="before")
    @classmethod
    def required_fields_cannot_be_null(cls, values):
        for field in ("rule_name", "service_scope", "action", "severity", "priority", "rule_config"):
            if field in values and values[field] is None:
                raise ValueError(f"{field} cannot be null")
        return values

from datetime import datetime
from typing import Optional

class RuleResponse(BaseModel):
    """Read model that remains compatible with rules created before validation hardened.

    Rules already stored in the database must not make the entire listing endpoint
    fail merely because their key or JSON condition uses an old representation.
    Create and update requests continue to use the stricter models above.
    """
    id: int
    rule_name: str
    rule_key: str
    service_scope: ServiceScopeEnum
    condition_field: Optional[str] = None
    operator: Optional[RuleOperatorEnum] = None
    threshold_value: Optional[str] = None
    rule_config: Optional[dict] = None
    action: RuleActionEnum
    severity: RuleSeverityEnum = RuleSeverityEnum.MEDIUM
    priority: int = 0
    rule_group: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    is_deleted: bool = False
    hit_count: int = 0
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

    @field_validator("field")
    @classmethod
    def field_must_be_supported(cls, value):
        if value not in RULE_FIELDS:
            raise ValueError("field is not supported by the rule engine")
        return value

    @model_validator(mode="after")
    def operator_must_match_field(self):
        validate_legacy_condition(self.field, self.operator)
        return self

# recursive group
class ConditionGroup(BaseModel):
    AND: Optional[List[Union["Condition", "ConditionGroup"]]] = None
    OR: Optional[List[Union["Condition", "ConditionGroup"]]] = None

    @model_validator(mode="after")
    def validate_group(self):
        if (self.AND is None) == (self.OR is None):
            raise ValueError("ConditionGroup must contain exactly one AND or OR group")
        if self.AND is not None and not self.AND:
            raise ValueError("AND group must contain at least one condition")
        if self.OR is not None and not self.OR:
            raise ValueError("OR group must contain at least one condition")
        return self


class RuleBuilderRequest(BaseModel):
    rule_name: str = Field(..., min_length=1, max_length=100)
    rule_key: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9_]+$")
    service_scope: ServiceScopeEnum = ServiceScopeEnum.ALL

    # Menerima single condition (Condition) maupun nested group (ConditionGroup)
    # Pydantic akan mencoba Condition dulu; jika gagal (tidak ada field/operator/value), fallback ke ConditionGroup
    rule_config: Union[Condition, ConditionGroup]

    action: RuleActionEnum
    severity: RuleSeverityEnum = RuleSeverityEnum.MEDIUM
    priority: int = Field(default=0, ge=0, le=100)
    rule_group: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = None

    @field_validator("action", mode="before")
    @classmethod
    def action_only_block_or_flag(cls, v):
        return normalize_rule_action(v)

    @model_validator(mode="after")
    def condition_fields_must_match_service_scope(self):
        config = (
            self.rule_config.model_dump(exclude_none=True)
            if hasattr(self.rule_config, "model_dump")
            else self.rule_config.dict(exclude_none=True)
        )
        validate_rule_config_scope(config, self.service_scope)
        return self
