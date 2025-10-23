import { api } from './api';
import { logError, logInfo } from '../utils/logger';
import { API_CONFIG } from '../config/apiConfig';

/**
 * MFA (Multi-Factor Authentication) API service
 * This service handles all API interactions related to MFA
 */
const mfaApi = {
  /**
   * Get MFA status for a specific user (admin only)
   * @param {number} userId - User ID
   * @returns {Promise} - Response from API with MFA status
   */
  getMfaStatus: async (userId) => {
    try {
      logInfo(`Fetching MFA status for user ${userId}`);
      const response = await api.get(`${API_CONFIG.ENDPOINTS.mfa.status}?user_id=${userId}`);
      return response;
    } catch (error) {
      logError(`Error fetching MFA status for user ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Start MFA enrollment for a user (admin can enroll for any user)
   * @param {number} userId - User ID
   * @param {string} password - Admin's password for verification
   * @returns {Promise} - Response with QR code and secret
   */
  startEnrollment: async (userId, password) => {
    try {
      logInfo(`Starting MFA enrollment for user ${userId}`);
      const response = await api.post(API_CONFIG.ENDPOINTS.mfa.enroll, {
        user_id: userId,
        password: password
      });
      return response;
    } catch (error) {
      logError(`Error starting MFA enrollment for user ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Verify and complete MFA enrollment
   * @param {number} userId - User ID
   * @param {string} code - TOTP code from authenticator app
   * @returns {Promise} - Response with backup codes
   */
  verifyEnrollment: async (userId, code) => {
    try {
      logInfo(`Verifying MFA enrollment for user ${userId}`);
      const response = await api.post(API_CONFIG.ENDPOINTS.mfa.verifyEnrollment, {
        user_id: userId,
        code: code
      });
      return response;
    } catch (error) {
      logError(`Error verifying MFA enrollment for user ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Disable MFA for a user
   * @param {number} userId - User ID
   * @param {string} password - Admin's password for verification
   * @returns {Promise} - Response from API
   */
  disableMfa: async (userId, password) => {
    try {
      logInfo(`Disabling MFA for user ${userId}`);
      const response = await api.post(API_CONFIG.ENDPOINTS.mfa.disable, {
        user_id: userId,
        password: password
      });
      return response;
    } catch (error) {
      logError(`Error disabling MFA for user ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Reset MFA device for a user who lost their authenticator
   * @param {number|null} userId - User ID (null for current user, or specific ID for admin)
   * @param {string} password - User's/Admin's password for verification
   * @returns {Promise} - Response with new QR code and backup codes
   */
  resetDevice: async (userId, password) => {
    try {
      logInfo(`Resetting MFA device for user ${userId || 'current user'}`);
      const payload = {
        password: password
      };
      
      // Only include user_id if provided (admin resetting for another user)
      if (userId) {
        payload.user_id = userId;
      }
      
      const response = await api.post(API_CONFIG.ENDPOINTS.mfa.resetDevice, payload);
      return response;
    } catch (error) {
      logError(`Error resetting MFA device for user ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Regenerate backup codes for a user
   * @param {number} userId - User ID
   * @param {string} password - Admin's password for verification
   * @param {string|null} code - Admin's MFA code for verification (optional, only if admin has MFA)
   * @returns {Promise} - Response with new backup codes
   */
  regenerateBackupCodes: async (userId, password, code = null) => {
    try {
      logInfo(`Regenerating backup codes for user ${userId}`);
      const payload = {
        user_id: userId,
        password: password
      };
      
      // Only include code if provided
      if (code) {
        payload.code = code;
      }
      
      const response = await api.post(API_CONFIG.ENDPOINTS.mfa.regenerateBackupCodes, payload);
      return response;
    } catch (error) {
      logError(`Error regenerating backup codes for user ${userId}:`, error);
      throw error;
    }
  },

  // Self-service MFA functions (for current user)
  
  /**
   * Enroll current user in MFA (self-service)
   * @param {string} password - User's password for verification
   * @returns {Promise} - Response with QR code, secret, and backup codes
   */
  enroll: async (password) => {
    try {
      logInfo('Enrolling current user in MFA');
      const response = await api.post(API_CONFIG.ENDPOINTS.mfa.enroll, {
        password: password
        // No user_id means current user
      });
      return response;
    } catch (error) {
      logError('Error enrolling in MFA:', error);
      throw error;
    }
  },

  /**
   * Verify and complete MFA enrollment for current user (self-service)
   * @param {string} secret - The TOTP secret from enrollment
   * @param {string} code - TOTP code from authenticator app
   * @returns {Promise} - Response confirming enrollment
   */
  verifyEnrollmentSelf: async (secret, code) => {
    try {
      logInfo('Verifying MFA enrollment for current user');
      const response = await api.post(API_CONFIG.ENDPOINTS.mfa.verifyEnrollment, {
        secret: secret,
        code: code
        // No user_id means current user
      });
      return response;
    } catch (error) {
      logError('Error verifying MFA enrollment:', error);
      throw error;
    }
  },

  /**
   * Disable MFA for current user (self-service)
   * @param {string} password - User's password for verification
   * @returns {Promise} - Response from API
   */
  disable: async (password) => {
    try {
      logInfo('Disabling MFA for current user');
      const response = await api.post(API_CONFIG.ENDPOINTS.mfa.disable, {
        password: password
        // No user_id means current user
      });
      return response;
    } catch (error) {
      logError('Error disabling MFA:', error);
      throw error;
    }
  }
};

export default mfaApi;

