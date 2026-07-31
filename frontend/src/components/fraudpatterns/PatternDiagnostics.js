import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/apiService";
import "./PatternDiagnostics.css";

// [NEW COMPONENT]
// Memanggil GET /patterns/diagnostics yang sebelumnya tidak digunakan sama sekali
// di FE. Endpoint ini mengembalikan:
// - noisy_patterns: pattern dengan false_positive tertinggi
// - worst_accuracy_patterns: pattern dengan accuracy terendah
// - system_suggestions: rekomendasi auto-activation untuk pattern kandidat
//
// Section ini bersifat read-only / informational, sesuai scope halaman
// Fraud Patterns sebagai dashboard (bukan management).

const PatternDiagnostics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/patterns/diagnostics");
      setData(res);
    } catch (err) {
      console.error("[PatternDiagnostics] fetch error:", err);
      setError("Gagal memuat data diagnostics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  // Jangan render apapun jika error atau tidak ada insight sama sekali,
  // supaya tidak mengganggu layout dashboard saat data kosong.
  if (loading) {
    return (
      <div className="pdg-wrapper">
        <div className="pdg-header">
          <span className="pdg-title">
            <i className="bi bi-activity"></i>
            Pattern Diagnostics
          </span>
          <span className="pdg-subtitle">Memuat...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const noisy = data.noisy_patterns || [];
  const worst = data.worst_accuracy_patterns || [];
  const suggestions = data.system_suggestions || [];

  const hasAnyInsight =
    noisy.length > 0 || worst.length > 0 || suggestions.length > 0;

  if (!hasAnyInsight) return null;

  return (
    <div className="pdg-wrapper">
      <div className="pdg-header" onClick={() => setCollapsed((c) => !c)}>
        <span className="pdg-title">
          <i className="bi bi-activity"></i>
          Pattern Diagnostics
        </span>
        <div className="pdg-header-right">
          <span className="pdg-subtitle">
            {suggestions.length > 0 &&
              `${suggestions.length} saran aktivasi`}
            {suggestions.length > 0 &&
              (noisy.length > 0 || worst.length > 0) &&
              " • "}
            {(noisy.length > 0 || worst.length > 0) &&
              `${noisy.length + worst.length} pattern bermasalah`}
          </span>
          <i
            className={`bi bi-chevron-${collapsed ? "down" : "up"} pdg-chevron`}
          ></i>
        </div>
      </div>

      {!collapsed && (
        <div className="pdg-body">
          {suggestions.length > 0 && (
            <div className="pdg-section">
              <div className="pdg-section-title">
                <i className="bi bi-lightbulb-fill"></i>
                System Suggestions
              </div>
              <div className="pdg-suggestion-list">
                {suggestions.map((s) => (
                  <div key={s.pattern_id} className="pdg-suggestion-item">
                    <div className="pdg-suggestion-icon">
                      <i className="bi bi-arrow-up-circle-fill"></i>
                    </div>
                    <div className="pdg-suggestion-content">
                      <span className="pdg-suggestion-name">
                        {s.pattern_name}
                      </span>
                      <span className="pdg-suggestion-reason">
                        {s.reason}
                      </span>
                    </div>
                    <span className="pdg-suggestion-tag">
                      {s.suggestion_type === "SUGGEST_ACTIVATION"
                        ? "Suggest Activation"
                        : s.suggestion_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pdg-grid">
            {noisy.length > 0 && (
              <div className="pdg-section">
                <div className="pdg-section-title">
                  <i className="bi bi-exclamation-triangle-fill text-warn"></i>
                  Top False Positives
                </div>
                <div className="pdg-table">
                  {noisy.map((p) => (
                    <div key={p.id} className="pdg-row">
                      <span className="pdg-row-name">{p.name}</span>
                      <span className="pdg-row-value pdg-warn">
                        {p.false_positives.toLocaleString()} FP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {worst.length > 0 && (
              <div className="pdg-section">
                <div className="pdg-section-title">
                  <i className="bi bi-graph-down-arrow text-danger"></i>
                  Lowest Precision
                </div>
                <div className="pdg-table">
                  {worst.map((p) => (
                    <div key={p.id} className="pdg-row">
                      <span className="pdg-row-name">{p.name}</span>
                      <span className="pdg-row-value pdg-danger">
                        {(p.accuracy * (p.accuracy <= 1 ? 100 : 1)).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatternDiagnostics;
