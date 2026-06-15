import React, { useState, useEffect } from "react";
import PageLoader from "../common/PageLoader";
import { fetchAnalystPerformance } from "../../services/reviewApiService";

/**
 * TabAnalystPerformance.js
 * Tab "Analyst Performance" — hanya untuk RISK_MANAGER & SUPER_ADMIN.
 * Menampilkan performa per analis: jumlah review, avg waktu, fraud rate.
 * Data source: GET /reviews/analyst-performance
 */
const TabAnalystPerformance = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchAnalystPerformance();
        setData(Array.isArray(res) ? res : (res?.data ?? []));
      } catch (err) {
        console.error("[TabAnalystPerformance]", err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <PageLoader message="Memuat performa analis..." />;

  if (error)
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "#b91c1c" }}>
        <i
          className="bi bi-wifi-off"
          style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}
        />
        <p style={{ fontWeight: 600 }}>Gagal memuat data performa.</p>
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
          className="bi bi-people-fill"
          style={{ marginRight: 8, color: "#7c3aed" }}
        />
        Analyst Performance{" "}
        <span style={{ fontWeight: 400, color: "#6b7280", fontSize: ".85rem" }}>
          ({data.length} analis)
        </span>
      </h2>

      {data.length === 0 ? (
        <div className="txn-empty">
          <i
            className="bi bi-people"
            style={{
              fontSize: "2.5rem",
              color: "#94a3b8",
              display: "block",
              marginBottom: "12px",
            }}
          />
          <p style={{ color: "#374151", fontWeight: 600 }}>
            Belum ada data performa analis.
          </p>
        </div>
      ) : (
        <div className="txn-table-wrapper">
          <table className="txn-table">
            <thead>
              <tr>
                <th>Analis</th>
                <th>Email</th>
                <th>Reviews</th>
                <th>Avg. Waktu</th>
                <th>Fraud Terdeteksi</th>
                <th>Fraud Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a, i) => {
                const avgMin =
                  a.avg_review_seconds > 0
                    ? (a.avg_review_seconds / 60).toFixed(1)
                    : "—";
                const fraudRate =
                  a.reviews_completed > 0
                    ? ((a.fraud_detected / a.reviews_completed) * 100).toFixed(
                        1,
                      )
                    : "0.0";
                return (
                  <tr key={a.analyst_id ?? i}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: ".6rem",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background:
                              "linear-gradient(135deg,#7c3aed,#4f46e5)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: ".7rem",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {(a.analyst_name || "A")
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: ".875rem" }}>
                          {a.analyst_name || `Analyst #${a.analyst_id}`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: ".82rem", color: "#6b7280" }}>
                        {a.analyst_email || "—"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700 }}>
                        {a.reviews_completed}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: ".82rem" }}>{avgMin} min</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: "#dc2626" }}>
                        <i
                          className="bi bi-exclamation-triangle-fill"
                          style={{ fontSize: ".75rem", marginRight: 4 }}
                        />
                        {a.fraud_detected}
                      </span>
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
                            height: 6,
                            background: "#f3f4f6",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(parseFloat(fraudRate), 100)}%`,
                              height: "100%",
                              borderRadius: 3,
                              background:
                                parseFloat(fraudRate) > 50
                                  ? "#dc2626"
                                  : parseFloat(fraudRate) > 20
                                    ? "#f59e0b"
                                    : "#10b981",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: ".78rem",
                            fontWeight: 600,
                            minWidth: 36,
                          }}
                        >
                          {fraudRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TabAnalystPerformance;
