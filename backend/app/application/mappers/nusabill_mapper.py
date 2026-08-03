from datetime import datetime
from zoneinfo import ZoneInfo


BUSINESS_TIMEZONE = ZoneInfo("Asia/Jakarta")


def _canonical_bill_status(value):
    """Normalize source-specific invoice states to Rule Builder values."""
    normalized = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "paid": "terbayar",
        "lunas": "terbayar",
        "terbayar": "terbayar",
        "unpaid": "belum_terbayar",
        "not_paid": "belum_terbayar",
        "belum_terbayar": "belum_terbayar",
        "failed": "gagal",
        "failure": "gagal",
        "gagal": "gagal",
        "pending": "pending",
    }
    return aliases.get(normalized, normalized or "terbayar")


def _as_wib(value):
    """Invoice timestamps without an offset are operational WIB values."""
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=BUSINESS_TIMEZONE)
    return value


def map_nusabill(data: dict):
    total_tagihan  = float(data.get("total_tagihan") or 0)
    payment_amount = float(data.get("payment_amount") or total_tagihan)
    customer_id = (
        data.get("customer_id")
        or data.get("nama_customer")
    )

    return {
        "original_trx_id": data.get("no_invoice"),
        "service_source": "NUSABILL",
        "user_account_id": customer_id,
        "amount": payment_amount,
        "transaction_time": _as_wib(
            data.get("tanggal_pembayaran")
            or data.get("tanggal_tagihan")
        ),
        "transaction_status": "INGESTED",
        # Kode pembayaran adalah nomor VA/rujukan invoice, bukan identitas
        # biller/merchant. Nusabill pada kontrak data saat ini tidak mengirim
        # merchant_id atau biller_id yang dapat dipakai untuk rule/blacklist.
        "merchant_id": None,
        "ip_address": data.get("ip_address"),
        # Lokasi ini merepresentasikan resolusi IP pembayar untuk audit, bukan
        # alamat customer/biller. Nusabill tidak memakai location-jump pattern.
        "city": data.get("city"),
        "country": data.get("country"),
        "transaction_details": {
            "nama_customer":  data.get("nama_customer"),
            "customer_id": customer_id,
            "kode_pembayaran": data.get("kode_pembayaran"),
            "sof":            data.get("sof"),
            "biaya_admin":    float(data.get("biaya_admin") or 0),   
            "utc_reference":  data.get("utc_reference"),
            "status_tagihan": data.get("status_tagihan"),
            "status_akhir":   data.get("status_akhir"),
            "tanggal_rekon":  str(data.get("tanggal_rekon")) if data.get("tanggal_rekon") else None,
            "keterangan":     data.get("keterangan"),
            "bill_date":      str(data.get("tanggal_tagihan")) if data.get("tanggal_tagihan") else None,
            "payment_date":   str(data.get("tanggal_pembayaran")) if data.get("tanggal_pembayaran") else None,
            "bill_amount":    total_tagihan,
            "payment_amount": payment_amount,
            "channel":        data.get("channel", "API"),
            # `bill_status` is the canonical value exposed by Rule Builder.
            # Keep the provider's original state in `status_tagihan` above.
            "bill_status":    _canonical_bill_status(
                data.get("status_tagihan") or data.get("status_akhir")
            ),
        }
    }
