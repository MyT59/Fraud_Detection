import React from "react";
import "./PatternStats.css";

const PatternStats = ({ patterns, totalFlagged = 0 }) => {
  const total = patterns.reduce((s, p) => s + p.occurrences, 0);
  const highRisk = patterns
    .filter((p) => p.riskLevel === "high")
    .reduce((s, p) => s + p.occurrences, 0);
  const active = patterns.filter((p) => p.status === "active").length;
  const avgAccuracy = (
    patterns.reduce((s, p) => s + p.accuracy, 0) / patterns.length
  ).toFixed(1);

  // `highRisk` dan `total` sama-sama menghitung pattern matches. Menggunakan
  // jumlah transaksi sebagai penyebut akan salah karena satu transaksi bisa
  // cocok dengan lebih dari satu pattern dan menghasilkan persentase >100%.
  const highRiskBase = total;
  const highRiskPct =
    highRiskBase > 0 ? ((highRisk / highRiskBase) * 100).toFixed(1) : "0.0";

  const cards = [
    {
      id: 1,
      label: "Total Pattern Matches",
      value: total.toLocaleString(),
      icon: "bi-shield-exclamation",
      color: "purple",
      sub:
        totalFlagged > 0
          ? `pada ${totalFlagged.toLocaleString()} transaksi yang cocok pattern`
          : "All-time pattern matches",
    },
    {
      id: 2,
      label: "High-Risk Pattern Matches",
      value: highRisk.toLocaleString(),
      icon: "bi-exclamation-triangle-fill",
      color: "danger",
      sub: `${highRiskPct}% dari total pattern matches`,
    },
    {
      id: 3,
      label: "Active Patterns",
      value: active,
      icon: "bi-activity",
      color: "success",
      sub: `${patterns.length} patterns total`,
    },
    {
      id: 4,
      label: "Avg. Precision",
      value: `${avgAccuracy}%`,
      icon: "bi-bullseye",
      color: "info",
      sub: "Ketepatan deteksi yang telah direview",
    },
  ];

  return (
    <div className="fp-stats-grid">
      {cards.map((card) => (
        <div key={card.id} className={`fp-stat-card fp-stat-${card.color}`}>
          <div className={`fp-stat-icon bg-${card.color}`}>
            <i className={`bi ${card.icon}`}></i>
          </div>
          <div className="fp-stat-body">
            <span className="fp-stat-label">{card.label}</span>
            <span className="fp-stat-value">{card.value}</span>
            <span className="fp-stat-sub">{card.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PatternStats;
