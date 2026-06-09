import React, { useState, useEffect, useRef } from "react";
import "./BlacklistFormModal.css";

const TYPE_MAP = {
  ALL: [
    {
      group: "AGENUSA & NUSABILL",
      types: [
        { v: "USER_ID", l: "User ID", hint: "Disimpan lowercase", cs: false },
        {
          v: "CUSTOMER_ID",
          l: "Customer ID",
          hint: "Disimpan lowercase",
          cs: false,
        },
        {
          v: "MERCHANT_ID",
          l: "Merchant ID",
          hint: "AGENUSA: merchant_id | NUSABILL: kode_pembayaran — case-sensitive",
          cs: true,
        },
      ],
    },
    {
      group: "AGENUSA only",
      types: [
        {
          v: "IP_ADDRESS",
          l: "IP Address",
          hint: "Format IPv4/IPv6 — disimpan lowercase",
          cs: false,
        },
        {
          v: "TERMINAL_ID",
          l: "Terminal ID",
          hint: "terminal_id dari payload AGENUSA — case-sensitive",
          cs: true,
        },
        {
          v: "ACCOUNT_NUMBER",
          l: "Account Number",
          hint: "account_number / issuer_account_number / dest_account_number — case-sensitive",
          cs: true,
        },
      ],
    },
  ],
  AGENUSA: [
    {
      group: "Aktif dicek",
      types: [
        {
          v: "USER_ID",
          l: "User ID",
          hint: "customer_ref_number — lowercase",
          cs: false,
        },
        {
          v: "CUSTOMER_ID",
          l: "Customer ID",
          hint: "Alias user_account_id — lowercase",
          cs: false,
        },
        {
          v: "IP_ADDRESS",
          l: "IP Address",
          hint: "Format IPv4/IPv6 — lowercase",
          cs: false,
        },
        {
          v: "MERCHANT_ID",
          l: "Merchant ID",
          hint: "merchant_id dari payload — case-sensitive",
          cs: true,
        },
        {
          v: "TERMINAL_ID",
          l: "Terminal ID",
          hint: "terminal_id dari payload — case-sensitive",
          cs: true,
        },
        {
          v: "ACCOUNT_NUMBER",
          l: "Account Number",
          hint: "account_number / issuer_account_number / dest_account_number — case-sensitive",
          cs: true,
        },
      ],
    },
  ],
  NUSABILL: [
    {
      group: "Aktif dicek",
      types: [
        {
          v: "USER_ID",
          l: "User ID",
          hint: "customer_id dari payload NUSABILL — lowercase",
          cs: false,
        },
        {
          v: "CUSTOMER_ID",
          l: "Customer ID",
          hint: "Alias user_account_id — lowercase",
          cs: false,
        },
        {
          v: "MERCHANT_ID",
          l: "Merchant ID",
          hint: "kode_pembayaran dari payload NUSABILL — case-sensitive",
          cs: true,
        },
      ],
    },
  ],
};

const SCOPE_HINTS = {
  ALL: "Berlaku untuk semua layanan. Dropdown tipe menyesuaikan otomatis.",
  AGENUSA: "Hanya berlaku saat transaksi AGENUSA masuk ke engine.",
  NUSABILL: "Hanya berlaku saat transaksi NUSABILL masuk ke engine.",
};

const SCOPE_ICONS = {
  ALL: "bi-globe",
  AGENUSA: "bi-building-bank",
  NUSABILL: "bi-receipt",
};

const BANKS = [
  "BCA",
  "BRI",
  "Mandiri",
  "BNI",
  "BSI",
  "CIMB Niaga",
  "Danamon",
  "Permata",
  "BTN",
  "Maybank",
  "OCBC",
  "Panin",
  "Lainnya",
];
const REASONS_BULK = [
  "Penipuan Online",
  "Rekening Mule",
  "Phishing",
  "Social Engineering",
  "Investasi Bodong",
  "Jual Beli Palsu",
  "Pinjol Ilegal",
  "Lainnya",
];

