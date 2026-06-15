import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/apiService";

const STATUS_MAP = {
  SUCCESS: {
    label: "Sukses",
    color: "#16a34a",
    bg: "#f0fdf4",
    icon: "bi-check-circle-fill",
  },
  FAILED: {
    label: "Gagal",
    color: "#dc2626",
    bg: "#fef2f2",
    icon: "bi-x-circle-fill",
  },
};

const TRIGGER_MAP = {
  manual_upload: { label: "Upload", icon: "bi-cloud-upload", color: "#6366f1" },
  scheduled: { label: "Terjadwal", icon: "bi-clock", color: "#0ea5e9" },
  manual: { label: "Manual", icon: "bi-play-circle", color: "#f59e0b" },
};

const DOMAIN_COLORS = {
  agenusa: { color: "#16a34a", bg: "#f0fdf4" },
  nusabill: { color: "#2563eb", bg: "#eff6ff" },
};

const fmt = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const SkeletonRow = () => (
  <tr style={{ borderBottom: "1px solid #f8fafc" }}>
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} style={{ padding: "13px 16px" }}>
        <div
          style={{
            height: 14,
            width: i === 0 ? 120 : 70,
            background: "#f1f5f9",
            borderRadius: 5,
          }}
        />
      </td>
    ))}
  </tr>
);

const RetrainHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await api.get("/retrain/history");
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <span
            style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0f172a" }}
          >
            Riwayat Retrain
          </span>
          {!loading && !error && (
            <span
              style={{ marginLeft: 8, fontSize: "0.75rem", color: "#94a3b8" }}
            >
              {history.length} entri terakhir
            </span>
          )}
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="rs-btn rs-btn--ghost"
          style={{ padding: "6px 12px", fontSize: "0.775rem" }}
        >
          <i className={`bi bi-arrow-clockwise${loading ? " rs-spin" : ""}`} />
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
            padding: "12px 16px",
            fontSize: "0.8rem",
            color: "#dc2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            <i className="bi bi-exclamation-triangle me-2" />
            Gagal memuat riwayat retrain.
          </span>
          <button
            onClick={fetchHistory}
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

      {/* Table */}
      {!error && (
        <div className="rs-table-wrap">
          <table className="rs-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Waktu Eksekusi</th>
                <th>Trigger</th>
                <th>Domain</th>
                <th>Status</th>
                <th>Records Trained</th>
                <th>Feedback Dipakai</th>
                <th>Pola Ditemukan</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : history.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: "40px 16px",
                      color: "#94a3b8",
                      fontSize: "0.875rem",
                    }}
                  >
                    <i
                      className="bi bi-clock-history"
                      style={{
                        fontSize: 28,
                        display: "block",
                        marginBottom: 8,
                        opacity: 0.4,
                      }}
                    />
                    Belum ada riwayat retrain.
                  </td>
                </tr>
              ) : (
                history.map((h) => {
                  const status = STATUS_MAP[h.status] ?? {
                    label: h.status,
                    color: "#64748b",
                    bg: "#f8fafc",
                    icon: "bi-circle",
                  };
                  const trigger = TRIGGER_MAP[h.trigger_source] ?? {
                    label: h.trigger_source,
                    icon: "bi-cpu",
                    color: "#94a3b8",
                  };
                  const domain =
                    h.log_details?.domain ?? h.trigger_metadata?.domain ?? null;
                  const domainStyle = DOMAIN_COLORS[domain] ?? null;
                  const totalRecords =
                    h.log_details?.total_records_trained ??
                    h.log_details?.total_records ??
                    "—";
                  const feedbackUsed =
                    h.log_details?.feedback_records_used ?? "—";

                  return (
                    <tr key={h.id} className="rs-table__row">
                      {/* Waktu */}
                      <td>
                        <span
                          style={{
                            fontWeight: 500,
                            color: "#334155",
                            fontSize: "0.8rem",
                          }}
                        >
                          {fmt(h.execution_time)}
                        </span>
                      </td>

                      {/* Trigger */}
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: "0.775rem",
                            fontWeight: 600,
                            color: trigger.color,
                          }}
                        >
                          <i
                            className={`bi ${trigger.icon}`}
                            style={{ fontSize: 12 }}
                          />
                          {trigger.label}
                        </span>
                      </td>

                      {/* Domain */}
                      <td>
                        {domain && domainStyle ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: domainStyle.bg,
                              color: domainStyle.color,
                              padding: "3px 9px",
                              borderRadius: 20,
                              fontSize: "0.775rem",
                              fontWeight: 600,
                            }}
                          >
                            <i
                              className="bi bi-server"
                              style={{ fontSize: 11 }}
                            />
                            {domain.charAt(0).toUpperCase() + domain.slice(1)}
                          </span>
                        ) : (
                          <span
                            style={{ color: "#94a3b8", fontSize: "0.775rem" }}
                          >
                            —
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            background: status.bg,
                            color: status.color,
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: "0.775rem",
                            fontWeight: 600,
                          }}
                        >
                          <i
                            className={`bi ${status.icon}`}
                            style={{ fontSize: 11 }}
                          />
                          {status.label}
                        </span>
                      </td>

                      {/* Records */}
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: "#0f172a",
                            fontSize: "0.875rem",
                          }}
                        >
                          {typeof totalRecords === "number"
                            ? totalRecords.toLocaleString("id-ID")
                            : totalRecords}
                        </span>
                      </td>

                      {/* Feedback */}
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color:
                              feedbackUsed !== "—" && feedbackUsed > 0
                                ? "#6366f1"
                                : "#0f172a",
                          }}
                        >
                          {typeof feedbackUsed === "number"
                            ? feedbackUsed.toLocaleString("id-ID")
                            : feedbackUsed}
                        </span>
                        {feedbackUsed > 0 && (
                          <span
                            style={{
                              marginLeft: 4,
                              fontSize: "0.7rem",
                              color: "#6366f1",
                            }}
                          >
                            <i className="bi bi-arrow-up-circle-fill" />
                          </span>
                        )}
                      </td>

                      {/* Pola */}
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color:
                              h.new_patterns_count > 0 ? "#f59e0b" : "#0f172a",
                          }}
                        >
                          {h.new_patterns_count?.toLocaleString("id-ID") ?? "—"}
                        </span>
                        {h.new_patterns_count > 0 && (
                          <span
                            style={{
                              marginLeft: 4,
                              fontSize: "0.7rem",
                              color: "#f59e0b",
                            }}
                          >
                            <i className="bi bi-stars" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RetrainHistory;
