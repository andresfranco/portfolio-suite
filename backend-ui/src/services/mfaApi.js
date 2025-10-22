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
   * Regenerate backup codes for a user
   * @param {number} userId - User ID
   * @param {string} password - Admin's password for verification
   * @returns {Promise} - Response with new backup codes
   */
  regenerateBackupCodes: async (userId, password) => {
    try {
      logInfo(`Regenerating backup codes for user ${userId}`);
      const response = await api.post(API_CONFIG.ENDPOINTS.mfa.regenerateBackupCodes, {
        user_id: userId,
        password: password
      });
      return response;
    } catch (error) {
      logError(`Error regenerating backup codes for user ${userId}:`, error);
      throw error;
    }
  }
};

export default mfaApi;

