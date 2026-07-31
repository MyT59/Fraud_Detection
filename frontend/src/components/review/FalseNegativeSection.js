import React, { useEffect, useState } from "react";
import { reportFalseNegative } from "../../services/reviewApiService";
import transactionService from "../../services/transactionService";

const formatAmount = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const FalseNegativeSection = () => {
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [searching, setSearching] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2 || selectedTransaction) {
      setCandidates([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await transactionService.getTransactions({
          search: term,
          final_status: "SAFE",
          size: 5,
        });
        setCandidates(response.data || []);
      } catch (error) {
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, selectedTransaction]);

  const isDisabled = submitting || !selectedTransaction || reason.trim().length < 10;

  const handleSubmit = async () => {
    if (!selectedTransaction?.id) {
      setResult({
        type: "error",
        message: "Pilih transaksi SAFE terlebih dahulu.",
      });
      return;
    }
    if (reason.trim().length < 10) {
      setResult({ type: "error", message: "Alasan minimal 10 karakter." });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      await reportFalseNegative(selectedTransaction.id, reason.trim());
      setResult({
        type: "success",
        message: `Transaksi #${selectedTransaction.id} berhasil ditandai sebagai False Negative. Dataset retraining diperbarui.`,
      });
      setSearch("");
      setCandidates([]);
      setSelectedTransaction(null);
      setReason("");
    } catch (err) {
      const status = err.status ?? 0;
      let message;
      if (status === 404) message = "Transaksi yang dipilih tidak ditemukan.";
      else if (status === 400)
        message = err.message || "Hanya transaksi berstatus SAFE yang dapat dilaporkan.";
      else
        message = err.message || "Gagal melaporkan false negative. Coba lagi.";
      setResult({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="false-negative-panel">
      <div className="false-negative-header">
        <span className="review-panel-icon orange">
          <i className="bi bi-bug-fill" />
        </span>
        <div>
          <h3>Report False Negative</h3>
          <p>
            Laporkan transaksi yang lolos dari deteksi sistem, namun setelah
            investigasi terbukti fraud.
          </p>
        </div>
      </div>

      <div className="false-negative-note">
        <i className="bi bi-exclamation-triangle-fill" />
        <span>
          Hanya transaksi berstatus SAFE yang dapat dilaporkan. Status transaksi
          akan menjadi FRAUD dan feedback fraud dipakai untuk pattern discovery.
        </span>
      </div>

      <div className="false-negative-form">
        <label className="review-field">
          <span>
            Cari transaksi SAFE <strong>*</strong>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedTransaction(null);
              setResult(null);
            }}
            placeholder="Cari ID, original transaction ID, atau akun..."
            disabled={Boolean(selectedTransaction)}
          />
          <small>Pilih satu transaksi SAFE dari hasil pencarian.</small>
          {searching && <small className="false-negative-search-state">Mencari transaksi...</small>}
          {!selectedTransaction && candidates.length > 0 && (
            <div className="false-negative-candidates">
              {candidates.map((transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  className="false-negative-candidate"
                  onClick={() => {
                    setSelectedTransaction(transaction);
                    setSearch(transaction.original_trx_id || `#${transaction.id}`);
                    setCandidates([]);
                    setResult(null);
                  }}
                >
                  <strong>#{transaction.id} · {transaction.original_trx_id || "Tanpa original ID"}</strong>
                  <span>{transaction.service_source} · {formatAmount(transaction.amount)} · {transaction.user_account_id || "Akun tidak tersedia"}</span>
                </button>
              ))}
            </div>
          )}
          {!selectedTransaction && search.trim().length >= 2 && !searching && candidates.length === 0 && (
            <small className="false-negative-search-state">Tidak ada transaksi SAFE yang cocok.</small>
          )}
          {selectedTransaction && (
            <div className="false-negative-selected">
              <div>
                <strong>Dipilih: #{selectedTransaction.id} · {selectedTransaction.original_trx_id}</strong>
                <span>{selectedTransaction.service_source} · {formatAmount(selectedTransaction.amount)} · SAFE</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTransaction(null);
                  setSearch("");
                  setResult(null);
                }}
              >
                Ganti
              </button>
            </div>
          )}
        </label>

        <label className="review-field review-field-wide">
          <span>
            Alasan <strong>*</strong>
            <em>min. 10, maks. 1000 karakter</em>
          </span>
          <textarea
            rows={4}
            maxLength={1000}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setResult(null);
            }}
            placeholder="Jelaskan kenapa transaksi ini seharusnya terdeteksi sebagai fraud..."
          />
          <small className="review-char-count">{reason.length}/1000</small>
        </label>
      </div>

      {result && (
        <div className={`review-form-result ${result.type}`}>
          <i
            className={`bi ${
              result.type === "success"
                ? "bi-check-circle-fill"
                : "bi-exclamation-circle-fill"
            }`}
          />
          {result.message}
        </div>
      )}

      <div className="false-negative-actions">
        <button
          className="review-danger-submit"
          onClick={handleSubmit}
          disabled={isDisabled}
        >
          {submitting ? (
            <>
              <span className="review-spinner" />
              Melaporkan...
            </>
          ) : (
            <>
              <i className="bi bi-bug-fill" />
              Laporkan False Negative
            </>
          )}
        </button>
      </div>
    </section>
  );
};

export default FalseNegativeSection;
