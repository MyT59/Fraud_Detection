import React from 'react';
import './RuleEngine.css';

const ACTION_CONFIG = {
  block:  { label: 'BLOKIR',  cls: 'act-block',  icon: 'bi-ban',             condCls: 'cond-block'  },
  flag:   { label: 'FLAG',    cls: 'act-flag',   icon: 'bi-flag-fill',        condCls: 'cond-flag'   },
  review: { label: 'REVIEW',  cls: 'act-review', icon: 'bi-clipboard-check',  condCls: 'cond-review' },
};

const getPriorityCls = p => p <= 3 ? 'p-high' : p <= 6 ? 'p-med' : 'p-low';

const RuleEngine = ({ rules, onAdd, onEdit, onDelete, onToggle }) => (
  <div className="re-wrap">
    {/* Toolbar */}
    <div className="re-toolbar">
      <div className="re-toolbar-left">
        <span className="re-title">
          Rule Engine — Deteksi Berbasis Aturan
          <span style={{ color:'#9ca3af', fontWeight:400, marginLeft:6 }}>
            ({rules.filter(r=>r.enabled).length} aktif / {rules.length} total)
          </span>
        </span>
        <span className="re-subtitle">
          Transaksi yang cocok akan otomatis diblokir, diflag, atau dikirim ke Manual Review
        </span>
      </div>
      <div className="re-toolbar-right">
        <button className="re-btn primary" onClick={onAdd}>
          <i className="bi bi-plus-lg" /> Tambah Rule
        </button>
      </div>
    </div>

    {/* Table */}
    <div className="re-table-scroll">
      <table className="re-table">
        <thead>
          <tr>
            <th>P</th>
            <th>Nama Rule</th>
            <th>Kondisi</th>
            <th>Aksi</th>
            <th>Hit (30 hari)</th>
            <th>Dibuat</th>
            <th>Aktif</th>
            <th>Kelola</th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 ? (
            <tr><td colSpan={8}>
              <div className="re-empty">
                <i className="bi bi-gear" />
                <p>Belum ada rule. Tambah rule pertama kamu.</p>
              </div>
            </td></tr>
          ) : rules
            .sort((a, b) => a.priority - b.priority)
            .map(rule => {
              const act = ACTION_CONFIG[rule.action] || ACTION_CONFIG.flag;
              return (
                <tr key={rule.id} style={{ opacity: rule.enabled ? 1 : 0.5 }}>
                  <td>
                    <span className={`re-priority ${getPriorityCls(rule.priority)}`}>
                      {rule.priority}
                    </span>
                  </td>
                  <td>
                    <div className="re-rule-name">
                      <span className="re-name-text">{rule.name}</span>
                      <span className="re-name-desc">{rule.description}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`re-condition ${act.condCls}`}>
                      <i className={`bi ${act.icon}`} />
                      {rule.condition}
                    </span>
                  </td>
                  <td>
                    <span className={`re-action ${act.cls}`}>
                      <i className={`bi ${act.icon}`} />
                      {act.label}
                    </span>
                  </td>
                  <td>
                    <span className={`re-hit ${rule.hitCount === 0 ? 'zero' : ''}`}>
                      {rule.hitCount === 0 ? '—' : rule.hitCount.toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td style={{ fontSize:'.78rem', color:'#9ca3af', whiteSpace:'nowrap' }}>
                    {rule.createdAt}
                  </td>
                  <td>
                    <label className="re-toggle">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => onToggle(rule.id)}
                      />
                      <span className="re-toggle-track" />
                    </label>
                  </td>
                  <td>
                    <div className="re-actions">
                      <button className="re-action-btn edit" title="Edit rule" onClick={() => onEdit(rule)}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="re-action-btn del" title="Hapus rule" onClick={() => onDelete(rule.id)}>
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  </div>
);

export default RuleEngine;