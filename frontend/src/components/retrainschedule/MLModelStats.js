import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/apiService";

// ─── Summary card (row 1) ───────────────────────────────────────────────────
const SummaryCard = ({
  icon,
  accent,
  accentBg,
  value,
  valueSuffix,
  label,
  badge,
  sub,
}) => (
  <div
    style={{
      background: "white",
      border: "1px solid #f1f5f9",
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: accent,
        borderRadius: "12px 12px 0 0",
      }}
    />
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 9,
        background: accentBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
      }}
    >
      <i className={`bi ${icon}`} style={{ color: accent, fontSize: 15 }} />
    </div>
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 4,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: "1.375rem",
          fontWeight: 700,
          color: "#0f172a",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {valueSuffix && (
        <span
          style={{ fontSize: "0.775rem", fontWeight: 500, color: "#64748b" }}
        >
          {valueSuffix}
        </span>
      )}
    </div>
    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>
      {label}
    </span>
    {badge && (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: "0.7rem",
          fontWeight: 600,
          color: badge.color,
          background: badge.bg,
          padding: "2px 7px",
          borderRadius: 20,
          alignSelf: "flex-start",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: badge.color,
            display: "inline-block",
          }}
        />
        Scheduler {badge.text}
      </span>
    )}
    {!badge && sub && (
      <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{sub}</span>
    )}
  </div>
);

// ─── Domain model card (row 2) ──────────────────────────────────────────────
const DomainCard = ({ domain, data, accent, accentBg }) => {
  const domainLabel = domain === "agenusa" ? "Agenusa" : "Nusabill";

  const fmt = (v, decimals = 2) =>
    v != null ? Number(v).toFixed(decimals) : "—";

  const pct = (v) => (v != null ? `${(v * 100).toFixed(1)}%` : "—");

  const rows = [
    {
      icon: "bi-database",
      label: "Training Samples",
      value: data?.training_samples?.toLocaleString("id-ID") ?? "—",
    },
    {
      icon: "bi-exclamation-triangle",
      label: "Anomali Ditemukan",
      value: data?.anomalies_detected?.toLocaleString("id-ID") ?? "—",
    },
    {
      icon: "bi-percent",
      label: "Anomaly Rate",
      value: pct(data?.anomaly_rate),
    },
    {
      icon: "bi-sliders",
      label: "Contamination",
      value: pct(data?.contamination_rate),
    },
    {
      icon: "bi-bar-chart-steps",
      label: "Review Threshold",
      value: fmt(data?.thresholds?.review_score_threshold, 4),
    },
    {
      icon: "bi-exclamation-octagon",
      label: "High-Risk Threshold",
      value: fmt(data?.thresholds?.high_risk_score_threshold, 4),
    },
  ];

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #f1f5f9",
        borderRadius: 12,
        overflow: "hidden",
        flex: 1,
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: accentBg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i
              className="bi bi-server"
              style={{ color: "white", fontSize: 13 }}
            />
          </div>
          <span
            style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1e293b" }}
          >
            {domainLabel}
          </span>
        </div>
        {data?.version && (
          <span
            style={{
              fontSize: "0.7rem",
              color: "#94a3b8",
              fontFamily: "monospace",
            }}
          >
            {data.version.split("_v")[1]?.substring(0, 14) ?? data.version}
          </span>
        )}
        {!data && (
          <span
            style={{ fontSize: "0.7rem", color: "#ef4444", fontWeight: 600 }}
          >
            Belum ada model
          </span>
        )}
      </div>

      {/* Metrics grid */}
      <div
        style={{
          padding: "12px 16px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px 16px",
        }}
      >
        {rows.map((r) => (
          <div key={r.label}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginBottom: 2,
              }}
            >
              <i
                className={`bi ${r.icon}`}
                style={{ fontSize: 11, color: accent }}
              />
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "#94a3b8",
                  fontWeight: 500,
                }}
              >
                {r.label}
              </span>
            </div>
            <span
              style={{
                fontSize: "0.925rem",
                fontWeight: 700,
                color: data ? "#0f172a" : "#cbd5e1",
              }}
            >
              {data ? r.value : "—"}
            </span>
          </div>
        ))}
      </div>

      {data?.created_at && (
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid #f8fafc",
            fontSize: "0.7rem",
            color: "#94a3b8",
          }}
        >
          <i className="bi bi-clock me-1" />
          Model dibuat:{" "}
          {new Date(data.created_at).toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      )}
    </div>
  );
};

// ─── Skeleton ───────────────────────────────────────────────────────────────
const SkeletonSummary = () => (
  <div
    style={{
      background: "white",
      border: "1px solid #f1f5f9",
      borderRadius: 12,
      padding: "14px 16px",
      opacity: 0.5,
    }}
  >
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 9,
        background: "#e5e7eb",
        marginBottom: 12,
      }}
    />
    <div
      style={{
        height: 20,
        width: "55%",
        background: "#e5e7eb",
        borderRadius: 6,
        marginBottom: 6,
      }}
    />
    <div
      style={{
        height: 12,
        width: "75%",
        background: "#f3f4f6",
        borderRadius: 5,
      }}
    />
  </div>
);

