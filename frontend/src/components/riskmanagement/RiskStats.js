import React from "react";
import "./RiskStats.css";

const RiskStats = ({
  blacklist = [],
  rules = [],
  patterns = [],
  activeTab = "blacklist",
}) => {
  const blTotal = blacklist.length;
  const blPending = blacklist.filter((b) => b.status === "pending").length;
  const blActive = blacklist.filter(
    (b) => b.status === "active" || b.is_active,
  ).length;
  const blTotalHits = blacklist.reduce((sum, b) => sum + (b.hitCount || 0), 0);

  const rlTotal = rules.length;
  const rlActive = rules.filter((r) => r.enabled).length;
  const rlBlock = rules.filter((r) => r.action === "block").length;
  const rlReview = rules.filter((r) => r.action === "review").length;

  const ptTotal = patterns.length;
  const ptActive = patterns.filter((p) => p.is_active).length;
  const ptCandidates = patterns.filter((p) => !p.is_active).length;
  const ptBlock = patterns.filter(
    (p) => p.is_active && p.action === "BLOCK",
  ).length;

  const blacklistStats = [
    {
      icon: "bi-ban",
      colorClass: "c-red",
      value: blTotal,
      label: "Total Blacklist",
      trend: "flat",
      trendText: "Semua entri terdaftar",
    },
    {
      icon: "bi-hourglass-split",
      colorClass: "c-amber",
      value: blPending,
      label: "Menunggu Verifikasi",
      trend: blPending > 0 ? "up" : "flat",
      trendText: blPending > 0 ? "Perlu ditinjau" : "Semua sudah ditinjau",
    },
    {
      icon: "bi-shield-fill-check",
      colorClass: "c-blue",
      value: blActive,
      label: "Aktif Diblokir",
      trend: "flat",
      trendText: `dari ${blTotal} total entri`,
    },
    {
      icon: "bi-lightning-charge-fill",
      colorClass: "c-green",
      value: blTotalHits,
      label: "Total Hit",
      trend: blTotalHits > 0 ? "down" : "flat",
      trendText: "Transaksi berhasil diblokir",
    },
  ];

  const rulesStats = [
    {
      icon: "bi-journal-code",
      colorClass: "c-blue",
      value: rlTotal,
      label: "Total Rules",
      trend: "flat",
      trendText: "Semua rule terdaftar",
    },
    {
      icon: "bi-toggle-on",
      colorClass: "c-green",
      value: rlActive,
      label: "Rule Aktif",
      trend: "flat",
      trendText: `dari ${rlTotal} total rule`,
    },
    {
      icon: "bi-ban",
      colorClass: "c-red",
      value: rlBlock,
      label: "Rule BLOCK",
      trend: "flat",
      trendText: "Tolak transaksi otomatis",
    },
    {
      icon: "bi-eye-fill",
      colorClass: "c-amber",
      value: rlReview,
      label: "Rule REVIEW",
      trend: "flat",
      trendText: "Kirim ke Manual Review",
    },
  ];

  const patternStats = [
    {
      icon: "bi-shield-shaded",
      colorClass: "c-red",
      value: ptTotal,
      label: "Total Pattern",
      trend: "flat",
      trendText: "Aktif + kandidat",
    },
    {
      icon: "bi-shield-fill-check",
      colorClass: "c-green",
      value: ptActive,
      label: "Pattern Aktif",
      trend: "flat",
      trendText: "Dievaluasi engine",
    },
    {
      icon: "bi-hourglass-split",
      colorClass: "c-amber",
      value: ptCandidates,
      label: "Kandidat",
      trend: ptCandidates > 0 ? "up" : "flat",
      trendText: ptCandidates > 0 ? "Menunggu aktivasi" : "Tidak ada kandidat",
    },
    {
      icon: "bi-ban",
      colorClass: "c-blue",
      value: ptBlock,
      label: "Pattern BLOCK",
      trend: "flat",
      trendText: "Auto-promote tertinggi",
    },
  ];

  const stats =
    activeTab === "rules"
      ? rulesStats
      : activeTab === "patterns"
        ? patternStats
        : blacklistStats;

  return (
    <div className="rms-grid">
      {stats.map((s, i) => (
        <div className="rms-card" key={i}>
          <div className={`rms-icon ${s.colorClass}`}>
            <i className={`bi ${s.icon}`} />
          </div>
          <div className="rms-info">
            <span className="rms-value">{s.value}</span>
            <span className="rms-label">{s.label}</span>
            <span className={`rms-trend ${s.trend}`}>
              <i
                className={`bi ${s.trend === "up" ? "bi-arrow-up-short" : s.trend === "down" ? "bi-arrow-down-short" : "bi-dash"}`}
              />
              {s.trendText}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RiskStats;
