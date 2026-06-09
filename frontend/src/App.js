import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { authService, storage } from "./services/apiService";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import RiskManagement from "./pages/RiskManagement";
import ManualReview from "./pages/ManualReview";
import ReviewHistory from "./pages/ReviewHistory";
import Transactions from "./pages/Transactions";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import SuperAdmin from "./pages/SuperAdmin";
import AuditLog from "./pages/AuditLog";
import AlertsLog from "./pages/AlertsLog";
import FraudPatterns from "./pages/FraudPatterns";
import ActivityTimeline from "./pages/ActivityTimeline";
import RetrainSchedule from "./pages/RetrainSchedule";
import Login from "./pages/Login";
import "./App.css";

// ─── Auth Guard ───────────────────────────────────────────────────
// Redirect ke /login jika belum autentikasi

const ProtectedRoute = ({ children }) => {
  return authService.isAuthenticated() ? (
    children
  ) : (
    <Navigate to="/login" replace />
  );
};

// ─── Role Guard ───────────────────────────────────────────────────
// Tampilkan 403 inline jika role tidak sesuai.
// Tidak redirect agar user tahu kenapa tidak bisa akses.

const RoleGuard = ({ allowedRoles, children }) => {
  // FIX: gunakan storage.getUser() dari apiService (key "user"),
  // bukan authService.getCurrentUser() yang baca dari key "current_user" (AuthService.js lama)
  const user = storage.getUser();
  const role = user?.role || null;

  if (!allowedRoles.includes(role)) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: "1rem",
          color: "#6b7280",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#fef2f2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: ".5rem",
          }}
        >
          <i
            className="bi bi-shield-lock-fill"
            style={{ fontSize: "1.75rem", color: "#dc2626" }}
          />
        </div>
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#111827",
            margin: 0,
          }}
        >
          Akses Ditolak
        </h2>
        <p style={{ fontSize: ".9rem", maxWidth: 360, margin: 0 }}>
          Halaman ini hanya dapat diakses oleh:{" "}
          <strong>{allowedRoles.join(", ")}</strong>.
          <br />
          Role Anda saat ini: <strong>{role || "tidak diketahui"}</strong>.
        </p>
        <button
          onClick={() => window.history.back()}
          style={{
            padding: ".5rem 1.25rem",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            background: "#fff",
            color: "#374151",
            fontWeight: 600,
            fontSize: ".875rem",
            cursor: "pointer",
          }}
        >
          <i className="bi bi-arrow-left" style={{ marginRight: 6 }} />
          Kembali
        </button>
      </div>
    );
  }

  return children;
};

// ─── App ──────────────────────────────────────────────────────────

function App() {
  const isMobile = () => window.innerWidth <= 992;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (!isMobile()) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleToggleSidebar = () => setMobileOpen((p) => !p);
  const closeMobileSidebar = () => setMobileOpen(false);
  const handleToggleCollapse = () => setCollapsed((p) => !p);

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
                <div
                  className={`app-container ${collapsed ? "sidebar-collapsed" : "sidebar-open"}`}
                >
                  <Sidebar
                    isOpen={mobileOpen}
                    onClose={closeMobileSidebar}
                    collapsed={collapsed}
                    onToggleCollapse={handleToggleCollapse}
                  />
                  <main className="main-content">
                    <Routes>
                      {/* ── Public (semua role) ── */}
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/transactions" element={<Transactions />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/alerts" element={<AlertsLog />} />
                      <Route
                        path="/activity-timeline"
                        element={<ActivityTimeline />}
                      />

                      {/* ── Manual Review
                          FRAUD_ANALYST  : My Assigned Cases tab
                          RISK_MANAGER   : Analyst Performance + Timeline tab
                          SUPER_ADMIN    : Semua tab
                          → Tidak di-guard di sini karena ManualReview.js
                            sendiri yang handle tab per role
                      ── */}
                      <Route path="/manual-review" element={<ManualReview />} />
                      <Route
                        path="/review-history"
                        element={<ReviewHistory />}
                      />

                      {/* ── Risk Management: RISK_MANAGER & SUPER_ADMIN ── */}
                      <Route
                        path="/risk-management"
                        element={
                          <RoleGuard
                            allowedRoles={["RISK_MANAGER", "SUPER_ADMIN"]}
                          >
                            <RiskManagement />
                          </RoleGuard>
                        }
                      />

                      {/* ── Control Panel: SUPER_ADMIN only ── */}
                      <Route
                        path="/super-admin"
                        element={
                          <RoleGuard allowedRoles={["SUPER_ADMIN"]}>
                            <SuperAdmin />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/audit-log"
                        element={
                          <RoleGuard
                            allowedRoles={["SUPER_ADMIN", "RISK_MANAGER"]}
                          >
                            <AuditLog />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/fraud-patterns"
                        element={
                          <RoleGuard
                            allowedRoles={["SUPER_ADMIN", "RISK_MANAGER"]}
                          >
                            <FraudPatterns />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/retrain-schedule"
                        element={
                          <RoleGuard
                            allowedRoles={["SUPER_ADMIN", "RISK_MANAGER"]}
                          >
                            <RetrainSchedule />
                          </RoleGuard>
                        }
                      />
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