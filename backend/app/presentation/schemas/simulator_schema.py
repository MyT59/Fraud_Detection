"""
simulator_schema.py
-------------------
Pydantic schemas untuk endpoint simulator (manual, bulk, replay, reset).

Filosofi field:
- WAJIB   : field yang dipakai mapper sebagai identifier / amount utama
- OPSIONAL: field yang punya default masuk akal, tapi bisa di-override
"""

from __future__ import annotations

import uuid
import random
from datetime import datetime, timezone
from typing import Literal, Optional, List

from pydantic import BaseModel, Field, field_validator, model_validator


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _gen_rrn() -> str:
    return str(random.randint(100_000_000_000, 999_999_999_999))

def _gen_stan() -> str:
    return f"{random.randint(0, 999_999):06d}"

def _gen_invoice() -> str:
    ts     = datetime.now().strftime("%Y%m%d%H%M%S")
    suffix = uuid.uuid4().hex[:6].upper()
    return f"INV-{ts}-{suffix}"

def _gen_customer_id() -> str:
    return f"CUST-{uuid.uuid4().hex[:8].upper()}"


# ─────────────────────────────────────────────
# ANOMALY TYPES
# ─────────────────────────────────────────────

AnomalyType = Literal[
    "HIGH_AMOUNT",      # amount di-spike ke nilai ekstrem (>= 50 juta)
    "UNUSUAL_HOUR",     # timestamp dipaksa ke jam 01.00–04.00
    "RAPID_FIRE",       # cocok dipakai di bulk: semua transaksi dalam 60 detik
    "UNDERPAYMENT",     # khusus Nusabill: payment_amount < total_tagihan
    "OVERPAYMENT",      # khusus Nusabill: payment_amount > total_tagihan
    "FOREIGN_IP",       # ip_address dari range luar negeri (simulasi)
    "DIFF_CITY",        # city berbeda-beda tiap transaksi (location hopping)
]

AGENUSA_ANOMALIES = {"HIGH_AMOUNT", "UNUSUAL_HOUR", "RAPID_FIRE", "FOREIGN_IP", "DIFF_CITY"}
NUSABILL_ANOMALIES = {"HIGH_AMOUNT", "UNUSUAL_HOUR", "RAPID_FIRE", "UNDERPAYMENT", "OVERPAYMENT", "FOREIGN_IP"}


# ─────────────────────────────────────────────
# AGENUSA — Manual Input Schema
# ─────────────────────────────────────────────

