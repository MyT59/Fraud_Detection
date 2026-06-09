import React, { useState, useEffect } from "react";
import ProfileSettings from "../components/settings/ProfileSettings";
import SecuritySettings from "../components/settings/SecuritySettings";
import NotificationSettings from "../components/settings/NotificationSettings";
import SystemSettings from "../components/settings/SystemSettings";
import ApiSettings from "../components/settings/ApiSettings";
import SettingsTabs from "../components/settings/SettingsTabs";
import "./Settings.css";
import PageLoader from "../components/common/PageLoader";
import api, { storage, authService } from "../services/apiService";

const ROLE_LABEL = {
  SUPER_ADMIN: "Super Admin",
  RISK_MANAGER: "Risk Manager",
  FRAUD_ANALYST: "Fraud Analyst",
};

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const [saveStatus, setSaveStatus] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [userData, setUserData] = useState(() => {
    const u = storage.getUser();
    return {
      name: u?.full_name || "Admin User",
      email: u?.email || "",
      role: ROLE_LABEL[u?.role] || u?.role || "Administrator",
      department: u?.department || "",
      phone: u?.phone_number || "",
      avatar: null,
    };
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

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.get("/accounts/me");
        const updated = {
          name: data.full_name || "",
          email: data.email || "",
          role: ROLE_LABEL[data.role] || data.role || "Administrator",
          department: data.department || "",
          phone: data.phone_number || "",
          avatar: null,
        };
        setUserData(updated);

        storage.setUser({ ...storage.getUser(), ...data });
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSaveProfile = async (formData) => {
    setSaveStatus("saving");
    try {
      const payload = {
        full_name: formData.name,
        phone_number: formData.phone,
        department: formData.department,
      };
      const data = await api.patch("/accounts/me", payload);
      const updated = {
        name: data.full_name || formData.name,
        email: data.email || formData.email,
        role: ROLE_LABEL[data.role] || data.role || formData.role,
        department: data.department || formData.department,
        phone: data.phone_number || formData.phone,
        avatar: null,
      };
      setUserData(updated);

      storage.setUser({ ...storage.getUser(), ...data });

      window.dispatchEvent(new Event("storage"));
      setSaveStatus("success");
    } catch {
      setSaveStatus("error");
    } finally {
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleSave = (tab, data) => {
    if (tab === "profile") {
      handleSaveProfile(data);
      return;
    }
    setSaveStatus("saving");
    setTimeout(() => {
      switch (tab) {
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

  const confirmLogout = async () => {
    try {
      await authService.logout();
    } catch {
      storage.clear();
      window.location.href = "/login";
    }
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
        return <SecuritySettings />;
      case "notifications":
        return <NotificationSettings />;
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
            className={`alert alert-${
              saveStatus === "success"
                ? "success"
                : saveStatus === "error"
                  ? "danger"
                  : "info"
            } alert-dismissible fade show`}
          >
            <i
              className={`bi bi-${
                saveStatus === "success"
                  ? "check-circle"
                  : saveStatus === "error"
                    ? "x-circle"
                    : "hourglass-split"
              } me-2`}
            ></i>
            {saveStatus === "success"
              ? "Pengaturan berhasil disimpan!"
              : saveStatus === "error"
                ? "Gagal menyimpan pengaturan. Coba lagi."
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
