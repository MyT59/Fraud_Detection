"""
blacklist_cache.py
==================
Event-based in-memory cache untuk BlacklistItem.

Karakteristik blacklist sama dengan FraudPattern & GlobalRule:
  - Jarang berubah (hanya saat admin add/approve/delete)
  - Sangat sering dibaca (setiap transaksi masuk)

Strategi cache:
  - Load semua blacklist ACTIVE + APPROVED ke memory saat pertama kali dibutuhkan
  - Evaluasi kondisi dilakukan di Python (in-memory), bukan query DB
  - Cache di-invalidate saat ada CRUD blacklist item

Invalidasi dipanggil dari blacklist CRUD service/route.

Tidak pakai TTL — cache hanya expire saat ada perubahan data.
Aman untuk single-process FastAPI (uvicorn workers=1).
"""

import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)

_lock: threading.Lock = threading.Lock()
_blacklist_cache: list[dict[str, Any]] | None = None   # Cached plain blacklist records


def get_cached_blacklist(db) -> list:
    """
    Return semua BlacklistItem (active + approved) dari cache.
    Jika cache kosong, load dari DB dan simpan ke cache.
    """
    global _blacklist_cache

    if _blacklist_cache is not None:
        logger.debug(f"[CACHE] BlacklistItem hit — {len(_blacklist_cache)} items")
        return _blacklist_cache

    with _lock:
        if _blacklist_cache is not None:
            return _blacklist_cache

        from app.infrastructure.database.models.blacklist_items_model import BlacklistItem

        rows = (
            db.query(BlacklistItem)
            .filter(
                BlacklistItem.is_active == True,
                BlacklistItem.status == "APPROVED"
            )
            .all()
        )

        _blacklist_cache = [
            {
                "id": item.id,
                "service_scope": item.service_scope,
                "type": item.type.value if hasattr(item.type, "value") else str(item.type),
                "value": item.value,
                "reason": item.reason,
                "hit_count": item.hit_count or 0,
            }
            for item in rows
        ]
        logger.info(f"[CACHE] BlacklistItem loaded from DB — {len(_blacklist_cache)} items")

    return _blacklist_cache


def invalidate_blacklist_cache():
    """
    Kosongkan cache BlacklistItem.
    Dipanggil setiap kali ada add/approve/reject/delete blacklist item.
    """
    global _blacklist_cache
    with _lock:
        _blacklist_cache = None
    logger.info("[CACHE] BlacklistItem cache invalidated")


def find_match_from_cache(db, trx) -> Any | None:
    """
    Evaluasi blacklist sepenuhnya di memory — tanpa query DB.

    Logika sama persis dengan BlacklistRepository.find_match() tapi
    menggunakan cached list alih-alih query SQLAlchemy.

    Return: BlacklistItem yang match, atau None.
    """
    from app.infrastructure.database.enums import BlacklistTypeEnum

    items    = get_cached_blacklist(db)
    service  = trx.service_source
    details  = trx.transaction_details or {}

    # Kumpulkan semua nilai yang perlu dicek per type
    check_map: dict[str, list[str]] = {}

    # USER_ID / CUSTOMER_ID
    if trx.user_account_id:
        val = str(trx.user_account_id).strip().lower()
        check_map.setdefault(BlacklistTypeEnum.USER_ID.value, []).append(val)
        check_map.setdefault(BlacklistTypeEnum.CUSTOMER_ID.value, []).append(val)

    # IP_ADDRESS
    if trx.ip_address:
        val = str(trx.ip_address).strip().lower()
        check_map.setdefault(BlacklistTypeEnum.IP_ADDRESS.value, []).append(val)

    # TERMINAL_ID
    if trx.terminal_id:
        val = str(trx.terminal_id).strip()   # tidak lower
        check_map.setdefault(BlacklistTypeEnum.TERMINAL_ID.value, []).append(val)

    # MERCHANT_ID
    if trx.merchant_id:
        val = str(trx.merchant_id).strip()
        check_map.setdefault(BlacklistTypeEnum.MERCHANT_ID.value, []).append(val)

    # ACCOUNT_NUMBER
    acc_nums = []
    if getattr(trx, "account_number", None):
        acc_nums.append(str(trx.account_number).strip())
    if details.get("issuer_account_number"):
        acc_nums.append(str(details["issuer_account_number"]).strip())
    if details.get("dest_account_number"):
        acc_nums.append(str(details["dest_account_number"]).strip())

    if acc_nums:
        check_map[BlacklistTypeEnum.ACCOUNT_NUMBER.value] = acc_nums

    if not check_map:
        return None

    # Evaluasi in-memory
    for item in items:
        # Filter service scope
        if item["service_scope"] != "ALL" and item["service_scope"] != service:
            continue

        item_type  = item["type"]
        item_value = str(item["value"]).strip()

        candidates = check_map.get(item_type, [])
        for candidate in candidates:
            # IP & user → case-insensitive (sudah lower di check_map)
            # terminal & merchant & account → case-sensitive
            if item_type in (
                BlacklistTypeEnum.IP_ADDRESS.value,
                BlacklistTypeEnum.USER_ID.value,
                BlacklistTypeEnum.CUSTOMER_ID.value,
            ):
                if item_value.lower() == candidate:
                    return item
            else:
                if item_value == candidate:
                    return item

    return None