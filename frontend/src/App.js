import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar            from './components/Navbar';
import Sidebar           from './components/Sidebar';
import Dashboard         from './pages/Dashboard';
import RiskManagement    from './pages/RiskManagement';
import ManualReview      from './pages/ManualReview';
import ReviewHistory     from './pages/ReviewHistory';
import Transactions      from './pages/Transactions';
import Analytics         from './pages/Analytics';
import Reports           from './pages/Reports';
import Settings          from './pages/Settings';
import SuperAdmin        from './pages/SuperAdmin';
import AuditLog          from './pages/AuditLog';
import AlertsLog         from './pages/AlertsLog';
import FraudPatterns     from './pages/FraudPatterns';
import ActivityTimeline  from './pages/ActivityTimeline';
import RetrainSchedule   from './pages/RetrainSchedule';
import Login             from './pages/Login';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

function App() {
  const isMobile = () => window.innerWidth <= 992;

  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [collapsed,   setCollapsed]   = useState(false);

  useEffect(() => {
    const onResize = () => { if (!isMobile()) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleToggleSidebar  = () => setMobileOpen(p => !p);
  const closeMobileSidebar   = () => setMobileOpen(false);
  const handleToggleCollapse = () => setCollapsed(p => !p);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="App">
                <Navbar onToggleSidebar={handleToggleSidebar} />
                <div className={`app-container ${collapsed ? 'sidebar-collapsed' : 'sidebar-open'}`}>
                  <Sidebar
                    isOpen={mobileOpen}
                    onClose={closeMobileSidebar}
                    collapsed={collapsed}
                    onToggleCollapse={handleToggleCollapse}
                  />
                  <main className="main-content">
                    <Routes>
                      <Route path="/"                   element={<Dashboard />} />
                      <Route path="/dashboard"          element={<Dashboard />} />
                      <Route path="/risk-management"    element={<RiskManagement />} />
                      <Route path="/manual-review"      element={<ManualReview />} />
                      <Route path="/review-history"     element={<ReviewHistory />} />
                      <Route path="/transactions"       element={<Transactions />} />
                      <Route path="/analytics"          element={<Analytics />} />
                      <Route path="/reports"            element={<Reports />} />
                      <Route path="/settings"           element={<Settings />} />
                      <Route path="/super-admin"        element={<SuperAdmin />} />
                      <Route path="/audit-log"          element={<AuditLog />} />
                      <Route path="/alerts"             element={<AlertsLog />} />
                      <Route path="/fraud-patterns"     element={<FraudPatterns />} />
                      <Route path="/activity-timeline"  element={<ActivityTimeline />} />
                      <Route path="/retrain-schedule"   element={<RetrainSchedule />} />
                    </Routes>
                  </main>
                </div>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;