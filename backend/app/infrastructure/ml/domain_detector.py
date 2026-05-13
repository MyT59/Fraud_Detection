from typing import Optional, List

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
    """
    Auto-detect domain dari kolom dataset.
    Return 'agenusa', 'nusabill', atau None jika tidak cocok.
    """
    col_set = set(columns)
    
    score_agenusa = len(_AGENUSA_SIGNATURE & col_set)
    score_nusabill = len(_NUSABILL_SIGNATURE & col_set)
    
    # Jika tidak ada irisan sama sekali dengan kedua signature
    if score_agenusa == 0 and score_nusabill == 0:
        return None
        
    # Tentukan domain berdasarkan skor tertinggi
    return "agenusa" if score_agenusa >= score_nusabill else "nusabill"