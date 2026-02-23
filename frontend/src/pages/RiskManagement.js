import React, { useState, useEffect, useCallback } from 'react';
import RiskStats      from '../components/riskmanagement/RiskStats';
import BlacklistPanel from '../components/riskmanagement/BlacklistPanel';
import BlacklistModal from '../components/riskmanagement/BlacklistModal';
import RuleEngine     from '../components/riskmanagement/RuleEngine';
import RuleModal      from '../components/riskmanagement/RuleModal';
import './RiskManagement.css';
import PageLoader from '../components/common/PageLoader';

/* ── Seed: Blacklist ─────────────────────────────────────── */
const SEED_BLACKLIST = [
  { id:1,  accountNumber:'1230004567', accountName:'Budi Palsu',        bank:'BCA',     reason:'Penipuan Online',   source:'manual',  status:'active',  hitCount:7,  addedAt:'01 Feb 2025' },
  { id:2,  accountNumber:'0897766554', accountName:'Sari Bohong',       bank:'BRI',     reason:'Rekening Mule',     source:'manual',  status:'active',  hitCount:3,  addedAt:'01 Feb 2025' },
  { id:3,  accountNumber:'4450091823', accountName:'Agen Penipu X',     bank:'Mandiri', reason:'Investasi Bodong',  source:'manual',  status:'active',  hitCount:0,  addedAt:'02 Feb 2025' },
  { id:4,  accountNumber:'8812345098', accountName:'Toko Palsu Online', bank:'BNI',     reason:'Jual Beli Palsu',   source:'import',  status:'pending', hitCount:0,  addedAt:'05 Feb 2025' },
  { id:5,  accountNumber:'3309988712', accountName:'Pinjol Ilegal Co.', bank:'BSI',     reason:'Pinjol Ilegal',     source:'import',  status:'pending', hitCount:0,  addedAt:'05 Feb 2025' },
  { id:6,  accountNumber:'7760123456', accountName:'Hacker Anonim',     bank:'CIMB Niaga', reason:'Phishing',       source:'system',  status:'active',  hitCount:12, addedAt:'10 Feb 2025' },
  { id:7,  accountNumber:'2234509876', accountName:'Oknum Penipuan',    bank:'Danamon', reason:'Social Engineering',source:'manual',  status:'active',  hitCount:1,  addedAt:'12 Feb 2025' },
  { id:8,  accountNumber:'9900123789', accountName:'Rekening Bayangan', bank:'Permata', reason:'Rekening Mule',     source:'manual',  status:'inactive',hitCount:0,  addedAt:'15 Feb 2025' },
  { id:9,  accountNumber:'6678901234', accountName:'Sindikat A',        bank:'BCA',     reason:'Penipuan Online',   source:'manual',  status:'active',  hitCount:5,  addedAt:'17 Feb 2025' },
  { id:10, accountNumber:'1122334455', accountName:'Modus Baru Corp',   bank:'BRI',     reason:'Penipuan Online',   source:'import',  status:'pending', hitCount:0,  addedAt:'18 Feb 2025' },
];

/* ── Seed: Rules ─────────────────────────────────────────── */
const SEED_RULES = [
  {
    id:1, name:'Transaksi Besar Akun Baru',
    description:'Nominal > 50jt dari akun usia < 7 hari',
    priority:1, action:'block', enabled:true, hitCount:23,
    condition:'Jumlah Transaksi (Rp) > 50000000 (akun < 7 hari)',
    condField:'Jumlah Transaksi (Rp)', condOp:'>', condValue:'50000000',
    createdAt:'01 Jan 2025',
  },
  {
    id:2, name:'Frekuensi Tinggi',
    description:'Lebih dari 10 transaksi per jam',
    priority:2, action:'block', enabled:true, hitCount:8,
    condition:'Frekuensi (per jam) > 10',
    condField:'Frekuensi (per jam)', condOp:'>', condValue:'10',
    createdAt:'01 Jan 2025',
  },
  {
    id:3, name:'Transaksi Dini Hari',
    description:'Transaksi antara jam 01:00–04:00',
    priority:3, action:'flag', enabled:true, hitCount:41,
    condition:'Jam Transaksi >= 1 dan <= 4',
    condField:'Jam Transaksi', condOp:'>=', condValue:'1', condValue2:'4',
    createdAt:'05 Jan 2025',
  },
  {
    id:4, name:'Akumulasi Harian Besar',
    description:'Total transaksi harian > 100jt',
    priority:4, action:'review', enabled:true, hitCount:17,
    condition:'Jumlah Kumulatif (hari ini) > 100000000',
    condField:'Jumlah Kumulatif (hari ini)', condOp:'>', condValue:'100000000',
    createdAt:'10 Jan 2025',
  },
  {
    id:5, name:'Transaksi Luar Negeri',
    description:'Kode negara tujuan bukan ID',
    priority:5, action:'flag', enabled:true, hitCount:6,
    condition:'Kode Negara Tujuan ≠ ID',
    condField:'Kode Negara Tujuan', condOp:'≠', condValue:'ID',
    createdAt:'15 Jan 2025',
  },
  {
    id:6, name:'Velocity Harian Ekstrem',
    description:'> 50 transaksi dalam sehari',
    priority:6, action:'block', enabled:false, hitCount:0,
    condition:'Frekuensi (per hari) > 50',
    condField:'Frekuensi (per hari)', condOp:'>', condValue:'50',
    createdAt:'20 Jan 2025',
  },
];

