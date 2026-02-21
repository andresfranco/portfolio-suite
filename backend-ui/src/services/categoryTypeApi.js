import { logInfo, logError } from '../utils/logger';
import { api } from './api';


/**
 * CategoryType API methods for the backend API
 */
const categoryTypeApi = {
  /**
   * Get paginated list of category types with filtering and sorting
   * 
   * @param {Object} options - Request options
   * @param {number} options.page - Page number (1-indexed)
   * @param {number} options.page_size - Number of items per page
   * @param {Object} options.filters - Filter parameters (optional)
   * @param {string} options.sort_field - Field to sort by (optional)
   * @param {string} options.sort_order - Sort direction ('asc' or 'desc', optional)
   * @returns {Promise<Object>} - Response with paginated data
   */
  getCategoryTypes: async (options = {
    page: 1,
    page_size: 10,
    filters: null,
    sort_field: null,
    sort_order: 'asc'
  }) => {
    try {
      const { page, page_size, filters, sort_field, sort_order } = options;
      
      // Build the query parameters
      const params = new URLSearchParams({
        page,
        page_size,
      });
      
      // Add sort parameters if provided
      if (sort_field) {
        params.append("sort_field", sort_field);
        params.append("sort_order", sort_order);
      }
      
      // Handle filters - FIXED approach for legacy parameters
      if (filters && Object.keys(filters).length > 0) {
        // Check for legacy filter parameters (code, name)
        if (filters.code) {
          params.append("code", filters.code);
        }
        
        if (filters.name) {
          params.append("name", filters.name);
        }
        
        // Log what we're doing
        logInfo("Using direct query parameters for filtering:", { code: filters.code, name: filters.name });
      }

      // Make the request
      const requestUrl = `/api/category-types/?${params.toString()}`;
      logInfo(`Fetching category types: ${requestUrl}`);
      
      const response = await api.get(requestUrl);
      logInfo(`Fetched ${response.data.items?.length || 0} category types`);
      
      return response;
    } catch (error) {
      logError('Error fetching category types:', error);
      throw error;
    }
  },

  /**
   * Get a category type by ID
   * 
   * @param {string} id - Category type ID
   * @returns {Promise<Object>} - Response with category type data
   */
  getCategoryTypeById: async (id) => {
    try {
      if (!id) {
        throw new Error('Category type ID is required');
      }
      
      logInfo(`Fetching category type with ID: ${id}`);
      const response = await api.get(`/api/category-types/${id}`);
      
      logInfo(`Fetched category type: ${response.data.code}`);
      return response;
    } catch (error) {
      logError(`Error fetching category type with id ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a new category type
   * 
   * @param {Object} categoryTypeData - Category type data
   * @returns {Promise<Object>} - Response with created category type
   */
  createCategoryType: async (categoryTypeData) => {
    try {
      logInfo('Creating category type:', categoryTypeData);
      const response = await api.post('/api/category-types', categoryTypeData);
      
      logInfo(`Created category type: ${response.data.code}`);
      return response;
    } catch (error) {
      logError('Error creating category type:', error);
      throw error;
    }
  },

  /**
   * Update an existing category type
   * 
   * @param {string} id - Category type ID
   * @param {Object} categoryTypeData - Updated category type data
   * @returns {Promise<Object>} - Response with updated category type
   */
  updateCategoryType: async (id, categoryTypeData) => {
    try {
      if (!id) {
        throw new Error('Category type ID is required');
      }
      
      logInfo(`Updating category type ${id}:`, categoryTypeData);
      const response = await api.put(`/api/category-types/${id}`, categoryTypeData);
      
      logInfo(`Updated category type: ${response.data.code}`);
      return response;
    } catch (error) {
      logError(`Error updating category type with id ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a category type
   * 
   * @param {string} id - Category type ID
   * @returns {Promise<Object>} - Response status
   */
  deleteCategoryType: async (id) => {
    try {
      if (!id) {
        throw new Error('Category type ID is required');
      }
      
      logInfo(`Deleting category type: ${id}`);
      const response = await api.delete(`/api/category-types/${id}`);
      
      logInfo(`Deleted category type: ${id}`);
      return response;
    } catch (error) {
      logError(`Error deleting category type with id ${id}:`, error);
      throw error;
    }
  },

  /**
   * Check if a category type code already exists
   * 
   * @param {string} code - Category type code to check
   * @returns {Promise<Object>} - Response with exists property
   */
  checkCodeExists: async (code) => {
    try {
      if (!code) {
        throw new Error('Category type code is required');
      }
      
      logInfo(`Checking if category type code exists: ${code}`);
      const response = await api.get(`/api/category-types/check-code/${code}`);
      
      logInfo(`Category type code ${code} exists: ${response.data?.exists}`);
      return response.data;
    } catch (error) {
      logError(`Error checking if category type code exists (${code}):`, error);
      throw error;
    }
  },

  /**
   * Get all category type codes
   * 
   * @returns {Promise<Array<string>>} - Array of category type codes
   */
  getAllCategoryTypeCodes: async () => {
    try {
      logInfo('Fetching all category type codes');
      const response = await api.get('/api/category-types/codes');
      
      if (response.data && Array.isArray(response.data)) {
        logInfo(`Retrieved ${response.data.length} category type codes`);
        return response.data;
      }
      
      logError('Received invalid data format for category type codes', response.data);
      return []; // Return empty array on unexpected format
    } catch (error) {
      logError('Error fetching category type codes:', error);
      // Return empty array instead of throwing to avoid breaking the form
      return [];
    }
  }
};

export default categoryTypeApi;

// For modular imports
export { categoryTypeApi }; 