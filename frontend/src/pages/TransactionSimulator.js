import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import simulatorService from "../services/simulatorService";
import "./TransactionSimulator.css";

const ANOMALIES = [
  "",
  "HIGH_AMOUNT",
  "UNUSUAL_HOUR",
  "RAPID_FIRE",
  "UNDERPAYMENT",
  "OVERPAYMENT",
  "FOREIGN_IP",
  "DIFF_CITY",
];

const MAX_BULK_TRANSACTIONS = 150;

const initialAgenusa = {
  amount: 500000,
  msg_type: "TRANSFER",
  timestamp_db: "",
  response_code: "00",
  mti: "",
  processing_code: "",
  stan: "",
  fep_id: "",
  account_number: "",
  issuer_account_number: "",
  customer_ref_number: "",
  dest_account_number: "9876543210987654",
  issuer_bank: "BCA",
  dest_bank_code: "",
  acquirer_code: "AGENUSA",
  terminal_id: "",
  merchant_id: "",
  ip_address: "127.0.0.1",
  city: "Jakarta",
  country: "ID",
  inject_anomaly: "",
};

const initialNusabill = {
  no_invoice: "",
  customer_id: "",
  nama_customer: "Budi Santoso",
  total_tagihan: 1500000,
  payment_amount: 1500000,
  biaya_admin: 0,
  kode_pembayaran: "",
  tanggal_tagihan: "",
  tanggal_pembayaran: "",
  sof: "VA_BANK",
  channel: "API",
  status_tagihan: "terbayar",
  status_akhir: "SUCCESS",
  keterangan: "",
  ip_address: "127.0.0.1",
  inject_anomaly: "",
};

const tabs = [
  { key: "scenario", label: "Live Scenario", icon: "bi-play-circle" },
  { key: "manual", label: "Manual", icon: "bi-pencil-square" },
  { key: "bulk", label: "Bulk", icon: "bi-stack" },
  { key: "history", label: "Run History", icon: "bi-clock-history" },
  { key: "reset", label: "Reset Data", icon: "bi-trash3" },
];

const HISTORY_KEY = "transaction_simulator_run_history";

const readHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
};

const createRunId = () => {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
  const suffix =
    window.crypto?.randomUUID?.().slice(0, 4).toUpperCase() ||
    Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SIM-${stamp}-${suffix}`;
};

const createCardId = (prefix = "CARD_SIM") =>
  `${prefix}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const toLocalDateTimeInput = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const cleanPayload = (value) =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([key, item]) =>
        !key.startsWith("_") && item !== "" && item !== null,
    ),
  );

const Field = ({ label, hint, children, as = "label" }) => {
  const Component = as;
  return (
    <Component className="sim-field">
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
    </Component>
  );
};

const scenarioGroupMeta = {
  ALL: {
    label: "Complete Simulation",
    icon: "bi-collection-play",
  },
  BASELINE: {
    label: "Baseline Scenarios",
    icon: "bi-check-circle",
  },
  BLACKLIST: {
    label: "Blacklist Scenarios",
    icon: "bi-person-x",
  },
  PATTERN: {
    label: "Fraud Patterns",
    icon: "bi-bug",
  },
  RULE: {
    label: "Global Rules",
    icon: "bi-journal-code",
  },
  ML: {
    label: "ML Anomaly Scenarios",
    icon: "bi-cpu",
  },
};

const compactScenarioTitle = (title = "") =>
  title.replace(/^(Agenusa|Nusabill)\s*-\s*/i, "").replace(/^ML\s*-\s*/i, "");

