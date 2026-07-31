import React from "react";
import "./SystemHealth.css";

const normalizeStatus = (status) => (status || "UNKNOWN").toUpperCase();

const statusClass = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === "OPERATIONAL") return "status-healthy";
  if (normalized === "DEGRADED") return "status-warning";
  if (normalized === "DOWN") return "status-critical";
  return "status-unknown";
};

const statusIcon = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === "OPERATIONAL") return "bi-check-circle-fill";
  if (normalized === "DEGRADED") return "bi-exclamation-triangle-fill";
  if (normalized === "DOWN") return "bi-x-circle-fill";
  return "bi-question-circle-fill";
};

const SystemHealth = ({ health, onRefresh }) => {
  const summary = health?.summary || {};
  const counts = health?.counts || {};
  const services = Array.isArray(health?.services) ? health.services : [];
  const overall = normalizeStatus(summary.status);
  const overallClass = statusClass(overall);
  const updatedAt = health?.updated_at
    ? new Date(health.updated_at).toLocaleTimeString()
    : "Belum diperbarui";

  return (
    <div className="system-health-card">
      <div className="health-header">
        <div className="header-left">
          <h3 className="health-title">
            <i className="bi bi-heart-pulse-fill" />
            System Health
          </h3>
          <p className="health-subtitle">Pemeriksaan layanan internal saat refresh terakhir</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div className="last-update">
            <i className="bi bi-arrow-clockwise" /> Updated {updatedAt}
          </div>
          <button
            onClick={() => onRefresh?.()}
            title="Refresh health"
            style={{
              background: "none", border: "1px solid #e5e5e5", borderRadius: 6,
              padding: "3px 8px", cursor: "pointer", color: "#525252", fontSize: "0.75rem",
            }}
          >
            <i className="bi bi-arrow-clockwise" />
          </button>
        </div>
      </div>

      <div className="overall-status">
        <div className={`status-indicator ${overallClass}`}><i className={`bi ${statusIcon(overall)}`} /></div>
        <div className="status-info">
          <h4 className="status-title">{overall === "OPERATIONAL" ? "All Systems Operational" : `System ${overall}`}</h4>
          <p className="status-description">Status didasarkan pada pemeriksaan backend, bukan izin halaman pengguna.</p>
        </div>
        <div className="status-metrics">
          <div className="metric-item"><span className="metric-label">Uptime</span><span className="metric-value">N/A</span></div>
          <div className="metric-item"><span className="metric-label">Avg Latency</span><span className="metric-value">{summary.avg_latency != null ? `${summary.avg_latency}ms` : "—"}</span></div>
        </div>
      </div>

      <div className="services-list" style={{ maxHeight: 380, overflowY: "auto", flex: "none" }}>
        {services.length === 0 ? (
          <p style={{ padding: 20, color: "#737373", margin: 0 }}>Data health belum tersedia.</p>
        ) : services.map((service) => {
          const serviceStatus = normalizeStatus(service.status);
          const cssClass = statusClass(serviceStatus);
          return (
            <div key={service.name} className="service-item">
              <div className={`service-status ${cssClass}`}><i className={`bi ${statusIcon(serviceStatus)}`} /></div>
              <div className={`service-icon ${cssClass}`}><i className="bi bi-server" /></div>
              <div className="service-info">
                <h5 className="service-name">{service.name}</h5>
                <p className="service-description" style={{ marginBottom: 0 }}>{service.description}</p>
                <span style={{ fontSize: "0.68rem", color: "#9ca3af", fontFamily: "monospace" }}>HTTP {service.http_status ?? "—"}</span>
              </div>
              <div className="service-metrics">
                <span className={`status-badge ${cssClass}`}>{serviceStatus}</span>
                <span className="latency-badge">{service.latency != null ? `${service.latency}ms` : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="health-summary">
        <div className="summary-stat"><i className="bi bi-check-circle-fill text-success" /> <span>{counts.operational || 0} Operational</span></div>
        <div className="summary-stat"><i className="bi bi-exclamation-triangle-fill text-warning" /> <span>{counts.degraded || 0} Degraded</span></div>
        <div className="summary-stat"><i className="bi bi-x-circle-fill text-danger" /> <span>{counts.down || 0} Down</span></div>
      </div>
    </div>
  );
};

export default SystemHealth;
