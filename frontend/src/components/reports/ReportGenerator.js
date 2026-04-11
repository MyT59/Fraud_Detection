import React, { useState } from "react";
import * as XLSX from "xlsx";

const LAYANAN_OPTIONS = [
  {
    value: "agenusa",
    label: "Agenusa",
    icon: "shield-check",
    color: "#dc2626",
    desc: "Agen & Mitra Network",
  },
  {
    value: "nusabill",
    label: "Nusabill",
    icon: "receipt",
    color: "#2563eb",
    desc: "Billing & Payment Platform",
  },
];

const REPORT_TYPE_OPTIONS = [
  {
    value: "fraud",
    label: "Fraud",
    icon: "exclamation-octagon-fill",
    color: "#dc2626",
    desc: "Transaksi terindikasi fraud",
  },
  {
    value: "legit",
    label: "Legit",
    icon: "check-circle-fill",
    color: "#16a34a",
    desc: "Transaksi sah & valid",
  },
  {
    value: "fraud_rate",
    label: "Fraud Rate",
    icon: "graph-up-arrow",
    color: "#ea580c",
    desc: "Persentase & tren fraud",
  },
  {
    value: "legit_rate",
    label: "Legit Rate",
    icon: "bar-chart-fill",
    color: "#0891b2",
    desc: "Persentase & tren legit",
  },
  {
    value: "transactions",
    label: "Transactions",
    icon: "arrow-left-right",
    color: "#7c3aed",
    desc: "Seluruh riwayat transaksi",
  },
];

const FORMAT_OPTIONS = [
  { value: "PDF", icon: "file-pdf-fill", color: "#dc2626", ext: "pdf" },
  { value: "Excel", icon: "file-excel-fill", color: "#16a34a", ext: "xlsx" },
  { value: "CSV", icon: "file-text-fill", color: "#2563eb", ext: "csv" },
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateRows = (dateFrom, dateTo, count = 30) => {
  const from = new Date(dateFrom).getTime();
  const to = new Date(dateTo).getTime();
  return Array.from({ length: count }, (_, i) => ({
    id: `TXN${String(i + 1).padStart(5, "0")}`,
    date: new Date(from + Math.random() * (to - from))
      .toISOString()
      .split("T")[0],
    amount: rand(50_000, 10_000_000),
    status: Math.random() > 0.15 ? "Legit" : "Fraud",
    channel: randPick(["Mobile", "Web", "ATM", "EDC"]),
    location: randPick(["Jakarta", "Surabaya", "Bandung", "Medan", "Makassar"]),
    agent: `AGT${String(rand(1, 200)).padStart(4, "0")}`,
  }));
};

const toCSV = (headers, rows) => {
  const hdr = headers.join(",");
  const body = rows.map((r) => headers.map((h) => r[h] ?? "").join(","));
  return [hdr, ...body].join("\n");
};

const formatRp = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

const buildDatasets = (layanan, reportTypes, dateFrom, dateTo) => {
  const label =
    LAYANAN_OPTIONS.find((l) => l.value === layanan)?.label ?? layanan;
  const rows = generateRows(dateFrom, dateTo, 40);
  const fraudRows = rows.filter((r) => r.status === "Fraud");
  const legitRows = rows.filter((r) => r.status === "Legit");

  const sheets = {};

  if (reportTypes.includes("fraud")) {
    sheets["Fraud"] = {
      title: `${label} – Fraud Transactions`,
      headers: ["id", "date", "amount", "channel", "location", "agent"],
      rows: fraudRows,
    };
  }
  if (reportTypes.includes("legit")) {
    sheets["Legit"] = {
      title: `${label} – Legit Transactions`,
      headers: ["id", "date", "amount", "channel", "location", "agent"],
      rows: legitRows,
    };
  }
  if (reportTypes.includes("fraud_rate")) {
    const byDate = {};
    rows.forEach((r) => {
      if (!byDate[r.date]) byDate[r.date] = { total: 0, fraud: 0 };
      byDate[r.date].total++;
      if (r.status === "Fraud") byDate[r.date].fraud++;
    });
    sheets["Fraud Rate"] = {
      title: `${label} – Fraud Rate`,
      headers: ["date", "total", "fraud", "fraud_rate"],
      rows: Object.entries(byDate).map(([date, v]) => ({
        date,
        total: v.total,
        fraud: v.fraud,
        fraud_rate: ((v.fraud / v.total) * 100).toFixed(2) + "%",
      })),
    };
  }
  if (reportTypes.includes("legit_rate")) {
    const byDate = {};
    rows.forEach((r) => {
      if (!byDate[r.date]) byDate[r.date] = { total: 0, legit: 0 };
      byDate[r.date].total++;
      if (r.status === "Legit") byDate[r.date].legit++;
    });
    sheets["Legit Rate"] = {
      title: `${label} – Legit Rate`,
      headers: ["date", "total", "legit", "legit_rate"],
      rows: Object.entries(byDate).map(([date, v]) => ({
        date,
        total: v.total,
        legit: v.legit,
        legit_rate: ((v.legit / v.total) * 100).toFixed(2) + "%",
      })),
    };
  }
  if (reportTypes.includes("transactions")) {
    sheets["All Transactions"] = {
      title: `${label} – All Transactions`,
      headers: [
        "id",
        "date",
        "amount",
        "status",
        "channel",
        "location",
        "agent",
      ],
      rows,
    };
  }

  return sheets;
};

const downloadBlob = (content, filename, mime) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(url);
};

