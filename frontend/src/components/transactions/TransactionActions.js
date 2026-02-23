import React, { useState } from 'react';
import './TransactionActions.css';

const TransactionActions = ({ transaction, onViewDetails, onApprove, onReject, onFlag }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  const handleAction = (action, e) => {
    e.stopPropagation();
    setShowDropdown(false);
    action(transaction);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.transaction-actions')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  return (
    <div className="transaction-actions">
      {/* View Details Button - Always Visible */}
      <button
        className="btn btn-sm btn-outline-primary action-btn"
        onClick={(e) => handleAction(onViewDetails, e)}
        title="View Details"
      >
        <i className="bi bi-eye"></i>
      </button>

      {/* More Actions Dropdown */}
      <div className="dropdown-container">
        <button
          className="btn btn-sm btn-outline-secondary action-btn"
          onClick={toggleDropdown}
          title="More Actions"
        >
          <i className="bi bi-three-dots-vertical"></i>
        </button>

        {showDropdown && (
          <div className="actions-dropdown">
            <button 
              className="dropdown-action-item text-success"
              onClick={(e) => handleAction(onApprove, e)}
            >
              <i className="bi bi-check-circle me-2"></i>
              Approve
            </button>
            
            <button 
              className="dropdown-action-item text-danger"
              onClick={(e) => handleAction(onReject, e)}
            >
              <i className="bi bi-x-octagon me-2"></i>
              Reject
            </button>
            
            <button 
              className="dropdown-action-item text-warning"
              onClick={(e) => handleAction(onFlag, e)}
            >
              <i className="bi bi-flag me-2"></i>
              Flag for Review
            </button>

            <div className="dropdown-divider"></div>

            <button 
              className="dropdown-action-item"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(false);
                alert('Add note functionality - Coming soon!');
              }}
            >
              <i className="bi bi-pencil-square me-2"></i>
              Add Note
            </button>

            <button 
              className="dropdown-action-item"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(false);
                alert('Export single transaction - Coming soon!');
              }}
            >
              <i className="bi bi-download me-2"></i>
              Export
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionActions;