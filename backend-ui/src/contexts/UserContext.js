import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import userApi from '../services/userApi';
import { logInfo, logError } from '../utils/logger';

// Create the context
const UserContext = createContext(null);

/**
 * UserProvider component
 * Manages global state for users and provides methods for CRUD operations
 */
export const UserProvider = ({ children }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 10,
    total: 0
  });
  const [filters, setFilters] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [roles, setRoles] = useState([]);
  
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

  /**
   * Fetch users with pagination, sorting, and filtering
   */
  const fetchUsers = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use only the filters passed in params, don't merge with filtersRef.current
      const requestParams = {
        ...params
      };
      
      console.log('UserContext fetchUsers - Current filtersRef:', filtersRef.current);
      console.log('UserContext fetchUsers - Incoming params:', params);
      console.log('UserContext fetchUsers - Request params:', requestParams);
      
      // Store the requested page size for later use
      const requestedPageSize = requestParams.page_size || requestParams.pageSize || paginationRef.current.page_size;
      
      // Ensure page and page_size are included with the correct parameter names
      if (!requestParams.page) {
        requestParams.page = paginationRef.current.page;
      }
      
      if (!requestParams.page_size && !requestParams.pageSize) {
        requestParams.page_size = paginationRef.current.page_size;
      } else if (requestParams.pageSize && !requestParams.page_size) {
        // Convert pageSize to page_size for backend compatibility
        requestParams.page_size = requestParams.pageSize;
        delete requestParams.pageSize;
      }
      
      // Add sort parameters if provided
      if (requestParams.sort_by && requestParams.sort_order) {
        console.log('UserContext fetchUsers - Using sort parameters:', {
          field: requestParams.sort_by,
          order: requestParams.sort_order
        });
      } else if (params.sortModel && params.sortModel.length > 0) {
        // Convert sortModel to sort_by and sort_order parameters
        requestParams.sort_by = params.sortModel[0].field;
        requestParams.sort_order = params.sortModel[0].sort;
        console.log('UserContext fetchUsers - Converted sortModel to sort parameters:', {
          field: requestParams.sort_by,
          order: requestParams.sort_order
        });
      }
      
      // Handle special filtering for is_active to ensure consistent format
      if (requestParams.is_active !== undefined) {
        // Make sure is_active is treated as a string for API
        requestParams.is_active = String(requestParams.is_active);
        console.log('UserContext fetchUsers - Formatted is_active filter:', requestParams.is_active);
      }

      // Handle any explicit filter params (filter_field, filter_value)
      if (params.filter_field || params.filter_value) {
        console.log('UserContext fetchUsers - Explicit filter arrays detected:', {
          fields: params.filter_field,
          values: params.filter_value
        });
      }
      
      // Log the request parameters
      logInfo('Fetching users with params:', requestParams);
      console.log('UserContext fetchUsers - Final API request params:', requestParams);
      
      // Check for authentication token
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.error('No authentication token found. Redirecting to login.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 100);
        throw new Error('Authentication required. Please log in.');
      }
      
      const response = await userApi.getUsers(requestParams);
      console.log('UserContext fetchUsers - API response:', response.data);
      
      // Handle empty results for a page that should have data
      if (response.data.items.length === 0 && response.data.total > 0 && requestParams.page > 1) {
        // Calculate the last valid page based on the total and page size
        const lastValidPage = Math.max(1, Math.ceil(response.data.total / requestedPageSize));
        
        console.warn(`Received empty items for page ${requestParams.page} but total is ${response.data.total}. Last valid page should be ${lastValidPage}.`);
        
        if (requestParams.page > lastValidPage) {
          console.log(`Adjusting to last valid page: ${lastValidPage}`);
          
          // Update request params to use last valid page
          requestParams.page = lastValidPage;
          
          // Try the request again with the corrected page
          const retryResponse = await userApi.getUsers(requestParams);
          console.log('UserContext fetchUsers - Retry response with adjusted page:', retryResponse.data);
          
          // Use this response instead
          response.data = retryResponse.data;
        }
      }
      
      // Ensure is_active is properly parsed as boolean
      const normalizedUsers = response.data.items.map(user => ({
        ...user,
        is_active: user.is_active === true || user.is_active === 'true' || user.is_active === 1
      }));
      
      console.log('Normalized users:', normalizedUsers);
      
      // IMPORTANT FIX: Only take the requested number of items to display
      // This ensures the grid shows the correct number of rows even if the backend
      // returns more items than requested
      let usersToDisplay = normalizedUsers;
      if (requestedPageSize && normalizedUsers.length > requestedPageSize) {
        usersToDisplay = normalizedUsers.slice(0, requestedPageSize);
        console.log(`Limiting displayed users to ${requestedPageSize} as requested (got ${normalizedUsers.length} from API)`);
      }
      
      // Update users with possibly limited list
      setUsers(usersToDisplay);
      
      // Update pagination state with consistent property names
      // IMPORTANT: Use the requested page size rather than what the API returned
      setPagination({
        page: response.data.page || 1,
        page_size: requestedPageSize, // Use what was requested instead of what was returned
        total: response.data.total || 0
      });
      
      // Log the actual page size returned by the API vs what we're using
      if (response.data.page_size !== requestParams.page_size || 
          response.data.pageSize !== requestParams.page_size) {
        console.warn('API returned different page_size than requested - using requested size anyway:', {
          requested: requestParams.page_size,
          returned: response.data.page_size || response.data.pageSize,
          actuallyUsing: requestedPageSize
        });
      }
      
      return {
        ...response.data,
        items: usersToDisplay,
        page_size: requestedPageSize // Ensure the page_size in the returned data matches what was requested
      };
    } catch (err) {
      if (err.response?.status === 401 || err.message?.includes('authentication')) {
        // Handle authentication errors
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refresh_token');
        setTimeout(() => {
          window.location.href = '/login';
        }, 100);
        setError('Authentication required. Please log in again.');
      } else {
        // Process error to ensure it's always a string
        let errorMessage = 'Failed to fetch users';
        
        if (err.response?.data?.detail) {
          const detail = err.response.data.detail;
          
          if (typeof detail === 'string') {
            errorMessage = detail;
          } else if (Array.isArray(detail)) {
            // Handle validation errors
            errorMessage = detail.map(errorItem => {
              if (typeof errorItem === 'string') {
                return errorItem;
              } else if (errorItem && typeof errorItem === 'object' && errorItem.msg) {
                return String(errorItem.msg);
              } else {
                return String(errorItem);
              }
            }).join('. ');
          } else if (typeof detail === 'object') {
            errorMessage = JSON.stringify(detail);
          } else {
            errorMessage = String(detail);
          }
        } else if (err.message) {
          errorMessage = String(err.message);
        }
        
        setError(errorMessage);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get a specific user by ID
   */
  const fetchUser = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await userApi.getUserById(id);
      
      // Normalize the user data to ensure is_active is a boolean
      const normalizedUser = {
        ...response.data,
        is_active: response.data.is_active === true || 
                   response.data.is_active === 'true' || 
                   response.data.is_active === 1
      };
      
      console.log('Fetched user:', response.data);
      console.log('Normalized user is_active:', normalizedUser.is_active, 'type:', typeof normalizedUser.is_active);
      
      setSelectedUser(normalizedUser);
      
      return normalizedUser;
    } catch (err) {
      // Process error to ensure it's always a string
      let errorMessage = `Failed to fetch user ${id}`;
      
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // Handle validation errors
          errorMessage = detail.map(errorItem => {
            if (typeof errorItem === 'string') {
              return errorItem;
            } else if (errorItem && typeof errorItem === 'object' && errorItem.msg) {
              return String(errorItem.msg);
            } else {
              return String(errorItem);
            }
          }).join('. ');
        } else if (typeof detail === 'object') {
          errorMessage = JSON.stringify(detail);
        } else {
          errorMessage = String(detail);
        }
      } else if (err.message) {
        errorMessage = String(err.message);
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new user
   */
  const createUser = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await userApi.createUser(userData);
      
      // Refresh the users list
      await fetchUsers();
      
      return response.data;
    } catch (err) {
      // Process error to ensure it's always a string
      let errorMessage = 'Failed to create user';
      
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // Handle validation errors
          errorMessage = detail.map(errorItem => {
            if (typeof errorItem === 'string') {
              return errorItem;
            } else if (errorItem && typeof errorItem === 'object' && errorItem.msg) {
              return String(errorItem.msg);
            } else {
              return String(errorItem);
            }
          }).join('. ');
        } else if (typeof detail === 'object') {
          errorMessage = JSON.stringify(detail);
        } else {
          errorMessage = String(detail);
        }
      } else if (err.message) {
        errorMessage = String(err.message);
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  /**
   * Update an existing user
   */
  const updateUser = useCallback(async (id, userData) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('updateUser - Sending data:', userData);
      
      // Ensure is_active is a boolean before sending to API
      const formattedData = {
        ...userData,
        is_active: userData.is_active === true || userData.is_active === 'true' || userData.is_active === 1
      };
      
      console.log('updateUser - Formatted data with is_active as boolean:', formattedData);
      
      const response = await userApi.updateUser(id, formattedData);
      console.log('updateUser - Response data:', response.data);
      
      // Normalize the user data to ensure is_active is a boolean
      const normalizedUser = {
        ...response.data,
        is_active: Boolean(formattedData.is_active) // Ensure it's a boolean
      };
      
      console.log('updateUser - Normalized user with is_active as boolean:', normalizedUser);
      
      // Update the selected user if it's the one being edited
      if (selectedUser && selectedUser.id === id) {
        setSelectedUser(normalizedUser);
      }
      
      // Update the user in the local users array too
      setUsers(prevUsers => {
        const updatedUsers = prevUsers.map(user => 
          user.id === id ? normalizedUser : user
        );
        console.log('updateUser - Updated local users array:', updatedUsers);
        return updatedUsers;
      });
      
      // Refresh the users list to be safe
      await fetchUsers();
      
      return normalizedUser;
    } catch (err) {
      // Process error to ensure it's always a string
      let errorMessage = `Failed to update user ${id}`;
      
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // Handle validation errors
          errorMessage = detail.map(errorItem => {
            if (typeof errorItem === 'string') {
              return errorItem;
            } else if (errorItem && typeof errorItem === 'object' && errorItem.msg) {
              return String(errorItem.msg);
            } else {
              return String(errorItem);
            }
          }).join('. ');
        } else if (typeof detail === 'object') {
          errorMessage = JSON.stringify(detail);
        } else {
          errorMessage = String(detail);
        }
      } else if (err.message) {
        errorMessage = String(err.message);
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, selectedUser]);

  /**
   * Delete a user
   */
  const deleteUser = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await userApi.deleteUser(id);
      
      // Reset selected user if it's the one being deleted
      if (selectedUser && selectedUser.id === id) {
        setSelectedUser(null);
      }
      
      // Refresh the users list
      await fetchUsers();
      
      return response.data;
    } catch (err) {
      // Process error to ensure it's always a string
      let errorMessage = `Failed to delete user ${id}`;
      
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // Handle validation errors
          errorMessage = detail.map(errorItem => {
            if (typeof errorItem === 'string') {
              return errorItem;
            } else if (errorItem && typeof errorItem === 'object' && errorItem.msg) {
              return String(errorItem.msg);
            } else {
              return String(errorItem);
            }
          }).join('. ');
        } else if (typeof detail === 'object') {
          errorMessage = JSON.stringify(detail);
        } else {
          errorMessage = String(detail);
        }
      } else if (err.message) {
        errorMessage = String(err.message);
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, selectedUser]);

  /**
   * Change user password
   */
  const changePassword = useCallback(async (data) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await userApi.changePassword(data);
      
      return response.data;
    } catch (err) {
      // Process error to ensure it's always a string
      let errorMessage = 'Failed to change password';
      
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // Handle validation errors
          errorMessage = detail.map(errorItem => {
            if (typeof errorItem === 'string') {
              return errorItem;
            } else if (errorItem && typeof errorItem === 'object' && errorItem.msg) {
              return String(errorItem.msg);
            } else {
              return String(errorItem);
            }
          }).join('. ');
        } else if (typeof detail === 'object') {
          errorMessage = JSON.stringify(detail);
        } else {
          errorMessage = String(detail);
        }
      } else if (err.message) {
        errorMessage = String(err.message);
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update filters and trigger refetch
   */
  const applyFilters = useCallback((newFilters) => {
    console.log('UserContext applyFilters - Received filters:', newFilters);
    
    // Store the filters but don't automatically fetch
    setFilters(prevFilters => {
      const updatedFilters = { ...newFilters }; // Replace filters entirely
      
      // Log the filters being applied
      console.log('UserContext applyFilters - Updated filters:', updatedFilters);
      logInfo('Setting filters in user context:', updatedFilters);
      
      // We don't call fetchUsers here - this function just updates the filters state
      // The component that calls applyFilters should be responsible for calling fetchUsers
      
      return updatedFilters;
    });
  }, []);

  /**
   * Clear all filters and reset to first page
   */
  const clearFilters = useCallback(() => {
    console.log('UserContext clearFilters - Clearing all filters');
    
    // Clear filters in state first
    setFilters({});
    
    // Update ref to make sure it's cleared immediately
    filtersRef.current = {};
    
    // Reset to first page and use default sorting
    // Explicitly pass empty params to ensure no filters are applied
    fetchUsers({ 
      page: 1,
      page_size: paginationRef.current.page_size,
      sort_by: 'username',
      sort_order: 'asc'
    });
  }, [fetchUsers]);

  /**
   * Fetch available roles for user assignment
   */
  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await userApi.getRoles();
      setRoles(response.data.items || []);
      
      return response.data.items;
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      // Don't set global error state for this auxiliary function
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Clear selected user
   */
  const clearSelectedUser = useCallback(() => {
    setSelectedUser(null);
  }, []);

  /**
   * Context value with memoization to prevent unnecessary renders
   */
  const contextValue = useMemo(() => ({
    // State
    users,
    selectedUser,
    roles,
    loading,
    error,
    pagination,
    filters,
    
    // CRUD methods
    fetchUsers,
    fetchUser,
    createUser,
    updateUser,
    deleteUser,
    
    // Filter methods
    applyFilters,
    clearFilters,
    
    // Password-related methods
    changePassword,
    
    // Additional methods
    fetchRoles,
    clearSelectedUser
  }), [
    users, selectedUser, roles, loading, error, pagination, filters,
    fetchUsers, fetchUser, createUser, updateUser, deleteUser,
    applyFilters, clearFilters,
    changePassword,
    fetchRoles,
    clearSelectedUser
  ]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

/**
 * Custom hook to access UserContext
 * Checks if context exists and throws an error if used outside a UserProvider
 */
export const useUsers = () => {
  const context = useContext(UserContext);
  
  if (!context) {
    console.error('useUsers must be used within a UserProvider');
    throw new Error('useUsers must be used within a UserProvider');
  }
  
  return context;
};

export default UserContext;