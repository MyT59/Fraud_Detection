"""
users_router.py — User Management API untuk Super Admin Panel

Aturan bisnis:
  - Hanya role superadmin yang bisa add, edit, suspend, unsuspend, delete.
  - Jika hanya ada 1 superadmin, dia tidak boleh ubah role-nya sendiri
    menjadi admin / analyst (proteksi agar sistem tidak kehilangan superadmin).
  - Jika superadmin > 1, boleh ubah role diri sendiri.
  - Role yang tersedia: superadmin, admin, analyst (tidak ada support).
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field, field_validator

STORAGE_PATH = Path(__file__).resolve().parent / "users_store.json"

SEED_USERS: list[dict[str, Any]] = [
    {"id":"usr-001","name":"Andi Wijaya","email":"andi.wijaya@nusacita.id","phone":"08111111111","department":"Risk Management","role":"admin","status":"active","createdAt":"01 Jan 2024","lastActive":"10 menit lalu","notes":""},
    {"id":"usr-002","name":"Sari Dewi","email":"sari.dewi@nusacita.id","phone":"08122222222","department":"Fraud Prevention","role":"analyst","status":"active","createdAt":"05 Jan 2024","lastActive":"2 jam lalu","notes":""},
    {"id":"usr-003","name":"Budi Santoso","email":"budi.santoso@nusacita.id","phone":"08133333333","department":"Risk Management","role":"analyst","status":"active","createdAt":"10 Jan 2024","lastActive":"1 hari lalu","notes":""},
    {"id":"usr-004","name":"Maya Indah","email":"maya.indah@nusacita.id","phone":"08144444444","department":"Fraud Prevention","role":"analyst","status":"inactive","createdAt":"15 Jan 2024","lastActive":"3 hari lalu","notes":""},
    {"id":"usr-005","name":"Rizky Pratama","email":"rizky.pratama@nusacita.id","phone":"08155555555","department":"IT Security","role":"admin","status":"active","createdAt":"20 Jan 2024","lastActive":"5 menit lalu","notes":""},
    {"id":"usr-006","name":"Lina Kusuma","email":"lina.kusuma@nusacita.id","phone":"08166666666","department":"Compliance","role":"analyst","status":"suspended","createdAt":"25 Jan 2024","lastActive":"1 minggu lalu","notes":""},
    {"id":"usr-007","name":"Dian Permata","email":"dian.permata@nusacita.id","phone":"08177777777","department":"Operations","role":"analyst","status":"active","createdAt":"01 Feb 2024","lastActive":"30 menit lalu","notes":""},
    {"id":"usr-008","name":"Fajar Nugroho","email":"fajar.nugroho@nusacita.id","phone":"08188888888","department":"Compliance","role":"analyst","status":"active","createdAt":"05 Feb 2024","lastActive":"1 jam lalu","notes":""},
    {"id":"usr-009","name":"Hani Puspita","email":"hani.puspita@nusacita.id","phone":"08199999999","department":"Risk Management","role":"analyst","status":"active","createdAt":"10 Feb 2024","lastActive":"Baru saja","notes":""},
    {"id":"usr-010","name":"Irwan Setiawan","email":"irwan.setiawan@nusacita.id","phone":"08100000000","department":"IT Security","role":"superadmin","status":"active","createdAt":"15 Feb 2024","lastActive":"2 minggu lalu","notes":""},
    {"id":"usr-011","name":"Dewi Rahayu","email":"dewi.rahayu@nusacita.id","phone":"08111222333","department":"IT Security","role":"superadmin","status":"active","createdAt":"20 Feb 2024","lastActive":"1 jam lalu","notes":""},
]


def _load() -> list[dict[str, Any]]:
    if not STORAGE_PATH.exists():
        STORAGE_PATH.write_text(json.dumps(SEED_USERS, indent=2), encoding="utf-8")
    return json.loads(STORAGE_PATH.read_text(encoding="utf-8"))


def _save(users: list[dict[str, Any]]) -> None:
    STORAGE_PATH.write_text(json.dumps(users, indent=2, ensure_ascii=False), encoding="utf-8")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%d %b %Y")


def _superadmin_count(users: list[dict[str, Any]]) -> int:
    return sum(1 for u in users if u.get("role") == "superadmin")


def _require_superadmin(actor_role: str) -> None:
    if actor_role != "superadmin":
        raise HTTPException(status_code=403, detail="Hanya Super Admin yang dapat melakukan operasi ini.")


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name:       str = Field(..., min_length=2, max_length=120)
    email:      EmailStr
    phone:      Optional[str] = ""
    department: Optional[str] = ""
    role:       Literal["superadmin", "admin", "analyst"]
    password:   str = Field(..., min_length=8)
    notes:      Optional[str] = ""

    @field_validator("name")
    @classmethod
    def name_strip(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Nama tidak boleh kosong")
        return v.strip()


class UserUpdate(BaseModel):
    name:       Optional[str]       = None
    email:      Optional[EmailStr]  = None
    phone:      Optional[str]       = None
    department: Optional[str]       = None
    role:       Optional[Literal["superadmin", "admin", "analyst"]] = None
    password:   Optional[str]       = Field(default=None, min_length=8)
    notes:      Optional[str]       = None


class StatusPatch(BaseModel):
    status: Literal["active", "inactive", "suspended"]


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
def list_users(
    search:    str = Query(default=""),
    role:      str = Query(default="all"),
    status:    str = Query(default="all"),
    page:      int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    users = _load()
    filtered = users
    if search:
        q = search.lower()
        filtered = [u for u in filtered if q in u["name"].lower() or q in u["email"].lower()]
    if role != "all":
        filtered = [u for u in filtered if u.get("role") == role]
    if status != "all":
        filtered = [u for u in filtered if u.get("status") == status]

    total     = len(filtered)
    page_data = filtered[(page - 1) * page_size: page * page_size]

    return {
        "users":            page_data,
        "total":            total,
        "page":             page,
        "page_size":        page_size,
        "total_pages":      max(1, -(-total // page_size)),
        "stats": {
            "total":            len(users),
            "superadmin":       sum(1 for u in users if u.get("role") == "superadmin"),
            "admin":            sum(1 for u in users if u.get("role") == "admin"),
            "analyst":          sum(1 for u in users if u.get("role") == "analyst"),
            "active":           sum(1 for u in users if u.get("status") == "active"),
            "inactive":         sum(1 for u in users if u.get("status") == "inactive"),
            "suspended":        sum(1 for u in users if u.get("status") == "suspended"),
            "superadmin_count": _superadmin_count(users),
        },
    }


@router.get("/{user_id}")
def get_user(user_id: str) -> dict[str, Any]:
    users = _load()
    user  = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' tidak ditemukan")
    return {k: v for k, v in user.items() if k != "password_hash"}


@router.post("", status_code=201)
def create_user(
    payload:    UserCreate,
    actor_role: str = Header(default="superadmin", alias="X-Actor-Role"),
) -> dict[str, Any]:
    _require_superadmin(actor_role)
    users = _load()
    if any(u["email"].lower() == payload.email.lower() for u in users):
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")

    new_user: dict[str, Any] = {
        "id":            f"usr-{uuid.uuid4().hex[:8]}",
        "name":          payload.name,
        "email":         payload.email,
        "phone":         payload.phone or "",
        "department":    payload.department or "",
        "role":          payload.role,
        "status":        "active",
        "createdAt":     _now(),
        "lastActive":    "Baru saja",
        "notes":         payload.notes or "",
        "password_hash": f"hashed::{payload.password}",
    }
    users.insert(0, new_user)
    _save(users)
    safe = {k: v for k, v in new_user.items() if k != "password_hash"}
    return {"message": f"Pengguna {payload.name} berhasil dibuat", "user": safe}


@router.put("/{user_id}")
def update_user(
    user_id:    str,
    payload:    UserUpdate,
    actor_id:   str = Header(default="", alias="X-Actor-Id"),
    actor_role: str = Header(default="superadmin", alias="X-Actor-Role"),
) -> dict[str, Any]:
    _require_superadmin(actor_role)
    users = _load()
    idx   = next((i for i, u in enumerate(users) if u["id"] == user_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' tidak ditemukan")

    user = users[idx]

    # Proteksi: superadmin terakhir tidak boleh turunkan role-nya sendiri
    if (
        payload.role is not None
        and payload.role != "superadmin"
        and user.get("role") == "superadmin"
        and user_id == actor_id
        and _superadmin_count(users) <= 1
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Tidak bisa mengubah role. Kamu satu-satunya Super Admin. "
                "Tambah Super Admin lain terlebih dahulu."
            ),
        )

    if payload.email and payload.email.lower() != user["email"].lower():
        if any(u["email"].lower() == payload.email.lower() for u in users if u["id"] != user_id):
            raise HTTPException(status_code=409, detail="Email sudah dipakai user lain")

    update_data = payload.model_dump(exclude_none=True)
    if "password" in update_data:
        user["password_hash"] = f"hashed::{update_data.pop('password')}"
    user.update(update_data)
    users[idx] = user
    _save(users)

    safe = {k: v for k, v in user.items() if k != "password_hash"}
    return {"message": f"Pengguna {user['name']} berhasil diperbarui", "user": safe}


@router.delete("/{user_id}")
def delete_user(
    user_id:    str,
    actor_id:   str = Header(default="", alias="X-Actor-Id"),
    actor_role: str = Header(default="superadmin", alias="X-Actor-Role"),
) -> dict[str, Any]:
    _require_superadmin(actor_role)
    users = _load()
    user  = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' tidak ditemukan")

    if (
        user.get("role") == "superadmin"
        and user_id == actor_id
        and _superadmin_count(users) <= 1
    ):
        raise HTTPException(status_code=409, detail="Tidak bisa menghapus akun. Kamu satu-satunya Super Admin.")

    _save([u for u in users if u["id"] != user_id])
    return {"message": f"Akun {user['name']} berhasil dihapus", "deleted_id": user_id}


@router.patch("/{user_id}/status")
def patch_status(
    user_id:    str,
    payload:    StatusPatch,
    actor_role: str = Header(default="superadmin", alias="X-Actor-Role"),
) -> dict[str, Any]:
    _require_superadmin(actor_role)
    users = _load()
    idx   = next((i for i, u in enumerate(users) if u["id"] == user_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' tidak ditemukan")

    old              = users[idx].get("status", "active")
    users[idx]["status"] = payload.status
    _save(users)

    labels = {"active": "diaktifkan", "inactive": "dinonaktifkan", "suspended": "di-suspend"}
    return {"message": f"Status {users[idx]['name']} berhasil {labels.get(payload.status,'diubah')}", "user_id": user_id, "old_status": old, "new_status": payload.status}