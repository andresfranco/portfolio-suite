import axios from 'axios';
import { API_CONFIG } from '../config/apiConfig';
import { logError } from '../utils/logger';

/**
 * Axios instance with authentication interceptors
 * This instance automatically handles token management via cookies
 * and adds CSRF tokens for state-mutating requests
 */
const axiosWithAuth = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
  withCredentials: true  // Required for cookie-based auth
});

// Request interceptor for adding CSRF token to state-mutating requests
axiosWithAuth.interceptors.request.use(
  (config) => {
    // Cookies (including access_token) are sent automatically
    // Just add CSRF token for POST/PUT/PATCH/DELETE
    const csrf = localStorage.getItem('csrf_token');
    if (csrf && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      config.headers['X-CSRF-Token'] = csrf;
    }
    
    return config;
  },
  (error) => {
    logError('Axios request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for handling 401 errors (cookie-based auth)
axiosWithAuth.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // If the error is 401 Unauthorized, clear auth state and redirect
    if (error.response?.status === 401) {
      // Clear local auth state - cookies are managed by backend
      localStorage.removeItem('csrf_token');
      localStorage.removeItem('isAuthenticated');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    
    return Promise.reject(error);
  }
);

export default axiosWithAuth; 