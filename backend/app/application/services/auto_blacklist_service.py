"""Automatic blacklist creation for score-confirmed fraud transactions."""

from sqlalchemy.orm import Session

from app.application.cache.blacklist_cache import invalidate_blacklist_cache
from app.application.services.activity_log_service import log_activity
from app.application.services.blacklist_service import normalize_blacklist_value
from app.domain.entities.target_type import TargetType
from app.infrastructure.database.enums import (
    ActivityActionEnum,
    BlacklistTypeEnum,
    EventSourceEnum,
    SeverityLevelEnum,
)
from app.infrastructure.database.models.blacklist_items_model import BlacklistItem


def _identity_for_transaction(trx) -> tuple[BlacklistTypeEnum, str] | None:
    """Select the most stable fraud-control identifier available per source.

    Agenusa's ``customer_ref_number`` is an integration-specific reference and
    is not assumed to be a stable card identifier.  The issuer card/account
    value is preferred because it is the identifier reused by the transaction
    history and blacklist matcher for the same payment instrument.
    """
    if trx.service_source == "AGENUSA":
        details = trx.transaction_details or {}
        card_identifier = details.get("issuer_account_number") or trx.account_number
        if card_identifier:
            blacklist_type = BlacklistTypeEnum.ACCOUNT_NUMBER
            value = normalize_blacklist_value(str(card_identifier), blacklist_type)
            return blacklist_type, value

        # Compatibility fallback for legacy payloads that do not expose a
        # card identifier. It remains traceable as USER_ID in the audit log.
        if trx.user_account_id:
            blacklist_type = BlacklistTypeEnum.USER_ID
            value = normalize_blacklist_value(str(trx.user_account_id), blacklist_type)
            return blacklist_type, value
        return None

    if not trx.user_account_id:
        return None

    blacklist_type = BlacklistTypeEnum.CUSTOMER_ID
    value = normalize_blacklist_value(str(trx.user_account_id), blacklist_type)
    return blacklist_type, value


def auto_blacklist_transaction_identity(db: Session, trx) -> tuple[BlacklistItem | None, bool]:
    """Create or activate the transaction identity as an active system blacklist.

    Returns ``(item, changed)``.  The caller owns the transaction commit; it
    must call :func:`invalidate_auto_blacklist_cache` only after that commit.
    """
    identity = _identity_for_transaction(trx)
    if not identity:
        return None, False

    blacklist_type, value = identity
    item = db.query(BlacklistItem).filter(
        BlacklistItem.type == blacklist_type,
        BlacklistItem.value == value,
        BlacklistItem.service_scope == trx.service_source,
        BlacklistItem.is_deleted == False,
    ).first()

    reason = (
        f"Automatic fraud threshold reached (score={float(trx.risk_score):.0f}) "
        f"from transaction {trx.original_trx_id}."
    )

    if item and item.is_active and item.status == "APPROVED":
        return item, False

    if item is None:
        item = BlacklistItem(
            value=value,
            type=blacklist_type,
            service_scope=trx.service_source,
            reason=reason,
            source="SYSTEM",
            status="APPROVED",
            is_active=True,
            added_by=None,
        )
        db.add(item)
        action = "created"
    else:
        # A pending manual record for the same identity becomes active because
        # the system has now reached its documented auto-fraud threshold.
        item.status = "APPROVED"
        item.is_active = True
        item.source = "SYSTEM"
        item.reason = reason
        item.review_note = "Activated automatically after the fraud threshold was reached."
        action = "activated"

    db.flush()
    log_activity(
        db=db,
        admin=None,
        action_type=ActivityActionEnum.BLACKLIST_CREATED,
        module_source=EventSourceEnum.SYSTEM,
        severity=SeverityLevelEnum.CRITICAL,
        target_type=TargetType.BLACKLIST,
        target_id=item.id,
        details={
            "mode": "AUTO_BLACKLIST",
            "action": action,
            "blacklist_type": blacklist_type.value,
            "value": value,
            "service_scope": trx.service_source,
            "transaction_id": trx.id,
            "original_trx_id": trx.original_trx_id,
            "risk_score": float(trx.risk_score),
        },
    )
    return item, True


def invalidate_auto_blacklist_cache(changed: bool) -> None:
    """Refresh the in-memory matcher after its database transaction commits."""
    if changed:
        invalidate_blacklist_cache()
