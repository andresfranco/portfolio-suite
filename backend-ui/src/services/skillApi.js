import { API_CONFIG } from '../config/apiConfig';
import { logInfo, logError } from '../utils/logger';
import { api } from './api';

// Use the standard API endpoint pattern
const skillApi = {
  // Fetch paginated skills with optional filters and sorting
  fetchSkills: async (params = {}) => {
    logInfo('skillApi', 'fetchSkills called with params:', params);
    
    try {
      // Extract filters from params if they exist
      const { filters, ...restParams } = params;
      
      // Prepare query parameters object
      const queryParams = { ...restParams };
      
      // Handle filters if provided
      if (filters && Array.isArray(filters) && filters.length > 0) {
        // Convert filters array to JSON string for the API
        queryParams.filters = JSON.stringify(filters);
      }
      
      // Make the request using the configured api instance with auth
      const response = await api.get('/api/skills/', { params: queryParams });
      
      logInfo('skillApi', 'fetchSkills response:', {
        status: response.status,
        dataStructure: {
          hasItems: 'items' in response.data,
          hasTotal: 'total' in response.data,
          itemsLength: response.data.items?.length,
          total: response.data.total
        }
      });
      
      return response.data;
    } catch (error) {
      logError('skillApi', 'Error in fetchSkills:', error);
      throw error;
    }
  },

  // Fetch a single skill by ID
  fetchSkillById: async (id) => {
    logInfo('skillApi', 'fetchSkillById called with ID:', id);
    
    try {
      const response = await api.get(`/api/skills/${id}`);
      logInfo('skillApi', 'fetchSkillById response:', { status: response.status });
      return response.data;
    } catch (error) {
      logError('skillApi', 'Error in fetchSkillById:', { id, error });
      throw error;
    }
  },

  // Create a new skill
  createSkill: async (skillData) => {
    logInfo('skillApi', 'createSkill called with data:', skillData);
    
    try {
      const response = await api.post('/api/skills/', skillData);
      logInfo('skillApi', 'createSkill response:', { 
        status: response.status, 
        id: response.data?.id 
      });
      return response.data;
    } catch (error) {
      logError('skillApi', 'Error in createSkill:', error);
      throw error;
    }
  },

  // Update an existing skill
  updateSkill: async (id, skillData) => {
    logInfo('skillApi', 'updateSkill called with ID and data:', { id, skillData });
    
    try {
      const response = await api.put(`/api/skills/${id}`, skillData);
      logInfo('skillApi', 'updateSkill response:', { 
        status: response.status, 
        id: response.data?.id 
      });
      return response.data;
    } catch (error) {
      logError('skillApi', 'Error in updateSkill:', { id, error });
      throw error;
    }
  },

  // Delete a skill
  deleteSkill: async (id) => {
    logInfo('skillApi', 'deleteSkill called with ID:', id);
    
    try {
      const response = await api.delete(`/api/skills/${id}`);
      logInfo('skillApi', 'deleteSkill response:', { status: response.status });
      return response.data;
    } catch (error) {
      logError('skillApi', 'Error in deleteSkill:', { id, error });
      throw error;
    }
  },

  // Check if a skill name exists for a specific language
  checkSkillNameExists: async (name, languageId, excludeId = null) => {
    logInfo('skillApi', 'checkSkillNameExists called with:', { name, languageId, excludeId });
    
    try {
      const params = {
        name: name,
        language_id: languageId
      };
      
      if (excludeId) {
        params.exclude_id = excludeId;
      }
      
      const response = await api.get('/api/skills/check-unique', { params });
      logInfo('skillApi', 'checkSkillNameExists response:', { 
        status: response.status, 
        exists: response.data?.exists 
      });
      return response.data;
    } catch (error) {
      logError('skillApi', 'Error in checkSkillNameExists:', { name, languageId, excludeId, error });
      throw error;
    }
  },

  // Get all skills without pagination (for dropdowns, etc.)
  getAllSkills: async () => {
    logInfo('skillApi', 'getAllSkills called');
    
    try {
      const response = await api.get('/api/skills/all');
      logInfo('skillApi', 'getAllSkills response:', { 
        status: response.status,
        count: response.data?.length 
      });
      return response.data;
    } catch (error) {
      logError('skillApi', 'Error in getAllSkills:', error);
      throw error;
    }
  },

  // Bulk operations
  bulkDeleteSkills: async (skillIds) => {
    logInfo('skillApi', 'bulkDeleteSkills called with IDs:', skillIds);
    
    try {
      const response = await api.post('/api/skills/bulk-delete', { ids: skillIds });
      logInfo('skillApi', 'bulkDeleteSkills response:', { 
        status: response.status,
        deletedCount: response.data?.deleted_count 
      });
      return response.data;
    } catch (error) {
      logError('skillApi', 'Error in bulkDeleteSkills:', { skillIds, error });
      throw error;
    }
  },

  // Export skills data
  exportSkills: async (format = 'json', filters = {}) => {
    logInfo('skillApi', 'exportSkills called with:', { format, filters });
    
    try {
      const params = { format, ...filters };
      const response = await api.get('/api/skills/export', { 
        params,
        responseType: 'blob' // Important for file downloads
      });
      
      logInfo('skillApi', 'exportSkills response:', { 
        status: response.status,
        contentType: response.headers['content-type']
      });
      return response.data;
    } catch (error) {
      logError('skillApi', 'Error in exportSkills:', { format, filters, error });
      throw error;
    }
  },

  // Import skills data
  importSkills: async (fileData, options = {}) => {
    logInfo('skillApi', 'importSkills called with options:', options);
    
    try {
      const formData = new FormData();
      formData.append('file', fileData);
      
      // Add any additional options
      Object.keys(options).forEach(key => {
        formData.append(key, options[key]);
      });
      
      const response = await api.post('/api/skills/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      logInfo('skillApi', 'importSkills response:', { 
        status: response.status,
        importedCount: response.data?.imported_count 
      });
      return response.data;
    } catch (error) {
      logError('skillApi', 'Error in importSkills:', { options, error });
      throw error;
    }
  }
};

export default skillApi; 