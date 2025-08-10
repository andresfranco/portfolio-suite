import axios from 'axios';
import { API_CONFIG } from '../config/apiConfig';
import { logInfo, logError } from '../utils/logger';

// Create an axios instance with default configuration
const axiosInstance = axios.create({
  baseURL: API_CONFIG?.BASE_URL || 'http://localhost:8000',
  timeout: API_CONFIG?.TIMEOUT || 10000,
  headers: API_CONFIG?.HEADERS || {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    // Log request for debugging
    logInfo(`API Request: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`, config.params || {});
    
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    logError('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
let isRefreshing = false;
let refreshPromise = null;

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error || {};
    if (!response) return Promise.reject(error);

    // Unauthorized access: attempt refresh once
    if (response.status === 401) {
      if (config && config._retry) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refresh_token');
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('accessToken');
        return Promise.reject(error);
      }

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.auth.refreshToken}`, {
            refresh_token: refreshToken
          }, { headers: { 'Content-Type': 'application/json' } })
          .then((res) => {
            const newToken = res.data?.access_token;
            if (newToken) {
              localStorage.setItem('accessToken', newToken);
            }
            if (res.data?.refresh_token) {
              localStorage.setItem('refresh_token', res.data.refresh_token);
            }
            return newToken;
          })
          .finally(() => { isRefreshing = false; });
        }

        const newToken = await refreshPromise;
        if (newToken) {
          const retryConfig = { ...config, _retry: true };
          retryConfig.headers = {
            ...(config.headers || {}),
            Authorization: `Bearer ${newToken}`,
          };
          return axiosInstance.request(retryConfig);
        }
      } catch (e) {
        // fall through to logging below
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refresh_token');
      }
    }

    // Log detailed error information
    if (response) {
      logError(`API Error (${response.status}):`, {
        url: config?.url,
        method: config?.method?.toUpperCase(),
        status: response.status,
        data: response.data
      });
    } else if (error.request) {
      logError('Network Error - No response from API:', {
        url: error.config?.url,
        method: error.config?.method?.toUpperCase()
      });
    } else {
      logError('Request Setup Error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance; 