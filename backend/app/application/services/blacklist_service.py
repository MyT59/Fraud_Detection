"""
blacklist_service.py
====================
Optimasi:
  - Hapus db.commit() — commit dilakukan sekali di process_transaction()
  - Gunakan find_match_from_cache() — evaluasi in-memory tanpa query DB
  - Tambah timing detail: Query vs Log
"""

import logging
import time

from app.application.services.activity_log_service import log_activity
from app.application.cache.blacklist_cache import find_match_from_cache, invalidate_blacklist_cache
from app.infrastructure.database.enums import (
    BlacklistTypeEnum, ActivityActionEnum, SeverityLevelEnum, EventSourceEnum
)

logger = logging.getLogger(__name__)


def normalize(value: str | None, to_lower: bool = True) -> str | None:
    if value is None:
        return None
    value = str(value).strip()
    if to_lower:
        value = value.lower()
    return value


def run_blacklist_check(db, trx):
    # ── Timing detail ────────────────────────────────────────
    t0 = time.perf_counter()

    # ── P4: evaluasi in-memory dari cache, bukan query DB ───
    blacklist_hit = find_match_from_cache(db, trx)

    t1 = time.perf_counter()

    if not blacklist_hit:
        logger.debug(f"[BLACKLIST] No hit | query={round(t1-t0,4)}s")
        return False, [], 0

    # ── Hit: update hit_count (tidak commit di sini) ────────
    blacklist_hit.hit_count = (blacklist_hit.hit_count or 0) + 1

    log_activity(
        db=db,
        admin=None,
        action_type=ActivityActionEnum.BLACKLIST_HIT,
        module_source=EventSourceEnum.BLACKLIST,
        severity=SeverityLevelEnum.CRITICAL,
        target_type="TRANSACTION",
        target_id=str(trx.original_trx_id),
        ip_address=getattr(trx, "ip_address", None),
        details={
            "blacklist_id":         blacklist_hit.id,
            "triggered_by_type":    blacklist_hit.type.value,
            "matched_value":        blacklist_hit.value,
            "reason_in_blacklist":  blacklist_hit.reason,
            "service_scope":        blacklist_hit.service_scope,
            "amount":               float(trx.amount) if hasattr(trx, "amount") else None
        }
    )

    t2 = time.perf_counter()

    logger.info(
        f"[BLACKLIST] HIT type={blacklist_hit.type.value} value={blacklist_hit.value} | "
        f"cache_lookup={round(t1-t0,4)}s | log={round(t2-t1,4)}s | "
        f"total={round(t2-t0,4)}s"
    )

    # ── TIDAK ada db.commit() di sini ───────────────────────
    # Commit dilakukan sekali di process_transaction()

    return True, [{
        "type":            "BLACKLIST",
        "name":            f"{blacklist_hit.type.value} - {blacklist_hit.reason}",
        "blacklist_id":    blacklist_hit.id,
        "identifier_type": blacklist_hit.type.value,
        "value":           blacklist_hit.value
    }], 100