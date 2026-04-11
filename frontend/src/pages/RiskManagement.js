import React, { useState, useEffect, useCallback, useRef } from "react";
import BlacklistPanel from "../components/riskmanagement/BlacklistPanel";
import BlacklistFormModal from "../components/riskmanagement/BlacklistFormModal";
import RuleEngine from "../components/riskmanagement/RuleEngine";
import RuleModal from "../components/riskmanagement/RuleModal";
import RuleDetailModal from "../components/riskmanagement/RuleDetailModal";
import "./RiskManagement.css";
import PageLoader from "../components/common/PageLoader";

const SEED_BLACKLIST = [
  {
    id: 1,
    accountNumber: "1230004567",
    accountName: "Budi Palsu",
    bank: "BCA",
    reason: "Penipuan Online",
    source: "manual",
    status: "active",
    hitCount: 7,
    addedAt: "01 Feb 2025",
  },
  {
    id: 2,
    accountNumber: "0897766554",
    accountName: "Sari Bohong",
    bank: "BRI",
    reason: "Rekening Mule",
    source: "manual",
    status: "active",
    hitCount: 3,
    addedAt: "01 Feb 2025",
  },
  {
    id: 3,
    accountNumber: "4450091823",
    accountName: "Agen Penipu X",
    bank: "Mandiri",
    reason: "Investasi Bodong",
    source: "manual",
    status: "active",
    hitCount: 0,
    addedAt: "02 Feb 2025",
  },
  {
    id: 4,
    accountNumber: "8812345098",
    accountName: "Toko Palsu Online",
    bank: "BNI",
    reason: "Jual Beli Palsu",
    source: "import",
    status: "pending",
    hitCount: 0,
    addedAt: "05 Feb 2025",
  },
  {
    id: 5,
    accountNumber: "3309988712",
    accountName: "Pinjol Ilegal Co.",
    bank: "BSI",
    reason: "Pinjol Ilegal",
    source: "import",
    status: "pending",
    hitCount: 0,
    addedAt: "05 Feb 2025",
  },
  {
    id: 6,
    accountNumber: "7760123456",
    accountName: "Hacker Anonim",
    bank: "CIMB Niaga",
    reason: "Phishing",
    source: "system",
    status: "active",
    hitCount: 12,
    addedAt: "10 Feb 2025",
  },
  {
    id: 7,
    accountNumber: "2234509876",
    accountName: "Oknum Penipuan",
    bank: "Danamon",
    reason: "Social Engineering",
    source: "manual",
    status: "active",
    hitCount: 1,
    addedAt: "12 Feb 2025",
  },
  {
    id: 8,
    accountNumber: "9900123789",
    accountName: "Rekening Bayangan",
    bank: "Permata",
    reason: "Rekening Mule",
    source: "manual",
    status: "inactive",
    hitCount: 0,
    addedAt: "15 Feb 2025",
  },
  {
    id: 9,
    accountNumber: "6678901234",
    accountName: "Sindikat A",
    bank: "BCA",
    reason: "Penipuan Online",
    source: "manual",
    status: "active",
    hitCount: 5,
    addedAt: "17 Feb 2025",
  },
  {
    id: 10,
    accountNumber: "1122334455",
    accountName: "Modus Baru Corp",
    bank: "BRI",
    reason: "Penipuan Online",
    source: "import",
    status: "pending",
    hitCount: 0,
    addedAt: "18 Feb 2025",
  },
];