/* ── Toast hook ─────────────────────────────────────────── */
let _tid = 0;
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type = 'success') => {
    const id = ++_tid;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3100);
  }, []);
  return { toasts, push };
};

/* ── Page ───────────────────────────────────────────────── */
const RiskManagement = () => {
  const [loading, setLoading] = useState(true);

  const [blacklist, setBlacklist] = useState(SEED_BLACKLIST);
  const [rules, setRules]         = useState(SEED_RULES);

  /* modal states */
  const [blModal, setBlModal]   = useState({ open:false, mode:'single' });
  const [ruleModal, setRuleModal] = useState({ open:false, editData:null });

  const { toasts, push } = useToast();

  /* ── Blacklist handlers ── */
  const handleBlSubmit = (mode, items) => {
    const now = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    const newItems = items.map(it => ({ ...it, addedAt: it.addedAt || now }));
    setBlacklist(p => [...newItems, ...p]);
    push(
      mode === 'bulk'
        ? `${items.length} rekening berhasil diimport, menunggu verifikasi.`
        : `Rekening ${items[0].accountNumber} ditambahkan ke blacklist.`,
      'success'
    );
  };

  const handleBlDelete = (id) => {
    const item = blacklist.find(b => b.id === id);
    setBlacklist(p => p.filter(b => b.id !== id));
    push(`Rekening ${item?.accountNumber} dihapus dari blacklist.`, 'error');
  };

  const handleBlApprove = (id) => {
    setBlacklist(p => p.map(b => b.id === id ? { ...b, status:'active' } : b));
    push('Rekening disetujui dan sekarang aktif diblokir.', 'info');
  };

  /* ── Rule handlers ── */
  const handleRuleSubmit = (data) => {
    if (data.id && rules.find(r => r.id === data.id)) {
      setRules(p => p.map(r => r.id === data.id ? { ...r, ...data } : r));
      push(`Rule "${data.name}" berhasil diperbarui.`, 'info');
    } else {
      setRules(p => [{ ...data, enabled:true, hitCount:0 }, ...p]);
      push(`Rule "${data.name}" berhasil dibuat.`, 'success');
    }
  };

  const handleRuleDelete = (id) => {
    const rule = rules.find(r => r.id === id);
    setRules(p => p.filter(r => r.id !== id));
    push(`Rule "${rule?.name}" dihapus.`, 'error');
  };

  const handleRuleToggle = (id) => {
    setRules(p => p.map(r => {
      if (r.id !== id) return r;
      const next = !r.enabled;
      push(`Rule "${r.name}" ${next ? 'diaktifkan' : 'dinonaktifkan'}.`, next ? 'success' : 'warn');
      return { ...r, enabled: next };
    }));
  };

  const toastIcon = t =>
    t === 'success' ? 'bi-check-circle-fill' :
    t === 'error'   ? 'bi-trash-fill' :
    t === 'warn'    ? 'bi-exclamation-triangle-fill' :
                      'bi-info-circle-fill';

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <PageLoader message="Memuat Risk Management..." />;

  return (
    <div className="rm-page">

      {/* Header */}
      <div className="rm-header">
        <div className="rm-header-left">
          <div className="rm-header-icon">
            <i className="bi bi-shield-fill-exclamation" />
          </div>
          <div>
            <h1 className="rm-page-title">Risk Management</h1>
            <p className="rm-page-subtitle">
              Blacklist rekening penipu & konfigurasi rule otomatis sebelum transaksi masuk ke Manual Review
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <RiskStats blacklist={blacklist} rules={rules} />

      {/* Blacklist Panel */}
      <BlacklistPanel
        data={blacklist}
        onAdd={() => setBlModal({ open:true, mode:'single' })}
        onBulkImport={() => setBlModal({ open:true, mode:'bulk' })}
        onDelete={handleBlDelete}
        onApprove={handleBlApprove}
      />

      {/* Rule Engine */}
      <RuleEngine
        rules={rules}
        onAdd={() => setRuleModal({ open:true, editData:null })}
        onEdit={rule => setRuleModal({ open:true, editData:rule })}
        onDelete={handleRuleDelete}
        onToggle={handleRuleToggle}
      />

      {/* Modals */}
      <BlacklistModal
        isOpen={blModal.open}
        mode={blModal.mode}
        onClose={() => setBlModal({ open:false, mode:'single' })}
        onSubmit={handleBlSubmit}
      />

      <RuleModal
        isOpen={ruleModal.open}
        editData={ruleModal.editData}
        onClose={() => setRuleModal({ open:false, editData:null })}
        onSubmit={handleRuleSubmit}
      />

      {/* Toasts */}
      <div className="rm-toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`rm-toast t-${t.type}`}>
            <i className={`bi ${toastIcon(t.type)}`} /> {t.msg}
          </div>
        ))}
      </div>

    </div>
  );
};

export default RiskManagement;