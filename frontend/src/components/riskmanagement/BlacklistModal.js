import React, { useState, useEffect, useRef } from 'react';
import './BlacklistModal.css';

const BANKS = [
  'BCA','BRI','BNI','Mandiri','BSI','CIMB Niaga','Danamon',
  'Permata','BTN','Maybank','OCBC','Panin','BNC','Jenius','GoPay','OVO','Dana',
];

const REASONS = [
  'Penipuan Online','Rekening Mule','Phishing','Social Engineering',
  'Investasi Bodong','Jual Beli Palsu','Pinjol Ilegal','Lainnya',
];

const EMPTY = {
  accountNumber: '', accountName: '', bank: '',
  reason: '', reasonDetail: '', source: 'manual',
};

/* ── Parse bulk text ──────────────────────────────────────────────
   Supports formats:
   1234567890|Budi Santoso|BCA|Penipuan
   1234567890,Budi Santoso,BCA,Penipuan
   1234567890 Budi Santoso BCA Penipuan   (space-separated, 4 tokens)
──────────────────────────────────────────────────────────────── */
const parseBulk = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.reduce((acc, line) => {
    const parts = line.includes('|') ? line.split('|')
                : line.includes(',') ? line.split(',')
                : line.split(/\s+/);
    if (parts.length >= 1 && parts[0].trim()) {
      acc.push({
        accountNumber: parts[0]?.trim() || '',
        accountName:   parts[1]?.trim() || '',
        bank:          parts[2]?.trim() || '',
        reason:        parts[3]?.trim() || 'Penipuan Online',
        source:        'import',
      });
    }
    return acc;
  }, []);
};

