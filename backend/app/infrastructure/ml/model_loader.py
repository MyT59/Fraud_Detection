import json
import joblib
import threading
from typing import Any
from ...paths import MODELS_DIR

DOMAIN_ISO_CONFIG: dict[str, dict[str, Any]] = {
    "agenusa": {
        "model_path": MODELS_DIR / "agenusa_isolation_forest.pkl",
        "meta_path": MODELS_DIR / "agenusa_isolation_meta.json",
        "drop_cols": ["TIMESTAMP_DB", "PREV_TIMESTAMP", "PREV_TERMINAL", "ACCOUNT_NUMBER", "STAN"],
    },
    "nusabill": {
        "model_path": MODELS_DIR / "nusabill_isolation_forest.pkl",
        "meta_path": MODELS_DIR / "nusabill_isolation_meta.json",
        "drop_cols": ["BILL_DATE", "PAYMENT_DATE", "BILL_ID", "CUSTOMER_ID"],
    },
}

# =====================================================================
# THREAD-SAFE MODEL CACHE
# =====================================================================
# Kenapa tidak pakai @lru_cache?
#   - @lru_cache tidak thread-safe saat first load di asyncio.to_thread()
#   - Beberapa thread bisa race condition dan load model berkali-kali
#     sebelum cache terisi
#   - Manual cache + threading.Lock() menjamin hanya 1x load per domain

_model_cache: dict[str, Any] = {}
_meta_cache: dict[str, Any] = {}
_cache_lock = threading.Lock()


def load_isolation_model(domain: str):
    """
    Load Isolation Forest model untuk domain tertentu.
    Model di-cache setelah load pertama — thread-safe.
    Pemanggilan ke-2 dst langsung return dari cache tanpa disk I/O.
    """
    if domain in _model_cache:
        return _model_cache[domain]

    with _cache_lock:
        # Double-check setelah dapat lock (thread lain mungkin sudah load)
        if domain in _model_cache:
            return _model_cache[domain]

        config = DOMAIN_ISO_CONFIG.get(domain)
        if not config:
            raise ValueError(f"Domain tidak dikenal: {domain}")

        model_path = config["model_path"]
        if not model_path.exists():
            raise FileNotFoundError(f"Model isolation tidak ditemukan: {model_path}")

        print(f"\n===== MODEL LOADER (first load) =====")
        print(f"DOMAIN : {domain}")
        print(f"PATH   : {model_path}")
        print(f"=====================================\n")

        _model_cache[domain] = joblib.load(model_path)

    return _model_cache[domain]


def load_isolation_meta(domain: str) -> dict[str, Any]:
    """
    Load metadata model isolation untuk domain tertentu.
    Meta di-cache setelah load pertama — thread-safe.
    """
    if domain in _meta_cache:
        return _meta_cache[domain]

    with _cache_lock:
        if domain in _meta_cache:
            return _meta_cache[domain]

        config = DOMAIN_ISO_CONFIG.get(domain)
        if not config:
            raise ValueError(f"Domain tidak dikenal: {domain}")

        meta_path = config["meta_path"]
        if not meta_path.exists():
            raise FileNotFoundError(f"Meta isolation tidak ditemukan: {meta_path}")

        print(f"\n===== META LOADER (first load) =====")
        print(f"DOMAIN : {domain}")
        print(f"PATH   : {meta_path}")
        print(f"====================================\n")

        _meta_cache[domain] = json.loads(meta_path.read_text(encoding="utf-8"))

    return _meta_cache[domain]