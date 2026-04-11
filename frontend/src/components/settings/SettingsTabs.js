import React from "react";

const SettingsTabs = ({ activeTab, onTabChange, onLogout }) => {
  const tabs = [
    {
      id: "profile",
      icon: "person-circle",
      label: "Profile",
      description: "Informasi personal",
    },
    {
      id: "security",
      icon: "shield-lock",
      label: "Security",
      description: "Keamanan akun",
    },
    {
      id: "notifications",
      icon: "bell",
      label: "Notifications",
      description: "Preferensi notifikasi",
    },
    {
      id: "system",
      icon: "sliders",
      label: "System",
      description: "Pengaturan sistem",
    },
    {
      id: "api",
      icon: "code-slash",
      label: "API",
      description: "Konfigurasi API",
    },
  ];

  return (
    <div className="card settings-tabs-card">
      <div className="card-body p-0">
        <div className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              <div className="tab-icon">
                <i className={`bi bi-${tab.icon}`}></i>
              </div>
              <div className="tab-content">
                <div className="tab-label">{tab.label}</div>
                <div className="tab-description">{tab.description}</div>
              </div>
              {activeTab === tab.id && (
                <div className="tab-indicator">
                  <i className="bi bi-chevron-right"></i>
                </div>
              )}
            </button>
          ))}

          <div className="settings-tab-divider" />

          <button
            className="settings-tab-item settings-tab-logout"
            onClick={onLogout}
          >
            <div className="tab-icon tab-icon-logout">
              <i className="bi bi-box-arrow-right"></i>
            </div>
            <div className="tab-content">
              <div className="tab-label">Log Out</div>
              <div className="tab-description">Keluar dari akun</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsTabs;
