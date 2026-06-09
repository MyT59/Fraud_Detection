def map_nusabill(data: dict):
    return {
        "original_trx_id": data.get("no_invoice"),
        "service_source": "NUSABILL",
        "user_account_id": data.get("customer_id"),
        "amount": float(data.get("total_tagihan", 0)),
        "transaction_time": (
            data.get("tanggal_pembayaran")
            or data.get("tanggal_tagihan")
        ),
        "transaction_status": "INGESTED",
        "merchant_id": data.get("kode_pembayaran"),
        "ip_address": data.get("ip_address"),
        "city": None,
        "country": None,
        "transaction_details": {
            # === DATA ASLI ===
            "nama_customer": data.get("nama_customer"),
            "sof": data.get("sof"),
            "biaya_admin": data.get("biaya_admin"),
            "utc_reference": data.get("utc_reference"),
            "status_tagihan": data.get("status_tagihan"),
            "status_akhir": data.get("status_akhir"),
            "tanggal_rekon": data.get("tanggal_rekon"),
            "keterangan": data.get("keterangan"),
            "bill_date": str(data.get("tanggal_tagihan")) if data.get("tanggal_tagihan") else None,
            "payment_date": str(data.get("tanggal_pembayaran")) if data.get("tanggal_pembayaran") else None,
            "bill_amount": float(data.get("total_tagihan", 0)),
            "payment_amount": float(data.get("total_tagihan", 0)),
            "channel": "API",
            "bill_status": data.get("status_tagihan") or data.get("status_akhir") or "terbayar",
        }
    }