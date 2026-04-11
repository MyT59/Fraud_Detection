import React, { useState } from "react";

const EVAL_DATA = {
  agenusa: {
    label: "Agenusa (Banking / ATM)",
    rows: 5000,
    fraudRate: 9.34,
    accuracy: 99.28,
    precision: 96.55,
    recall: 95.73,
    f1: 96.14,
    rocAuc: 99.61,
    reviewThreshold: 0.4828,
    highRiskThreshold: 0.5,
    confusionMatrix: { tn: 1129, fp: 4, fn: 5, tp: 112 },
    patternCoverage: 83.76,
    patterns: [
      { name: "Rapid Retry Declined", count: 82 },
      { name: "Bruteforce PIN Pattern", count: 47 },
      { name: "Money Mule Destination", count: 31 },
      { name: "Impossible Travel / Terminal", count: 16 },
      { name: "Midnight Unusual Amount", count: 4 },
    ],
  },
  nusabill: {
    label: "Nusabill (Billing / Payment)",
    rows: 5000,
    fraudRate: 7.8,
    accuracy: 96.88,
    precision: 75.0,
    recall: 89.69,
    f1: 81.69,
    rocAuc: 99.15,
    reviewThreshold: 0.4862,
    highRiskThreshold: 0.9321,
    confusionMatrix: { tn: 1124, fp: 29, fn: 10, tp: 87 },
    patternCoverage: 78.35,
    patterns: [
      { name: "Sudden Channel Switch to API", count: 26 },
      { name: "Burst Payment Pattern", count: 26 },
      { name: "Refund Abuse Pattern", count: 18 },
      { name: "Payment Spike", count: 8 },
      { name: "Underpayment", count: 1 },
    ],
  },
};

const fmt = (n) => Number(n).toLocaleString("id-ID");
const fmtRp = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
const pct = (v) => `${Number(v).toFixed(2)}%`;

const REPORT_TYPE_META = {
  fraud: { label: "Fraud", icon: "exclamation-octagon-fill", color: "#dc2626" },
  legit: { label: "Legit", icon: "check-circle-fill", color: "#16a34a" },
  fraud_rate: { label: "Fraud Rate", icon: "graph-up-arrow", color: "#ea580c" },
  legit_rate: { label: "Legit Rate", icon: "bar-chart-fill", color: "#0891b2" },
  transactions: {
    label: "Transactions",
    icon: "arrow-left-right",
    color: "#7c3aed",
  },
};

const LAYANAN_META = {
  agenusa: { label: "Agenusa", icon: "shield-check", color: "#dc2626" },
  nusabill: { label: "Nusabill", icon: "receipt", color: "#2563eb" },
};

