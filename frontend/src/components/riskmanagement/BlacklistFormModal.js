import React, { useState, useEffect, useRef } from "react";
import "./BlacklistFormModal.css";

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

const REASONS = [
  "Penipuan Online",
  "Rekening Mule",
  "Phishing",
  "Social Engineering",
  "Investasi Bodong",
  "Jual Beli Palsu",
  "Pinjol Ilegal",
  "Lainnya",
];

const EMPTY = {
  accountNumber: "",
  accountName: "",
  bank: "BCA",
  reason: "Penipuan Online",
  reasonDetail: "",
  status: "active",
  source: "manual",
};

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
        reason: REASONS.includes(parts[3]) ? parts[3] : "Lainnya",
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
    {hint && (
      <span className="bfm-field-hint">
        <i className="bi bi-lock-fill" /> {hint}
      </span>
    )}
  </div>
);

const BlacklistFormModal = ({ isOpen, mode, editData, onClose, onSubmit }) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [bulkParsed, setBulkParsed] = useState([]);
  const [bulkError, setBulkError] = useState("");

  const firstRef = useRef();
  const isEdit = Boolean(editData);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "single") {
      setForm(isEdit ? { ...EMPTY, ...editData } : { ...EMPTY });
      setErrors({});
    } else {
      setBulkText("");
      setBulkParsed([]);
      setBulkError("");
    }
    setLoading(false);
    setTimeout(() => firstRef.current?.focus(), 60);
  }, [isOpen, mode, editData]);

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

  const set = (f, v) => {
    setForm((p) => ({ ...p, [f]: v }));
    if (errors[f]) setErrors((p) => ({ ...p, [f]: undefined }));
  };

  const validateSingle = () => {
    const e = {};
    if (!form.accountNumber.trim())
      e.accountNumber = "Nomor rekening wajib diisi.";
    else if (!/^\d{6,20}$/.test(form.accountNumber))
      e.accountNumber = "Masukkan 6–20 digit angka.";
    if (!form.accountName.trim()) e.accountName = "Nama pemilik wajib diisi.";
    return e;
  };

  const handleSingleSubmit = async () => {
    const e = validateSingle();
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
    onSubmit(isEdit ? "edit" : "single", [
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

  const handleBulkChange = (text) => {
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

  const handleBulkSubmit = async () => {
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

  const isBulk = mode === "bulk";
  const headerIcon = isBulk
    ? "bi-upload"
    : isEdit
      ? "bi-pencil"
      : "bi-shield-plus";
  const headerTitle = isBulk
    ? "Bulk Import Blacklist"
    : isEdit
      ? "Edit Data Blacklist"
      : "Tambah Rekening Blacklist";
  const headerSub = isBulk
    ? "Import banyak rekening sekaligus dari teks CSV"
    : isEdit
      ? "Perbarui informasi rekening yang sudah ada"
      : "Tambahkan rekening baru ke daftar blacklist";

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

        {!isBulk && (
          <>
            <div className="bfm-body">
              <Field
                label="Nomor Rekening"
                req
                err={errors.accountNumber}
                hint={isEdit ? "Nomor rekening tidak dapat diubah" : null}
              >
                <input
                  ref={!isEdit ? firstRef : undefined}
                  className={`bfm-input bfm-mono ${errors.accountNumber ? "err" : ""}`}
                  type="text"
                  inputMode="numeric"
                  placeholder="cth: 1234567890"
                  value={form.accountNumber}
                  onChange={(e) =>
                    set("accountNumber", e.target.value.replace(/\D/g, ""))
                  }
                  maxLength={20}
                  disabled={isEdit}
                />
              </Field>

              <Field label="Nama Pemilik" req err={errors.accountName}>
                <input
                  ref={isEdit ? firstRef : undefined}
                  className={`bfm-input ${errors.accountName ? "err" : ""}`}
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
                      {REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
              </div>

              {isEdit && (
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
              )}

              <Field label="Keterangan Tambahan" opt>
                <textarea
                  className="bfm-textarea"
                  placeholder="Deskripsikan bukti, nomor laporan, atau detail lainnya..."
                  value={form.reasonDetail}
                  onChange={(e) => set("reasonDetail", e.target.value)}
                  rows={3}
                />
              </Field>

              {!isEdit && (
                <div className="bfm-info-badge">
                  <i className="bi bi-shield-fill-check" />
                  <span>
                    Rekening baru akan langsung berstatus{" "}
                    <strong>Aktif Blokir</strong> dan memblokir semua transaksi
                    masuk.
                  </span>
                </div>
              )}
            </div>

            <div className="bfm-footer">
              <button
                className="bfm-btn-cancel"
                onClick={onClose}
                disabled={loading}
              >
                Batal
              </button>
              <button
                className="bfm-btn-submit"
                onClick={handleSingleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="bfm-spinner" /> Menyimpan...
                  </>
                ) : (
                  <>
                    <i
                      className={`bi ${isEdit ? "bi-check-lg" : "bi-shield-plus"}`}
                    />
                    {isEdit ? "Simpan Perubahan" : "Tambah ke Blacklist"}
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {isBulk && (
          <>
            <div className="bfm-body">
              <div className="bfm-format-box">
                <div className="bfm-format-title">
                  <i className="bi bi-file-text" />
                  Format CSV (satu baris per rekening)
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
                  <i className="bi bi-info-circle" />
                  Bank yang valid: {BANKS.slice(0, 6).join(", ")}, dst. Kolom
                  Nama, Bank, Alasan bersifat opsional.
                </div>
              </div>

              <Field label="Data Rekening" req err={bulkError}>
                <textarea
                  ref={firstRef}
                  className={`bfm-textarea bfm-textarea-bulk bfm-mono ${bulkError ? "err" : ""}`}
                  placeholder={
                    "1234567890,Budi Santoso,BCA,Penipuan Online\n" +
                    "0987654321,Sari Bohong,BRI,Rekening Mule\n" +
                    "..."
                  }
                  value={bulkText}
                  onChange={(e) => handleBulkChange(e.target.value)}
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
              <button
                className="bfm-btn-cancel"
                onClick={onClose}
                disabled={loading}
              >
                Batal
              </button>
              <button
                className="bfm-btn-submit"
                onClick={handleBulkSubmit}
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
                    {bulkParsed.length > 0
                      ? ` ${bulkParsed.length} Rekening`
                      : ""}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BlacklistFormModal;
