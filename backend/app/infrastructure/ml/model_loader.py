import json
import joblib
from functools import lru_cache
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

@lru_cache(maxsize=4)
def load_isolation_model(domain: str):
    config = DOMAIN_ISO_CONFIG.get(domain)
    if not config:
        raise ValueError(f"Domain tidak dikenal: {domain}")
    model_path = config["model_path"]
    if not model_path.exists():
        raise FileNotFoundError(f"Model isolation tidak ditemukan: {model_path}")
    return joblib.load(model_path)

@lru_cache(maxsize=4)
def load_isolation_meta(domain: str) -> dict[str, Any]:
    config = DOMAIN_ISO_CONFIG.get(domain)
    if not config:
        raise ValueError(f"Domain tidak dikenal: {domain}")
    meta_path = config["meta_path"]
    if not meta_path.exists():
        raise FileNotFoundError(f"Meta isolation tidak ditemukan: {meta_path}")
    return json.loads(meta_path.read_text(encoding="utf-8"))