"""
simulator_routes.py
===================
Endpoint khusus simulasi transaksi untuk keperluan demo sidang.

Flow:
  POST /simulator/generate
    → generator insert ke switching_logs / invoice_transactions
    → DataAggregationService.process_all() / process_agenusa() / process_nusabill()
    → return ringkasan hasil

Daftarkan di main.py:
    from app.presentation.routes.simulator_routes import router as simulator_router
    app.include_router(simulator_router)
"""

import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Literal

from app.infrastructure.database.session import get_db
from app.infrastructure.repositories.switching_log_repository import SwitchingLogRepository
from app.infrastructure.repositories.invoice_transaction_repository import InvoiceTransactionRepository
from app.application.services.data_aggregation_service import DataAggregationService

from simulator.agenusa_generator import get_all_scenarios as agenusa_scenarios
from simulator.nusabill_generator import get_all_scenarios as nusabill_scenarios, _to_db as nusabill_to_db

router = APIRouter(prefix="/simulator", tags=["Simulator"])


# ============================================================
# REQUEST SCHEMA
# ============================================================
class SimulateRequest(BaseModel):
    domain: Literal["agenusa", "nusabill", "all"] = "all"
    scenario: str | None = None  
    # Jika None → jalankan semua skenario untuk domain yg dipilih
    # Jika diisi → jalankan 1 skenario spesifik, contoh: "bruteforce"


# ============================================================
# RESPONSE SCHEMA
# ============================================================
class SimulateResponse(BaseModel):
    status: str
    domain: str
    scenario: str
    injected: dict      # { scenario_name: jumlah_record_diinsert }
    processed: dict     # { "agenusa": N, "nusabill": N, "total": N }


# ============================================================
# HELPERS
# ============================================================
def _inject_agenusa(db: Session, records: list[dict]) -> int:
    repo = SwitchingLogRepository(db)
    repo.bulk_create(records)
    return len(records)


def _inject_nusabill(db: Session, records: list[dict]) -> int:
    repo = InvoiceTransactionRepository(db)
    repo.bulk_create([nusabill_to_db(r) for r in records])
    return len(records)


def _get_scenario_records(
    domain: str,
    scenario: str | None
) -> tuple[dict[str, list], dict[str, list]]:
    """
    Return (agenusa_batches, nusabill_batches)
    masing-masing dict { scenario_name: [records] }
    """
    agenusa_batches: dict[str, list] = {}
    nusabill_batches: dict[str, list] = {}

    if domain in ("agenusa", "all"):
        all_ag = agenusa_scenarios()
        if scenario:
            if scenario not in all_ag:
                raise HTTPException(
                    status_code=400,
                    detail=f"Skenario '{scenario}' tidak ditemukan untuk domain agenusa. "
                           f"Pilihan: {list(all_ag.keys())}"
                )
            agenusa_batches = {scenario: all_ag[scenario]}
        else:
            agenusa_batches = all_ag

    if domain in ("nusabill", "all"):
        all_nb = nusabill_scenarios()
        if scenario:
            if scenario not in all_nb:
                raise HTTPException(
                    status_code=400,
                    detail=f"Skenario '{scenario}' tidak ditemukan untuk domain nusabill. "
                           f"Pilihan: {list(all_nb.keys())}"
                )
            nusabill_batches = {scenario: all_nb[scenario]}
        else:
            nusabill_batches = all_nb

    return agenusa_batches, nusabill_batches


# ============================================================
# MAIN ENDPOINT
# ============================================================
@router.post("/generate", response_model=SimulateResponse)
async def generate_transactions(
    payload: SimulateRequest,
    db: Session = Depends(get_db)
):
    """
    Inject data simulasi ke switching_logs / invoice_transactions,
    lalu proses semua record unprocessed via DataAggregationService.

    **domain**: `"agenusa"` | `"nusabill"` | `"all"` (default)

    **scenario** (opsional): nama skenario spesifik, misal `"bruteforce"`.
    Jika tidak diisi, semua skenario dijalankan sekaligus.

    **Skenario Agenusa:**
    normal, blacklist_ip, blacklist_account, bruteforce,
    decline_velocity, super_pattern, fan_in, midnight_spike,
    velocity_burst, money_mule, terminal_switch_fast, high_amount

    **Skenario Nusabill:**
    normal, blacklist_ip, blacklist_customer, fan_out_spam,
    burst_payment, high_spike, velocity_burst,
    early_payment_anomaly, high_amount
    """
    try:
        agenusa_batches, nusabill_batches = _get_scenario_records(
            payload.domain, payload.scenario
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membangun skenario: {str(e)}")

    # ── 1. INJECT KE UPSTREAM TABLES ────────────────────────────────────
    injected: dict[str, int] = {}

    try:
        for name, records in agenusa_batches.items():
            if records:
                shuffled = records.copy()
                random.shuffle(shuffled)
                count = _inject_agenusa(db, shuffled)
                injected[f"agenusa:{name}"] = count

        for name, records in nusabill_batches.items():
            if records:
                shuffled = records.copy()
                random.shuffle(shuffled)
                count = _inject_nusabill(db, shuffled)
                injected[f"nusabill:{name}"] = count

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal insert ke database: {str(e)}"
        )

    # ── 2. PROSES VIA AGGREGATION SERVICE ───────────────────────────────
    try:
        svc = DataAggregationService(db)

        if payload.domain == "agenusa":
            ag = await svc.process_agenusa()
            processed = {"agenusa": ag, "nusabill": 0, "total": ag}

        elif payload.domain == "nusabill":
            nb = await svc.process_nusabill()
            processed = {"agenusa": 0, "nusabill": nb, "total": nb}

        else:  # "all"
            processed = await svc.process_all()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal memproses transaksi: {str(e)}"
        )

    return SimulateResponse(
        status="success",
        domain=payload.domain,
        scenario=payload.scenario or "all",
        injected=injected,
        processed=processed,
    )


# ============================================================
# ENDPOINT TAMBAHAN — daftar skenario yang tersedia
# ============================================================
@router.get("/scenarios")
def list_scenarios():
    """
    Kembalikan daftar skenario yang tersedia per domain.
    Berguna untuk populate dropdown di Frontend.
    """
    return {
        "agenusa": list(agenusa_scenarios().keys()),
        "nusabill": list(nusabill_scenarios().keys()),
    }