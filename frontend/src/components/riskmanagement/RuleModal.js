import React, { useState, useEffect } from 'react';
import './RuleModal.css';

const ACTIONS = [
  { value:'block',  label:'BLOKIR',  icon:'bi-ban',            desc:'Tolak transaksi otomatis',   cls:'sel-block'  },
  { value:'flag',   label:'FLAG',    icon:'bi-flag-fill',       desc:'Tandai sebagai mencurigakan', cls:'sel-flag'   },
  { value:'review', label:'REVIEW',  icon:'bi-clipboard-check', desc:'Kirim ke Manual Review',     cls:'sel-review' },
];

const FIELDS = [
  'Jumlah Transaksi (Rp)','Frekuensi (per jam)','Frekuensi (per hari)',
  'Usia Akun (hari)','Jumlah Kumulatif (hari ini)','Jam Transaksi',
  'Jarak Lokasi (km)','Tipe Merchant','Kode Negara Tujuan',
];

const OPS = ['>', '<', '>=', '<=', '=', '≠', 'termasuk', 'tidak termasuk'];

const EMPTY = {
  name:'', description:'', priority:5, action:'flag',
  condField: FIELDS[0], condOp:'>', condValue:'', condValue2:'',
  enableTimeWindow: false, timeWindowHours:1,
  notes:'',
};

const RuleModal = ({ isOpen, onClose, onSubmit, editData }) => {
  const [form, setForm]     = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(editData);

  useEffect(() => {
    if (isOpen) {
      setForm(isEdit ? { ...EMPTY, ...editData } : EMPTY);
      setErrors({});
      setLoading(false);
    }
  }, [isOpen, editData]);

  if (!isOpen) return null;

  const set = (f, v) => {
    setForm(p => ({ ...p, [f]: v }));
    if (errors[f]) setErrors(p => ({ ...p, [f]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())       e.name       = 'Nama rule wajib diisi.';
    if (!form.condValue.trim())  e.condValue  = 'Nilai kondisi wajib diisi.';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 450));
    const now = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    onSubmit({
      ...form,
      id: editData?.id || Date.now(),
      enabled: editData?.enabled ?? true,
      hitCount: editData?.hitCount ?? 0,
      createdAt: editData?.createdAt || now,
      condition: buildConditionText(form),
    });
    setLoading(false);
    onClose();
  };

  const buildConditionText = (f) => {
    let text = `${f.condField} ${f.condOp} ${f.condValue}`;
    if (f.condValue2) text += ` dan ${f.condValue2}`;
    if (f.enableTimeWindow) text += ` (dalam ${f.timeWindowHours} jam)`;
    return text;
  };

  const previewText = buildConditionText(form);

  const F = ({ label, req, opt, err, children }) => (
    <div className="rum-field">
      <label className="rum-label">
        {label}
        {req && <span className="rum-req"> *</span>}
        {opt && <span className="rum-opt"> (opsional)</span>}
      </label>
      {children}
      {err && <span className="rum-field-err"><i className="bi bi-exclamation-circle-fill" /> {err}</span>}
    </div>
  );

  return (
    <div className="rum-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rum-box">

        {/* Header */}
        <div className="rum-header">
          <div className="rum-header-left">
            <div className="rum-icon"><i className="bi bi-gear-fill" /></div>
            <div>
              <div className="rum-title">{isEdit ? 'Edit Rule' : 'Tambah Rule Baru'}</div>
              <div className="rum-subtitle">Definisikan kondisi dan aksi yang akan diterapkan</div>
            </div>
          </div>
          <button className="rum-close" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        {/* Body */}
        <div className="rum-body">

          {/* Identitas */}
          <div className="rum-section"><span>Identitas Rule</span></div>

          <F label="Nama Rule" req err={errors.name}>
            <input
              className={`rum-input ${errors.name ? 'err' : ''}`}
              type="text"
              placeholder="cth: Transaksi Besar Akun Baru"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              autoFocus
            />
          </F>

          <div className="rum-row">
            <F label="Deskripsi" opt>
              <input
                className="rum-input"
                type="text"
                placeholder="cth: Nominal > 50jt dari akun < 7 hari"
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
            </F>
            <F label="Prioritas (1=tertinggi)">
              <input
                className="rum-input"
                type="number"
                min={1} max={10}
                value={form.priority}
                onChange={e => set('priority', Math.max(1, Math.min(10, Number(e.target.value))))}
              />
            </F>
          </div>

          {/* Kondisi */}
          <div className="rum-section"><span>Kondisi Pemicu</span></div>

          <div className="rum-condition-builder">
            <div className="rum-cb-row">
              <span className="rum-cb-label">JIKA</span>
              <div style={{ position:'relative', flex:1 }}>
                <select
                  className="rum-cb-select"
                  style={{ width:'100%' }}
                  value={form.condField}
                  onChange={e => set('condField', e.target.value)}
                >
                  {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="rum-cb-row">
              <select
                className="rum-cb-select"
                value={form.condOp}
                onChange={e => set('condOp', e.target.value)}
              >
                {OPS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <input
                className={`rum-cb-input ${errors.condValue ? 'err' : ''}`}
                type="text"
                placeholder="Nilai"
                value={form.condValue}
                onChange={e => set('condValue', e.target.value)}
                style={{ flex:1, width:'auto' }}
              />
              {errors.condValue && (
                <span style={{ fontSize:'.72rem', color:'#dc2626' }}>Wajib diisi</span>
              )}
            </div>
            <div className="rum-cb-row">
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.78rem', color:'#6b7280', cursor:'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.enableTimeWindow}
                  onChange={e => set('enableTimeWindow', e.target.checked)}
                />
                Dalam rentang waktu
              </label>
              {form.enableTimeWindow && (
                <>
                  <input
                    className="rum-cb-input"
                    type="number"
                    min={1}
                    value={form.timeWindowHours}
                    onChange={e => set('timeWindowHours', Number(e.target.value))}
                  />
                  <span className="rum-cb-label">jam</span>
                </>
              )}
            </div>
            <div className="rum-preview-text">
              🔍 {previewText || '— isi kondisi di atas —'}
            </div>
          </div>

          {/* Aksi */}
          <div className="rum-section"><span>Aksi yang Diambil</span></div>

          <div className="rum-action-preview">
            {ACTIONS.map(a => (
              <div
                key={a.value}
                className={`rum-ap-card ${form.action === a.value ? a.cls : ''}`}
                onClick={() => set('action', a.value)}
              >
                <i className={`bi ${a.icon} rum-ap-icon`} />
                <div className="rum-ap-label">{a.label}</div>
                <div className="rum-ap-desc">{a.desc}</div>
              </div>
            ))}
          </div>

          {/* Catatan */}
          <F label="Catatan Internal" opt>
            <textarea
              className="rum-textarea"
              placeholder="Referensi regulasi, alasan bisnis, dsb..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </F>

        </div>

        {/* Footer */}
        <div className="rum-footer">
          <button className="rum-btn-cancel" onClick={onClose} disabled={loading}>Batal</button>
          <button className="rum-btn-submit" onClick={handleSubmit} disabled={loading}>
            {loading
              ? <><span className="rum-spinner" />Menyimpan...</>
              : <><i className={`bi ${isEdit ? 'bi-check-lg' : 'bi-gear-fill'}`} />{isEdit ? 'Simpan Perubahan' : 'Buat Rule'}</>
            }
          </button>
        </div>

      </div>
    </div>
  );
};

export default RuleModal;