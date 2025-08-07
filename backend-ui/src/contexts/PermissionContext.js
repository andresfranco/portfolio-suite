import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { API_CONFIG } from '../config/apiConfig';
import permissionApi from '../services/permissionApi';
import { logInfo, logError } from '../utils/logger';
import axiosWithAuth from '../services/axiosWithAuth';
import { getErrorMessage, getErrorType, getErrorMessageByType, ERROR_TYPES } from '../utils/errorUtils';

// Create the context
const PermissionContext = createContext(null);

/**
 * PermissionProvider component
 * Manages global state for permissions and provides methods for CRUD operations
 */
export const PermissionProvider = ({ children }) => {
  // State for permissions list
  const [permissions, setPermissions] = useState([]);
  // Loading state
  const [loading, setLoading] = useState(false);
  // Error state - enhanced to include error type
  const [error, setError] = useState(null);
  // Error type state
  const [errorType, setErrorType] = useState(null);
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 10, // Matches backend parameter name
    total: 0
  });
  // Filter state
  const [filters, setFilters] = useState({
    name: '',
    description: '',
    roles: '',
  });
  
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

  // Helper to set errors with type information
  const setErrorWithType = useCallback((err) => {
    const errorMsg = getErrorMessage(err);
    const type = getErrorType(err);
    const enhancedMessage = getErrorMessageByType(type, errorMsg);
    
    setError(enhancedMessage);
    setErrorType(type);
    
    return { message: enhancedMessage, type };
  }, []);

  // Helper to clear errors
  const clearError = useCallback(() => {
    setError(null);
    setErrorType(null);
  }, []);

  /**
   * Fetch permissions with pagination and filters
   * @param {number} page - Page number
   * @param {number} pageSize - Items per page
   * @param {Object} filters - Filter object with field names as keys
   * @param {Array} sortModel - Sorting model from DataGrid
   */
  const fetchPermissions = useCallback(async (page = 1, pageSize = 10, filters = {}, sortModel = []) => {
    setLoading(true);
    setError(null);
    logInfo('Fetching permissions with filters:', filters);
    
    try {
      // Build the URL with pagination parameters
      let url = `${API_CONFIG.ENDPOINTS.permissions.list}?page=${page}&page_size=${pageSize}&include_count=true`;
      
      // Process role filters separately - backend expects role_names as a separate parameter
      let roleNames = [];
      
      // Handle filters according to the backend's expected format
      if (filters && Object.keys(filters).length > 0) {
        logInfo('Processing filters for API request:', filters);
        
        // Convert our filter object to the array format expected by the backend
        // Backend expects a JSON string representing an array of filter objects:
        // e.g., [{"field":"name", "value":"admin", "operator":"contains"}]
        const filterArray = [];
        
        Object.entries(filters).forEach(([key, value]) => {
          if (key && value !== undefined && value !== null) {
            // Handle array filters like roles
            if (Array.isArray(value)) {
              // Only process non-empty arrays
              if (value.length > 0) {
                // For roles, extract names for the separate role_names parameter
                if (key === 'roles') {
                  logInfo(`Processing ${value.length} role filters:`, value);
                  value.forEach(role => {
                    // Extract the role name from object if needed
                    let roleValue = role;
                    if (typeof role === 'object' && role !== null) {
                      roleValue = role.name || role.code || String(role.id);
                    }
                    // Add to roleNames array instead of filterArray
                    roleNames.push(roleValue);
                  });
                } else {
                  // For other array filters, add as a single 'in' filter
                  filterArray.push({
                    field: key,
                    value: value,
                    operator: 'in'
                  });
                }
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
        
        // Only add the filters parameter if we have any filters
        if (filterArray.length > 0) {
          const filtersJson = JSON.stringify(filterArray);
          logInfo('Adding filters JSON to URL:', filtersJson);
          url += `&filters=${encodeURIComponent(filtersJson)}`;
        }
        
        // Add role_names parameter if roles were specified
        if (roleNames.length > 0) {
          const roleNamesStr = roleNames.join(',');
          logInfo('Adding role_names parameter:', roleNamesStr);
          url += `&role_names=${encodeURIComponent(roleNamesStr)}`;
        }
      }
      
      // Add sorting if provided
      if (sortModel && sortModel.length > 0) {
        const sortField = sortModel[0].field;
        const sortOrder = sortModel[0].sort;
        
        // Debug the exact sort model received
        logInfo(`SORT DEBUG - Raw sort model received:`, JSON.stringify(sortModel));
        logInfo(`SORT DEBUG - Using sort parameters: field=${sortField}, order=${sortOrder}`);
        
        url += `&sort_field=${sortField}&sort_order=${sortOrder}`;
      }
      
      logInfo(`Fetching permissions from: ${url}`);
      
      // Call the API with our custom URL
      const response = await permissionApi.getPermissionsCustom(url);
      
      if (response) {
        // Log the received data
        logInfo(`Received ${response.items?.length || 0} permissions out of ${response.total || 0} total`);
        
        // Check actual data received
        const permissionsData = response.items || [];
        logInfo(`First 3 permissions after filtering: ${JSON.stringify(permissionsData.slice(0, 3).map(p => p.name))}`);
        
        // Update state with the response data
        setPermissions(permissionsData);
        setPagination({
          page,
          page_size: pageSize,
          total: response.total || 0
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      logError('Error fetching permissions:', err);
      setError(err.message || 'Failed to fetch permissions');
      return Promise.reject(err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new permission
   */
  const createPermission = useCallback(async (permissionData) => {
    setLoading(true);
    clearError();
    
    logInfo('Creating permission', permissionData);
    
    try {
      const response = await permissionApi.createPermission(permissionData);
      logInfo('Permission created successfully', response.data);
      
      // Refresh permission list to include the new item
      await fetchPermissions(1, paginationRef.current.page_size, filtersRef.current);
      return response.data;
    } catch (err) {
      const { message, type } = setErrorWithType(err);
      
      // Add specific handling for conflict errors (duplicate permission names)
      if (type === ERROR_TYPES.CONFLICT) {
        logError(`Error creating permission - Name conflict:`, message);
      } else {
        logError(`Error creating permission (${type}):`, message);
      }
      
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [fetchPermissions, clearError, setErrorWithType]);

  /**
   * Update an existing permission
   */
  const updatePermission = useCallback(async (id, permissionData) => {
    setLoading(true);
    clearError();
    
    logInfo(`Updating permission ${id}`, permissionData);
    
    try {
      const response = await permissionApi.updatePermission(id, permissionData);
      logInfo(`Permission ${id} updated successfully`, response.data);
      
      // Refresh permission list with current pagination and filters
      await fetchPermissions(paginationRef.current.page, paginationRef.current.page_size, filtersRef.current);
      return response.data;
    } catch (err) {
      const { message, type } = setErrorWithType(err);
      
      // Specific messages based on error type
      if (type === ERROR_TYPES.CONFLICT) {
        logError(`Error updating permission ${id} - Name conflict:`, message);
      } else if (type === ERROR_TYPES.NOT_FOUND) {
        logError(`Error updating permission ${id} - Not found:`, message);
      } else {
        logError(`Error updating permission ${id} (${type}):`, message);
      }
      
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [fetchPermissions, clearError, setErrorWithType]);

  /**
   * Delete a permission
   */
  const deletePermission = useCallback(async (id) => {
    setLoading(true);
    clearError();
    
    logInfo(`Deleting permission ${id}`);
    
    try {
      await permissionApi.deletePermission(id);
      logInfo(`Permission ${id} deleted successfully`);
      
      // Refresh permissions list. Check if we need to adjust current page.
      const currentPage = paginationRef.current.page;
      const currentPageSize = paginationRef.current.page_size;
      const currentTotal = paginationRef.current.total;
      const newTotal = currentTotal - 1;
      
      // If we're on a page with only one item or deleting the last item would result in an empty page,
      // go back one page (unless we're already on page 1)
      const newPage = (currentPage > 1 && (newTotal % currentPageSize === 0 || permissions.length === 1)) 
                     ? currentPage - 1 
                     : currentPage;

      await fetchPermissions(newPage, currentPageSize, filtersRef.current);
      return true;
    } catch (err) {
      const { message, type } = setErrorWithType(err);
      
      // Specific handling for permission deletion errors
      if (type === ERROR_TYPES.PERMISSION) {
        // This could be from our custom validation on the backend
        logError(`Cannot delete permission ${id} - Associated with roles:`, message);
      } else if (type === ERROR_TYPES.NOT_FOUND) {
        logError(`Error deleting permission ${id} - Not found:`, message);
      } else {
        logError(`Error deleting permission ${id} (${type}):`, message);
      }
      
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [fetchPermissions, permissions, clearError, setErrorWithType]); // Include permissions in dependencies for length check

  /**
   * Update the filter state
   */
  const updateFilters = useCallback((newFilters) => {
    logInfo('Updating permission filters in context:', newFilters);
    
    // Ensure the new filters are a different object for re-rendering
    const updatedFilters = { ...newFilters };
    setFilters(updatedFilters);
    
    // Force state update by creating a new state object
    setPagination(prev => ({
      ...prev,
      page: 1  // Reset to first page when filters change
    }));
    
    // Log the resulting filter state
    logInfo('Permission filters after update:', updatedFilters);
    
    return updatedFilters;
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters({
      name: '',
      description: '',
      roles: '',
    });
    filtersRef.current = {
      name: '',
      description: '',
      roles: '',
    };
  }, []);

  /**
   * Context value with memoization to prevent unnecessary renders
   */
  const contextValue = useMemo(() => ({
    permissions,
    loading,
    error,
    errorType, // Add error type to context
    pagination,
    setPagination,
    filters,
    fetchPermissions,
    createPermission,
    updatePermission,
    deletePermission,
    updateFilters, // Use the proper function instead of setFilters
    clearError // Expose error clearing function
  }), [
    permissions, loading, error, errorType, pagination, filters,
    fetchPermissions, createPermission, updatePermission, deletePermission, 
    updateFilters, clearError // Update dependency list
  ]);

  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  );
};

/**
 * Hook to use the permission context
 */
export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  return context;
};

/**
 * Error boundary component specifically for permission-related errors
 */
export class PermissionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError('Permission component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="error-container">
          <h2>Something went wrong in the Permissions module.</h2>
          <p>{this.state.error?.message || 'Unknown error'}</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="error-reset-button"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PermissionContext; 