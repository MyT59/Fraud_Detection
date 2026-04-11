import React, { useState, useEffect } from "react";
import ProfileSettings from "../components/settings/ProfileSettings";
import SecuritySettings from "../components/settings/SecuritySettings";
import NotificationSettings from "../components/settings/NotificationSettings";
import SystemSettings from "../components/settings/SystemSettings";
import ApiSettings from "../components/settings/ApiSettings";
import SettingsTabs from "../components/settings/SettingsTabs";
import "./Settings.css";
import PageLoader from "../components/common/PageLoader";

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const [saveStatus, setSaveStatus] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [userData, setUserData] = useState({
    name: "Admin User",
    email: "admin@frauddetection.com",
    role: "Administrator",
    department: "Security",
    phone: "+62 812-3456-7890",
    avatar: null,
  });

  const [securityData, setSecurityData] = useState({
    twoFactorEnabled: true,
    sessionTimeout: 30,
    passwordLastChanged: "2024-01-15",
    loginNotifications: true,
  });

  const [notificationData, setNotificationData] = useState({
    emailNotifications: true,
    fraudAlerts: true,
    weeklyReports: true,
    systemUpdates: false,
    pushNotifications: true,
  });

  const [systemData, setSystemData] = useState({
    language: "id",
    timezone: "Asia/Jakarta",
    dateFormat: "DD/MM/YYYY",
    currency: "IDR",
    theme: "light",
  });

  const [apiData, setApiData] = useState({
    apiKey: "sk_live_xxxxxxxxxxxxxxxxxxxxx",
    webhookUrl: "https://example.com/webhook",
    rateLimitPerMinute: 100,
    apiEnabled: true,
  });

  const handleSave = (tab, data) => {
    setSaveStatus("saving");
    setTimeout(() => {
      switch (tab) {
        case "profile":
          setUserData(data);
          break;
        case "security":
          setSecurityData(data);
          break;
        case "notifications":
          setNotificationData(data);
          break;
        case "system":
          setSystemData(data);
          break;
        case "api":
          setApiData(data);
          break;
        default:
          break;
      }
      setSaveStatus("success");
      setTimeout(() => setSaveStatus(null), 3000);
    }, 1000);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem("isLoggedIn");
    window.location.href = "/login";
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <ProfileSettings
            data={userData}
            onSave={(d) => handleSave("profile", d)}
          />
        );
      case "security":
        return (
          <SecuritySettings
            data={securityData}
            onSave={(d) => handleSave("security", d)}
          />
        );
      case "notifications":
        return (
          <NotificationSettings
            data={notificationData}
            onSave={(d) => handleSave("notifications", d)}
          />
        );
      case "system":
        return (
          <SystemSettings
            data={systemData}
            onSave={(d) => handleSave("system", d)}
          />
        );
      case "api":
        return (
          <ApiSettings data={apiData} onSave={(d) => handleSave("api", d)} />
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <PageLoader message="Memuat pengaturan..." />;

  return (
    <div className="settings-page">
      <div className="container-fluid py-4">
        <div className="page-header mb-4">
          <h1 className="page-title">
            <i className="bi bi-gear"></i> Settings
          </h1>
        </div>

        {saveStatus && (
          <div
            className={`alert alert-${saveStatus === "success" ? "success" : "info"} alert-dismissible fade show`}
          >
            <i
              className={`bi bi-${saveStatus === "success" ? "check-circle" : "hourglass-split"} me-2`}
            ></i>
            {saveStatus === "success"
              ? "Pengaturan berhasil disimpan!"
              : "Menyimpan pengaturan..."}
            <button
              type="button"
              className="btn-close"
              onClick={() => setSaveStatus(null)}
            ></button>
          </div>
        )}

        <div className="row">
          <div className="col-lg-3 mb-4">
            <SettingsTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onLogout={handleLogout}
            />
          </div>

          <div className="col-lg-9">
            <div className="settings-content-wrapper">{renderTabContent()}</div>
          </div>
        </div>
      </div>

      {showLogoutConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="modal-content logout-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h5>
                <i className="bi bi-box-arrow-right me-2 text-danger"></i>
                Konfirmasi Log Out
              </h5>
              <button
                className="btn-close"
                onClick={() => setShowLogoutConfirm(false)}
              ></button>
            </div>
            <div className="modal-body">
              <div className="logout-modal-body">
                <div className="logout-icon-wrap">
                  <i className="bi bi-box-arrow-right"></i>
                </div>
                <p className="logout-modal-text">
                  Apakah kamu yakin ingin keluar dari akun ini?
                </p>
                <p className="logout-modal-sub">
                  Sesi aktif akan diakhiri dan kamu perlu login kembali untuk
                  mengakses sistem.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline-secondary"
                onClick={() => setShowLogoutConfirm(false)}
              >
                <i className="bi bi-x-circle me-1"></i>
                Batal
              </button>
              <button className="btn btn-danger" onClick={confirmLogout}>
                <i className="bi bi-box-arrow-right me-1"></i>
                Ya, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
