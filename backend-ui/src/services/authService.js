import { API_CONFIG } from '../config/apiConfig';
import { api } from './api';
import { logInfo, logError } from '../utils/logger';

/**
 * Authentication service
 * Provides functions for login, logout, and checking authentication status
 */
const authService = {
  /**
   * Login user with username and password
   * @param {string} username - User's username
   * @param {string} password - User's password
   * @returns {Promise} - Login response with token
   */
  login: async (username, password) => {
    try {
      logInfo(`Attempting login for user: ${username}`);
      
      // Create form data - FastAPI's OAuth2 endpoint expects x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      const response = await api.post(API_CONFIG.ENDPOINTS.auth.login, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      // Store token in localStorage
      if (response.data && response.data.access_token) {
        const token = response.data.access_token;
        localStorage.setItem('accessToken', token);
        logInfo('Token stored in localStorage:', {
          tokenLength: token.length,
          tokenStart: token.substring(0, 20),
          storageCheck: localStorage.getItem('accessToken') === token
        });
        
        // Store refresh token if provided
        if (response.data.refresh_token) {
          localStorage.setItem('refresh_token', response.data.refresh_token);
        }
        
        logInfo('Login successful');
      }
      
      return response.data;
    } catch (error) {
      // For login endpoint errors, handle them without additional logging
      if (error.isAuthError || 
          error.response?.status === 401 || 
          error.message?.includes('Invalid')) {
        // For 401 errors, provide a consistent and user-friendly message
        const errorMessage = error.response?.data?.detail || 
                             error.message || 
                             'Invalid username or password';
        
        throw new Error(errorMessage);
      }
      
      // Log other errors
      logError('Login failed:', error);
      
      // Handle different error scenarios with custom error messages
      if (error.response) {
        const status = error.response.status;
        
        // Handle common authentication error codes
        if (status === 403) {
          throw new Error('Account is inactive or locked');
        } else if (status === 404) {
          throw new Error('User not found');
        } else if (status === 422) {
          throw new Error('Invalid login information provided');
        } else if (status === 429) {
          throw new Error('Too many failed attempts. Please try again later');
        } else if (status === 500) {
          // For login endpoints, a 500 error is very likely due to authentication failure
          throw new Error('Invalid username or password');
        }
      }
      
      // Generic error message for unknown errors
      throw new Error('Login failed. Please check your credentials and try again');
    }
  },
  
  /**
   * Logout user by removing tokens
   */
  logout: () => {
    logInfo('Logging out user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refresh_token');
    
    // Redirect to login page
    window.location.href = '/login';
  },
  
  /**
   * Check if user is authenticated
   * @returns {boolean} - True if authenticated, false otherwise
   */
  isAuthenticated: () => {
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      return false;
    }
    
    // You could add token expiration validation here if the token contains an exp claim
    try {
      // Basic check - if token exists and isn't empty
      return token && token.length > 20; // Just a simple length check
    } catch (e) {
      // If there's any error, clear token and return false
      localStorage.removeItem('accessToken');
      return false;
    }
  },
  
  /**
   * Get current authentication token
   * @returns {string|null} - Current token or null if not authenticated
   */
  getToken: () => {
    return localStorage.getItem('accessToken');
  },
  
  /**
   * Refresh authentication token
   * @returns {Promise} - Refresh response with new token
   */
  refreshToken: async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      logInfo('Attempting to refresh token');
      const response = await api.post(API_CONFIG.ENDPOINTS.auth.refreshToken, {
        refresh_token: refreshToken
      });
      
      if (response.data && response.data.access_token) {
        localStorage.setItem('accessToken', response.data.access_token);
        
        // Update refresh token if provided
        if (response.data.refresh_token) {
          localStorage.setItem('refresh_token', response.data.refresh_token);
        }
        
        logInfo('Token refresh successful');
        return response.data;
      }
      
      throw new Error('Invalid refresh response');
    } catch (error) {
      logError('Token refresh failed:', error);
      authService.logout();
      throw error;
    }
  }
};

export default authService; 