from pydantic import BaseModel
from typing import Optional
from typing import List, Union, Optional
from pydantic import BaseModel

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

class RuleResponse(RuleBase):
    id: int
    is_active: bool

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

ConditionGroup.model_rebuild()


class RuleBuilderRequest(BaseModel):
    rule_name: str
    rule_key: str
    service_scope: ServiceScopeEnum = ServiceScopeEnum.ALL

    rule_config: ConditionGroup  # 🔥 JSON logic

    action: RuleActionEnum
    severity: RuleSeverityEnum = RuleSeverityEnum.MEDIUM
    priority: int = 0
    rule_group: Optional[str] = None
    description: Optional[str] = None