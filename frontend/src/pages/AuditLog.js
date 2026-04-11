import React, { useState, useEffect, useMemo, useCallback } from "react";
import ActivityStats from "../components/auditlog/ActivityStats";
import ActivityFilters from "../components/auditlog/ActivityFilters";
import ActivityFeed from "../components/auditlog/ActivityFeed";
import "./AuditLog.css";
import PageLoader from "../components/common/PageLoader";

const SEED_LOGS = [
  {
    id: "seed-01",
    type: "create",
    actor_name: "Super Admin",
    target_name: "Hani Puspita",
    target_role: "analyst",
    detail:
      "Membuat akun baru untuk Hani Puspita (Fraud Analyst) — Departemen: Risk Management",
    time_label: "10 Feb 2024",
  },
  {
    id: "seed-02",
    type: "edit",
    actor_name: "Super Admin",
    target_name: "Rizky Pratama",
    target_role: "admin",
    detail: "Memperbarui akun Rizky Pratama: role: Fraud Analyst → Admin",
    time_label: "08 Feb 2024",
  },
  {
    id: "seed-03",
    type: "suspend",
    actor_name: "Super Admin",
    target_name: "Lina Kusuma",
    target_role: "analyst",
    detail: "Men-suspend akun Lina Kusuma (Fraud Analyst)",
    time_label: "05 Feb 2024",
  },
  {
    id: "seed-04",
    type: "create",
    actor_name: "Super Admin",
    target_name: "Dian Permata",
    target_role: "analyst",
    detail:
      "Membuat akun baru untuk Dian Permata (Fraud Analyst) — Departemen: Risk Management",
    time_label: "01 Feb 2024",
  },
  {
    id: "seed-05",
    type: "edit",
    actor_name: "Super Admin",
    target_name: "Fajar Nugroho",
    target_role: "analyst",
    detail:
      "Memperbarui akun Fajar Nugroho: departemen: Risk Management → Fraud Prevention",
    time_label: "30 Jan 2024",
  },
  {
    id: "seed-06",
    type: "delete",
    actor_name: "Super Admin",
    target_name: "Toni Hidayat",
    target_role: "analyst",
    detail: "Menghapus akun Toni Hidayat (Fraud Analyst) — Risk Management",
    time_label: "28 Jan 2024",
  },
  {
    id: "seed-07",
    type: "create",
    actor_name: "Super Admin",
    target_name: "Fajar Nugroho",
    target_role: "analyst",
    detail:
      "Membuat akun baru untuk Fajar Nugroho (Fraud Analyst) — Departemen: Fraud Prevention",
    time_label: "05 Feb 2024",
  },
  {
    id: "seed-08",
    type: "edit",
    actor_name: "Super Admin",
    target_name: "Budi Santoso",
    target_role: "analyst",
    detail: "Memperbarui akun Budi Santoso: email diperbarui",
    time_label: "25 Jan 2024",
  },
  {
    id: "seed-09",
    type: "suspend",
    actor_name: "Super Admin",
    target_name: "Maya Indah",
    target_role: "analyst",
    detail: "Men-suspend akun Maya Indah (Fraud Analyst) sementara",
    time_label: "22 Jan 2024",
  },
  {
    id: "seed-10",
    type: "create",
    actor_name: "Super Admin",
    target_name: "Irwan Setiawan",
    target_role: "superadmin",
    detail:
      "Membuat akun baru untuk Irwan Setiawan (Super Admin) — Departemen: Risk Management",
    time_label: "15 Feb 2024",
  },
  {
    id: "seed-11",
    type: "suspend",
    actor_name: "Super Admin",
    target_name: "Maya Indah",
    target_role: "analyst",
    detail: "Mengaktifkan kembali akun Maya Indah (Fraud Analyst)",
    time_label: "20 Jan 2024",
  },
  {
    id: "seed-12",
    type: "delete",
    actor_name: "Super Admin",
    target_name: "Ahmad Kurniawan",
    target_role: "analyst",
    detail: "Menghapus akun Ahmad Kurniawan (Fraud Analyst) — Compliance",
    time_label: "18 Jan 2024",
  },
];

const toFeedItem = (log) => ({
  id: log.id,
  type: log.type,
  desc: log.detail,
  time: log.time_label || log.timestamp?.slice(0, 10) || "—",
  timestamp: log.timestamp || "",
  actor: log.actor_name,
});

