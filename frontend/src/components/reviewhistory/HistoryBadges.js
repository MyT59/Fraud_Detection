import React from "react";

/**
 * HistoryBadges.js
 * Badge & indicator components untuk Review History module.
 * Semua stateless — hanya menerima props dan render UI.
 */

// ─── Decision Badge ───────────────────────────────────────────────
// Sesuai enum BE: SAFE | FRAUD

const DECISION_META = {
  SAFE: { icon: "bi-check-circle-fill", label: "SAFE", cls: "approved" },
  FRAUD: { icon: "bi-x-circle-fill", label: "FRAUD", cls: "rejected" },
};

export const DecisionBadge = ({ decision }) => {
  const meta =
    DECISION_META[(decision || "").toUpperCase()] || DECISION_META.SAFE;
  return (
    <span className={`rh-pill ${meta.cls}`}>
      <i className={`bi ${meta.icon}`} /> {meta.label}
    </span>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────
// Untuk previous_status dan final_status dari BE

const STATUS_COLOR_MAP = {
  FRAUD: { bg: "#fee2e2", color: "#b91c1c" },
  SAFE: { bg: "#dcfce7", color: "#15803d" },
  UNDER_REVIEW: { bg: "#eff6ff", color: "#1d4ed8" },
  PENDING: { bg: "#f1f5f9", color: "#475569" },
  RESOLVED: { bg: "#f0fdf4", color: "#15803d" },
};

export const StatusBadge = ({ status }) => {
  if (!status) return <span className="rh-empty">—</span>;
  const style = STATUS_COLOR_MAP[status.toUpperCase()] || {
    bg: "#f1f5f9",
    color: "#475569",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "10px",
        fontSize: ".7rem",
        fontWeight: 700,
        background: style.bg,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
};

// ─── Overridable Indicator ────────────────────────────────────────
// Tampil hanya untuk canManage — shortcut ke Review Management

export const OverridableIndicator = ({ onClick }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title="Kelola di Manual Review (Override / Delete)"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: ".3rem",
      padding: "2px 7px",
      border: "1px solid #bfdbfe",
      borderRadius: "10px",
      background: "#eff6ff",
      color: "#1d4ed8",
      fontSize: ".68rem",
      fontWeight: 700,
      cursor: "pointer",
      transition: "all .15s",
      whiteSpace: "nowrap",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "#dbeafe";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "#eff6ff";
    }}
  >
    <i className="bi bi-arrow-repeat" /> Override
  </button>
);

// ─── Reviewer Cell ────────────────────────────────────────────────
// Tampilkan nama reviewer (snapshot) + avatar inisial + ID sebagai secondary

export const ReviewerCell = ({ reviewerName, reviewedBy }) => {
  if (!reviewerName && reviewedBy == null) {
    return <span className="hcell-empty">—</span>;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: ".65rem",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {reviewerName
          ? reviewerName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
          : "?"}
      </div>
      <div>
        <div style={{ fontSize: ".78rem", fontWeight: 600, color: "#334155" }}>
          {reviewerName || `Analyst #${reviewedBy}`}
        </div>
        {reviewerName && reviewedBy != null && (
          <div style={{ fontSize: ".68rem", color: "#94a3b8" }}>
            ID #{reviewedBy}
          </div>
        )}
      </div>
    </div>
  );
};
