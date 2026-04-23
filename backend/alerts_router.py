"""
alerts_router.py
────────────────
Router khusus untuk menyimpan dan membaca alert yang dibuat secara
langsung (misal: dari ManualReview setelah keputusan approve/reject).

Endpoint:
    POST /alerts          → simpan 1 alert baru ke alerts_log.json
    GET  /alerts/saved    → baca alerts dari alerts_log.json saja
                        (dipakai oleh _generate_alerts_from_data di main.py)
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["alerts-log"])

# ── Storage ────────────────────────────────────────────────────────────────────
ALERTS_LOG_PATH = Path(__file__).resolve().parent / "alerts_log.json"


def _load_alerts() -> list[dict]:
    if ALERTS_LOG_PATH.exists():
        try:
            return json.loads(ALERTS_LOG_PATH.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def _save_alerts(alerts: list[dict]) -> None:
    ALERTS_LOG_PATH.write_text(
        json.dumps(alerts, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


# ── Pydantic schema ────────────────────────────────────────────────────────────
class AlertIn(BaseModel):
    type:     str           # fraud | blacklist | rule | review | system
    severity: str           # critical | high | medium | low
    title:    str
    message:  str
    txnId:    str | None = None
    status:   str = "unread"


# ── Endpoints ──────────────────────────────────────────────────────────────────
@router.post("/alerts")
def create_alert(alert: AlertIn):
    """
    Simpan satu alert baru (dari ManualReview atau sumber lain) ke
    alerts_log.json.  Alert terbaru selalu ada di posisi paling atas.
    """
    alerts = _load_alerts()

    new_alert = {
        "id":       f"ALT-MR-{uuid.uuid4().hex[:8].upper()}",
        "type":     alert.type,
        "severity": alert.severity,
        "status":   alert.status,
        "title":    alert.title,
        "message":  alert.message,
        "txnId":    alert.txnId,
        "time":     datetime.now().isoformat(),
    }

    alerts.insert(0, new_alert)   # terbaru di atas
    _save_alerts(alerts)

    return {"status": "ok", "alert": new_alert}


@router.get("/alerts/saved")
def get_saved_alerts():
    """
    Kembalikan seluruh isi alerts_log.json (dipakai oleh
    _generate_alerts_from_data di main.py sebagai sumber #0).
    """
    return {"alerts": _load_alerts()}