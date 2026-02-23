import React from 'react';
import './RiskStats.css';

const RiskStats = ({ blacklist, rules }) => {
  const totalBlacklisted = blacklist.length;
  const activeRules      = rules.filter(r => r.enabled).length;
  const blockedToday     = blacklist.filter(b => b.hitCount > 0).length;
  const pendingReview    = blacklist.filter(b => b.status === 'pending').length;

  const stats = [
    {
      icon: 'bi-ban',
      colorClass: 'c-red',
      value: totalBlacklisted,
      label: 'Total Rekening Blacklist',
      trend: 'up',
      trendText: '+12 minggu ini',
    },
    {
      icon: 'bi-shield-exclamation',
      colorClass: 'c-amber',
      value: pendingReview,
      label: 'Menunggu Verifikasi',
      trend: 'flat',
      trendText: 'Perlu ditinjau',
    },
    {
      icon: 'bi-gear-fill',
      colorClass: 'c-blue',
      value: activeRules,
      label: 'Rule Aktif',
      trend: 'flat',
      trendText: `dari ${rules.length} total rule`,
    },
    {
      icon: 'bi-lightning-charge-fill',
      colorClass: 'c-green',
      value: blockedToday,
      label: 'Berhasil Diblokir',
      trend: 'down',
      trendText: 'Total hit tercatat',
    },
  ];

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
              <i className={`bi ${
                s.trend === 'up'   ? 'bi-arrow-up-short' :
                s.trend === 'down' ? 'bi-arrow-down-short' :
                                     'bi-dash'
              }`} />
              {s.trendText}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RiskStats;