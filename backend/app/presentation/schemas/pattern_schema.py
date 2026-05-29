from pydantic import BaseModel
from typing import List

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