import React, { useState, useMemo, useEffect, useCallback } from "react";
import PatternStats from "../components/fraudpatterns/PatternStats";
import PatternFilter from "../components/fraudpatterns/PatternFilter";
import PatternCard from "../components/fraudpatterns/PatternCard";
import PatternDetailModal from "../components/fraudpatterns/PatternDetailModal";
import PatternTrendChart from "../components/fraudpatterns/PatternTrendChart";
import PatternDiagnostics from "../components/fraudpatterns/PatternDiagnostics";
import PageLoader from "../components/common/PageLoader";
import api from "../services/apiService";
import { storage } from "../services/apiService";
import "./FraudPatterns.css";

const CATEGORY_MAP = {
  DECLINE_VELOCITY: "Transaction",
  VELOCITY: "Transaction",
  AMOUNT: "Transaction",
  AMOUNT_ANOMALY: "Transaction",
  NETWORK_FAN_IN: "Network",
  NETWORK_FAN_OUT: "Network",
  BRUTE_FORCE: "Credential",
  UNUSUAL_TIME: "Behavioral",
  BURST_ATTACK: "Transaction",
  SUPER_PATTERN: "Transaction",
  BEHAVIORAL: "Behavioral",
  LOCATION: "Location",
  DEVICE: "Device",
};

