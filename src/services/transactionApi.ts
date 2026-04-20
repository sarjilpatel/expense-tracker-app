import apiClient from './apiClient';

/**
 * Add a new transaction
 * @param {Object} data - Transaction data (amount, type, category, etc.)
 * @returns {Promise} axios response
 */
export const addTransaction = async (data) => {
  try {
    const response = await apiClient.post('/transactions', data);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get all transactions for the user
 * @returns {Promise} axios response
 */
export const getTransactions = async () => {
  try {
    const response = await apiClient.get('/transactions');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get transaction analytics (income, expense, and category breakdown)
 * @returns {Promise} axios response
 */
export const getAnalytics = async () => {
  try {
    const response = await apiClient.get('/transactions/analytics');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

