import axios, { InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  console.error('[apiClient] EXPO_PUBLIC_API_URL is not set — all API calls will fail.');
} else if (!API_BASE_URL.startsWith('https://') && !__DEV__) {
  console.error('[apiClient] EXPO_PUBLIC_API_URL must use HTTPS in production. Current value:', API_BASE_URL);
}

interface ApiClientInstance extends ReturnType<typeof axios.create> {
  logout?: () => Promise<void> | void;
  injectLogout: (logoutFn: () => Promise<void> | void) => void;
}

let isRefreshing = false;
let isLoggingOut = false;
let refreshQueue: Array<(token: string) => void> = [];

function drainQueue(newToken: string) {
  refreshQueue.forEach(cb => cb(newToken));
  refreshQueue = [];
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
}) as ApiClientInstance;

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {}
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Only attempt refresh on 401, once per request, and not on the refresh endpoint itself
    if (
      error.response?.status === 401 &&
      !original._retried &&
      !original.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue this request until the in-flight refresh completes
        return new Promise(resolve => {
          refreshQueue.push((token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(original));
          });
        });
      }

      original._retried = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('no_refresh_token');

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const newToken: string = data.token;

        await SecureStore.setItemAsync('token', newToken);
        drainQueue(newToken);

        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch {
        refreshQueue = [];
        // Refresh failed — session truly expired, force logout
        if (apiClient.logout && !isLoggingOut) {
          isLoggingOut = true;
          try { await apiClient.logout(); } finally { isLoggingOut = false; }
        }
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

apiClient.injectLogout = (logoutFn) => {
  apiClient.logout = logoutFn;
};

export default apiClient;