const SEED_RULES = [
  {
    id: 1,
    name: "Transaksi Besar Akun Baru",
    description: "Nominal > 50jt dari akun usia < 7 hari",
    priority: 1,
    action: "block",
    enabled: true,
    hitCount: 23,
    hitToday: 3,
    hitWeek: 9,
    hitMonth: 23,
    condition: "Jumlah Transaksi (Rp) > 50000000 (akun < 7 hari)",
    condField: "Jumlah Transaksi (Rp)",
    condOp: ">",
    condValue: "50000000",
    createdAt: "01 Jan 2025",
  },
  {
    id: 2,
    name: "Frekuensi Tinggi",
    description: "Lebih dari 10 transaksi per jam",
    priority: 2,
    action: "block",
    enabled: true,
    hitCount: 8,
    hitToday: 1,
    hitWeek: 4,
    hitMonth: 8,
    condition: "Frekuensi (per jam) > 10",
    condField: "Frekuensi (per jam)",
    condOp: ">",
    condValue: "10",
    createdAt: "01 Jan 2025",
  },
  {
    id: 3,
    name: "Transaksi Dini Hari",
    description: "Transaksi antara jam 01:00–04:00",
    priority: 3,
    action: "flag",
    enabled: true,
    hitCount: 41,
    hitToday: 5,
    hitWeek: 18,
    hitMonth: 41,
    condition: "Jam Transaksi >= 1 dan <= 4",
    condField: "Jam Transaksi",
    condOp: ">=",
    condValue: "1",
    condValue2: "4",
    createdAt: "05 Jan 2025",
  },
  {
    id: 4,
    name: "Akumulasi Harian Besar",
    description: "Total transaksi harian > 100jt",
    priority: 4,
    action: "review",
    enabled: true,
    hitCount: 17,
    hitToday: 2,
    hitWeek: 7,
    hitMonth: 17,
    condition: "Jumlah Kumulatif (hari ini) > 100000000",
    condField: "Jumlah Kumulatif (hari ini)",
    condOp: ">",
    condValue: "100000000",
    createdAt: "10 Jan 2025",
  },
  {
    id: 5,
    name: "Transaksi Luar Negeri",
    description: "Kode negara tujuan bukan ID",
    priority: 5,
    action: "flag",
    enabled: true,
    hitCount: 6,
    hitToday: 0,
    hitWeek: 2,
    hitMonth: 6,
    condition: "Kode Negara Tujuan ≠ ID",
    condField: "Kode Negara Tujuan",
    condOp: "≠",
    condValue: "ID",
    createdAt: "15 Jan 2025",
  },
  {
    id: 6,
    name: "Velocity Harian Ekstrem",
    description: "> 50 transaksi dalam sehari",
    priority: 6,
    action: "block",
    enabled: false,
    hitCount: 0,
    hitToday: 0,
    hitWeek: 0,
    hitMonth: 0,
    condition: "Frekuensi (per hari) > 50",
    condField: "Frekuensi (per hari)",
    condOp: ">",
    condValue: "50",
    createdAt: "20 Jan 2025",
  },
];

let _tid = 0;
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const push = useCallback((msg, type = "success", key = null) => {
    const id = ++_tid;
    if (key && timers.current[key]) {
      clearTimeout(timers.current[key]);
      delete timers.current[key];
    }
    setToasts((p) => {
      const filtered = key ? p.filter((t) => t._key !== key) : p;
      return [...filtered, { id, msg, type, _key: key }];
    });
    const timerId = setTimeout(() => {
      setToasts((p) => p.filter((t) => t.id !== id));
      if (key) delete timers.current[key];
    }, 3100);
    if (key) timers.current[key] = timerId;
    else timers.current[id] = timerId;
  }, []);

  const dismiss = useCallback((id) => {
    Object.keys(timers.current).forEach((k) => {
      if (String(k) === String(id)) {
        clearTimeout(timers.current[k]);
        delete timers.current[k];
      }
    });
    setToasts((p) => {
      const toast = p.find((t) => t.id === id);
      if (toast?._key && timers.current[toast._key]) {
        clearTimeout(timers.current[toast._key]);
        delete timers.current[toast._key];
      }
      return p.filter((t) => t.id !== id);
    });
  }, []);

  return { toasts, push, dismiss };
};

