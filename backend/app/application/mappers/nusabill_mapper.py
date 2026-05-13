def map_nusabill(data: dict):
    return {
        "original_trx_id": data.get("no_invoice"),
        "service_source": "NUSABILL",
        "user_account_id": data.get("customer_id"),
        "amount": data.get("total_tagihan"),
        "transaction_time": data.get("tanggal_tagihan") or data.get("tanggal_pembayaran"),

        "merchant_id": data.get("kode_pembayaran"),

        "transaction_details": {
            "nama_customer": data.get("nama_customer"),
            "sof": data.get("sof"),
            "biaya_admin": data.get("biaya_admin"),
            "utc_reference": data.get("utc_reference"),
            "status_tagihan": data.get("status_tagihan"),
            "status_akhir": data.get("status_akhir"),
            "tanggal_rekon": data.get("tanggal_rekon"),
            "keterangan": data.get("keterangan")
        }
    }