"""
simulator_routes.py
-------------------
Semua endpoint simulator:

  Existing
  ─────────────────────────────────────────────
  POST   /simulator/generate                        Live simulation (background, scenario generator)
  POST   /simulator/stop                            Stop live simulation
  GET    /simulator/status                          Status live simulation
  GET    /simulator/scenarios                       List scenario yang tersedia
  GET    /simulator/scenarios/{name}/preview        Detail + narasi + trigger info sebuah scenario

  Manual Single
  ─────────────────────────────────────────────
  POST   /simulator/manual/agenusa                  Insert 1 transaksi Agenusa manual
  POST   /simulator/manual/nusabill                 Insert 1 transaksi Nusabill manual

  Bulk
  ─────────────────────────────────────────────
  POST   /simulator/bulk/agenusa                    Insert banyak transaksi Agenusa sekaligus
  POST   /simulator/bulk/nusabill                   Insert banyak transaksi Nusabill sekaligus

  Replay
  ─────────────────────────────────────────────
  POST   /simulator/replay                          Clone & re-proses transaksi dari transactions_feed

  Reset
  ─────────────────────────────────────────────
  DELETE /simulator/reset                           Hapus data simulasi dari semua / sebagian table
"""

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Literal

from app.application.services.simulator_service import (
    run_live_simulation,
    reserve_simulation_service,
    stop_simulation_service,
    get_simulation_status_service,
    manual_input_agenusa,
    manual_input_nusabill,
    bulk_input_agenusa,
    bulk_input_nusabill,
    replay_transaction,
    reset_simulator_data,
)
from app.infrastructure.database.session import get_db
from simulator.agenusa_generator import (
    get_all_scenarios as agenusa_scenarios,
    get_scenario_catalog as agenusa_scenario_catalog,
)
from simulator.nusabill_generator import (
    get_all_scenarios as nusabill_scenarios,
    get_scenario_catalog as nusabill_scenario_catalog,
)

from app.presentation.schemas.simulator_schema import (
    AgenusaManualInput,
    NusabillManualInput,
    AgenusaBulkInput,
    NusabillBulkInput,
    ReplayRequest,
    ResetRequest,
    ManualSimulateResponse,
    BulkSimulateResponse,
    ReplayResponse,
    ResetResponse,
)

router = APIRouter(prefix="/simulator", tags=["Simulator"])


# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO CATALOG
# Sumber kebenaran untuk endpoint preview. Semua key HARUS match dengan key
# di get_all_scenarios() pada masing-masing generator.
# ─────────────────────────────────────────────────────────────────────────────

