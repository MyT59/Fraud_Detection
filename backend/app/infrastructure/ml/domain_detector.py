from typing import Optional, List

from ...core.logging import get_logger

logger = get_logger(__name__)

# Kolom wajib per domain untuk auto-detect
_AGENUSA_SIGNATURE = {
    "TERMINAL_ID", "MERCHANT_ID", "ACCOUNT_NUMBER", 
    "PROCESSING_CODE", "RESPONSE_CODE", "MTI"
}

_NUSABILL_SIGNATURE = {
    "BILL_ID", "CUSTOMER_ID", "BILL_AMOUNT", 
    "BILL_DATE", "PAYMENT_DATE", "BILL_STATUS"
}

def detect_domain(columns: List[str]) -> Optional[str]:
    # CSV header is case-insensitive; normalize before comparing signatures.
    col_set = {str(column).strip().upper() for column in columns}
    
    score_agenusa = len(_AGENUSA_SIGNATURE & col_set)
    score_nusabill = len(_NUSABILL_SIGNATURE & col_set)
    
    # One generic field is not sufficient to identify a training dataset safely.
    if max(score_agenusa, score_nusabill) < 2:
        logger.warning(
            f"[DOMAIN_DETECT] Tidak ada domain yang cocok — columns={list(col_set)}"
        )
        return None

    # Tentukan domain berdasarkan skor tertinggi
    domain = "agenusa" if score_agenusa >= score_nusabill else "nusabill"
    logger.debug(
        f"[DOMAIN_DETECT] domain={domain} score_agenusa={score_agenusa} "
        f"score_nusabill={score_nusabill}"
    )
    return domain
