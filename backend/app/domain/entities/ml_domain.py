from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MlDomainCatalogItem:
    name: str
    required_fields: list[str]
    notes: str
    default_thresholds: dict[str, float]

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "required_fields": self.required_fields,
            "notes": self.notes,
            "default_thresholds": self.default_thresholds,
        }


DOMAIN_DEFAULT_THRESHOLDS = {
    "agenusa": {"review_threshold": 0.4892, "high_risk_threshold": 0.5},
    "nusabill": {"review_threshold": 0.5202, "high_risk_threshold": 0.9359},
}


ML_DOMAIN_CATALOG = [
    MlDomainCatalogItem(
        name="agenusa",
        required_fields=[
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
        notes="Deteksi pattern kartu/transfer: midnight, brute-force, terminal switch, mule, amount spike.",
        default_thresholds=DOMAIN_DEFAULT_THRESHOLDS["agenusa"],
    ),
    MlDomainCatalogItem(
        name="nusabill",
        required_fields=[
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
        notes="Deteksi pattern billing: underpay, spike, refund abuse, burst, channel switch.",
        default_thresholds=DOMAIN_DEFAULT_THRESHOLDS["nusabill"],
    ),
]
