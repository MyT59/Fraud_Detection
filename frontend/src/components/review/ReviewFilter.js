import React from 'react';
import './ReviewFilter.css';

const ReviewFilter = ({ filterStatus, setFilterStatus, searchTerm, setSearchTerm }) => {
  const filters = [
    { value: 'all', label: 'All', icon: 'bi-list-ul' },
    { value: 'pending', label: 'Pending', icon: 'bi-clock-history' },
    { value: 'approved', label: 'Approved', icon: 'bi-check-circle' },
    { value: 'rejected', label: 'Rejected', icon: 'bi-x-circle' }
  ];

  return (
    <div className="review-filter-container">
      <div className="filter-tabs">
        {filters.map(filter => (
          <button
            key={filter.value}
            className={`filter-tab ${filterStatus === filter.value ? 'active' : ''} ${filter.value}`}
            onClick={() => setFilterStatus(filter.value)}
          >
            <i className={`bi ${filter.icon}`}></i>
            <span>{filter.label}</span>
          </button>
        ))}
      </div>

      <div className="search-box">
        <i className="bi bi-search"></i>
        <input
          type="text"
          placeholder="Search by ID, user name, or user ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button 
            className="clear-search"
            onClick={() => setSearchTerm('')}
          >
            <i className="bi bi-x"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default ReviewFilter;