function riskScoreToLevel(score) {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function formatAvgLoss(avgAmount) {
  if (!avgAmount && avgAmount !== 0) return "N/A";
  const juta = avgAmount / 1_000_000;
  if (juta >= 1) return `${juta.toFixed(1)} Jt`;
  const ribu = avgAmount / 1_000;
  return `${ribu.toFixed(0)} Rb`;
}

function formatLastUpdated(isoStr) {
  if (!isoStr) return "-";
  try {
    return new Date(isoStr).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

function mapBackendPattern(bp, index) {
  const category =
    CATEGORY_MAP[bp.category?.toUpperCase()] || bp.category || "Transaction";

  const riskLevel = riskScoreToLevel(bp.risk_score ?? 50);

  const status = bp.is_active ? "active" : "inactive";

  // [FIX 1] Sebelumnya hanya membaca bp.accuracy yang tidak ada di response BE.
  // BE /patterns/stats mengembalikan field bernama accuracy_score.
  // Fallback ke bp.accuracy untuk kompatibilitas jika endpoint lain mengembalikannya.
  const rawAccuracy = bp.accuracy_score ?? bp.accuracy ?? 0;
  const accuracy =
    rawAccuracy > 1
      ? parseFloat(rawAccuracy.toFixed(1))
      : parseFloat((rawAccuracy * 100).toFixed(1));

  const rawFpr = bp.false_positive_rate ?? 0;
  const falsePositiveRate =
    rawFpr > 1
      ? parseFloat(rawFpr.toFixed(1))
      : parseFloat((rawFpr * 100).toFixed(1));

  const trend =
    bp.trend != null ? parseFloat(parseFloat(bp.trend).toFixed(1)) : 0;

  return {
    id: bp.id ?? 1000 + index,
    mlKey: bp.pattern_name ?? null,
    name: bp.pattern_name ?? `Pattern #${bp.id}`,
    description:
      bp.description ?? `${category} fraud pattern — ${bp.pattern_name ?? ""}`,
    category,
    riskLevel,
    status,
    occurrences: bp.occurrences ?? bp.hit_count ?? 0,
    accuracy,
    falsePositiveRate,
    avgLossIDR: formatAvgLoss(bp.avg_amount),
    trend,
    lastUpdated: formatLastUpdated(bp.updated_at ?? bp.last_updated),

    indicators: bp.indicators ?? generateIndicators(bp, category),
    recommendedActions: bp.recommended_actions ?? generateActions(bp, category),
    patternRules: bp.pattern_rules ?? null,

    _raw: bp,
  };
}

function generateIndicators(bp, category) {
  const base = {
    Transaction: [
      `Occurrences tercatat: ${bp.occurrences ?? bp.hit_count ?? 0} deteksi`,
      `Risk score: ${bp.risk_score ?? 50}/100`,
      `False discovery rate: ${((bp.false_positive_rate ?? 0) > 1 ? bp.false_positive_rate : (bp.false_positive_rate ?? 0) * 100).toFixed(1)}%`,
      `Rata-rata nominal terdampak: ${formatAvgLoss(bp.avg_amount)}`,
    ],
    Credential: [
      `Percobaan autentikasi berulang terdeteksi`,
      `Risk score: ${bp.risk_score ?? 50}/100`,
      `False discovery rate: ${((bp.false_positive_rate ?? 0) > 1 ? bp.false_positive_rate : (bp.false_positive_rate ?? 0) * 100).toFixed(1)}%`,
      `Occurrences: ${bp.occurrences ?? 0} deteksi`,
    ],
    Location: [
      `Lokasi transaksi tidak konsisten dengan profil pengguna`,
      `Risk score: ${bp.risk_score ?? 50}/100`,
      `False discovery rate: ${((bp.false_positive_rate ?? 0) > 1 ? bp.false_positive_rate : (bp.false_positive_rate ?? 0) * 100).toFixed(1)}%`,
      `Occurrences: ${bp.occurrences ?? 0} deteksi`,
    ],
    Device: [
      `Device fingerprint tidak dikenali`,
      `Risk score: ${bp.risk_score ?? 50}/100`,
      `False discovery rate: ${((bp.false_positive_rate ?? 0) > 1 ? bp.false_positive_rate : (bp.false_positive_rate ?? 0) * 100).toFixed(1)}%`,
      `Occurrences: ${bp.occurrences ?? 0} deteksi`,
    ],
    Behavioral: [
      `Pola perilaku menyimpang dari histori pengguna`,
      `Risk score: ${bp.risk_score ?? 50}/100`,
      `False discovery rate: ${((bp.false_positive_rate ?? 0) > 1 ? bp.false_positive_rate : (bp.false_positive_rate ?? 0) * 100).toFixed(1)}%`,
      `Occurrences: ${bp.occurrences ?? 0} deteksi`,
    ],
    Network: [
      `Aktivitas jaringan mencurigakan terdeteksi`,
      `Risk score: ${bp.risk_score ?? 50}/100`,
      `False discovery rate: ${((bp.false_positive_rate ?? 0) > 1 ? bp.false_positive_rate : (bp.false_positive_rate ?? 0) * 100).toFixed(1)}%`,
      `Occurrences: ${bp.occurrences ?? 0} deteksi`,
    ],
  };
  return base[category] ?? base.Transaction;
}

function generateActions(bp, category) {
  const action = bp.action ?? "FLAG";
  const base = {
    BLOCK: [
      "Transaksi otomatis diblokir oleh sistem",
      "Kirim notifikasi real-time ke pemilik akun",
      "Catat insiden ke log audit forensik",
      "Lakukan review manual jika diperlukan",
    ],
    REVIEW: [
      "Tahan transaksi untuk manual review analis",
      "Kirim notifikasi ke tim fraud analyst",
      "Verifikasi identitas pemilik akun",
      "Dokumentasikan temuan untuk pelatihan model",
    ],
    FLAG: [
      "Tandai transaksi untuk pemantauan lanjutan",
      "Tingkatkan skor risiko akun terkait",
      "Monitor aktivitas berikutnya secara intensif",
      "Eskalasi ke risk manager jika pola berlanjut",
    ],
  };
  return base[action] ?? base.FLAG;
}

const FraudPatterns = () => {
  const role = storage.getUser()?.role;
  const canAccessReports = role === "SUPER_ADMIN" || role === "RISK_MANAGER";

  const [loading, setLoading] = useState(true);
  const [patterns, setPatterns] = useState([]);
  const [totalFlagged, setTotalFlagged] = useState(0); // [NEW] dari BE /stats
  const [apiError, setApiError] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("occurrences_desc");
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [viewMode, setViewMode] = useState("grid");

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const data = await api.get("/patterns/stats");

      if (!data || !Array.isArray(data.patterns)) {
        throw new Error("Format respons tidak valid dari server.");
      }

      const mapped = data.patterns.map((bp, i) => mapBackendPattern(bp, i));
      setPatterns(mapped);
      // [NEW] Simpan total_flagged_transactions dari BE untuk PatternStats
      setTotalFlagged(data.total_flagged_transactions ?? 0);
    } catch (err) {
      console.error("[FraudPatterns] fetch error:", err);

      try {
        const fallback = await api.get("/patterns/");
        if (Array.isArray(fallback) && fallback.length > 0) {
          const mapped = fallback.map((bp, i) => mapBackendPattern(bp, i));
          setPatterns(mapped);
          setApiError(
            "Data parsial — endpoint /patterns/stats tidak tersedia, menampilkan active patterns saja.",
          );
        } else {
          throw new Error("Fallback juga tidak mengembalikan data.");
        }
      } catch (fallbackErr) {
        console.error("[FraudPatterns] fallback error:", fallbackErr);
        setApiError(
          err.message?.includes("401") || err.status === 401
            ? "Sesi habis. Silakan login ulang."
            : `Gagal memuat data pola fraud: ${err.message ?? "Server tidak dapat dihubungi."}`,
        );
        setPatterns([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  const filtered = useMemo(() => {
    let result = patterns.filter((p) => {
      if (riskFilter !== "all" && p.riskLevel !== riskFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      const q = searchTerm.toLowerCase();
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.description.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q)
      )
        return false;
      return true;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "occurrences_asc":
          return a.occurrences - b.occurrences;
        case "occurrences_desc":
          return b.occurrences - a.occurrences;
        case "accuracy_desc":
          return b.accuracy - a.accuracy;
        case "name_asc":
          return a.name.localeCompare(b.name);
        default:
          return b.occurrences - a.occurrences;
      }
    });

    return result;
  }, [riskFilter, statusFilter, searchTerm, sortBy, patterns]);

  if (loading) return <PageLoader message="Memuat Fraud Patterns..." />;

  return (
    <div className="fraud-patterns-page">
      <div className="fp-page-header">
        <div className="fp-header-left">
          <div className="fp-header-icon">
            <i className="bi bi-bug-fill"></i>
          </div>
          <div>
            <h1>Fraud Patterns</h1>
            <p className="fp-subtitle">
              Detection rules, pattern analysis, and threat intelligence
            </p>
          </div>
        </div>

        <div className="fp-header-actions">
          <div className="fp-view-toggle">
            <button
              className={`fp-view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Card View"
            >
              <i className="bi bi-grid-3x3-gap"></i>
            </button>
            <button
              className={`fp-view-btn ${viewMode === "chart" ? "active" : ""}`}
              onClick={() => setViewMode("chart")}
              title="Chart View"
            >
              <i className="bi bi-bar-chart-line"></i>
            </button>
          </div>

          <button
            className="fp-view-btn"
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              background: "#fff",
              width: 38,
              height: 38,
            }}
            onClick={fetchPatterns}
            title="Refresh data"
          >
            <i className="bi bi-arrow-clockwise"></i>
          </button>

          {canAccessReports && (
            <a
              href="/reports"
              className="fp-export-btn"
              title="Export via Reports"
              style={{ textDecoration: "none" }}
            >
              <i className="bi bi-download"></i>
              Export Patterns List
              <i
                className="bi bi-box-arrow-up-right ms-1"
                style={{ fontSize: ".7rem" }}
              ></i>
            </a>
          )}
        </div>
      </div>

      {apiError && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: ".6rem",
            padding: ".75rem 1rem",
            marginBottom: "1rem",
            background: patterns.length === 0 ? "#fef2f2" : "#fef3c7",
            border: `1px solid ${patterns.length === 0 ? "#fecaca" : "#fde68a"}`,
            borderRadius: "8px",
            fontSize: ".82rem",
            color: patterns.length === 0 ? "#991b1b" : "#92400e",
            fontWeight: 600,
          }}
        >
          <i
            className={`bi ${
              patterns.length === 0
                ? "bi-x-circle-fill"
                : "bi-exclamation-triangle-fill"
            }`}
            style={{ marginTop: "1px", flexShrink: 0 }}
          ></i>
          <span>{apiError}</span>
          {patterns.length === 0 && (
            <button
              onClick={fetchPatterns}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                color: "#991b1b",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: ".82rem",
                whiteSpace: "nowrap",
              }}
            >
              <i className="bi bi-arrow-clockwise"></i> Coba lagi
            </button>
          )}
        </div>
      )}

      {/* [FIX 1 applied] totalFlagged sekarang dipass ke PatternStats */}
      {patterns.length > 0 && (
        <PatternStats patterns={patterns} totalFlagged={totalFlagged} />
      )}

      {patterns.length === 0 && !loading && (
        <div className="fp-empty-state" style={{ marginTop: "2rem" }}>
          <i className="bi bi-cloud-slash"></i>
          <p>Data pola fraud tidak tersedia</p>
          <span>
            Pastikan backend berjalan dan Anda memiliki akses yang sesuai
          </span>
        </div>
      )}

      {patterns.length > 0 && (
        <>
          {/* [NEW] Diagnostics section — memanggil GET /patterns/diagnostics */}
          <PatternDiagnostics />

          <PatternFilter
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sortBy={sortBy}
            setSortBy={setSortBy}
            totalResults={filtered.length}
          />

          {viewMode === "chart" ? (
            <PatternTrendChart
              patterns={filtered.length > 0 ? filtered : patterns}
            />
          ) : (
            <>
              {filtered.length === 0 ? (
                <div className="fp-empty-state">
                  <i className="bi bi-inbox"></i>
                  <p>No patterns match the current filters</p>
                  <span>
                    Try adjusting the risk level, status, or search term
                  </span>
                </div>
              ) : (
                <div className="fp-cards-grid">
                  {filtered.map((pattern) => (
                    <PatternCard
                      key={pattern.id}
                      pattern={pattern}
                      onViewDetail={setSelectedPattern}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {selectedPattern && (
        <PatternDetailModal
          pattern={selectedPattern}
          onClose={() => setSelectedPattern(null)}
        />
      )}
    </div>
  );
};

export default FraudPatterns;
