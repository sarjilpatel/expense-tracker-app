import apiClient, { LONG_TIMEOUT_MS } from './apiClient';
import { getCachedProfile, setCachedProfile, invalidateCachedProfile } from '@/src/cache/transactionCache';

/**
 * Service for authentication related API calls.
 */
export const loginUser = async (email: string, password: string) => {
  try {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data; // Expected { token, user }
  } catch (error: any) {
    throw error.response?.data?.message || 'Login failed';
  }
};

/**
 * Revoke every refresh token for this user server-side.
 *
 * Best-effort: logging out locally must succeed even with no network, so the caller ignores a
 * rejection here. Without this call, clearing SecureStore only hides the tokens — the refresh
 * token stays valid on the server for its full lifetime.
 */
export const logoutUser = async () => {
  await apiClient.post('/auth/logout');
};

export interface SignupData {
  name:      string;
  email:     string;
  password:  string;
  /** IANA zone from the device — the server uses it to run recurring transactions in the
   *  user's own calendar. */
  timezone?: string;
}

export interface OtpSent {
  message:          string;
  email:            string;
  expiresInMinutes: number;
}

/**
 * Step one of signup. Creates nothing — the server holds the account against a six-digit code and
 * mails it (W1-32). The reply is identical for an address that is already registered, so the only
 * honest thing to do with it is move to the verify screen either way.
 */
export const signupUser = async (userData: SignupData): Promise<OtpSent> => {
  try {
    const response = await apiClient.post('/auth/signup', userData);
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Signup failed';
  }
};

/** Step two: the code is what creates the account, so this is the call that returns tokens. */
export const verifySignup = async (email: string, code: string) => {
  try {
    const response = await apiClient.post('/auth/verify-signup', { email, code });
    return response.data; // { token, refreshToken, user }
  } catch (error: any) {
    throw error.response?.data?.message || 'Verification failed';
  }
};

/** Ask for a fresh code. The server enforces its own 60s cooldown; the button counts down too. */
export const resendOtp = async (email: string, purpose: 'signup' | 'reset'): Promise<void> => {
  try {
    await apiClient.post('/auth/resend-otp', { email, purpose });
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to resend code';
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
      timeout: LONG_TIMEOUT_MS,
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

export const forgotPassword = async (email: string): Promise<OtpSent> => {
  try {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to send reset code';
  }
};

/** The code and the new password arrive together — there is no intermediate reset session. */
export const resetPassword = async (email: string, code: string, password: string): Promise<void> => {
  try {
    await apiClient.post('/auth/reset-password', { email, code, password });
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to reset password';
  }
};

export const updateAiConsent = async (aiConsentGiven: boolean): Promise<void> => {
  try {
    await apiClient.patch('/auth/ai-consent', { aiConsentGiven });
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to update AI consent';
  }
};

/**
 * The device's IANA zone, or null when the runtime cannot name one.
 *
 * Kept here rather than read at the call site so the "what zone are we in" question has one
 * answer: signup asks Intl directly, and this has to agree with it.
 */
export const deviceTimezone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

export const updateTimezone = async (timezone: string): Promise<{ timezone: string; updated: boolean }> => {
  try {
    const response = await apiClient.patch('/auth/timezone', { timezone });
    return response.data;
  } catch (error: any) {
    throw error.response?.data?.message || 'Failed to update time zone';
  }
};

/**
 * Sends the device zone up when it differs from the one on the account (W1-30).
 *
 * `User.timezone` decides when the server fires a user's recurring transactions, and used to be
 * written once at signup — someone who moved kept firing on their old day forever. Returns the
 * zone that was stored so the caller can update its local copy, or null when nothing was sent.
 *
 * Best-effort by design: this runs on every start, so being offline, or on a build whose Intl data
 * the server does not recognise, must be silent rather than an error the user sees on launch.
 */
export const syncDeviceTimezone = async (storedTimezone?: string | null): Promise<string | null> => {
  const zone = deviceTimezone();
  if (!zone || zone === storedTimezone) return null;
  try {
    await updateTimezone(zone);
    return zone;
  } catch {
    return null;
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