const BlacklistModal = ({ isOpen, mode: initMode = 'single', onClose, onSubmit }) => {
  const [tab, setTab]             = useState(initMode);
  const [form, setForm]           = useState(EMPTY);
  const [errors, setErrors]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [bulkText, setBulkText]   = useState('');
  const [dragOver, setDragOver]   = useState(false);
  const fileRef                   = useRef();

  useEffect(() => {
    if (isOpen) {
      setTab(initMode);
      setForm(EMPTY);
      setErrors({});
      setBulkText('');
      setLoading(false);
    }
  }, [isOpen, initMode]);

  if (!isOpen) return null;

  const set = (f, v) => {
    setForm(p => ({ ...p, [f]: v }));
    if (errors[f]) setErrors(p => ({ ...p, [f]: undefined }));
  };

  /* ── Single validate ── */
  const validateSingle = () => {
    const e = {};
    if (!form.accountNumber.trim()) e.accountNumber = 'Nomor rekening wajib diisi.';
    else if (!/^\d{6,20}$/.test(form.accountNumber.replace(/\s/g, '')))
      e.accountNumber = 'Format nomor tidak valid (6–20 digit).';
    if (!form.accountName.trim()) e.accountName = 'Nama pemilik wajib diisi.';
    if (!form.bank) e.bank = 'Pilih bank.';
    if (!form.reason) e.reason = 'Pilih alasan.';
    return e;
  };

  const handleSubmitSingle = async () => {
    const e = validateSingle();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 450));
    onSubmit('single', [{ ...form, id: Date.now(), status: 'pending', hitCount: 0 }]);
    setLoading(false);
    onClose();
  };

  /* ── Bulk ── */
  const parsed    = parseBulk(bulkText);
  const validRows = parsed.filter(p => p.accountNumber);

  const handleSubmitBulk = async () => {
    if (!validRows.length) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    const now = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    onSubmit('bulk', validRows.map((r, i) => ({
      ...r,
      id: Date.now() + i,
      status: 'pending',
      hitCount: 0,
      addedAt: now,
      reason: r.reason || 'Penipuan Online',
    })));
    setLoading(false);
    onClose();
  };

  /* ── Drag & drop file ── */
  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setBulkText(e.target.result);
    reader.readAsText(file);
  };

  const F = ({ label, req, opt, err, children }) => (
    <div className="blm-field">
      <label className="blm-label">
        {label}
        {req && <span className="blm-req"> *</span>}
        {opt && <span className="blm-opt"> (opsional)</span>}
      </label>
      {children}
      {err && <span className="blm-field-err"><i className="bi bi-exclamation-circle-fill" /> {err}</span>}
    </div>
  );

  return (
    <div className="blm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="blm-box">

        {/* Header */}
        <div className="blm-header">
          <div className="blm-header-left">
            <div className="blm-icon"><i className="bi bi-ban" /></div>
            <div>
              <div className="blm-title">Tambah ke Blacklist</div>
              <div className="blm-subtitle">Input manual rekening penipu atau import daftar</div>
            </div>
          </div>
          <button className="blm-close" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        {/* Tabs */}
        <div className="blm-tabs">
          <button className={`blm-tab ${tab === 'single' ? 'active' : ''}`} onClick={() => setTab('single')}>
            <i className="bi bi-plus-circle" /> Input Manual
          </button>
          <button className={`blm-tab ${tab === 'bulk' ? 'active' : ''}`} onClick={() => setTab('bulk')}>
            <i className="bi bi-upload" /> Bulk Import
          </button>
        </div>

        {/* Body */}
        <div className="blm-body">

          {tab === 'single' && <>
            <div className="blm-section"><span>Informasi Rekening</span></div>

            <F label="Nomor Rekening" req err={errors.accountNumber}>
              <input
                className={`blm-input ${errors.accountNumber ? 'err' : ''}`}
                type="text"
                placeholder="cth: 1234567890"
                value={form.accountNumber}
                onChange={e => set('accountNumber', e.target.value)}
                autoFocus
              />
            </F>

            <div className="blm-row">
              <F label="Nama Pemilik Rekening" req err={errors.accountName}>
                <input
                  className={`blm-input ${errors.accountName ? 'err' : ''}`}
                  type="text"
                  placeholder="cth: Budi Penipu"
                  value={form.accountName}
                  onChange={e => set('accountName', e.target.value)}
                />
              </F>
              <F label="Bank" req err={errors.bank}>
                <div className="blm-select-wrap">
                  <select
                    className={`blm-select ${errors.bank ? 'err' : ''}`}
                    value={form.bank}
                    onChange={e => set('bank', e.target.value)}
                  >
                    <option value="">— Pilih Bank —</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </F>
            </div>

            <div className="blm-section"><span>Alasan & Sumber</span></div>

            <div className="blm-row">
              <F label="Alasan Blacklist" req err={errors.reason}>
                <div className="blm-select-wrap">
                  <select
                    className={`blm-select ${errors.reason ? 'err' : ''}`}
                    value={form.reason}
                    onChange={e => set('reason', e.target.value)}
                  >
                    <option value="">— Pilih Alasan —</option>
                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </F>
              <F label="Sumber Informasi">
                <div className="blm-select-wrap">
                  <select className="blm-select" value={form.source} onChange={e => set('source', e.target.value)}>
                    <option value="manual">Input Manual</option>
                    <option value="system">Auto-Detect</option>
                  </select>
                </div>
              </F>
            </div>

            <F label="Keterangan Tambahan" opt>
              <textarea
                className="blm-textarea"
                placeholder="Deskripsi lebih lanjut mengenai modus penipuan..."
                value={form.reasonDetail}
                onChange={e => set('reasonDetail', e.target.value)}
              />
            </F>
          </>}

          {tab === 'bulk' && <>
            {/* Drop zone */}
            <div
              className={`blm-drop-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
            >
              <i className="bi bi-cloud-upload" />
              <div className="blm-drop-title">Seret & lepas file CSV/TXT di sini</div>
              <div className="blm-drop-sub">atau <span className="blm-drop-link">pilih file</span></div>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:'none' }}
                onChange={e => handleFile(e.target.files[0])} />
            </div>

            <div className="blm-bulk-hint">
              <strong>Format yang didukung</strong> (satu baris per rekening):<br />
              <code>NomorRekening | NamaPemilik | Bank | Alasan</code><br />
              <code>NomorRekening , NamaPemilik , Bank , Alasan</code><br />
              Kolom <em>NamaPemilik</em>, <em>Bank</em>, dan <em>Alasan</em> bersifat opsional.
            </div>

            <F label="Atau paste daftar langsung">
              <textarea
                className="blm-bulk-textarea"
                placeholder={`Contoh:\n1234567890 | Budi Santoso | BCA | Penipuan Online\n0987654321 | Sari Penipu | BRI | Rekening Mule\n5566778899 | Agus Bohong | Mandiri`}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
              />
            </F>

            {validRows.length > 0 && (
              <div className="blm-parse-preview">
                <i className="bi bi-check-circle-fill" />
                {validRows.length} rekening siap diimpor — semua akan masuk status <strong>Pending</strong> untuk ditinjau
              </div>
            )}
          </>}

        </div>

        {/* Footer */}
        <div className="blm-footer">
          <button className="blm-btn-cancel" onClick={onClose} disabled={loading}>Batal</button>
          <button
            className="blm-btn-submit"
            onClick={tab === 'single' ? handleSubmitSingle : handleSubmitBulk}
            disabled={loading || (tab === 'bulk' && validRows.length === 0)}
          >
            {loading
              ? <><span className="blm-spinner" />Menyimpan...</>
              : tab === 'single'
                ? <><i className="bi bi-ban" />Tambah ke Blacklist</>
                : <><i className="bi bi-upload" />Import {validRows.length > 0 ? `${validRows.length} Rekening` : ''}</>
            }
          </button>
        </div>

      </div>
    </div>
  );
};

export default BlacklistModal;