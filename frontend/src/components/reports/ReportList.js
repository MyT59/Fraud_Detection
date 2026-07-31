import React, { useState, useEffect, useRef } from "react";

const ROWS_PER_PAGE_OPTIONS = [5, 10, 15, 25];

const FORMAT_OPTIONS = ["PDF", "Excel", "CSV"];
const STATUS_OPTIONS = ["COMPLETED", "PROCESSING", "FAILED", "PENDING"];

const FORMAT_META = {
  PDF: {
    icon: "bi-filetype-pdf",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
  },
  XLSX: {
    icon: "bi-filetype-xlsx",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  Excel: {
    icon: "bi-filetype-xlsx",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  CSV: {
    icon: "bi-filetype-csv",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
};

const getFormatMeta = (format) =>
  FORMAT_META[format] ?? {
    icon: "bi-file-earmark",
    color: "#8e8e9e",
    bg: "#f4f4f8",
    border: "#e8e8f0",
  };

const ConfirmModal = ({ config, onConfirm, onCancel }) => {
  if (!config) return null;
  const isDelete = config.type === "delete";
  const fmt = getFormatMeta(config.report?.format);

  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(12,12,14,0.40)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 2000,
          animation: "fadeInBackdrop .2s ease",
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2001,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "all",
            width: "100%",
            maxWidth: 420,
            background: "white",
            borderRadius: 16,
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            overflow: "hidden",
            animation: "slideUpModal .25s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <div
            style={{ height: 4, background: isDelete ? "#dc2626" : "#16a34a" }}
          />
          <div style={{ padding: "1.75rem 1.75rem 1.5rem" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: isDelete ? "#fef2f2" : "#f0fdf4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1.25rem",
              }}
            >
              <i
                className={`bi bi-${isDelete ? "trash3-fill" : "download"}`}
                style={{
                  fontSize: "1.5rem",
                  color: isDelete ? "#dc2626" : "#16a34a",
                }}
              />
            </div>
            <h5
              style={{
                fontWeight: 700,
                fontSize: "1.05rem",
                color: "#1a1a1a",
                marginBottom: ".4rem",
              }}
            >
              {isDelete ? "Hapus Laporan?" : "Download Laporan?"}
            </h5>
            <p
              style={{
                fontSize: ".875rem",
                color: "#737373",
                marginBottom: "1.25rem",
                lineHeight: 1.5,
              }}
            >
              {isDelete
                ? "Laporan dan file export-nya akan dihapus. Tindakan ini tidak dapat dikembalikan dari dashboard."
                : `File akan didownload dalam format ${config.report?.format}.`}
            </p>
            <div
              style={{
                padding: ".875rem 1rem",
                background: "#fafafa",
                border: "1px solid #e5e5e5",
                borderRadius: 10,
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: ".875rem",
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: fmt.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <i
                  className={fmt.icon}
                  style={{ fontSize: "1.25rem", color: fmt.color }}
                />
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: ".875rem",
                    color: "#262626",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {config.report?.report_name || config.report?.type}
                </div>
                <div
                  style={{ fontSize: ".75rem", color: "#a3a3a3", marginTop: 2 }}
                >
                  {String(config.report?.id || "").slice(0, 8)}… ·{" "}
                  {config.report?.format} ·{" "}
                  {config.report?.total_records
                    ? `${config.report.total_records} rows`
                    : "—"}
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: ".625rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={onCancel}
                style={{
                  padding: ".6rem 1.25rem",
                  border: "1.5px solid #e5e5e5",
                  borderRadius: 8,
                  background: "white",
                  fontWeight: 600,
                  fontSize: ".875rem",
                  color: "#525252",
                  cursor: "pointer",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f5f5f5")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "white")
                }
              >
                Batal
              </button>
              <button
                onClick={onConfirm}
                style={{
                  padding: ".6rem 1.375rem",
                  border: "none",
                  borderRadius: 8,
                  background: isDelete ? "#dc2626" : "#16a34a",
                  fontWeight: 700,
                  fontSize: ".875rem",
                  color: "white",
                  cursor: "pointer",
                  transition: "all .15s",
                  display: "flex",
                  alignItems: "center",
                  gap: ".4rem",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = ".88")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <i
                  className={`bi bi-${isDelete ? "trash3" : "download"}`}
                  style={{ fontSize: ".85rem" }}
                />
                {isDelete ? "Ya, Hapus" : "Ya, Download"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeInBackdrop { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUpModal {
          from { opacity:0; transform:translateY(24px) scale(.97) }
          to   { opacity:1; transform:translateY(0)    scale(1)   }
        }
      `}</style>
    </>
  );
};

const ColFilterDropdown = ({
  label,
  options,
  value,
  onChange,
  onClear,
  open,
  onToggle,
  anchorRef,
}) => {
  const dropRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        dropRef.current &&
        !dropRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onToggle(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle, anchorRef]);

  const STATUS_COLORS = {
    Completed: { color: "#059669", bg: "#f0fdf4", dot: "#22c55e" },
    Processing: { color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" },
    Failed: { color: "#dc2626", bg: "#fef2f2", dot: "#ef4444" },
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={anchorRef}
        onClick={() => onToggle(!open)}
        className="col-filter-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 6px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          borderRadius: 5,
          color: value ? "var(--red)" : "var(--ink-40)",
          fontWeight: value ? 700 : 700,
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          transition: "color 0.15s",
        }}
      >
        {label}
        {value && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--red)",
              flexShrink: 0,
            }}
          />
        )}
        <i
          className={`bi bi-chevron-${open ? "up" : "down"}`}
          style={{ fontSize: "0.6rem", marginLeft: 1 }}
        />
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "white",
            border: "1px solid #e8e8f0",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(12,12,14,0.12)",
            minWidth: 160,
            zIndex: 500,
            animation: "colDropDown 0.18s cubic-bezier(0.22,1,0.36,1)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "6px 10px 4px",
              borderBottom: "1px solid #f4f4f8",
            }}
          >
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "#8e8e9e",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Filter {label}
            </span>
          </div>

          {options.map((opt) => {
            const isActive = value === opt;
            const sc = label === "Status" ? STATUS_COLORS[opt] : null;
            const fm = label === "Format" ? getFormatMeta(opt) : null;

            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(isActive ? null : opt);
                  onToggle(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: isActive
                    ? (sc?.bg ?? fm?.bg ?? "#fef2f2")
                    : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.12s",
                  borderBottom: "1px solid #f4f4f8",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "#f4f4f8";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                {fm && (
                  <i
                    className={fm.icon}
                    style={{ fontSize: "1rem", color: fm.color, flexShrink: 0 }}
                  />
                )}
                {sc && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: sc.dot,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive
                      ? (sc?.color ?? fm?.color ?? "#dc2626")
                      : "#525260",
                    flex: 1,
                  }}
                >
                  {opt}
                </span>
                {isActive && (
                  <i
                    className="bi bi-check2"
                    style={{
                      fontSize: "0.8rem",
                      color: sc?.color ?? fm?.color ?? "#dc2626",
                    }}
                  />
                )}
              </button>
            );
          })}

          {value && (
            <div style={{ padding: "6px 8px", borderTop: "1px solid #f4f4f8" }}>
              <button
                onClick={() => {
                  onClear();
                  onToggle(false);
                }}
                style={{
                  width: "100%",
                  padding: "5px 8px",
                  border: "1px solid #e8e8f0",
                  borderRadius: 6,
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#8e8e9e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  transition: "all 0.12s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f4f4f8";
                  e.currentTarget.style.color = "#dc2626";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#8e8e9e";
                }}
              >
                <i className="bi bi-x-circle" style={{ fontSize: "0.75rem" }} />
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ActiveFiltersBar = ({
  filterFormat,
  filterStatus,
  onClearFormat,
  onClearStatus,
  onClearAll,
}) => {
  const hasFilters = filterFormat || filterStatus;
  if (!hasFilters) return null;

  const fm = filterFormat ? getFormatMeta(filterFormat) : null;
  const STATUS_COLORS = {
    Completed: { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
    Processing: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    Failed: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  };
  const sc = filterStatus ? STATUS_COLORS[filterStatus] : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        padding: "8px 20px",
        borderBottom: "1px solid #f4f4f8",
        background: "#fafafa",
      }}
    >
      <span
        style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          color: "#8e8e9e",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginRight: 2,
        }}
      >
        Filters:
      </span>

      {filterFormat && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 8px 3px 6px",
            background: fm.bg,
            border: `1px solid ${fm.border}`,
            borderRadius: 20,
            fontSize: "0.75rem",
            fontWeight: 600,
            color: fm.color,
          }}
        >
          <i className={fm.icon} style={{ fontSize: "0.85rem" }} />
          {filterFormat}
          <button
            onClick={onClearFormat}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              color: fm.color,
              lineHeight: 1,
              marginLeft: 1,
              display: "flex",
              alignItems: "center",
            }}
          >
            <i className="bi bi-x" style={{ fontSize: "0.8rem" }} />
          </button>
        </span>
      )}

      {filterStatus && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 8px 3px 8px",
            background: sc.bg,
            border: `1px solid ${sc.border}`,
            borderRadius: 20,
            fontSize: "0.75rem",
            fontWeight: 600,
            color: sc.color,
          }}
        >
          {filterStatus}
          <button
            onClick={onClearStatus}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              color: sc.color,
              lineHeight: 1,
              marginLeft: 1,
              display: "flex",
              alignItems: "center",
            }}
          >
            <i className="bi bi-x" style={{ fontSize: "0.8rem" }} />
          </button>
        </span>
      )}

      <button
        onClick={onClearAll}
        style={{
          border: "1px solid #e8e8f0",
          borderRadius: 20,
          background: "transparent",
          padding: "3px 10px",
          fontSize: "0.72rem",
          fontWeight: 600,
          color: "#8e8e9e",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          transition: "all 0.12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#fef2f2";
          e.currentTarget.style.color = "#dc2626";
          e.currentTarget.style.borderColor = "#fecaca";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "#8e8e9e";
          e.currentTarget.style.borderColor = "#e8e8f0";
        }}
      >
        <i className="bi bi-x-circle" style={{ fontSize: "0.72rem" }} />
        Reset semua
      </button>
    </div>
  );
};

const ReportList = ({
  reports,
  onViewReport,
  onDeleteReport,
  onDownloadReport,
  selectedReportId,
  totalRecords,
  currentPage,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  filterFormat,
  onFormatChange,
  filterStatus,
  onStatusChange,
}) => {
  const [confirmModal, setConfirmModal] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const formatBtnRef = useRef(null);
  const statusBtnRef = useRef(null);

  const totalPages = Math.max(
    1,
    Math.ceil(totalRecords / rowsPerPage),
  );
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + reports.length, totalRecords);
  const pageReports = reports;

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) onPageChange(page);
  };

  const getPageNumbers = () => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (currentPage > 3) pages.push("...");
    const rangeStart = Math.max(2, currentPage - 1);
    const rangeEnd = Math.min(totalPages - 1, currentPage + 1);
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const formatDate = (dateString) =>
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateString));

  const getStatusBadge = (status) => {
    const cfg = {
      COMPLETED: {
        class: "bg-success",
        icon: "check-circle-fill",
        label: "Completed",
      },
      PROCESSING: {
        class: "bg-warning text-dark",
        icon: "hourglass-split",
        label: "Processing",
      },
      PENDING: {
        class: "bg-warning text-dark",
        icon: "hourglass-split",
        label: "Pending",
      },
      FAILED: { class: "bg-danger", icon: "x-circle-fill", label: "Failed" },
    };
    const c = cfg[status] ?? cfg["COMPLETED"];
    return (
      <span className={`badge ${c.class}`}>
        <i className={`bi bi-${c.icon} me-1`}></i>
        {c.label}
      </span>
    );
  };

  const openDeleteConfirm = (e, report) => {
    e.stopPropagation();
    setConfirmModal({ type: "delete", report });
  };
  const openDownloadConfirm = (e, report) => {
    e.stopPropagation();
    setConfirmModal({ type: "download", report });
  };

  const handleConfirm = () => {
    if (!confirmModal) return;
    if (confirmModal.type === "delete") onDeleteReport(confirmModal.report.id);
    if (confirmModal.type === "download") onDownloadReport(confirmModal.report);
    setConfirmModal(null);
  };
  const handleCancel = () => setConfirmModal(null);

  if (reports.length === 0 && !filterFormat && !filterStatus) {
    return (
      <div className="empty-state py-5 text-center">
        <i
          className="bi bi-inbox"
          style={{ fontSize: "3rem", color: "#d4d4d4" }}
        ></i>
        <h5 className="mt-3">No Reports Found</h5>
        <p className="text-muted">Generate your first report to get started</p>
      </div>
    );
  }

  return (
    <>
      <ConfirmModal
        config={confirmModal}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <ActiveFiltersBar
        filterFormat={filterFormat}
        filterStatus={filterStatus}
        onClearFormat={() => onFormatChange(null)}
        onClearStatus={() => onStatusChange(null)}
        onClearAll={() => {
          onFormatChange(null);
          onStatusChange(null);
        }}
      />

      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr>
              <th>Report</th>

              <th className="col-format">
                <ColFilterDropdown
                  label="Format"
                  options={FORMAT_OPTIONS}
                  value={filterFormat}
                  onChange={onFormatChange}
                  onClear={() => onFormatChange(null)}
                  open={openDropdown === "format"}
                  onToggle={(v) => setOpenDropdown(v ? "format" : null)}
                  anchorRef={formatBtnRef}
                />
              </th>

              <th className="col-date">Generated</th>

              <th className="col-status">
                <ColFilterDropdown
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={filterStatus}
                  onChange={onStatusChange}
                  onClear={() => onStatusChange(null)}
                  open={openDropdown === "status"}
                  onToggle={(v) => setOpenDropdown(v ? "status" : null)}
                  anchorRef={statusBtnRef}
                />
              </th>

              <th className="col-size">Size</th>
              <th className="col-by">By</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>

          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: "center", padding: "3rem 1rem" }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <i
                      className="bi bi-funnel"
                      style={{ fontSize: "2rem", color: "#d4d4d4" }}
                    />
                    <span
                      style={{
                        fontWeight: 600,
                        color: "#8e8e9e",
                        fontSize: "0.9rem",
                      }}
                    >
                      Tidak ada laporan yang cocok dengan filter ini
                    </span>
                    <button
                      onClick={() => {
                        onFormatChange(null);
                        onStatusChange(null);
                      }}
                      style={{
                        marginTop: 4,
                        border: "1px solid #e8e8f0",
                        borderRadius: 8,
                        background: "transparent",
                        padding: "5px 14px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#dc2626",
                        cursor: "pointer",
                      }}
                    >
                      Reset filter
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              pageReports.map((report) => {
                const fm = getFormatMeta(report.format);
                return (
                  <tr
                    key={report.id}
                    className={`report-row
                      ${selectedReportId === report.id ? "active" : ""}`}
                    onClick={() => onViewReport(report)}
                  >
                    <td>
                      <div className="report-name-cell">
                        <span
                          className="report-format-icon"
                          style={{ background: fm.bg, borderColor: fm.border }}
                        >
                          <i
                            className={fm.icon}
                            style={{ color: fm.color, fontSize: "1.2rem" }}
                          />
                        </span>
                        <div>
                          <div className="report-type-name">
                            {report.report_name}
                          </div>
                          <div className="report-id-tag">
                            {String(report.id).slice(0, 8)}…
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="col-format">
                      <span
                        className="format-pill"
                        style={{
                          background: fm.bg,
                          borderColor: fm.border,
                          color: fm.color,
                        }}
                      >
                        {report.format}
                      </span>
                    </td>

                    <td className="col-date">
                      <span className="date-text">
                        {formatDate(report.created_at)}
                      </span>
                    </td>

                    <td className="col-status">
                      {report.status === "PROCESSING" ||
                      report.status === "PENDING" ? (
                        <span className="badge bg-warning text-dark">
                          <span
                            className="spinner-border spinner-border-sm me-1"
                            style={{ width: "9px", height: "9px" }}
                            role="status"
                          />
                          {report.status === "PENDING"
                            ? "Pending"
                            : "Processing"}
                        </span>
                      ) : (
                        getStatusBadge(report.status)
                      )}
                    </td>

                    <td className="col-size">
                      <span className="size-text">
                        {report.total_records
                          ? `${report.total_records} rows`
                          : "—"}
                      </span>
                    </td>

                    <td className="col-by">
                      <span className="by-text">
                        <i className="bi bi-person-fill me-1"></i>
                        {report.generated_by_admin?.full_name || "System"}
                      </span>
                    </td>

                    <td
                      className="col-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="row-actions">
                        <button
                          className="action-btn action-btn-preview"
                          onClick={() => onViewReport(report)}
                          title="Preview / Download"
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                        {report.status === "COMPLETED" && (
                          <>
                            <button
                              className="action-btn action-btn-download"
                              onClick={(e) => openDownloadConfirm(e, report)}
                              title="Download"
                            >
                              <i className="bi bi-download"></i>
                            </button>
                            <button
                              className="action-btn action-btn-delete"
                              onClick={(e) => openDeleteConfirm(e, report)}
                              title="Delete"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <div className="pagination-info">
          <span className="pagination-range">
            Showing{" "}
            <strong>
              {reports.length === 0 ? 0 : startIndex + 1}–{endIndex}
            </strong>{" "}
            of <strong>{totalRecords}</strong> reports
            {(filterFormat || filterStatus) && (
              <span style={{ color: "#8e8e9e", fontWeight: 400 }}>
                {" "}
                (filtered result)
              </span>
            )}
          </span>
          <div className="rows-per-page">
            <span>Rows:</span>
            <select
              className="rows-select"
              value={rowsPerPage}
              onChange={(e) => {
                onRowsPerPageChange(Number(e.target.value));
              }}
            >
              {ROWS_PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pagination-controls">
          <button
            className="page-btn page-btn-nav"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            title="First page"
          >
            <i className="bi bi-chevron-double-left"></i>
          </button>
          <button
            className="page-btn page-btn-nav"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            title="Previous page"
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          <div className="page-numbers">
            {getPageNumbers().map((item, idx) =>
              item === "..." ? (
                <span key={`ellipsis-${idx}`} className="page-ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  className={`page-btn ${currentPage === item ? "page-btn-active" : ""}`}
                  onClick={() => goToPage(item)}
                >
                  {item}
                </button>
              ),
            )}
          </div>
          <button
            className="page-btn page-btn-nav"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Next page"
          >
            <i className="bi bi-chevron-right"></i>
          </button>
          <button
            className="page-btn page-btn-nav"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last page"
          >
            <i className="bi bi-chevron-double-right"></i>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes colDropDown {
          from { opacity: 0; transform: translateY(-6px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </>
  );
};

export default ReportList;
