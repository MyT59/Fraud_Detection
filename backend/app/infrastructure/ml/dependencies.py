from __future__ import annotations

from functools import lru_cache

from app.application.use_cases.score_isolation_history import ScoreIsolationHistoryUseCase
from app.infrastructure.ml.isolation_scoring_repository import SklearnIsolationScoringRepository
from ...core.logging import get_logger

logger = get_logger(__name__)


@lru_cache(maxsize=1)
def get_score_isolation_history_use_case() -> ScoreIsolationHistoryUseCase:
    logger.debug("[ML_DI] Membuat ScoreIsolationHistoryUseCase (singleton, lru_cache)")
    repo = SklearnIsolationScoringRepository()
    return ScoreIsolationHistoryUseCase(repo)