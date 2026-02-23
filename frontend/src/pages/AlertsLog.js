import React, { useState, useMemo } from 'react';
import AlertsHeader from '../components/alerts/AlertsHeader';
import AlertsStats  from '../components/alerts/AlertsStats';
import AlertsFilter from '../components/alerts/AlertsFilter';
import AlertsFeed   from '../components/alerts/AlertsFeed';
import PageLoader   from '../components/common/PageLoader';
import { SEED_ALERTS } from '../components/alerts/alertsData';
import './AlertsLog.css';

const DEFAULT_FILTERS = {
  search:   '',
  type:     'all',
  severity: 'all',
  status:   'all',
};

const AlertsLog = () => {
  const [loading]               = useState(false);
  const [alerts, setAlerts]     = useState(SEED_ALERTS);
  const [filters, setFilters]   = useState(DEFAULT_FILTERS);

  /* ── filter logic ── */
  const filtered = useMemo(() => {
    return alerts.filter(a => {
      const matchSearch   = !filters.search   || a.title.toLowerCase().includes(filters.search.toLowerCase()) || a.message.toLowerCase().includes(filters.search.toLowerCase()) || (a.txnId && a.txnId.toLowerCase().includes(filters.search.toLowerCase()));
      const matchType     = filters.type     === 'all' || a.type     === filters.type;
      const matchSeverity = filters.severity === 'all' || a.severity === filters.severity;
      const matchStatus   = filters.status   === 'all' || a.status   === filters.status;
      return matchSearch && matchType && matchSeverity && matchStatus;
    });
  }, [alerts, filters]);

  /* ── handlers ── */
  const handleFilterChange = (partial) => setFilters(prev => ({ ...prev, ...partial }));
  const handleReset        = () => setFilters(DEFAULT_FILTERS);

  const handleMarkRead = (id) =>
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'read' } : a));

  const handleResolve = (id) =>
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' } : a));

  const handleDelete = (id) =>
    setAlerts(prev => prev.filter(a => a.id !== id));

  const handleMarkAllRead = () =>
    setAlerts(prev => prev.map(a => a.status === 'unread' ? { ...a, status: 'read' } : a));

  const handleClearAll = () => setAlerts([]);

  const totalUnread = alerts.filter(a => a.status === 'unread').length;

  if (loading) return <PageLoader message="Memuat Alerts Log..." />;

  return (
    <div className="alerts-page">
      <AlertsHeader
        totalUnread={totalUnread}
        onMarkAllRead={handleMarkAllRead}
        onClearAll={handleClearAll}
      />

      <AlertsStats alerts={alerts} />

      <AlertsFilter
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        totalResults={filtered.length}
      />

      <AlertsFeed
        alerts={filtered}
        onMarkRead={handleMarkRead}
        onResolve={handleResolve}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default AlertsLog;