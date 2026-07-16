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

const ServiceBadge = ({ service }) => (
  <span className={`txn3-service-badge ${service}`}>
    {service === "AGENUSA" ? "AGENUSA" : "NUSABILL"}
  </span>
);

const RiskCell = ({ score, level }) => {
  const colorMap = {
    CRITICAL: "#dc2626",
    HIGH: "#ea580c",
    MEDIUM: "#d97706",
    LOW: "#16a34a",
  };
  const labelMap = {
    CRITICAL: "Critical Risk",
    HIGH: "High Risk",
    MEDIUM: "Medium Risk",
    LOW: "Low Risk",
  };
  const color = colorMap[level] || "#6b7280";
  const label = labelMap[level] || level || "—";
  return (
    <span
      className="txn3-risk"
      style={{ color }}
      title="Risk score range: 0-30 Low Risk | 31-70 Medium Risk | 71-100 High/Critical Risk"
    >
      <span className="txn3-risk-num">{score ?? 0}</span>
      <span className="txn3-risk-max">/100</span>
      <span className="txn3-risk-lbl" style={{ color }}>
        {label}
      </span>
    </span>
  );
};

const StatusTag = ({ status }) => {
  const MAP = {
    FLAGGED: {
      icon: "bi-flag-fill",
      label: "Flagged",
      cls: "st-pending",
    },
    PENDING: {
      icon: "bi-flag-fill",
      label: "Flagged",
      cls: "st-pending",
    },
    UNDER_REVIEW: {
      icon: "bi-flag-fill",
      label: "Flagged",
      cls: "st-pending",
    },
    SAFE: {
      icon: "bi-check-circle-fill",
      label: "Safe",
      cls: "st-approved",
    },
    FRAUD: {
      icon: "bi-x-circle-fill",
      label: "Blocked",
      cls: "st-fraud",
    },
  };
  const normalizedStatus = String(status || "PENDING")
    .replace("TransactionStatusEnum.", "")
    .toUpperCase();
  const meta = MAP[normalizedStatus] || MAP.PENDING;
  return (
    <span className={`txn3-status-tag ${meta.cls}`}>
      <i className={`bi ${meta.icon}`}></i>
      {meta.label}
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
              ["AGENUSA", "AGENUSA", "dot-agenusa"],
              ["NUSABILL", "NUSABILL", "dot-nusabill"],
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
              ["FLAGGED", "Flagged", "dot-pending"],
              ["SAFE", "Safe", "dot-approved"],
              ["FRAUD", "Blocked", "dot-fraud"],
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
            {colTh("service", "Service")}
            <th>Transaction ID</th>
            <th>User Account</th>
            {colTh("amount", "Amount")}
            {colTh("risk", "Risk Score", "txn3-center")}
            <th>Risk Level</th>
            {colTh("status", "Status")}
            <th className="txn3-hide-md">Location</th>
            {colTh("date", "Date & Time", "txn3-hide-lg")}
            <th className="txn3-col-act"></th>
          </tr>
        </thead>

        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={10}>
                <div className="txn3-empty-state">
                  <i className="bi bi-inbox"></i>
                  <p>Belum ada transaksi sesuai filter</p>
                  <span>
                    Coba ubah filter, cari ID transaksi lain, atau reset semua
                    filter.
                  </span>
                </div>
              </td>
            </tr>
          ) : (
            transactions.map((t) => (
              <tr key={t.id} onClick={() => onViewDetails(t)}>
                <td>
                  <ServiceBadge service={t.service_source} />
                </td>
                <td>
                  <span className="txn3-id">{t.original_trx_id}</span>
                  {t.suppressed_count > 0 && (
                    <span
                      className="txn3-badge-suppressed"
                      title={`${t.suppressed_count} suppressed signals`}
                    >
                      <i className="bi bi-slash-circle"></i>
                      {t.suppressed_count}
                    </span>
                  )}
                </td>
                <td>
                  <span className="txn3-account">{t.user_account_id}</span>
                </td>
                <td>
                  <div className="txn3-amount-cell">
                    <span className="txn3-amount">{fmt(t.amount)}</span>
                  </div>
                </td>
                <td className="txn3-center">
                  <RiskCell score={t.risk_score} level={t.risk_level} />
                </td>
                <td>
                  <span>{t.risk_level || "—"}</span>
                </td>
                <td>
                  <StatusTag status={t.final_status} />
                </td>
                <td className="txn3-hide-md">
                  <span className="txn3-dest">
                    {t.city || t.country
                      ? `${t.city || ""}, ${t.country || ""}`.replace(
                          /^, |, $/,
                          "",
                        )
                      : "—"}
                  </span>
                </td>
                <td className="txn3-hide-lg">
                  <span className="txn3-date">
                    {fmtDate(t.transaction_time)}
                  </span>
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