const RiskManagement = () => {
  const [loading, setLoading] = useState(true);
  const [blacklist, setBlacklist] = useState(SEED_BLACKLIST);
  const [rules, setRules] = useState(SEED_RULES);

  const [blModal, setBlModal] = useState({
    open: false,
    mode: "single",
    editData: null,
  });

  const [ruleModal, setRuleModal] = useState({ open: false, editData: null });

  const [ruleDetailModal, setRuleDetailModal] = useState({
    open: false,
    rule: null,
  });

  const { toasts, push, dismiss } = useToast();

  const handleBlSubmit = (mode, items) => {
    const now = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    if (mode === "edit") {
      setBlacklist((p) =>
        p.map((b) => (b.id === items[0].id ? { ...b, ...items[0] } : b)),
      );
      push(`Rekening ${items[0].accountNumber} berhasil diperbarui.`, "info");
      return;
    }

    const newItems = items.map((it) => ({ ...it, addedAt: it.addedAt || now }));
    setBlacklist((p) => [...newItems, ...p]);
    push(
      mode === "bulk"
        ? `${items.length} rekening berhasil diimport, menunggu verifikasi.`
        : `Rekening ${items[0].accountNumber} ditambahkan ke blacklist.`,
      "success",
    );
  };

  const handleBlDelete = (id) => {
    const item = blacklist.find((b) => b.id === id);
    setBlacklist((p) => p.filter((b) => b.id !== id));
    push(`Rekening ${item?.accountNumber} dihapus dari blacklist.`, "error");
  };

  const handleBlApprove = (id) => {
    setBlacklist((p) =>
      p.map((b) => (b.id === id ? { ...b, status: "active" } : b)),
    );
    push("Rekening disetujui dan sekarang aktif diblokir.", "info");
  };

  const handleBlEdit = (item) => {
    setBlModal({ open: true, mode: "single", editData: item });
  };

  const handleBlToggleStatus = (id, newStatus) => {
    const item = blacklist.find((b) => b.id === id);
    setBlacklist((p) =>
      p.map((b) => (b.id === id ? { ...b, status: newStatus } : b)),
    );
    push(
      `Rekening ${item?.accountNumber} ${
        newStatus === "active" ? "diaktifkan kembali" : "dinonaktifkan"
      }.`,
      newStatus === "active" ? "success" : "warn",
      "bl-toggle",
    );
  };

  const handleRuleSubmit = (data) => {
    if (data.id && rules.find((r) => r.id === data.id)) {
      setRules((p) => p.map((r) => (r.id === data.id ? { ...r, ...data } : r)));
      push(`Rule "${data.name}" berhasil diperbarui.`, "info");
    } else {
      setRules((p) => [{ ...data, enabled: true, hitCount: 0 }, ...p]);
      push(`Rule "${data.name}" berhasil dibuat.`, "success");
    }
  };

  const handleRuleDelete = (id) => {
    const rule = rules.find((r) => r.id === id);
    setRules((p) => p.filter((r) => r.id !== id));
    push(`Rule "${rule?.name}" dihapus.`, "error");
  };

  const handleRuleToggle = (id) => {
    setRules((p) =>
      p.map((r) => {
        if (r.id !== id) return r;
        const next = !r.enabled;
        push(
          `Rule "${r.name}" ${next ? "diaktifkan" : "dinonaktifkan"}.`,
          next ? "success" : "warn",
          "rule-toggle",
        );
        return { ...r, enabled: next };
      }),
    );
  };

  const handleRuleDetail = (rule) => {
    setRuleDetailModal({ open: true, rule });
  };

  const toastIcon = (t) =>
    t === "success"
      ? "bi-check-circle-fill"
      : t === "error"
        ? "bi-trash-fill"
        : t === "warn"
          ? "bi-exclamation-triangle-fill"
          : "bi-info-circle-fill";

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <PageLoader message="Memuat Risk Management..." />;

  return (
    <div className="rm-page">
      <div className="rm-header">
        <div className="rm-header-left">
          <div className="rm-header-icon">
            <i className="bi bi-shield-fill-exclamation" />
          </div>
          <div>
            <h1 className="rm-page-title">Risk Management</h1>
            <p className="rm-page-subtitle">
              Blacklist rekening penipu &amp; konfigurasi rule otomatis sebelum
              transaksi masuk ke Manual Review
            </p>
          </div>
        </div>
      </div>

      <BlacklistPanel
        data={blacklist}
        onAdd={() => setBlModal({ open: true, mode: "single", editData: null })}
        onBulkImport={() =>
          setBlModal({ open: true, mode: "bulk", editData: null })
        }
        onDelete={handleBlDelete}
        onApprove={handleBlApprove}
        onEdit={handleBlEdit}
        onToggleStatus={handleBlToggleStatus}
      />

      <RuleEngine
        rules={rules}
        onAdd={() => setRuleModal({ open: true, editData: null })}
        onEdit={(rule) => setRuleModal({ open: true, editData: rule })}
        onDelete={handleRuleDelete}
        onToggle={handleRuleToggle}
        onDetail={handleRuleDetail}
      />

      <BlacklistFormModal
        isOpen={blModal.open}
        mode={blModal.mode}
        editData={blModal.editData}
        onClose={() =>
          setBlModal({ open: false, mode: "single", editData: null })
        }
        onSubmit={handleBlSubmit}
      />

      <RuleModal
        isOpen={ruleModal.open}
        editData={ruleModal.editData}
        onClose={() => setRuleModal({ open: false, editData: null })}
        onSubmit={handleRuleSubmit}
      />

      <RuleDetailModal
        isOpen={ruleDetailModal.open}
        rule={
          ruleDetailModal.rule
            ? (rules.find((r) => r.id === ruleDetailModal.rule.id) ??
              ruleDetailModal.rule)
            : null
        }
        onClose={() => setRuleDetailModal({ open: false, rule: null })}
        onEdit={(rule) => {
          setRuleDetailModal({ open: false, rule: null });
          setRuleModal({ open: true, editData: rule });
        }}
        onDelete={handleRuleDelete}
        onToggle={handleRuleToggle}
      />

      <div className="rm-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`rm-toast t-${t.type}`}>
            <i className={`bi ${toastIcon(t.type)}`} />
            <span style={{ flex: 1 }}>{t.msg}</span>
            <button
              className="rm-toast-close"
              onClick={() => dismiss(t.id)}
              title="Tutup"
            >
              <i className="bi bi-x" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RiskManagement;
