import React, { useState, useMemo, useRef, useEffect } from "react";
import "./BlacklistPanel.css";
import BlacklistDetailModal from "./BlacklistModal";

const PAGE_SIZE = 10;

const SOURCE_CONFIG = {
  manual: { label: "Input Manual", cls: "src-manual", icon: "bi-person-fill" },
  system: { label: "Auto-Detect", cls: "src-system", icon: "bi-cpu-fill" },
  import: { label: "Bulk Import", cls: "src-import", icon: "bi-upload" },
};

const TYPE_CONFIG = {
  USER_ID: { cls: "blp-type--user", label: "USER_ID", icon: "bi-person-fill" },
  CUSTOMER_ID: {
    cls: "blp-type--customer",
    label: "CUSTOMER_ID",
    icon: "bi-people-fill",
  },
  ACCOUNT_NUMBER: {
    cls: "blp-type--account",
    label: "ACCOUNT_NUMBER",
    icon: "bi-credit-card-fill",
  },
  IP_ADDRESS: { cls: "blp-type--ip", label: "IP_ADDRESS", icon: "bi-globe" },
  TERMINAL_ID: {
    cls: "blp-type--terminal",
    label: "TERMINAL_ID",
    icon: "bi-pc-display",
  },
  MERCHANT_ID: {
    cls: "blp-type--merchant",
    label: "MERCHANT_ID",
    icon: "bi-shop",
  },
  DEVICE_ID: {
    cls: "blp-type--device",
    label: "DEVICE_ID",
    icon: "bi-phone-fill",
  },
  CUSTOMER_EMAIL: {
    cls: "blp-type--email",
    label: "EMAIL",
    icon: "bi-envelope-fill",
  },
  CUSTOMER_PHONE: {
    cls: "blp-type--phone",
    label: "PHONE",
    icon: "bi-telephone-fill",
  },
  INVOICE_NUMBER: {
    cls: "blp-type--invoice",
    label: "INVOICE",
    icon: "bi-receipt",
  },
};

const STATUS_CONFIG = {
  active: { label: "Aktif Blokir", cls: "st-active" },
  pending: { label: "Pending", cls: "st-pending" },
  inactive: { label: "Nonaktif", cls: "st-inactive" },
};