const flatTypes = (scope) => TYPE_MAP[scope].flatMap((g) => g.types);

const getTypeInfo = (scope, typeVal) =>
  flatTypes(scope).find((t) => t.v === typeVal) || null;

const normVal = (raw, typeInfo) =>
  typeInfo?.cs ? raw.trim() : raw.trim().toLowerCase();

const parseBulkText = (text) => {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines
    .map((line, i) => {
      const parts = line.split(",").map((s) => s.trim());
      const acct = parts[0]?.replace(/\D/g, "") || "";
      if (!acct) return null;
      return {
        id: Date.now() + i,
        accountNumber: acct,
        accountName: parts[1] || "",
        bank: BANKS.includes(parts[2]) ? parts[2] : "Lainnya",
        reason: REASONS_BULK.includes(parts[3]) ? parts[3] : "Lainnya",
        source: "import",
        status: "pending",
        hitCount: 0,
      };
    })
    .filter(Boolean);
};

const Field = ({ label, req, opt, err, hint, children }) => (
  <div className="bfm-field">
    <label className="bfm-label">
      {label}
      {req && <span className="bfm-req"> *</span>}
      {opt && <span className="bfm-opt"> (opsional)</span>}
    </label>
    {children}
    {err && (
      <span className="bfm-field-err">
        <i className="bi bi-exclamation-circle-fill" /> {err}
      </span>
    )}
    {hint && !err && (
      <span className="bfm-field-hint">
        <i className="bi bi-info-circle" /> {hint}
      </span>
    )}
  </div>
);

const SectionLabel = ({ children, first }) => (
  <div className={`bfm-section-label${first ? " first" : ""}`}>{children}</div>
);

