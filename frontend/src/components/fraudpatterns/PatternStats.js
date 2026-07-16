import React from "react";
import "./PatternStats.css";

// [FIX] Menerima prop totalFlagged dari BE (/patterns/stats -> total_flagged_transactions)
// untuk perhitungan persentase High Risk Events yang lebih akurat,
// alih-alih membagi dengan total occurrences hasil agregasi lokal.
const PatternStats = ({ patterns, totalFlagged = 0 }) => {
  const total = patterns.reduce((s, p) => s + p.occurrences, 0);
  const highRisk = patterns
    .filter((p) => p.riskLevel === "high")
    .reduce((s, p) => s + p.occurrences, 0);
  const active = patterns.filter((p) => p.status === "active").length;
  const avgAccuracy = (
    patterns.reduce((s, p) => s + p.accuracy, 0) / patterns.length
  ).toFixed(1);

  // Gunakan total_flagged_transactions dari BE jika tersedia (lebih akurat
  // karena merepresentasikan basis transaksi nyata, bukan sekadar
  // jumlah occurrences pattern yang bisa overlap).
  const highRiskBase = totalFlagged > 0 ? totalFlagged : total;
  const highRiskPct =
    highRiskBase > 0 ? ((highRisk / highRiskBase) * 100).toFixed(1) : "0.0";

  const cards = [
    {
      id: 1,
      label: "Total Detections",
      value: total.toLocaleString(),
      icon: "bi-shield-exclamation",
      color: "purple",
      sub:
        totalFlagged > 0
          ? `dari ${totalFlagged.toLocaleString()} transaksi flagged`
          : "All-time pattern matches",
    },
    {
      id: 2,
      label: "Flagged Events",
      value: highRisk.toLocaleString(),
      icon: "bi-exclamation-triangle-fill",
      color: "danger",
      sub: `${highRiskPct}% dari ${
        totalFlagged > 0 ? "transaksi flagged" : "total deteksi"
      }`,
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
      label: "Avg. Accuracy",
      value: `${avgAccuracy}%`,
      icon: "bi-bullseye",
      color: "info",
      sub: "Detection model accuracy",
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
