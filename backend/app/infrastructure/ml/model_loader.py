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
        "meta_path": MODELS_DIR / "agenusa_isolation_meta.json",
        "drop_cols": ["TIMESTAMP_DB", "PREV_TIMESTAMP", "PREV_TERMINAL", "ACCOUNT_NUMBER", "STAN"],
        "contamination": 0.08,
    },
    "nusabill": {
        "model_path": MODELS_DIR / "nusabill_isolation_forest.pkl",
        "meta_path": MODELS_DIR / "nusabill_isolation_meta.json",
        "drop_cols": ["BILL_DATE", "PAYMENT_DATE", "BILL_ID", "CUSTOMER_ID", "NO_REKENING"],
        "contamination": 0.10,
    },
}

_model_cache: dict[str, Any] = {}
_meta_cache: dict[str, Any] = {}
_model_mtime_cache: dict[str, int] = {}
_meta_mtime_cache: dict[str, int] = {}
_cache_lock = threading.Lock()


def _mtime(path) -> int | None:
    return path.stat().st_mtime_ns if path.exists() else None


def invalidate_model_cache(domain: str) -> None:
    """Remove local cache entries after a successful model promotion."""
    with _cache_lock:
        _model_cache.pop(domain, None)
        _meta_cache.pop(domain, None)
        _model_mtime_cache.pop(domain, None)
        _meta_mtime_cache.pop(domain, None)
    logger.info(f"[MODEL] Cache invalidated â€” domain={domain}")


@log_performance(label="ML.load_isolation_model")
def load_isolation_model(domain: str):
    config = DOMAIN_ISO_CONFIG.get(domain)
    if not config:
        raise ValueError(f"Domain tidak dikenal: {domain}")
    model_path = config["model_path"]
    current_mtime = _mtime(model_path)

    if domain in _model_cache and _model_mtime_cache.get(domain) == current_mtime:
        return _model_cache[domain]

    with _cache_lock:
        current_mtime = _mtime(model_path)
        if domain in _model_cache and _model_mtime_cache.get(domain) == current_mtime:
            return _model_cache[domain]
        if current_mtime is None:
            raise FileNotFoundError(f"Model isolation tidak ditemukan: {model_path}")
        _model_cache[domain] = joblib.load(model_path)
        _model_mtime_cache[domain] = current_mtime
        logger.info(f"[MODEL] Loaded â€” domain={domain} path={model_path}")
    return _model_cache[domain]


@log_performance(label="ML.load_isolation_meta")
def load_isolation_meta(domain: str) -> dict[str, Any]:
    config = DOMAIN_ISO_CONFIG.get(domain)
    if not config:
        raise ValueError(f"Domain tidak dikenal: {domain}")
    meta_path = config["meta_path"]
    current_mtime = _mtime(meta_path)

    if domain in _meta_cache and _meta_mtime_cache.get(domain) == current_mtime:
        return _meta_cache[domain]

    with _cache_lock:
        current_mtime = _mtime(meta_path)
        if domain in _meta_cache and _meta_mtime_cache.get(domain) == current_mtime:
            return _meta_cache[domain]
        if current_mtime is None:
            raise FileNotFoundError(f"Meta isolation tidak ditemukan: {meta_path}")
        _meta_cache[domain] = json.loads(meta_path.read_text(encoding="utf-8"))
        _meta_mtime_cache[domain] = current_mtime
        logger.info(f"[META] Loaded â€” domain={domain} path={meta_path}")
    return _meta_cache[domain]