const ScenarioDropdown = ({ details, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected =
    details.find((detail) => detail.key === value) ||
    (value
      ? {
          key: value,
          title: value.replaceAll("_", " "),
          scenario_type: "PATTERN",
        }
      : null);

  const groups = useMemo(() => {
    if (details.length) {
      return ["ALL", "BASELINE", "BLACKLIST", "PATTERN", "RULE", "ML"]
        .map((type) => ({
          type,
          items: details.filter((detail) => detail.scenario_type === type),
        }))
        .filter((group) => group.items.length);
    }
    return [
      {
        type: "PATTERN",
        items: options.map((key) => ({
          key,
          title: key.replaceAll("_", " "),
          scenario_type: "PATTERN",
        })),
      },
    ];
  }, [details, options]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleMenuKeyDown = (event) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      rootRef.current?.querySelectorAll(".sim-scenario-option") || [],
    );
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      currentIndex < 0
        ? direction > 0
          ? 0
          : items.length - 1
        : (currentIndex + direction + items.length) % items.length;
    items[nextIndex].focus();
  };

  const selectedMeta =
    scenarioGroupMeta[selected?.scenario_type] || scenarioGroupMeta.PATTERN;

  return (
    <div className="sim-scenario-select" ref={rootRef}>
      <button
        type="button"
        className={`sim-scenario-select__trigger ${open ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            window.requestAnimationFrame(() =>
              rootRef.current?.querySelector(".sim-scenario-option")?.focus(),
            );
          }
        }}
      >
        <i className={`bi ${selectedMeta.icon}`} />
        <span className="sim-scenario-select__value">
          <strong>
            {selected ? compactScenarioTitle(selected.title) : "Pilih scenario"}
          </strong>
          {selected && <small>{selectedMeta.label}</small>}
        </span>
        <i className={`bi bi-chevron-${open ? "up" : "down"}`} />
      </button>

      {open && (
        <div
          className="sim-scenario-menu"
          role="listbox"
          aria-label="Scenario"
          onKeyDown={handleMenuKeyDown}
        >
          {groups.map(({ type, items }) => {
            const meta = scenarioGroupMeta[type];
            return (
              <section
                className="sim-scenario-group"
                role="group"
                aria-label={meta.label}
                key={type}
              >
                <div className="sim-scenario-group__header">
                  <span>
                    <i className={`bi ${meta.icon}`} />
                    {meta.label}
                  </span>
                  <small>{items.length}</small>
                </div>
                {items.map((detail) => {
                  const active = detail.key === value;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`sim-scenario-option ${active ? "is-selected" : ""}`}
                      value={detail.key}
                      key={detail.key}
                      onClick={() => {
                        onChange(detail.key);
                        setOpen(false);
                      }}
                    >
                      <span>
                        <strong>{compactScenarioTitle(detail.title)}</strong>
                        <small>{detail.category}</small>
                      </span>
                      {active && <i className="bi bi-check2" />}
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ResultPanel = ({ result, error, onClose }) => {
  if (!result && !error) return null;
  const data = result?.data || {};
  const bulkResults = result?.results || [];
  const successfulBulk = bulkResults
    .filter((item) => item.status === "success")
    .map((item) => item.data);
  const anomalyBulk = successfulBulk.filter((item) => item.anomaly_injected);
  const formatAnomalyValue = (field, value) => {
    if (value === null || value === undefined || value === "") return "—";
    if (["amount", "total_tagihan", "payment_amount"].includes(field)) {
      return `Rp ${Number(value).toLocaleString("id-ID")}`;
    }
    if (field.includes("timestamp") || field.startsWith("tanggal_")) {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString("id-ID");
    }
    return String(value);
  };
  const riskScores = [data, ...successfulBulk]
    .map((item) => Number(item?.risk_score))
    .filter(Number.isFinite);
  const maxRisk = riskScores.length ? Math.max(...riskScores) : null;
  const transactionId =
    data.transaction_id || successfulBulk[0]?.transaction_id || null;
  const finalStatus =
    data.final_status ||
    (successfulBulk.some((item) => item.final_status === "FRAUD")
      ? "FRAUD DETECTED"
      : successfulBulk.length
        ? "COMPLETED"
        : null);
  const resultCards = [
    result?._run_id && {
      label: "Run ID",
      value: result._run_id,
      icon: "bi-fingerprint",
    },
    finalStatus && {
      label: "Final status",
      value: finalStatus,
      icon: "bi-shield-check",
      tone: finalStatus.includes("FRAUD") ? "danger" : "success",
    },
    maxRisk !== null && {
      label: "Highest risk",
      value: `${maxRisk}/100`,
      icon: "bi-speedometer",
      tone: maxRisk >= 60 ? "danger" : "success",
    },
    data.risk_level && {
      label: "Risk level",
      value: data.risk_level,
      icon: "bi-exclamation-diamond",
    },
    transactionId && {
      label: "Transaction ID",
      value: `#${transactionId}`,
      icon: "bi-receipt",
    },
    result?.total !== undefined && {
      label: "Bulk result",
      value: `${result.succeeded}/${result.total} berhasil`,
      icon: "bi-stack",
      tone: result.failed ? "warning" : "success",
    },
    data.amount !== undefined && {
      label: "Amount",
      value: `Rp ${Number(data.amount).toLocaleString("id-ID")}`,
      icon: "bi-cash-stack",
    },
  ].filter(Boolean);

  return (
    <section
      className={`sim-result ${error ? "sim-result--error" : "sim-result--success"}`}
      aria-live="polite"
    >
      <div className="sim-result__header">
        <div>
          <i
            className={`bi ${error ? "bi-exclamation-triangle-fill" : "bi-check-circle-fill"}`}
          />
          <strong>{error ? "Request gagal" : result.message || "Request berhasil"}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Tutup hasil">
          <i className="bi bi-x-lg" />
        </button>
      </div>
      {error ? (
        <p>{error}</p>
      ) : (
        <>
          {resultCards.length > 0 && (
            <div className="sim-result-cards">
              {resultCards.map((card) => (
                <div
                  key={card.label}
                  className={`sim-result-card sim-result-card--${card.tone || "neutral"}`}
                >
                  <i className={`bi ${card.icon}`} />
                  <span>
                    <small>{card.label}</small>
                    <strong>{card.value}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
          {transactionId && (
            <a
              className="sim-result-link"
              href={`/transactions?search=${transactionId}`}
            >
              Lihat di Transactions <i className="bi bi-arrow-right" />
            </a>
          )}
          {anomalyBulk.length > 0 && (
            <div className="sim-anomaly-result">
              <div className="sim-anomaly-result__header">
                <i className="bi bi-lightning-charge-fill" />
                <strong>Perubahan anomaly yang diterapkan</strong>
              </div>
              <div className="sim-anomaly-result__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Transaksi</th>
                      <th>Anomaly</th>
                      <th>Perubahan payload</th>
                      <th>Hasil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalyBulk.map((item) => {
                      const changes = Object.entries(
                        item.anomaly_changes || {},
                      );
                      return (
                        <tr key={item.transaction_id || item.index}>
                          <td>#{Number(item.index ?? 0) + 1}</td>
                          <td>
                            <code>{item.anomaly_injected}</code>
                          </td>
                          <td>
                            {changes.length ? (
                              <div className="sim-anomaly-changes">
                                {changes.map(([field, change]) => (
                                  <span key={field}>
                                    <strong>{field}</strong>
                                    <small>
                                      {formatAnomalyValue(field, change.before)}
                                      {" → "}
                                      {formatAnomalyValue(field, change.after)}
                                    </small>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="sim-anomaly-no-change">
                                Tidak ada perubahan untuk layanan ini
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="sim-anomaly-status">
                              {item.final_status || "COMPLETED"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <details className="sim-raw-result">
            <summary>Technical response</summary>
            <pre>{JSON.stringify(result.data ?? result, null, 2)}</pre>
          </details>
        </>
      )}
    </section>
  );
};

const TransactionSimulator = () => {
  const [activeTab, setActiveTab] = useState("scenario");
  const [service, setService] = useState("agenusa");
  const [scenarios, setScenarios] = useState({ agenusa: [], nusabill: [] });
  const [scenarioDetails, setScenarioDetails] = useState({
    agenusa: [],
    nusabill: [],
  });
  const [selectedScenario, setSelectedScenario] = useState("");
  const [preview, setPreview] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [agenusaForm, setAgenusaForm] = useState(initialAgenusa);
  const [nusabillForm, setNusabillForm] = useState(initialNusabill);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkScenario, setBulkScenario] = useState("");
  const [bulkIntervalSeconds, setBulkIntervalSeconds] = useState(30);
  const [delayMs, setDelayMs] = useState(300);
  const [stopOnError, setStopOnError] = useState(false);
  const [replay, setReplay] = useState({
    transaction_id: "",
    override_amount: "",
    override_timestamp: "",
    inject_anomaly: "",
  });
  const [resetTarget, setResetTarget] = useState("all");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [runHistory, setRunHistory] = useState(readHistory);

  const activeForm = service === "agenusa" ? agenusaForm : nusabillForm;
  const setActiveForm =
    service === "agenusa" ? setAgenusaForm : setNusabillForm;
  const scopedScenarioDetails = useMemo(
    () =>
      service === "all"
        ? [
            ...(scenarioDetails.agenusa || []),
            ...(scenarioDetails.nusabill || []),
          ]
        : scenarioDetails[service] || [],
    [scenarioDetails, service],
  );
  const allScenarioDetail = useMemo(() => {
    const serviceLabel =
      service === "all"
        ? "Semua Layanan"
        : service === "agenusa"
          ? "Agenusa"
          : "Nusabill";
    return {
      key: "all",
      scenario_type: "ALL",
      title: `${serviceLabel} - Semua Scenario`,
      category: "Complete Simulation",
      description:
        service === "all"
          ? "Menjalankan seluruh scenario Agenusa dan Nusabill dalam satu simulation run."
          : `Menjalankan seluruh scenario ${serviceLabel} dalam satu simulation run.`,
      target_engines: [
        ...new Set(
          scopedScenarioDetails.flatMap(
            (detail) => detail.target_engines || [],
          ),
        ),
      ],
      expected_result: "MIXED",
      transaction_count: scopedScenarioDetails.reduce(
        (total, detail) => total + Number(detail.transaction_count || 0),
        0,
      ),
    };
  }, [scopedScenarioDetails, service]);
  const scenarioOptions = useMemo(
    () =>
      service === "all"
        ? ["all"]
        : ["all", ...(scenarios[service] || [])],
    [scenarios, service],
  );
  const activeScenarioDetails = useMemo(
    () =>
      service === "all"
        ? [allScenarioDetail]
        : [allScenarioDetail, ...scopedScenarioDetails],
    [allScenarioDetail, scopedScenarioDetails, service],
  );

  const showError = (err) => {
    setResult(null);
    setError(err?.message || "Terjadi kesalahan saat menghubungi server.");
  };

  const storeHistory = useCallback((entry) => {
    setRunHistory((current) => {
      const next = [entry, ...current].slice(0, 30);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const runAction = async (name, action, metadata = null) => {
    const runId = metadata ? createRunId() : null;
    const startedAt = new Date();
    setBusy(name);
    setError("");
    setResult(null);
    try {
      const data = await action();
      const enriched = runId ? { ...data, _run_id: runId } : data;
      setResult(enriched);
      if (metadata) {
        const resultData = data?.data || {};
        storeHistory({
          runId,
          mode: metadata.mode || name,
          service: metadata.service || service,
          label: metadata.label || name,
          startedAt: startedAt.toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
          status: "success",
          total: data?.total ?? metadata.total ?? 1,
          succeeded: data?.succeeded ?? 1,
          failed: data?.failed ?? 0,
          transactionIds: [
            resultData.transaction_id,
            ...(data?.results || []).map(
              (item) => item?.data?.transaction_id,
            ),
          ].filter(Boolean),
          riskScore:
            resultData.risk_score ??
            Math.max(
              0,
              ...(data?.results || [])
                .map((item) => Number(item?.data?.risk_score))
                .filter(Number.isFinite),
            ),
          finalStatus: resultData.final_status || "COMPLETED",
        });
      }
      return enriched;
    } catch (err) {
      showError(err);
      if (metadata) {
        storeHistory({
          runId,
          mode: metadata.mode || name,
          service: metadata.service || service,
          label: metadata.label || name,
          startedAt: startedAt.toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
          status: "failed",
          total: metadata.total ?? 1,
          succeeded: 0,
          failed: metadata.total ?? 1,
          error: err?.message || "Request gagal",
          transactionIds: [],
        });
      }
      return null;
    } finally {
      setBusy("");
    }
  };

  const refreshStatus = useCallback(async () => {
    try {
      const data = await simulatorService.getStatus();
      setIsRunning(Boolean(data?.data?.is_running));
    } catch {
      // Status polling is non-blocking; action errors are shown separately.
    }
  }, []);

  useEffect(() => {
    simulatorService
      .getScenarios()
      .then((data) => {
        const list = data?.data || { agenusa: [], nusabill: [] };
        setScenarios(list);
        setScenarioDetails(
          list.scenario_details || { agenusa: [], nusabill: [] },
        );
        setSelectedScenario(list.agenusa?.[0] || "");
      })
      .catch(showError);
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const timer = window.setInterval(refreshStatus, 3000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  useEffect(() => {
    setSelectedScenario(scenarioOptions[0] || "");
    setPreview(null);
  }, [service, scenarioOptions]);

  useEffect(() => {
    setBulkScenario("");
  }, [service]);

  useEffect(() => {
    if (!selectedScenario) return;
    if (selectedScenario === "all") {
      setPreview(allScenarioDetail);
      return;
    }
    let active = true;
    simulatorService
      .getScenarioPreview(selectedScenario, service)
      .then((data) => active && setPreview(data?.data || null))
      .catch((err) => active && showError(err));
    return () => {
      active = false;
    };
  }, [allScenarioDetail, selectedScenario, service]);

  const updateForm = (key, value) =>
    setActiveForm((current) => ({ ...current, [key]: value }));

  const makeBulkRows = useCallback(
    (count = bulkCount, source = service) => {
      const base =
        source === "agenusa" ? { ...agenusaForm } : { ...nusabillForm };
      const safeCount = Math.min(
        MAX_BULK_TRANSACTIONS,
        Math.max(1, Number(count) || 1),
      );
      const commonCard =
        base.issuer_account_number || base.account_number || createCardId();
      const commonCustomer =
        base.customer_ref_number || `CUST_${commonCard.slice(-8)}`;
      const commonNusabillCustomer =
        base.customer_id ||
        `CUST-SIM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const endTime = Date.now();
      return Array.from({ length: safeCount }, (_, index) => {
        const timestamp = toLocalDateTimeInput(
          new Date(
            endTime -
              (safeCount - index - 1) *
                Number(bulkIntervalSeconds) *
                1000,
          ),
        );
        return {
          ...base,
          ...(source === "agenusa"
            ? {
                account_number: base.account_number || commonCard,
                issuer_account_number: commonCard,
                customer_ref_number: commonCustomer,
                timestamp_db: timestamp,
              }
            : {
                customer_id: commonNusabillCustomer,
                tanggal_tagihan: timestamp,
                tanggal_pembayaran: timestamp,
              }),
          _rowId: `${Date.now()}-${index}-${Math.random()}`,
        };
      });
    },
    [
      agenusaForm,
      bulkCount,
      bulkIntervalSeconds,
      nusabillForm,
      service,
    ],
  );

  useEffect(() => {
    if (activeTab === "bulk" && bulkRows.length === 0) {
      setBulkRows(makeBulkRows());
    }
  }, [activeTab, bulkRows.length, makeBulkRows]);

  const updateBulkRow = (rowId, key, value) => {
    setBulkRows((rows) =>
      rows.map((row) =>
        row._rowId === rowId ? { ...row, [key]: value } : row,
      ),
    );
  };

  const removeBulkRow = (rowId) => {
    setBulkRows((rows) => rows.filter((row) => row._rowId !== rowId));
  };

  const prepareBulkRows = (count = bulkCount) => {
    const safeCount = Math.min(
      MAX_BULK_TRANSACTIONS,
      Math.max(1, Number(count) || 1),
    );
    setBulkCount(safeCount);
    setBulkRows(makeBulkRows(safeCount));
  };

  const applyScenarioToBulk = async () => {
    if (!bulkScenario) return;
    setBusy("bulk-scenario");
    setError("");
    setResult(null);
    try {
      const response = await simulatorService.getScenarioTransactions(
        bulkScenario,
        service,
      );
      const transactions = response?.data?.transactions || [];
      const rows = transactions.map((transaction, index) => {
        if (service === "agenusa") {
          const msgType = ["TRANSFER", "TARIK_SALDO", "CEK_SALDO"].includes(
            transaction.msg_type,
          )
            ? transaction.msg_type
            : "TRANSFER";
          return {
            ...initialAgenusa,
            ...transaction,
            msg_type: msgType,
            timestamp_db: transaction.timestamp_db
              ? toLocalDateTimeInput(new Date(transaction.timestamp_db))
              : "",
            city: transaction.city || "Jakarta",
            country: transaction.country || "ID",
            inject_anomaly: "",
            _rowId: `scenario-${Date.now()}-${index}`,
          };
        }
        return {
          ...initialNusabill,
          ...transaction,
          payment_amount:
            transaction.payment_amount ?? transaction.total_tagihan,
          tanggal_tagihan: transaction.tanggal_tagihan
            ? toLocalDateTimeInput(new Date(transaction.tanggal_tagihan))
            : "",
          tanggal_pembayaran: transaction.tanggal_pembayaran
            ? toLocalDateTimeInput(new Date(transaction.tanggal_pembayaran))
            : transaction.tanggal_tagihan
              ? toLocalDateTimeInput(new Date(transaction.tanggal_tagihan))
              : "",
          inject_anomaly: "",
          _rowId: `scenario-${Date.now()}-${index}`,
        };
      });
      setBulkRows(rows);
      setBulkCount(rows.length);
      setResult({
        status: "success",
        message: `Scenario berhasil dimuat ke ${rows.length} baris Bulk dan belum dikirim.`,
        data: {
          scenario: bulkScenario,
          service,
          transaction_count: rows.length,
        },
      });
    } catch (err) {
      showError(err);
    } finally {
      setBusy("");
    }
  };

  const applyBulkHelper = (helper) => {
    if (helper === "api-velocity") setBulkIntervalSeconds(2);

    setBulkRows((rows) => {
      if (!rows.length) return rows;
      const effectiveInterval =
        helper === "api-velocity" ? 2 : Number(bulkIntervalSeconds);
      const endTime = Date.now();

      if (service === "nusabill") {
        const customerId = `CUST-SIM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        return rows.map((row, index) => {
          const timestamp = toLocalDateTimeInput(
            new Date(
              endTime -
                (rows.length - index - 1) * effectiveInterval * 1000,
            ),
          );
          const timeFields = {
            tanggal_tagihan: timestamp,
            tanggal_pembayaran: timestamp,
          };

          if (helper === "same-customer") {
            return { ...row, ...timeFields, customer_id: customerId };
          }
          if (helper === "unique-names") {
            return {
              ...row,
              ...timeFields,
              customer_id: customerId,
              nama_customer: `VICTIM_NAME_${String(index + 1).padStart(3, "0")}`,
            };
          }
          if (helper === "underpayment") {
            return {
              ...row,
              ...timeFields,
              customer_id: customerId,
              payment_amount: Math.round(Number(row.total_tagihan) * 0.5),
              inject_anomaly: "",
            };
          }
          if (helper === "overpayment") {
            return {
              ...row,
              ...timeFields,
              customer_id: customerId,
              payment_amount: Math.round(Number(row.total_tagihan) * 1.5),
              inject_anomaly: "",
            };
          }
          if (helper === "api-velocity") {
            return {
              ...row,
              ...timeFields,
              customer_id: customerId,
              channel: "API",
            };
          }
          return { ...row, ...timeFields };
        });
      }

      const card = createCardId();
      const customer = `CUST_${card.slice(-8)}`;
      const terminal =
        rows[0].terminal_id || `TRM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      return rows.map((row, index) => {
        const timestamp = toLocalDateTimeInput(
          new Date(
            endTime -
              (rows.length - index - 1) *
                effectiveInterval *
                1000,
          ),
        );

        if (helper === "same-card") {
          return {
            ...row,
            account_number: card,
            issuer_account_number: card,
            customer_ref_number: customer,
            timestamp_db: timestamp,
          };
        }

        if (helper === "unique-cards") {
          const uniqueCard = createCardId(`CARD_${index + 1}`);
          return {
            ...row,
            account_number: uniqueCard,
            issuer_account_number: uniqueCard,
            customer_ref_number: `CUST_${uniqueCard.slice(-8)}`,
            terminal_id: terminal,
            timestamp_db: timestamp,
          };
        }

        if (helper === "failure-success") {
          return {
            ...row,
            account_number: card,
            issuer_account_number: card,
            customer_ref_number: customer,
            response_code: index < 3 ? "51" : "00",
            timestamp_db: timestamp,
          };
        }

        return { ...row, timestamp_db: timestamp };
      });
    });
  };

  const buildManualPayload = () => {
    const payload = cleanPayload(activeForm);
    if (service === "agenusa") {
      payload.amount = Number(payload.amount);
      if (payload.timestamp_db)
        payload.timestamp_db = new Date(payload.timestamp_db).toISOString();
    } else {
      payload.total_tagihan = Number(payload.total_tagihan);
      if (payload.payment_amount !== undefined)
        payload.payment_amount = Number(payload.payment_amount);
      payload.biaya_admin = Number(payload.biaya_admin || 0);
      if (payload.tanggal_tagihan)
        payload.tanggal_tagihan = new Date(
          payload.tanggal_tagihan,
        ).toISOString();
      if (payload.tanggal_pembayaran)
        payload.tanggal_pembayaran = new Date(
          payload.tanggal_pembayaran,
        ).toISOString();
    }
    return payload;
  };

  const normalizeBulkRow = (row) => {
    const payload = cleanPayload(row);
    if (service === "agenusa") {
      payload.amount = Number(payload.amount);
      if (payload.timestamp_db)
        payload.timestamp_db = new Date(payload.timestamp_db).toISOString();
    } else {
      payload.total_tagihan = Number(payload.total_tagihan);
      payload.payment_amount =
        payload.payment_amount === undefined
          ? payload.total_tagihan
          : Number(payload.payment_amount);
      payload.biaya_admin = Number(payload.biaya_admin || 0);
      if (payload.tanggal_tagihan)
        payload.tanggal_tagihan = new Date(
          payload.tanggal_tagihan,
        ).toISOString();
      if (payload.tanggal_pembayaran)
        payload.tanggal_pembayaran = new Date(
          payload.tanggal_pembayaran,
        ).toISOString();
    }
    return payload;
  };

  const handleManual = (event) => {
    event.preventDefault();
    runAction(
      "manual",
      () => simulatorService.manual(service, buildManualPayload()),
      { mode: "manual", service, label: "Manual transaction" },
    );
  };

  const handleBulk = (event) => {
    event.preventDefault();
    const transactions = bulkRows.map(normalizeBulkRow);
    runAction(
      "bulk",
      () =>
        simulatorService.bulk(service, {
          transactions,
          delay_ms: Number(delayMs),
          stop_on_error: stopOnError,
        }),
      {
        mode: "bulk",
        service,
        label: `Bulk ${transactions.length} transactions`,
        total: transactions.length,
      },
    );
  };

  const handleReplay = (event) => {
    event.preventDefault();
    const payload = cleanPayload({
      ...replay,
      transaction_id: Number(replay.transaction_id),
      override_amount: replay.override_amount
        ? Number(replay.override_amount)
        : "",
      override_timestamp: replay.override_timestamp
        ? new Date(replay.override_timestamp).toISOString()
        : "",
    });
    runAction("replay", () => simulatorService.replay(payload), {
      mode: "replay",
      service: "auto",
      label: `Replay transaction #${payload.transaction_id}`,
    });
  };

  const handleReset = async () => {
    if (resetConfirmation !== "RESET") return;
    const data = await runAction("reset", () =>
      simulatorService.reset(resetTarget),
    );
    if (data) setResetConfirmation("");
  };

  const renderTransactionFields = () =>
    service === "agenusa" ? (
      <>
        <Field label="Nominal transaksi (Rp)">
          <input
            type="number"
            min="1"
            required
            value={agenusaForm.amount}
            onChange={(e) => updateForm("amount", e.target.value)}
          />
        </Field>
        <Field label="Jenis transaksi">
          <select
            value={agenusaForm.msg_type}
            onChange={(e) => updateForm("msg_type", e.target.value)}
          >
            <option value="TRANSFER">Transfer</option>
            <option value="TARIK_SALDO">Tarik saldo</option>
            <option value="CEK_SALDO">Cek saldo</option>
          </select>
        </Field>
        <Field label="Rekening sumber" hint="Kosongkan untuk dibuat otomatis">
          <input
            value={agenusaForm.account_number}
            onChange={(e) => updateForm("account_number", e.target.value)}
            placeholder="Auto-generated"
          />
        </Field>
        {agenusaForm.msg_type === "TRANSFER" && (
          <Field label="Rekening tujuan">
            <input
              required
              value={agenusaForm.dest_account_number}
              onChange={(e) =>
                updateForm("dest_account_number", e.target.value)
              }
            />
          </Field>
        )}
        <Field label="Bank penerbit">
          <input
            value={agenusaForm.issuer_bank}
            onChange={(e) => updateForm("issuer_bank", e.target.value)}
          />
        </Field>
        <Field label="Kota">
          <input
            value={agenusaForm.city}
            onChange={(e) => updateForm("city", e.target.value)}
          />
        </Field>
        <Field label="Terminal ID" hint="Kosongkan untuk dibuat otomatis">
          <input
            value={agenusaForm.terminal_id}
            onChange={(e) => updateForm("terminal_id", e.target.value)}
            placeholder="Auto-generated"
          />
        </Field>
        <Field label="Merchant ID" hint="Kosongkan untuk dibuat otomatis">
          <input
            value={agenusaForm.merchant_id}
            onChange={(e) => updateForm("merchant_id", e.target.value)}
            placeholder="Auto-generated"
          />
        </Field>
      </>
    ) : (
      <>
        <Field label="Nama customer">
          <input
            required
            value={nusabillForm.nama_customer}
            onChange={(e) => updateForm("nama_customer", e.target.value)}
          />
        </Field>
        <Field label="Total tagihan (Rp)">
          <input
            type="number"
            min="1"
            required
            value={nusabillForm.total_tagihan}
            onChange={(e) => updateForm("total_tagihan", e.target.value)}
          />
        </Field>
        <Field label="Jumlah dibayar (Rp)">
          <input
            type="number"
            min="0"
            value={nusabillForm.payment_amount}
            onChange={(e) => updateForm("payment_amount", e.target.value)}
          />
        </Field>
        <Field label="Biaya admin (Rp)">
          <input
            type="number"
            min="0"
            value={nusabillForm.biaya_admin}
            onChange={(e) => updateForm("biaya_admin", e.target.value)}
          />
        </Field>
        <Field label="Source of fund">
          <input
            value={nusabillForm.sof}
            onChange={(e) => updateForm("sof", e.target.value)}
          />
        </Field>
        <Field label="Channel">
          <input
            value={nusabillForm.channel}
            onChange={(e) => updateForm("channel", e.target.value)}
          />
        </Field>
      </>
    );

  const anomalyField = (
    <Field label="Inject anomaly">
      <select
        value={activeForm.inject_anomaly}
        onChange={(e) => updateForm("inject_anomaly", e.target.value)}
      >
        {ANOMALIES.map((item) => (
          <option key={item || "none"} value={item}>
            {item || "Tanpa anomali"}
          </option>
        ))}
      </select>
    </Field>
  );

  const renderAdvancedFields = () =>
    service === "agenusa" ? (
      <div className="sim-advanced-fields">
        <Field label="Timestamp (UTC)">
          <input
            type="datetime-local"
            value={agenusaForm.timestamp_db}
            onChange={(e) => updateForm("timestamp_db", e.target.value)}
          />
        </Field>
        <Field label="Response code">
          <input
            value={agenusaForm.response_code}
            onChange={(e) => updateForm("response_code", e.target.value)}
            placeholder="00"
          />
        </Field>
        <Field
          label="Issuer account number"
          hint="Kunci grouping untuk tx_count dan failure_count"
        >
          <input
            value={agenusaForm.issuer_account_number}
            onChange={(e) =>
              updateForm("issuer_account_number", e.target.value)
            }
            placeholder="Contoh: CARD-001"
          />
        </Field>
        <Field
          label="Customer reference"
          hint="Fallback grouping ketika issuer account kosong"
        >
          <input
            value={agenusaForm.customer_ref_number}
            onChange={(e) =>
              updateForm("customer_ref_number", e.target.value)
            }
            placeholder="Contoh: CUST-001"
          />
        </Field>
        <Field label="MTI" hint="Kosongkan untuk auto-derive">
          <input
            value={agenusaForm.mti}
            onChange={(e) => updateForm("mti", e.target.value)}
            placeholder="0200"
          />
        </Field>
        <Field label="Processing code" hint="Kosongkan untuk auto-derive">
          <input
            value={agenusaForm.processing_code}
            onChange={(e) => updateForm("processing_code", e.target.value)}
            placeholder="200000"
          />
        </Field>
        <Field label="STAN">
          <input
            value={agenusaForm.stan}
            onChange={(e) => updateForm("stan", e.target.value)}
          />
        </Field>
        <Field label="FEP ID">
          <input
            value={agenusaForm.fep_id}
            onChange={(e) => updateForm("fep_id", e.target.value)}
          />
        </Field>
        <Field label="Destination bank code">
          <input
            value={agenusaForm.dest_bank_code}
            onChange={(e) => updateForm("dest_bank_code", e.target.value)}
          />
        </Field>
        <Field label="Acquirer code">
          <input
            value={agenusaForm.acquirer_code}
            onChange={(e) => updateForm("acquirer_code", e.target.value)}
          />
        </Field>
        <Field label="IP address">
          <input
            value={agenusaForm.ip_address}
            onChange={(e) => updateForm("ip_address", e.target.value)}
          />
        </Field>
        <Field label="Country code">
          <input
            maxLength="2"
            value={agenusaForm.country}
            onChange={(e) => updateForm("country", e.target.value.toUpperCase())}
          />
        </Field>
      </div>
    ) : (
      <div className="sim-advanced-fields">
        <Field label="Invoice number" hint="Kosongkan untuk dibuat otomatis">
          <input
            value={nusabillForm.no_invoice}
            onChange={(e) => updateForm("no_invoice", e.target.value)}
            placeholder="Auto-generated"
          />
        </Field>
        <Field label="Customer ID" hint="Kosongkan untuk dibuat otomatis">
          <input
            value={nusabillForm.customer_id}
            onChange={(e) => updateForm("customer_id", e.target.value)}
            placeholder="Auto-generated"
          />
        </Field>
        <Field label="Kode pembayaran">
          <input
            value={nusabillForm.kode_pembayaran}
            onChange={(e) => updateForm("kode_pembayaran", e.target.value)}
          />
        </Field>
        <Field label="Tanggal tagihan">
          <input
            type="datetime-local"
            value={nusabillForm.tanggal_tagihan}
            onChange={(e) => updateForm("tanggal_tagihan", e.target.value)}
          />
        </Field>
        <Field
          label="Tanggal pembayaran"
          hint="Dipakai sebagai transaction_time oleh engine"
        >
          <input
            type="datetime-local"
            value={nusabillForm.tanggal_pembayaran}
            onChange={(e) =>
              updateForm("tanggal_pembayaran", e.target.value)
            }
          />
        </Field>
        <Field label="Status tagihan">
          <input
            value={nusabillForm.status_tagihan}
            onChange={(e) => updateForm("status_tagihan", e.target.value)}
          />
        </Field>
        <Field label="Status akhir">
          <input
            value={nusabillForm.status_akhir}
            onChange={(e) => updateForm("status_akhir", e.target.value)}
          />
        </Field>
        <Field label="IP address">
          <input
            value={nusabillForm.ip_address}
            onChange={(e) => updateForm("ip_address", e.target.value)}
          />
        </Field>
        <Field label="Keterangan">
          <input
            value={nusabillForm.keterangan}
            onChange={(e) => updateForm("keterangan", e.target.value)}
          />
        </Field>
      </div>
    );

  const renderBulkTable = () => (
    <div className="sim-bulk-editor">
      <div className="sim-bulk-editor__header">
        <div>
          <h3>Editable transaction table</h3>
          <p>Setiap baris dapat memiliki nilai dan anomaly yang berbeda.</p>
        </div>
        <button
          className="sim-btn sim-btn--ghost"
          type="button"
          onClick={() =>
            setBulkRows((rows) => {
              const previous = rows.at(-1) || activeForm;
              const previousTimestamp =
                service === "agenusa"
                  ? previous.timestamp_db
                  : previous.tanggal_pembayaran || previous.tanggal_tagihan;
              const nextTimestamp = previousTimestamp
                  ? toLocalDateTimeInput(
                      new Date(
                        new Date(previousTimestamp).getTime() +
                          Number(bulkIntervalSeconds) * 1000,
                      ),
                    )
                  : "";
              return [
                ...rows,
                {
                  ...previous,
                  ...(service === "agenusa"
                    ? { timestamp_db: nextTimestamp }
                    : {
                        tanggal_tagihan: nextTimestamp,
                        tanggal_pembayaran: nextTimestamp,
                      }),
                  _rowId: `${Date.now()}-${Math.random()}`,
                },
              ];
            })
          }
          disabled={bulkRows.length >= MAX_BULK_TRANSACTIONS}
        >
          <i className="bi bi-plus-lg" /> Tambah baris
        </button>
      </div>
      <div className="sim-bulk-table-wrap">
        <table className="sim-bulk-table">
          <thead>
            <tr>
              <th>#</th>
              {service === "agenusa" ? (
                <>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Issuer account</th>
                  <th>Bank penerbit</th>
                  <th>Terminal</th>
                  <th>Customer ref</th>
                  <th>Response</th>
                  <th>Timestamp</th>
                </>
              ) : (
                <>
                  <th>Customer ID</th>
                  <th>Customer</th>
                  <th>Tagihan</th>
                  <th>Pembayaran</th>
                  <th>Channel</th>
                  <th>Timestamp</th>
                </>
              )}
              <th aria-label="Aksi" />
            </tr>
          </thead>
          <tbody>
            {bulkRows.map((row, index) => (
              <tr key={row._rowId}>
                <td>{index + 1}</td>
                {service === "agenusa" ? (
                  <>
                    <td>
                      <input
                        type="number"
                        min="1"
                        required
                        value={row.amount}
                        onChange={(e) =>
                          updateBulkRow(row._rowId, "amount", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={row.msg_type}
                        onChange={(e) =>
                          updateBulkRow(row._rowId, "msg_type", e.target.value)
                        }
                      >
                        <option value="TRANSFER">Transfer</option>
                        <option value="TARIK_SALDO">Tarik saldo</option>
                        <option value="CEK_SALDO">Cek saldo</option>
                      </select>
                    </td>
                    <td>
                      <input
                        value={row.issuer_account_number}
                        onChange={(e) =>
                          updateBulkRow(
                            row._rowId,
                            "issuer_account_number",
                            e.target.value,
                          )
                        }
                        placeholder="Auto"
                      />
                    </td>
                    <td>
                      <input
                        required
                        value={row.issuer_bank}
                        onChange={(e) =>
                          updateBulkRow(
                            row._rowId,
                            "issuer_bank",
                            e.target.value,
                          )
                        }
                        placeholder="Contoh: BCA"
                        aria-label={`Bank penerbit transaksi ${index + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        value={row.terminal_id}
                        onChange={(e) =>
                          updateBulkRow(
                            row._rowId,
                            "terminal_id",
                            e.target.value,
                          )
                        }
                        placeholder="Auto"
                      />
                    </td>
                    <td>
                      <input
                        value={row.customer_ref_number}
                        onChange={(e) =>
                          updateBulkRow(
                            row._rowId,
                            "customer_ref_number",
                            e.target.value,
                          )
                        }
                        placeholder="Auto"
                      />
                    </td>
                    <td>
                      <input
                        className="sim-code-input"
                        value={row.response_code}
                        onChange={(e) =>
                          updateBulkRow(
                            row._rowId,
                            "response_code",
                            e.target.value,
                          )
                        }
                        placeholder="00"
                      />
                    </td>
                    <td>
                      <input
                        className="sim-time-input"
                        type="datetime-local"
                        required
                        value={row.timestamp_db}
                        onChange={(e) =>
                          updateBulkRow(
                            row._rowId,
                            "timestamp_db",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td>
                      <input
                        required
                        value={row.customer_id}
                        onChange={(e) =>
                          updateBulkRow(
                            row._rowId,
                            "customer_id",
                            e.target.value,
                          )
                        }
                        placeholder="CUST-..."
                      />
                    </td>
                    <td>
                      <input
                        required
                        value={row.nama_customer}
                        onChange={(e) =>
                          updateBulkRow(
                            row._rowId,
                            "nama_customer",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        required
                        value={row.total_tagihan}
                        onChange={(e) =>
                          updateBulkRow(
                            row._rowId,
                            "total_tagihan",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={row.payment_amount}
                        onChange={(e) =>
                          updateBulkRow(
                            row._rowId,
                            "payment_amount",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={row.channel}
                        onChange={(e) =>
                          updateBulkRow(row._rowId, "channel", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="sim-time-input"
                        type="datetime-local"
                        required
                        value={row.tanggal_pembayaran}
                        onChange={(e) => {
                          updateBulkRow(
                            row._rowId,
                            "tanggal_pembayaran",
                            e.target.value,
                          );
                          updateBulkRow(
                            row._rowId,
                            "tanggal_tagihan",
                            e.target.value,
                          );
                        }}
                      />
                    </td>
                  </>
                )}
                <td>
                  <button
                    className="sim-row-delete"
                    type="button"
                    onClick={() => removeBulkRow(row._rowId)}
                    disabled={bulkRows.length === 1}
                    aria-label={`Hapus baris ${index + 1}`}
                  >
                    <i className="bi bi-trash3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="sim-page">
      <header className="sim-header">
        <div className="sim-header__title">
          <span className="sim-header__icon">
            <i className="bi bi-bezier2" />
          </span>
          <div>
            <h1>Transaction Simulator</h1>
            <p>Uji alur deteksi fraud menggunakan data simulasi.</p>
          </div>
        </div>
        <div
          className={`sim-status ${isRunning ? "sim-status--running" : ""}`}
        >
          <span />
          {isRunning ? "Simulation running" : "Simulator idle"}
        </div>
      </header>

      <div className="sim-notice">
        <i className="bi bi-info-circle-fill" />
        <span>
          Semua transaksi dari halaman ini adalah <strong>data simulasi</strong>{" "}
          dan akan diproses oleh pipeline deteksi yang sama.
        </span>
      </div>

      <nav className="sim-tabs" aria-label="Simulator modes">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? "active" : ""}
            onClick={() => {
              if (tab.key !== "scenario" && service === "all") {
                setService("agenusa");
              }
              setActiveTab(tab.key);
              setResult(null);
              setError("");
            }}
          >
            <i className={`bi ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </nav>

      <ResultPanel
        result={result}
        error={error}
        onClose={() => {
          setResult(null);
          setError("");
        }}
      />

      {activeTab === "scenario" && (
        <section className="sim-card">
          <div className="sim-card__header">
            <div>
              <h2>Live scenario generator</h2>
              <p>Pilih skenario serangan yang sudah disiapkan backend.</p>
            </div>
          </div>
          <div className="sim-grid sim-grid--scenario">
            <div className="sim-form-grid">
              <Field label="Service">
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  <option value="all">Semua layanan</option>
                  <option value="agenusa">Agenusa</option>
                  <option value="nusabill">Nusabill</option>
                </select>
              </Field>
              <Field label="Scenario" as="div">
                <ScenarioDropdown
                  value={selectedScenario}
                  onChange={setSelectedScenario}
                  details={activeScenarioDetails}
                  options={scenarioOptions}
                />
              </Field>
              <div className="sim-actions sim-actions--wide">
                <button
                  className="sim-btn sim-btn--primary"
                  type="button"
                  disabled={!selectedScenario || busy || isRunning}
                  onClick={async () => {
                    const data = await runAction(
                      "start",
                      () =>
                        simulatorService.start(
                          service,
                          selectedScenario === "all" ? null : selectedScenario,
                        ),
                      {
                        mode: "scenario",
                        service,
                        label: preview?.title || selectedScenario,
                        total: preview?.transaction_count || 1,
                      },
                    );
                    if (data) setIsRunning(true);
                  }}
                >
                  <i
                    className={`bi ${busy === "start" ? "bi-arrow-repeat sim-spin" : "bi-play-fill"}`}
                  />
                  Jalankan scenario
                </button>
                <button
                  className="sim-btn sim-btn--danger"
                  type="button"
                  disabled={busy || !isRunning}
                  onClick={async () => {
                    const data = await runAction("stop", simulatorService.stop);
                    if (data) setIsRunning(false);
                  }}
                >
                  <i className="bi bi-stop-fill" />
                  Stop
                </button>
              </div>
            </div>
            <aside className="sim-preview">
              {preview ? (
                <>
                  <div className="sim-preview__topline">
                    <span>{preview.category}</span>
                    <strong
                      className={`sim-risk sim-risk--${
                        preview.expected_result?.includes("FRAUD")
                          ? "fraud"
                          : preview.expected_result === "SAFE"
                            ? "safe"
                            : "mixed"
                      }`}
                    >
                      {preview.expected_result}
                    </strong>
                  </div>
                  <h3>{preview.title}</h3>
                  <p>{preview.description}</p>
                  <dl>
                    <div>
                      <dt>Jumlah transaksi</dt>
                      <dd>{preview.transaction_count}</dd>
                    </div>
                    <div>
                      <dt>Target engine</dt>
                      <dd>{preview.target_engines?.join(", ") || "Baseline"}</dd>
                    </div>
                    {preview.global_rule && (
                      <div>
                        <dt>Rule key</dt>
                        <dd>{preview.global_rule.rule_key}</dd>
                      </div>
                    )}
                    {preview.global_rule && (
                      <div>
                        <dt>Action & severity</dt>
                        <dd>
                          {preview.global_rule.action} ·{" "}
                          {preview.global_rule.severity}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {preview.trigger_conditions?.length > 0 && (
                    <div className="sim-triggers">
                      <strong>Trigger conditions</strong>
                      {preview.trigger_conditions.map((item) => (
                        <code key={item}>{item}</code>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="sim-empty">Pilih scenario untuk melihat detail.</div>
              )}
            </aside>
          </div>
        </section>
      )}

      {(activeTab === "manual" || activeTab === "bulk") && (
        <form
          className="sim-card"
          onSubmit={activeTab === "manual" ? handleManual : handleBulk}
        >
          <div className="sim-card__header">
            <div>
              <h2>
                {activeTab === "manual"
                  ? "Manual transaction"
                  : "Bulk transaction"}
              </h2>
              <p>
                {activeTab === "manual"
                  ? "Kirim satu transaksi dengan parameter pilihanmu."
                  : "Buat template, lalu sesuaikan setiap transaksi di tabel."}
              </p>
            </div>
            <div className="sim-card__controls">
              <label className="sim-mode-toggle">
                <input
                  type="checkbox"
                  checked={advancedMode}
                  onChange={(e) => setAdvancedMode(e.target.checked)}
                />
                <span>
                  <i className="bi bi-sliders2" />
                  Advanced Mode
                </span>
              </label>
              <div className="sim-segmented">
                {["agenusa", "nusabill"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={service === item ? "active" : ""}
                    onClick={() => {
                      setService(item);
                      setBulkRows([]);
                      setBulkScenario("");
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {activeTab === "bulk" && (
            <div className="sim-bulk-scenario-preset">
              <div>
                <i className="bi bi-magic" />
                <span>
                  <strong>Scenario preset</strong>
                  Ambil pola yang sama dari Live Scenario ke tabel Bulk.
                </span>
              </div>
              <ScenarioDropdown
                value={bulkScenario}
                onChange={setBulkScenario}
                details={activeScenarioDetails.filter(
                  (detail) => detail.key !== "all",
                )}
                options={scenarioOptions.filter((option) => option !== "all")}
              />
              <button
                className="sim-btn sim-btn--ghost"
                type="button"
                disabled={!bulkScenario || busy === "bulk-scenario"}
                onClick={applyScenarioToBulk}
              >
                <i
                  className={`bi ${busy === "bulk-scenario" ? "bi-arrow-repeat sim-spin" : "bi-table"}`}
                />
                Terapkan scenario ke tabel
              </button>
            </div>
          )}
          <div className="sim-form-grid">
            {renderTransactionFields()}
            {activeTab === "manual" && anomalyField}
            {activeTab === "bulk" && (
              <>
                <Field label="Jumlah transaksi" hint="Maksimal 150">
                  <input
                    type="number"
                    min="1"
                    max={MAX_BULK_TRANSACTIONS}
                    required
                    value={bulkCount}
                    onChange={(e) => setBulkCount(e.target.value)}
                  />
                </Field>
                <Field label="Delay per transaksi (ms)" hint="0–5000 ms">
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    required
                    value={delayMs}
                    onChange={(e) => setDelayMs(e.target.value)}
                  />
                </Field>
                <label className="sim-check">
                  <input
                    type="checkbox"
                    checked={stopOnError}
                    onChange={(e) => setStopOnError(e.target.checked)}
                  />
                  <span>Berhenti saat satu transaksi gagal</span>
                </label>
              </>
            )}
          </div>
          {advancedMode && renderAdvancedFields()}
          {activeTab === "bulk" && (
            <>
              <div className="sim-template-actions">
                <button
                  className="sim-btn sim-btn--ghost"
                  type="button"
                  onClick={() => prepareBulkRows()}
                >
                  <i className="bi bi-arrow-down-square" />
                  Terapkan template ke {bulkCount} baris
                </button>
                <span>
                  Perubahan ini akan mengganti isi tabel yang sedang diedit.
                </span>
              </div>
              <div className="sim-pattern-helpers">
                  <div className="sim-pattern-helpers__intro">
                    <i className="bi bi-magic" />
                    <span>
                      <strong>Pattern helpers</strong>
                      Bentuk grouping dan urutan transaksi secara otomatis.
                    </span>
                  </div>
                  <label>
                    Interval
                    <span>
                      <input
                        type="number"
                        min="0"
                        max="3600"
                        value={bulkIntervalSeconds}
                        onChange={(e) =>
                          setBulkIntervalSeconds(e.target.value)
                        }
                      />
                      detik
                    </span>
                  </label>
                  <div className="sim-pattern-helpers__actions">
                    {service === "agenusa" ? (
                      <>
                        <button
                      type="button"
                      onClick={() => applyBulkHelper("same-card")}
                    >
                      <i className="bi bi-credit-card-2-front" />
                      Same card
                      <small>Untuk tx_count & total_amount</small>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyBulkHelper("unique-cards")}
                    >
                      <i className="bi bi-grid-3x3-gap" />
                      Unique cards + same EDC
                      <small>Untuk distinct_account_count</small>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyBulkHelper("failure-success")}
                      disabled={bulkRows.length < 4}
                      title={
                        bulkRows.length < 4
                          ? "Minimal 4 transaksi"
                          : "3 decline lalu success"
                      }
                    >
                      <i className="bi bi-arrow-down-up" />
                      Failure → success
                      <small>3× response 51, lalu 00</small>
                    </button>
                        </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => applyBulkHelper("same-customer")}
                        >
                          <i className="bi bi-person-badge" />
                          Same customer ID
                          <small>Untuk tx_count & total_amount</small>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyBulkHelper("unique-names")}
                        >
                          <i className="bi bi-people" />
                          Unique names
                          <small>Untuk distinct_customer_count</small>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyBulkHelper("underpayment")}
                        >
                          <i className="bi bi-graph-down-arrow" />
                          Underpayment
                          <small>Bayar 50% dari tagihan</small>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyBulkHelper("overpayment")}
                        >
                          <i className="bi bi-graph-up-arrow" />
                          Overpayment
                          <small>Bayar 150% dari tagihan</small>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyBulkHelper("api-velocity")}
                        >
                          <i className="bi bi-lightning-charge" />
                          API velocity burst
                          <small>Same ID, API, interval 2 detik</small>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => applyBulkHelper("timestamps")}
                    >
                      <i className="bi bi-clock-history" />
                      Redistribute time
                      <small>Pakai interval di atas</small>
                    </button>
                  </div>
                </div>
              {renderBulkTable()}
            </>
          )}
          <div className="sim-actions">
            <button
              className="sim-btn sim-btn--primary"
              type="submit"
              disabled={Boolean(busy)}
            >
              <i
                className={`bi ${busy ? "bi-arrow-repeat sim-spin" : activeTab === "manual" ? "bi-send-fill" : "bi-stack"}`}
              />
              {activeTab === "manual"
                ? "Simulasikan transaksi"
                : `Kirim ${bulkRows.length} transaksi`}
            </button>
          </div>
        </form>
      )}

      {activeTab === "replay" && (
        <form className="sim-card" onSubmit={handleReplay}>
          <div className="sim-card__header">
            <div>
              <h2>Replay transaction</h2>
              <p>Clone transaksi dari transaction feed dan proses ulang.</p>
            </div>
          </div>
          <div className="sim-form-grid">
            <Field label="Transaction ID">
              <input
                type="number"
                min="1"
                required
                value={replay.transaction_id}
                onChange={(e) =>
                  setReplay({ ...replay, transaction_id: e.target.value })
                }
                placeholder="Contoh: 125"
              />
            </Field>
            <Field label="Override amount (Rp)" hint="Opsional">
              <input
                type="number"
                min="1"
                value={replay.override_amount}
                onChange={(e) =>
                  setReplay({ ...replay, override_amount: e.target.value })
                }
              />
            </Field>
            <Field label="Override timestamp" hint="Opsional">
              <input
                type="datetime-local"
                value={replay.override_timestamp}
                onChange={(e) =>
                  setReplay({ ...replay, override_timestamp: e.target.value })
                }
              />
            </Field>
            <Field label="Inject anomaly">
              <select
                value={replay.inject_anomaly}
                onChange={(e) =>
                  setReplay({ ...replay, inject_anomaly: e.target.value })
                }
              >
                {ANOMALIES.map((item) => (
                  <option key={item || "none"} value={item}>
                    {item || "Tanpa anomali"}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="sim-actions">
            <button
              className="sim-btn sim-btn--primary"
              type="submit"
              disabled={Boolean(busy)}
            >
              <i className="bi bi-arrow-repeat" />
              Replay transaction
            </button>
          </div>
        </form>
      )}

      {activeTab === "history" && (
        <section className="sim-card">
          <div className="sim-card__header">
            <div>
              <h2>Simulation run history</h2>
              <p>
                Riwayat 30 eksekusi terbaru pada browser ini, lengkap dengan
                run ID dan transaction ID.
              </p>
            </div>
            {runHistory.length > 0 && (
              <button
                className="sim-btn sim-btn--ghost"
                type="button"
                onClick={() => {
                  localStorage.removeItem(HISTORY_KEY);
                  setRunHistory([]);
                }}
              >
                <i className="bi bi-trash3" /> Bersihkan history
              </button>
            )}
          </div>
          {runHistory.length === 0 ? (
            <div className="sim-history-empty">
              <i className="bi bi-clock-history" />
              <strong>Belum ada simulation run</strong>
              <span>Jalankan scenario, manual, bulk, atau replay terlebih dahulu.</span>
            </div>
          ) : (
            <div className="sim-history-wrap">
              <table className="sim-history-table">
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Mode</th>
                    <th>Service</th>
                    <th>Waktu</th>
                    <th>Result</th>
                    <th>Risk</th>
                    <th>Transaction IDs</th>
                  </tr>
                </thead>
                <tbody>
                  {runHistory.map((run) => (
                    <tr key={run.runId}>
                      <td>
                        <code>{run.runId}</code>
                        <small>{run.label}</small>
                      </td>
                      <td>
                        <span className="sim-history-mode">{run.mode}</span>
                      </td>
                      <td>{String(run.service).toUpperCase()}</td>
                      <td>
                        {new Date(run.startedAt).toLocaleString("id-ID")}
                        <small>{run.durationMs} ms</small>
                      </td>
                      <td>
                        <span
                          className={`sim-history-status sim-history-status--${run.status}`}
                        >
                          {run.status}
                        </span>
                        <small>
                          {run.succeeded}/{run.total} berhasil
                        </small>
                      </td>
                      <td>
                        {run.riskScore !== undefined
                          ? `${run.riskScore}/100`
                          : "—"}
                      </td>
                      <td>
                        {run.transactionIds?.length ? (
                          <div className="sim-transaction-chips">
                            {run.transactionIds.slice(0, 4).map((id) => (
                              <a
                                key={id}
                                href={`/transactions?search=${id}`}
                              >
                                #{id}
                              </a>
                            ))}
                            {run.transactionIds.length > 4 && (
                              <span>+{run.transactionIds.length - 4}</span>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === "reset" && (
        <section className="sim-card sim-card--danger">
          <div className="sim-danger-icon">
            <i className="bi bi-exclamation-octagon-fill" />
          </div>
          <div>
            <h2>Reset simulation data</h2>
            <p>
              Aksi ini menghapus data simulasi dari database dan tidak dapat
              dibatalkan.
            </p>
            <div className="sim-reset-form">
              <Field label="Target data">
                <select
                  value={resetTarget}
                  onChange={(e) => setResetTarget(e.target.value)}
                >
                  <option value="all">Semua data simulator</option>
                  <option value="agenusa">Agenusa</option>
                  <option value="nusabill">Nusabill</option>
                  <option value="transactions_feed">Transactions feed</option>
                </select>
              </Field>
              <Field label='Ketik "RESET" untuk konfirmasi'>
                <input
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  placeholder="RESET"
                />
              </Field>
              <button
                className="sim-btn sim-btn--danger"
                type="button"
                disabled={resetConfirmation !== "RESET" || Boolean(busy)}
                onClick={handleReset}
              >
                <i className="bi bi-trash3-fill" />
                Hapus data simulasi
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default TransactionSimulator;