const TYPE_LABEL = {
  create: "Dibuat",
  edit: "Diedit",
  suspend: "Disuspend",
  delete: "Dihapus",
};

const parseLogDate = (timeStr) => {
  if (!timeStr || timeStr === "—") return null;
  const d = new Date(timeStr);
  return isNaN(d.getTime()) ? null : d;
};

const inputToDate = (val) => {
  if (!val) return null;
  const [y, m, d] = val.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const toInputVal = (date) => (date ? date.toISOString().slice(0, 10) : "");

const exportCSV = (logs, dateFrom, dateTo) => {
  const suffix = dateFrom && dateTo ? `_${dateFrom}_${dateTo}` : "";
  const headers = ["No", "Tipe", "Waktu", "Deskripsi", "Aktor"];
  const rows = logs.map((log, i) => [
    i + 1,
    TYPE_LABEL[log.type] || log.type,
    log.time,
    log.desc,
    log.actor || "-",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log${suffix}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportExcel = async (logs, dateFrom, dateTo) => {
  const suffix = dateFrom && dateTo ? `_${dateFrom}_${dateTo}` : "";
  const XLSX = await import("xlsx");
  const data = logs.map((log, i) => ({
    No: i + 1,
    Tipe: TYPE_LABEL[log.type] || log.type,
    Waktu: log.time,
    Deskripsi: log.desc,
    Aktor: log.actor || "-",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 5 },
    { wch: 12 },
    { wch: 14 },
    { wch: 60 },
    { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Audit Log");
  XLSX.writeFile(wb, `audit-log${suffix}.xlsx`);
};

const exportPDF = async (logs, dateFrom, dateTo) => {
  const suffix = dateFrom && dateTo ? `_${dateFrom}_${dateTo}` : "";
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("Audit Log", 14, 16);
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.setTextColor(150);
  const rangeText =
    dateFrom && dateTo ? `Periode: ${dateFrom} s/d ${dateTo} — ` : "";
  doc.text(
    `${rangeText}Diekspor: ${new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })} — ${logs.length} entri`,
    14,
    23,
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 29,
    head: [["No", "Tipe", "Waktu", "Deskripsi", "Aktor"]],
    body: logs.map((log, i) => [
      i + 1,
      TYPE_LABEL[log.type] || log.type,
      log.time,
      log.desc,
      log.actor || "-",
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [220, 38, 38], fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: 28 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 30 },
    },
    alternateRowStyles: { fillColor: [253, 253, 253] },
  });
  doc.save(`audit-log${suffix}.pdf`);
};

const FORMAT_OPTIONS = [
  {
    id: "csv",
    label: "CSV",
    desc: "Kompatibel dengan semua spreadsheet",
    icon: "bi-filetype-csv",
    cls: "al-fmt-csv",
  },
  {
    id: "excel",
    label: "Excel (.xlsx)",
    desc: "Format Microsoft Excel dengan kolom terformat",
    icon: "bi-filetype-xlsx",
    cls: "al-fmt-excel",
  },
  {
    id: "pdf",
    label: "PDF",
    desc: "Siap cetak, layout landscape",
    icon: "bi-filetype-pdf",
    cls: "al-fmt-pdf",
  },
];

const PRESETS = [
  { label: "7 Hari Terakhir", days: 7 },
  { label: "30 Hari Terakhir", days: 30 },
  { label: "90 Hari Terakhir", days: 90 },
  { label: "Semua Data", days: null },
];

const ExportModal = ({ onClose, allLogs }) => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [dateFrom, setDateFrom] = useState(toInputVal(thirtyDaysAgo));
  const [dateTo, setDateTo] = useState(toInputVal(today));
  const [formats, setFormats] = useState({
    csv: false,
    excel: false,
    pdf: false,
  });
  const [exporting, setExporting] = useState(false);
  const [activePreset, setActivePreset] = useState("30 Hari Terakhir");

  const toggleFormat = (id) =>
    setFormats((prev) => ({ ...prev, [id]: !prev[id] }));

  const applyPreset = (preset) => {
    setActivePreset(preset.label);
    if (preset.days === null) {
      setDateFrom("");
      setDateTo("");
    } else {
      const from = new Date(today);
      from.setDate(today.getDate() - preset.days);
      setDateFrom(toInputVal(from));
      setDateTo(toInputVal(today));
    }
  };

  const filteredByDate = useMemo(() => {
    const from = inputToDate(dateFrom);
    const to = inputToDate(dateTo);
    if (!from && !to) return allLogs;
    return allLogs.filter((log) => {
      const d = parseLogDate(log.time);
      if (!d) return true;
      const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (from && dMid < from) return false;
      if (to && dMid > to) return false;
      return true;
    });
  }, [allLogs, dateFrom, dateTo]);

  const selectedFormats = Object.entries(formats)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const canExport = selectedFormats.length > 0 && filteredByDate.length > 0;

  const handleExport = async () => {
    if (!canExport) return;
    setExporting(true);
    try {
      for (const fmt of selectedFormats) {
        if (fmt === "csv") exportCSV(filteredByDate, dateFrom, dateTo);
        if (fmt === "excel")
          await exportExcel(filteredByDate, dateFrom, dateTo);
        if (fmt === "pdf") await exportPDF(filteredByDate, dateFrom, dateTo);
      }
      onClose();
    } catch (err) {
      console.error("Export error:", err);
      alert(
        "Gagal mengekspor. Pastikan package xlsx dan jspdf sudah terinstall.",
      );
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      <div className="al-modal-backdrop" onClick={onClose} />

      <div className="al-modal-wrap">
        <div className="al-modal">
          <div className="al-modal-header">
            <div className="al-modal-header-left">
              <span className="al-modal-header-icon">
                <i className="bi bi-download"></i>
              </span>
              <div>
                <h3 className="al-modal-title">Export Log Aktivitas</h3>
                <p className="al-modal-subtitle">
                  Pilih rentang tanggal dan format file ekspor
                </p>
              </div>
            </div>
            <button className="al-modal-close" onClick={onClose}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <div className="al-modal-body">
            <div className="al-modal-section">
              <div className="al-section-label">
                <i className="bi bi-calendar-range"></i>
                Rentang Tanggal
              </div>

              <div className="al-presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className={`al-preset-btn ${activePreset === p.label ? "al-preset-active" : ""}`}
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="al-date-row">
                <div className="al-date-field">
                  <label className="al-date-label">Dari Tanggal</label>
                  <div className="al-date-input-wrap">
                    <i className="bi bi-calendar3 al-date-ico"></i>
                    <input
                      type="date"
                      className="al-date-input"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setActivePreset(null);
                      }}
                    />
                  </div>
                </div>

                <div className="al-date-sep">
                  <i className="bi bi-arrow-right"></i>
                </div>

                <div className="al-date-field">
                  <label className="al-date-label">Sampai Tanggal</label>
                  <div className="al-date-input-wrap">
                    <i className="bi bi-calendar3 al-date-ico"></i>
                    <input
                      type="date"
                      className="al-date-input"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setActivePreset(null);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                className={`al-date-preview ${filteredByDate.length === 0 ? "al-date-preview-empty" : ""}`}
              >
                {filteredByDate.length === 0 ? (
                  <>
                    <i className="bi bi-exclamation-circle"></i>
                    Tidak ada entri dalam rentang tanggal ini
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle-fill"></i>
                    <strong>{filteredByDate.length}</strong> entri ditemukan
                    {dateFrom && dateTo
                      ? ` dalam rentang ${dateFrom} s/d ${dateTo}`
                      : " (semua data)"}
                  </>
                )}
              </div>
            </div>

            <div className="al-modal-section al-modal-section-last">
              <div className="al-section-label">
                <i className="bi bi-file-earmark-arrow-down"></i>
                Format Export
                <span className="al-section-hint">
                  Bisa pilih lebih dari satu
                </span>
              </div>

              <div className="al-format-grid">
                {FORMAT_OPTIONS.map((fmt) => (
                  <button
                    key={fmt.id}
                    className={`al-format-card ${formats[fmt.id] ? "al-format-selected" : ""}`}
                    onClick={() => toggleFormat(fmt.id)}
                  >
                    <div className={`al-format-icon ${fmt.cls}`}>
                      <i className={`bi ${fmt.icon}`}></i>
                    </div>
                    <div className="al-format-info">
                      <div className="al-format-name">{fmt.label}</div>
                      <div className="al-format-desc">{fmt.desc}</div>
                    </div>
                    <div
                      className={`al-format-check ${formats[fmt.id] ? "al-format-check-on" : ""}`}
                    >
                      {formats[fmt.id] && <i className="bi bi-check2"></i>}
                    </div>
                  </button>
                ))}
              </div>

              {selectedFormats.length > 0 && (
                <div className="al-selected-hint">
                  <i className="bi bi-info-circle"></i>
                  {selectedFormats.length} format dipilih —{" "}
                  {selectedFormats.length} file akan diunduh sekaligus
                </div>
              )}
            </div>
          </div>

          <div className="al-modal-footer">
            <button className="al-modal-cancel" onClick={onClose}>
              Batal
            </button>
            <button
              className="al-modal-submit"
              onClick={handleExport}
              disabled={!canExport || exporting}
            >
              {exporting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm"
                    style={{ width: 14, height: 14 }}
                  />
                  Mengekspor...
                </>
              ) : (
                <>
                  <i className="bi bi-download"></i>
                  Export
                  {selectedFormats.length > 0
                    ? ` (${selectedFormats.length} format)`
                    : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const AuditLog = () => {
  const [loading, setLoading] = useState(true);
  const [apiLogs, setApiLogs] = useState([]);
  const [apiError, setApiError] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/audit-logs?page_size=100");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApiLogs(data.logs || []);
      setApiError(false);
    } catch {
      setApiError(true);
    }
  }, []);

  useEffect(() => {
    fetchLogs().finally(() => setLoading(false));
  }, [fetchLogs]);

  const allLogs = useMemo(() => {
    const apiItems = apiLogs.map(toFeedItem);
    const seedItems = SEED_LOGS.map(toFeedItem);
    const apiIds = new Set(apiItems.map((l) => l.id));
    return [...apiItems, ...seedItems.filter((l) => !apiIds.has(l.id))];
  }, [apiLogs]);

  const filtered = useMemo(() => {
    return allLogs.filter((log) => {
      const matchType = typeFilter === "all" || log.type === typeFilter;
      const matchSearch =
        !search ||
        log.desc.toLowerCase().includes(search.toLowerCase()) ||
        (log.actor || "").toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [allLogs, search, typeFilter]);

  const handleReset = () => {
    setSearch("");
    setTypeFilter("all");
  };

  if (loading) return <PageLoader message="Memuat Audit Log..." />;

  return (
    <div className="auditlog-page">
      <div className="al-header">
        <div className="al-header-left">
          <div className="al-header-icon">
            <i className="bi bi-clock-history"></i>
          </div>
          <div>
            <h1 className="al-title">Audit Log</h1>
            <p className="al-subtitle">
              Riwayat seluruh aktivitas dan perubahan sistem
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="al-export-btn"
            onClick={() => setShowExportModal(true)}
            disabled={allLogs.length === 0}
          >
            <i className="bi bi-download"></i>
            Export Log
          </button>

          <button
            onClick={() => {
              setLoading(true);
              fetchLogs().finally(() => setLoading(false));
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              border: "1.5px solid #e5e7eb",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
              fontSize: ".85rem",
              fontWeight: 600,
              color: "#6b7280",
              fontFamily: "inherit",
            }}
          >
            <i className="bi bi-arrow-clockwise"></i>
            Refresh
          </button>
        </div>
      </div>

      {apiError && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            borderRadius: 8,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: ".82rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i className="bi bi-exclamation-triangle-fill"></i>
          API tidak tersedia — menampilkan data historis sementara.
        </div>
      )}

      <ActivityStats logs={allLogs} />

      <ActivityFilters
        search={search}
        onSearch={setSearch}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        onReset={handleReset}
      />

      <div className="al-card">
        <div className="al-card-header">
          <h2 className="al-card-title">
            <i className="bi bi-list-ul"></i>
            Log Aktivitas
            <span className="al-count">({filtered.length} entri)</span>
          </h2>
        </div>
        <ActivityFeed logs={filtered} />
      </div>

      {showExportModal && (
        <ExportModal
          allLogs={allLogs}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
};

export default AuditLog;
