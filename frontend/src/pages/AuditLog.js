import React, { useState, useEffect, useMemo } from 'react';
import ActivityStats  from '../components/auditlog/ActivityStats';
import ActivityFilters from '../components/auditlog/ActivityFilters';
import ActivityFeed   from '../components/auditlog/ActivityFeed';
import './AuditLog.css';
import PageLoader from '../components/common/PageLoader';

/* ── Seed data (bisa diganti fetch dari API) ── */
const SEED_LOGS = [
  { type: 'create',  desc: <><strong>Super Admin</strong> membuat akun untuk <strong>Hani Puspita</strong> (Fraud Analyst)</>,       time: '10 Feb 2024' },
  { type: 'edit',    desc: <><strong>Super Admin</strong> mengubah role <strong>Rizky Pratama</strong> menjadi <strong>Admin</strong></>, time: '08 Feb 2024' },
  { type: 'suspend', desc: <><strong>Super Admin</strong> men-suspend akun <strong>Lina Kusuma</strong></>,                          time: '05 Feb 2024' },
  { type: 'create',  desc: <><strong>Super Admin</strong> membuat akun untuk <strong>Dian Permata</strong> (CS / Investigator)</>,   time: '01 Feb 2024' },
  { type: 'edit',    desc: <><strong>Super Admin</strong> memperbarui departemen <strong>Fajar Nugroho</strong> ke Compliance</>,     time: '30 Jan 2024' },
  { type: 'delete',  desc: <><strong>Super Admin</strong> menghapus akun <strong>Toni Hidayat</strong></>,                          time: '28 Jan 2024' },
  { type: 'create',  desc: <><strong>Super Admin</strong> membuat akun untuk <strong>Fajar Nugroho</strong> (Fraud Analyst)</>,      time: '05 Feb 2024' },
  { type: 'edit',    desc: <><strong>Super Admin</strong> mereset password <strong>Budi Santoso</strong></>,                        time: '25 Jan 2024' },
  { type: 'suspend', desc: <><strong>Super Admin</strong> men-suspend akun <strong>Maya Indah</strong> sementara</>,                time: '22 Jan 2024' },
  { type: 'create',  desc: <><strong>Super Admin</strong> membuat akun untuk <strong>Irwan Setiawan</strong> (IT Security Admin)</>, time: '15 Feb 2024' },
  { type: 'edit',    desc: <><strong>Super Admin</strong> mengaktifkan kembali akun <strong>Maya Indah</strong></>,                 time: '20 Jan 2024' },
  { type: 'delete',  desc: <><strong>Super Admin</strong> menghapus akun <strong>Ahmad Kurniawan</strong></>,                      time: '18 Jan 2024' },
];

/* Helper: stringify JSX desc untuk search */
const descToText = (desc) => {
  if (typeof desc === 'string') return desc.toLowerCase();
  if (!desc?.props?.children) return '';
  const flatten = (children) => {
    if (!children) return '';
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) return children.map(flatten).join('');
    if (children?.props?.children) return flatten(children.props.children);
    return '';
  };
  return flatten(desc.props.children).toLowerCase();
};

const AuditLog = ({ externalLogs }) => {
  const [loading, setLoading] = useState(true);

  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  /* gabungkan seed + log dari luar (e.g. dari SuperAdmin via props/context) */
  const allLogs = useMemo(() => {
    const base = externalLogs ? [...externalLogs, ...SEED_LOGS] : SEED_LOGS;
    return base;
  }, [externalLogs]);

  const filtered = useMemo(() => {
    return allLogs.filter(log => {
      const matchType   = typeFilter === 'all' || log.type === typeFilter;
      const matchSearch = !search || descToText(log.desc).includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [allLogs, search, typeFilter]);

  const handleReset = () => {
    setSearch('');
    setTypeFilter('all');
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <PageLoader message="Memuat Audit Log..." />;

  return (
    <div className="auditlog-page">
      {/* Header */}
      <div className="al-header">
        <div className="al-header-left">
          <div className="al-header-icon">
            <i className="bi bi-clock-history"></i>
          </div>
          <div>
            <h1 className="al-title">Audit Log</h1>
            <p className="al-subtitle">Riwayat seluruh aktivitas dan perubahan sistem</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <ActivityStats logs={allLogs} />

      {/* Filters */}
      <ActivityFilters
        search={search}
        onSearch={setSearch}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        onReset={handleReset}
      />

      {/* Feed */}
      <div className="al-card">
        <div className="al-card-header">
          <h2 className="al-card-title">
            <i className="bi bi-list-ul"></i>
            Log Aktivitas
            <span className="al-count">({filtered.length} entri)</span>
          </h2>
        </div>
        <ActivityFeed logs={filtered} />
      </div>
    </div>
  );
};

export default AuditLog;