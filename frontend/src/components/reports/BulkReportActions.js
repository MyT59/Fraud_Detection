import React, { useState } from 'react';
import './BulkReportActions.css';

const BulkReportActions = ({ selectedReports, onBulkDownload, onBulkDelete, onBulkShare, onClearSelection }) => {
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('zip');

  if (selectedReports.length === 0) return null;

  const handleBulkDownload = () => {
    onBulkDownload(selectedReports, downloadFormat);
    setShowDownloadOptions(false);
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedReports.length} selected reports? This action cannot be undone.`)) {
      onBulkDelete(selectedReports);
    }
  };

  const handleBulkShare = () => {
    onBulkShare(selectedReports);
  };

  return (
    <div className="bulk-actions-bar">
      <div className="container-fluid">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          {/* Selection Info */}
          <div className="selection-info">
            <div className="selection-icon">
              <i className="bi bi-check-square-fill"></i>
            </div>
            <div>
              <div className="selection-count">
                {selectedReports.length} Report{selectedReports.length > 1 ? 's' : ''} Selected
              </div>
              <small className="text-muted">
                {selectedReports.filter(r => r.status === 'Completed').length} completed, {' '}
                {selectedReports.filter(r => r.status === 'Processing').length} processing
              </small>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bulk-actions-buttons">
            {/* Download */}
            <div className="action-dropdown">
              <button
                className="btn btn-sm btn-success"
                onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                disabled={!selectedReports.some(r => r.status === 'Completed')}
              >
                <i className="bi bi-download me-1"></i>
                Download
                <i className={`bi bi-chevron-${showDownloadOptions ? 'up' : 'down'} ms-1`}></i>
              </button>

              {showDownloadOptions && (
                <div className="action-dropdown-menu">
                  <div className="dropdown-header">Download As</div>
                  <button
                    className={`dropdown-option ${downloadFormat === 'zip' ? 'active' : ''}`}
                    onClick={() => setDownloadFormat('zip')}
                  >
                    <i className="bi bi-file-zip"></i>
                    <div>
                      <div className="option-title">ZIP Archive</div>
                      <small>Download all reports in one ZIP file</small>
                    </div>
                    {downloadFormat === 'zip' && <i className="bi bi-check2"></i>}
                  </button>
                  <button
                    className={`dropdown-option ${downloadFormat === 'individual' ? 'active' : ''}`}
                    onClick={() => setDownloadFormat('individual')}
                  >
                    <i className="bi bi-files"></i>
                    <div>
                      <div className="option-title">Individual Files</div>
                      <small>Download each report separately</small>
                    </div>
                    {downloadFormat === 'individual' && <i className="bi bi-check2"></i>}
                  </button>
                  <div className="dropdown-footer">
                    <button
                      className="btn btn-sm btn-success w-100"
                      onClick={handleBulkDownload}
                    >
                      <i className="bi bi-download me-2"></i>
                      Download ({selectedReports.filter(r => r.status === 'Completed').length})
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Share */}
            <button
              className="btn btn-sm btn-primary"
              onClick={handleBulkShare}
              disabled={!selectedReports.some(r => r.status === 'Completed')}
            >
              <i className="bi bi-share me-1"></i>
              Share
            </button>

            {/* Delete */}
            <button
              className="btn btn-sm btn-danger"
              onClick={handleBulkDelete}
            >
              <i className="bi bi-trash me-1"></i>
              Delete
            </button>

            <div className="vr"></div>

            {/* Clear Selection */}
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={onClearSelection}
            >
              <i className="bi bi-x-circle me-1"></i>
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkReportActions;