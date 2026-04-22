import apiClient from './apiClient';

/**
 * Get budgets for the current group
 * @param {number} month 
 * @param {number} year 
 * @returns {Promise} axios response
 */
export const getBudgets = async (month?: number, year?: number) => {
  try {
    const params = month && year ? { month, year } : {};
    const response = await apiClient.get('/budgets', { params });
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

/**
 * Set or update a budget
 * @param {Object} data - Budget data (amount, month, year, category)
 * @returns {Promise} axios response
 */
export const setBudget = async (data: { amount: number; month?: number; year?: number; category?: string | null }) => {
  try {
    const response = await apiClient.post('/budgets', data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

export const deleteBudget = async (id: string) => {
  try {
    const response = await apiClient.delete(`/budgets/${id}`);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};
