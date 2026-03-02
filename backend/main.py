from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from fds_engine import DOMAIN_CONFIG, score_history
from isolation_engine import DOMAIN_ISO_CONFIG, score_history_isolation

app = FastAPI()  

DOMAIN_DEFAULT_THRESHOLDS = {
    "agenusa": {"review_threshold": 0.4892, "high_risk_threshold": 0.5},
    "nusabill": {"review_threshold": 0.5202, "high_risk_threshold": 0.9359},
}


@app.get("/")
def root():
    return {
        "status": "API hidup",
        "available_domains": list(DOMAIN_CONFIG.keys()),
        "default_thresholds": DOMAIN_DEFAULT_THRESHOLDS,
    }


class HistoryRequest(BaseModel):
    records: list[dict[str, Any]] = Field(default_factory=list)
    review_threshold: float | None = Field(default=None, gt=0, lt=1)
    high_risk_threshold: float | None = Field(default=None, gt=0, lt=1)


class IsolationHistoryRequest(BaseModel):
    records: list[dict[str, Any]] = Field(default_factory=list)
    review_score_threshold: float | None = None
    high_risk_score_threshold: float | None = None


@app.get("/fds/domains")
def list_domains():
    return {
        "domains": [
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
    }


@app.post("/fds/{domain}/label-history")
def label_history(domain: str, payload: HistoryRequest):
    if domain not in DOMAIN_CONFIG:
        raise HTTPException(status_code=404, detail=f"Domain tidak ditemukan: {domain}")

    threshold_defaults = DOMAIN_DEFAULT_THRESHOLDS.get(domain, {"review_threshold": 0.55, "high_risk_threshold": 0.8})
    review_threshold = payload.review_threshold if payload.review_threshold is not None else threshold_defaults["review_threshold"]
    high_risk_threshold = (
        payload.high_risk_threshold if payload.high_risk_threshold is not None else threshold_defaults["high_risk_threshold"]
    )

    try:
        return score_history(
            domain=domain,
            records=payload.records,
            review_threshold=review_threshold,
            high_risk_threshold=high_risk_threshold,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/isolation/{domain}/score-history")
def score_history_with_isolation(domain: str, payload: IsolationHistoryRequest):
    if domain not in DOMAIN_ISO_CONFIG:
        raise HTTPException(status_code=404, detail=f"Domain isolation tidak ditemukan: {domain}")
    try:
        return score_history_isolation(
            domain=domain,
            records=payload.records,
            review_score_threshold=payload.review_score_threshold,
            high_risk_score_threshold=payload.high_risk_score_threshold,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