const AddForm = ({ onClose, onSubmit }) => {
  const [scope, setScope] = useState("ALL");
  const [type, setType] = useState("");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const typeInfo = type ? getTypeInfo(scope, type) : null;
  const normed = typeInfo && value.trim() ? normVal(value, typeInfo) : null;
  const showChip = normed !== null && normed !== value.trim();

  useEffect(() => {
    const available = flatTypes(scope).map((t) => t.v);
    if (type && !available.includes(type)) {
      setType("");
      setValue("");
    }
  }, [scope]);

  const handleScope = (s) => {
    setScope(s);
    setErrors({});
  };

  const handleType = (v) => {
    setType(v);
    setValue("");
    if (errors.type) setErrors((p) => ({ ...p, type: undefined }));
  };

  const handleValue = (v) => {
    setValue(v);
    if (errors.value) setErrors((p) => ({ ...p, value: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!type) e.type = "Pilih tipe terlebih dahulu.";
    if (!value.trim()) e.value = "Nilai wajib diisi.";
    if (!reason.trim()) e.reason = "Alasan wajib diisi.";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 420));
    const finalValue = normVal(value, typeInfo);
    onSubmit("single", [
      {
        id: Date.now(),
        value: finalValue,
        type,
        service_scope: scope,
        reason,
        source: "MANUAL",
        status: "PENDING",
        is_active: false,
      },
    ]);
    setLoading(false);
    onClose();
  };

  const isValid = type && value.trim() && reason.trim();

  return (
    <>
      <div className="bfm-body">
        <SectionLabel first>Cakupan layanan</SectionLabel>
        <Field label="Service scope" req>
          <div className="bfm-scope-row">
            {["ALL", "AGENUSA", "NUSABILL"].map((s) => (
              <button
                key={s}
                type="button"
                className={`bfm-scope-pill${scope === s ? " active-" + s : ""}`}
                onClick={() => handleScope(s)}
              >
                <i className={`bi ${SCOPE_ICONS[s]}`} />
                {s}
              </button>
            ))}
          </div>
          <span className="bfm-field-hint" style={{ marginTop: 6 }}>
            <i className="bi bi-info-circle" /> {SCOPE_HINTS[scope]}
          </span>
        </Field>

        <SectionLabel>Identitas</SectionLabel>
        <div className="bfm-row">
          <Field label="Tipe" req err={errors.type}>
            <div className="bfm-select-wrap">
              <select
                className={`bfm-select${errors.type ? " err" : ""}`}
                value={type}
                onChange={(e) => handleType(e.target.value)}
              >
                <option value="">Pilih tipe...</option>
                {TYPE_MAP[scope].map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.types.map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.l}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </Field>

          <Field
            label={
              <span>
                Nilai
                {showChip && <span className="bfm-norm-chip">→ {normed}</span>}
              </span>
            }
            req
            err={errors.value}
            hint={typeInfo ? typeInfo.hint : "Pilih tipe terlebih dahulu"}
          >
            <input
              className={`bfm-input${errors.value ? " err" : ""}`}
              type="text"
              placeholder={type ? "Masukkan nilai..." : "—"}
              disabled={!type}
              value={value}
              onChange={(e) => handleValue(e.target.value)}
            />
          </Field>
        </div>

        <SectionLabel>Alasan</SectionLabel>
        <Field label="Reason" req err={errors.reason}>
          <textarea
            className={`bfm-textarea${errors.reason ? " err" : ""}`}
            rows={3}
            placeholder="Mis. Terindikasi fraud berulang berdasarkan laporan internal..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (errors.reason)
                setErrors((p) => ({ ...p, reason: undefined }));
            }}
          />
        </Field>

        <div className="bfm-info-badge bfm-info-badge--warning">
          <i className="bi bi-clock-history" />
          <span>
            Entri baru akan berstatus <strong>PENDING</strong> dan{" "}
            <strong>is_active: false</strong> — menunggu review sebelum aktif
            memblokir.
          </span>
        </div>
      </div>

      <div className="bfm-footer">
        <button className="bfm-btn-cancel" onClick={onClose} disabled={loading}>
          Batal
        </button>
        <button
          className="bfm-btn-submit"
          onClick={handleSubmit}
          disabled={loading || !isValid}
        >
          {loading ? (
            <>
              <span className="bfm-spinner" /> Memproses...
            </>
          ) : (
            <>
              <i className="bi bi-plus-lg" /> Tambah blacklist
            </>
          )}
        </button>
      </div>
    </>
  );
};

const REASONS_EDIT = [
  "Penipuan Online",
  "Rekening Mule",
  "Phishing",
  "Social Engineering",
  "Investasi Bodong",
  "Jual Beli Palsu",
  "Pinjol Ilegal",
  "Lainnya",
];

const EMPTY_EDIT = {
  accountNumber: "",
  accountName: "",
  bank: "BCA",
  reason: "Penipuan Online",
  reasonDetail: "",
  status: "active",
  source: "manual",
};

