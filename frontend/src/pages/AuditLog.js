import React, { useState, useEffect, useCallback, useRef } from "react";
import ActivityStats from "../components/auditlog/ActivityStats";
import ActivityFilters from "../components/auditlog/ActivityFilters";
import ActivityFeed from "../components/auditlog/ActivityFeed";
import "./AuditLog.css";
import PageLoader from "../components/common/PageLoader";
import activityLogService, {
  AUDIT_LOG_ACTIONS,
} from "../services/activityLogService";

// Mapping action_type BE → type display FE
const ACTION_TYPE_MAP = {
  ACCOUNT_CREATED: "create",
  ACCOUNT_ROLE_CHANGED: "edit",
  ACCOUNT_SUSPENDED: "suspend",
};

// Konversi log BE ke format feed
const toFeedItem = (log) => {
  const type = ACTION_TYPE_MAP[log.action_type] || "edit";
  const details = log.details || {};

  // Nama target — prioritas: details.email, details.full_name, target_id
  const targetName = details.email || details.full_name || log.target_id || "—";

  let desc = "";
  if (typeof details === "string") {
    desc = details;
  } else if (type === "create") {
    desc = `Membuat akun baru untuk ${targetName}${details.department ? ` — Departemen: ${details.department}` : ""}`;
  } else if (type === "edit") {
    const before = details.before || {};
    const after = details.after || {};
    const changes = Object.keys(after)
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => `${k}: ${before[k] ?? "—"} → ${after[k]}`)
      .join(", ");
    desc = `Memperbarui akun ${targetName}${changes ? `: ${changes}` : ""}`;
  } else if (type === "suspend") {
    const isActive = details.target_status_active;
    if (isActive === true) desc = `Mengaktifkan kembali akun ${targetName}`;
    else if (isActive === false) desc = `Men-suspend akun ${targetName}`;
    else desc = details.reason || `Akun ${targetName} diarsipkan`;
  }

  return {
    id: log.id,
    type,
    action_type: log.action_type,
    desc,
    time: log.created_at
      ? new Date(log.created_at).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—",
    created_at: log.created_at,
    actor: log.admin_name || "System",
    actor_email: log.admin_email,
    actor_display:
      log.admin_name && log.admin_email
        ? `${log.admin_name} (${log.admin_email})`
        : log.admin_name || "System",
  };
};

const FALLBACK_LOGS = [
  {
    id: "f-01",
    type: "create",
    desc: "Membuat akun baru untuk Hani Puspita (Fraud Analyst) — Departemen: Risk Management",
    time: "10 Feb 2024",
    actor: "Super Admin",
  },
  {
    id: "f-02",
    type: "edit",
    desc: "Memperbarui akun Rizky Pratama: role: Fraud Analyst → Admin",
    time: "08 Feb 2024",
    actor: "Super Admin",
  },
  {
    id: "f-03",
    type: "suspend",
    desc: "Men-suspend akun Lina Kusuma (Fraud Analyst)",
    time: "05 Feb 2024",
    actor: "Super Admin",
  },
  {
    id: "f-04",
    type: "create",
    desc: "Membuat akun baru untuk Dian Permata (Fraud Analyst) — Departemen: Risk Management",
    time: "01 Feb 2024",
    actor: "Super Admin",
  },
  {
    id: "f-05",
    type: "edit",
    desc: "Memperbarui akun Fajar Nugroho: departemen: Risk Management → Fraud Prevention",
    time: "30 Jan 2024",
    actor: "Super Admin",
  },
  {
    id: "f-06",
    type: "suspend",
    desc: "Menghapus akun Toni Hidayat (Fraud Analyst) — Risk Management",
    time: "28 Jan 2024",
    actor: "Super Admin",
  },
];

// Export helpers
const TYPE_LABEL = { create: "Dibuat", edit: "Diedit", suspend: "Disuspend" };

const exportCSV = (logs, dateFrom, dateTo) => {
  activityLogService.exportToCSV(
    logs.map((l) => ({
      id: l.id,
      action_type: l.action_type || l.type,
      created_at: l.created_at,
      module_source: "AUTH",
      severity: "INFO",
      admin_name: l.actor_display || l.actor,
      admin_email: l.actor_email,
      target_type: "ADMIN",
      target_id: null,
      details: l.desc,
    })),
    `audit-log${dateFrom && dateTo ? `_${dateFrom}_${dateTo}` : ""}`,
  );
};

