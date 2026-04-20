import axios, { InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Dynamically set the API URL based on the platform
const API_BASE_URL = Platform.select({
  web: 'http://10.189.35.72:5000/api',
  android: 'http://10.189.35.72:5000/api',
  ios: 'http://10.189.35.72:5000/api',
});

interface ApiClientInstance extends ReturnType<typeof axios.create> {
  logout?: () => Promise<void> | void;
  injectLogout: (logoutFn: () => Promise<void> | void) => void;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
}) as ApiClientInstance;

// Interceptor to add Authorization token automatically
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error fetching token from storage', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle 401 Unauthorized responses
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      if (apiClient.logout) {
        await apiClient.logout();
      }
    }
    return Promise.reject(error);
  }
);

apiClient.injectLogout = (logoutFn) => {
  apiClient.logout = logoutFn;
};

export default apiClient;
