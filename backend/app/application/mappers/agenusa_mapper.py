from datetime import datetime
from zoneinfo import ZoneInfo


BUSINESS_TIMEZONE = ZoneInfo("Asia/Jakarta")


def _as_wib(value):
    """Raw switching_logs timestamps from the existing table are often naive.

    They represent the operational time entered by the simulator (WIB), not
    UTC. Attach the business timezone before the shared transaction pipeline
    sees them so it does not add another seven-hour shift.
    """
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=BUSINESS_TIMEZONE)
    return value


def map_agenusa(data: dict):
    return {
        "original_trx_id": data.get("rrn"),
        "service_source": "AGENUSA",
        "user_account_id": data.get("customer_ref_number"),
        "amount": float(data.get("amount", 0)),
        "transaction_time": _as_wib(data.get("timestamp_db")),
        "transaction_status": "INGESTED",
        "terminal_id": data.get("terminal_id"),
        "merchant_id": data.get("merchant_id"),
        "account_number": data.get("account_number"),
        "ip_address": data.get("ip_address"),
        "city": data.get("city") or "Jakarta",
        "country": data.get("country") or "ID",

        "transaction_details": {
            "stan": data.get("stan"),
            "mti": data.get("mti"),
            "msg_raw": data.get("msg_raw"),
            "processing_code": data.get("processing_code"),
            "msg_type": data.get("msg_type"),
            "response_code": data.get("response_code"),
            "dest_account_number": data.get("dest_account_number"),
            "issuer_bank": data.get("issuer_bank"),
            "dest_bank_code": data.get("dest_bank_code"),
            "acquirer_code": data.get("acquirer_code"),
            "issuer_account_number": data.get("issuer_account_number"),
            "de7": data.get("de7"),
            "de12": data.get("de12"),
            "de13": data.get("de13"),
            "fep_id": data.get("fep_id")
        }
    }