const SkeletonDomain = () => (
  <div
    style={{
      background: "white",
      border: "1px solid #f1f5f9",
      borderRadius: 12,
      flex: 1,
      opacity: 0.5,
    }}
  >
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid #f1f5f9",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          height: 16,
          width: 100,
          background: "#e5e7eb",
          borderRadius: 5,
        }}
      />
    </div>
    <div
      style={{
        padding: "12px 16px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "10px 16px",
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i}>
          <div
            style={{
              height: 10,
              width: "70%",
              background: "#f3f4f6",
              borderRadius: 4,
              marginBottom: 4,
            }}
          />
          <div
            style={{
              height: 16,
              width: "50%",
              background: "#e5e7eb",
              borderRadius: 4,
            }}
          />
        </div>
      ))}
    </div>
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────────
const MLModelStats = () => {
  const [metrics, setMetrics] = useState(null);
  const [status, setStatus] = useState(null);
  const [modelStats, setModelStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [m, s, ms] = await Promise.all([
        api.get("/retrain/metrics"),
        api.get("/retrain/status"),
        api.get("/retrain/model-stats"),
      ]);
      setMetrics(m);
      setStatus(s);
      setModelStats(ms);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatLastRun = (iso) => {
    if (!iso) return { line1: "Belum", line2: "pernah" };
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return { line1: "Baru", line2: "saja" };
    if (diff < 3600)
      return { line1: `${Math.floor(diff / 60)}`, line2: "menit lalu" };
    if (diff < 86400)
      return { line1: `${Math.floor(diff / 3600)}`, line2: "jam lalu" };
    return { line1: `${Math.floor(diff / 86400)}`, line2: "hari lalu" };
  };

  const formatUptime = (s) => {
    if (!s) return null;
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60);
    return h > 0 ? `Uptime ${h}j ${m}m` : `Uptime ${m}m`;
  };

  const schedulerOn = status?.scheduler_running;
  const lastRun = formatLastRun(status?.last_run);

  const summaryCards = [
    {
      icon: "bi-arrow-repeat",
      accent: "#6366f1",
      accentBg: "#eef2ff",
      value: metrics?.total_retrains ?? "—",
      label: "Total Retrain",
      badge:
        schedulerOn !== undefined
          ? {
              text: schedulerOn ? "Aktif" : "Mati",
              color: schedulerOn ? "#16a34a" : "#dc2626",
              bg: schedulerOn ? "#f0fdf4" : "#fef2f2",
            }
          : null,
    },
    {
      icon: "bi-check2-circle",
      accent: "#10b981",
      accentBg: "#f0fdf4",
      value: metrics?.success_rate != null ? `${metrics.success_rate}%` : "—",
      label: "Success Rate",
      sub: metrics
        ? `${status?.successful_jobs ?? 0} sukses · ${status?.failed_jobs ?? 0} gagal`
        : null,
    },
    {
      icon: "bi-diagram-3",
      accent: "#f59e0b",
      accentBg: "#fffbeb",
      value:
        metrics?.total_patterns_generated != null
          ? metrics.total_patterns_generated.toLocaleString("id-ID")
          : "—",
      label: "Pola Ditemukan",
      sub: "Dari semua retrain",
    },
    {
      icon: "bi-clock-history",
      accent: "#3b82f6",
      accentBg: "#eff6ff",
      value: lastRun.line1,
      valueSuffix: lastRun.line2,
      label: "Last Run",
      sub: status ? formatUptime(status.uptime_seconds) : null,
    },
    {
      icon: "bi-cpu",
      accent: "#8b5cf6",
      accentBg: "#f5f3ff",
      value: status?.total_jobs ?? "—",
      label: "Jobs Aktif",
      sub: "Di background scheduler",
    },
  ];

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i
              className="bi bi-graph-up"
              style={{ color: "white", fontSize: 12 }}
            />
          </div>
          <span
            style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1e293b" }}
          >
            ML Model Performance
          </span>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: "none",
            border: "1px solid #e2e8f0",
            borderRadius: 7,
            padding: "3px 10px",
            fontSize: "0.75rem",
            color: "#64748b",
            cursor: loading ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            opacity: loading ? 0.5 : 1,
          }}
        >
          <i
            className={`bi bi-arrow-clockwise${loading ? " spin" : ""}`}
            style={{ fontSize: 11 }}
          />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: "0.8rem",
            color: "#dc2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            <i className="bi bi-exclamation-triangle me-2" />
            Gagal memuat data performa ML.
          </span>
          <button
            onClick={fetchData}
            style={{
              background: "none",
              border: "1px solid #fca5a5",
              borderRadius: 6,
              padding: "2px 10px",
              fontSize: "0.75rem",
              color: "#dc2626",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Coba lagi
          </button>
        </div>
      )}

      {!error && (
        <>
          {/* Row 1 — summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 10,
              marginBottom: 10,
            }}
          >
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonSummary key={i} />
                ))
              : summaryCards.map((c) => <SummaryCard key={c.label} {...c} />)}
          </div>

          {/* Row 2 — domain model cards */}
          <div style={{ display: "flex", gap: 10 }}>
            {loading ? (
              <>
                <SkeletonDomain />
                <SkeletonDomain />
              </>
            ) : (
              <>
                <DomainCard
                  domain="agenusa"
                  data={modelStats?.agenusa}
                  accent="#16a34a"
                  accentBg="#f0fdf4"
                />
                <DomainCard
                  domain="nusabill"
                  data={modelStats?.nusabill}
                  accent="#2563eb"
                  accentBg="#eff6ff"
                />
              </>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; display: inline-block; }
      `}</style>
    </div>
  );
};

export default MLModelStats;
