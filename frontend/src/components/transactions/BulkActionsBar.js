import React from "react";
import "./BulkActionsBar.css";

const BulkActionsBar = ({
  selectedCount,
  onApprove,
  onReject,
  onFlag,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="bulk-actions-bar">
      <div className="container-fluid">
        <div className="d-flex align-items-center justify-content-between">
          <div className="selection-info">
            <i className="bi bi-check-square me-2"></i>
            <span className="fw-bold">{selectedCount}</span> transaksi terpilih
          </div>

          <div className="action-buttons d-flex gap-2">
            <button
              className="btn btn-sm btn-success"
              onClick={onApprove}
              title="Approve selected transactions"
            >
              <i className="bi bi-check-circle me-1"></i>
              Approve
            </button>

            <button
              className="btn btn-sm btn-danger"
              onClick={onReject}
              title="Reject selected transactions"
            >
              <i className="bi bi-x-octagon me-1"></i>
              Reject
            </button>

            <button
              className="btn btn-sm btn-warning"
              onClick={onFlag}
              title="Flag for review"
            >
              <i className="bi bi-flag me-1"></i>
              Flag
            </button>

            <div className="vr"></div>

            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={onClearSelection}
              title="Clear selection"
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

export default BulkActionsBar;
