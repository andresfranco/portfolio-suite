import { api } from './api';
import { logInfo, logError } from '../utils/logger';

/**
 * Language API methods for the backend API
 */
const languageApi = {
  /**
   * Get languages with pagination and filtering
   * @param {Object} params - Query parameters
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.page_size=10] - Items per page
   * @param {string} [params.filters] - JSON string of filter objects. Example: '[{"field":"name", "value":"English", "operator":"contains"}]'
   * @param {string} [params.sort_field] - Field to sort by (e.g., 'name', 'code', 'is_default')
   * @param {string} [params.sort_order='asc'] - Sort direction ('asc' or 'desc')
   * @returns {Promise<Object>} API response (PaginatedLanguageResponse)
   */
  getLanguages: (params = {}) => {
    logInfo('Getting languages with params:', params);
    return api.get('/api/languages', { params });
  },

  /**
   * Get languages using a custom URL (for direct filter parameter handling)
   * @param {string} url - Full URL with query parameters
   * @returns {Promise<Object>} - API response with languages
   */
  getLanguagesCustom: async (url) => {
    logInfo('Getting languages with custom URL:', url);
    try {
      const response = await api.get(url);
      
      // Debug logging of actual response
      logInfo('Raw API response structure:', Object.keys(response));
      if (response.data) {
        logInfo('Response data structure:', Object.keys(response.data));
        
        if (response.data.items) {
          logInfo(`Response contains ${response.data.items.length} items`);
        }
      }
      
      // Make sure we're returning the correct data structure that LanguageContext expects
      if (response && response.data) {
        // Check for the expected structure according to the API spec
        const items = response.data.items || response.data.results || [];
        const total = response.data.total || 0;
        const page = response.data.page || 1;
        const page_size = response.data.page_size || 10;
        
        logInfo(`Processed response: ${items.length} items out of ${total} total on page ${page}`);
        
        // Return the full response structure with proper fields expected by the context
        return {
          items,
          total,
          page,
          page_size
        };
      }
      
      logError('Invalid response format from API:', response);
      throw new Error('Invalid response format from languages API');
    } catch (error) {
      logError('Error in getLanguagesCustom:', error);
      throw error;
    }
  },

  /**
   * Get a single language by ID
   * @param {number} id - Language ID
   * @returns {Promise<Object>} API response (LanguageOut)
   */
  getLanguageById: (id) => {
    logInfo('Getting language by ID:', id);
    return api.get(`/api/languages/${id}`);
  },

  /**
   * Create a new language
   * @param {Object} formData - FormData object with language data
   * @returns {Promise<Object>} API response (LanguageOut)
   */
  createLanguage: (formData) => {
    logInfo('Creating language with FormData');
    // Interceptor will handle Content-Type for FormData automatically
    return api.post('/api/languages', formData);
  },

  /**
   * Update an existing language
   * @param {number} id - Language ID
   * @param {Object} formData - FormData object with updated language data
   * @returns {Promise<Object>} API response (LanguageOut)
   */
  updateLanguage: (id, formData) => {
    logInfo('Updating language:', id);
    // Interceptor will handle Content-Type for FormData automatically
    return api.put(`/api/languages/${id}`, formData);
  },

  /**
   * Delete a language
   * @param {number} id - Language ID
   * @returns {Promise<Object>} API response
   */
  deleteLanguage: (id) => {
    logInfo('Deleting language:', id);
    return api.delete(`/api/languages/${id}`);
  },

  /**
   * Get all language codes
   * @returns {Promise<string[]>} List of language codes
   */
  getAllLanguageCodes: async () => {
    logInfo('Fetching all language codes');
    try {
      const response = await api.get('/api/languages/codes');
      if (Array.isArray(response.data)) {
        logInfo(`Retrieved ${response.data.length} language codes`);
        return response.data;
      }
      logError('Received invalid data format for language codes', response.data);
      return [];
    } catch (error) {
      logError('Error fetching language codes:', error);
      return [];
    }
  }
};

export default languageApi;

// For modular imports
export { languageApi }; 