import React, { useState, useEffect, useMemo, useCallback } from "react";
import ActivityStats from "../components/auditlog/ActivityStats";
import ActivityFilters from "../components/auditlog/ActivityFilters";
import ActivityFeed from "../components/auditlog/ActivityFeed";
import "./AuditLog.css";
import PageLoader from "../components/common/PageLoader";

/* ── Seed awal (historical, sebelum ada API) ── */
const SEED_LOGS = [
  { id:"seed-01", type:"create",  actor_name:"Super Admin", target_name:"Hani Puspita",    target_role:"analyst",    detail:"Membuat akun baru untuk Hani Puspita (Fraud Analyst) — Departemen: Risk Management", time_label:"10 Feb 2024" },
  { id:"seed-02", type:"edit",    actor_name:"Super Admin", target_name:"Rizky Pratama",   target_role:"admin",      detail:"Memperbarui akun Rizky Pratama: role: Fraud Analyst → Admin",                          time_label:"08 Feb 2024" },
  { id:"seed-03", type:"suspend", actor_name:"Super Admin", target_name:"Lina Kusuma",     target_role:"analyst",    detail:"Men-suspend akun Lina Kusuma (Fraud Analyst)",                                         time_label:"05 Feb 2024" },
  { id:"seed-04", type:"create",  actor_name:"Super Admin", target_name:"Dian Permata",    target_role:"analyst",    detail:"Membuat akun baru untuk Dian Permata (Fraud Analyst) — Departemen: Risk Management",   time_label:"01 Feb 2024" },
  { id:"seed-05", type:"edit",    actor_name:"Super Admin", target_name:"Fajar Nugroho",   target_role:"analyst",    detail:"Memperbarui akun Fajar Nugroho: departemen: Risk Management → Fraud Prevention",        time_label:"30 Jan 2024" },
  { id:"seed-06", type:"delete",  actor_name:"Super Admin", target_name:"Toni Hidayat",    target_role:"analyst",    detail:"Menghapus akun Toni Hidayat (Fraud Analyst) — Risk Management",                        time_label:"28 Jan 2024" },
  { id:"seed-07", type:"create",  actor_name:"Super Admin", target_name:"Fajar Nugroho",   target_role:"analyst",    detail:"Membuat akun baru untuk Fajar Nugroho (Fraud Analyst) — Departemen: Fraud Prevention",  time_label:"05 Feb 2024" },
  { id:"seed-08", type:"edit",    actor_name:"Super Admin", target_name:"Budi Santoso",    target_role:"analyst",    detail:"Memperbarui akun Budi Santoso: email diperbarui",                                      time_label:"25 Jan 2024" },
  { id:"seed-09", type:"suspend", actor_name:"Super Admin", target_name:"Maya Indah",      target_role:"analyst",    detail:"Men-suspend akun Maya Indah (Fraud Analyst) sementara",                               time_label:"22 Jan 2024" },
  { id:"seed-10", type:"create",  actor_name:"Super Admin", target_name:"Irwan Setiawan",  target_role:"superadmin", detail:"Membuat akun baru untuk Irwan Setiawan (Super Admin) — Departemen: Risk Management",   time_label:"15 Feb 2024" },
  { id:"seed-11", type:"suspend", actor_name:"Super Admin", target_name:"Maya Indah",      target_role:"analyst",    detail:"Mengaktifkan kembali akun Maya Indah (Fraud Analyst)",                                time_label:"20 Jan 2024" },
  { id:"seed-12", type:"delete",  actor_name:"Super Admin", target_name:"Ahmad Kurniawan", target_role:"analyst",    detail:"Menghapus akun Ahmad Kurniawan (Fraud Analyst) — Compliance",                          time_label:"18 Jan 2024" },
];

/* Konversi log dari API/seed ke format yg dipakai ActivityFeed */
const toFeedItem = (log) => ({
  id:        log.id,
  type:      log.type,
  desc:      log.detail,       // string biasa, bukan JSX
  time:      log.time_label || log.timestamp?.slice(0, 10) || "—",
  timestamp: log.timestamp || "",
  actor:     log.actor_name,
});

const AuditLog = () => {
  const [loading, setLoading]       = useState(true);
  const [apiLogs, setApiLogs]       = useState([]);
  const [apiError, setApiError]     = useState(false);
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  /* ── Fetch dari API ── */
  const fetchLogs = useCallback(async () => {
    try {
      const res  = await fetch("/audit-logs?page_size=100");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApiLogs(data.logs || []);
      setApiError(false);
    } catch {
      setApiError(true);
    }
  }, []);

  useEffect(() => {
    fetchLogs().finally(() => setLoading(false));
  }, [fetchLogs]);

  /* ── Gabung API log (terbaru) + seed (historical) ── */
  const allLogs = useMemo(() => {
    // Jika API sukses: tampilkan log API + seed di bawahnya (hapus duplikat by id)
    const apiItems  = apiLogs.map(toFeedItem);
    const seedItems = SEED_LOGS.map(toFeedItem);
    const apiIds    = new Set(apiItems.map(l => l.id));
    const merged    = [...apiItems, ...seedItems.filter(l => !apiIds.has(l.id))];
    return merged;
  }, [apiLogs]);

  const filtered = useMemo(() => {
    return allLogs.filter(log => {
      const matchType   = typeFilter === "all" || log.type === typeFilter;
      const matchSearch = !search || log.desc.toLowerCase().includes(search.toLowerCase())
                          || (log.actor || "").toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [allLogs, search, typeFilter]);

  const handleReset = () => { setSearch(""); setTypeFilter("all"); };

  if (loading) return <PageLoader message="Memuat Audit Log..." />;

  return (
    <div className="auditlog-page">
      {/* Header */}
      <div className="al-header">
        <div className="al-header-left">
          <div className="al-header-icon">
            <i className="bi bi-clock-history"></i>
          </div>
          <div>
            <h1 className="al-title">Audit Log</h1>
            <p className="al-subtitle">Riwayat seluruh aktivitas dan perubahan sistem</p>
          </div>
        </div>

        {/* Tombol refresh */}
        <button
          onClick={() => { setLoading(true); fetchLogs().finally(() => setLoading(false)); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 16px", border: "1.5px solid #e5e7eb",
            borderRadius: 8, background: "#fff", cursor: "pointer",
            fontSize: ".85rem", fontWeight: 600, color: "#6b7280",
            fontFamily: "inherit",
          }}
        >
          <i className="bi bi-arrow-clockwise"></i>
          Refresh
        </button>
      </div>

      {/* Banner API error */}
      {apiError && (
        <div style={{
          marginBottom: 16, padding: "10px 16px", borderRadius: 8,
          background: "#fffbeb", border: "1px solid #fde68a",
          color: "#92400e", fontSize: ".82rem", display: "flex", alignItems: "center", gap: 8,
        }}>
          <i className="bi bi-exclamation-triangle-fill"></i>
          API tidak tersedia — menampilkan data historis sementara.
        </div>
      )}

      {/* Stats */}
      <ActivityStats logs={allLogs} />

      {/* Filters */}
      <ActivityFilters
        search={search}
        onSearch={setSearch}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        onReset={handleReset}
      />

      {/* Feed */}
      <div className="al-card">
        <div className="al-card-header">
          <h2 className="al-card-title">
            <i className="bi bi-list-ul"></i>
            Log Aktivitas
            <span className="al-count">({filtered.length} entri)</span>
          </h2>
        </div>
        <ActivityFeed logs={filtered} />
      </div>
    </div>
  );
};

export default AuditLog;