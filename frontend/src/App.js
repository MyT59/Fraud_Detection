import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { api, storage } from "./services/apiService";
import { authService } from "./services/AuthService"; // ✅ FIX: dari AuthService

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
import ChangePassword from "./pages/ChangePassword";
import Login from "./pages/Login";
import TransactionSimulator from "./pages/TransactionSimulator";
import PageLoader from "./components/common/PageLoader";
import { getRoleLabel } from "./utils/roleUi";
import "./App.css";

// ─── Token Validator ──────────────────────────────────────────────
// Validasi token ke BE saat app pertama load.
// Kalau token valid → lanjut. Kalau tidak → clear & redirect login.
const useAuthValidator = () => {
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const validate = async () => {
      if (!storage.getAccessToken()) {
        setAuthChecked(true);
        return;
      }
      try {
        const me = {
          ok: true,
          json: () => api.get("/accounts/me"),
        };
        if (!me.ok) {
          // Token invalid/expired → clear
          storage.clear();
        } else {
          const data = await me.json();
          storage.setUser(data);
        }
      } catch {
        // Network error → biarkan, jangan clear
      } finally {
        setAuthChecked(true);
      }
    };

    validate();
  }, []);

  return authChecked;
};

// ─── Auth Guard ───────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const user = storage.getUser();

  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (user?.is_password_temporary) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
};

// ─── Change Password Guard ────────────────────────────────────────
const ChangePasswordGuard = () => {
  return authService.isAuthenticated() ? (
    <ChangePassword />
  ) : (
    <Navigate to="/login" replace />
  );
};

// ─── Role Guard ───────────────────────────────────────────────────
const RoleGuard = ({ allowedRoles, children }) => {
  const user = storage.getUser();
  const role = user?.role || null;
  const allowedRoleLabels = allowedRoles.map(getRoleLabel).join(", ");
  const currentRoleLabel = role ? getRoleLabel(role) : "tidak diketahui";

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
          <strong>{allowedRoleLabels}</strong>.<br />
          Role Anda saat ini: <strong>{currentRoleLabel}</strong>.
        </p>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
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
          <button
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            style={{
              padding: ".5rem 1.25rem",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              background: "#dc2626",
              color: "#fff",
              fontWeight: 600,
              fontSize: ".875rem",
              cursor: "pointer",
            }}
          >
            <i className="bi bi-speedometer2" style={{ marginRight: 6 }} />
            Ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return children;
};

// ─── App ──────────────────────────────────────────────────────────
function App() {
  const isMobile = () => window.innerWidth <= 992;
  const authChecked = useAuthValidator(); // ✅ validasi token saat app start

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (!isMobile()) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Tunggu validasi token selesai sebelum render routes
  if (!authChecked) {
    return <PageLoader message="Memverifikasi sesi..." />;
  }

  const handleToggleSidebar = () => setMobileOpen((p) => !p);
  const closeMobileSidebar = () => setMobileOpen(false);
  const handleToggleCollapse = () => setCollapsed((p) => !p);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePasswordGuard />} />

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
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route
                        path="/transaction-simulator"
                        element={<TransactionSimulator />}
                      />
                      <Route path="/transactions" element={<Transactions />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route
                        path="/reports"
                        element={
                          <RoleGuard
                            allowedRoles={["SUPER_ADMIN", "RISK_MANAGER"]}
                          >
                            <Reports />
                          </RoleGuard>
                        }
                      />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/alerts" element={<AlertsLog />} />
                      <Route
                        path="/activity-timeline"
                        element={<ActivityTimeline />}
                      />
                      <Route path="/manual-review" element={<ManualReview />} />
                      <Route
                        path="/review-history"
                        element={<ReviewHistory />}
                      />
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
                          <RoleGuard allowedRoles={["SUPER_ADMIN"]}>
                            <AuditLog />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/fraud-patterns"
                        element={
                          <RoleGuard
                            allowedRoles={[
                              "SUPER_ADMIN",
                              "RISK_MANAGER",
                              "FRAUD_ANALYST",
                            ]}
                          >
                            <FraudPatterns />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/retrain-schedule"
                        element={
                          <RoleGuard allowedRoles={["SUPER_ADMIN"]}>
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
