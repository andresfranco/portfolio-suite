import axios from 'axios';
import { API_CONFIG } from '../config/apiConfig';
import { logInfo, logError } from '../utils/logger';

// Create an axios instance with default configuration
const axiosInstance = axios.create({
  baseURL: API_CONFIG?.BASE_URL || 'http://localhost:8000',
  timeout: API_CONFIG?.TIMEOUT || 10000,
  headers: API_CONFIG?.HEADERS || {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // Required for cookie-based auth
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    // Log request for debugging
    logInfo(`API Request: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`, config.params || {});
    
    // Cookies are sent automatically; just add CSRF token for state-mutating requests
    const csrf = localStorage.getItem('csrf_token');
    if (csrf && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      config.headers['X-CSRF-Token'] = csrf;
    }
    return config;
  },
  (error) => {
    logError('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors (cookie-based auth)
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error || {};
    if (!response) return Promise.reject(error);

    // Unauthorized access: clear auth state
    if (response.status === 401) {
      localStorage.removeItem('csrf_token');
      localStorage.removeItem('isAuthenticated');
      // Redirect happens in main api.js interceptor
      return Promise.reject(error);
    }

    // Log detailed error information (response is guaranteed non-null here)
    logError(`API Error (${response.status}):`, {
      url: config?.url,
      method: config?.method?.toUpperCase(),
      status: response.status,
      data: response.data
    });

    return Promise.reject(error);
  }
);

export default axiosInstance; 