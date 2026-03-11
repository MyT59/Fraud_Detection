import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Navbar.css';

const Navbar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();

  return (
    <nav className="navbar-simple">
      <div className="navbar-container">
        <div className="navbar-left">
          {/* Hamburger — hanya di mobile/tablet */}
          <button className="hamburger-btn" onClick={onToggleSidebar} title="Toggle Sidebar">
            <i className="bi bi-list"></i>
          </button>

          <div className="navbar-brand">
            <div className="brand-logo">
              <i className="bi bi-shield-check"></i>
            </div>
            <span className="brand-name">Fraud Detection System PT. NusaCita</span>
          </div>
        </div>

        <div className="navbar-menu">
          <button className="nav-item" onClick={() => navigate('/alerts')}>
            <i className="bi bi-bell"></i>
            <span className="notification-dot"></span>
          </button>
          <button className="nav-item" onClick={() => navigate('/settings')}>
            <i className="bi bi-gear"></i>
          </button>
          <div className="user-profile" onClick={() => navigate('/settings')}>
            <div className="user-avatar">
              <i className="bi bi-person"></i>
            </div>
            <div className="user-info">
              <span className="user-name">Admin User</span>
              <span className="user-role">Administrator</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;