import axios from 'axios';
import { API_CONFIG } from '../config/apiConfig';
import { logInfo, logError } from '../utils/logger';
import axiosInstance from './axiosConfig';

// Add a function to get the roles URL for debugging
export const getRolesUrl = () => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.roles.list}`;
};

// Get roles with pagination and filtering
export const getRoles = (params = {}) => {
  return fetchRoles(params);
};

// Get a role by ID
export const getRoleById = (id) => {
  const url = API_CONFIG.ENDPOINTS.roles.detail.replace(':id', id);
  return axiosInstance.get(url);
};

// Create a new role
export const createRole = (roleData) => {
  return axiosInstance.post(API_CONFIG.ENDPOINTS.roles.list, roleData);
};

// Update a role
export const updateRole = (id, roleData) => {
  const url = API_CONFIG.ENDPOINTS.roles.detail.replace(':id', id);
  return axiosInstance.put(url, roleData);
};

// Delete a role
export const deleteRole = (id) => {
  const url = API_CONFIG.ENDPOINTS.roles.detail.replace(':id', id);
  return axiosInstance.delete(url);
};

// Get all role names
export const getAllRoleNames = async () => {
  try {
    const response = await axiosInstance.get(API_CONFIG.ENDPOINTS.roles.names);
    
    // Extract role names from the response
    if (response && response.data) {
      // Check if we have an items array (paginated response)
      if (response.data.items && Array.isArray(response.data.items)) {
        return response.data.items.map(item => item.name || '');
      }
      
      // Handle direct array response
      if (Array.isArray(response.data)) {
        return response.data.map(item => 
          typeof item === 'string' ? item : (item.name || '')
        );
      }
    }
    
    // Return empty array if we couldn't extract role names
    return [];
  } catch (error) {
    logError('Error fetching role names:', error);
    return [];
  }
};

// Get all permission names
export const getAllPermissionNames = async () => {
  try {
    const response = await axiosInstance.get(API_CONFIG.ENDPOINTS.permissions.list);
    
    // Extract permission names from the response
    if (response && response.data) {
      // Check if we have an items array (paginated response)
      if (response.data.items && Array.isArray(response.data.items)) {
        return response.data.items.map(item => item.name || '');
      }
      
      // Handle direct array response
      if (Array.isArray(response.data)) {
        return response.data.map(item => 
          typeof item === 'string' ? item : (item.name || '')
        );
      }
    }
    
    // Return empty array if we couldn't extract permissions
    return [];
  } catch (error) {
    logError('Error fetching permission names:', error);
    return [];
  }
};

export const fetchRoles = (params = {}) => {
  // Make a copy of the params to avoid modifying the original
  const queryParams = { ...params };
  
  // Define response processing function at the beginning to avoid reference errors
  const processResponse = (response) => {
    // Log successful response
    logInfo(`Received ${response.data?.items?.length || 0} roles from API`);
    
    // Log if permissions filtering was effective
    if (queryParams.permission_names) {
      const totalRoles = response.data?.items?.length || 0;
      logInfo(`Permission filtering results: ${totalRoles} roles match permission criteria`);
    }
    
    return response;
  };
  
  // Define error handling function
  const handleError = (error) => {
    // Log detailed error information
    logError('Error fetching roles:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config
    });
    throw error;
  };
  
  // Extract permissions filter if it exists
  let permissionNames = null;
  
  // Handle direct permission_names parameter if provided
  if (queryParams.permission_names) {
    logInfo('Using provided permission_names parameter:', queryParams.permission_names);
    return axiosInstance.get(API_CONFIG.ENDPOINTS.roles.list, { params: queryParams })
      .then(processResponse)
      .catch(handleError);
  }
  
  // Check for permissions in direct object format
  if (queryParams.permissions && Array.isArray(queryParams.permissions)) {
    logInfo('Found permissions in direct object format:', queryParams.permissions);
    const permValues = queryParams.permissions;
    delete queryParams.permissions;
    
    const processedPermissions = permValues.map(perm => 
      typeof perm === 'string' ? perm : (perm.name || perm.id || String(perm))
    );
    
    if (processedPermissions.length > 0) {
      queryParams.permission_names = processedPermissions.join(',');
      logInfo('Set permission_names from direct permissions:', queryParams.permission_names);
    }
  }
  
  // Check for permissions filter in array format
  if (queryParams.filters && Array.isArray(queryParams.filters)) {
    const permissionsFilter = queryParams.filters.find(filter => filter.field === 'permissions');
    if (permissionsFilter && Array.isArray(permissionsFilter.value)) {
      // Extract permissions and remove from filters array
      const permValues = permissionsFilter.value;
      queryParams.filters = queryParams.filters.filter(filter => filter.field !== 'permissions');
      
      // Process permission values if they weren't already processed
      if (!queryParams.permission_names && permValues.length > 0) {
        const processedPermissions = permValues.map(perm => 
          typeof perm === 'string' ? perm : (perm.name || perm.id || String(perm))
        );
        permissionNames = processedPermissions.join(',');
        logInfo('Extracted permission_names from filters array:', permissionNames);
      }
    }
  }
  
  // Set permission_names parameter if extracted
  if (!queryParams.permission_names && permissionNames) {
    queryParams.permission_names = permissionNames;
    logInfo('Setting permission_names from filters:', permissionNames);
  }
  
  // Check if we need to serialize the filters
  if (queryParams.filters && Array.isArray(queryParams.filters)) {
    queryParams.filters = JSON.stringify(queryParams.filters);
  }
  
  // Log the final API request for debugging
  logInfo(`Making GET request to ${API_CONFIG.ENDPOINTS.roles.list} with params:`, queryParams);
  if (queryParams.permission_names) {
    logInfo('Permission filter value:', queryParams.permission_names);
  }
  
  return axiosInstance.get(API_CONFIG.ENDPOINTS.roles.list, { params: queryParams })
    .then(processResponse)
    .catch(handleError);
}; 