class AgenusaManualInput(BaseModel):
    """
    Input manual satu transaksi Agenusa (mini ATM / EDC switching).

    Wajib   : amount, msg_type
    Opsional: sisanya auto-generate / punya default masuk akal
    """

    # === IDENTIFIERS ===
    rrn: str = Field(
        default_factory=_gen_rrn,
        description="Retrieval Reference Number (12 digit). Auto-generate jika kosong.",
        example="240618123456"
    )
    stan: Optional[str] = Field(default=None, description="System Trace Audit Number. Dibuat otomatis oleh simulator.", example="001234")
    fep_id: Optional[str] = Field(default=None, description="Front-End Processor ID. Diisi node simulator otomatis.", example="FEP-SIM-01")

    # === WAKTU ===
    timestamp_db: datetime = Field(
        default_factory=_now_utc,
        description="Timestamp transaksi (UTC). Default: sekarang."
    )

    # === AMOUNT (WAJIB) ===
    amount: float = Field(..., ge=0, description="Nominal transaksi (Rupiah).", example=500_000)

    # === TIPE TRANSAKSI (WAJIB) ===
    msg_type: Literal["TRANSFER", "CEK_SALDO", "TARIK_SALDO"] = Field(
        ..., description="Jenis transaksi Agenusa."
    )
    mti: Optional[str] = Field(default=None, description="MTI ISO-8583. Auto-derive dari msg_type.", example="0200")
    processing_code: Optional[str] = Field(default=None, description="Processing code ISO-8583. Auto-derive dari msg_type.", example="200000")
    response_code: str = Field(default="00", description="Response code ('00' = approved).", example="00")
    msg_raw: Optional[str] = Field(default=None, description="Raw ISO-8583 message (opsional).")

    # === AKUN ===
    account_number: str = Field(
        default_factory=lambda: f"9{uuid.uuid4().int % 10**14:014d}",
        description="Nomor rekening / kartu sumber dana.",
        example="1234567890123456"
    )
    dest_account_number: Optional[str] = Field(default=None, description="Rekening tujuan (wajib untuk TRANSFER).", example="9876543210987654")
    customer_ref_number: str = Field(default_factory=_gen_customer_id, description="Referensi customer (→ user_account_id).", example="CUST-A1B2C3D4")
    issuer_account_number: Optional[str] = Field(default=None, description="Nomor akun di sisi issuer.")

    # === BANK ===
    issuer_bank: str = Field(default="BCA", description="Kode bank penerbit kartu.", example="BCA")
    dest_bank_code: Optional[str] = Field(default=None, description="Kode bank tujuan.", example="014")
    acquirer_code: str = Field(default="AGENUSA", description="Kode acquirer.", example="AGENUSA")

    # === TERMINAL / MERCHANT ===
    terminal_id: str = Field(default_factory=lambda: f"TRM-{uuid.uuid4().hex[:6].upper()}", description="ID terminal EDC.")
    merchant_id: str = Field(default_factory=lambda: f"MRC-{uuid.uuid4().hex[:6].upper()}", description="ID merchant.")

    # === ISO DE FIELDS ===
    de7:  Optional[str] = Field(default=None, description="DE7: Transmission date & time (MMDDHHmmss).")
    de12: Optional[str] = Field(default=None, description="DE12: Local transaction time (HHmmss).")
    de13: Optional[str] = Field(default=None, description="DE13: Local transaction date (MMDD).")

    # === LOKASI / NETWORK ===
    ip_address: str  = Field(default="127.0.0.1", description="IP address terminal.", example="192.168.1.100")
    city: str        = Field(default="Jakarta",   description="Kota lokasi transaksi.", example="Surabaya")
    country: str     = Field(default="ID",        description="Kode negara (ISO 3166-1 alpha-2).", example="ID")

    # === ANOMALY INJECTION ===
    inject_anomaly: Optional[AnomalyType] = Field(
        default=None,
        description=(
            "Inject pola anomali secara otomatis ke transaksi ini. "
            "HIGH_AMOUNT → amount di-spike ≥50jt; "
            "UNUSUAL_HOUR → timestamp dipaksa jam 01–04; "
            "RAPID_FIRE → cocok dikombinasi dengan bulk (delay=0); "
            "FOREIGN_IP → ip_address dari range luar negeri; "
            "DIFF_CITY → kota random setiap inject."
        )
    )

    @field_validator("inject_anomaly")
    @classmethod
    def anomaly_must_match_agenusa(cls, value):
        if value is not None and value not in AGENUSA_ANOMALIES:
            raise ValueError("Anomaly ini tidak didukung untuk Agenusa")
        return value

    # ── VALIDATORS ──────────────────────────────────────
    @model_validator(mode="after")
    def derive_iso_fields(self) -> "AgenusaManualInput":
        _MTI = {"TRANSFER": "0200", "TARIK_SALDO": "0200", "CEK_SALDO": "0100"}
        _PC  = {"TRANSFER": "200000", "TARIK_SALDO": "010000", "CEK_SALDO": "310000"}
        # ISO technical fields are owned by the simulator so a user cannot
        # construct an inconsistent combination with msg_type.
        self.mti = _MTI.get(self.msg_type, "0200")
        # Processing code is defined by the requested service, not by the
        # response outcome. Always derive it to prevent inconsistent ISO 8583
        # simulator payloads (for example CEK_SALDO with transfer code).
        self.processing_code = _PC.get(self.msg_type, "200000")
        self.stan = _gen_stan()
        self.fep_id = "FEP-SIM-01"
        return self

    @model_validator(mode="after")
    def validate_transfer_dest(self) -> "AgenusaManualInput":
        if self.msg_type == "TRANSFER" and not self.dest_account_number:
            raise ValueError("dest_account_number wajib diisi untuk transaksi TRANSFER.")
        if self.msg_type == "CEK_SALDO":
            self.amount = 0
        elif self.amount <= 0:
            raise ValueError("amount harus lebih dari 0 untuk transfer atau tarik saldo.")
        return self