const exportCSV = (sheets, layanan, dateFrom, dateTo) => {
  Object.entries(sheets).forEach(([name, sheet]) => {
    const safe = name.replace(/[^a-z0-9]/gi, "_");
    const csv = toCSV(sheet.headers, sheet.rows);
    downloadBlob(
      csv,
      `${layanan}_${safe}_${dateFrom}_${dateTo}.csv`,
      "text/csv",
    );
  });
};

const exportExcel = (sheets, layanan, dateFrom, dateTo) => {
  const wb = XLSX.utils.book_new();

  const layananLabel =
    LAYANAN_OPTIONS.find((l) => l.value === layanan)?.label ?? layanan;
  const metaRows = [
    ["Laporan Fraud Detection System"],
    [],
    ["Layanan", layananLabel],
    ["Periode", `${dateFrom} s/d ${dateTo}`],
    ["Dibuat", new Date().toLocaleString("id-ID")],
    ["Sheet", Object.keys(sheets).join(", ")],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);

  wsMeta["A1"].s = { font: { bold: true, sz: 14 } };
  wsMeta["!cols"] = [{ wch: 18 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, "Info");

  Object.entries(sheets).forEach(([name, sheet]) => {
    const HEADER_MAP = {
      id: "ID Transaksi",
      date: "Tanggal",
      amount: "Jumlah (Rp)",
      status: "Status",
      channel: "Channel",
      location: "Lokasi",
      agent: "Kode Agen",
      total: "Total",
      fraud: "Fraud",
      legit: "Legit",
      fraud_rate: "Fraud Rate (%)",
      legit_rate: "Legit Rate (%)",
    };

    const headerRow = sheet.headers.map((h) => HEADER_MAP[h] ?? h);

    const dataRows = sheet.rows.map((r) =>
      sheet.headers.map((h) => {
        if (h === "amount") return Number(r[h]) || 0;
        if (h === "fraud_rate" || h === "legit_rate")
          return parseFloat(r[h]) || 0;
        return r[h] ?? "";
      }),
    );

    const wsData = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

    const colWidths = sheet.headers.map((h) =>
      ["id", "agent"].includes(h)
        ? { wch: 14 }
        : h === "date"
          ? { wch: 13 }
          : h === "amount"
            ? { wch: 20 }
            : ["fraud_rate", "legit_rate"].includes(h)
              ? { wch: 16 }
              : { wch: 14 },
    );
    wsData["!cols"] = colWidths;

    const amtColIdx = sheet.headers.indexOf("amount");
    if (amtColIdx !== -1) {
      const range = XLSX.utils.decode_range(wsData["!ref"]);
      for (let R = 1; R <= range.e.r; R++) {
        const cell = wsData[XLSX.utils.encode_cell({ r: R, c: amtColIdx })];
        if (cell) cell.z = "#,##0";
      }
    }

    ["fraud_rate", "legit_rate"].forEach((key) => {
      const colIdx = sheet.headers.indexOf(key);
      if (colIdx === -1) return;
      const range = XLSX.utils.decode_range(wsData["!ref"]);
      for (let R = 1; R <= range.e.r; R++) {
        const cell = wsData[XLSX.utils.encode_cell({ r: R, c: colIdx })];
        if (cell) cell.z = '0.00"%"';
      }
    });

    const sheetName = name.length > 31 ? name.slice(0, 31) : name;
    XLSX.utils.book_append_sheet(wb, wsData, sheetName);
  });

  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbOut], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `${layanan}_report_${dateFrom}_${dateTo}.xlsx`,
  });
  a.click();
  URL.revokeObjectURL(url);
};

