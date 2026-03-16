"""
audit_router.py — Audit Log API

Endpoints:
  POST /audit-logs          — tulis satu log entry baru
  GET  /audit-logs          — list log (filter type, search, pagination)
  GET  /audit-logs/stats    — ringkasan hitungan per type
  DELETE /audit-logs        — hapus semua log (opsional, untuk dev/reset)

Storage: audit_logs.json (tukar dengan DB di production).

Shape satu log entry:
  {
    "id":          "alg-<uuid8>",
    "type":        "create" | "edit" | "suspend" | "delete",
    "actor_name":  "Irwan Setiawan",
    "actor_role":  "superadmin",
    "target_name": "Andi Wijaya",
    "target_role": "admin",
    "detail":      "Mengubah role Andi Wijaya menjadi Admin",
    "timestamp":   "2024-03-13T09:30:00+00:00",
    "time_label":  "13 Mar 2024"
  }
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

STORAGE_PATH = Path(__file__).resolve().parent / "audit_logs.json"
VALID_TYPES  = {"create", "edit", "suspend", "delete"}


# ── Storage helpers ───────────────────────────────────────────────────────────

def _load() -> list[dict[str, Any]]:
    if not STORAGE_PATH.exists():
        STORAGE_PATH.write_text("[]", encoding="utf-8")
    return json.loads(STORAGE_PATH.read_text(encoding="utf-8"))


def _save(logs: list[dict[str, Any]]) -> None:
    STORAGE_PATH.write_text(
        json.dumps(logs, indent=2, ensure_ascii=False), encoding="utf-8"
    )


# ── Schema ────────────────────────────────────────────────────────────────────

class AuditLogCreate(BaseModel):
    type:        Literal["create", "edit", "suspend", "delete"]
    actor_name:  str = Field(..., min_length=1)
    actor_role:  str = "superadmin"
    target_name: str = Field(..., min_length=1)
    target_role: Optional[str] = ""
    detail:      str = Field(..., min_length=1)


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.post("", status_code=201, summary="Tulis log baru")
def create_log(payload: AuditLogCreate) -> dict[str, Any]:
    logs = _load()

    now  = datetime.now(timezone.utc)
    entry: dict[str, Any] = {
        "id":          f"alg-{uuid.uuid4().hex[:8]}",
        "type":        payload.type,
        "actor_name":  payload.actor_name,
        "actor_role":  payload.actor_role,
        "target_name": payload.target_name,
        "target_role": payload.target_role or "",
        "detail":      payload.detail,
        "timestamp":   now.isoformat(),
        "time_label":  now.strftime("%d %b %Y"),
    }

    # Sisipkan di awal supaya GET default urut terbaru
    logs.insert(0, entry)
    _save(logs)

    return {"message": "Log berhasil disimpan", "log": entry}


@router.get("", summary="List semua log")
def list_logs(
    type:      str = Query(default="all"),
    search:    str = Query(default=""),
    page:      int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    logs = _load()

    filtered = logs
    if type != "all" and type in VALID_TYPES:
        filtered = [l for l in filtered if l["type"] == type]
    if search:
        q = search.lower()
        filtered = [
            l for l in filtered
            if q in l.get("detail", "").lower()
            or q in l.get("actor_name", "").lower()
            or q in l.get("target_name", "").lower()
        ]

    total     = len(filtered)
    page_data = filtered[(page - 1) * page_size: page * page_size]

    return {
        "logs":        page_data,
        "total":       total,
        "page":        page,
        "page_size":   page_size,
        "total_pages": max(1, -(-total // page_size)),
        "stats": {
            "total":   len(logs),
            "create":  sum(1 for l in logs if l["type"] == "create"),
            "edit":    sum(1 for l in logs if l["type"] == "edit"),
            "suspend": sum(1 for l in logs if l["type"] == "suspend"),
            "delete":  sum(1 for l in logs if l["type"] == "delete"),
        },
    }


@router.get("/stats", summary="Ringkasan hitungan per type")
def log_stats() -> dict[str, Any]:
    logs = _load()
    return {
        "total":   len(logs),
        "create":  sum(1 for l in logs if l["type"] == "create"),
        "edit":    sum(1 for l in logs if l["type"] == "edit"),
        "suspend": sum(1 for l in logs if l["type"] == "suspend"),
        "delete":  sum(1 for l in logs if l["type"] == "delete"),
    }


@router.delete("", summary="Hapus semua log (dev only)")
def clear_logs() -> dict[str, Any]:
    _save([])
    return {"message": "Semua audit log dihapus"}