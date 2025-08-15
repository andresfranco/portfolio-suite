import { api } from './api';
import { logInfo, logError } from '../utils/logger';

/**
 * Permission API methods for the backend API
 */
const permissionApi = {
  /**
   * Get permissions with pagination and filtering
   * @param {Object} params - Query parameters
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.page_size=10] - Items per page
   * @param {string} [params.filters] - JSON string of filter objects. Example: '[{"field":"name", "value":"admin", "operator":"contains"}]'
   * @param {string} [params.sort_field] - Field to sort by (e.g., 'name', 'id', 'roles_count')
   * @param {string} [params.sort_order='asc'] - Sort direction ('asc' or 'desc')
   * @returns {Promise<Object>} API response (PaginatedPermissionResponse)
   */
  getPermissions: (params = {}) => {
    logInfo('Getting permissions with params:', params);
    return api.get('/api/permissions', { params });
  },

  /**
   * Get permissions using a custom URL (for direct filter parameter handling)
   * @param {string} url - Full URL with query parameters
   * @returns {Promise<Object>} - API response with permissions
   */
  getPermissionsCustom: async (url) => {
    logInfo('Getting permissions with custom URL:', url);
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
      
      // Make sure we're returning the correct data structure that PermissionContext expects
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
      throw new Error('Invalid response format from permissions API');
    } catch (error) {
      logError('Error in getPermissionsCustom:', error);
      throw error;
    }
  },

  /**
   * Get a single permission by ID
   * @param {number} id - Permission ID
   * @returns {Promise<Object>} API response (PermissionOut)
   */
  getPermissionById: (id) => {
    logInfo('Getting permission by ID:', id);
    return api.get(`/api/permissions/${id}`);
  },

  /**
   * Create a new permission
   * @param {Object} permissionData - Permission data
   * @param {string} permissionData.name - Permission name
   * @param {string} permissionData.description - Permission description
   * @returns {Promise<Object>} API response (PermissionOut)
   */
  createPermission: (permissionData) => {
    logInfo('Creating permission:', permissionData);
    return api.post('/api/permissions', permissionData);
  },

  /**
   * Update an existing permission
   * @param {number} id - Permission ID
   * @param {Object} permissionData - Updated permission data (can be partial)
   * @param {string} [permissionData.name] - Updated name
   * @param {string} [permissionData.description] - Updated description
   * @returns {Promise<Object>} API response (PermissionOut)
   */
  updatePermission: (id, permissionData) => {
    logInfo('Updating permission:', id, permissionData);
    return api.put(`/api/permissions/${id}`, permissionData);
  },

  /**
   * Delete a permission
   * @param {number} id - Permission ID
   * @returns {Promise<Object>} API response (status 204 on success)
   */
  deletePermission: (id) => {
    logInfo('Deleting permission:', id);
    return api.delete(`/api/permissions/${id}`);
  },

  /**
   * Get all permission names
   * @returns {Promise<string[]>} List of permission names
   */
  getAllPermissionNames: async () => {
    logInfo('Fetching all permission names');
    try {
      // Fetch all permissions with a very large page size to ensure we get everything
      const response = await api.get('/api/permissions/', {
        params: {
          page: 1,
          page_size: 1000, // Increased to ensure we get all permissions
          sort_field: 'name',
          sort_order: 'asc',
          include_count: true
        }
      });
      
      logInfo('Raw permission API response:', response.data);
      
      // Extract permission names from the items array
      if (response.data && response.data.items && Array.isArray(response.data.items)) {
        const permissionNames = response.data.items.map(permission => permission.name);
        logInfo(`Retrieved ${permissionNames.length} permission names:`, permissionNames);
        
        // Specific check for VIEW_USERS
        const hasViewUsers = permissionNames.includes('VIEW_USERS');
        logInfo(`VIEW_USERS permission found: ${hasViewUsers}`);
        
        if (!hasViewUsers) {
          logError('VIEW_USERS permission is missing from the response!');
          logError('Available permissions:', permissionNames.slice(0, 20)); // Log first 20 for debugging
        }
        
        return permissionNames;
      }
      
      logError('Received invalid data format for permissions', response.data);
      return []; // Return empty array on unexpected format
    } catch (error) {
      logError('Error fetching permission names:', error);
      logError('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      // Return empty array instead of throwing to avoid breaking the form
      return [];
    }
  },

  /**
   * Get all permission names with fallback strategies for RoleForm
   * This method tries multiple approaches to ensure we get all permissions
   * @returns {Promise<string[]>} List of permission names
   */
  getAllPermissionNamesForRoleForm: async () => {
    logInfo('Fetching all permission names for RoleForm with fallback strategies');
    
    // Strategy 1: Try the standard API endpoint
    try {
      const response = await api.get('/api/permissions/', {
        params: {
          page: 1,
          page_size: 1000,
          sort_field: 'name',
          sort_order: 'asc'
        }
      });
      
      if (response.data && response.data.items && Array.isArray(response.data.items)) {
        const permissionNames = response.data.items.map(permission => permission.name);
        logInfo(`Strategy 1 successful: Retrieved ${permissionNames.length} permission names`);
        
        // Verify we have essential permissions like VIEW_USERS
        const hasEssentialPermissions = ['VIEW_USERS', 'CREATE_USER', 'EDIT_USER', 'DELETE_USER'].every(
          perm => permissionNames.includes(perm)
        );
        
        if (hasEssentialPermissions) {
          logInfo('All essential permissions found, returning successful result');
          return permissionNames;
        } else {
          logError('Essential permissions missing, will try fallback strategies');
        }
      }
    } catch (error) {
      logError('Strategy 1 failed:', error);
      
      // If it's a 403 Forbidden, the user might not have VIEW_PERMISSIONS
      if (error.response?.status === 403) {
        logError('Access denied to permissions endpoint. User might not have VIEW_PERMISSIONS permission');
      }
    }
    
    // Strategy 2: Try with different parameters
    try {
      logInfo('Trying Strategy 2: Different API parameters');
      const response = await api.get('/api/permissions/', {
        params: {
          page: 1,
          page_size: 500 // Try with smaller page size
        }
      });
      
      if (response.data && response.data.items && Array.isArray(response.data.items)) {
        const permissionNames = response.data.items.map(permission => permission.name);
        logInfo(`Strategy 2 successful: Retrieved ${permissionNames.length} permission names`);
        return permissionNames;
      }
    } catch (error) {
      logError('Strategy 2 failed:', error);
    }
    
    // Strategy 3: Try the new permission names endpoint (no auth required)
    try {
      logInfo('Trying Strategy 3: Permission names endpoint');
      const response = await api.get('/api/permissions/names');
      
      if (response.data && Array.isArray(response.data)) {
        const permissionNames = response.data;
        logInfo(`Strategy 3 successful: Retrieved ${permissionNames.length} permission names`);
        return permissionNames;
      }
    } catch (error) {
      logError('Strategy 3 failed:', error);
    }
    
    // Strategy 4: Return a hardcoded list of essential permissions as last resort
    logError('All API strategies failed, returning hardcoded essential permissions list');
    const essentialPermissions = [
      'SYSTEM_ADMIN', 'VIEW_DASHBOARD',
      'VIEW_USERS', 'CREATE_USER', 'EDIT_USER', 'DELETE_USER', 'ASSIGN_USER_ROLES', 'RESET_USER_PASSWORD', 'ACTIVATE_DEACTIVATE_USER',
      'VIEW_ROLES', 'CREATE_ROLE', 'EDIT_ROLE', 'DELETE_ROLE', 'MANAGE_ROLES', 'ASSIGN_ROLE_PERMISSIONS',
      'VIEW_PERMISSIONS', 'CREATE_PERMISSION', 'EDIT_PERMISSION', 'DELETE_PERMISSION', 'MANAGE_PERMISSIONS',
      'VIEW_CATEGORIES', 'CREATE_CATEGORY', 'EDIT_CATEGORY', 'DELETE_CATEGORY',
      'VIEW_CATEGORY_TYPES', 'CREATE_CATEGORY_TYPE', 'EDIT_CATEGORY_TYPE', 'DELETE_CATEGORY_TYPE',
  'VIEW_PORTFOLIOS', 'CREATE_PORTFOLIO', 'EDIT_PORTFOLIO', 'DELETE_PORTFOLIO', 'PUBLISH_PORTFOLIO',
  'VIEW_PORTFOLIO_IMAGES','UPLOAD_PORTFOLIO_IMAGES','EDIT_PORTFOLIO_IMAGES','DELETE_PORTFOLIO_IMAGES','MANAGE_PORTFOLIO_IMAGES',
  'VIEW_PORTFOLIO_ATTACHMENTS','UPLOAD_PORTFOLIO_ATTACHMENTS','EDIT_PORTFOLIO_ATTACHMENTS','DELETE_PORTFOLIO_ATTACHMENTS','MANAGE_PORTFOLIO_ATTACHMENTS',
      'VIEW_PROJECTS', 'CREATE_PROJECT', 'EDIT_PROJECT', 'DELETE_PROJECT', 'MANAGE_PROJECT_ATTACHMENTS', 'ASSIGN_PROJECT_CATEGORIES',
      'VIEW_EXPERIENCES', 'CREATE_EXPERIENCE', 'EDIT_EXPERIENCE', 'DELETE_EXPERIENCE',
      'VIEW_SKILLS', 'CREATE_SKILL', 'EDIT_SKILL', 'DELETE_SKILL', 'MANAGE_SKILL_CATEGORIES',
      'VIEW_SKILL_TYPES', 'CREATE_SKILL_TYPE', 'EDIT_SKILL_TYPE', 'DELETE_SKILL_TYPE',
      'VIEW_LANGUAGES', 'CREATE_LANGUAGE', 'EDIT_LANGUAGE', 'DELETE_LANGUAGE',
      'VIEW_SECTIONS', 'CREATE_SECTION', 'EDIT_SECTION', 'DELETE_SECTION',
      'VIEW_TRANSLATIONS', 'CREATE_TRANSLATION', 'EDIT_TRANSLATION', 'DELETE_TRANSLATION'
    ];
    
    logInfo(`Returning ${essentialPermissions.length} hardcoded essential permissions as fallback`);
    return essentialPermissions;
  }
};

export default permissionApi;

// For modular imports
export { permissionApi };