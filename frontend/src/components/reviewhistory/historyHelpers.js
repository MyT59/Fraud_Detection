/**
 * historyHelpers.js
 * Pure utility functions untuk Review History module.
 * Tidak ada React dependency — bisa di-unit test tanpa renderer.
 */

/**
 * Format ISO datetime → string lokal Indonesia
 * @param {string|null} ds
 * @returns {string}
 */
export const fmtTs = (ds) => {
  if (!ds) return "—";
  return new Date(ds).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Hitung selisih waktu dari sekarang → string ringkas
 * @param {string|null} ds
 * @returns {string}
 */
export const timeAgo = (ds) => {
  if (!ds) return "";
  const diff = (Date.now() - new Date(ds).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};
