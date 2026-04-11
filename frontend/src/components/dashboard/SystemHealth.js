import React, { useState, useEffect, useCallback } from "react";
import "./SystemHealth.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

const API_ENDPOINTS = [
  {
    id: "dashboard",
    name: "Dashboard API",
    description: "Stats & overview data",
    icon: "bi-speedometer2",
    url: `${API_BASE}/dashboard/all`,
    method: "GET",
  },
  {
    id: "alerts",
    name: "Alerts Service",
    description: "Fraud & rule engine alerts",
    icon: "bi-bell",
    url: `${API_BASE}/alerts/saved`,
    method: "GET",
  },
  {
    id: "audit",
    name: "Audit Log API",
    description: "System audit trail",
    icon: "bi-journal-text",
    url: `${API_BASE}/audit-logs/stats`,
    method: "GET",
  },
  {
    id: "users",
    name: "Users API",
    description: "User management service",
    icon: "bi-people",
    url: `${API_BASE}/users?page_size=1`,
    method: "GET",
  },
  {
    id: "retrain_scheduler",
    name: "Retrain Scheduler",
    description: "APScheduler job status",
    icon: "bi-cpu",
    url: `${API_BASE}/retrain/status`,
    method: "GET",
  },
  {
    id: "retrain_schedules",
    name: "Retrain Schedules",
    description: "ML model retrain config",
    icon: "bi-calendar-check",
    url: `${API_BASE}/retrain/schedules`,
    method: "GET",
  },
];

const PING_INTERVAL_MS = 15000;

