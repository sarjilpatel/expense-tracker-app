import apiClient from './apiClient';

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
    const response = await apiClient.get('/transactions/insights', { params: { month, year } });
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
