import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 992);

  useEffect(() => {
    const onResize = () => setSidebarOpen(window.innerWidth > 992);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const closeSidebar = () => { if (window.innerWidth <= 992) setSidebarOpen(false); };

  return (
    <Router>
      <div className="App">
        <Navbar onToggleSidebar={() => setSidebarOpen(p => !p)} />
        <div className={`app-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
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
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;