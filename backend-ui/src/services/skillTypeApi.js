import { API_CONFIG } from '../config/apiConfig';
import { logInfo, logError } from '../utils/logger';
import { api } from './api';

const BASE_URL = `${API_CONFIG.BASE_URL}/api/skill-types`;

// Helper function to build the URL with query parameters
const buildUrl = (endpoint, params = {}) => {
  const url = new URL(endpoint);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      // Special handling for filters object - we don't include it as query params
      // and handle it separately unless it's the legacy filters 'code' or 'name'
      if (key === 'filters' && typeof value === 'object') {
        // Skip adding filters to URL params - we'll handle these in the request below
      } else {
        url.searchParams.append(key, value);
      }
    }
  });
  
  return url.toString();
};

/**
 * SkillType API methods for the backend API
 */
const skillTypeApi = {
  /**
   * Get paginated list of skill types with filtering and sorting
   * 
   * @param {Object} options - Request options
   * @param {number} options.page - Page number (1-indexed)
   * @param {number} options.page_size - Number of items per page
   * @param {Object} options.filters - Filter parameters (optional)
   * @param {string} options.sort_field - Field to sort by (optional)
   * @param {string} options.sort_order - Sort direction ('asc' or 'desc', optional)
   * @returns {Promise<Object>} - Response with paginated data
   */
  getSkillTypes: async (options = {
    page: 1,
    page_size: 10,
    filters: null,
    sort_field: null,
    sort_order: 'asc'
  }) => {
    try {
      const { page, page_size, filters, sort_field, sort_order } = options;
      
      // Build the query parameters
      const params = {
        page,
        page_size,
      };
      
      // Add sort parameters if provided
      if (sort_field) {
        params.sort_field = sort_field;
        params.sort_order = sort_order;
      }
      
      // Handle filters - FIXED approach for legacy parameters
      if (filters && Object.keys(filters).length > 0) {
        // Check for legacy filter parameters (code, name)
        if (filters.code) {
          params.code = filters.code;
        }
        
        if (filters.name) {
          params.name = filters.name;
        }
        
        // Log what we're doing
        logInfo("Using direct query parameters for filtering:", { code: filters.code, name: filters.name });
      }

      // Make the request using the configured api instance with auth
      logInfo(`Fetching skill types with params:`, params);
      
      const response = await api.get('/api/skill-types/', { params });
      logInfo(`Fetched ${response.data.items?.length || 0} skill types`);
      
      return response;
    } catch (error) {
      logError('Error fetching skill types:', error);
      throw error;
    }
  },

  /**
   * Get a skill type by ID
   * 
   * @param {string} id - Skill type ID
   * @returns {Promise<Object>} - Response with skill type data
   */
  getSkillTypeById: async (id) => {
    try {
      if (!id) {
        throw new Error('Skill type ID is required');
      }
      
      logInfo(`Fetching skill type with ID: ${id}`);
      const response = await api.get(`/api/skill-types/${id}`);
      
      logInfo(`Fetched skill type: ${response.data.code}`);
      return response;
    } catch (error) {
      logError(`Error fetching skill type with id ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a new skill type
   * 
   * @param {Object} skillTypeData - Skill type data
   * @returns {Promise<Object>} - Response with created skill type
   */
  createSkillType: async (skillTypeData) => {
    try {
      logInfo('Creating skill type:', skillTypeData);
      const response = await api.post('/api/skill-types/', skillTypeData);
      
      logInfo(`Created skill type: ${response.data.code}`);
      return response;
    } catch (error) {
      logError('Error creating skill type:', error);
      throw error;
    }
  },

  /**
   * Update an existing skill type
   * 
   * @param {string} id - Skill type ID
   * @param {Object} skillTypeData - Updated skill type data
   * @returns {Promise<Object>} - Response with updated skill type
   */
  updateSkillType: async (id, skillTypeData) => {
    try {
      if (!id) {
        throw new Error('Skill type ID is required');
      }
      
      logInfo(`Updating skill type ${id}:`, skillTypeData);
      const response = await api.put(`/api/skill-types/${id}`, skillTypeData);
      
      logInfo(`Updated skill type: ${response.data.code}`);
      return response;
    } catch (error) {
      logError(`Error updating skill type with id ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a skill type
   * 
   * @param {string} id - Skill type ID
   * @returns {Promise<Object>} - Response status
   */
  deleteSkillType: async (id) => {
    try {
      if (!id) {
        throw new Error('Skill type ID is required');
      }
      
      logInfo(`Deleting skill type: ${id}`);
      const response = await api.delete(`/api/skill-types/${id}`);
      
      logInfo(`Deleted skill type: ${id}`);
      return response;
    } catch (error) {
      logError(`Error deleting skill type with id ${id}:`, error);
      throw error;
    }
  },

  /**
   * Check if a skill type code already exists
   * 
   * @param {string} code - Skill type code to check
   * @returns {Promise<Object>} - Response with exists property
   */
  checkCodeExists: async (code) => {
    try {
      if (!code) {
        throw new Error('Skill type code is required');
      }
      
      logInfo(`Checking if skill type code exists: ${code}`);
      const response = await api.get(`/api/skill-types/check-code/${code}`);
      
      logInfo(`Skill type code ${code} exists: ${response.data?.exists}`);
      return response.data;
    } catch (error) {
      logError(`Error checking if skill type code exists (${code}):`, error);
      throw error;
    }
  },

  /**
   * Get all skill type codes
   * 
   * @returns {Promise<Array<string>>} - Array of skill type codes
   */
  getAllSkillTypeCodes: async () => {
    try {
      logInfo('Fetching all skill type codes');
      const response = await api.get('/api/skill-types/codes');
      
      if (response.data && Array.isArray(response.data)) {
        logInfo(`Retrieved ${response.data.length} skill type codes`);
        return response.data;
      }
      
      logError('Received invalid data format for skill type codes', response.data);
      return []; // Return empty array on unexpected format
    } catch (error) {
      logError('Error fetching skill type codes:', error);
      // Return empty array instead of throwing to avoid breaking the form
      return [];
    }
  }
};

export default skillTypeApi;

// For modular imports
export { skillTypeApi }; 