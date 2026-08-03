from datetime import datetime
from typing import List, Literal, Optional, Union

from pydantic import BaseModel, field_validator, model_validator

# These names mirror the runtime registry in pattern_engine_service. Keeping
# validation here prevents a saved pattern from silently evaluating False.
STATIC_FIELDS = {
    "amount", "service_source",
    "PROCESSING_CODE", "RESPONSE_CODE", "IS_NIGHT_TX",
    "AMOUNT_OVER_AVG_RATIO", "IS_DECLINED", "GAP_MINUTES",
    "dest_account_number", "PAYMENT_GAP_MINUTES", "PAYMENT_TO_BILL_RATIO",
    "CHANNEL", "CHANNEL_API_FLAG", "PAYMENT_DELAY_DAYS",
    "TERMINAL_SWITCH_FAST", "CHANNEL_SWITCH_TO_API",
}
WINDOW_FIELDS = {
    "tx_count", "total_amount", "distinct_account_count",
    "distinct_customer_count", "distinct_customer_name_count",
    "failure_count", "has_success_after_failure",
    "chain_decline_success_burst",
}
KNOWN_FIELDS = STATIC_FIELDS | WINDOW_FIELDS
BOOLEAN_FIELDS = {
    "has_success_after_failure", "chain_decline_success_burst",
}


class PatternCondition(BaseModel):
    field: str
    operator: Literal["==", "!=", ">", "<", ">=", "<=", "IN", "NOT_IN"]
    value: Union[str, int, float, bool, list]

    @field_validator("field")
    @classmethod
    def field_is_supported(cls, value):
        value = value.strip()
        if value not in KNOWN_FIELDS:
            raise ValueError(f"field pattern tidak didukung: {value}")
        return value

    @model_validator(mode="after")
    def operator_matches_value(self):
        if self.operator in {"IN", "NOT_IN"}:
            if not isinstance(self.value, list) or not self.value:
                raise ValueError(f"operator {self.operator} membutuhkan value list yang tidak kosong")
        elif isinstance(self.value, list):
            raise ValueError("value list hanya boleh digunakan dengan operator IN atau NOT_IN")

        if self.field in BOOLEAN_FIELDS and self.operator not in {"==", "!=", "IN", "NOT_IN"}:
            raise ValueError("field boolean hanya mendukung operator ==, !=, IN, atau NOT_IN")
        return self


class PatternRules(BaseModel):
    logic: Literal["AND", "OR"] = "AND"
    time_window_minutes: Optional[int] = None
    conditions: List[PatternCondition]

    @field_validator("time_window_minutes")
    @classmethod
    def window_range(cls, value):
        if value is not None and not 1 <= value <= 1440:
            raise ValueError("time_window_minutes harus antara 1 dan 1440")
        return value

    @field_validator("conditions")
    @classmethod
    def conditions_not_empty(cls, value):
        if not value:
            raise ValueError("conditions tidak boleh kosong")
        return value

    @model_validator(mode="after")
    def window_matches_fields(self):
        has_window_field = any(item.field in WINDOW_FIELDS for item in self.conditions)
        if has_window_field and self.time_window_minutes is None:
            raise ValueError("time_window_minutes wajib untuk field agregasi/window")
        if not has_window_field and self.time_window_minutes is not None:
            raise ValueError("time_window_minutes hanya boleh dipakai dengan field agregasi/window")
        return self


def normalize_pattern_action(value):
    value = str(value or "FLAG").upper()
    return "BLOCK" if value == "BLOCK" else "FLAG"


class PatternCreateRequest(BaseModel):
    pattern_name: str
    pattern_category: Optional[str] = None
    service_source: Literal["ALL", "AGENUSA", "NUSABILL"] = "ALL"
    action: Literal["FLAG", "BLOCK"] = "FLAG"
    risk_score: int = 50
    priority: int = 1
    is_active: bool = True
    pattern_rules: PatternRules

    @field_validator("pattern_name")
    @classmethod
    def valid_name(cls, value):
        value = value.strip()
        if not value or len(value) > 100:
            raise ValueError("pattern_name wajib diisi dan maksimal 100 karakter")
        return value

    @field_validator("pattern_category")
    @classmethod
    def normalize_category(cls, value):
        return value.strip() if value and value.strip() else None

    @field_validator("risk_score")
    @classmethod
    def risk_score_range(cls, value):
        if not 1 <= value <= 100:
            raise ValueError("risk_score harus antara 1 dan 100")
        return value

    @field_validator("action", mode="before")
    @classmethod
    def action_only_block_or_flag(cls, value):
        return normalize_pattern_action(value)

    @field_validator("priority")
    @classmethod
    def priority_range(cls, value):
        if not 1 <= value <= 10:
            raise ValueError("priority harus antara 1 dan 10")
        return value


class PatternUpdateRequest(BaseModel):
    pattern_name: Optional[str] = None
    pattern_category: Optional[str] = None
    service_source: Optional[Literal["ALL", "AGENUSA", "NUSABILL"]] = None
    action: Optional[Literal["FLAG", "BLOCK"]] = None
    risk_score: Optional[int] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    pattern_rules: Optional[PatternRules] = None

    @field_validator("pattern_name")
    @classmethod
    def valid_name(cls, value):
        if value is None:
            return value
        value = value.strip()
        if not value or len(value) > 100:
            raise ValueError("pattern_name wajib diisi dan maksimal 100 karakter")
        return value

    @field_validator("pattern_category")
    @classmethod
    def normalize_category(cls, value):
        return value.strip() if value and value.strip() else None

    @field_validator("risk_score")
    @classmethod
    def risk_score_range(cls, value):
        if value is not None and not 1 <= value <= 100:
            raise ValueError("risk_score harus antara 1 dan 100")
        return value

    @field_validator("action", mode="before")
    @classmethod
    def action_only_block_or_flag(cls, value):
        return normalize_pattern_action(value) if value is not None else value

    @field_validator("priority")
    @classmethod
    def priority_range(cls, value):
        if value is not None and not 1 <= value <= 10:
            raise ValueError("priority harus antara 1 dan 10")
        return value


class PatternResponse(BaseModel):
    id: int
    pattern_name: str
    pattern_category: Optional[str]
    service_source: str
    action: str
    risk_score: int
    priority: int
    is_active: bool
    is_deleted: bool = False
    hit_count: int
    accuracy_score: Optional[float]
    false_positive_rate: Optional[float]
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[int] = None

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


class PatternDiagnosticsResponse(BaseModel):
    noisy_patterns: List[NoisyPatternItem]
    worst_accuracy_patterns: List[WorstAccuracyPatternItem]
    system_suggestions: List[SystemSuggestionItem]
