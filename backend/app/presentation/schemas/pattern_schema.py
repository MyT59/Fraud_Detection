from pydantic import BaseModel, field_validator
from typing import List, Optional, Union, Literal

# =========================
# PATTERN CREATE / UPDATE
# =========================

class PatternCondition(BaseModel):
    field: str
    operator: Literal["==", "!=", ">", "<", ">=", "<=", "IN", "NOT_IN"]
    value: Union[str, int, float, bool, list]


class PatternRules(BaseModel):
    logic: Literal["AND", "OR"] = "AND"
    time_window_minutes: Optional[int] = None
    conditions: List[PatternCondition]

    @field_validator("conditions")
    @classmethod
    def conditions_not_empty(cls, v):
        if not v:
            raise ValueError("conditions tidak boleh kosong")
        return v


class PatternCreateRequest(BaseModel):
    pattern_name: str
    pattern_category: Optional[str] = None
    service_source: Literal["ALL", "AGENUSA", "NUSABILL"] = "ALL"
    action: Literal["FLAG", "REVIEW", "BLOCK"] = "REVIEW"
    risk_score: int = 50
    priority: int = 1
    is_active: bool = True
    pattern_rules: PatternRules

    @field_validator("risk_score")
    @classmethod
    def risk_score_range(cls, v):
        if not 1 <= v <= 100:
            raise ValueError("risk_score harus antara 1 dan 100")
        return v

    @field_validator("priority")
    @classmethod
    def priority_range(cls, v):
        if not 1 <= v <= 10:
            raise ValueError("priority harus antara 1 dan 10")
        return v


class PatternUpdateRequest(BaseModel):
    pattern_name: Optional[str] = None
    pattern_category: Optional[str] = None
    service_source: Optional[Literal["ALL", "AGENUSA", "NUSABILL"]] = None
    action: Optional[Literal["FLAG", "REVIEW", "BLOCK"]] = None
    risk_score: Optional[int] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    pattern_rules: Optional[PatternRules] = None

    @field_validator("risk_score")
    @classmethod
    def risk_score_range(cls, v):
        if v is not None and not 1 <= v <= 100:
            raise ValueError("risk_score harus antara 1 dan 100")
        return v

    @field_validator("priority")
    @classmethod
    def priority_range(cls, v):
        if v is not None and not 1 <= v <= 10:
            raise ValueError("priority harus antara 1 dan 10")
        return v


class PatternResponse(BaseModel):
    id: int
    pattern_name: str
    pattern_category: Optional[str]
    service_source: str
    action: str
    risk_score: int
    priority: int
    is_active: bool
    hit_count: int
    accuracy_score: Optional[float]
    false_positive_rate: Optional[float]

    class Config:
        from_attributes = True


class PatternEffectivenessResponse(BaseModel):
    pattern_name: str
    true_positive: int
    false_positive: int
    accuracy_score: float

class NoisyPatternItem(BaseModel):
    id: int
    name: str
    false_positives: int

class WorstAccuracyPatternItem(BaseModel):
    id: int
    name: str
    accuracy: float

class SystemSuggestionItem(BaseModel):
    pattern_id: int
    pattern_name: str
    suggestion_type: str
    reason: str

# Skema utama penampung data diagnostik makro
class PatternDiagnosticsResponse(BaseModel):
    noisy_patterns: List[NoisyPatternItem]
    worst_accuracy_patterns: List[WorstAccuracyPatternItem]
    system_suggestions: List[SystemSuggestionItem]