const exportExcel = async (logs, dateFrom, dateTo) => {
  const suffix = dateFrom && dateTo ? `_${dateFrom}_${dateTo}` : "";
  const XLSX = await import("xlsx");
  const data = logs.map((log, i) => ({
    No: i + 1,
    Tipe: TYPE_LABEL[log.type] || log.type,
    Waktu: log.time,
    Deskripsi: log.desc,
    Aktor: log.actor_display || log.actor || "-",
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
    `${rangeText}Diekspor: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} — ${logs.length} entri`,
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
      log.actor_display || log.actor || "-",
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
    desc: "Format Microsoft Excel",
    icon: "bi-filetype-xlsx",
    cls: "al-fmt-excel",
  },
  {
    id: "pdf",
    label: "PDF",
    desc: "Siap cetak",
    icon: "bi-filetype-pdf",
    cls: "al-fmt-pdf",
  },
];

// ---- Export Modal (tidak berubah dari versi lama) ----
const ExportModal = ({ allLogs, onClose }) => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activePreset, setActivePreset] = useState(null);
  const [formats, setFormats] = useState({
    csv: true,
    excel: false,
    pdf: false,
  });
  const [exporting, setExporting] = useState(false);

  const applyPreset = (preset) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    let from = "",
      to = fmt(now);
    if (preset === "today") {
      from = to;
    } else if (preset === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      from = fmt(d);
    } else if (preset === "month") {
      from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    } else if (preset === "year") {
      from = `${now.getFullYear()}-01-01`;
    }
    setDateFrom(from);
    setDateTo(to);
    setActivePreset(preset);
  };

  const filteredByDate = allLogs.filter((log) => {
    if (!dateFrom && !dateTo) return true;
    const d = log.created_at ? new Date(log.created_at) : null;
    if (!d) return false;
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const toggleFormat = (id) => setFormats((f) => ({ ...f, [id]: !f[id] }));
  const selectedFormats = Object.keys(formats).filter((k) => formats[k]);
  const canExport = selectedFormats.length > 0;

  const handleExport = async () => {
    setExporting(true);
    const from = dateFrom || null;
    const to = dateTo || null;
    try {
      if (formats.csv) exportCSV(filteredByDate, from, to);
      if (formats.excel) await exportExcel(filteredByDate, from, to);
      if (formats.pdf) await exportPDF(filteredByDate, from, to);
    } finally {
      setExporting(false);
      onClose();
    }
  };

  const PRESETS = [
    { id: "today", label: "Hari Ini" },
    { id: "week", label: "7 Hari Terakhir" },
    { id: "month", label: "Bulan Ini" },
    { id: "year", label: "Tahun Ini" },
  ];

  return (
    <>
      <div className="al-modal-backdrop" onClick={onClose} />
      <div className="al-modal-wrap">
        <div className="al-modal">
          <div className="al-modal-header">
            <div className="al-modal-header-left">
              <div className="al-modal-header-icon">
                <i className="bi bi-download"></i>
              </div>
              <div>
                <p className="al-modal-title">Export Audit Log</p>
                <p className="al-modal-subtitle">
                  {allLogs.length} entri tersedia
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
                <i className="bi bi-calendar-range"></i>Rentang Tanggal
                <span className="al-section-hint">Opsional</span>
              </div>
              <div className="al-presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className={`al-preset-btn ${activePreset === p.id ? "al-preset-active" : ""}`}
                    onClick={() => applyPreset(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="al-date-row">
                <div className="al-date-field">
                  <label className="al-date-label">Dari</label>
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
                  <label className="al-date-label">Sampai</label>
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
                    <i className="bi bi-exclamation-circle"></i>Tidak ada entri
                    dalam rentang tanggal ini
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
                <i className="bi bi-file-earmark-arrow-down"></i>Format Export
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
                  <i className="bi bi-download"></i>Export
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

const ACTION_TYPE_FILTER = {
  create: ["ACCOUNT_CREATED"],
  edit: ["ACCOUNT_ROLE_CHANGED"],
  suspend: ["ACCOUNT_SUSPENDED"],
};

// ---- Main Page ----
const AuditLog = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [apiError, setApiError] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showExportModal, setShowExportModal] = useState(false);
  const debounceTimer = useRef(null);

  const fetchLogs = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setLoading(true);
      try {
        const params = {
          page: 1,
          limit: 200,
          action_types:
            typeFilter === "all"
              ? AUDIT_LOG_ACTIONS
              : ACTION_TYPE_FILTER[typeFilter] || AUDIT_LOG_ACTIONS,
        };
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

        const res = await activityLogService.getAuditLogs(params);
        const items = (res.items || []).map(toFeedItem);
        setLogs(items);
        setTotalRecords(res.total || items.length);
        setApiError(false);
      } catch {
        setApiError(true);
        setLogs(FALLBACK_LOGS);
        setTotalRecords(FALLBACK_LOGS.length);
      } finally {
        setLoading(false);
      }
    },
    [typeFilter, debouncedSearch],
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(val), 400);
  };

  const handleReset = () => {
    setSearch("");
    setDebouncedSearch("");
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
            disabled={logs.length === 0}
          >
            <i className="bi bi-download"></i>Export Log
          </button>
          <button
            onClick={() => fetchLogs(true)}
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
            <i className="bi bi-arrow-clockwise"></i>Refresh
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

      <ActivityStats logs={logs} />

      <ActivityFilters
        search={search}
        onSearch={handleSearch}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        onReset={handleReset}
      />

      <div className="al-card">
        <div className="al-card-header">
          <h2 className="al-card-title">
            <i className="bi bi-list-ul"></i>
            Log Aktivitas
            <span className="al-count">
              ({logs.length} dari {totalRecords.toLocaleString()} entri)
            </span>
          </h2>
        </div>
        <ActivityFeed logs={logs} />
      </div>

      {showExportModal && (
        <ExportModal allLogs={logs} onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
};

export default AuditLog;
