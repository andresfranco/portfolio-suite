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
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Unauthorized access
      if (error.response.status === 401) {
        localStorage.removeItem('accessToken');
        // Redirect to login page if not already there
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      
      // Log detailed error information
      logError(`API Error (${error.response.status}):`, {
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      // The request was made but no response was received
      logError('Network Error - No response from API:', {
        url: error.config?.url,
        method: error.config?.method?.toUpperCase()
      });
    } else {
      // Something happened in setting up the request
      logError('Request Setup Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance; 