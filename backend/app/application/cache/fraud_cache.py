"""
fraud_cache.py
==============
Event-based in-memory cache untuk FraudPattern dan GlobalRule.
Blacklist cache ada di blacklist_cache.py (terpisah karena logic-nya berbeda).

Cara kerja:
  - Cache diisi saat pertama kali dibutuhkan (lazy load)
  - Cache di-invalidate saat ada CRUD pattern/rule
  - Transaksi berikutnya akan re-load dari DB otomatis

Invalidasi dipanggil dari:
  - pattern_service.py / pattern_learning_service.py → invalidate_pattern_cache()
  - rule_service.py                                  → invalidate_rule_cache()

Tidak pakai TTL — cache hanya expire saat ada perubahan data.
Aman untuk single-process FastAPI (uvicorn workers=1).
"""

import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)

_lock           = threading.Lock()
_pattern_cache: list | None = None
_rule_cache:    list | None = None


# ============================================================
# FRAUD PATTERN CACHE
# ============================================================
def get_cached_patterns(db) -> list:
    global _pattern_cache

    if _pattern_cache is not None:
        logger.debug(f"[CACHE] FraudPattern hit — {len(_pattern_cache)} patterns")
        return _pattern_cache

    with _lock:
        if _pattern_cache is not None:
            return _pattern_cache

        from app.infrastructure.database.models.fraud_patterns_model import FraudPattern

        _pattern_cache = (
            db.query(FraudPattern)
            .filter(FraudPattern.is_active == True)
            .order_by(FraudPattern.priority.desc(), FraudPattern.risk_score.desc())
            .all()
        )
        logger.info(f"[CACHE] FraudPattern loaded from DB — {len(_pattern_cache)} patterns")

    return _pattern_cache


def invalidate_pattern_cache():
    global _pattern_cache
    with _lock:
        _pattern_cache = None
    logger.info("[CACHE] FraudPattern cache invalidated")


# ============================================================
# GLOBAL RULE CACHE
# ============================================================
def get_cached_rules(db) -> list:
    global _rule_cache

    if _rule_cache is not None:
        logger.debug(f"[CACHE] GlobalRule hit — {len(_rule_cache)} rules")
        return _rule_cache

    with _lock:
        if _rule_cache is not None:
            return _rule_cache

        from app.infrastructure.database.models.global_rule_model import GlobalRule

        _rule_cache = (
            db.query(GlobalRule)
            .filter(GlobalRule.is_active == True)
            .order_by(GlobalRule.priority.desc())
            .all()
        )
        logger.info(f"[CACHE] GlobalRule loaded from DB — {len(_rule_cache)} rules")

    return _rule_cache


def invalidate_rule_cache():
    global _rule_cache
    with _lock:
        _rule_cache = None
    logger.info("[CACHE] GlobalRule cache invalidated")


# ============================================================
# UTILITY
# ============================================================
def invalidate_all():
    """Kosongkan semua cache sekaligus (misal: saat startup/reset)."""
    invalidate_pattern_cache()
    invalidate_rule_cache()

    # Blacklist cache di modul terpisah
    try:
        from app.application.cache.blacklist_cache import invalidate_blacklist_cache
        invalidate_blacklist_cache()
    except ImportError:
        pass

    logger.info("[CACHE] All caches invalidated")


def cache_status() -> dict[str, Any]:
    """Return status semua cache — untuk debug/monitoring endpoint."""
    bl_status = {"loaded": False, "count": 0}
    try:
        from app.application.cache.blacklist_cache import _blacklist_cache
        bl_status = {
            "loaded": _blacklist_cache is not None,
            "count":  len(_blacklist_cache) if _blacklist_cache is not None else 0,
        }
    except ImportError:
        pass

    return {
        "pattern_cache": {
            "loaded": _pattern_cache is not None,
            "count":  len(_pattern_cache) if _pattern_cache is not None else 0,
        },
        "rule_cache": {
            "loaded": _rule_cache is not None,
            "count":  len(_rule_cache) if _rule_cache is not None else 0,
        },
        "blacklist_cache": bl_status,
    }