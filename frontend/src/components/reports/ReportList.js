import React, { useState, useEffect } from 'react';

const ROWS_PER_PAGE_OPTIONS = [5, 10, 15, 25];

const ReportList = ({ 
  reports, 
  onViewReport, 
  onDeleteReport, 
  onDownloadReport, 
  selectedReportId,
  onToggleSelect,
  selectedReports 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset to page 1 whenever the reports list changes (filter, delete, etc.)
  useEffect(() => {
    setCurrentPage(1);
  }, [reports.length]);

  const totalPages  = Math.max(1, Math.ceil(reports.length / rowsPerPage));
  const startIndex  = (currentPage - 1) * rowsPerPage;
  const endIndex    = Math.min(startIndex + rowsPerPage, reports.length);
  const pageReports = reports.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  /* Build visible page numbers with ellipsis */
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    const rangeStart = Math.max(2, currentPage - 1);
    const rangeEnd   = Math.min(totalPages - 1, currentPage + 1);
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Completed':  { class: 'bg-success',           icon: 'check-circle-fill' },
      'Processing': { class: 'bg-warning text-dark',  icon: 'hourglass-split'  },
      'Failed':     { class: 'bg-danger',             icon: 'x-circle-fill'    }
    };
    const config = statusConfig[status] || statusConfig['Completed'];
    return (
      <span className={`badge ${config.class}`}>
        <i className={`bi bi-${config.icon} me-1`}></i>
        {status}
      </span>
    );
  };

  const getFormatIcon = (format) => {
    const icons = {
      'PDF':   'file-pdf-fill text-danger',
      'Excel': 'file-excel-fill text-success',
      'CSV':   'file-text-fill text-primary'
    };
    return icons[format] || 'file-earmark';
  };

  const handleCheckboxClick = (e, reportId) => {
    e.stopPropagation();
    onToggleSelect?.(reportId);
  };

  /* Select-all scoped to current page */
  const allPageSelected =
    pageReports.length > 0 &&
    pageReports.every(r => selectedReports?.includes(r.id));

  const handleSelectAllPage = (e) => {
    pageReports.forEach(r => {
      const isSelected = selectedReports?.includes(r.id);
      if (e.target.checked && !isSelected) onToggleSelect?.(r.id);
      if (!e.target.checked && isSelected)  onToggleSelect?.(r.id);
    });
  };

  if (reports.length === 0) {
    return (
      <div className="empty-state py-5 text-center">
        <i className="bi bi-inbox" style={{ fontSize: '3rem', color: '#d4d4d4' }}></i>
        <h5 className="mt-3">No Reports Found</h5>
        <p className="text-muted">Generate your first report to get started</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Table ── */}
      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr>
              {onToggleSelect && (
                <th className="col-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    onChange={handleSelectAllPage}
                    checked={allPageSelected}
                    title="Select all on this page"
                  />
                </th>
              )}
              <th>Report</th>
              <th className="col-format">Format</th>
              <th className="col-date">Generated</th>
              <th className="col-status">Status</th>
              <th className="col-size">Size</th>
              <th className="col-by">By</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageReports.map(report => (
              <tr
                key={report.id}
                className={`report-row
                  ${selectedReportId === report.id ? 'active' : ''}
                  ${selectedReports?.includes(report.id) ? 'selected' : ''}`}
                onClick={() => onViewReport(report)}
              >
                {/* Checkbox */}
                {onToggleSelect && (
                  <td className="col-check" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={selectedReports?.includes(report.id) || false}
                      onChange={(e) => handleCheckboxClick(e, report.id)}
                    />
                  </td>
                )}

                {/* Report name + ID */}
                <td>
                  <div className="report-name-cell">
                    <span className="report-format-icon">
                      <i className={`bi bi-${getFormatIcon(report.format)}`}></i>
                    </span>
                    <div>
                      <div className="report-type-name">{report.type}</div>
                      <div className="report-id-tag">{report.id}</div>
                    </div>
                  </div>
                </td>

                {/* Format */}
                <td className="col-format">
                  <span className="format-pill">{report.format}</span>
                </td>

                {/* Date */}
                <td className="col-date">
                  <span className="date-text">{formatDate(report.generatedDate)}</span>
                </td>

                {/* Status */}
                <td className="col-status">
                  {report.status === 'Processing' ? (
                    <span className="badge bg-warning text-dark">
                      <span
                        className="spinner-border spinner-border-sm me-1"
                        style={{ width: '9px', height: '9px' }}
                        role="status"
                      ></span>
                      Processing
                    </span>
                  ) : (
                    getStatusBadge(report.status)
                  )}
                </td>

                {/* Size */}
                <td className="col-size">
                  <span className="size-text">{report.size}</span>
                </td>

                {/* By */}
                <td className="col-by">
                  <span className="by-text">
                    <i className="bi bi-person-fill me-1"></i>
                    {report.generatedBy}
                  </span>
                </td>

                {/* Actions */}
                <td className="col-actions" onClick={e => e.stopPropagation()}>
                  <div className="row-actions">
                    <button
                      className="action-btn action-btn-preview"
                      onClick={() => onViewReport(report)}
                      title="Preview"
                    >
                      <i className="bi bi-eye"></i>
                    </button>
                    {report.status === 'Completed' && (
                      <>
                        <button
                          className="action-btn action-btn-download"
                          onClick={() => onDownloadReport(report)}
                          title="Download"
                        >
                          <i className="bi bi-download"></i>
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => {
                            if (window.confirm(`Delete report ${report.id}?`)) {
                              onDeleteReport(report.id);
                            }
                          }}
                          title="Delete"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination Bar ── */}
      <div className="pagination-bar">
        {/* Left: showing range + rows-per-page */}
        <div className="pagination-info">
          <span className="pagination-range">
            Showing <strong>{reports.length === 0 ? 0 : startIndex + 1}–{endIndex}</strong> of{' '}
            <strong>{reports.length}</strong> reports
          </span>
          <div className="rows-per-page">
            <span>Rows:</span>
            <select
              className="rows-select"
              value={rowsPerPage}
              onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            >
              {ROWS_PER_PAGE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: page controls */}
        <div className="pagination-controls">
          <button
            className="page-btn page-btn-nav"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            title="First page"
          >
            <i className="bi bi-chevron-double-left"></i>
          </button>
          <button
            className="page-btn page-btn-nav"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            title="Previous page"
          >
            <i className="bi bi-chevron-left"></i>
          </button>

          <div className="page-numbers">
            {getPageNumbers().map((item, idx) =>
              item === '...' ? (
                <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
              ) : (
                <button
                  key={item}
                  className={`page-btn ${currentPage === item ? 'page-btn-active' : ''}`}
                  onClick={() => goToPage(item)}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <button
            className="page-btn page-btn-nav"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Next page"
          >
            <i className="bi bi-chevron-right"></i>
          </button>
          <button
            className="page-btn page-btn-nav"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last page"
          >
            <i className="bi bi-chevron-double-right"></i>
          </button>
        </div>
      </div>
    </>
  );
};

export default ReportList;