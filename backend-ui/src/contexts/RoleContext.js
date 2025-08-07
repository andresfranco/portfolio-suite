import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import * as roleApi from '../api/roleApi'; // Updated import for the new roleApi module
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';

// Create the context
const RoleContext = createContext(null);

/**
 * RoleProvider component
 * Manages global state for roles and provides methods for CRUD operations
 */
export const RoleProvider = ({ children }) => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 10, // Use page_size consistent with backend
    total: 0
  });
  
  // Store active filters as an array of Filter objects to match the backend schema
  const [filters, setFilters] = useState([]);
  
  // Store state in refs for use in callbacks without dependencies
  const filtersRef = useRef(filters);
  const paginationRef = useRef(pagination);
  
  // Update refs when state changes
  useMemo(() => {
    filtersRef.current = filters;
  }, [filters]);
  
  useMemo(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  const [selectedRole, setSelectedRole] = useState(null);
  const [roleNames, setRoleNames] = useState([]);

  /**
   * Fetch roles with pagination and filters
   */
  const fetchRoles = useCallback(async (page = 1, pageSize = 10, filters = [], sortModel = []) => {
    setLoading(true);
    setError(null);
    
    logInfo('Fetching roles with params:', { page, pageSize, filters, sortModel });
    
    try {
      // Prepare the API parameters
      const params = {
        page,
        page_size: pageSize,
        include_count: true
      };
      
      // Debug complete filters object
      logInfo('Processing filters for API request:', filters);
      
      // Handle permissions directly for simpler processing
      let permissionNames = [];
      
      // Check different formats of permissions
      if (filters) {
        // 1. Direct permissions array in filters object
        if (filters.permissions && Array.isArray(filters.permissions) && filters.permissions.length > 0) {
          logInfo('Found permissions array in filters object:', filters.permissions);
          
          // Extract permission names
          permissionNames = filters.permissions.map(perm => 
            typeof perm === 'string' ? perm : (perm.name || perm.id || String(perm))
          );
          
          logInfo('Extracted permission names from filters.permissions:', permissionNames);
        }
        
        // 2. Permissions in filters array
        if (Array.isArray(filters)) {
          const permFilter = filters.find(f => f.field === 'permissions');
          if (permFilter && permFilter.value && Array.isArray(permFilter.value) && permFilter.value.length > 0) {
            logInfo('Found permissions in filters array:', permFilter.value);
            
            // Extract permission names
            permissionNames = permFilter.value.map(perm => 
              typeof perm === 'string' ? perm : (perm.name || perm.id || String(perm))
            );
            
            logInfo('Extracted permission names from filters array:', permissionNames);
            
            // Remove permissions from filters array as we'll handle it separately
            filters = filters.filter(f => f.field !== 'permissions');
          }
        }
      }
      
      // Add permission_names parameter if we found any permissions
      if (permissionNames.length > 0) {
        params.permission_names = permissionNames.join(',');
        logInfo('Set permission_names parameter:', params.permission_names);
      }
      
      // Process regular filters
      if (filters) {
        // Convert object format to array if needed
        let filterArray = Array.isArray(filters) ? filters : [];
        
        // If filters is an object, convert it to array format (excluding permissions)
        if (!Array.isArray(filters) && typeof filters === 'object') {
          filterArray = [];
          
          Object.entries(filters).forEach(([key, value]) => {
            if (key && value !== undefined && value !== null && key !== 'permissions') {
              // Skip permissions as we handle it separately
              
              // Handle array filters
              if (Array.isArray(value)) {
                // Only process non-empty arrays
                if (value.length > 0) {
                  // Add as a single 'in' filter
                  filterArray.push({
                    field: key,
                    value: value,
                    operator: 'in'
                  });
                }
              } 
              // Handle string filters
              else if (typeof value === 'string' && value.trim() !== '') {
                logInfo(`Processing string filter ${key}:`, value);
                filterArray.push({
                  field: key,
                  value: value.trim(),
                  operator: 'contains'
                });
              }
              // Handle number filters
              else if (typeof value === 'number') {
                logInfo(`Processing number filter ${key}:`, value);
                filterArray.push({
                  field: key,
                  value: value,
                  operator: 'eq'
                });
              }
            }
          });
        }
        
        // Only add filters parameter if we have any filters
        if (filterArray.length > 0) {
          logInfo('Adding filters array to params:', filterArray);
          params.filters = filterArray;
        }
      }
      
      // Add sort if provided
      if (Array.isArray(sortModel) && sortModel.length > 0) {
        const sortField = sortModel[0].field;
        const sortDir = sortModel[0].sort === 'desc' ? 'desc' : 'asc';
        logInfo(`SORT DEBUG - Using sort parameters: field=${sortField}, order=${sortDir}`);
        params.sort_field = sortField;
        params.sort_order = sortDir;
      }
      
      // Add support for pagination
      params.page = page;
      params.page_size = pageSize;
      
      // Also add compatible pagination params for APIs that use offset/limit
      params.offset = (page - 1) * pageSize;
      params.limit = pageSize;
      
      logInfo('Final API request params for getRoles:', params);
      
      // Call the API
      const response = await roleApi.getRoles(params);
      
      // Process the response
      if (response && response.data) {
        // Log detailed response data for debugging
        logInfo('API Response Structure:', {
          hasItems: !!response.data.items,
          hasResults: !!response.data.results,
          itemsCount: response.data.items?.length,
          total: response.data.total,
          page: response.data.page,
          pageSize: response.data.page_size
        });
        
        // Log the raw response data for detailed debugging
        logDebug('Raw API response data:', JSON.stringify(response.data).substring(0, 500) + '...');
        
        // Handle API response format which uses 'items' instead of 'results'
        const roles = response.data.items || response.data.results || [];
        
        logInfo(`Found ${roles.length} roles in the response`);
        
        // Update state with the data
        setRoles(roles);
        
        // Update pagination from the response - use fallbacks for all values
        setPagination({
          page: response.data.page || 1,
          page_size: response.data.page_size || 10,
          total: response.data.total || roles.length || 0
        });
        
        // If successful but no roles data, log a warning
        if (roles.length === 0) {
          logWarn('API returned successful response but with no roles data');
        }
        
        return true;
      } else {
        logError('Invalid response format - missing data property:', response);
        throw new Error('Invalid response format - missing data');
      }
    } catch (err) {
      let errorMessage = 'Failed to fetch roles';
      
      if (err.response?.status === 403) {
        errorMessage = 'You do not have permission to view roles';
      } else if (err.response?.status === 401) {
        errorMessage = 'Authentication required. Please log in again';
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      logError('Error fetching roles:', err);
      setError(errorMessage);
      return Promise.reject(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRole = useCallback(async (id) => {
    if (!id) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await roleApi.getRoleById(id);
      
      if (response && response.data) {
        setSelectedRole(response.data);
        return response.data;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || `Failed to fetch role ${id}`;
      logError('Error fetching role:', err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new role
   */
  const createRole = useCallback(async (roleData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await roleApi.createRole(roleData);
      
      if (response && response.data) {
        logInfo('Role created successfully:', response.data);
        return response.data;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      let errorMessage = 'Failed to create role';
      
      if (err.response?.status === 403) {
        errorMessage = 'You do not have permission to create roles';
      } else if (err.response?.status === 422) {
        errorMessage = err.response.data?.detail || 'Validation error occurred';
      } else if (err.response?.status === 409) {
        errorMessage = 'A role with this name already exists';
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      logError('Error creating role:', err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update an existing role
   */
  const updateRole = useCallback(async (id, roleData) => {
    if (!id) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await roleApi.updateRole(id, roleData);
      
      if (response && response.data) {
        logInfo('Role updated successfully:', response.data);
        return response.data;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      let errorMessage = `Failed to update role ${id}`;
      
      if (err.response?.status === 403) {
        errorMessage = 'You do not have permission to edit roles';
      } else if (err.response?.status === 422) {
        errorMessage = err.response.data?.detail || 'Validation error occurred';
      } else if (err.response?.status === 409) {
        errorMessage = 'A role with this name already exists';
      } else if (err.response?.status === 404) {
        errorMessage = 'Role not found. It may have been deleted already';
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      logError('Error updating role:', err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete a role
   */
  const deleteRole = useCallback(async (id) => {
    if (!id) return false;
    
    setLoading(true);
    setError(null);
    
    try {
      await roleApi.deleteRole(id);
      logInfo('Role deleted successfully:', id);
      return true;
    } catch (err) {
      let errorMessage = `Failed to delete role ${id}`;
      
      if (err.response?.status === 403) {
        errorMessage = 'You do not have permission to delete roles';
      } else if (err.response?.status === 404) {
        errorMessage = 'Role not found. It may have been deleted already';
      } else if (err.response?.status === 409) {
        errorMessage = 'Cannot delete role. It may be assigned to users or required by the system';
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      logError('Error deleting role:', err);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Add a filter
   * @param {Object} filter - Filter object with field, value, operator properties
   */
  const addFilter = useCallback((filter) => {
    if (!filter || !filter.field || !filter.value) return;
    
    setFilters(prevFilters => {
      // Check if we already have a filter for this field
      const existingIndex = prevFilters.findIndex(f => f.field === filter.field);
      
      if (existingIndex >= 0) {
        // Replace the existing filter
        const newFilters = [...prevFilters];
        newFilters[existingIndex] = filter;
        return newFilters;
      } else {
        // Add a new filter
        return [...prevFilters, filter];
      }
    });
  }, []);

  /**
   * Remove a filter by field
   * @param {string} field - Field name to remove filter for
   */
  const removeFilter = useCallback((field) => {
    setFilters(prevFilters => prevFilters.filter(f => f.field !== field));
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  /**
   * Update filters
   */
  const updateFilters = useCallback((newFilters) => {
    logDebug('Updating filters:', newFilters);
    setFilters(newFilters);
  }, []);

  const fetchRoleNames = useCallback(async () => {
    setLoading(true);
    
    try {
      const response = await roleApi.getAllRoleNames();
      
      if (response && response.data && Array.isArray(response.data)) {
        setRoleNames(response.data);
        return response.data;
      } else {
        logWarn('Invalid response format for role names');
        return [];
      }
    } catch (err) {
      logError('Error fetching role names:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSelectedRole = useCallback(() => {
    setSelectedRole(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Context value with memoization to prevent unnecessary renders
   */
  const contextValue = useMemo(() => ({
    roles,
    loading,
    error,
    pagination,
    filters,
    selectedRole,
    roleNames,
    fetchRoles,
    fetchRole,
    createRole,
    updateRole,
    deleteRole,
    updateFilters,
    fetchRoleNames,
    clearSelectedRole,
    clearError
  }), [
    roles, 
    loading, 
    error, 
    pagination, 
    filters, 
    selectedRole,
    roleNames,
    fetchRoles, 
    fetchRole, 
    createRole, 
    updateRole, 
    deleteRole,
    updateFilters,
    fetchRoleNames,
    clearSelectedRole,
    clearError
  ]);

  return (
    <RoleContext.Provider value={contextValue}>
      {children}
    </RoleContext.Provider>
  );
};

/**
 * Custom hook to access RoleContext
 * Checks if context exists and throws an error if used outside a RoleProvider
 */
export const useRole = () => {
  const context = useContext(RoleContext);
  
  if (!context) {
    console.error('useRole must be used within a RoleProvider');
    throw new Error('useRole must be used within a RoleProvider');
  }
  
  return context;
};

export default RoleContext;