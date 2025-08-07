import axios from 'axios';
import { logInfo, logError } from './logger';

/**
 * Wrapper for HTTP requests with axios to standardize API calls 
 * and simplify error handling
 */
export const fetchWrapper = {
  /**
   * GET request
   * @param {string} url - URL to fetch
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  get: async (url, options = {}) => {
    try {
      logInfo(`GET request to: ${url}`);
      const response = await axios.get(url, options);
      return response;
    } catch (error) {
      logError(`Error in GET request to ${url}:`, error);
      throw error;
    }
  },

  /**
   * POST request
   * @param {string} url - URL to fetch
   * @param {Object} body - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  post: async (url, body, options = {}) => {
    try {
      logInfo(`POST request to: ${url}`);
      const response = await axios.post(url, body, options);
      return response;
    } catch (error) {
      logError(`Error in POST request to ${url}:`, error);
      throw error;
    }
  },

  /**
   * PUT request
   * @param {string} url - URL to fetch
   * @param {Object} body - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  put: async (url, body, options = {}) => {
    try {
      logInfo(`PUT request to: ${url}`);
      const response = await axios.put(url, body, options);
      return response;
    } catch (error) {
      logError(`Error in PUT request to ${url}:`, error);
      throw error;
    }
  },

  /**
   * DELETE request
   * @param {string} url - URL to fetch
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Response data
   */
  delete: async (url, options = {}) => {
    try {
      logInfo(`DELETE request to: ${url}`);
      const response = await axios.delete(url, options);
      return response;
    } catch (error) {
      logError(`Error in DELETE request to ${url}:`, error);
      throw error;
    }
  }
};

export default fetchWrapper; 