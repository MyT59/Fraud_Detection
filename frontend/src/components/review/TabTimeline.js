import React, { useState, useEffect } from "react";
import PageLoader from "../common/PageLoader";
import { fetchTimelineAnalytics } from "../../services/reviewApiService";

/**
 * TabTimeline.js
 * Tab "Timeline Analytics" — hanya untuk RISK_MANAGER & SUPER_ADMIN.
 * Menampilkan: reviews/jam (24h), fraud/hari (7d), queue growth (7d).
 * Data source: GET /reviews/timeline-analytics
 */

// ─── Section helper ───────────────────────────────────────────────

const TimelineSection = ({
  title,
  icon,
  color,
  items,
  labelKey,
  valueKey,
  valueLabel,
}) => {
  const maxVal = Math.max(...(items || []).map((x) => x[valueKey] ?? 0), 1);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        overflow: "hidden",
        marginBottom: "1.25rem",
      }}
    >
      <div
        style={{
          padding: ".875rem 1.25rem",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: ".6rem",
        }}
      >
        <i className={`bi ${icon}`} style={{ color, fontSize: "1.1rem" }} />
        <span style={{ fontWeight: 700, fontSize: ".9rem", color: "#111827" }}>
          {title}
        </span>
      </div>
      <table className="txn-table">
        <thead>
          <tr>
            <th>{labelKey === "hour" ? "Jam" : "Hari"}</th>
            <th>{valueLabel}</th>
            <th>Visualisasi</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((item, i) => {
            const val = item[valueKey] ?? 0;
            return (
              <tr key={i}>
                <td>
                  <span
                    style={{
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: ".82rem",
                    }}
                  >
                    {item[labelKey]}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 700 }}>{val}</span>
                </td>
                <td>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: ".5rem",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 8,
                        background: "#f3f4f6",
                        borderRadius: 4,
                        overflow: "hidden",
                        minWidth: 80,
                      }}
                    >
                      <div
                        style={{
                          width: `${(val / maxVal) * 100}%`,
                          height: "100%",
                          background: color,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: ".72rem",
                        color: "#94a3b8",
                        minWidth: 30,
                      }}
                    >
                      {Math.round((val / maxVal) * 100)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────

const TabTimeline = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchTimelineAnalytics();
        setData(res?.data ?? res ?? null);
      } catch (err) {
        console.error("[TabTimeline]", err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <PageLoader message="Memuat timeline analytics..." />;

  if (error || !data)
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "#b91c1c" }}>
        <i
          className="bi bi-wifi-off"
          style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}
        />
        <p style={{ fontWeight: 600 }}>Gagal memuat data timeline.</p>
      </div>
    );

  return (
    <div>
      <h2
        style={{
          margin: "0 0 1rem",
          fontSize: "1rem",
          fontWeight: 700,
          color: "#111827",
        }}
      >
        <i
          className="bi bi-graph-up-arrow"
          style={{ marginRight: 8, color: "#2563eb" }}
        />
        Timeline Analytics
      </h2>

      <TimelineSection
        title="Reviews per Jam (24 Jam Terakhir)"
        icon="bi-clock"
        color="#3b82f6"
        items={data.reviews_per_hour_24h}
        labelKey="hour"
        valueKey="count"
        valueLabel="Jumlah Review"
      />

      <TimelineSection
        title="Fraud per Hari (7 Hari Terakhir)"
        icon="bi-exclamation-triangle-fill"
        color="#dc2626"
        items={data.fraud_per_day_7d}
        labelKey="day"
        valueKey="count"
        valueLabel="Fraud Terdeteksi"
      />

      {/* Queue Growth */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: ".875rem 1.25rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: ".6rem",
          }}
        >
          <i
            className="bi bi-bar-chart-fill"
            style={{ color: "#8b5cf6", fontSize: "1.1rem" }}
          />
          <span
            style={{ fontWeight: 700, fontSize: ".9rem", color: "#111827" }}
          >
            Queue Growth (7 Hari Terakhir)
          </span>
        </div>
        <table className="txn-table">
          <thead>
            <tr>
              <th>Hari</th>
              <th>Alert Masuk</th>
              <th>Alert Resolved</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {(data.queue_growth_7d || []).map((item, i) => {
              const net = item.incoming_alerts - item.resolved_alerts;
              return (
                <tr key={i}>
                  <td>
                    <span
                      style={{
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: ".82rem",
                      }}
                    >
                      {item.day}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: "#dc2626" }}>
                      {item.incoming_alerts}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: "#10b981" }}>
                      {item.resolved_alerts}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 700,
                        color: net > 0 ? "#dc2626" : "#10b981",
                      }}
                    >
                      {net > 0 ? "+" : ""}
                      {net}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TabTimeline;
