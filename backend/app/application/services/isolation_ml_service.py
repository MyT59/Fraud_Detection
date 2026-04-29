from __future__ import annotations

from typing import Any

from isolation_engine import DOMAIN_ISO_CONFIG, score_history_isolation


DOMAIN_DEFAULT_THRESHOLDS = {
    "agenusa": {"review_threshold": 0.4892, "high_risk_threshold": 0.5},
    "nusabill": {"review_threshold": 0.5202, "high_risk_threshold": 0.9359},
}


def get_available_domains() -> list[str]:
    return list(DOMAIN_ISO_CONFIG.keys())


def get_domain_catalog() -> list[dict[str, Any]]:
    return [
        {
            "name": "agenusa",
            "required_fields": [
                "TERMINAL_ID",
                "MERCHANT_ID",
                "ACCOUNT_NUMBER",
                "DEST_ACCOUNT_NUMBER",
                "TIMESTAMP_DB",
                "AMOUNT",
                "STAN",
                "PROCESSING_CODE",
                "RESPONSE_CODE",
                "MTI",
            ],
            "notes": "Deteksi pattern kartu/transfer: midnight, brute-force, terminal switch, mule, amount spike.",
            "default_thresholds": DOMAIN_DEFAULT_THRESHOLDS["agenusa"],
        },
        {
            "name": "nusabill",
            "required_fields": [
                "BILL_ID",
                "CUSTOMER_ID",
                "BILL_AMOUNT",
                "PAYMENT_AMOUNT",
                "BILL_DATE",
                "PAYMENT_DATE",
                "CHANNEL",
                "BILL_STATUS",
                "REFUND_FLAG",
            ],
            "notes": "Deteksi pattern billing: underpay, spike, refund abuse, burst, channel switch.",
            "default_thresholds": DOMAIN_DEFAULT_THRESHOLDS["nusabill"],
        },
    ]


def score_domain_history(
    domain: str,
    records: list[dict[str, Any]],
    review_score_threshold: float | None = None,
    high_risk_score_threshold: float | None = None,
) -> dict[str, Any]:
    if domain not in DOMAIN_ISO_CONFIG:
        raise ValueError(f"Domain isolation tidak ditemukan: {domain}")

    return score_history_isolation(
        domain=domain,
        records=records,
        review_score_threshold=review_score_threshold,
        high_risk_score_threshold=high_risk_score_threshold,
    )
