import json
import joblib
import threading
from typing import Any
from ...paths import MODELS_DIR
from ...core.logging import get_logger, log_performance

logger = get_logger(__name__)

DOMAIN_ISO_CONFIG: dict[str, dict[str, Any]] = {
    "agenusa": {
        "model_path": MODELS_DIR / "agenusa_isolation_forest.pkl",
        "meta_path":  MODELS_DIR / "agenusa_isolation_meta.json",
        "drop_cols":  ["TIMESTAMP_DB", "PREV_TIMESTAMP", "PREV_TERMINAL", "ACCOUNT_NUMBER", "STAN"],
    },
    "nusabill": {
        "model_path": MODELS_DIR / "nusabill_isolation_forest.pkl",
        "meta_path":  MODELS_DIR / "nusabill_isolation_meta.json",
        "drop_cols":  ["BILL_DATE", "PAYMENT_DATE", "BILL_ID", "CUSTOMER_ID"],
    },
}

# =====================================================================
# THREAD-SAFE MODEL CACHE
# =====================================================================
_model_cache: dict[str, Any] = {}
_meta_cache:  dict[str, Any] = {}
_cache_lock = threading.Lock()


def invalidate_model_cache(domain: str) -> None:
    """Remove a domain's cached model and metadata after a successful retrain."""
    with _cache_lock:
        _model_cache.pop(domain, None)
        _meta_cache.pop(domain, None)

    logger.info(f"[MODEL] Cache invalidated — domain={domain}")


@log_performance(label="ML.load_isolation_model")
def load_isolation_model(domain: str):
    """
    Load Isolation Forest model untuk domain tertentu.
    Model di-cache setelah load pertama — thread-safe.
    Pemanggilan ke-2 dst langsung return dari cache tanpa disk I/O.
    """
    if domain in _model_cache:
        logger.debug(f"[MODEL] Cache hit — domain={domain}")
        return _model_cache[domain]

    with _cache_lock:
        if domain in _model_cache:
            logger.debug(f"[MODEL] Cache hit (after lock) — domain={domain}")
            return _model_cache[domain]

        config = DOMAIN_ISO_CONFIG.get(domain)
        if not config:
            logger.error(f"[MODEL] Domain tidak dikenal — domain={domain}")
            raise ValueError(f"Domain tidak dikenal: {domain}")

        model_path = config["model_path"]
        if not model_path.exists():
            logger.error(f"[MODEL] File model tidak ditemukan — domain={domain} path={model_path}")
            raise FileNotFoundError(f"Model isolation tidak ditemukan: {model_path}")

        logger.info(f"[MODEL] First load — domain={domain} path={model_path}")
        _model_cache[domain] = joblib.load(model_path)

    return _model_cache[domain]


@log_performance(label="ML.load_isolation_meta")
def load_isolation_meta(domain: str) -> dict[str, Any]:
    """
    Load metadata model isolation untuk domain tertentu.
    Meta di-cache setelah load pertama — thread-safe.
    """
    if domain in _meta_cache:
        logger.debug(f"[META] Cache hit — domain={domain}")
        return _meta_cache[domain]

    with _cache_lock:
        if domain in _meta_cache:
            logger.debug(f"[META] Cache hit (after lock) — domain={domain}")
            return _meta_cache[domain]

        config = DOMAIN_ISO_CONFIG.get(domain)
        if not config:
            logger.error(f"[META] Domain tidak dikenal — domain={domain}")
            raise ValueError(f"Domain tidak dikenal: {domain}")

        meta_path = config["meta_path"]
        if not meta_path.exists():
            logger.error(f"[META] File meta tidak ditemukan — domain={domain} path={meta_path}")
            raise FileNotFoundError(f"Meta isolation tidak ditemukan: {meta_path}")

        logger.info(f"[META] First load — domain={domain} path={meta_path}")
        _meta_cache[domain] = json.loads(meta_path.read_text(encoding="utf-8"))

    return _meta_cache[domain]
