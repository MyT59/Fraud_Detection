import React, { useState, useEffect, useMemo } from "react";
import PageLoader from "../common/PageLoader";
import { fetchTimelineAnalytics } from "../../services/reviewApiService";

const TimelineSection = ({
  title,
  subtitle,
  icon,
  color,
  items,
  labelKey,
  valueKey,
  valueLabel,
  emptyText,
}) => {
  const rows = items || [];
  const maxVal = Math.max(...rows.map((x) => x[valueKey] ?? 0), 1);
  const total = rows.reduce((sum, item) => sum + (item[valueKey] || 0), 0);

  return (
    <div className="timeline-card">
      <div className="timeline-card-header">
        <span className="timeline-card-icon" style={{ color }}>
          <i className={`bi ${icon}`} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <strong className="timeline-card-total">{total}</strong>
      </div>

      {rows.length === 0 ? (
        <div className="timeline-empty">
          <i className="bi bi-inbox" />
          <span>{emptyText}</span>
        </div>
      ) : (
        <div className="timeline-list">
          {rows.map((item, i) => {
            const val = item[valueKey] ?? 0;
            return (
              <div className="timeline-row" key={`${item[labelKey]}-${i}`}>
                <span className="timeline-label">{item[labelKey]}</span>
                <div className="timeline-bar-wrap">
                  <span
                    className="timeline-bar"
                    style={{
                      width: `${Math.max((val / maxVal) * 100, val ? 8 : 0)}%`,
                      background: color,
                    }}
                  />
                </div>
                <span className="timeline-value">
                  {val} {valueLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const QueueGrowthSection = ({ items }) => {
  const rows = items || [];
  const totals = rows.reduce(
    (acc, item) => ({
      incoming: acc.incoming + (item.incoming_alerts || 0),
      resolved: acc.resolved + (item.resolved_alerts || 0),
    }),
    { incoming: 0, resolved: 0 },
  );

  return (
    <div className="timeline-card timeline-card-wide">
      <div className="timeline-card-header">
        <span className="timeline-card-icon purple">
          <i className="bi bi-bar-chart-fill" />
        </span>
        <div>
          <h3>Queue Growth</h3>
          <p>Alert masuk, resolved, dan perubahan beban dalam 7 hari terakhir.</p>
        </div>
        <strong className="timeline-card-total">
          {totals.incoming - totals.resolved >= 0 ? "+" : ""}
          {totals.incoming - totals.resolved}
        </strong>
      </div>

      {rows.length === 0 ? (
        <div className="timeline-empty">
          <i className="bi bi-inbox" />
          <span>Belum ada data pertumbuhan queue.</span>
        </div>
      ) : (
        <div className="queue-growth-list">
          {rows.map((item, i) => {
            const net = (item.incoming_alerts || 0) - (item.resolved_alerts || 0);
            return (
              <div className="queue-growth-row" key={`${item.day}-${i}`}>
                <span className="timeline-label">{item.day}</span>
                <span className="queue-pill danger">
                  Masuk {item.incoming_alerts || 0}
                </span>
                <span className="queue-pill success">
                  Resolved {item.resolved_alerts || 0}
                </span>
                <strong className={net > 0 ? "net-danger" : "net-success"}>
                  Net {net > 0 ? "+" : ""}
                  {net}
                </strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

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

  const totals = useMemo(() => {
    const reviews = data?.reviews_per_hour_24h || [];
    const fraud = data?.fraud_per_day_7d || [];
    const queue = data?.queue_growth_7d || [];
    return {
      reviews: reviews.reduce((sum, item) => sum + (item.count || 0), 0),
      fraud: fraud.reduce((sum, item) => sum + (item.count || 0), 0),
      incoming: queue.reduce((sum, item) => sum + (item.incoming_alerts || 0), 0),
      resolved: queue.reduce((sum, item) => sum + (item.resolved_alerts || 0), 0),
    };
  }, [data]);

  if (loading) return <PageLoader message="Memuat timeline analytics..." />;

  if (error || !data) {
    return (
      <div className="review-error-state">
        <i className="bi bi-wifi-off" />
        <p>Gagal memuat data timeline.</p>
      </div>
    );
  }

  return (
    <div className="review-tab-content">
      <div className="review-panel-header">
        <div>
          <h2 className="review-panel-title">
            <span className="review-panel-icon blue">
              <i className="bi bi-graph-up-arrow" />
            </span>
            Review Timeline
          </h2>
          <p className="review-panel-subtitle">
            Ringkasan aktivitas review dan pertumbuhan queue untuk monitoring
            operasional.
          </p>
        </div>
      </div>

      <div className="review-mini-metrics">
        <div className="review-mini-metric">
          <span>Review 24 Jam</span>
          <strong>{totals.reviews}</strong>
        </div>
        <div className="review-mini-metric danger">
          <span>Fraud 7 Hari</span>
          <strong>{totals.fraud}</strong>
        </div>
        <div className="review-mini-metric">
          <span>Alert Masuk</span>
          <strong>{totals.incoming}</strong>
        </div>
        <div className="review-mini-metric success">
          <span>Resolved</span>
          <strong>{totals.resolved}</strong>
        </div>
      </div>

      <div className="timeline-grid">
        <TimelineSection
          title="Reviews per Jam"
          subtitle="Distribusi review dalam 24 jam terakhir."
          icon="bi-clock"
          color="#2563eb"
          items={data.reviews_per_hour_24h}
          labelKey="hour"
          valueKey="count"
          valueLabel="review"
          emptyText="Belum ada review dalam 24 jam terakhir."
        />

        <TimelineSection
          title="Fraud per Hari"
          subtitle="Jumlah keputusan fraud dalam 7 hari terakhir."
          icon="bi-exclamation-triangle-fill"
          color="#dc2626"
          items={data.fraud_per_day_7d}
          labelKey="day"
          valueKey="count"
          valueLabel="fraud"
          emptyText="Belum ada fraud terdeteksi dalam periode ini."
        />

        <QueueGrowthSection items={data.queue_growth_7d} />
      </div>
    </div>
  );
};

export default TabTimeline;
