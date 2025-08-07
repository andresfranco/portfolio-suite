import axios from 'axios';
import { API_CONFIG } from '../config/apiConfig';
import { logError } from '../utils/logger';

/**
 * Axios instance with authentication interceptors
 * This instance automatically handles token management, attaching auth headers,
 * and refreshing tokens when needed
 */
const axiosWithAuth = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS
});

// Request interceptor for adding auth token to requests
axiosWithAuth.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    logError('Axios request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for handling token refreshes and errors
axiosWithAuth.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is 401 Unauthorized and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Get the refresh token
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          // No refresh token available, redirect to login
          window.location.href = '/login';
          return Promise.reject(error);
        }
        
        // Try to refresh the token
        const response = await axios.post(`${API_CONFIG.BASE_URL}/api/auth/refresh-token`, {
          refresh_token: refreshToken
        });
        
        // If token refresh was successful
        if (response.data?.access_token) {
          // Update stored token
          localStorage.setItem('accessToken', response.data.access_token);
          
          // Update the failed request's auth header and retry
          originalRequest.headers['Authorization'] = `Bearer ${response.data.access_token}`;
          return axiosWithAuth(originalRequest);
        }
      } catch (refreshError) {
        logError('Token refresh failed:', refreshError);
        
        // Token refresh failed, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosWithAuth; 