// src/services/transactionService.js

import { api } from "./apiService";

export const transactionService = {
  /**
   * GET /transactions
   */
  getTransactions: async ({
    search,
    service_source,
    final_status,
    risk_level,
    is_flagged_ml,
    city,
    country,
    min_amount,
    max_amount,
    start_date,
    end_date,
    sort_by = "transaction_time",
    sort_order = "desc",
    page = 1,
    size = 20,
    requestOptions = {},
  } = {}) => {
    const params = new URLSearchParams();

    if (search) params.append("search", search);

    if (service_source) params.append("service_source", service_source);

    if (final_status) params.append("final_status", final_status);

    if (risk_level) params.append("risk_level", risk_level);

    if (is_flagged_ml !== undefined)
      params.append("is_flagged_ml", is_flagged_ml);

    if (city) params.append("city", city);

    if (country) params.append("country", country);

    if (min_amount !== undefined) params.append("min_amount", min_amount);

    if (max_amount !== undefined) params.append("max_amount", max_amount);

    if (start_date) params.append("start_date", start_date);

    if (end_date) params.append("end_date", end_date);

    if (sort_by) params.append("sort_by", sort_by);

    if (sort_order) params.append("sort_order", sort_order);

    params.append("page", page);
    params.append("size", size);

    return api.get(`/transactions?${params.toString()}`, requestOptions);
  },

  /**
   * GET /transactions/{id}
   */
  getTransactionById: async (transactionId, requestOptions = {}) => {
    return api.get(`/transactions/${transactionId}`, requestOptions);
  },
};

export default transactionService;