const exportPDF = (sheets, layanan, dateFrom, dateTo) => {
  const layananLabel =
    LAYANAN_OPTIONS.find((l) => l.value === layanan)?.label ?? layanan;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${layananLabel} Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  body { font-family: 'Inter', Arial, sans-serif; color: #1a1a1a; padding: 32px; }
  h1 { color: #dc2626; font-size: 1.4rem; margin-bottom: 4px; }
  .meta { color: #666; font-size: .8rem; margin-bottom: 32px; }
  .section { margin-bottom: 36px; page-break-inside: avoid; }
  .section-title { font-size: 1rem; font-weight: 700; color: #262626;
    border-left: 4px solid #dc2626; padding-left: 10px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: .78rem; }
  th { background: #dc2626; color: #fff; padding: 7px 10px; text-align: left; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
  tr:nth-child(even) td { background: #fafafa; }
  .badge-fraud { color: #dc2626; font-weight: 600; }
  .badge-legit { color: #16a34a; font-weight: 600; }
</style></head><body>
<h1>📊 ${layananLabel} — Fraud Detection Report</h1>
<p class="meta">Periode: ${dateFrom} s/d ${dateTo} &nbsp;|&nbsp;
  Digenerate: ${new Date().toLocaleString("id-ID")}</p>
${Object.values(sheets)
  .map(
    (s) => `<div class="section">
  <div class="section-title">${s.title}</div>
  <table>
    <thead><tr>${s.headers
      .map((h) => `<th>${h.replace(/_/g, " ").toUpperCase()}</th>`)
      .join("")}</tr></thead>
    <tbody>${s.rows
      .map(
        (r) =>
          `<tr>${s.headers
            .map((h) => {
              const val = r[h] ?? "";
              if (h === "amount") return `<td>${formatRp(val)}</td>`;
              if (h === "status")
                return `<td class="badge-${val.toLowerCase()}">${val}</td>`;
              return `<td>${val}</td>`;
            })
            .join("")}</tr>`,
      )
      .join("")}
    </tbody>
  </table>
</div>`,
  )
  .join("")}
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const win = window.open(URL.createObjectURL(blob), "_blank");
  if (win)
    win.onload = () => {
      win.focus();
      win.print();
    };
};

const ReportGenerator = ({ onGenerate, onCancel }) => {
  const [layanan, setLayanan] = useState("");
  const [reportTypes, setReportTypes] = useState([]);
  const [format, setFormat] = useState("PDF");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState({});

  const toggleReportType = (val) => {
    setReportTypes((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const validate = () => {
    const errs = {};
    if (!layanan) errs.layanan = "Pilih layanan terlebih dahulu";
    if (reportTypes.length === 0)
      errs.reportTypes = "Pilih minimal 1 tipe laporan";
    if (!dateFrom) errs.dateFrom = "Tanggal mulai wajib diisi";
    if (!dateTo) errs.dateTo = "Tanggal selesai wajib diisi";
    if (dateFrom && dateTo && dateFrom > dateTo)
      errs.dateTo = "Tanggal selesai harus setelah tanggal mulai";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setGenerating(true);
    onGenerate({ layanan, reportTypes, format, dateFrom, dateTo });

    await new Promise((r) => setTimeout(r, 1200));

    const sheets = buildDatasets(layanan, reportTypes, dateFrom, dateTo);

    if (format === "CSV") exportCSV(sheets, layanan, dateFrom, dateTo);
    else if (format === "Excel") exportExcel(sheets, layanan, dateFrom, dateTo);
    else exportPDF(sheets, layanan, dateFrom, dateTo);

    setGenerating(false);
  };

  const selectedLayananInfo = LAYANAN_OPTIONS.find((l) => l.value === layanan);

  return (
    <div className="card report-generator-card">
      <div className="card-header">
        <h5 className="card-title mb-0">
          <i className="bi bi-magic me-2"></i>Generate New Report
        </h5>
      </div>

      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              className="form-label fw-semibold"
              style={{
                fontSize: ".75rem",
                letterSpacing: ".06em",
                color: "#525252",
              }}
            >
              <i className="bi bi-grid-1x2 me-1 text-danger"></i>LAYANAN
            </label>
            <div className="d-flex gap-3 flex-wrap">
              {LAYANAN_OPTIONS.map((opt) => {
                const active = layanan === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLayanan(opt.value)}
                    style={{
                      flex: "1 1 200px",
                      padding: "1rem 1.25rem",
                      border: active
                        ? `2px solid ${opt.color}`
                        : "2px solid #e5e5e5",
                      borderRadius: "10px",
                      background: active ? `${opt.color}08` : "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.875rem",
                      transition: "all .2s",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: active ? opt.color : "#f5f5f5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all .2s",
                      }}
                    >
                      <i
                        className={`bi bi-${opt.icon}`}
                        style={{
                          fontSize: "1.25rem",
                          color: active ? "white" : "#737373",
                        }}
                      ></i>
                    </span>
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: ".95rem",
                          color: active ? opt.color : "#262626",
                        }}
                      >
                        {opt.label}
                      </div>
                      <div style={{ fontSize: ".75rem", color: "#737373" }}>
                        {opt.desc}
                      </div>
                    </div>
                    {active && (
                      <i
                        className="bi bi-check-circle-fill ms-auto"
                        style={{ color: opt.color, fontSize: "1.1rem" }}
                      ></i>
                    )}
                  </button>
                );
              })}
            </div>
            {errors.layanan && (
              <div className="text-danger mt-1" style={{ fontSize: ".8rem" }}>
                <i className="bi bi-exclamation-circle me-1"></i>
                {errors.layanan}
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <label
                className="form-label mb-0 fw-semibold"
                style={{
                  fontSize: ".75rem",
                  letterSpacing: ".06em",
                  color: "#525252",
                }}
              >
                <i className="bi bi-list-check me-1 text-danger"></i>TIPE
                LAPORAN
                {reportTypes.length > 0 && (
                  <span
                    style={{
                      marginLeft: 8,
                      background: "#dc2626",
                      color: "white",
                      borderRadius: 99,
                      fontSize: ".65rem",
                      padding: "1px 7px",
                      fontWeight: 700,
                    }}
                  >
                    {reportTypes.length} dipilih
                  </span>
                )}
              </label>
              {reportTypes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReportTypes([])}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#737373",
                    fontSize: ".78rem",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <i className="bi bi-x-circle me-1"></i>Reset
                </button>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                gap: "0.625rem",
              }}
            >
              {REPORT_TYPE_OPTIONS.map((opt) => {
                const checked = reportTypes.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleReportType(opt.value)}
                    style={{
                      padding: "0.75rem 1rem",
                      border: checked
                        ? `2px solid ${opt.color}`
                        : "2px solid #e5e5e5",
                      borderRadius: "8px",
                      background: checked ? `${opt.color}0d` : "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      transition: "all .18s",
                      textAlign: "left",
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 7,
                        background: checked ? opt.color : "#f5f5f5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all .18s",
                      }}
                    >
                      <i
                        className={`bi bi-${opt.icon}`}
                        style={{
                          fontSize: "1rem",
                          color: checked ? "white" : "#a3a3a3",
                        }}
                      ></i>
                    </span>
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: ".85rem",
                          color: checked ? opt.color : "#262626",
                        }}
                      >
                        {opt.label}
                      </div>
                      <div
                        style={{
                          fontSize: ".7rem",
                          color: "#a3a3a3",
                          lineHeight: 1.3,
                        }}
                      >
                        {opt.desc}
                      </div>
                    </div>

                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: checked
                          ? `2px solid ${opt.color}`
                          : "2px solid #d4d4d4",
                        background: checked ? opt.color : "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all .18s",
                      }}
                    >
                      {checked && (
                        <i
                          className="bi bi-check"
                          style={{
                            fontSize: ".65rem",
                            color: "white",
                            fontWeight: 900,
                          }}
                        ></i>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {errors.reportTypes && (
              <div className="text-danger mt-1" style={{ fontSize: ".8rem" }}>
                <i className="bi bi-exclamation-circle me-1"></i>
                {errors.reportTypes}
              </div>
            )}

            {reportTypes.length > 0 && (
              <div className="d-flex flex-wrap gap-1 mt-2">
                {reportTypes.map((v) => {
                  const opt = REPORT_TYPE_OPTIONS.find((o) => o.value === v);
                  return (
                    <span
                      key={v}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 10px 2px 6px",
                        background: `${opt.color}15`,
                        border: `1px solid ${opt.color}40`,
                        borderRadius: 99,
                        fontSize: ".72rem",
                        color: opt.color,
                        fontWeight: 600,
                      }}
                    >
                      <i
                        className={`bi bi-${opt.icon}`}
                        style={{ fontSize: ".65rem" }}
                      ></i>
                      {opt.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label
                className="form-label fw-semibold"
                style={{
                  fontSize: ".75rem",
                  letterSpacing: ".06em",
                  color: "#525252",
                }}
              >
                <i className="bi bi-calendar-range me-1 text-danger"></i>TANGGAL
                MULAI
              </label>
              <input
                type="date"
                className="form-control"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              {errors.dateFrom && (
                <div className="text-danger mt-1" style={{ fontSize: ".8rem" }}>
                  <i className="bi bi-exclamation-circle me-1"></i>
                  {errors.dateFrom}
                </div>
              )}
            </div>
            <div className="col-md-6">
              <label
                className="form-label fw-semibold"
                style={{
                  fontSize: ".75rem",
                  letterSpacing: ".06em",
                  color: "#525252",
                }}
              >
                <i className="bi bi-calendar-check me-1 text-danger"></i>TANGGAL
                SELESAI
              </label>
              <input
                type="date"
                className="form-control"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
              {errors.dateTo && (
                <div className="text-danger mt-1" style={{ fontSize: ".8rem" }}>
                  <i className="bi bi-exclamation-circle me-1"></i>
                  {errors.dateTo}
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label
              className="form-label fw-semibold"
              style={{
                fontSize: ".75rem",
                letterSpacing: ".06em",
                color: "#525252",
              }}
            >
              <i className="bi bi-filetype-pdf me-1 text-danger"></i>FORMAT
              EXPORT
            </label>
            <div className="d-flex gap-2 flex-wrap">
              {FORMAT_OPTIONS.map((opt) => {
                const active = format === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormat(opt.value)}
                    style={{
                      padding: "0.6rem 1.25rem",
                      border: active
                        ? `2px solid ${opt.color}`
                        : "2px solid #e5e5e5",
                      borderRadius: "8px",
                      background: active ? `${opt.color}10` : "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontWeight: active ? 700 : 500,
                      fontSize: ".875rem",
                      color: active ? opt.color : "#525252",
                      transition: "all .18s",
                    }}
                  >
                    <i
                      className={`bi bi-${opt.icon}`}
                      style={{ fontSize: "1rem" }}
                    ></i>
                    {opt.value}
                    {active && (
                      <i
                        className="bi bi-check-circle-fill ms-1"
                        style={{ fontSize: ".8rem" }}
                      ></i>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {layanan && reportTypes.length > 0 && dateFrom && dateTo && (
            <div
              style={{
                padding: "0.875rem 1rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                marginBottom: "1.25rem",
                fontSize: ".82rem",
                color: "#991b1b",
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
              }}
            >
              <i
                className="bi bi-info-circle-fill"
                style={{ fontSize: "1rem", flexShrink: 0 }}
              ></i>
              <span>
                Akan generate <strong>{reportTypes.length} dataset</strong> dari{" "}
                <strong>
                  {LAYANAN_OPTIONS.find((l) => l.value === layanan)?.label}
                </strong>{" "}
                (
                {reportTypes
                  .map(
                    (v) =>
                      REPORT_TYPE_OPTIONS.find((o) => o.value === v)?.label,
                  )
                  .join(", ")}
                ) dalam format <strong>{format}</strong> — periode{" "}
                <strong>
                  {dateFrom} s/d {dateTo}
                </strong>
              </span>
            </div>
          )}

          <div className="d-flex gap-2 justify-content-end">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onCancel}
              disabled={generating}
            >
              <i className="bi bi-x-circle me-1"></i>Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={generating}
            >
              {generating ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                  ></span>
                  Generating…
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-arrow-down me-1"></i>
                  Generate Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportGenerator;
