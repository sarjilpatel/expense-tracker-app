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

export const deleteAccount = async (password: string): Promise<{ deletionScheduledAt: string }> => {
  try {
    const response = await apiClient.delete('/auth/account', { data: { password } });
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to delete account';
  }
};

export const cancelAccountDeletion = async (): Promise<void> => {
  try {
    await apiClient.post('/auth/account/cancel-deletion');
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to cancel deletion';
  }
};

export const forgotPassword = async (email: string): Promise<void> => {
  try {
    await apiClient.post('/auth/forgot-password', { email });
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to send reset email';
  }
};

export const resetPassword = async (token: string, password: string): Promise<void> => {
  try {
    await apiClient.post(`/auth/reset-password/${token}`, { password });
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to reset password';
  }
};

export const resendVerificationEmail = async (): Promise<void> => {
  try {
    await apiClient.post('/auth/resend-verification');
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to resend verification email';
  }
};

export const updateAiConsent = async (aiConsentGiven: boolean): Promise<void> => {
  try {
    await apiClient.patch('/auth/ai-consent', { aiConsentGiven });
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to update AI consent';
  }
};

export const getProfilePhotoUrl = async (): Promise<string | null> => {
  try {
    const response = await apiClient.get('/auth/me/photo-url');
    return response.data.url;
  } catch {
    return null;
  }
};

export const googleAuthLogin = async (idToken: string) => {
  try {
    const response = await apiClient.post('/auth/google', { idToken });
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Google sign-in failed';
  }
};
