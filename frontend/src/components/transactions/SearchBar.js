import React from 'react';

const SearchBar = ({ searchQuery, onSearchChange }) => {
  const handleSearchInput = (e) => {
    onSearchChange(e.target.value);
  };

  const handleClearSearch = () => {
    onSearchChange('');
  };

  return (
    <div className="card search-card mb-4">
      <div className="card-body">
        <div className="search-wrapper">
          <i className="bi bi-search search-icon"></i>
          <input
            type="text"
            className="form-control search-input"
            placeholder="Cari transaksi berdasarkan ID, User, atau Lokasi..."
            value={searchQuery}
            onChange={handleSearchInput}
          />
          {searchQuery && (
            <button 
              className="btn btn-sm btn-link clear-search"
              onClick={handleClearSearch}
            >
              <i className="bi bi-x-circle"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchBar;