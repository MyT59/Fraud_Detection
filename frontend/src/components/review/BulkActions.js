import React, { useState } from 'react';
import './BulkActions.css';

const BulkActions = ({ selectedTransactions, onBulkAction, onClearSelection }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  // Fix #6: Add export format selection state
  const [selectedFormat, setSelectedFormat] = useState('');

  const handleAction = (actionType) => {
    setAction(actionType);
    setSelectedFormat('');
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    if (action === 'export' && !selectedFormat) {
      alert('Please select an export format first.');
      return;
    }
    onBulkAction(action, notes, selectedFormat);
    setShowConfirm(false);
    setAction('');
    setNotes('');
    setSelectedFormat('');
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setAction('');
    setNotes('');
    setSelectedFormat('');
  };

  if (selectedTransactions.length === 0) return null;

  return (
    <>
      <div className="bulk-actions-bar">
        <div className="selection-info">
          <div className="selection-icon">
            <i className="bi bi-check2-square"></i>
          </div>
          <div className="selection-details">
            <span className="selection-count">
              {selectedTransactions.length} transaction{selectedTransactions.length > 1 ? 's' : ''} selected
            </span>
            <button className="clear-selection-btn" onClick={onClearSelection}>
              <i className="bi bi-x"></i>
              Clear selection
            </button>
          </div>
        </div>

        <div className="bulk-action-buttons">
          <button
            className="bulk-btn approve"
            onClick={() => handleAction('approved')}
          >
            <i className="bi bi-check-circle-fill"></i>
            Approve All
          </button>
          <button
            className="bulk-btn reject"
            onClick={() => handleAction('rejected')}
          >
            <i className="bi bi-x-circle-fill"></i>
            Reject All
          </button>
          <button
            className="bulk-btn export"
            onClick={() => handleAction('export')}
          >
            <i className="bi bi-download"></i>
            Export
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="bulk-modal-overlay" onClick={handleCancel}>
          <div className="bulk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <i className={`bi bi-${action === 'approved' ? 'check-circle' : action === 'rejected' ? 'x-circle' : 'download'}`}></i>
                Confirm Bulk {action === 'approved' ? 'Approval' : action === 'rejected' ? 'Rejection' : 'Export'}
              </h3>
              <button className="modal-close" onClick={handleCancel}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-body">
              {action !== 'export' ? (
                <>
                  <div className="confirmation-message">
                    <div className={`message-icon ${action === 'approved' ? 'approve' : 'reject'}`}>
                      <i className="bi bi-exclamation-triangle-fill"></i>
                    </div>
                    <div className="message-content">
                      <h4>Are you sure?</h4>
                      <p>
                        You are about to {action === 'approved' ? 'approve' : 'reject'}{' '}
                        <strong>{selectedTransactions.length}</strong> transaction{selectedTransactions.length > 1 ? 's' : ''}.
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>

                  <div className="transactions-preview">
                    <h5 className="preview-title">Selected Transactions:</h5>
                    <div className="preview-list">
                      {selectedTransactions.slice(0, 5).map((txn) => (
                        <div key={txn.id} className="preview-item">
                          <span className="preview-id">{txn.id}</span>
                          <span className="preview-user">{txn.accountId}</span>
                          <span className="preview-amount">
                            {new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: 'IDR',
                              minimumFractionDigits: 0
                            }).format(txn.amount)}
                          </span>
                        </div>
                      ))}
                      {selectedTransactions.length > 5 && (
                        <div className="preview-more">
                          +{selectedTransactions.length - 5} more transactions
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="notes-section">
                    <label htmlFor="bulk-notes">Review Notes (Optional)</label>
                    <textarea
                      id="bulk-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add notes for all selected transactions..."
                      rows="3"
                    />
                  </div>
                </>
              ) : (
                /* Fix #6: Format buttons now have onClick and active state */
                <div className="export-options">
                  <h5>Select Export Format</h5>
                  <div className="format-options">
                    {[
                      { key: 'pdf', icon: 'bi-file-earmark-pdf', label: 'PDF Report' },
                      { key: 'xlsx', icon: 'bi-file-earmark-excel', label: 'Excel (XLSX)' },
                      { key: 'csv', icon: 'bi-filetype-csv', label: 'CSV File' }
                    ].map(fmt => (
                      <button
                        key={fmt.key}
                        className={`format-btn ${selectedFormat === fmt.key ? 'active' : ''}`}
                        onClick={() => setSelectedFormat(fmt.key)}
                      >
                        <i className={`bi ${fmt.icon}`}></i>
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                  {selectedFormat && (
                    <p className="format-selected-note">
                      <i className="bi bi-check-circle-fill"></i>
                      {selectedTransactions.length} transactions will be exported as <strong>{selectedFormat.toUpperCase()}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={handleCancel}>
                Cancel
              </button>
              <button
                className={`modal-btn confirm ${action === 'approved' ? 'approve' : action === 'rejected' ? 'reject' : 'export'}`}
                onClick={handleConfirm}
                disabled={action === 'export' && !selectedFormat}
              >
                {action === 'export'
                  ? `Export as ${selectedFormat ? selectedFormat.toUpperCase() : '...'}`
                  : `Confirm ${action === 'approved' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkActions;