import React, { useState, useEffect, useMemo, useRef } from 'react';
import './ReviewFilter.css';

const TXN_PER_PAGE = 10;

/* ═══════════════════════════════════════════════════════════════════════════
   INTERNAL: ColumnDropdown
═══════════════════════════════════════════════════════════════════════════ */
const ColumnDropdown = ({ options, value, onChange, onClose, anchorRef }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose, anchorRef]);

  return (
    <div className="rf-col-dropdown" ref={ref}>
      {options.map(opt => (
        <button
          key={opt.value}
          className={`rf-col-option ${value === opt.value ? 'active' : ''}`}
          onClick={() => { onChange(opt.value); onClose(); }}
        >
          <i className={`bi ${opt.icon}`}></i>
          <span>{opt.label}</span>
          {value === opt.value && <i className="bi bi-check2 rf-col-check"></i>}
        </button>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   INTERNAL: ColHeader — sortable + filterable <th>
═══════════════════════════════════════════════════════════════════════════ */
export const ColHeader = ({
  label, colKey, sortKey, sortDir, onSort,
  filterOptions, filterValue, onFilterChange, className,
}) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const isActive  = sortKey === colKey;
  const hasFilter = filterOptions && filterValue != null && filterValue !== 'all';

  return (
    <th className={`rf-th-sortable ${className || ''} ${isActive ? 'rf-th-sorted' : ''}`}>
      <div className="rf-th-inner">
        <span className="rf-th-label" onClick={() => onSort(colKey)}>
          {label}
          <span className="rf-sort-icons">
            {isActive
              ? <i className={`bi ${sortDir === 'asc' ? 'bi-sort-up-alt' : 'bi-sort-down-alt'} rf-sort-active`}></i>
              : <i className="bi bi-arrow-down-up rf-sort-idle"></i>}
          </span>
        </span>
        {filterOptions && (
          <div className="rf-th-filter-wrap" ref={btnRef}>
            <button
              className={`rf-th-filter-btn ${open ? 'open' : ''} ${hasFilter ? 'has-filter' : ''}`}
              onClick={() => setOpen(v => !v)}
            >
              <i className={`bi ${hasFilter ? 'bi-funnel-fill' : 'bi-funnel'}`}></i>
            </button>
            {open && (
              <ColumnDropdown
                options={filterOptions}
                value={filterValue}
                onChange={onFilterChange}
                onClose={() => setOpen(false)}
                anchorRef={btnRef}
              />
            )}
          </div>
        )}
      </div>
    </th>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   INTERNAL: DatePickerModal
═══════════════════════════════════════════════════════════════════════════ */
const DatePickerModal = ({ value, onChange, onClose }) => {
  const [from, setFrom] = useState(value?.from || '');
  const [to,   setTo]   = useState(value?.to   || '');

  const apply = () => { onChange(from || to ? { from, to } : null); onClose(); };
  const clear = () => { onChange(null); onClose(); };

  return (
    <div className="rf-datepicker-overlay" onClick={onClose}>
      <div className="rf-datepicker-modal" onClick={e => e.stopPropagation()}>
        <div className="rf-datepicker-header">
          <i className="bi bi-calendar3"></i>
          <span>Filter by Date Range</span>
          <button className="rf-datepicker-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="rf-datepicker-body">
          <label>
            <span>From</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </label>
        </div>
        <div className="rf-datepicker-footer">
          <button className="rf-datepicker-clear" onClick={clear}>Clear</button>
          <button className="rf-datepicker-apply" onClick={apply}>Apply</button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT: ReviewFilter
   Props in  : transactions (raw array)
   Props out : children({ filtered, paginatedTxns, totalTxnPages, txnPage,
                          setTxnPage, tableHead, filterBar, datePickerPortal,
                          activeFilterCount, selectedAll, onSelectAll })
═══════════════════════════════════════════════════════════════════════════ */
const ReviewFilter = ({ transactions = [], children }) => {

  /* ── filter state ─────────────────────────────────────── */
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [searchTerm,    setSearchTerm]    = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [dateRange,     setDateRange]     = useState(null);
  const [showDatePicker,setShowDatePicker]= useState(false);

  /* ── sort state ───────────────────────────────────────── */
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('desc');

  /* ── pagination state ─────────────────────────────────── */
  const [txnPage, setTxnPage] = useState(1);

  /* reset page when filters change */
  useEffect(() => {
    setTxnPage(1);
  }, [filterStatus, searchTerm, serviceFilter, statusFilter, channelFilter, dateRange, sortKey, sortDir]);

  /* ── handlers ─────────────────────────────────────────── */
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setTxnPage(1);
  };

  const clearAllFilters = () => {
    setFilterStatus('all'); setSearchTerm('');
    setServiceFilter('all'); setStatusFilter('all');
    setChannelFilter('all'); setDateRange(null);
    setSortKey(''); setSortDir('desc');
    setTxnPage(1);
  };

  /* ── active filter count ──────────────────────────────── */
  const activeFilterCount = [
    filterStatus !== 'all',
    serviceFilter !== 'all',
    statusFilter !== 'all',
    channelFilter !== 'all',
    !!dateRange,
    !!searchTerm.trim(),
    !!sortKey,
  ].filter(Boolean).length;

  /* ── memoized filter + sort pipeline ─────────────────── */
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let arr = transactions
      .filter(t => filterStatus === 'all' || t.status === filterStatus)
      .filter(t => serviceFilter === 'all' || t.service === serviceFilter)
      .filter(t => statusFilter === 'all'  || t.status === statusFilter)
      .filter(t => {
        if (channelFilter === 'all') return true;
        if (t.service === 'agenusa') return false;
        return (t.CHANNEL || '').toLowerCase() === channelFilter.toLowerCase();
      })
      .filter(t => {
        if (!dateRange) return true;
        if (!t.dateTime) return false;
        const d = new Date(t.dateTime);
        if (dateRange.from && d < new Date(dateRange.from)) return false;
        if (dateRange.to) {
          const to = new Date(dateRange.to); to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
        return true;
      })
      .filter(t => {
        if (!q) return true;
        const svc = t.service === 'agenusa' ? 'agenusa' : 'nusabill';
        return (
          t.id.toLowerCase().includes(q) ||
          (t.accountId      || '').toLowerCase().includes(q) ||
          (t.destOrBill     || '').toLowerCase().includes(q) ||
          (t.typeOrChannel  || '').toLowerCase().includes(q) ||
          (t.dateTime       || '').toLowerCase().includes(q) ||
          svc.includes(q)
        );
      });

    if (sortKey) {
      arr = [...arr].sort((a, b) => {
        let av, bv;
        if (sortKey === 'amount')  { av = a.amount;     bv = b.amount; }
        if (sortKey === 'risk')    { av = a.fraudScore; bv = b.fraudScore; }
        if (sortKey === 'date')    {
          av = a.dateTime ? new Date(a.dateTime) : 0;
          bv = b.dateTime ? new Date(b.dateTime) : 0;
        }
        if (sortKey === 'channel') {
          av = (a.typeOrChannel || '').toLowerCase();
          bv = (b.typeOrChannel || '').toLowerCase();
        }
        if (sortKey === 'service') { av = a.service; bv = b.service; }
        if (sortKey === 'status')  { av = a.status;  bv = b.status;  }
        if (av < bv) return sortDir === 'asc' ? -1 :  1;
        if (av > bv) return sortDir === 'asc' ?  1 : -1;
        return 0;
      });
    }
    return arr;
  }, [transactions, filterStatus, serviceFilter, statusFilter, channelFilter, dateRange, searchTerm, sortKey, sortDir]);

  /* ── pagination ───────────────────────────────────────── */
  const totalTxnPages = Math.ceil(filtered.length / TXN_PER_PAGE);
  const paginatedTxns = filtered.slice((txnPage - 1) * TXN_PER_PAGE, txnPage * TXN_PER_PAGE);

  /* ── filter bar JSX ───────────────────────────────────── */
  const filterBar = (
    <div className="review-filter-container">
      {/* Status tabs */}
      <div className="filter-tabs">
        {[
          { value:'all',      label:'All',      icon:'bi-list-ul'           },
          { value:'pending',  label:'Pending',  icon:'bi-clock-history'     },
          { value:'approved', label:'Approved', icon:'bi-check-circle'      },
          { value:'rejected', label:'Rejected', icon:'bi-x-circle'          },
        ].map(f => (
          <button
            key={f.value}
            className={`filter-tab ${f.value} ${filterStatus === f.value ? 'active' : ''}`}
            onClick={() => setFilterStatus(f.value)}
          >
            <i className={`bi ${f.icon}`}></i>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="search-box">
        <i className="bi bi-search search-icon"></i>
        <input
          type="text"
          placeholder="Cari layanan, ID, account/customer, dest/bill ID, type/channel, tanggal…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>
            <i className="bi bi-x"></i>
          </button>
        )}
      </div>
    </div>
  );

  /* ── section header JSX (judul + clear + counter) ────── */
  const sectionHeader = (
    <div className="section-header">
      <span className="section-title">
        <i className="bi bi-table"></i>Flagged Transactions
      </span>
      <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
        {activeFilterCount > 0 && (
          <button className="rf-clear-all-btn" onClick={clearAllFilters}>
            <i className="bi bi-x-circle"></i>
            Clear filters ({activeFilterCount})
          </button>
        )}
        <span className="section-meta">{filtered.length} / {transactions.length} records</span>
      </div>
    </div>
  );

  /* ── table <thead> JSX ────────────────────────────────── */
  const tableHead = (
    <thead>
      <tr>
        {/* ① Layanan */}
        <ColHeader
          label="Layanan" colKey="service"
          sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
          filterOptions={[
            { value:'all',      label:'All Services', icon:'bi-grid-3x3-gap' },
            { value:'agenusa',  label:'AGENUSA',      icon:'bi-building'     },
            { value:'nusabill', label:'NUSABILL',     icon:'bi-receipt'      },
          ]}
          filterValue={serviceFilter}
          onFilterChange={v => { setServiceFilter(v); setTxnPage(1); }}
        />

        {/* ③ ID */}
        <th className="col-id">ID</th>

        {/* ④ Account / Customer */}
        <th>Account / Customer</th>

        {/* ⑤ Amount */}
        <ColHeader
          label="Amount" colKey="amount"
          sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
          filterOptions={[
            { value:'desc', label:'Terbesar (Highest)', icon:'bi-sort-numeric-down-alt' },
            { value:'asc',  label:'Terkecil (Lowest)',  icon:'bi-sort-numeric-up-alt'   },
          ]}
          filterValue={sortKey === 'amount' ? sortDir : null}
          onFilterChange={dir => { setSortKey('amount'); setSortDir(dir); setTxnPage(1); }}
        />

        {/* ⑥ Dest / Bill ID */}
        <th className="hide-sm">Dest / Bill ID</th>

        {/* ⑦ Type / Channel */}
        <ColHeader
          label="Type / Channel" colKey="channel"
          sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
          className="hide-sm"
          filterOptions={[
            { value:'all',    label:'All Channels', icon:'bi-broadcast'   },
            { value:'API',    label:'API',          icon:'bi-code-square' },
            { value:'Web',    label:'Web',          icon:'bi-globe'       },
            { value:'Mobile', label:'Mobile',       icon:'bi-phone'       },
          ]}
          filterValue={channelFilter}
          onFilterChange={v => { setChannelFilter(v); setTxnPage(1); }}
        />

        {/* ⑧ Date & Time — kalender picker */}
        <th className={`rf-th-sortable hide-sm ${sortKey === 'date' ? 'rf-th-sorted' : ''}`}>
          <div className="rf-th-inner">
            <span className="rf-th-label" onClick={() => handleSort('date')}>
              Date &amp; Time
              <span className="rf-sort-icons">
                {sortKey === 'date'
                  ? <i className={`bi ${sortDir === 'asc' ? 'bi-sort-up-alt' : 'bi-sort-down-alt'} rf-sort-active`}></i>
                  : <i className="bi bi-arrow-down-up rf-sort-idle"></i>}
              </span>
            </span>
            <div className="rf-th-filter-wrap">
              <button
                className={`rf-th-filter-btn ${dateRange ? 'has-filter' : ''}`}
                onClick={() => setShowDatePicker(true)}
                title="Filter by date range"
              >
                <i className={`bi ${dateRange ? 'bi-calendar-check-fill' : 'bi-calendar3'}`}></i>
              </button>
            </div>
          </div>
        </th>

        {/* ⑨ Patterns */}
        <th>Patterns</th>

        {/* ⑩ Risk */}
        <ColHeader
          label="Risk" colKey="risk"
          sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
          className="center col-risk"
          filterOptions={[
            { value:'desc', label:'Tertinggi (Highest)', icon:'bi-arrow-up-circle-fill'   },
            { value:'asc',  label:'Terendah (Lowest)',   icon:'bi-arrow-down-circle-fill' },
          ]}
          filterValue={sortKey === 'risk' ? sortDir : null}
          onFilterChange={dir => { setSortKey('risk'); setSortDir(dir); setTxnPage(1); }}
        />

        {/* ⑪ Status */}
        <ColHeader
          label="Status" colKey="status"
          sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
          filterOptions={[
            { value:'all',      label:'All Status',  icon:'bi-list-ul'            },
            { value:'pending',  label:'Pending',     icon:'bi-clock-history'      },
            { value:'approved', label:'Approved',    icon:'bi-check-circle-fill'  },
            { value:'rejected', label:'Rejected',    icon:'bi-x-circle-fill'      },
          ]}
          filterValue={statusFilter}
          onFilterChange={v => { setStatusFilter(v); setTxnPage(1); }}
        />

        {/* ⑫ Action */}
        <th className="col-action"></th>
      </tr>
    </thead>
  );

  /* ── date picker portal ───────────────────────────────── */
  const datePickerPortal = showDatePicker ? (
    <DatePickerModal
      value={dateRange}
      onChange={v => { setDateRange(v); setTxnPage(1); }}
      onClose={() => setShowDatePicker(false)}
    />
  ) : null;

  /* ── render children with all exposed values ──────────── */
  return children({
    filtered,
    paginatedTxns,
    totalTxnPages,
    txnPage,
    setTxnPage,
    filterBar,
    sectionHeader,
    tableHead,
    datePickerPortal,
    activeFilterCount,
    clearAllFilters,
  });
};

export default ReviewFilter;