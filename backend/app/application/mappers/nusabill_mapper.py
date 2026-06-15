def map_nusabill(data: dict):
    total_tagihan  = float(data.get("total_tagihan") or 0)
    payment_amount = float(data.get("payment_amount") or total_tagihan)

    return {
        "original_trx_id": data.get("no_invoice"),
        "service_source": "NUSABILL",
        "user_account_id": data.get("customer_id"),
        "amount": payment_amount,
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
            "nama_customer":  data.get("nama_customer"),
            "sof":            data.get("sof"),
            "biaya_admin":    float(data.get("biaya_admin") or 0),   # ← fix: Decimal → float
            "utc_reference":  data.get("utc_reference"),
            "status_tagihan": data.get("status_tagihan"),
            "status_akhir":   data.get("status_akhir"),
            "tanggal_rekon":  str(data.get("tanggal_rekon")) if data.get("tanggal_rekon") else None,
            "keterangan":     data.get("keterangan"),
            "bill_date":      str(data.get("tanggal_tagihan")) if data.get("tanggal_tagihan") else None,
            "payment_date":   str(data.get("tanggal_pembayaran")) if data.get("tanggal_pembayaran") else None,
            # === AMOUNT FIELDS ===
            "bill_amount":    total_tagihan,
            "payment_amount": payment_amount,
            "channel":        data.get("channel", "API"),
            "bill_status":    data.get("status_tagihan") or data.get("status_akhir") or "terbayar",
        }
    }