const ColumnDropdown = ({ options, value, onChange, label, anchor }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="blp-col-filter" ref={ref}>
      <button
        className={`blp-col-filter-btn ${value !== "all" ? "active" : ""} ${open ? "open" : ""}`}
        onClick={() => setOpen((p) => !p)}
      >
        {label}
        {value !== "all" && <span className="blp-col-filter-dot" />}
        <i
          className={`bi bi-chevron-${open ? "up" : "down"} blp-col-chevron`}
        />
      </button>
      {open && (
        <div
          className={`blp-col-dropdown ${anchor === "right" ? "anchor-right" : ""}`}
        >
          <div className="blp-col-drop-title">Filter {label}</div>
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`blp-col-drop-item ${value === opt.value ? "selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.icon && <i className={`bi ${opt.icon}`} />}
              {opt.label}
              {value === opt.value && (
                <i className="bi bi-check2 blp-col-check" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const HitSortHeader = ({ hitSort, setHitSort }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const options = [
    { value: "none", label: "Default", icon: "bi-dash" },
    { value: "desc", label: "Terbanyak", icon: "bi-sort-down" },
    { value: "asc", label: "Terkecil", icon: "bi-sort-up" },
  ];

  return (
    <div className="blp-col-filter" ref={ref}>
      <button
        className={`blp-col-filter-btn ${hitSort !== "none" ? "active" : ""} ${open ? "open" : ""}`}
        onClick={() => setOpen((p) => !p)}
      >
        HIT
        {hitSort !== "none" && (
          <i
            className={`bi ${hitSort === "desc" ? "bi-sort-down" : "bi-sort-up"} blp-col-sort-icon`}
          />
        )}
        <i
          className={`bi bi-chevron-${open ? "up" : "down"} blp-col-chevron`}
        />
      </button>
      {open && (
        <div className="blp-col-dropdown anchor-right">
          <div className="blp-col-drop-title">Urutkan Hit</div>
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`blp-col-drop-item ${hitSort === opt.value ? "selected" : ""}`}
              onClick={() => {
                setHitSort(opt.value);
                setOpen(false);
              }}
            >
              <i className={`bi ${opt.icon}`} />
              {opt.label}
              {hitSort === opt.value && (
                <i className="bi bi-check2 blp-col-check" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const DeleteConfirmModal = ({ item, onCancel, onConfirm }) => {
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div
      className="blp-del-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="blp-del-box">
        <div className="blp-del-icon">
          <i className="bi bi-exclamation-triangle-fill" />
        </div>
        <h3 className="blp-del-title">Hapus Rekening Blacklist?</h3>
        <p className="blp-del-msg">
          Data rekening{" "}
          <strong className="blp-del-acct">{item.accountNumber}</strong> atas
          dengan identifier{" "}
          <strong className="blp-mono">{item.accountNumber}</strong> akan{" "}
          <strong>terhapus secara permanen</strong> dan tidak dapat
          dikembalikan.
        </p>
        <div className="blp-del-warning">
          <i className="bi bi-shield-exclamation" />
          Apakah Anda masih ingin melanjutkan?
        </div>
        <div className="blp-del-actions">
          <button className="blp-del-btn-cancel" onClick={onCancel}>
            <i className="bi bi-arrow-left" /> Batal
          </button>
          <button className="blp-del-btn-confirm" onClick={onConfirm}>
            <i className="bi bi-trash3-fill" /> Ya, Hapus Permanen
          </button>
        </div>
      </div>
    </div>
  );
};

const BlacklistPanel = ({
  data,
  onAdd,
  onBulkImport,
  onDelete,
  onApprove,
  onEdit,
  onToggleStatus,
}) => {
  const [search, setSearch] = useState("");
  const [filterSrc, setFilterSrc] = useState("all");
  const [filterSt, setFilterSt] = useState("all");
  const [hitSort, setHitSort] = useState("none");
  const [page, setPage] = useState(1);
  const [detailItem, setDetailItem] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const SOURCE_OPTIONS = [
    { value: "all", label: "Semua Sumber", icon: "bi-funnel" },
    { value: "manual", label: "Input Manual", icon: "bi-person-fill" },
    { value: "import", label: "Bulk Import", icon: "bi-upload" },
    { value: "system", label: "Auto-Detect", icon: "bi-cpu-fill" },
  ];

  const STATUS_OPTIONS = [
    { value: "all", label: "Semua Status", icon: "bi-funnel" },
    { value: "active", label: "Aktif Blokir", icon: "bi-record-circle-fill" },
    { value: "pending", label: "Pending", icon: "bi-clock-fill" },
    { value: "inactive", label: "Nonaktif", icon: "bi-dash-circle" },
  ];

  const filtered = useMemo(() => {
    let result = data.filter((item) => {
      const q = search.toLowerCase();
      const matchQ =
        !q ||
        item.accountNumber.includes(q) ||
        item.accountName.toLowerCase().includes(q) ||
        item.bank.toLowerCase().includes(q);
      const matchSrc = filterSrc === "all" || item.source === filterSrc;
      const matchSt = filterSt === "all" || item.status === filterSt;
      return matchQ && matchSrc && matchSt;
    });
    if (hitSort === "desc")
      result = [...result].sort((a, b) => b.hitCount - a.hitCount);
    if (hitSort === "asc")
      result = [...result].sort((a, b) => a.hitCount - b.hitCount);
    return result;
  }, [data, search, filterSrc, filterSt, hitSort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const resetPage = () => setPage(1);

  const liveDetailItem = detailItem
    ? (data.find((d) => d.id === detailItem.id) ?? detailItem)
    : null;

  const confirmDeleteItem = confirmDeleteId
    ? data.find((d) => d.id === confirmDeleteId)
    : null;

  return (
    <>
      <div className="blp-wrap">
        <div className="blp-toolbar">
          <div className="blp-toolbar-left">
            <span className="blp-title">
              Blacklist Management
              <span
                style={{ color: "#9ca3af", fontWeight: 400, marginLeft: 6 }}
              >
                ({filtered.length} rekening)
              </span>
            </span>
            <span className="blp-subtitle">
              Rekening terblokir — setiap percobaan transaksi akan otomatis
              ditolak
            </span>
          </div>
          <div className="blp-toolbar-right">
            <div className="blp-search">
              <i className="bi bi-search" />
              <input
                type="text"
                placeholder="Cari nomor / nama / bank..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
              />
            </div>
            <button className="blp-btn secondary" onClick={onBulkImport}>
              <i className="bi bi-upload" /> Bulk Import
            </button>
            <button className="blp-btn primary" onClick={onAdd}>
              <i className="bi bi-plus-lg" /> Tambah
            </button>
          </div>
        </div>

        {(search ||
          filterSrc !== "all" ||
          filterSt !== "all" ||
          hitSort !== "none") && (
          <div className="blp-filter-bar">
            <span className="blp-filter-bar-label">
              <i className="bi bi-funnel-fill" /> Filter aktif:
            </span>
            {search && (
              <span className="blp-filter-chip">
                <i className="bi bi-search" />
                &ldquo;{search}&rdquo;
                <button
                  onClick={() => {
                    setSearch("");
                    resetPage();
                  }}
                  title="Hapus filter ini"
                >
                  <i className="bi bi-x" />
                </button>
              </span>
            )}
            {filterSrc !== "all" && (
              <span className="blp-filter-chip">
                <i className="bi bi-person-fill" />
                {SOURCE_OPTIONS.find((o) => o.value === filterSrc)?.label}
                <button
                  onClick={() => {
                    setFilterSrc("all");
                    resetPage();
                  }}
                  title="Hapus filter ini"
                >
                  <i className="bi bi-x" />
                </button>
              </span>
            )}
            {filterSt !== "all" && (
              <span className="blp-filter-chip">
                <i className="bi bi-shield-fill" />
                {STATUS_OPTIONS.find((o) => o.value === filterSt)?.label}
                <button
                  onClick={() => {
                    setFilterSt("all");
                    resetPage();
                  }}
                  title="Hapus filter ini"
                >
                  <i className="bi bi-x" />
                </button>
              </span>
            )}
            {hitSort !== "none" && (
              <span className="blp-filter-chip">
                <i
                  className={`bi ${hitSort === "desc" ? "bi-sort-down" : "bi-sort-up"}`}
                />
                Hit: {hitSort === "desc" ? "Terbanyak" : "Terkecil"}
                <button
                  onClick={() => {
                    setHitSort("none");
                    resetPage();
                  }}
                  title="Hapus filter ini"
                >
                  <i className="bi bi-x" />
                </button>
              </span>
            )}
            <button
              className="blp-filter-reset"
              onClick={() => {
                setSearch("");
                setFilterSrc("all");
                setFilterSt("all");
                setHitSort("none");
                resetPage();
              }}
            >
              <i className="bi bi-x-circle" /> Reset Semua
            </button>
          </div>
        )}

        <div className="blp-table-scroll">
          <table className="blp-table">
            <thead>
              <tr>
                <th>Nilai / Identifier</th>
                <th>Tipe</th>
                <th>Alasan</th>
                <th>
                  <ColumnDropdown
                    options={SOURCE_OPTIONS}
                    value={filterSrc}
                    onChange={(v) => {
                      setFilterSrc(v);
                      resetPage();
                    }}
                    label="Sumber"
                    anchor="left"
                  />
                </th>
                <th>
                  <ColumnDropdown
                    options={STATUS_OPTIONS}
                    value={filterSt}
                    onChange={(v) => {
                      setFilterSt(v);
                      resetPage();
                    }}
                    label="Status"
                    anchor="left"
                  />
                </th>
                <th>
                  <HitSortHeader hitSort={hitSort} setHitSort={setHitSort} />
                </th>
                <th>Ditambahkan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="blp-empty">
                      <i className="bi bi-shield-slash" />
                      <p>Tidak ada data blacklist ditemukan.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((item) => {
                  const src =
                    SOURCE_CONFIG[item.source] || SOURCE_CONFIG.manual;
                  const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
                  return (
                    <tr
                      key={item.id}
                      className="blp-row-clickable"
                      onClick={() => setDetailItem(item)}
                      title="Klik untuk melihat detail"
                    >
                      <td>
                        <div className="blp-acct">
                          <span className="blp-acct-num blp-mono">
                            {item.accountNumber}
                          </span>
                          {item.service_scope &&
                            item.service_scope !== "ALL" && (
                              <span className="blp-scope-tag">
                                {item.service_scope}
                              </span>
                            )}
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const tp = TYPE_CONFIG[item.bank] ||
                            TYPE_CONFIG[item.type] || {
                              cls: "blp-type--user",
                              label: item.bank || item.type || "—",
                              icon: "bi-tag",
                            };
                          return (
                            <span className={`blp-type-badge ${tp.cls}`}>
                              <i className={`bi ${tp.icon}`} /> {tp.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td
                        style={{
                          maxWidth: 180,
                          fontSize: "0.8rem",
                          color: "#6b7280",
                        }}
                      >
                        {item.reason}
                      </td>
                      <td>
                        <span className={`blp-source ${src.cls}`}>
                          <i className={`bi ${src.icon}`} /> {src.label}
                        </span>
                      </td>
                      <td>
                        <span className={`blp-status ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`blp-hit ${!item.hitCount ? "zero" : ""}`}
                        >
                          {item.hitCount ?? 0}
                        </span>
                      </td>
                      <td
                        style={{
                          fontSize: "0.78rem",
                          color: "#9ca3af",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.addedAt}
                      </td>

                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="blp-actions">
                          {item.status === "pending" && (
                            <button
                              className="blp-action-btn approve"
                              title="Setujui"
                              onClick={() => onApprove(item.id)}
                            >
                              <i className="bi bi-check-lg" />
                            </button>
                          )}
                          {item.status === "active" && (
                            <button
                              className="blp-action-btn deactivate"
                              title="Nonaktifkan"
                              onClick={() =>
                                onToggleStatus(item.id, "inactive")
                              }
                            >
                              <i className="bi bi-pause-circle" />
                            </button>
                          )}
                          {item.status === "inactive" && (
                            <button
                              className="blp-action-btn activate"
                              title="Aktifkan Kembali"
                              onClick={() => onToggleStatus(item.id, "active")}
                            >
                              <i className="bi bi-play-circle" />
                            </button>
                          )}
                          <button
                            className="blp-action-btn detail"
                            title="Lihat detail"
                            onClick={() => setDetailItem(item)}
                          >
                            <i className="bi bi-eye" />
                          </button>
                          <button
                            className="blp-action-btn edit"
                            title="Edit data blacklist"
                            onClick={() => onEdit(item)}
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            className="blp-action-btn del"
                            title="Hapus dari blacklist"
                            onClick={() => setConfirmDeleteId(item.id)}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="blp-pagination">
          <span>
            {filtered.length === 0
              ? "Tidak ada data"
              : `${Math.min((safePage - 1) * PAGE_SIZE + 1, filtered.length)}–${Math.min(safePage * PAGE_SIZE, filtered.length)} dari ${filtered.length}`}
          </span>
          <div className="blp-pg-btns">
            <button
              className="blp-pg-btn"
              disabled={safePage === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <i className="bi bi-chevron-left" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 || p === totalPages || Math.abs(p - safePage) <= 1,
              )
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  <span
                    key={`e${idx}`}
                    style={{
                      padding: "0 3px",
                      color: "#9ca3af",
                      fontSize: "0.75rem",
                    }}
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    className={`blp-pg-btn ${safePage === p ? "active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ),
              )}
            <button
              className="blp-pg-btn"
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      <BlacklistDetailModal
        isOpen={Boolean(detailItem)}
        item={liveDetailItem}
        onClose={() => setDetailItem(null)}
        onEdit={(item) => {
          onEdit(item);
          setDetailItem(null);
        }}
        onDelete={(id) => {
          onDelete(id);
          setDetailItem(null);
        }}
        onApprove={(id) => onApprove(id)}
        onToggleStatus={(id, status) => onToggleStatus(id, status)}
      />

      {confirmDeleteId && confirmDeleteItem && (
        <DeleteConfirmModal
          item={confirmDeleteItem}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            onDelete(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
        />
      )}
    </>
  );
};

export default BlacklistPanel;
