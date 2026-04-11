import React, { useState, useEffect } from "react";

const fmt = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

const fmtDate = (ds) => {
  if (!ds) return "—";
  const d = new Date(ds);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getRiskMeta = (score) => {
  if (score >= 80) return { level: "CRITICAL", color: "#dc2626" };
  if (score >= 60) return { level: "HIGH", color: "#ea580c" };
  if (score >= 40) return { level: "MEDIUM", color: "#d97706" };
  return { level: "LOW", color: "#16a34a" };
};

const PATTERN_SHORT = {
  rapid_retry_declined: "Rapid Retry",
  bruteforce_pin_pattern: "Bruteforce PIN",
  money_mule_destination: "Money Mule",
  impossible_travel_terminal_switch: "Terminal Switch",
  midnight_unusual_amount: "Midnight Amt",
  sudden_channel_switch_to_api: "Ch. Switch API",
  burst_payment_pattern: "Burst Payment",
  refund_abuse_pattern: "Refund Abuse",
  payment_spike: "Spike",
  underpayment: "Underpayment",
};

const ServiceBadge = ({ service }) => (
  <span className={`txn3-service-badge ${service}`}>
    {service === "agenusa" ? "AGENUSA" : "NUSABILL"}
  </span>
);

const PatternsBadge = ({ patterns = [] }) => {
  if (!patterns.length) return <span className="txn3-empty">—</span>;
  return (
    <div
      className="txn3-patterns-wrap"
      title={patterns.map((p) => PATTERN_SHORT[p] || p).join(", ")}
    >
      <span className="txn3-pattern-icon">
        <i className="bi bi-exclamation-triangle-fill"></i>
        {patterns.length}
      </span>
      <span className="txn3-pattern-first">
        {PATTERN_SHORT[patterns[0]] || patterns[0]}
        {patterns.length > 1 && (
          <span className="txn3-pattern-more">+{patterns.length - 1}</span>
        )}
      </span>
    </div>
  );
};

const RiskCell = ({ score }) => {
  const { level, color } = getRiskMeta(score);
  return (
    <span className="txn3-risk" style={{ color }}>
      <span className="txn3-risk-num">{score}</span>
      <span className="txn3-risk-max">/100</span>
      <span className="txn3-risk-lbl" style={{ color }}>
        {level}
      </span>
    </span>
  );
};

const StatusTag = ({ status }) => {
  const MAP = {
    pending: {
      icon: "bi-hourglass-split",
      label: "Pending",
      cls: "st-pending",
    },
    approved: {
      icon: "bi-check-circle-fill",
      label: "Approved",
      cls: "st-approved",
    },
    rejected: {
      icon: "bi-x-circle-fill",
      label: "Rejected",
      cls: "st-rejected",
    },
    legit: { icon: "bi-check-circle-fill", label: "Legit", cls: "st-approved" },
    fraud: {
      icon: "bi-exclamation-circle-fill",
      label: "Fraud",
      cls: "st-fraud",
    },
  };
  const { icon, label, cls } = MAP[status] || MAP.pending;
  return (
    <span className={`txn3-status-tag ${cls}`}>
      <i className={`bi ${icon}`}></i>
      {label}
    </span>
  );
};

const TransactionTable = ({
  transactions,
  onViewDetails,
  colSort = { key: null, dir: "asc" },
  colFilter = {
    service: "all",
    status: "all",
    type: "all",
    dateFrom: "",
    dateTo: "",
  },
  onSortChange,
  onColFilterChange,
}) => {
  const [openDrop, setOpenDrop] = useState(null);
  const [showCal, setShowCal] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest(".colf-wrap")) {
        setOpenDrop(null);
        setShowCal(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (col, e) => {
    e.stopPropagation();
    const next = openDrop === col ? null : col;
    setOpenDrop(next);
    if (col !== "date") setShowCal(false);
  };

  const isColActive = (col) => {
    if (col === "amount" || col === "risk") return colSort.key === col;
    if (col === "date")
      return (
        colSort.key === "date" || !!colFilter.dateFrom || !!colFilter.dateTo
      );
    if (col === "service") return colFilter.service !== "all";
    if (col === "status") return colFilter.status !== "all";
    if (col === "type") return colFilter.type !== "all";
    return false;
  };

  const getColIcon = (col) => {
    const sortCols = ["amount", "date", "risk"];
    if (sortCols.includes(col)) {
      if (colSort.key === col)
        return colSort.dir === "asc" ? "bi-sort-up-alt" : "bi-sort-down-alt";
      return "bi-chevron-expand";
    }
    return isColActive(col) ? "bi-funnel-fill" : "bi-funnel";
  };

  const applySort = (key, dir) => {
    onSortChange(key, dir);
    setOpenDrop(null);
  };
  const applyFilter = (updates) => {
    onColFilterChange(updates);
  };

  const renderDrop = (col) => {
    switch (col) {
      case "service":
        return (
          <>
            <div className="colf-title">Filter Layanan</div>
            {[
              ["all", "Semua Layanan", null],
              ["agenusa", "AGENUSA", "dot-agenusa"],
              ["nusabill", "NUSABILL", "dot-nusabill"],
            ].map(([v, l, dot]) => (
              <button
                key={v}
                className={`colf-opt ${colFilter.service === v ? "colf-opt-active" : ""}`}
                onClick={() => {
                  applyFilter({ service: v });
                  setOpenDrop(null);
                }}
              >
                {dot && <span className={`colf-dot ${dot}`}></span>}
                {l}
                {colFilter.service === v && (
                  <i className="bi bi-check colf-check"></i>
                )}
              </button>
            ))}
          </>
        );

      case "amount":
        return (
          <>
            <div className="colf-title">Urutkan Amount</div>
            {[
              ["desc", "Terbanyak", "bi-sort-down-alt"],
              ["asc", "Terkecil", "bi-sort-up-alt"],
            ].map(([d, l, icon]) => (
              <button
                key={d}
                className={`colf-opt ${colSort.key === "amount" && colSort.dir === d ? "colf-opt-active" : ""}`}
                onClick={() => applySort("amount", d)}
              >
                <i className={`bi ${icon} colf-opt-icon`}></i>
                {l}
                {colSort.key === "amount" && colSort.dir === d && (
                  <i className="bi bi-check colf-check"></i>
                )}
              </button>
            ))}
            {colSort.key === "amount" && (
              <>
                <div className="colf-divider"></div>
                <button
                  className="colf-reset"
                  onClick={() => applySort(null, "asc")}
                >
                  <i className="bi bi-x-circle me-1"></i>Reset Urutan
                </button>
              </>
            )}
          </>
        );

      case "type":
        return (
          <>
            <div className="colf-title">Filter Type / Channel</div>
            {[
              ["all", "Semua"],
              ["Transfer", "Transfer"],
              ["API", "API"],
              ["Web", "Web"],
              ["Mobile", "Mobile"],
            ].map(([v, l]) => (
              <button
                key={v}
                className={`colf-opt ${colFilter.type === v ? "colf-opt-active" : ""}`}
                onClick={() => {
                  applyFilter({ type: v });
                  setOpenDrop(null);
                }}
              >
                {l}
                {colFilter.type === v && (
                  <i className="bi bi-check colf-check"></i>
                )}
              </button>
            ))}
          </>
        );

      case "date":
        return (
          <>
            <div className="colf-title">Urutkan Tanggal</div>
            {[
              ["desc", "Terbaru", "bi-sort-down-alt"],
              ["asc", "Terlama", "bi-sort-up-alt"],
            ].map(([d, l, icon]) => (
              <button
                key={d}
                className={`colf-opt ${colSort.key === "date" && colSort.dir === d ? "colf-opt-active" : ""}`}
                onClick={() => applySort("date", d)}
              >
                <i className={`bi ${icon} colf-opt-icon`}></i>
                {l}
                {colSort.key === "date" && colSort.dir === d && (
                  <i className="bi bi-check colf-check"></i>
                )}
              </button>
            ))}
            <div className="colf-divider"></div>

            <button
              className={`colf-opt ${colFilter.dateFrom || colFilter.dateTo ? "colf-opt-active" : ""}`}
              onClick={() => setShowCal(!showCal)}
            >
              <i className="bi bi-calendar-range colf-opt-icon"></i>
              Rentang Tanggal
              {(colFilter.dateFrom || colFilter.dateTo) && (
                <span className="colf-badge">Aktif</span>
              )}
              <i
                className={`bi ${showCal ? "bi-chevron-up" : "bi-chevron-down"} colf-check`}
              ></i>
            </button>

            {showCal && (
              <div className="colf-cal">
                <div className="colf-cal-header">
                  <i className="bi bi-calendar-range"></i>
                  Rentang Tanggal
                </div>
                <div className="colf-cal-fields">
                  <div className="colf-cal-field">
                    <label>Dari</label>
                    <input
                      type="date"
                      className="colf-date-input"
                      value={colFilter.dateFrom || ""}
                      max={colFilter.dateTo || undefined}
                      onChange={(e) =>
                        applyFilter({ dateFrom: e.target.value })
                      }
                    />
                  </div>
                  <div className="colf-cal-field">
                    <label>Sampai</label>
                    <input
                      type="date"
                      className="colf-date-input"
                      value={colFilter.dateTo || ""}
                      min={colFilter.dateFrom || undefined}
                      onChange={(e) => applyFilter({ dateTo: e.target.value })}
                    />
                  </div>
                </div>
                {(colFilter.dateFrom || colFilter.dateTo) && (
                  <div className="colf-cal-active-range">
                    <i className="bi bi-check-circle-fill"></i>
                    {colFilter.dateFrom && colFilter.dateTo
                      ? `${colFilter.dateFrom} → ${colFilter.dateTo}`
                      : colFilter.dateFrom
                        ? `Mulai ${colFilter.dateFrom}`
                        : `S/d ${colFilter.dateTo}`}
                  </div>
                )}
                {(colFilter.dateFrom || colFilter.dateTo) && (
                  <button
                    className="colf-reset"
                    style={{ marginTop: "0.4rem" }}
                    onClick={() => applyFilter({ dateFrom: "", dateTo: "" })}
                  >
                    <i className="bi bi-x-circle me-1"></i>Hapus Tanggal
                  </button>
                )}
              </div>
            )}

            {(colSort.key === "date" ||
              colFilter.dateFrom ||
              colFilter.dateTo) && (
              <>
                <div className="colf-divider"></div>
                <button
                  className="colf-reset"
                  onClick={() => {
                    applySort(null, "asc");
                    applyFilter({ dateFrom: "", dateTo: "" });
                    setOpenDrop(null);
                  }}
                >
                  <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
                  Semua
                </button>
              </>
            )}
          </>
        );

      case "risk":
        return (
          <>
            <div className="colf-title">Urutkan Risk Score</div>
            {[
              ["desc", "Tertinggi", "bi-sort-down-alt", "#dc2626"],
              ["asc", "Terendah", "bi-sort-up-alt", "#16a34a"],
            ].map(([d, l, icon, color]) => (
              <button
                key={d}
                className={`colf-opt ${colSort.key === "risk" && colSort.dir === d ? "colf-opt-active" : ""}`}
                onClick={() => applySort("risk", d)}
              >
                <i className={`bi ${icon} colf-opt-icon`} style={{ color }}></i>
                {l}
                {colSort.key === "risk" && colSort.dir === d && (
                  <i className="bi bi-check colf-check"></i>
                )}
              </button>
            ))}
            {colSort.key === "risk" && (
              <>
                <div className="colf-divider"></div>
                <button
                  className="colf-reset"
                  onClick={() => applySort(null, "asc")}
                >
                  <i className="bi bi-x-circle me-1"></i>Reset Urutan
                </button>
              </>
            )}
          </>
        );

      case "status":
        return (
          <>
            <div className="colf-title">Filter Status</div>
            {[
              ["all", "Semua Status", null],
              ["pending", "Pending", "dot-pending"],
              ["approved", "Approved", "dot-approved"],
              ["rejected", "Rejected", "dot-rejected"],
            ].map(([v, l, dot]) => (
              <button
                key={v}
                className={`colf-opt ${colFilter.status === v ? "colf-opt-active" : ""}`}
                onClick={() => {
                  applyFilter({ status: v });
                  setOpenDrop(null);
                }}
              >
                {dot && <span className={`colf-dot ${dot}`}></span>}
                {l}
                {colFilter.status === v && (
                  <i className="bi bi-check colf-check"></i>
                )}
              </button>
            ))}
          </>
        );

      default:
        return null;
    }
  };

  const colTh = (col, label, extraClass = "") => (
    <th className={extraClass || undefined}>
      <div className="colf-wrap">
        <span className="colf-label">{label}</span>
        <button
          className={`colf-btn ${isColActive(col) ? "colf-btn-active" : ""}`}
          onClick={(e) => toggle(col, e)}
          title={`Filter / urutkan ${label}`}
        >
          <i className={`bi ${getColIcon(col)}`}></i>
        </button>

        {openDrop === col && (
          <div
            className={`colf-drop ${col === "date" ? "colf-drop-wide" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {renderDrop(col)}
          </div>
        )}
      </div>
    </th>
  );

  return (
    <div className="txn3-wrapper">
      <table className="txn3-table">
        <thead>
          <tr>
            {colTh("service", "Layanan")}
            <th>ID</th>
            <th>Account / Customer</th>
            {colTh("amount", "Amount")}
            <th className="txn3-hide-md">Dest / Bill ID</th>
            {colTh("type", "Type / Channel", "txn3-hide-md")}
            {colTh("date", "Date & Time", "txn3-hide-lg")}
            <th className="txn3-hide-md">Patterns</th>
            {colTh("risk", "Risk", "txn3-center")}
            {colTh("status", "Status")}
            <th className="txn3-col-act"></th>
          </tr>
        </thead>

        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={11}>
                <div className="txn3-empty-state">
                  <i className="bi bi-inbox"></i>
                  <p>Tidak ada transaksi ditemukan</p>
                  <span>Coba ubah filter atau kriteria pencarian</span>
                </div>
              </td>
            </tr>
          ) : (
            transactions.map((t) => (
              <tr key={t.id} onClick={() => onViewDetails(t)}>
                <td>
                  <ServiceBadge service={t.service} />
                </td>
                <td>
                  <span className="txn3-id">{t.transactionId}</span>
                </td>
                <td>
                  <span className="txn3-account">{t.accountId}</span>
                </td>
                <td>
                  <div className="txn3-amount-cell">
                    <span className="txn3-amount">{fmt(t.amount)}</span>
                    {t.service === "nusabill" &&
                      t.paymentAmount &&
                      t.paymentAmount !== t.amount && (
                        <span className="txn3-paid">
                          Paid: {fmt(t.paymentAmount)}
                        </span>
                      )}
                  </div>
                </td>
                <td className="txn3-hide-md">
                  <span className="txn3-dest">{t.destId || "—"}</span>
                </td>
                <td className="txn3-hide-md">
                  <div className="txn3-type-cell">
                    <span className="txn3-type">
                      {t.type || t.channel || "—"}
                    </span>
                    {t.refundFlag && (
                      <span className="txn3-refund-tag">
                        <i className="bi bi-arrow-return-left"></i>Refund
                      </span>
                    )}
                  </div>
                </td>
                <td className="txn3-hide-lg">
                  <span className="txn3-date">
                    {fmtDate(t.timestamp || t.time)}
                  </span>
                </td>
                <td className="txn3-hide-md">
                  <PatternsBadge patterns={t.patterns || []} />
                </td>
                <td className="txn3-center">
                  <RiskCell score={t.riskScore} />
                </td>
                <td>
                  <StatusTag status={t.status} />
                </td>
                <td
                  className="txn3-col-act"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="txn3-btn-detail"
                    onClick={() => onViewDetails(t)}
                  >
                    <i className="bi bi-eye"></i>Detail
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionTable;
