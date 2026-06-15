import React from "react";

/**
 * ReviewBadges.js
 * Badge components untuk Manual Review module.
 * Semua stateless.
 */

// ─── Severity Badge ───────────────────────────────────────────────

const SEVERITY_META = {
  CRITICAL: { cls: "sev-critical", icon: "bi-exclamation-octagon-fill" },
  HIGH: { cls: "sev-high", icon: "bi-exclamation-triangle-fill" },
  MEDIUM: { cls: "sev-medium", icon: "bi-exclamation-circle-fill" },
  LOW: { cls: "sev-low", icon: "bi-info-circle-fill" },
};

export const SeverityBadge = ({ severity }) => {
  const meta =
    SEVERITY_META[(severity || "LOW").toUpperCase()] || SEVERITY_META.LOW;
  return (
    <span className={`alert-badge ${meta.cls}`}>
      <i className={`bi ${meta.icon}`} /> {severity}
    </span>
  );
};

// ─── Service Badge ────────────────────────────────────────────────

export const ServiceBadge = ({ service }) => (
  <span
    style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "4px",
      fontSize: ".68rem",
      fontWeight: 700,
      letterSpacing: ".04em",
      background: service === "AGENUSA" ? "#eff6ff" : "#fdf4ff",
      color: service === "AGENUSA" ? "#1d4ed8" : "#7c3aed",
      border: `1px solid ${service === "AGENUSA" ? "#bfdbfe" : "#e9d5ff"}`,
    }}
  >
    {service || "—"}
  </span>
);

// ─── Decision Badge ───────────────────────────────────────────────

export const DecisionBadge = ({ decision }) => {
  const meta =
    decision === "SAFE"
      ? { bg: "#dcfce7", color: "#15803d", icon: "bi-check-circle-fill" }
      : { bg: "#fee2e2", color: "#b91c1c", icon: "bi-x-circle-fill" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: ".3rem",
        padding: "2px 8px",
        borderRadius: "10px",
        fontSize: ".75rem",
        fontWeight: 700,
        background: meta.bg,
        color: meta.color,
      }}
    >
      <i className={`bi ${meta.icon}`} /> {decision}
    </span>
  );
};