_LEGACY_SCENARIO_CATALOG = {

    # ══════════════════════════════════════════════════════════════════════
    # AGENUSA
    # ══════════════════════════════════════════════════════════════════════
    "agenusa": {

        "normal": {
            "title": "Normal Transactions",
            "category": "Baseline",
            "description": (
                "20 transaksi normal sehari-hari dari berbagai merchant dan terminal. "
                "Tidak seharusnya memicu engine manapun. Digunakan sebagai baseline "
                "untuk memastikan false positive rate tetap rendah."
            ),
            "target_engines": [],
            "trigger_conditions": [],
            "fraud_pattern": None,
            "expected_result": "SAFE",
            "transaction_count": 20,
        },

        "blacklist_ip": {
            "title": "Blacklist — IP Address",
            "category": "Blacklist",
            "description": (
                "Transaksi dari IP address yang sudah masuk daftar hitam sistem. "
                "Simulasi serangan dari infrastruktur yang sebelumnya pernah digunakan "
                "untuk fraud dan sudah di-block oleh tim keamanan."
            ),
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["ip_address == '99.99.99.99' (BLACKLISTED_IP)"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },

        "blacklist_account": {
            "title": "Blacklist — Account Number",
            "category": "Blacklist",
            "description": (
                "Transaksi menggunakan nomor rekening / kartu yang sudah diblacklist. "
                "Kartu ini sebelumnya terbukti digunakan untuk transaksi fraudulent "
                "atau dilaporkan sebagai kartu curian."
            ),
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["account_number == 'card_bl_000001' (BLACKLISTED_ACCOUNT)"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },

        "blacklist_terminal": {
            "title": "Blacklist — Terminal ID",
            "category": "Blacklist",
            "description": (
                "Transaksi dari terminal EDC yang sudah diblacklist. "
                "Terminal ini kemungkinan telah dipasangi skimmer atau "
                "dioperasikan oleh merchant nakal."
            ),
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["terminal_id == 'TRM_BL_00001' (BLACKLISTED_TERMINAL)"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },

        "blacklist_merchant": {
            "title": "Blacklist — Merchant ID",
            "category": "Blacklist",
            "description": (
                "Transaksi dari merchant yang sudah diblacklist karena terbukti "
                "terlibat dalam kolusi fraud atau money laundering."
            ),
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["merchant_id == 'M_BL_00001' (BLACKLISTED_MERCHANT)"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },

        "bruteforce": {
            "title": "Account Takeover & Brute Force PIN Guessing",
            "category": "Account Takeover Suspect",
            "description": (
                "4 percobaan PIN salah dalam 1 menit (interval ~20 detik), "
                "diikuti 1 transaksi sukses. Pola klasik brute force PIN kartu ATM — "
                "fraudster mencoba PIN satu per satu sampai berhasil."
            ),
            "target_engines": ["Pattern Engine", "ML Engine"],
            "trigger_conditions": [
                "processing_code == '300000' & response_code == '55' × 4",
                "has_success_after_failure == true",
                "failure_count >= 3 dalam 10 menit",
            ],
            "fraud_pattern": {
                "id": 5,
                "name": "Agenusa - Account Takeover & Brute Force PIN Guessing",
                "risk_score": 75,
                "action": "REVIEW",
                "time_window_minutes": 10,
            },
            "expected_result": "FLAGGED / FRAUD",
            "transaction_count": 5,
        },

        "decline_velocity": {
            "title": "Decline Velocity",
            "category": "Velocity Attack",
            "description": (
                "5 decline berturut-turut dari kartu yang sama dalam 3 menit "
                "dengan berbagai response code (51=insufficient funds, 61=exceed limit, dll). "
                "Indikasi kartu sedang ditest atau limit sedang di-probe."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "failure_count >= 3",
                "response_code IN ['51','61','65','91','05']",
            ],
            "fraud_pattern": None,
            "expected_result": "FLAGGED / FRAUD",
            "transaction_count": 5,
        },

        "super_pattern": {
            "title": "Super Pattern (Advanced Syndicate Attack)",
            "category": "Carding & Brute Force",
            "description": (
                "Kombinasi sinyal kuat: distinct_account_count >= 5, tx_count >= 15, "
                "dan total amount >= 50.000.000. Pattern ini menggabungkan beberapa "
                "indikator fraud sekaligus untuk mendeteksi serangan sindikat terstruktur "
                "yang tidak terdeteksi oleh satu rule tunggal."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "distinct_account_count >= 5",
                "tx_count >= 15 dalam 15 menit",
                "total_amount >= 50,000,000",
            ],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 16,
        },

        "chain_decline_success_burst": {
            "title": "Critical Card Testing Burst Detection",
            "category": "Carding & Brute Force",
            "description": (
                "Fraudster mendapatkan ribuan data kartu bank curian dari dark web. "
                "Mereka memanfaatkan mesin EDC Agenusa untuk mengetes kartu mana yang "
                "masih aktif dan ada saldonya. Ciri khas: kartu digesek berkali-kali, "
                "muncul decline beruntun karena salah PIN atau saldo habis, lalu begitu "
                "ketemu 1 kartu yang sukses, langsung menghantam transaksi sukses "
                "berikutnya dalam waktu sangat singkat (burst successes). "
                "Struktur: 3× decline (response_code=51) → 1× success → 4× burst success = 8 transaksi."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "chain_decline_success_burst == true",
                "tx_count >= 7 dalam 15 menit",
            ],
            "fraud_pattern": {
                "id": 2,
                "name": "Agenusa - Critical Card Testing Burst Detection",
                "risk_score": 95,
                "action": "BLOCK",
                "time_window_minutes": 15,
            },
            "expected_result": "FRAUD",
            "transaction_count": 8,
        },

        "edc_terminal_pooling": {
            "title": "EDC Terminal Pooling & Card Washing",
            "category": "Merchant Collusion & Terminal Abuse",
            "description": (
                "Skenario kolusi fraud di mana pemilik merchant Agenusa bekerja sama "
                "dengan sindikat pencuri data kartu, atau akun merchant telah diretas. "
                "Kriminal membawa tumpukan kartu kredit/debit hasil kloning ke satu "
                "mesin EDC yang sama, memaksa transaksi bergantian dengan mengganti-ganti "
                "kartu dalam hitungan menit. Perilaku manusia normal tidak akan mengganti "
                "lebih dari 5 kartu berbeda pada satu terminal dalam hitungan menit. "
                "Scenario: 6 kartu berbeda di terminal '71809340' dalam 8 menit."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "distinct_account_count >= 5 dalam 10 menit",
                "semua transaksi di terminal_id yang sama ('71809340')",
            ],
            "fraud_pattern": {
                "id": 4,
                "name": "Agenusa - EDC Terminal Pooling & Card Washing Detection",
                "risk_score": 90,
                "action": "BLOCK",
                "time_window_minutes": 10,
            },
            "expected_result": "FRAUD",
            "transaction_count": 6,
        },

        "fan_in": {
            "title": "Fan-In (Many Cards → One Destination)",
            "category": "Money Mule",
            "description": (
                "Banyak kartu berbeda melakukan transfer ke satu rekening tujuan yang sama "
                "(money mule account 'DST999999'). Pola ini khas pencucian uang di mana "
                "banyak rekening korban digunakan untuk mengumpulkan dana ke satu titik."
            ),
            "target_engines": ["Pattern Engine", "ML Engine"],
            "trigger_conditions": [
                "dest_account_number == 'DST999999' (IS_MONEY_MULE_DEST)",
                "distinct_account_count >= 10",
            ],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 11,
        },

        "midnight_spike": {
            "title": "Midnight Spike (Unusual Hour)",
            "category": "Behavioral Anomaly",
            "description": (
                "Lonjakan transaksi pada jam 01.00–04.00 dini hari WIB (18.00–21.00 UTC). "
                "Aktivitas ATM pada jam ini sangat tidak wajar dan sering "
                "mengindikasikan penggunaan kartu curian ketika korban sedang tidur."
            ),
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["transaction_time HOUR IN [1, 2, 3] WIB"],
            "fraud_pattern": None,
            "expected_result": "FLAGGED / FRAUD",
            "transaction_count": 5,
        },

        "velocity_burst": {
            "title": "Velocity Burst",
            "category": "Velocity Attack",
            "description": (
                "Banyak transaksi dari kartu yang sama dalam waktu sangat singkat. "
                "Indikasi penggunaan skrip otomatis atau bot untuk melakukan "
                "transaksi secepat mungkin sebelum kartu diblokir."
            ),
            "target_engines": ["Pattern Engine", "Rule Engine"],
            "trigger_conditions": ["tx_count >= 5 dalam 5 menit"],
            "fraud_pattern": None,
            "expected_result": "FLAGGED / FRAUD",
            "transaction_count": 8,
        },

        "money_mule": {
            "title": "Money Mule Transfer",
            "category": "Money Mule",
            "description": (
                "Transfer berulang ke rekening money mule 'DST999999' yang sudah "
                "teridentifikasi. Rekening mule digunakan untuk menampung dan memindahkan "
                "dana hasil fraud agar sulit dilacak oleh otoritas."
            ),
            "target_engines": ["Pattern Engine", "ML Engine"],
            "trigger_conditions": ["dest_account_number == 'DST999999' (IS_MONEY_MULE_DEST)"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 5,
        },

        "terminal_switch_fast": {
            "title": "Terminal Switch Fast (Location Hopping)",
            "category": "Behavioral Anomaly",
            "description": (
                "Kartu yang sama digunakan di terminal / lokasi berbeda dalam waktu "
                "yang mustahil secara fisik. Mengindikasikan kartu telah digandakan "
                "(cloned) dan digunakan secara bersamaan di tempat berbeda."
            ),
            "target_engines": ["Pattern Engine", "ML Engine"],
            "trigger_conditions": ["distinct_terminal_count >= 3 dalam waktu singkat"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 4,
        },

        "high_amount": {
            "title": "High Amount Spike",
            "category": "Amount Anomaly",
            "description": (
                "5 transaksi normal kecil (50–150 ribu) diikuti 1 transaksi ekstrem "
                "senilai 80–100 juta. Rasio amount terakhir vs rata-rata ~800× — "
                "jauh melampaui threshold IS_HIGH_AMOUNT_PATTERN."
            ),
            "target_engines": ["Pattern Engine", "ML Engine"],
            "trigger_conditions": [
                "amount / AVG_AMOUNT_5 >> threshold",
                "amount BETWEEN 80,000,000 AND 100,000,000",
            ],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 6,
        },

        "rule_agenusa_max_cash_out": {
            "title": "Rule — Agenusa Transaction Limit Exceeded",
            "category": "Rule Violation",
            "description": (
                "Contoh tarik saldo melebihi batas maksimal Rp 10.000.000 "
                "dalam satu transaksi. Rule global Agenusa juga berlaku untuk "
                "transfer sekali jalan dengan nominal di atas batas tersebut."
            ),
            "target_engines": ["Rule Engine"],
            "trigger_conditions": ["amount BETWEEN 10,500,000 AND 15,000,000 (> 10,000,000)"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },

        "rule_agenusa_suspended_bank": {
            "title": "Rule — Suspended Bank",
            "category": "Rule Violation",
            "description": (
                "Transaksi menggunakan kartu dari bank partner yang sedang "
                "ditangguhkan kerja samanya (suspended). Semua transaksi dari "
                "issuer bank ini harus diblokir sampai status partnership dipulihkan."
            ),
            "target_engines": ["Rule Engine"],
            "trigger_conditions": ["issuer_bank == 'BANK_CADANGAN_X'"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },
    },

    # ══════════════════════════════════════════════════════════════════════
    # NUSABILL
    # ══════════════════════════════════════════════════════════════════════
    "nusabill": {

        "normal": {
            "title": "Normal Invoices",
            "category": "Baseline",
            "description": (
                "20 transaksi invoice normal dari berbagai customer dan biller. "
                "Pembayaran tepat jumlah (payment_amount = None → fallback ke total_tagihan), "
                "status 'terbayar', tidak seharusnya memicu engine manapun."
            ),
            "target_engines": [],
            "trigger_conditions": [],
            "fraud_pattern": None,
            "expected_result": "SAFE",
            "transaction_count": 20,
        },

        "blacklist_ip": {
            "title": "Blacklist — IP Address",
            "category": "Blacklist",
            "description": (
                "Pembayaran invoice dari IP address '99.99.99.99' yang sudah diblacklist. "
                "IP ini sebelumnya teridentifikasi sebagai sumber serangan atau bot spam pembayaran."
            ),
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["ip_address == '99.99.99.99' (BLACKLISTED_IP)"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },

        "blacklist_customer": {
            "title": "Blacklist — Customer ID",
            "category": "Blacklist",
            "description": (
                "Pembayaran dari customer 'CUST-BL-00001' yang sudah diblacklist "
                "karena riwayat chargeback, penipuan, atau penyalahgunaan sistem invoice."
            ),
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["customer_id == 'CUST-BL-00001' (BLACKLISTED_CUSTOMER)"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },

        "blacklist_merchant": {
            "title": "Blacklist — Merchant (Kode Pembayaran)",
            "category": "Blacklist",
            "description": (
                "Pembayaran ke kode VA 'PAY-BL-00001' yang sudah diblacklist. "
                "Merchant ini terbukti membuat invoice palsu atau terlibat dalam skema fraud."
            ),
            "target_engines": ["Blacklist Engine"],
            "trigger_conditions": ["kode_pembayaran == 'PAY-BL-00001' (BLACKLISTED_MERCHANT)"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },

        "fan_out_spam": {
            "title": "Fan-Out Spam Billing",
            "category": "Spam & Fake Invoice",
            "description": (
                "1 customer ('CUST-HACKER-001') membayar tagihan untuk 22 nama customer "
                "berbeda dalam < 2 menit (interval ~3 detik). Pola ini mengindikasikan "
                "akun biller digunakan untuk mengirim spam tagihan ke banyak identitas berbeda."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": ["distinct_customer_count >= 20 dalam 5 menit"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 22,
        },

        "burst_payment": {
            "title": "Burst Payment",
            "category": "Velocity Attack",
            "description": (
                "6 pembayaran dari 1 customer dalam 2 menit (interval ~20 detik). "
                "PAYMENT_GAP_MINUTES <= 5.0 memicu BURST_FLAG. "
                "Indikasi penggunaan skrip otomatis untuk melakukan pembayaran massal."
            ),
            "target_engines": ["Pattern Engine", "ML Engine"],
            "trigger_conditions": ["PAYMENT_GAP_MINUTES <= 5.0 → BURST_FLAG = 1"],
            "fraud_pattern": None,
            "expected_result": "FLAGGED / FRAUD",
            "transaction_count": 6,
        },

        "high_spike": {
            "title": "High Spike (Overpayment Extreme)",
            "category": "Amount Anomaly",
            "description": (
                "Pembayaran jauh melebihi tagihan (4–8× lipat). "
                "PAYMENT_TO_BILL_RATIO > 4.0 memicu HIGH_SPIKE_FLAG. "
                "Indikasi card testing — fraudster mengetes kartu curian dengan "
                "sengaja overpay untuk melihat apakah transaksi lolos."
            ),
            "target_engines": ["Pattern Engine", "ML Engine"],
            "trigger_conditions": ["payment_amount / total_tagihan BETWEEN 4.5 AND 8.0"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 3,
        },

        "underpay": {
            "title": "Underpayment (<30%)",
            "category": "Amount Anomaly",
            "description": (
                "Bayar hanya sebagian kecil tagihan (< 30%). "
                "PAYMENT_TO_BILL_RATIO < 0.3 memicu UNDERPAY_FLAG. "
                "Indikasi split payment fraud — membagi pembayaran untuk "
                "menghindari deteksi threshold."
            ),
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["payment_amount / total_tagihan < 0.3"],
            "fraud_pattern": None,
            "expected_result": "FLAGGED",
            "transaction_count": 3,
        },

        "channel_switch": {
            "title": "Channel Switch Anomaly",
            "category": "Behavioral Anomaly",
            "description": (
                "Customer yang sama melakukan pembayaran dari channel berbeda-beda "
                "(MOBILE, WEB, ATM, API) dalam waktu singkat. "
                "Mengindikasikan akun sedang diakses dari banyak perangkat/lokasi "
                "sekaligus — kemungkinan account takeover."
            ),
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["distinct_channel_count >= 3 dalam waktu singkat"],
            "fraud_pattern": None,
            "expected_result": "FLAGGED",
            "transaction_count": 5,
        },

        "early_payment_anomaly": {
            "title": "Early Payment Anomaly",
            "category": "Behavioral Anomaly",
            "description": (
                "Pembayaran dilakukan 2 hari sebelum tanggal tagihan resmi terbit. "
                "PAYMENT_DELAY_DAYS < -1.0 adalah anomali — secara logika tidak mungkin "
                "membayar tagihan yang belum ada. Indikasi manipulasi timestamp atau "
                "eksploitasi sistem billing."
            ),
            "target_engines": ["ML Engine"],
            "trigger_conditions": ["tanggal_pembayaran < tanggal_tagihan (PAYMENT_DELAY_DAYS < -1.0)"],
            "fraud_pattern": None,
            "expected_result": "FLAGGED",
            "transaction_count": 3,
        },

        "velocity_burst": {
            "title": "Velocity Burst",
            "category": "Velocity Attack",
            "description": (
                "8 pembayaran dari customer yang sama dalam 4 menit (interval ~25 detik). "
                "Memicu velocity check di Pattern Engine dan Rule Engine."
            ),
            "target_engines": ["Pattern Engine", "Rule Engine"],
            "trigger_conditions": ["tx_count >= 5 dalam 5 menit"],
            "fraud_pattern": None,
            "expected_result": "FLAGGED / FRAUD",
            "transaction_count": 8,
        },

        "smurfing": {
            "title": "High-Velocity Split Payment Anomaly (Smurfing)",
            "category": "Money Laundering",
            "description": (
                "Pelaku fraud / pencucian uang menghindari threshold monitoring bank "
                "dengan metode Smurfing — memecah satu transaksi besar menjadi "
                "rangkaian transaksi kecil bervolume tinggi. "
                "Pada Nusabill, fraudster mengeksploitasi Virtual Account dengan "
                "melakukan pelunasan tagihan secara beruntun menggunakan skrip otomatis "
                "dalam hitungan menit untuk memindahkan dana gelap sebelum tercium "
                "tim compliance. "
                "Scenario: 6 pembayaran ~4.5–6 juta dalam 7 menit, total ~30 juta."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "tx_count >= 5 dalam 8 menit",
                "total_amount >= 24,999,998",
            ],
            "fraud_pattern": None,
            "expected_result": "FLAGGED / FRAUD",
            "transaction_count": 6,
        },

        "fake_invoice_blast": {
            "title": "Fake Invoice Mass Blast Detection",
            "category": "Spam & Fake Invoice",
            "description": (
                "Fraudster meretas akun Biller resmi di Nusabill, kemudian meluncurkan "
                "skrip bot untuk menembakkan tagihan VA palsu secara massal ke nomor "
                "WhatsApp masyarakat acak. Pelaku berharap ada korban yang panik dan "
                "langsung membayar tagihan tersebut. "
                "Perbedaan dari fan_out_spam: tiap invoice minimal Rp 250.000 (ada threshold amount). "
                "Scenario: 22 invoice ke 22 nama berbeda, masing-masing 250–500 ribu, dalam < 5 menit."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": [
                "distinct_customer_count >= 20 dalam 6 menit",
                "amount >= 250,000 per invoice",
            ],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 22,
        },

        "high_amount": {
            "title": "High Amount Invoice",
            "category": "Amount Anomaly",
            "description": (
                "Satu pembayaran invoice dengan nominal sangat besar (50–200 juta). "
                "Memicu Rule Engine (amount threshold >= 5.000.000) dan Pattern Engine."
            ),
            "target_engines": ["Rule Engine", "Pattern Engine"],
            "trigger_conditions": ["amount BETWEEN 50,000,000 AND 200,000,000 (> 5,000,000 threshold)"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },

        "api_abuse": {
            "title": "Velocity Burst API Abuse",
            "category": "Velocity Attack",
            "description": (
                "1 customer membombardir 105 transaksi dalam < 5 menit via channel API "
                "(interval ~2.7 detik). Indikasi penggunaan skrip/bot untuk "
                "mengeksploitasi endpoint pembayaran secara massal. "
                "tx_count=105 jauh melampaui threshold 100 transaksi dalam 5 menit."
            ),
            "target_engines": ["Pattern Engine"],
            "trigger_conditions": ["tx_count >= 100 dalam 5 menit", "channel == 'API'"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 105,
        },

        "rule_nusabill_repayment_block": {
            "title": "Rule — Repayment Block (Double Payment)",
            "category": "Rule Violation",
            "description": (
                "Mencoba membayar invoice yang status_tagihan-nya sudah 'PAID'. "
                "Double payment bisa mengindikasikan eksploitasi sistem atau "
                "percobaan refund fraud."
            ),
            "target_engines": ["Rule Engine"],
            "trigger_conditions": ["status_tagihan == 'PAID'"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },

        "rule_nusabill_max_unverified_bill": {
            "title": "Rule — Max Unverified Bill Exceeded",
            "category": "Rule Violation",
            "description": (
                "Tagihan dari Biller yang belum menyelesaikan verifikasi KYC "
                "melebihi threshold Rp 5.000.000. Untuk melindungi customer dari "
                "biller tidak terverifikasi yang membuat tagihan fiktif bernilai besar."
            ),
            "target_engines": ["Rule Engine"],
            "trigger_conditions": ["amount BETWEEN 5,500,000 AND 10,000,000 (> 5,000,000)"],
            "fraud_pattern": None,
            "expected_result": "FRAUD",
            "transaction_count": 1,
        },
    },
}

# Sumber aktif scenario dan metadata berada di masing-masing generator.
# Catalog lama di atas dipertahankan sementara sebagai referensi historis.
_SCENARIO_CATALOG = {
    "agenusa": agenusa_scenario_catalog(),
    "nusabill": nusabill_scenario_catalog(),
}


# ─────────────────────────────────────────────────────────────────────────────
# EXISTING: Live Simulation
# ─────────────────────────────────────────────────────────────────────────────

class SimulateRequest(BaseModel):
    domain: Literal["agenusa", "nusabill", "all"] = "all"
    scenario: str | None = None


@router.post("/generate", summary="Jalankan live simulation (background)")
async def generate_live(payload: SimulateRequest, background_tasks: BackgroundTasks):
    if not reserve_simulation_service():
        raise HTTPException(
            status_code=400,
            detail="Simulasi sedang berjalan. Harap stop terlebih dahulu."
        )
    background_tasks.add_task(run_live_simulation, payload.domain, payload.scenario)
    return {
        "status": "success",
        "message": f"Live simulation started for domain: {payload.domain}",
        "data": get_simulation_status_service(),
    }


@router.post("/stop", summary="Stop live simulation")
async def stop_simulation():
    stopped = stop_simulation_service()
    if not stopped:
        return {"status": "success", "message": "Tidak ada simulasi yang sedang berjalan."}
    return {"status": "success", "message": "Perintah stop diterima. Simulasi akan segera dihentikan."}


@router.get("/status", summary="Status live simulation")
def get_simulation_status():
    return {
        "status": "success",
        "data": get_simulation_status_service()
    }


@router.get("/scenarios", summary="List scenario yang tersedia")
def list_scenarios():
    agenusa_catalog = agenusa_scenario_catalog()
    nusabill_catalog = nusabill_scenario_catalog()

    def scenario_type(info: dict) -> str:
        if info.get("category") == "Blacklist":
            return "BLACKLIST"
        if info.get("category") == "Baseline":
            return "BASELINE"
        if info.get("global_rule"):
            return "RULE"
        if info.get("ml_pattern"):
            return "ML"
        return "PATTERN"

    return {
        "status": "success",
        "data": {
            "agenusa": list(agenusa_scenarios().keys()),
            "nusabill": list(nusabill_scenarios().keys()),
            "scenario_details": {
                "agenusa": [
                    {
                        "key": key,
                        "scenario_type": scenario_type(agenusa_catalog[key]),
                        **agenusa_catalog[key],
                    }
                    for key in agenusa_catalog
                ],
                "nusabill": [
                    {
                        "key": key,
                        "scenario_type": scenario_type(nusabill_catalog[key]),
                        **nusabill_catalog[key],
                    }
                    for key in nusabill_catalog
                ],
            },
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# SCENARIO PREVIEW
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/scenarios/{scenario_name}/preview",
    summary="Preview detail sebuah scenario",
    description=(
        "Return deskripsi naratif lengkap, target engine yang dipicu, "
        "kondisi trigger, info fraud pattern (jika ada), jumlah transaksi, "
        "dan sample transaksi pertama dari scenario tersebut. "
        "Gunakan query param `service` untuk membedakan scenario Agenusa vs Nusabill."
    ),
)
def preview_scenario(
    scenario_name: str,
    service: Literal["agenusa", "nusabill"] = "agenusa",
):
    catalog = _SCENARIO_CATALOG.get(service, {})
    info    = catalog.get(scenario_name)

    if not info:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Scenario '{scenario_name}' tidak ditemukan untuk service '{service}'. "
                f"Tersedia: {list(catalog.keys())}"
            ),
        )

    # Ambil sample transaksi pertama dari generator (tidak insert ke DB)
    sample_transaction = None
    try:
        if service == "agenusa":
            txs = agenusa_scenarios().get(scenario_name, [])
        else:
            txs = nusabill_scenarios().get(scenario_name, [])

        if txs:
            raw = txs[0].copy()
            # Sanitize: datetime → isoformat agar JSON-serializable
            sample_transaction = {
                k: (v.isoformat() if hasattr(v, "isoformat") else v)
                for k, v in raw.items()
            }
    except Exception:
        sample_transaction = None

    return {
        "status": "success",
        "data": {
            "scenario_key":       scenario_name,
            "service":            service.upper(),
            **info,
            "sample_transaction": sample_transaction,
        },
    }


@router.get(
    "/scenarios/{scenario_name}/transactions",
    summary="Ambil transaksi scenario sebagai template Bulk",
)
def get_scenario_transactions(
    scenario_name: str,
    service: Literal["agenusa", "nusabill"] = "agenusa",
):
    scenarios = agenusa_scenarios() if service == "agenusa" else nusabill_scenarios()
    transactions = scenarios.get(scenario_name)
    if transactions is None:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_name}' tidak ditemukan untuk service '{service}'.",
        )
    return {
        "status": "success",
        "data": {
            "service": service,
            "scenario": scenario_name,
            "count": len(transactions),
            "transactions": transactions,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# MANUAL SINGLE — Agenusa
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/manual/agenusa",
    response_model=ManualSimulateResponse,
    summary="Manual input 1 transaksi Agenusa",
    description=(
        "Insert satu transaksi Agenusa ke switching_logs → transactions_feed → ML pipeline. "
        "Gunakan field `inject_anomaly` untuk menyimulasikan pola fraud secara otomatis."
    ),
)
async def manual_agenusa(
    payload: AgenusaManualInput,
    db: Session = Depends(get_db),
):
    try:
        result = await manual_input_agenusa(payload.model_dump(), db)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

    return ManualSimulateResponse(
        status="success",
        message=f"Transaksi Agenusa berhasil diproses. Risk level: {result.get('risk_level', 'N/A')}.",
        data=result,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MANUAL SINGLE — Nusabill
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/manual/nusabill",
    response_model=ManualSimulateResponse,
    summary="Manual input 1 transaksi Nusabill",
    description=(
        "Insert satu transaksi Nusabill ke invoice_transactions → transactions_feed → ML pipeline. "
        "Gunakan `payment_amount` < `total_tagihan` untuk underpayment, "
        "atau `inject_anomaly` untuk pola fraud otomatis."
    ),
)
async def manual_nusabill(
    payload: NusabillManualInput,
    db: Session = Depends(get_db),
):
    try:
        result = await manual_input_nusabill(payload.model_dump(), db)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

    return ManualSimulateResponse(
        status="success",
        message=f"Transaksi Nusabill berhasil diproses. Risk level: {result.get('risk_level', 'N/A')}.",
        data=result,
    )


# ─────────────────────────────────────────────────────────────────────────────
# BULK — Agenusa
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/bulk/agenusa",
    response_model=BulkSimulateResponse,
    summary="Bulk input transaksi Agenusa",
    description=(
        "Insert banyak transaksi Agenusa sekaligus (maks 150 per request). "
        "Gunakan `delay_ms=0` + `inject_anomaly='RAPID_FIRE'` untuk simulasi velocity attack. "
        "Set `stop_on_error=true` jika ingin berhenti saat ada 1 transaksi yang gagal."
    ),
)
async def bulk_agenusa(
    payload: AgenusaBulkInput,
    db: Session = Depends(get_db),
):
    try:
        result = await bulk_input_agenusa(
            transactions=[t.model_dump() for t in payload.transactions],
            delay_ms=payload.delay_ms,
            stop_on_error=payload.stop_on_error,
            db=db,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

    return BulkSimulateResponse(
        status="success",
        message=f"Bulk Agenusa selesai: {result['succeeded']} sukses, {result['failed']} gagal, {result['skipped']} dilewati.",
        total=result["total"],
        succeeded=result["succeeded"],
        failed=result["failed"],
        skipped=result["skipped"],
        results=result["results"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# BULK — Nusabill
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/bulk/nusabill",
    response_model=BulkSimulateResponse,
    summary="Bulk input transaksi Nusabill",
    description=(
        "Insert banyak transaksi Nusabill sekaligus (maks 150 per request). "
        "Tiap item di list bisa punya `inject_anomaly` yang berbeda-beda "
        "untuk simulasi mix pattern dalam satu batch."
    ),
)
async def bulk_nusabill(
    payload: NusabillBulkInput,
    db: Session = Depends(get_db),
):
    try:
        result = await bulk_input_nusabill(
            transactions=[t.model_dump() for t in payload.transactions],
            delay_ms=payload.delay_ms,
            stop_on_error=payload.stop_on_error,
            db=db,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

    return BulkSimulateResponse(
        status="success",
        message=f"Bulk Nusabill selesai: {result['succeeded']} sukses, {result['failed']} gagal, {result['skipped']} dilewati.",
        total=result["total"],
        succeeded=result["succeeded"],
        failed=result["failed"],
        skipped=result["skipped"],
        results=result["results"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# REPLAY
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/replay",
    response_model=ReplayResponse,
    summary="Replay / clone transaksi dari transactions_feed",
    description=(
        "Ambil transaksi yang sudah ada (berdasarkan transaction_id), "
        "clone dengan ID baru, lalu re-process ke full pipeline. "
        "Bisa di-override amount / timestamp / anomaly sebelum di-replay."
    ),
)
async def replay(
    payload: ReplayRequest,
    db: Session = Depends(get_db),
):
    try:
        result = await replay_transaction(
            transaction_id=payload.transaction_id,
            override_amount=payload.override_amount,
            override_timestamp=payload.override_timestamp,
            inject_anomaly=payload.inject_anomaly,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

    return ReplayResponse(
        status="success",
        message=f"Replay dari trx_id={payload.transaction_id} berhasil. Risk level: {result.get('risk_level', 'N/A')}.",
        data=result,
    )


# ─────────────────────────────────────────────────────────────────────────────
# RESET
# ─────────────────────────────────────────────────────────────────────────────

@router.delete(
    "/reset",
    response_model=ResetResponse,
    summary="Reset / hapus data simulasi",
    description=(
        "Hapus semua atau sebagian data simulasi dari database. "
        "Field `confirm` HARUS diset True sebagai safeguard. "
        "Field `target` menentukan table mana yang dihapus: "
        "'all', 'agenusa', 'nusabill', atau 'transactions_feed'."
    ),
)
def reset(
    payload: ResetRequest,
    db: Session = Depends(get_db),
):
    if not payload.confirm:
        raise HTTPException(
            status_code=400,
            detail="Reset dibatalkan. Set 'confirm: true' untuk melanjutkan."
        )

    try:
        deleted = reset_simulator_data(target=payload.target, db=db)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    total_deleted = sum(deleted.values())

    return ResetResponse(
        status="success",
        message=f"Reset '{payload.target}' selesai. Total {total_deleted} baris dihapus.",
        deleted=deleted,
    )
