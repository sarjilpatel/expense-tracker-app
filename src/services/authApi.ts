import apiClient from './apiClient';
import { getCachedProfile, setCachedProfile, invalidateCachedProfile } from '@/src/cache/transactionCache';

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

export const getProfile = async () => {
  try {
    const cached = await getCachedProfile();
    if (cached) {
      apiClient.get('/auth/me')
        .then(r => setCachedProfile(r.data))
        .catch(() => {});
      return cached;
    }
    const response = await apiClient.get('/auth/me');
    setCachedProfile(response.data);
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to fetch profile';
  }
};

export const updateProfile = async (formData: FormData) => {
  try {
    const response = await apiClient.put('/auth/update-profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    invalidateCachedProfile();
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to update profile';
  }
};

export const deleteAccount = async (password: string): Promise<void> => {
  try {
    await apiClient.delete('/auth/account', { data: { password } });
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to delete account';
  }
};