const EditForm = ({ editData, onClose, onSubmit }) => {
  const [form, setForm] = useState({ ...EMPTY_EDIT, ...editData });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (f, v) => {
    setForm((p) => ({ ...p, [f]: v }));
    if (errors[f]) setErrors((p) => ({ ...p, [f]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.accountNumber.trim())
      e.accountNumber = "Nomor rekening wajib diisi.";
    else if (!/^\d{6,20}$/.test(form.accountNumber))
      e.accountNumber = "Masukkan 6–20 digit angka.";
    if (!form.accountName.trim()) e.accountName = "Nama pemilik wajib diisi.";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 420));
    const now = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    onSubmit("edit", [
      {
        ...form,
        id: editData?.id || Date.now(),
        hitCount: editData?.hitCount ?? 0,
        addedAt: editData?.addedAt || now,
      },
    ]);
    setLoading(false);
    onClose();
  };

  return (
    <>
      <div className="bfm-body">
        <Field
          label="Nomor Rekening"
          req
          err={errors.accountNumber}
          hint="Nomor rekening tidak dapat diubah"
        >
          <input
            className={`bfm-input bfm-mono${errors.accountNumber ? " err" : ""}`}
            type="text"
            placeholder="cth: 1234567890"
            value={form.accountNumber}
            disabled
            onChange={() => {}}
          />
        </Field>
        <Field label="Nama Pemilik" req err={errors.accountName}>
          <input
            className={`bfm-input${errors.accountName ? " err" : ""}`}
            type="text"
            placeholder="cth: Budi Santoso"
            value={form.accountName}
            onChange={(e) => set("accountName", e.target.value)}
          />
        </Field>
        <div className="bfm-row">
          <Field label="Bank" req>
            <div className="bfm-select-wrap">
              <select
                className="bfm-select"
                value={form.bank}
                onChange={(e) => set("bank", e.target.value)}
              >
                {BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="Alasan Blacklist" req>
            <div className="bfm-select-wrap">
              <select
                className="bfm-select"
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
              >
                {REASONS_EDIT.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </div>
        <div className="bfm-row">
          <Field label="Status">
            <div className="bfm-select-wrap">
              <select
                className="bfm-select"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="active">Aktif Blokir</option>
                <option value="pending">Menunggu Verifikasi</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </Field>
          <Field label="Sumber">
            <div className="bfm-select-wrap">
              <select
                className="bfm-select"
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
              >
                <option value="manual">Input Manual</option>
                <option value="import">Bulk Import</option>
                <option value="system">Auto-Detect</option>
              </select>
            </div>
          </Field>
        </div>
        <Field label="Keterangan Tambahan" opt>
          <textarea
            className="bfm-textarea"
            placeholder="Deskripsikan bukti, nomor laporan, atau detail lainnya..."
            value={form.reasonDetail}
            onChange={(e) => set("reasonDetail", e.target.value)}
            rows={3}
          />
        </Field>
      </div>
      <div className="bfm-footer">
        <button className="bfm-btn-cancel" onClick={onClose} disabled={loading}>
          Batal
        </button>
        <button
          className="bfm-btn-submit"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="bfm-spinner" /> Menyimpan...
            </>
          ) : (
            <>
              <i className="bi bi-check-lg" /> Simpan Perubahan
            </>
          )}
        </button>
      </div>
    </>
  );
};