const NewReportPreview = ({ report, onDownload }) => {
  const {
    layanan,
    reportTypes = [],
    dateFrom,
    dateTo,
    previewData = {},
    format,
    status,
  } = report;
  const [activeType, setActiveType] = useState(
    reportTypes[0] ?? "transactions",
  );

  const layananMeta = LAYANAN_META[layanan] ?? {
    label: layanan,
    icon: "grid",
    color: "#dc2626",
  };
  const typeMeta = REPORT_TYPE_META[activeType] ?? {
    label: activeType,
    icon: "file",
    color: "#525252",
  };
  const activeData = previewData[activeType] ?? {};

  const formatDate = (d) =>
    d
      ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
          new Date(d),
        )
      : "-";

  return (
    <div className="report-preview-content">
      <div className="preview-header">
        <div className="preview-title-section">
          <h3 className="preview-title" style={{ fontSize: "1.1rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 7,
                background: `${layananMeta.color}15`,
                marginRight: 8,
                verticalAlign: "middle",
              }}
            >
              <i
                className={`bi bi-${layananMeta.icon}`}
                style={{ color: layananMeta.color, fontSize: ".95rem" }}
              ></i>
            </span>
            {layananMeta.label} Report
          </h3>
          <p className="preview-meta">
            <span className="badge bg-secondary me-2">{format}</span>
            <span className="text-muted">ID: {report.id}</span>
            <span className="text-muted ms-2">
              · {formatDate(dateFrom)} — {formatDate(dateTo)}
            </span>
          </p>
        </div>
        {status === "Completed" && (
          <button className="btn btn-danger btn-sm" onClick={onDownload}>
            <i className="bi bi-download me-1"></i>Download {format}
          </button>
        )}
      </div>

      <div className="report-info-section">
        <div className="row">
          {[
            {
              icon: "calendar3",
              label: "Periode",
              value: `${formatDate(dateFrom)} — ${formatDate(dateTo)}`,
            },
            {
              icon: "person-circle",
              label: "Dibuat oleh",
              value: report.generatedBy,
            },
            { icon: "file-earmark", label: "Ukuran File", value: report.size },
            {
              icon: "check-circle",
              label: "Status",
              value: (
                <span
                  className={`badge ${status === "Completed" ? "bg-success" : status === "Processing" ? "bg-warning text-dark" : "bg-danger"}`}
                >
                  {status}
                </span>
              ),
            },
          ].map((item, i) => (
            <div key={i} className="col-md-6">
              <div className="info-item">
                <i className={`bi bi-${item.icon}`}></i>
                <div>
                  <div className="info-label">{item.label}</div>
                  <div className="info-value">{item.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {status === "Processing" && (
        <div className="processing-state">
          <div className="spinner-border text-warning" role="status"></div>
          <h5 className="mt-3">Sedang Membuat Laporan...</h5>
          <p className="text-muted">Mohon tunggu sebentar</p>
        </div>
      )}

      {status === "Completed" && (
        <div className="preview-document">
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              padding: "0.75rem",
              background: "#fafafa",
              borderRadius: "10px",
              marginBottom: "1.25rem",
            }}
          >
            {reportTypes.map((rt) => {
              const m = REPORT_TYPE_META[rt] ?? {
                label: rt,
                icon: "file",
                color: "#525252",
              };
              const isActive = activeType === rt;
              return (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setActiveType(rt)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.45rem 0.875rem",
                    border: isActive
                      ? `2px solid ${m.color}`
                      : "2px solid #e5e5e5",
                    borderRadius: "7px",
                    background: isActive ? `${m.color}12` : "white",
                    cursor: "pointer",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: ".82rem",
                    color: isActive ? m.color : "#525252",
                    transition: "all .15s",
                  }}
                >
                  <i
                    className={`bi bi-${m.icon}`}
                    style={{ fontSize: ".85rem" }}
                  ></i>
                  {m.label}
                </button>
              );
            })}
          </div>

          <SummaryPanel
            type={activeType}
            data={activeData}
            layananMeta={layananMeta}
          />

          <div
            className="alert alert-info mb-0 mt-3"
            style={{ fontSize: ".8rem" }}
          >
            <i className="bi bi-info-circle me-2"></i>
            Preview menampilkan ringkasan data sample. File {format} yang
            didownload berisi dataset lengkap.
          </div>
        </div>
      )}

      {status === "Failed" && (
        <div className="failed-state">
          <i
            className="bi bi-exclamation-triangle text-danger"
            style={{ fontSize: "3rem" }}
          ></i>
          <h5 className="mt-3 text-danger">Gagal Membuat Laporan</h5>
          <p className="text-muted">Terjadi kesalahan. Silakan coba lagi.</p>
        </div>
      )}
    </div>
  );
};

