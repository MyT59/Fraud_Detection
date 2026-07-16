import React, { useState, useEffect, useMemo } from "react";
import PageLoader from "../common/PageLoader";
import { fetchAnalystPerformance } from "../../services/reviewApiService";
import AnalystReviewModal from "./AnalystReviewModal";

const getInitials = (name = "Analyst") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatMinutes = (seconds) =>
  seconds > 0 ? `${(seconds / 60).toFixed(1)} min` : "-";

const TabAnalystPerformance = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedAnalyst, setSelectedAnalyst] = useState(null);

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

  const summary = useMemo(() => {
    const reviews = data.reduce((sum, a) => sum + (a.reviews_completed || 0), 0);
    const fraud = data.reduce((sum, a) => sum + (a.fraud_detected || 0), 0);
    const reviewersWithTime = data.filter((a) => a.avg_review_seconds > 0);
    const avgSeconds =
      reviewersWithTime.length > 0
        ? reviewersWithTime.reduce((sum, a) => sum + a.avg_review_seconds, 0) /
          reviewersWithTime.length
        : 0;

    return {
      analysts: data.length,
      reviews,
      fraud,
      avgTime: formatMinutes(avgSeconds),
    };
  }, [data]);

  if (loading) return <PageLoader message="Memuat performa analis..." />;

  if (error) {
    return (
      <div className="review-error-state">
        <i className="bi bi-wifi-off" />
        <p>Gagal memuat data performa.</p>
      </div>
    );
  }

  return (
    <div className="review-tab-content">
      <div className="review-panel-header">
        <div>
          <h2 className="review-panel-title">
            <span className="review-panel-icon purple">
              <i className="bi bi-people-fill" />
            </span>
            Analyst Performance
          </h2>
          <p className="review-panel-subtitle">
            Pantau beban kerja, kecepatan review, dan kualitas keputusan fraud
            analyst.
          </p>
        </div>
        <span className="review-panel-count">{data.length} analis</span>
      </div>

      <div className="review-mini-metrics">
        <div className="review-mini-metric">
          <span>Total Analyst</span>
          <strong>{summary.analysts}</strong>
        </div>
        <div className="review-mini-metric">
          <span>Total Review</span>
          <strong>{summary.reviews}</strong>
        </div>
        <div className="review-mini-metric">
          <span>Avg. Waktu</span>
          <strong>{summary.avgTime}</strong>
        </div>
        <div className="review-mini-metric danger">
          <span>Fraud Terdeteksi</span>
          <strong>{summary.fraud}</strong>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="review-compact-empty">
          <i className="bi bi-people" />
          <strong>Belum ada aktivitas reviewer</strong>
          <span>Data performa akan muncul setelah analyst menyelesaikan review.</span>
        </div>
      ) : (
        <div className="review-table-card">
          <table className="txn-table review-data-table">
            <thead>
              <tr>
                <th>Analis</th>
                <th>Email</th>
                <th>Reviews</th>
                <th>Avg. Waktu</th>
                <th>Fraud</th>
                <th>Fraud Rate</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a, i) => {
                const avgMin = formatMinutes(a.avg_review_seconds);
                const fraudRate =
                  a.reviews_completed > 0
                    ? ((a.fraud_detected / a.reviews_completed) * 100).toFixed(
                        1,
                      )
                    : "0.0";
                const rateNumber = parseFloat(fraudRate);

                return (
                  <tr
                    key={a.analyst_id ?? i}
                    className="review-clickable-row"
                    onClick={() => setSelectedAnalyst(a)}
                  >
                    <td>
                      <div className="review-analyst-cell">
                        <span className="review-avatar">
                          {getInitials(a.analyst_name)}
                        </span>
                        <strong>
                          {a.analyst_name || `Analyst #${a.analyst_id}`}
                        </strong>
                      </div>
                    </td>
                    <td className="review-muted-cell">
                      {a.analyst_email || "-"}
                    </td>
                    <td>
                      <strong>{a.reviews_completed}</strong>
                    </td>
                    <td>{avgMin}</td>
                    <td>
                      <span className="review-fraud-count">
                        <i className="bi bi-exclamation-triangle-fill" />
                        {a.fraud_detected}
                      </span>
                    </td>
                    <td>
                      <div className="review-rate-cell">
                        <span className="review-rate-track">
                          <span
                            className={`review-rate-fill ${
                              rateNumber > 50
                                ? "danger"
                                : rateNumber > 20
                                  ? "warning"
                                  : "success"
                            }`}
                            style={{ width: `${Math.min(rateNumber, 100)}%` }}
                          />
                        </span>
                        <strong>{fraudRate}%</strong>
                      </div>
                    </td>
                    <td>
                      <button
                        className="review-row-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedAnalyst(a);
                        }}
                      >
                        Detail
                        <i className="bi bi-chevron-right" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedAnalyst && (
        <AnalystReviewModal
          analyst={selectedAnalyst}
          onClose={() => setSelectedAnalyst(null)}
        />
      )}
    </div>
  );
};

export default TabAnalystPerformance;
