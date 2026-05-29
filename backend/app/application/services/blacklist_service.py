from sqlalchemy import or_, and_
from app.infrastructure.database.models.blacklist_items_model import BlacklistItem
from app.infrastructure.database.enums import BlacklistTypeEnum
from app.infrastructure.repositories.blacklist_repository import BlacklistRepository

# 🔥 IMPORT SERVICE LOG UTAMA & ENUM
from app.application.services.activity_log_service import log_activity
from app.infrastructure.database.enums import ActivityActionEnum, SeverityLevelEnum, EventSourceEnum

def normalize(value: str | None, to_lower: bool = True) -> str | None:
    if value is None:
        return None

    value = str(value).strip()

    if to_lower:
        value = value.lower()

    return value


def run_blacklist_check(db, trx):
    conditions = []

    # =========================
    # USER / CUSTOMER (AGENUSA & NUSABILL)
    # =========================
    if trx.user_account_id:
        user_value = normalize(trx.user_account_id)

        conditions.append(or_(
            and_(
                BlacklistItem.type == BlacklistTypeEnum.USER_ID,
                BlacklistItem.value == user_value
            ),
            and_(
                BlacklistItem.type == BlacklistTypeEnum.CUSTOMER_ID,
                BlacklistItem.value == user_value
            )
        ))

    # =========================
    # IP ADDRESS
    # =========================
    if trx.ip_address:
        ip_value = normalize(trx.ip_address)

        conditions.append(and_(
            BlacklistItem.type == BlacklistTypeEnum.IP_ADDRESS,
            BlacklistItem.value == ip_value
        ))

    # =========================
    # TERMINAL (AGENUSA)
    # =========================
    if trx.terminal_id:
        terminal_value = normalize(trx.terminal_id, to_lower=False)

        conditions.append(and_(
            BlacklistItem.type == BlacklistTypeEnum.TERMINAL_ID,
            BlacklistItem.value == terminal_value
        ))

    # =========================
    # MERCHANT (AGENUSA & NUSABILL)
    # =========================
    if trx.merchant_id:
        merchant_value = normalize(trx.merchant_id, to_lower=False)

        conditions.append(and_(
            BlacklistItem.type == BlacklistTypeEnum.MERCHANT_ID,
            BlacklistItem.value == merchant_value
        ))

    # =========================
    # ACCOUNT NUMBER (AGENUSA)
    # =========================
    account_numbers = []

    if getattr(trx, "account_number", None):
        account_numbers.append(trx.account_number)

    details = trx.transaction_details or {}

    if details.get("issuer_account_number"):
        account_numbers.append(details.get("issuer_account_number"))

    if details.get("dest_account_number"):
        account_numbers.append(details.get("dest_account_number"))

    for acc in account_numbers:
        acc_value = normalize(acc, to_lower=False)

        conditions.append(and_(
            BlacklistItem.type == BlacklistTypeEnum.ACCOUNT_NUMBER,
            BlacklistItem.value == acc_value
        ))

    # =========================
    # NO CONDITIONS
    # =========================
    if not conditions:
        return False, [], 0

    # =========================
    # QUERY BLACKLIST
    # =========================
    blacklist_hit = BlacklistRepository.find_match(
        db,
        conditions,
        trx.service_source
    )

    # =========================
    # RESULT
    # =========================
    if blacklist_hit:
        blacklist_hit.hit_count += 1
        
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
                "blacklist_id": blacklist_hit.id,
                "triggered_by_type": blacklist_hit.type.value,
                "matched_value": blacklist_hit.value,
                "reason_in_blacklist": blacklist_hit.reason,
                "service_scope": blacklist_hit.service_scope,
                "amount": float(trx.amount) if hasattr(trx, "amount") else None
            }
        )
        
        db.commit() 
        
        return True, [{
            "type": "BLACKLIST",
            "name": f"{blacklist_hit.type.value} - {blacklist_hit.reason}",
            "blacklist_id": blacklist_hit.id,
            "identifier_type": blacklist_hit.type.value,
            "value": blacklist_hit.value
        }], 100

    return False, [], 0 