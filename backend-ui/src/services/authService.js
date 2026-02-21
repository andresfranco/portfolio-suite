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
   * @returns {Promise} - Login response with user data and CSRF token
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
        },
        withCredentials: true // Important: Include cookies in request/response
      });
      
      // Check if MFA is required
      if (response.data && response.data.mfa_required) {
        logInfo('MFA verification required');
        return {
          mfa_required: true,
          session_token: response.data.session_token,
          message: response.data.message
        };
      }
      
      // Tokens are now in httpOnly cookies (secure)
      // Store only the CSRF token for subsequent requests
      if (response.data && response.data.csrf_token) {
        localStorage.setItem('csrf_token', response.data.csrf_token);
        logInfo('Login successful - tokens stored in secure cookies');
      }
      
      // Mark as authenticated (cookies will be sent automatically)
      if (response.data && response.data.success) {
        localStorage.setItem('isAuthenticated', 'true');
        logInfo('User authenticated successfully');
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
   * Verify MFA code to complete login
   * @param {string} sessionToken - Temporary session token from initial login
   * @param {string} code - 6-digit TOTP code or backup code
   * @returns {Promise} - Login response with user data and CSRF token
   */
  verifyMfaLogin: async (sessionToken, code) => {
    try {
      logInfo('Attempting MFA verification');
      
      const response = await api.post(API_CONFIG.ENDPOINTS.auth.mfaVerifyLogin, {
        session_token: sessionToken,
        code: code
      }, {
        withCredentials: true // Important: Include cookies in request/response
      });
      
      // Tokens are now in httpOnly cookies (secure)
      // Store only the CSRF token for subsequent requests
      if (response.data && response.data.csrf_token) {
        localStorage.setItem('csrf_token', response.data.csrf_token);
        logInfo('MFA verification successful - tokens stored in secure cookies');
      }
      
      // Mark as authenticated
      if (response.data && response.data.success) {
        localStorage.setItem('isAuthenticated', 'true');
        logInfo('User authenticated successfully after MFA');
      }
      
      return response.data;
    } catch (error) {
      logError('MFA verification failed:', error);
      
      const errorMessage = error.response?.data?.detail || 
                           error.message || 
                           'Invalid MFA code';
      
      throw new Error(errorMessage);
    }
  },
  
  /**
   * Logout user by removing tokens and authentication state
   */
  logout: () => {
    logInfo('Logging out user');
    localStorage.removeItem('csrf_token');
    localStorage.removeItem('isAuthenticated');
    
    // Note: httpOnly cookies will be cleared by backend on logout endpoint
    // or will expire naturally
    
    // Redirect to login page
    window.location.href = '/login';
  },
  
  /**
   * Check if user is authenticated
   * @returns {boolean} - True if authenticated, false otherwise
   */
  isAuthenticated: () => {
    // With httpOnly cookies, we can't directly access the token
    // Check if authentication flag is set (backend will validate actual cookie)
    const isAuth = localStorage.getItem('isAuthenticated');
    return isAuth === 'true';
  },
  
  /**
   * Get current CSRF token for API requests
   * @returns {string|null} - Current CSRF token or null if not authenticated
   */
  getToken: () => {
    // Return CSRF token instead (access token is in httpOnly cookie)
    return localStorage.getItem('csrf_token');
  },
  
  /**
   * Get CSRF token for protected requests
   * @returns {string|null} - CSRF token or null
   */
  getCsrfToken: () => {
    return localStorage.getItem('csrf_token');
  },
  
  /**
   * Refresh authentication token
   * @returns {Promise} - Refresh response with new token
   */
  refreshToken: async () => {
    try {
      logInfo('Attempting to refresh token');
      
      // Refresh token is in httpOnly cookie, backend will read it automatically
      const response = await api.post(API_CONFIG.ENDPOINTS.auth.refreshToken, {}, {
        withCredentials: true // Important: Send cookies with request
      });
      
      if (response.data && response.data.success) {
        // Update CSRF token if provided
        if (response.data.csrf_token) {
          localStorage.setItem('csrf_token', response.data.csrf_token);
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