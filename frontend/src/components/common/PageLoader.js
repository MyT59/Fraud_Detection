import React from 'react';
import './PageLoader.css';

const PageLoader = ({ message = 'Memuat data...' }) => {
  return (
    <div className="page-loader">
      <div className="page-loader-inner">
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="page-loader-text">{message}</p>
      </div>
    </div>
  );
};

export default PageLoader;