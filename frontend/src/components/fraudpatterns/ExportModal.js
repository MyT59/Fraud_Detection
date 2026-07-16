import React, { useState } from "react";
import "./ExportModal.css";

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function exportCSV(rows, filename) {
  const HEADERS = [
    "ID",
    "Name",
    "Category",
    "Risk Level",
    "Status",
    "Occurrences",
    "Accuracy (%)",
    "False Positive Rate (%)",
    "Avg Loss (IDR)",
    "Trend (%)",
    "Last Updated",
  ];
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    HEADERS.map(escape).join(","),
    ...rows.map((p) =>
      [
        p.id,
        p.name,
        p.category,
        p.riskLevel,
        p.status,
        p.occurrences,
        p.accuracy,
        p.falsePositiveRate,
        p.avgLossIDR,
        p.trend,
        p.lastUpdated,
      ]
        .map(escape)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, filename);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function exportExcel(rows, filename) {
  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  );
  const XLSX = window.XLSX;
  const wsData = [
    [
      "ID",
      "Name",
      "Category",
      "Risk Level",
      "Status",
      "Occurrences",
      "Accuracy (%)",
      "False Positive Rate (%)",
      "Avg Loss (IDR)",
      "Trend (%)",
      "Last Updated",
    ],
    ...rows.map((p) => [
      p.id,
      p.name,
      p.category,
      p.riskLevel,
      p.status,
      p.occurrences,
      p.accuracy,
      p.falsePositiveRate,
      p.avgLossIDR,
      p.trend,
      p.lastUpdated,
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 13 },
    { wch: 13 },
    { wch: 22 },
    { wch: 16 },
    { wch: 10 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Fraud Patterns");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}

async function exportPDF(rows, dateFrom, dateTo, filename) {
  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  );
  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
  );
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, 297, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Fraud Patterns List", 14, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Period: ${dateFrom}  \u2192  ${dateTo}    |    Generated: ${new Date().toLocaleDateString()}`,
    170,
    12,
  );

  doc.autoTable({
    startY: 24,
    head: [
      [
        "ID",
        "Pattern Name",
        "Category",
        "Risk",
        "Status",
        "Detections",
        "Accuracy",
        "False Pos.",
        "Avg Loss (IDR)",
        "Trend",
        "Last Updated",
      ],
    ],
    body: rows.map((p) => [
      p.id,
      p.name,
      p.category,
      p.riskLevel.charAt(0).toUpperCase() + p.riskLevel.slice(1),
      p.status.charAt(0).toUpperCase() + p.status.slice(1),
      p.occurrences.toLocaleString(),
      `${p.accuracy}%`,
      `${p.falsePositiveRate}%`,
      p.avgLossIDR,
      `${p.trend > 0 ? "+" : ""}${p.trend}%`,
      p.lastUpdated,
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [124, 58, 237],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const risk = String(data.cell.raw).toLowerCase();
        if (risk === "high") data.cell.styles.textColor = [185, 28, 28];
        if (risk === "medium") data.cell.styles.textColor = [180, 83, 9];
        if (risk === "low") data.cell.styles.textColor = [2, 132, 199];
      }
    },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount}  |  Fraud Patterns Export`,
      14,
      doc.internal.pageSize.height - 6,
    );
  }

  doc.save(filename);
}

const PATTERN_OPTIONS = [
  { value: "all", label: "All Patterns", dot: "all", icon: "bi-list-ul" },
  {
    value: "high",
    label: "High Risk",
    dot: "high",
    icon: "bi-exclamation-triangle-fill",
  },
  {
    value: "medium",
    label: "Flagged for Review",
    dot: "medium",
    icon: "bi-exclamation-circle-fill",
  },
  { value: "low", label: "Safe", dot: "low", icon: "bi-info-circle-fill" },
];

const FORMAT_OPTIONS = [
  {
    value: "excel",
    label: "Excel",
    desc: ".xlsx file",
    iconCls: "excel",
    icon: "bi-file-earmark-spreadsheet-fill",
  },
  {
    value: "csv",
    label: "CSV",
    desc: "Plain text",
    iconCls: "csv",
    icon: "bi-filetype-csv",
  },
  {
    value: "pdf",
    label: "PDF",
    desc: "Print-ready",
    iconCls: "pdf",
    icon: "bi-file-earmark-pdf-fill",
  },
];

const today = new Date().toISOString().split("T")[0];
const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0];

const ExportModal = ({ onClose, patterns }) => {
  const [selectedPatterns, setSelectedPatterns] = useState([]);
  const [dateFrom, setDateFrom] = useState(oneMonthAgo);
  const [dateTo, setDateTo] = useState(today);
  const [format, setFormat] = useState(null);
  const [dateError, setDateError] = useState("");
  const [exporting, setExporting] = useState(false);

  const togglePattern = (value) =>
    setSelectedPatterns((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );

  const handleDateFrom = (val) => {
    setDateFrom(val);
    setDateError(
      dateTo && val > dateTo ? "End date must be after start date." : "",
    );
  };
  const handleDateTo = (val) => {
    setDateTo(val);
    setDateError(
      dateFrom && val < dateFrom ? "End date must be after start date." : "",
    );
  };

  const getRows = () =>
    selectedPatterns.includes("all")
      ? patterns
      : patterns.filter((p) => selectedPatterns.includes(p.riskLevel));

  const canExport =
    selectedPatterns.length > 0 &&
    dateFrom &&
    dateTo &&
    !dateError &&
    format !== null;

  const summaryText = () => {
    const labels = selectedPatterns.includes("all")
      ? ["All Patterns"]
      : selectedPatterns.map(
          (v) => PATTERN_OPTIONS.find((o) => o.value === v)?.label,
        );
    const count = getRows().length;
    return (
      <>
        Exporting{" "}
        <strong>
          {count} pattern{count !== 1 ? "s" : ""}
        </strong>{" "}
        [{labels.join(", ")}] &bull; <strong>{dateFrom}</strong> &rarr;{" "}
        <strong>{dateTo}</strong> &bull;{" "}
        <strong>{format?.toUpperCase()}</strong>
      </>
    );
  };

  const handleExport = async () => {
    if (!canExport || exporting) return;
    setExporting(true);
    const rows = getRows();
    const slug = `fraud-patterns_${dateFrom}_${dateTo}`;
    try {
      if (format === "csv") {
        exportCSV(rows, `${slug}.csv`);
        onClose();
      }
      if (format === "excel") {
        await exportExcel(rows, `${slug}.xlsx`);
        onClose();
      }
      if (format === "pdf") {
        await exportPDF(rows, dateFrom, dateTo, `${slug}.pdf`);
        onClose();
      }
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export gagal. Silakan coba lagi.");
      setExporting(false);
    }
  };

  return (
    <div className="em-overlay" onClick={onClose}>
      <div className="em-box" onClick={(e) => e.stopPropagation()}>
        <div className="em-header">
          <div className="em-header-left">
            <div className="em-header-icon">
              <i className="bi bi-download"></i>
            </div>
            <div>
              <p className="em-title">Export Patterns List</p>
              <p className="em-subtitle">Configure and download your export</p>
            </div>
          </div>
          <button className="em-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="em-body">
          <div>
            <div className="em-step-label">
              <span className="em-step-num">1</span>
              <i className="bi bi-funnel-fill"></i>
              Select Pattern Scope
            </div>
            <div className="em-check-grid">
              {PATTERN_OPTIONS.map((opt) => {
                const checked = selectedPatterns.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`em-check-item${checked ? ` checked-${opt.value}` : ""}`}
                    onClick={() => togglePattern(opt.value)}
                  >
                    <div className="em-check-box">
                      <i className="bi bi-check-lg"></i>
                    </div>
                    <span className={`em-check-dot ${opt.dot}`}></span>
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="em-step-label">
              <span className="em-step-num">2</span>
              <i className="bi bi-calendar-range-fill"></i>
              Select Date Range
            </div>
            <div className="em-date-row">
              <div className="em-date-field">
                <label htmlFor="em-date-from">From</label>
                <input
                  id="em-date-from"
                  type="date"
                  className={`em-date-input${dateError ? " em-date-error" : ""}`}
                  value={dateFrom}
                  max={today}
                  onChange={(e) => handleDateFrom(e.target.value)}
                />
              </div>
              <span className="em-date-sep">&rarr;</span>
              <div className="em-date-field">
                <label htmlFor="em-date-to">To</label>
                <input
                  id="em-date-to"
                  type="date"
                  className={`em-date-input${dateError ? " em-date-error" : ""}`}
                  value={dateTo}
                  max={today}
                  onChange={(e) => handleDateTo(e.target.value)}
                />
              </div>
            </div>
            {dateError && (
              <p className="em-date-err-msg">
                <i className="bi bi-exclamation-circle-fill"></i>
                {dateError}
              </p>
            )}
          </div>

          <div>
            <div className="em-step-label">
              <span className="em-step-num">3</span>
              <i className="bi bi-file-earmark-arrow-down-fill"></i>
              Choose Export Format
            </div>
            <div className="em-format-row">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  className={`em-format-btn${format === f.value ? " active" : ""}`}
                  onClick={() => setFormat(f.value)}
                >
                  <div className={`em-format-icon ${f.iconCls}`}>
                    <i className={`bi ${f.icon}`}></i>
                  </div>
                  <span className="em-format-label">{f.label}</span>
                  <span className="em-format-desc">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {canExport && (
            <div className="em-summary">
              <i className="bi bi-info-circle-fill"></i>
              {summaryText()}
            </div>
          )}
        </div>

        <div className="em-footer">
          <button
            className="em-btn-cancel"
            onClick={onClose}
            disabled={exporting}
          >
            <i className="bi bi-x-circle"></i>Cancel
          </button>
          <button
            className="em-btn-export"
            disabled={!canExport || exporting}
            onClick={handleExport}
          >
            {exporting ? (
              <>
                <i className="bi bi-hourglass-split"></i>Exporting&hellip;
              </>
            ) : (
              <>
                <i className="bi bi-download"></i>Export Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
