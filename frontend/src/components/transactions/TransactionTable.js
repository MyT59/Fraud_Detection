import React from 'react';

/* ─── Helpers ──────────────────────────────────────────── */
const fmt = (amount) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount);

const fmtDate = (ds) => {
  if (!ds) return '—';
  const d = new Date(ds);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/* ─── Risk helpers ─────────────────────────────────────── */
const getRiskMeta = (score) => {
  if (score >= 80) return { level: 'CRITICAL', color: '#dc2626' };
  if (score >= 60) return { level: 'HIGH',     color: '#ea580c' };
  if (score >= 40) return { level: 'MEDIUM',   color: '#d97706' };
  return              { level: 'LOW',      color: '#16a34a' };
};

/* ─── Pattern label shortener ──────────────────────────── */
const PATTERN_SHORT = {
  rapid_retry_declined:              'Rapid Retry',
  bruteforce_pin_pattern:            'Bruteforce PIN',
  money_mule_destination:            'Money Mule',
  impossible_travel_terminal_switch: 'Terminal Switch',
  midnight_unusual_amount:           'Midnight Amt',
  sudden_channel_switch_to_api:      'Ch. Switch API',
  burst_payment_pattern:             'Burst Payment',
  refund_abuse_pattern:              'Refund Abuse',
  payment_spike:                     'Spike',
  underpayment:                      'Underpayment',
};

/* ─── Sub-components ───────────────────────────────────── */
const ServiceBadge = ({ service }) => (
  <span className={`txn3-service-badge ${service}`}>
    {service === 'agenusa' ? 'AGENUSA' : 'NUSABILL'}
  </span>
);

const PatternsBadge = ({ patterns = [] }) => {
  if (!patterns.length) return <span className="txn3-empty">—</span>;
  return (
    <div className="txn3-patterns-wrap" title={patterns.map(p => PATTERN_SHORT[p] || p).join(', ')}>
      <span className="txn3-pattern-icon">
        <i className="bi bi-exclamation-triangle-fill"></i>
        {patterns.length}
      </span>
      <span className="txn3-pattern-first">
        {PATTERN_SHORT[patterns[0]] || patterns[0]}
        {patterns.length > 1 && <span className="txn3-pattern-more">+{patterns.length - 1}</span>}
      </span>
    </div>
  );
};

const RiskCell = ({ score }) => {
  const { level, color } = getRiskMeta(score);
  return (
    <span className="txn3-risk" style={{ color }}>
      <span className="txn3-risk-num">{score}</span>
      <span className="txn3-risk-max">/100</span>
      <span className="txn3-risk-lbl" style={{ color }}>{level}</span>
    </span>
  );
};

const StatusTag = ({ status }) => {
  const MAP = {
    pending:  { icon: 'bi-hourglass-split',        label: 'Pending',  cls: 'st-pending'  },
    approved: { icon: 'bi-check-circle-fill',       label: 'Approved', cls: 'st-approved' },
    rejected: { icon: 'bi-x-circle-fill',           label: 'Rejected', cls: 'st-rejected' },
    legit:    { icon: 'bi-check-circle-fill',       label: 'Legit',    cls: 'st-approved' },
    fraud:    { icon: 'bi-exclamation-circle-fill', label: 'Fraud',    cls: 'st-fraud'    },
  };
  const { icon, label, cls } = MAP[status] || MAP.pending;
  return (
    <span className={`txn3-status-tag ${cls}`}>
      <i className={`bi ${icon}`}></i>{label}
    </span>
  );
};

/* ─── Main component ───────────────────────────────────── */
const TransactionTable = ({
  transactions,
  onViewDetails,
}) => {
  return (
    <div className="txn3-wrapper">
      <table className="txn3-table">
        {/* ── HEAD ────────────────────────────────────────── */}
        <thead>
          <tr>
            <th>Layanan</th>
            <th>ID</th>
            <th>Account / Customer</th>
            <th>Amount</th>
            <th className="txn3-hide-md">Dest / Bill ID</th>
            <th className="txn3-hide-md">Type / Channel</th>
            <th className="txn3-hide-lg">Date &amp; Time</th>
            <th className="txn3-hide-md">Patterns</th>
            <th className="txn3-center">Risk</th>
            <th>Status</th>
            <th className="txn3-col-act"></th>
          </tr>
        </thead>

        {/* ── BODY ────────────────────────────────────────── */}
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={11}>
                <div className="txn3-empty-state">
                  <i className="bi bi-inbox"></i>
                  <p>Tidak ada transaksi ditemukan</p>
                  <span>Coba ubah filter atau kriteria pencarian</span>
                </div>
              </td>
            </tr>
          ) : (
            transactions.map((t) => (
              <tr key={t.id} onClick={() => onViewDetails(t)}>
                  {/* Layanan */}
                  <td><ServiceBadge service={t.service} /></td>

                  {/* ID */}
                  <td>
                    <span className="txn3-id">{t.transactionId}</span>
                  </td>

                  {/* Account / Customer */}
                  <td>
                    <span className="txn3-account">{t.accountId}</span>
                  </td>

                  {/* Amount */}
                  <td>
                    <div className="txn3-amount-cell">
                      <span className="txn3-amount">{fmt(t.amount)}</span>
                      {t.service === 'nusabill' && t.paymentAmount && t.paymentAmount !== t.amount && (
                        <span className="txn3-paid">Paid: {fmt(t.paymentAmount)}</span>
                      )}
                    </div>
                  </td>

                  {/* Dest / Bill ID */}
                  <td className="txn3-hide-md">
                    <span className="txn3-dest">{t.destId || '—'}</span>
                  </td>

                  {/* Type / Channel */}
                  <td className="txn3-hide-md">
                    <div className="txn3-type-cell">
                      <span className="txn3-type">{t.type || t.channel || '—'}</span>
                      {t.refundFlag && (
                        <span className="txn3-refund-tag">
                          <i className="bi bi-arrow-return-left"></i>Refund
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Date & Time */}
                  <td className="txn3-hide-lg">
                    <span className="txn3-date">{fmtDate(t.timestamp || t.time)}</span>
                  </td>

                  {/* Patterns */}
                  <td className="txn3-hide-md">
                    <PatternsBadge patterns={t.patterns || []} />
                  </td>

                  {/* Risk */}
                  <td className="txn3-center">
                    <RiskCell score={t.riskScore} />
                  </td>

                  {/* Status */}
                  <td>
                    <StatusTag status={t.status} />
                  </td>

                  {/* Detail button */}
                  <td className="txn3-col-act" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="txn3-btn-detail"
                      onClick={() => onViewDetails(t)}
                    >
                      <i className="bi bi-eye"></i>Detail
                    </button>
                  </td>
                </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionTable;