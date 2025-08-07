import axios from 'axios';
import { API_CONFIG } from '../config/apiConfig';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';
import { mockRoles } from '../utils/mockData';

// Flag to enable mock data fallback
const USE_MOCK_FALLBACK = process.env.NODE_ENV === 'development';

/**
 * Role API service
 * Contains methods for all role-related API operations
 */
class RoleApiService {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.endpoints = API_CONFIG.ENDPOINTS.roles;
    this.defaultParams = {};
    
    // Create an axios instance for this service
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: API_CONFIG.TIMEOUT,
      headers: API_CONFIG.HEADERS
    });
    
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        logError('Request error in roleApi:', error);
        return Promise.reject(error);
      }
    );
    
    // Response interceptor to handle common errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // Unauthorized access
          if (error.response.status === 401) {
            localStorage.removeItem('accessToken');
            // Redirect to login page if not already there
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }
          
          // Log detailed error information
          logError(`API Error (${error.response.status}):`, {
            url: error.config?.url,
            method: error.config?.method?.toUpperCase(),
            status: error.response.status,
            data: error.response.data
          });
        } else if (error.request) {
          // The request was made but no response was received
          logError('Network Error - No response from API:', {
            url: error.config?.url,
            method: error.config?.method?.toUpperCase()
          });
        } else {
          // Something happened in setting up the request
          logError('Request Setup Error:', error.message);
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Fetch roles with pagination and filtering
   * @param {Object} params - Query parameters for the API request
   * @returns {Promise} - API response with roles data
   */
  async getRoles(params = {}) {
    logDebug('Getting roles with params:', params);
    
    try {
      // Create a new params object to avoid modifying the original
      const processedParams = { ...params };
      
      // Process filters if provided
      if (params.filters) {
        logInfo('Processing filters - Raw input:', typeof params.filters, params.filters);
        
        // If filters is already a string, assume it's been properly formatted
        if (typeof params.filters === 'string') {
          processedParams.filters = params.filters;
          logInfo('Using existing filters string:', processedParams.filters);
        }
        // If filters is an array, convert it to a JSON string for the API
        else if (Array.isArray(params.filters) && params.filters.length > 0) {
          // Create deep copy to avoid modifying original
          const processedFilters = JSON.parse(JSON.stringify(params.filters));
          
          // Handle special case for permissions filter
          processedFilters.forEach(filter => {
            if (filter.field === 'permissions' && Array.isArray(filter.value)) {
              // Ensure permissions are string values
              filter.value = filter.value.map(perm => {
                if (typeof perm === 'object' && perm.name) {
                  return perm.name;
                }
                return String(perm);
              });
              logInfo(`Processed permissions filter value:`, filter.value);
            }
          });
          
          // For API compatibility, convert filters array to JSON string
          logInfo('Converting filters array to JSON string:', processedFilters);
          processedParams.filters = JSON.stringify(processedFilters);
        }
      }
      
      // Handle sorting - Backend expects sort_field and sort_dir parameters
      if (params.sort_field) {
        // Map field names to match backend expectations if needed
        const fieldMap = {
          name: 'name',
          description: 'description',
          // Add other field mappings as needed
        };
        
        // Use the mapped field name or the original
        processedParams.sort_field = fieldMap[params.sort_field] || params.sort_field;
        
        // Ensure sort_dir has a value (default to 'asc')
        processedParams.sort_dir = params.sort_dir || 'asc';
        
        // Convert to sort_by and sort_order which might be what the backend expects
        processedParams.sort_by = processedParams.sort_field;
        processedParams.sort_order = processedParams.sort_dir;
        
        logInfo(`Using sort parameters: field=${processedParams.sort_field}, dir=${processedParams.sort_dir}`);
        logInfo(`Also sending as: sort_by=${processedParams.sort_by}, sort_order=${processedParams.sort_order}`);
      }
      
      // Handle permission names as a separate parameter if provided
      if (params.permission_names) {
        // Make sure permission_names is always a string (comma-separated list)
        if (Array.isArray(params.permission_names)) {
          processedParams.permission_names = params.permission_names.join(',');
        } else if (typeof params.permission_names === 'string') {
          processedParams.permission_names = params.permission_names;
        }
        
        logInfo('Using permission_names filter:', processedParams.permission_names);
      }
      
      logInfo('Making API request to get roles with processed params:', processedParams);
      
      const response = await this.api.get(this.endpoints.list, { params: processedParams });
      
      // Check if we have results or items in the response data
      // Some APIs return data.results, others return data.items
      const responseData = response.data;
      const items = responseData.results || responseData.items || [];
      
      // Create a standardized response format
      const standardizedResponse = {
        ...response,
        data: {
          results: items,
          total: responseData.total || items.length,
          page: responseData.page || params.page || 1,
          page_size: responseData.page_size || params.page_size || 10
        }
      };
      
      logDebug('Standardized roles response:', {
        status: response.status,
        count: standardizedResponse.data.results.length,
        total: standardizedResponse.data.total
      });
      
      return standardizedResponse;
    } catch (error) {
      logError('Error in getRoles method:', error);
      
      // Use mock data as fallback in development mode
      if (USE_MOCK_FALLBACK) {
        logWarn('Using mock data as fallback for getRoles');
        
        // Apply pagination to mock data
        const page = parseInt(params.page) || 1;
        const pageSize = parseInt(params.page_size) || 10;
        const mockItems = [...mockRoles.results]; // Clone to avoid mutating the original
        
        // If there's sorting, apply it
        if (params.sort_field) {
          const sortField = params.sort_field;
          const sortDirection = params.sort_dir || 'asc';
          
          mockItems.sort((a, b) => {
            const aValue = a[sortField] || '';
            const bValue = b[sortField] || '';
            
            if (typeof aValue === 'string' && typeof bValue === 'string') {
              return sortDirection === 'asc' 
                ? aValue.localeCompare(bValue) 
                : bValue.localeCompare(aValue);
            }
            
            return sortDirection === 'asc' 
              ? (aValue - bValue) 
              : (bValue - aValue);
          });
        }
        
        // Apply mock pagination
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedItems = mockItems.slice(startIndex, endIndex);
        
        return {
          data: {
            results: paginatedItems,
            total: mockItems.length,
            page: page,
            page_size: pageSize
          },
          status: 200
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Get a single role by ID
   * @param {string|number} id - Role ID
   * @returns {Promise} - API response with role data
   */
  async getRoleById(id) {
    logDebug('Getting role by ID:', id);
    
    try {
      const url = `${this.endpoints.detail.replace(':id', id)}`;
      const response = await this.api.get(url);
      
      logDebug('Received role detail response:', {
        status: response.status,
        id: response.data.id
      });
      
      return response;
    } catch (error) {
      logError(`Error getting role with ID ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a new role
   * @param {Object} roleData - Role data
   * @returns {Promise} - API response with created role data
   */
  async createRole(roleData) {
    logDebug('Creating role with data:', roleData);
    
    try {
      // Ensure permissions are correctly formatted
      const formattedData = { ...roleData };
      
      if (Array.isArray(formattedData.permissions)) {
        formattedData.permissions = formattedData.permissions.map(perm => {
          return typeof perm === 'object' && perm.id ? perm.id : perm;
        });
      }
      
      const response = await this.api.post(this.endpoints.list, formattedData);
      
      logInfo('Role created successfully:', {
        status: response.status,
        id: response.data.id,
        name: response.data.name
      });
      
      return response;
    } catch (error) {
      logError('Error creating role:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing role
   * @param {string|number} id - Role ID
   * @param {Object} roleData - Updated role data
   * @returns {Promise} - API response with updated role data
   */
  async updateRole(id, roleData) {
    logDebug(`Updating role ${id} with data:`, roleData);
    
    try {
      // Ensure permissions are correctly formatted
      const formattedData = { ...roleData };
      
      if (Array.isArray(formattedData.permissions)) {
        formattedData.permissions = formattedData.permissions.map(perm => {
          return typeof perm === 'object' && perm.id ? perm.id : perm;
        });
      }
      
      const url = `${this.endpoints.detail.replace(':id', id)}`;
      const response = await this.api.put(url, formattedData);
      
      logInfo(`Role ${id} updated successfully:`, {
        status: response.status,
        name: response.data.name
      });
      
      return response;
    } catch (error) {
      logError(`Error updating role ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a role
   * @param {string|number} id - Role ID
   * @returns {Promise} - API response
   */
  async deleteRole(id) {
    logDebug('Deleting role with ID:', id);
    
    try {
      const url = `${this.endpoints.detail.replace(':id', id)}`;
      const response = await this.api.delete(url);
      
      logInfo(`Role ${id} deleted successfully:`, {
        status: response.status
      });
      
      return response;
    } catch (error) {
      logError(`Error deleting role ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all role names (for dropdowns and filters)
   * @returns {Promise} - API response with role names
   */
  async getAllRoleNames() {
    logDebug('Getting all role names');
    
    try {
      // Skip the names endpoint that's causing 422 errors and use the list endpoint directly
      logInfo('Fetching role names from list endpoint');
      const listResponse = await this.api.get(this.endpoints.list, {
        params: { 
          page: 1, 
          page_size: 100,
          sort_field: 'name',
          sort_order: 'asc'
        }
      });
      
      // Process the response data
      if (listResponse && listResponse.data) {
        let roles = [];
        
        // Extract from nested structure if needed
        if (listResponse.data.items && Array.isArray(listResponse.data.items)) {
          roles = listResponse.data.items;
          logInfo(`Retrieved ${roles.length} roles from list endpoint (items format)`);
        } else if (listResponse.data.results && Array.isArray(listResponse.data.results)) {
          roles = listResponse.data.results;
          logInfo(`Retrieved ${roles.length} roles from list endpoint (results format)`);
        } else if (Array.isArray(listResponse.data)) {
          roles = listResponse.data;
          logInfo(`Retrieved ${roles.length} roles from list endpoint (array format)`);
        } else {
          logWarn('List endpoint response has unexpected format', listResponse.data);
          throw new Error('List endpoint response has unexpected format');
        }
        
        return {
          ...listResponse,
          data: roles
        };
      }
      
      // If we reach here without returning, the API calls failed
      logError('API calls did not return valid role data');
      throw new Error('Could not retrieve role data from API');
      
    } catch (error) {
      logError('Error getting role names:', error);
      
      // Return error information for proper handling in the UI
      return { 
        data: [],
        error: error.message || 'Failed to load roles from the server',
        status: error.response?.status || 500
      };
    }
  }
}

// Export a singleton instance
const roleApi = new RoleApiService();
export default roleApi;