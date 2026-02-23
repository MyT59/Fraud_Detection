import React from 'react';

const PaginationComponent = ({ currentPage, totalPages, onPageChange }) => {
  // Always render — show page 1 minimum even when no data
  const effectivePages = Math.max(1, totalPages);
  const isEmpty = totalPages === 0;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (effectivePages <= maxVisiblePages) {
      for (let i = 1; i <= effectivePages; i++) pages.push(i);
    } else {
      pages.push(1);

      let startPage = Math.max(2, currentPage - 1);
      let endPage   = Math.min(effectivePages - 1, currentPage + 1);

      if (currentPage <= 3)                   endPage   = 4;
      if (currentPage >= effectivePages - 2)  startPage = effectivePages - 3;

      if (startPage > 2)                pages.push('...');
      for (let i = startPage; i <= endPage; i++) pages.push(i);
      if (endPage < effectivePages - 1) pages.push('...');

      pages.push(effectivePages);
    }

    return pages;
  };

  const handlePrevious = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < effectivePages) onPageChange(currentPage + 1);
  };

  const handlePageClick = (page) => {
    if (page !== '...') onPageChange(page);
  };

  return (
    <nav>
      <ul className="pagination mb-0">
        {/* Previous Button */}
        <li className={`page-item ${currentPage === 1 || isEmpty ? 'disabled' : ''}`}>
          <button
            className="page-link"
            onClick={handlePrevious}
            disabled={currentPage === 1 || isEmpty}
          >
            <i className="bi bi-chevron-left"></i>
          </button>
        </li>

        {/* Page Numbers */}
        {getPageNumbers().map((page, index) => (
          <li
            key={index}
            className={`page-item ${page === currentPage ? 'active' : ''} ${page === '...' || isEmpty ? 'disabled' : ''}`}
          >
            <button
              className="page-link"
              onClick={() => handlePageClick(page)}
              disabled={page === '...' || isEmpty}
            >
              {page}
            </button>
          </li>
        ))}

        {/* Next Button */}
        <li className={`page-item ${currentPage === effectivePages || isEmpty ? 'disabled' : ''}`}>
          <button
            className="page-link"
            onClick={handleNext}
            disabled={currentPage === effectivePages || isEmpty}
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default PaginationComponent;