const BulkForm = ({ onClose, onSubmit }) => {
  const [bulkText, setBulkText] = useState("");
  const [bulkParsed, setBulkParsed] = useState([]);
  const [bulkError, setBulkError] = useState("");
  const [loading, setLoading] = useState(false);
  const firstRef = useRef();

  useEffect(() => {
    setTimeout(() => firstRef.current?.focus(), 60);
  }, []);

  const handleChange = (text) => {
    setBulkText(text);
    setBulkError("");
    if (text.trim()) {
      const parsed = parseBulkText(text);
      setBulkParsed(parsed);
      if (!parsed.length)
        setBulkError(
          "Tidak ada data valid. Format: NoRekening,Nama,Bank,Alasan",
        );
    } else {
      setBulkParsed([]);
    }
  };

  const handleSubmit = async () => {
    if (!bulkParsed.length) {
      setBulkError("Tidak ada data untuk diimport.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 520));
    onSubmit("bulk", bulkParsed);
    setLoading(false);
    onClose();
  };

  return (
    <>
      <div className="bfm-body">
        <div className="bfm-format-box">
          <div className="bfm-format-title">
            <i className="bi bi-file-text" /> Format CSV (satu baris per
            rekening)
          </div>
          <code className="bfm-format-code">
            NoRekening,NamaPemilik,Bank,Alasan
          </code>
          <div className="bfm-format-example">
            <span>Contoh:</span>
            <code>1234567890,Budi Santoso,BCA,Penipuan Online</code>
            <code>0987654321,Sari Bohong,BRI,Rekening Mule</code>
          </div>
          <div className="bfm-format-note">
            <i className="bi bi-info-circle" /> Bank yang valid:{" "}
            {BANKS.slice(0, 6).join(", ")}, dst. Kolom Nama, Bank, Alasan
            bersifat opsional.
          </div>
        </div>

        <Field label="Data Rekening" req err={bulkError}>
          <textarea
            ref={firstRef}
            className={`bfm-textarea bfm-textarea-bulk bfm-mono${bulkError ? " err" : ""}`}
            placeholder={
              "1234567890,Budi Santoso,BCA,Penipuan Online\n0987654321,Sari Bohong,BRI,Rekening Mule\n..."
            }
            value={bulkText}
            onChange={(e) => handleChange(e.target.value)}
            rows={8}
          />
        </Field>

        {bulkParsed.length > 0 && (
          <div className="bfm-bulk-preview">
            <div className="bfm-bulk-preview-header">
              <span className="bfm-bulk-preview-count">
                <i className="bi bi-check-circle-fill" />
                {bulkParsed.length} rekening valid
              </span>
              <span className="bfm-bulk-preview-note">
                Status: Pending — perlu persetujuan admin
              </span>
            </div>
            <div className="bfm-bulk-table-scroll">
              <table className="bfm-bulk-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>No. Rekening</th>
                    <th>Nama</th>
                    <th>Bank</th>
                    <th>Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkParsed.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td className="bfm-bulk-num">{i + 1}</td>
                      <td className="bfm-mono">{row.accountNumber}</td>
                      <td>
                        {row.accountName || (
                          <span style={{ color: "#d1d5db" }}>—</span>
                        )}
                      </td>
                      <td>{row.bank}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                  {bulkParsed.length > 10 && (
                    <tr>
                      <td colSpan={5} className="bfm-bulk-more">
                        ...dan {bulkParsed.length - 10} rekening lainnya
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div className="bfm-footer">
        <button className="bfm-btn-cancel" onClick={onClose} disabled={loading}>
          Batal
        </button>
        <button
          className="bfm-btn-submit"
          onClick={handleSubmit}
          disabled={loading || bulkParsed.length === 0}
        >
          {loading ? (
            <>
              <span className="bfm-spinner" /> Mengimport...
            </>
          ) : (
            <>
              <i className="bi bi-upload" />
              Import
              {bulkParsed.length > 0 ? ` ${bulkParsed.length} Rekening` : ""}
            </>
          )}
        </button>
      </div>
    </>
  );
};

const BlacklistFormModal = ({ isOpen, mode, editData, onClose, onSubmit }) => {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isEdit = Boolean(editData);
  const isBulk = mode === "bulk";

  const headerIcon = isBulk ? "bi-upload" : isEdit ? "bi-pencil" : "bi-ban";
  const headerTitle = isBulk
    ? "Bulk Import Blacklist"
    : isEdit
      ? "Edit Data Blacklist"
      : "Tambah blacklist";
  const headerSub = isBulk
    ? "Import banyak rekening sekaligus dari teks CSV"
    : isEdit
      ? "Perbarui informasi rekening yang sudah ada"
      : "POST /blacklist — source: MANUAL, status awal: PENDING, is_active: false";

  return (
    <div
      className="bfm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bfm-box">
        <div className="bfm-header">
          <div className="bfm-header-left">
            <div
              className={`bfm-icon ${isBulk ? "bulk" : isEdit ? "edit" : "add"}`}
            >
              <i className={`bi ${headerIcon}`} />
            </div>
            <div>
              <div className="bfm-title">{headerTitle}</div>
              <div className="bfm-subtitle">{headerSub}</div>
            </div>
          </div>
          <button className="bfm-close" onClick={onClose} title="Tutup">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {!isBulk && !isEdit && (
          <AddForm key={isOpen} onClose={onClose} onSubmit={onSubmit} />
        )}
        {!isBulk && isEdit && (
          <EditForm
            key={editData?.id}
            editData={editData}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        )}
        {isBulk && (
          <BulkForm key={isOpen} onClose={onClose} onSubmit={onSubmit} />
        )}
      </div>
    </div>
  );
};

export default BlacklistFormModal;