const SummaryPanel = ({ type, data, layananMeta }) => {
  const {
    total = 0,
    fraudCount = 0,
    legitCount = 0,
    fraudRate = 0,
    legitRate = 0,
    totalAmount = 0,
    fraudAmount = 0,
    legitAmount = 0,
    byChannel = {},
    byLocation = {},
    byDate = [],
    rows = [],
  } = data;

  const cardStyle = (color) => ({
    padding: "1rem",
    borderRadius: "10px",
    border: `1px solid ${color}25`,
    background: `${color}08`,
    flex: "1 1 140px",
  });

  if (type === "fraud")
    return (
      <div>
        <SectionTitle
          icon="exclamation-octagon-fill"
          color="#dc2626"
          label="Fraud Transactions"
        />
        <div
          style={{
            display: "flex",
            gap: ".75rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <StatCard
            color="#dc2626"
            icon="exclamation-octagon"
            label="Total Fraud"
            value={fmt(fraudCount)}
            sub={`${pct(fraudRate)} dari semua transaksi`}
          />
          <StatCard
            color="#f97316"
            icon="currency-dollar"
            label="Total Nilai Fraud"
            value={fmtRp(fraudAmount)}
            sub="Estimasi kerugian"
          />
          <StatCard
            color="#7c3aed"
            icon="bar-chart"
            label="Rata-rata per Txn"
            value={fraudCount ? fmtRp(fraudAmount / fraudCount) : "Rp 0"}
            sub="Per transaksi fraud"
          />
        </div>
        <ChannelBreakdown
          byChannel={byChannel}
          filterStatus="Fraud"
          rows={rows}
        />
        <TopRows
          rows={rows.filter((r) => r.status === "Fraud").slice(0, 5)}
          title="Sample Transaksi Fraud"
        />
      </div>
    );

  if (type === "legit")
    return (
      <div>
        <SectionTitle
          icon="check-circle-fill"
          color="#16a34a"
          label="Legit Transactions"
        />
        <div
          style={{
            display: "flex",
            gap: ".75rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <StatCard
            color="#16a34a"
            icon="check-circle"
            label="Total Legit"
            value={fmt(legitCount)}
            sub={`${pct(legitRate)} dari semua transaksi`}
          />
          <StatCard
            color="#0891b2"
            icon="currency-dollar"
            label="Total Nilai Legit"
            value={fmtRp(legitAmount)}
            sub="Volume transaksi sah"
          />
          <StatCard
            color="#7c3aed"
            icon="bar-chart"
            label="Rata-rata per Txn"
            value={legitCount ? fmtRp(legitAmount / legitCount) : "Rp 0"}
            sub="Per transaksi legit"
          />
        </div>
        <ChannelBreakdown
          byChannel={byChannel}
          filterStatus="Legit"
          rows={rows}
        />
        <TopRows
          rows={rows.filter((r) => r.status === "Legit").slice(0, 5)}
          title="Sample Transaksi Legit"
        />
      </div>
    );

  if (type === "fraud_rate")
    return (
      <div>
        <SectionTitle
          icon="graph-up-arrow"
          color="#ea580c"
          label="Fraud Rate"
        />
        <div
          style={{
            display: "flex",
            gap: ".75rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <StatCard
            color="#dc2626"
            icon="exclamation-octagon"
            label="Fraud Rate"
            value={pct(fraudRate)}
            sub="Persentase transaksi fraud"
          />
          <StatCard
            color="#ea580c"
            icon="graph-up"
            label="Fraud Count"
            value={fmt(fraudCount)}
            sub={`dari ${fmt(total)} transaksi`}
          />
        </div>
        <RateTable
          byDate={byDate}
          rateKey="fraudRate"
          countKey="fraudCount"
          color="#dc2626"
          label="Fraud"
        />
      </div>
    );

  if (type === "legit_rate")
    return (
      <div>
        <SectionTitle
          icon="bar-chart-fill"
          color="#0891b2"
          label="Legit Rate"
        />
        <div
          style={{
            display: "flex",
            gap: ".75rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <StatCard
            color="#16a34a"
            icon="check-circle"
            label="Legit Rate"
            value={pct(legitRate)}
            sub="Persentase transaksi sah"
          />
          <StatCard
            color="#0891b2"
            icon="graph-up"
            label="Legit Count"
            value={fmt(legitCount)}
            sub={`dari ${fmt(total)} transaksi`}
          />
        </div>
        <RateTable
          byDate={byDate}
          rateKey="legitRate"
          countKey="legitCount"
          color="#16a34a"
          label="Legit"
        />
      </div>
    );

  if (type === "transactions")
    return (
      <div>
        <SectionTitle
          icon="arrow-left-right"
          color="#7c3aed"
          label="All Transactions"
        />
        <div
          style={{
            display: "flex",
            gap: ".75rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <StatCard
            color="#7c3aed"
            icon="list-ul"
            label="Total Transaksi"
            value={fmt(total)}
            sub="Semua channel"
          />
          <StatCard
            color="#dc2626"
            icon="exclamation-octagon"
            label="Fraud"
            value={fmt(fraudCount)}
            sub={pct(fraudRate)}
          />
          <StatCard
            color="#16a34a"
            icon="check-circle"
            label="Legit"
            value={fmt(legitCount)}
            sub={pct(legitRate)}
          />
          <StatCard
            color="#f59e0b"
            icon="currency-dollar"
            label="Total Nilai"
            value={fmtRp(totalAmount)}
            sub="Semua transaksi"
          />
        </div>
        <LocationBreakdown byLocation={byLocation} />
        <TopRows rows={rows.slice(0, 8)} title="Sample Transaksi" showStatus />
      </div>
    );

  return null;
};

const SectionTitle = ({ icon, color, label }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: ".5rem",
      fontWeight: 700,
      fontSize: ".95rem",
      color: "#262626",
      borderLeft: `4px solid ${color}`,
      paddingLeft: 10,
      marginBottom: "1rem",
    }}
  >
    <i className={`bi bi-${icon}`} style={{ color }}></i>
    {label}
  </div>
);

const StatCard = ({ color, icon, label, value, sub }) => (
  <div
    style={{
      flex: "1 1 150px",
      padding: "1rem",
      borderRadius: 10,
      border: `1px solid ${color}25`,
      background: `${color}08`,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: ".4rem",
        marginBottom: ".4rem",
      }}
    >
      <i className={`bi bi-${icon}`} style={{ color, fontSize: "1rem" }}></i>
      <span
        style={{
          fontSize: ".72rem",
          color: "#737373",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: ".04em",
        }}
      >
        {label}
      </span>
    </div>
    <div style={{ fontSize: "1.25rem", fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: ".72rem", color: "#a3a3a3", marginTop: 2 }}>
      {sub}
    </div>
  </div>
);

const ChannelBreakdown = ({ rows, filterStatus }) => {
  const filtered = rows.filter((r) => r.status === filterStatus);
  const byChannel = {};
  filtered.forEach((r) => {
    byChannel[r.channel] = (byChannel[r.channel] || 0) + 1;
  });
  const entries = Object.entries(byChannel).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  const maxV = entries[0][1];
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          fontSize: ".78rem",
          fontWeight: 700,
          color: "#525252",
          marginBottom: ".5rem",
          textTransform: "uppercase",
          letterSpacing: ".05em",
        }}
      >
        Breakdown per Channel
      </div>
      {entries.map(([ch, count]) => (
        <div
          key={ch}
          style={{
            display: "flex",
            alignItems: "center",
            gap: ".75rem",
            marginBottom: ".35rem",
          }}
        >
          <span
            style={{
              width: 70,
              fontSize: ".8rem",
              color: "#525252",
              textAlign: "right",
            }}
          >
            {ch}
          </span>
          <div
            style={{
              flex: 1,
              height: 10,
              background: "#f5f5f5",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(count / maxV) * 100}%`,
                height: "100%",
                background: filterStatus === "Fraud" ? "#dc2626" : "#16a34a",
                borderRadius: 99,
                transition: "width .4s",
              }}
            />
          </div>
          <span
            style={{
              fontSize: ".8rem",
              fontWeight: 700,
              color: "#262626",
              minWidth: 24,
            }}
          >
            {count}
          </span>
        </div>
      ))}
    </div>
  );
};

const LocationBreakdown = ({ byLocation }) => {
  const entries = Object.entries(byLocation || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (!entries.length) return null;
  const maxV = entries[0][1];
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          fontSize: ".78rem",
          fontWeight: 700,
          color: "#525252",
          marginBottom: ".5rem",
          textTransform: "uppercase",
          letterSpacing: ".05em",
        }}
      >
        Top 5 Lokasi
      </div>
      {entries.map(([loc, count]) => (
        <div
          key={loc}
          style={{
            display: "flex",
            alignItems: "center",
            gap: ".75rem",
            marginBottom: ".35rem",
          }}
        >
          <span
            style={{
              width: 90,
              fontSize: ".8rem",
              color: "#525252",
              textAlign: "right",
            }}
          >
            {loc}
          </span>
          <div
            style={{
              flex: 1,
              height: 10,
              background: "#f5f5f5",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(count / maxV) * 100}%`,
                height: "100%",
                background: "#7c3aed",
                borderRadius: 99,
              }}
            />
          </div>
          <span
            style={{
              fontSize: ".8rem",
              fontWeight: 700,
              color: "#262626",
              minWidth: 24,
            }}
          >
            {count}
          </span>
        </div>
      ))}
    </div>
  );
};

const RateTable = ({ byDate, rateKey, countKey, color, label }) => {
  const entries = (byDate || []).slice(0, 7);
  if (!entries.length) return null;
  return (
    <div>
      <div
        style={{
          fontSize: ".78rem",
          fontWeight: 700,
          color: "#525252",
          marginBottom: ".5rem",
          textTransform: "uppercase",
          letterSpacing: ".05em",
        }}
      >
        Tren per Tanggal (sample)
      </div>
      <table
        style={{ width: "100%", fontSize: ".8rem", borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ background: "#fafafa" }}>
            {["Tanggal", "Total", label, `${label} Rate`].map((h) => (
              <th
                key={h}
                style={{
                  padding: "6px 10px",
                  textAlign: "left",
                  fontWeight: 700,
                  color: "#525252",
                  borderBottom: "1px solid #e5e5e5",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
              <td style={{ padding: "6px 10px", color: "#262626" }}>
                {row.date}
              </td>
              <td style={{ padding: "6px 10px" }}>{fmt(row.total)}</td>
              <td style={{ padding: "6px 10px", fontWeight: 700, color }}>
                {fmt(row[countKey] || 0)}
              </td>
              <td style={{ padding: "6px 10px", fontWeight: 700, color }}>
                {pct(row[rateKey] || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TopRows = ({ rows, title, showStatus }) => {
  if (!rows?.length) return null;
  return (
    <div style={{ marginTop: "1rem" }}>
      <div
        style={{
          fontSize: ".78rem",
          fontWeight: 700,
          color: "#525252",
          marginBottom: ".5rem",
          textTransform: "uppercase",
          letterSpacing: ".05em",
        }}
      >
        {title}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            fontSize: ".78rem",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr style={{ background: "#fafafa" }}>
              {[
                "ID",
                "Tanggal",
                "Jumlah",
                "Channel",
                ...(showStatus ? ["Status"] : []),
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "6px 10px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#525252",
                    borderBottom: "1px solid #e5e5e5",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td
                  style={{
                    padding: "6px 10px",
                    fontFamily: "monospace",
                    color: "#525252",
                  }}
                >
                  {r.id}
                </td>
                <td style={{ padding: "6px 10px" }}>{r.date}</td>
                <td style={{ padding: "6px 10px", fontWeight: 600 }}>
                  {fmtRp(r.amount)}
                </td>
                <td style={{ padding: "6px 10px" }}>{r.channel}</td>
                {showStatus && (
                  <td style={{ padding: "6px 10px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 99,
                        fontSize: ".7rem",
                        fontWeight: 700,
                        background:
                          r.status === "Fraud" ? "#fef2f2" : "#f0fdf4",
                        color: r.status === "Fraud" ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const buildLegacyContent = (reportType) => {
  const { agenusa: A, nusabill: N } = EVAL_DATA;
  switch (reportType) {
    case "Monthly Summary":
      return {
        sections: [
          {
            title: "Executive Summary",
            items: [
              `Total dataset: ${(A.rows + N.rows).toLocaleString()} transactions`,
              `Agenusa fraud rate: ${A.fraudRate}%`,
              `Nusabill fraud rate: ${N.fraudRate}%`,
              `Combined avg ROC-AUC: ${((A.rocAuc + N.rocAuc) / 2).toFixed(2)}%`,
            ],
          },
          {
            title: "Agenusa Model",
            items: [
              `Accuracy: ${A.accuracy}%`,
              `F1: ${A.f1}%`,
              `Precision: ${A.precision}%  Recall: ${A.recall}%`,
            ],
          },
          {
            title: "Nusabill Model",
            items: [
              `Accuracy: ${N.accuracy}%`,
              `F1: ${N.f1}%`,
              `Precision: ${N.precision}%  Recall: ${N.recall}%`,
            ],
          },
        ],
      };
    default:
      return {
        sections: [
          {
            title: "Report Preview",
            items: [
              "Gunakan fitur Generate Report baru untuk preview yang lebih lengkap.",
            ],
          },
        ],
      };
  }
};

const LegacyPreview = ({ report, onDownload }) => {
  const content = buildLegacyContent(report.type);
  const formatDate = (d) =>
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(d));
  return (
    <div className="report-preview-content">
      <div className="preview-header">
        <div className="preview-title-section">
          <h3 className="preview-title">{report.type}</h3>
          <p className="preview-meta">
            <span className="badge bg-secondary me-2">{report.format}</span>
            <span className="text-muted">ID: {report.id}</span>
          </p>
        </div>
        {report.status === "Completed" && (
          <button className="btn btn-danger" onClick={onDownload}>
            <i className="bi bi-download me-2"></i>Download {report.format}
          </button>
        )}
      </div>
      <div className="report-info-section">
        <div className="row">
          <div className="col-md-6">
            <div className="info-item">
              <i className="bi bi-calendar3"></i>
              <div>
                <div className="info-label">Generated</div>
                <div className="info-value">
                  {formatDate(report.generatedDate)}
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="info-item">
              <i className="bi bi-person-circle"></i>
              <div>
                <div className="info-label">By</div>
                <div className="info-value">{report.generatedBy}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="info-item">
              <i className="bi bi-file-earmark"></i>
              <div>
                <div className="info-label">Size</div>
                <div className="info-value">{report.size}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="info-item">
              <i className="bi bi-check-circle"></i>
              <div>
                <div className="info-label">Status</div>
                <div className="info-value">
                  <span
                    className={`badge ${report.status === "Completed" ? "bg-success" : report.status === "Processing" ? "bg-warning text-dark" : "bg-danger"}`}
                  >
                    {report.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {report.status === "Completed" && (
        <div className="preview-document">
          <div className="document-body">
            {content.sections.map((s, i) => (
              <div key={i} className="preview-section">
                <h5 className="section-title">{s.title}</h5>
                <ul className="section-content">
                  {s.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {report.status === "Processing" && (
        <div className="processing-state">
          <div className="spinner-border text-warning" role="status"></div>
          <h5 className="mt-3">Generating...</h5>
        </div>
      )}
      {report.status === "Failed" && (
        <div className="failed-state">
          <i
            className="bi bi-exclamation-triangle text-danger"
            style={{ fontSize: "3rem" }}
          ></i>
          <h5 className="mt-3 text-danger">Report Generation Failed</h5>
        </div>
      )}
    </div>
  );
};

const ReportPreview = ({ report, onDownload }) => {
  if (!report)
    return (
      <div className="preview-empty-state">
        <i
          className="bi bi-file-earmark-text"
          style={{ fontSize: "4rem", color: "#d4d4d4" }}
        ></i>
        <h4 className="mt-3">No Report Selected</h4>
        <p className="text-muted">
          Select a report from the list to view details
        </p>
      </div>
    );

  if (report.layanan)
    return <NewReportPreview report={report} onDownload={onDownload} />;
  return <LegacyPreview report={report} onDownload={onDownload} />;
};

export default ReportPreview;
