from __future__ import annotations

from typing import Any

from app.domain.entities.ml_domain import DOMAIN_DEFAULT_THRESHOLDS, ML_DOMAIN_CATALOG


def get_available_domains() -> list[str]:
    return [item.name for item in ML_DOMAIN_CATALOG]


def get_domain_catalog() -> list[dict[str, Any]]:
    return [item.to_dict() for item in ML_DOMAIN_CATALOG]