# ─────────────────────────────────────────────
# NUSABILL — Manual Input Schema
# ─────────────────────────────────────────────

class NusabillManualInput(BaseModel):
    """
    Input manual satu transaksi Nusabill (invoice / tagihan via VA Bank).

    Wajib   : total_tagihan, nama_customer
    Opsional: sisanya auto-generate / punya default masuk akal
    """

    # === IDENTIFIERS ===
    no_invoice: str = Field(default_factory=_gen_invoice, description="Nomor invoice. Auto-generate jika kosong.", example="INV-20240618120000-AB12CD")
    customer_id: str = Field(default_factory=_gen_customer_id, description="ID customer (→ user_account_id).", example="CUST-AB12CD34")
    utc_reference: Optional[str] = Field(default=None, description="Referensi UTC dari payment gateway.", example="UTC-REF-001")
    kode_pembayaran: Optional[str] = Field(default=None, description="Kode VA / kode pembayaran bank untuk invoice; bukan merchant_id/biller_id.", example="8812345678901234")

    # === WAKTU ===
    tanggal_tagihan: datetime    = Field(default_factory=_now_utc, description="Tanggal tagihan dibuat. Default: sekarang.")
    tanggal_pembayaran: Optional[datetime] = Field(default=None,  description="Tanggal pembayaran. Default: sama dengan tanggal_tagihan.")
    tanggal_rekon: Optional[datetime]      = Field(default=None,  description="Tanggal rekonsiliasi.")

    # === CUSTOMER ===
    nama_customer: str = Field(..., description="Nama customer yang ditagih.", example="Budi Santoso")

    # === AMOUNT (WAJIB) ===
    total_tagihan: float = Field(..., gt=0, description="Total tagihan (Rupiah).", example=1_500_000)
    payment_amount: Optional[float] = Field(
        default=None,
        description=(
            "Jumlah yang benar-benar dibayar. "
            "< total_tagihan = underpayment, > total_tagihan = overpayment. "
            "Default: sama dengan total_tagihan."
        ),
        example=1_500_000
    )
    biaya_admin: float = Field(default=0, ge=0, description="Biaya administrasi.", example=2_500)

    # === SOURCE OF FUND ===
    sof: str     = Field(default="VA_BANK",        description="Source of Fund / metode pembayaran.", example="VA_BCA")
    channel: str = Field(default="API",            description="Channel pembayaran.", example="MOBILE_BANKING")

    # === STATUS ===
    status_tagihan: str       = Field(default="terbayar", description="Status tagihan dari sisi biller.")
    status_akhir: str         = Field(default="SUCCESS",  description="Status akhir transaksi.")
    keterangan: Optional[str] = Field(default=None,     description="Keterangan tambahan.")

    # === NETWORK ===
    ip_address: str = Field(default="127.0.0.1", description="IP address customer.", example="114.122.88.55")
    city: Optional[str] = Field(
        default=None,
        description="Kota hasil resolusi IP customer untuk kebutuhan audit; bukan alamat customer.",
        example="Jakarta",
    )
    country: Optional[str] = Field(
        default=None,
        max_length=2,
        description="Kode negara hasil resolusi IP customer (ISO 3166-1 alpha-2).",
        example="ID",
    )

    # === ANOMALY INJECTION ===
    inject_anomaly: Optional[AnomalyType] = Field(
        default=None,
        description=(
            "Inject pola anomali secara otomatis. "
            "UNDERPAYMENT → payment_amount = 50% dari total_tagihan; "
            "OVERPAYMENT  → payment_amount = 150% dari total_tagihan; "
            "HIGH_AMOUNT  → total_tagihan di-spike ≥50jt; "
            "UNUSUAL_HOUR → timestamp dipaksa jam 01–04; "
            "FOREIGN_IP   → ip_address dari range luar negeri."
        )
    )

    @field_validator("inject_anomaly")
    @classmethod
    def anomaly_must_match_nusabill(cls, value):
        if value is not None and value not in NUSABILL_ANOMALIES:
            raise ValueError("Anomaly ini tidak didukung untuk Nusabill")
        return value

    # ── VALIDATORS ──────────────────────────────────────
    @model_validator(mode="after")
    def set_payment_defaults(self) -> "NusabillManualInput":
        if self.payment_amount is None:
            self.payment_amount = self.total_tagihan
        if self.tanggal_pembayaran is None:
            self.tanggal_pembayaran = self.tanggal_tagihan
        if not self.kode_pembayaran:
            self.kode_pembayaran = f"88{random.randint(10**12, 10**14 - 1)}"
        return self