const SystemHealth = () => {
  const [services, setServices] = useState(() =>
    API_ENDPOINTS.map((ep) => ({
      ...ep,
      status: "checking",
      latency: null,
      httpStatus: null,
      lastChecked: null,
    })),
  );
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());
  const [uptime] = useState("99.98%");
  const [isChecking, setIsChecking] = useState(false);

  const pingEndpoint = async (endpoint) => {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch(endpoint.url, {
        method: endpoint.method,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latency = Math.round(performance.now() - start);
      return {
        status: res.ok ? "operational" : "degraded",
        latency,
        httpStatus: res.status,
      };
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      if (err.name === "AbortError") {
        return { status: "degraded", latency, httpStatus: "timeout" };
      }
      return { status: "down", latency, httpStatus: "unreachable" };
    }
  };

  const checkAll = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);

    setServices((prev) => prev.map((s) => ({ ...s, status: "checking" })));

    const results = await Promise.all(
      API_ENDPOINTS.map(async (ep) => {
        const result = await pingEndpoint(ep);
        return { id: ep.id, ...result };
      }),
    );

    setServices((prev) =>
      prev.map((s) => {
        const r = results.find((r) => r.id === s.id);
        return r
          ? {
              ...s,
              status: r.status,
              latency: r.latency,
              httpStatus: r.httpStatus,
              lastChecked: new Date().toLocaleTimeString(),
            }
          : s;
      }),
    );

    setLastUpdate(new Date().toLocaleTimeString());
    setIsChecking(false);
  }, [isChecking]);

  useEffect(() => {
    checkAll();
    const interval = setInterval(checkAll, PING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const operational = services.filter((s) => s.status === "operational").length;
  const degraded = services.filter((s) => s.status === "degraded").length;
  const down = services.filter((s) => s.status === "down").length;
  const checking = services.filter((s) => s.status === "checking").length;

  const avgLatency = services
    .filter((s) => s.latency !== null && s.status !== "down")
    .reduce((sum, s, _, arr) => sum + s.latency / arr.length, 0)
    .toFixed(0);

  const overallStatus =
    down > 0
      ? "critical"
      : degraded > 0
        ? "warning"
        : checking > 0
          ? "warning"
          : "healthy";

  const getStatusColor = (status) => {
    switch (status) {
      case "operational":
        return "status-healthy";
      case "degraded":
        return "status-warning";
      case "down":
        return "status-critical";
      case "checking":
        return "status-checking";
      default:
        return "status-unknown";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "operational":
        return "Operational";
      case "degraded":
        return "Degraded";
      case "down":
        return "Down";
      case "checking":
        return "Checking…";
      default:
        return "Unknown";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "operational":
        return "bi-check-circle-fill";
      case "degraded":
        return "bi-exclamation-triangle-fill";
      case "down":
        return "bi-x-circle-fill";
      case "checking":
        return "bi-arrow-repeat";
      default:
        return "bi-question-circle-fill";
    }
  };

  const overallLabel = {
    healthy: "All Systems Operational",
    warning:
      degraded > 0
        ? `${degraded} Service${degraded > 1 ? "s" : ""} Degraded`
        : "Checking Services…",
    critical: `${down} Service${down > 1 ? "s" : ""} Down`,
  }[overallStatus];

  const overallDesc = {
    healthy: "Semua API endpoint berjalan normal",
    warning: "Beberapa endpoint mengalami kelambatan",
    critical: "Satu atau lebih endpoint tidak dapat dijangkau",
  }[overallStatus];

  return (
    <div className="system-health-card">
      <div className="health-header">
        <div className="header-left">
          <h3 className="health-title">
            <i className="bi bi-heart-pulse-fill"></i>
            System Health
          </h3>
          <p className="health-subtitle">Live API endpoint monitoring</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div className="last-update">
            <i className="bi bi-arrow-clockwise"></i>
            Updated {lastUpdate}
          </div>
          <button
            onClick={checkAll}
            disabled={isChecking}
            title="Refresh now"
            style={{
              background: "none",
              border: "1px solid #e5e5e5",
              borderRadius: 6,
              padding: "3px 8px",
              cursor: isChecking ? "not-allowed" : "pointer",
              color: isChecking ? "#a3a3a3" : "#525252",
              fontSize: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <i
              className={`bi bi-arrow-clockwise${isChecking ? " spin-icon" : ""}`}
              style={isChecking ? { animation: "spin 1s linear infinite" } : {}}
            ></i>
          </button>
        </div>
      </div>

      <div className="overall-status">
        <div className={`status-indicator status-${overallStatus}`}>
          <i
            className={
              overallStatus === "healthy"
                ? "bi bi-check-circle-fill"
                : overallStatus === "critical"
                  ? "bi bi-x-circle-fill"
                  : "bi bi-exclamation-triangle-fill"
            }
          ></i>
        </div>
        <div className="status-info">
          <h4 className="status-title">{overallLabel}</h4>
          <p className="status-description">{overallDesc}</p>
        </div>
        <div className="status-metrics">
          <div className="metric-item">
            <span className="metric-label">Uptime</span>
            <span className="metric-value">{uptime}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Avg Latency</span>
            <span
              className="metric-value"
              style={{
                color:
                  Number(avgLatency) > 500
                    ? "#dc2626"
                    : Number(avgLatency) > 200
                      ? "#f59e0b"
                      : "#10b981",
              }}
            >
              {isChecking || !avgLatency || isNaN(avgLatency)
                ? "—"
                : `${avgLatency}ms`}
            </span>
          </div>
        </div>
      </div>

      <div
        className="services-list"
        style={{ maxHeight: 380, overflowY: "auto", flex: "none" }}
      >
        {services.map((service) => (
          <div key={service.id} className="service-item">
            <div className={`service-status ${getStatusColor(service.status)}`}>
              <i
                className={getStatusIcon(service.status)}
                style={
                  service.status === "checking"
                    ? {
                        animation: "spin 1s linear infinite",
                        fontSize: "0.75rem",
                      }
                    : {}
                }
              ></i>
            </div>

            <div className={`service-icon ${getStatusColor(service.status)}`}>
              <i className={service.icon}></i>
            </div>

            <div className="service-info">
              <h5 className="service-name">{service.name}</h5>
              <p className="service-description" style={{ marginBottom: 0 }}>
                {service.description}
              </p>
              {service.httpStatus !== null && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    color:
                      service.httpStatus === "unreachable" ||
                      service.httpStatus === "timeout"
                        ? "#dc2626"
                        : "#9ca3af",
                    fontFamily: "monospace",
                  }}
                >
                  HTTP {service.httpStatus}
                </span>
              )}
            </div>

            <div className="service-metrics">
              <span
                className={`status-badge ${getStatusColor(service.status)}`}
              >
                {getStatusLabel(service.status)}
              </span>
              {service.latency !== null ? (
                <span
                  className="latency-badge"
                  style={{
                    color:
                      service.status === "down"
                        ? "#dc2626"
                        : service.latency > 500
                          ? "#f59e0b"
                          : "#737373",
                  }}
                >
                  {service.status === "down" ? "—" : `${service.latency}ms`}
                </span>
              ) : (
                <span className="latency-badge" style={{ color: "#d1d5db" }}>
                  …
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="health-summary">
        <div className="summary-stat">
          <i className="bi bi-check-circle-fill text-success"></i>
          <span>{operational} Operational</span>
        </div>
        {degraded > 0 && (
          <div className="summary-stat">
            <i className="bi bi-exclamation-triangle-fill text-warning"></i>
            <span>{degraded} Degraded</span>
          </div>
        )}
        <div className="summary-stat">
          <i className="bi bi-x-circle-fill text-danger"></i>
          <span>{down} Down</span>
        </div>
        <div
          className="summary-stat"
          style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#a3a3a3" }}
        >
          <i className="bi bi-arrow-repeat" style={{ marginRight: 4 }}></i>
          Refresh / {PING_INTERVAL_MS / 1000}s
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .service-status.status-checking {
          color: #9ca3af;
        }
        .service-icon.status-checking {
          background: #f3f4f6;
          color: #9ca3af;
        }
        .status-badge.status-checking {
          background: #f3f4f6;
          color: #6b7280;
          border: 1px solid #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default SystemHealth;
