import apiClient, { LONG_TIMEOUT_MS } from './apiClient';

/**
 * Add a new transaction
 * @param {Object} data - Transaction data (amount, type, category, etc.)
 */
export const addTransaction = async (data: any) => {
  try {
    const response = await apiClient.post('/transactions', data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get transactions with optional date filter
 */
export const getTransactions = async (
  month?: number, year?: number, search?: string, page = 1, limit = 50
) => {
  try {
    const params: any = { page, limit };
    if (month && year) { params.month = month; params.year = year; }
    if (search && search.trim()) params.search = search.trim();
    const response = await apiClient.get('/transactions', { params });
    // Backend returns { transactions, pagination } — normalise for callers
    const data = response.data;
    if (data && data.transactions) return data.transactions;
    return data; // fallback for old server
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

/** Server clamps `limit` to 100 (`Math.min(100, ...)`), so this is the largest useful page. */
const MAX_PAGE_SIZE = 100;

/**
 * Safety valve. 50 pages is 5000 transactions; the global limiter is 60 req/min, so a run that
 * needs more pages than this would be throttled anyway. Better to stop than to hammer the API.
 */
const MAX_PAGES = 50;

/**
 * Every matching transaction, not just the first page.
 *
 * `getTransactions` sends no `page`/`limit`, so the server's default of 50 applies and the caller
 * silently gets the newest 50 rows. That is fine for a list view but wrong for exports, backups
 * and balance sums. Use this wherever a partial answer would be incorrect rather than merely
 * short.
 */
export const getAllTransactions = async (
  month?: number, year?: number, search?: string
): Promise<any[]> => {
  try {
    const params: any = { limit: MAX_PAGE_SIZE };
    if (month && year) { params.month = month; params.year = year; }
    if (search && search.trim()) params.search = search.trim();

    const all: any[] = [];
    let page = 1;
    let pages = 1;

    do {
      const { data } = await apiClient.get('/transactions', { params: { ...params, page } });
      // Old servers returned a bare array with no pagination envelope.
      if (Array.isArray(data)) return data;

      all.push(...(data?.transactions ?? []));
      pages = data?.pagination?.pages ?? 1;
      page += 1;
    } while (page <= pages && page <= MAX_PAGES);

    return all;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get transaction analytics with optional date filter
 */
export const getAnalytics = async (month?: number, year?: number) => {
  try {
    const params = (month && year) ? { month, year } : {};
    const response = await apiClient.get('/transactions/analytics', { params });
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

/**
 * Update an existing transaction
 */
export const updateTransaction = async (id: string, data: any) => {
  try {
    const response = await apiClient.put(`/transactions/${id}`, data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

/**
 * Soft-delete a transaction (restorable within 30 days)
 */
export const deleteTransaction = async (id: string) => {
  try {
    const response = await apiClient.delete(`/transactions/${id}`);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

/**
 * Restore a soft-deleted transaction
 */
export const restoreTransaction = async (id: string) => {
  try {
    const response = await apiClient.post(`/transactions/${id}/restore`);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get AI-powered spending insights for a month
 */
export const getInsights = async (month: number, year: number): Promise<{
  insights: Array<{ title: string; body: string; type: 'positive' | 'warning' | 'neutral' }>;
  month: number;
  year: number;
  noData?: boolean;
}> => {
  try {
    const response = await apiClient.get('/transactions/insights', {
      params: { month, year },
      timeout: LONG_TIMEOUT_MS,
    });
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get monthly income/expense trend for the last N months
 */
export const getTrend = async (months = 6) => {
  try {
    const response = await apiClient.get('/transactions/analytics/trend', { params: { months } });
    return response.data as Array<{
      month: number;
      year: number;
      monthLabel: string;
      income: number;
      expense: number;
      net: number;
    }>;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};
