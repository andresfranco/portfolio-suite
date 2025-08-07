import { API_CONFIG } from '../config/apiConfig';
import { logInfo, logError } from '../utils/logger';
import { api } from './api';

// Use the standard API endpoint pattern
const experienceApi = {
  // Fetch paginated experiences with optional filters and sorting
  fetchExperiences: async (params = {}) => {
    logInfo('experienceApi', 'fetchExperiences called with params:', params);
    
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
      const response = await api.get('/api/experiences/', { params: queryParams });
      
      logInfo('experienceApi', 'fetchExperiences response:', {
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
      logError('experienceApi', 'Error in fetchExperiences:', error);
      throw error;
    }
  },

  // Fetch a single experience by ID
  fetchExperienceById: async (id) => {
    logInfo('experienceApi', 'fetchExperienceById called with ID:', id);
    
    try {
      const response = await api.get(`/api/experiences/${id}`);
      logInfo('experienceApi', 'fetchExperienceById response:', { status: response.status });
      return response.data;
    } catch (error) {
      logError('experienceApi', 'Error in fetchExperienceById:', { id, error });
      throw error;
    }
  },

  // Create a new experience
  createExperience: async (experienceData) => {
    logInfo('experienceApi', 'createExperience called with data:', experienceData);
    
    try {
      const response = await api.post('/api/experiences/', experienceData);
      logInfo('experienceApi', 'createExperience response:', { 
        status: response.status, 
        id: response.data?.id 
      });
      return response.data;
    } catch (error) {
      logError('experienceApi', 'Error in createExperience:', error);
      throw error;
    }
  },

  // Update an existing experience
  updateExperience: async (id, experienceData) => {
    logInfo('experienceApi', 'updateExperience called with ID and data:', { id, experienceData });
    
    try {
      const response = await api.put(`/api/experiences/${id}`, experienceData);
      logInfo('experienceApi', 'updateExperience response:', { 
        status: response.status, 
        id: response.data?.id 
      });
      return response.data;
    } catch (error) {
      logError('experienceApi', 'Error in updateExperience:', { id, error });
      throw error;
    }
  },

  // Delete an experience
  deleteExperience: async (id) => {
    logInfo('experienceApi', 'deleteExperience called with ID:', id);
    
    try {
      const response = await api.delete(`/api/experiences/${id}`);
      logInfo('experienceApi', 'deleteExperience response:', { status: response.status });
      return response.data;
    } catch (error) {
      logError('experienceApi', 'Error in deleteExperience:', { id, error });
      throw error;
    }
  },

  // Check if a code already exists
  checkCodeExists: async (code, excludeId = null) => {
    logInfo('experienceApi', 'checkCodeExists called with:', { code, excludeId });
    
    try {
      const params = {};
      
      if (excludeId) {
        params.experience_id = excludeId;
      }
      
      const response = await api.get(`/api/experiences/check-code/${code}`, { params });
      logInfo('experienceApi', 'checkCodeExists response:', { 
        status: response.status, 
        exists: response.data?.exists 
      });
      return response.data;
    } catch (error) {
      logError('experienceApi', 'Error in checkCodeExists:', { code, excludeId, error });
      throw error;
    }
  },

  // Get all experiences without pagination (for dropdowns, etc.)
  getAllExperiences: async () => {
    logInfo('experienceApi', 'getAllExperiences called');
    
    try {
      // Use a large page size to get all experiences
      const response = await api.get('/api/experiences/', { params: { page: 1, page_size: 1000 } });
      logInfo('experienceApi', 'getAllExperiences response:', { 
        status: response.status,
        count: response.data?.items?.length 
      });
      return response.data?.items || [];
    } catch (error) {
      logError('experienceApi', 'Error in getAllExperiences:', error);
      throw error;
    }
  },

  // Bulk operations
  bulkDeleteExperiences: async (experienceIds) => {
    logInfo('experienceApi', 'bulkDeleteExperiences called with IDs:', experienceIds);
    
    try {
      // Since no bulk endpoint exists, delete one by one
      const deletePromises = experienceIds.map(id => api.delete(`/api/experiences/${id}`));
      const responses = await Promise.all(deletePromises);
      logInfo('experienceApi', 'bulkDeleteExperiences response:', { 
        deletedCount: responses.length 
      });
      return { deleted_count: responses.length };
    } catch (error) {
      logError('experienceApi', 'Error in bulkDeleteExperiences:', { experienceIds, error });
      throw error;
    }
  },

  // Export experiences data
  exportExperiences: async (format = 'json', filters = {}) => {
    logInfo('experienceApi', 'exportExperiences called with:', { format, filters });
    
    try {
      // Since no export endpoint exists, return the data for client-side export
      const response = await api.get('/api/experiences/', { params: { page: 1, page_size: 1000, ...filters } });
      logInfo('experienceApi', 'exportExperiences response:', { 
        status: response.status,
        count: response.data?.items?.length
      });
      return response.data?.items || [];
    } catch (error) {
      logError('experienceApi', 'Error in exportExperiences:', { format, filters, error });
      throw error;
    }
  },

  // Import experiences data
  importExperiences: async (fileData, options = {}) => {
    logInfo('experienceApi', 'importExperiences called with options:', options);
    
    try {
      const formData = new FormData();
      formData.append('file', fileData);
      
      // Add any additional options
      Object.keys(options).forEach(key => {
        formData.append(key, options[key]);
      });
      
      // Since no import endpoint exists, throw an error for now
      throw new Error('Import functionality not implemented on backend');
      
      // const response = await api.post('/api/experiences/import', formData, {
      //   headers: {
      //     'Content-Type': 'multipart/form-data'
      //   }
      // });
      // 
      // logInfo('experienceApi', 'importExperiences response:', { 
      //   status: response.status,
      //   importedCount: response.data?.imported_count 
      // });
      // return response.data;
    } catch (error) {
      logError('experienceApi', 'Error in importExperiences:', { options, error });
      throw error;
    }
  }
};

export default experienceApi; 