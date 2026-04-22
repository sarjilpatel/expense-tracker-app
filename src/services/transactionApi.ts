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
export const getTransactions = async (month?: number, year?: number) => {
  try {
    const params = (month && year) ? { month, year } : {};
    const response = await apiClient.get('/transactions', { params });
    return response.data;
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
 * Delete a transaction
 */
export const deleteTransaction = async (id: string) => {
  try {
    const response = await apiClient.delete(`/transactions/${id}`);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};