# ─────────────────────────────────────────────
# BULK INPUT SCHEMAS
# ─────────────────────────────────────────────

class AgenusaBulkInput(BaseModel):
    """Bulk insert transaksi Agenusa dengan kontrol timing."""
    transactions: List[AgenusaManualInput] = Field(
        ...,
        min_length=1,
        max_length=150,
        description="List transaksi Agenusa (maks 150 per request)."
    )
    delay_ms: int = Field(
        default=300,
        ge=0,
        le=5000,
        description=(
            "Delay antar transaksi dalam milidetik. "
            "0 = serentak (cocok untuk simulasi RAPID_FIRE), "
            "300 = default natural flow."
        )
    )
    stop_on_error: bool = Field(
        default=False,
        description="Jika True, bulk berhenti saat ada satu transaksi yang gagal. Default: lanjut skip."
    )


class NusabillBulkInput(BaseModel):
    """Bulk insert transaksi Nusabill dengan kontrol timing."""
    transactions: List[NusabillManualInput] = Field(
        ...,
        min_length=1,
        max_length=150,
        description="List transaksi Nusabill (maks 150 per request)."
    )
    delay_ms: int = Field(
        default=300,
        ge=0,
        le=5000,
        description=(
            "Delay antar transaksi dalam milidetik. "
            "0 = serentak (cocok untuk simulasi RAPID_FIRE), "
            "300 = default natural flow."
        )
    )
    stop_on_error: bool = Field(
        default=False,
        description="Jika True, bulk berhenti saat ada satu transaksi yang gagal."
    )


# ─────────────────────────────────────────────
# REPLAY SCHEMA
# ─────────────────────────────────────────────

class ReplayRequest(BaseModel):
    """Clone dan re-proses transaksi yang sudah ada di transactions_feed."""
    transaction_id: int = Field(
        ...,
        description="ID transaksi di transactions_feed yang akan di-replay."
    )
    override_amount: Optional[float] = Field(
        default=None,
        gt=0,
        description="Override amount transaksi hasil clone. Default: sama dengan aslinya."
    )
    override_timestamp: Optional[datetime] = Field(
        default=None,
        description="Override timestamp transaksi hasil clone. Default: sekarang."
    )
    inject_anomaly: Optional[AnomalyType] = Field(
        default=None,
        description="Inject anomali ke transaksi clone sebelum diproses ulang."
    )


# ─────────────────────────────────────────────
# RESET SCHEMA
# ─────────────────────────────────────────────

class ResetRequest(BaseModel):
    """Hapus semua data simulasi dari semua table sekaligus."""
    confirm: bool = Field(
        ...,
        description="Harus True untuk konfirmasi reset. Safeguard agar tidak kena accident."
    )
    target: Literal["all", "agenusa", "nusabill", "transactions_feed"] = Field(
        default="all",
        description=(
            "Target table yang di-reset: "
            "'all' = switching_logs + invoice_transactions + transactions_feed; "
            "'agenusa' = switching_logs + baris AGENUSA di transactions_feed; "
            "'nusabill' = invoice_transactions + baris NUSABILL di transactions_feed; "
            "'transactions_feed' = hanya transactions_feed."
        )
    )


# ─────────────────────────────────────────────
# RESPONSE SCHEMAS
# ─────────────────────────────────────────────

class ManualSimulateResponse(BaseModel):
    status:  str
    message: str
    data:    dict


class BulkSimulateResponse(BaseModel):
    status:       str
    message:      str
    total:        int
    succeeded:    int
    failed:       int
    skipped:      int = 0
    results:      List[dict]


class ReplayResponse(BaseModel):
    status:  str
    message: str
    data:    dict


class ResetResponse(BaseModel):
    status:  str
    message: str
    deleted: dict  # {"switching_logs": N, "invoice_transactions": N, "transactions_feed": N}
