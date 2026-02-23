import React, { useState, useMemo } from 'react';
import './BlacklistPanel.css';

const PAGE_SIZE = 8;

const SOURCE_CONFIG = {

  manual:  { label: 'Input Manual',   cls: 'src-manual',  icon: 'bi-person-fill' },
  system:  { label: 'Auto-Detect',    cls: 'src-system',  icon: 'bi-cpu-fill'    },
  import:  { label: 'Bulk Import',    cls: 'src-import',  icon: 'bi-upload'      },
};

const STATUS_CONFIG = {
  active:   { label: 'Aktif Blokir', cls: 'st-active'   },
  pending:  { label: 'Pending',      cls: 'st-pending'  },
  inactive: { label: 'Nonaktif',     cls: 'st-inactive' },
};

const BlacklistPanel = ({ data, onAdd, onBulkImport, onDelete, onApprove }) => {
  const [search, setSearch]   = useState('');
  const [filterSrc, setFilterSrc] = useState('all');
  const [filterSt, setFilterSt]   = useState('all');
  const [page, setPage]       = useState(1);

  const filtered = useMemo(() => data.filter(item => {
    const q = search.toLowerCase();
    const matchQ = !q || item.accountNumber.includes(q) || item.accountName.toLowerCase().includes(q) || item.bank.toLowerCase().includes(q);
    const matchSrc = filterSrc === 'all' || item.source === filterSrc;
    const matchSt  = filterSt  === 'all' || item.status === filterSt;
    return matchQ && matchSrc && matchSt;
  }), [data, search, filterSrc, filterSt]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const rows       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  return (
    <div className="blp-wrap">
      {/* Toolbar */}
      <div className="blp-toolbar">
        <div className="blp-toolbar-left">
          <span className="blp-title">
            Blacklist Management
            <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>
              ({filtered.length} rekening)
            </span>
          </span>
          <span className="blp-subtitle">
            Rekening terblokir — setiap percobaan transaksi akan otomatis ditolak
          </span>
        </div>
        <div className="blp-toolbar-right">
          <div className="blp-search">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Cari nomor / nama / bank..."
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage(); }}
            />
          </div>
          <select className="blp-select" value={filterSrc} onChange={e => { setFilterSrc(e.target.value); resetPage(); }}>
            <option value="all">Semua Sumber</option>
            <option value="manual">Input Manual</option>
            <option value="import">Bulk Import</option>
            <option value="system">Auto-Detect</option>
          </select>
          <select className="blp-select" value={filterSt} onChange={e => { setFilterSt(e.target.value); resetPage(); }}>
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="pending">Pending</option>
            <option value="inactive">Nonaktif</option>
          </select>
          <button className="blp-btn secondary" onClick={onBulkImport}>
            <i className="bi bi-upload" /> Bulk Import
          </button>
          <button className="blp-btn primary" onClick={onAdd}>
            <i className="bi bi-plus-lg" /> Tambah
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="blp-table-scroll">
        <table className="blp-table">
          <thead>
            <tr>
              <th>No. Rekening</th>
              <th>Bank</th>
              <th>Alasan</th>
              <th>Sumber</th>
              <th>Status</th>
              <th>Hit</th>
              <th>Ditambahkan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="blp-empty">
                    <i className="bi bi-shield-slash" />
                    <p>Tidak ada data blacklist ditemukan.</p>
                  </div>
                </td>
              </tr>
            ) : rows.map(item => {
              const src = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.manual;
              const st  = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
              return (
                <tr key={item.id}>
                  <td>
                    <div className="blp-acct">
                      <span className="blp-acct-num">{item.accountNumber}</span>
                      <span className="blp-acct-name">{item.accountName}</span>
                    </div>
                  </td>
                  <td><span className="blp-bank">{item.bank}</span></td>
                  <td style={{ maxWidth: 180, fontSize: '0.8rem', color: '#6b7280' }}>
                    {item.reason}
                  </td>
                  <td>
                    <span className={`blp-source ${src.cls}`}>
                      <i className={`bi ${src.icon}`} /> {src.label}
                    </span>
                  </td>
                  <td><span className={`blp-status ${st.cls}`}>{st.label}</span></td>
                  <td>
                    <span className={`blp-hit ${item.hitCount === 0 ? 'zero' : ''}`}>
                      {item.hitCount === 0 ? '—' : item.hitCount}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    {item.addedAt}
                  </td>
                  <td>
                    <div className="blp-actions">
                      {item.status === 'pending' && (
                        <button className="blp-action-btn approve" title="Setujui & Aktifkan" onClick={() => onApprove(item.id)}>
                          <i className="bi bi-check-lg" />
                        </button>
                      )}
                      <button className="blp-action-btn del" title="Hapus dari blacklist" onClick={() => onDelete(item.id)}>
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

      {/* Pagination */}
      <div className="blp-pagination">
        <span>
          {filtered.length === 0 ? 'Tidak ada data' :
            `${Math.min((safePage-1)*PAGE_SIZE+1, filtered.length)}–${Math.min(safePage*PAGE_SIZE, filtered.length)} dari ${filtered.length}`}
        </span>
        <div className="blp-pg-btns">
          <button className="blp-pg-btn" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>
            <i className="bi bi-chevron-left" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx-1] > 1) acc.push('…');
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) => p === '…'
              ? <span key={`e${idx}`} style={{ padding: '0 3px', color: '#9ca3af', fontSize: '0.75rem' }}>…</span>
              : <button key={p} className={`blp-pg-btn ${safePage === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            )}
          <button className="blp-pg-btn" disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlacklistPanel;