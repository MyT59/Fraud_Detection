from pydantic import BaseModel
from typing import Optional
from typing import List, Union, Optional
from pydantic import BaseModel, model_validator


from app.infrastructure.database.enums import (
    RuleOperatorEnum,
    ServiceScopeEnum,
    RuleActionEnum,
    RuleSeverityEnum,
)


class RuleBase(BaseModel):
    rule_name: str
    rule_key: str
    service_scope: ServiceScopeEnum = ServiceScopeEnum.ALL

    condition_field: Optional[str] = None
    operator: Optional[RuleOperatorEnum] = None
    threshold_value: Optional[str] = None

    action: RuleActionEnum
    severity: RuleSeverityEnum = RuleSeverityEnum.MEDIUM
    priority: int = 0
    rule_group: Optional[str] = None

    description: Optional[str] = None


class RuleCreate(RuleBase):
    pass


class RuleUpdate(BaseModel):
    rule_name: Optional[str] = None
    service_scope: Optional[ServiceScopeEnum] = None

    condition_field: Optional[str] = None
    operator: Optional[RuleOperatorEnum] = None
    threshold_value: Optional[str] = None

    action: Optional[RuleActionEnum] = None
    severity: Optional[RuleSeverityEnum] = None
    priority: Optional[int] = None
    rule_group: Optional[str] = None

    description: Optional[str] = None
    is_active: Optional[bool] = None

from datetime import datetime
from typing import Optional

class RuleResponse(RuleBase):
    id: int
    is_active: bool
    hit_count: int = 0
    rule_config: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
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