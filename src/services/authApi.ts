import apiClient from './apiClient';

/**
 * Service for authentication related API calls.
 */
export const loginUser = async (email, password) => {
  try {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data; // Expected { token, user }
  } catch (error) {
    throw error.response?.data?.message || 'Login failed';
  }
};

export const signupUser = async (userData) => {
  try {
    const response = await apiClient.post('/auth/signup', userData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Signup failed';
  }
};
