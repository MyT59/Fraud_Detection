export const SEED_ALERTS = [
  {
    id: "ALT001",
    type: "fraud",
    severity: "critical",
    status: "unread",
    title: "Fraud Terdeteksi - Skor Sangat Tinggi",
    message:
      "Transaksi TRX00892 memiliki fraud score 94/100. Jumlah Rp 75.000.000 dari IP yang diblokir.",
    txnId: "TRX00892",
    time: "2026-02-20 09:12:00",
  },
  {
    id: "ALT002",
    type: "blacklist",
    severity: "critical",
    status: "unread",
    title: "Blacklist Hit - Rekening Terblokir",
    message:
      "Rekening 7760123456 (BCA) yang masuk blacklist mencoba melakukan transaksi sebesar Rp 12.500.000.",
    txnId: "TRX00891",
    time: "2026-02-20 08:55:00",
  },
  {
    id: "ALT003",
    type: "rule",
    severity: "high",
    status: "unread",
    title: "Rule Engine - Transaksi Besar Akun Baru",
    message:
      'Akun berusia 3 hari mencoba transfer Rp 62.000.000. Rule "Transaksi Besar Akun Baru" terpicu.',
    txnId: "TRX00890",
    time: "2026-02-20 08:30:00",
  },
  {
    id: "ALT004",
    type: "review",
    severity: "high",
    status: "unread",
    title: "Manual Review - Antrian Menumpuk",
    message:
      "8 transaksi menunggu review lebih dari 2 jam. Segera tinjau antrian Manual Review.",
    txnId: null,
    time: "2026-02-20 08:00:00",
  },
  {
    id: "ALT005",
    type: "rule",
    severity: "high",
    status: "read",
    title: "Rule Engine - Frekuensi Transaksi Tinggi",
    message:
      'Akun USR44123 melakukan 13 transaksi dalam 1 jam. Rule "Frekuensi Tinggi" terpicu otomatis.',
    txnId: "TRX00887",
    time: "2026-02-19 23:44:00",
  },
  {
    id: "ALT006",
    type: "fraud",
    severity: "high",
    status: "read",
    title: "Fraud Terdeteksi - VPN & IP Asing",
    message:
      "Transaksi TRX00885 berasal dari VPN dengan IP 45.76.123.45 (negara: Rusia). Fraud score 87.",
    txnId: "TRX00885",
    time: "2026-02-19 22:10:00",
  },
  {
    id: "ALT007",
    type: "system",
    severity: "medium",
    status: "read",
    title: "Sistem - Model AI Diperbarui",
    message:
      "Model deteksi fraud versi 2.4.1 berhasil di-deploy. Akurasi meningkat dari 98.1% ke 98.7%.",
    txnId: null,
    time: "2026-02-19 18:00:00",
  },
  {
    id: "ALT008",
    type: "blacklist",
    severity: "medium",
    status: "read",
    title: "Blacklist - Import Massal Selesai",
    message:
      "47 rekening baru berhasil diimport ke blacklist dari laporan OJK. Menunggu verifikasi.",
    txnId: null,
    time: "2026-02-19 15:30:00",
  },
  {
    id: "ALT009",
    type: "rule",
    severity: "medium",
    status: "resolved",
    title: "Rule Engine - Transaksi Dini Hari",
    message:
      'Transaksi TRX00880 dilakukan pukul 02:33 WIB. Rule "Transaksi Dini Hari" terpicu, sudah disetujui.',
    txnId: "TRX00880",
    time: "2026-02-19 02:33:00",
  },
  {
    id: "ALT010",
    type: "system",
    severity: "low",
    status: "resolved",
    title: "Sistem - Backup Database Berhasil",
    message:
      "Backup harian database berhasil diselesaikan. Ukuran backup: 2.3 GB. Lokasi: cloud storage.",
    txnId: null,
    time: "2026-02-18 03:00:00",
  },
  {
    id: "ALT011",
    type: "fraud",
    severity: "critical",
    status: "resolved",
    title: "Fraud Terdeteksi - Duplikasi Transaksi",
    message:
      "Terdeteksi 3 transaksi identik dari akun USR99012 dalam 5 menit. Total kerugian dicegah: Rp 45.000.000.",
    txnId: "TRX00875",
    time: "2026-02-18 14:20:00",
  },
  {
    id: "ALT012",
    type: "review",
    severity: "low",
    status: "resolved",
    title: "Manual Review - Semua Diselesaikan",
    message:
      "Reviewer Sari Dewi berhasil menyelesaikan 12 transaksi pending dalam satu sesi.",
    txnId: null,
    time: "2026-02-17 17:45:00",
  },
];
