import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import categoryTypeApi from '../services/categoryTypeApi';
import authService from '../services/authService';
import { logInfo, logError } from '../utils/logger';
import { getErrorMessage, getErrorType, getErrorMessageByType, ERROR_TYPES } from '../utils/errorUtils';
import { useAuthorization } from './AuthorizationContext';
import { buildViewDeniedMessage } from '../utils/permissionMessages';

// Create context
const CategoryTypeContext = createContext(null);

// Custom hook for using the context
export const useCategoryType = () => {
  const context = useContext(CategoryTypeContext);
  if (!context) {
    throw new Error('useCategoryType must be used within a CategoryTypeProvider');
  }
  return context;
};

// Provider component
export const CategoryTypeProvider = ({ children }) => {
  // State for category types data
  const [categoryTypes, setCategoryTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  
  // Track authentication state
  const [isAuth, setIsAuth] = useState(authService.isAuthenticated());
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 0, // 0-indexed for MUI DataGrid
    pageSize: 10,
    total: 0
  });
  
  // Filters state
  const [filters, setFilters] = useState({
    code: '',
    name: ''
  });

  // Watch for authentication changes
  useEffect(() => {
    const checkAuthChange = () => {
      const currentAuth = authService.isAuthenticated();
      // Only update state if auth status actually changed
      if (currentAuth !== isAuth) {
        logInfo('CategoryTypeContext: Auth status changed', {
          wasAuth: isAuth,
          isAuth: currentAuth
        });
        setIsAuth(currentAuth);
      }
    };

    // Only start interval if authenticated
    if (authService.isAuthenticated()) {
      const interval = setInterval(checkAuthChange, 5000);
      
      return () => {
        clearInterval(interval);
      };
    }
    
    // If not authenticated, just do a single check
    checkAuthChange();
  }, [isAuth]);

  // Store state in refs for use in callbacks without dependencies
  const filtersRef = useRef(filters);
  const paginationRef = useRef(pagination);
  const accessDeniedRef = useRef(accessDenied);
  
  // Update refs when state changes
  useMemo(() => {
    filtersRef.current = filters;
  }, [filters]);
  
  useMemo(() => {
    paginationRef.current = pagination;
  }, [pagination]);
  useMemo(() => {
    accessDeniedRef.current = accessDenied;
  }, [accessDenied]);

  // Authorization helpers (optional): use a ref to keep a stable reference and avoid re-renders changing dependencies
  const canAccessModuleRef = useRef(() => true);
  try {
    const auth = useAuthorization();
    if (auth && typeof auth.canAccessModule === 'function') {
      canAccessModuleRef.current = auth.canAccessModule;
    } else {
      canAccessModuleRef.current = () => true;
    }
  } catch (e) {
    // AuthorizationProvider not present (e.g., in tests). Allow fetches by default.
    canAccessModuleRef.current = () => true;
  }

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

  // Fetch category types
  const fetchCategoryTypes = useCallback(async (page = 0, pageSize = 10, filterParams = {}, sortModel = []) => {
    // Check if user is authenticated before making API calls
    const isAuth = authService.isAuthenticated();
    
    logInfo('CategoryTypeContext: Pre-fetch authentication check', {
      isAuthenticated: isAuth
    });
    
    if (!isAuth) {
      logInfo('User not authenticated, skipping category types fetch');
      return;
    }

  // Avoid premature gating: rely on server 403 to mark accessDenied.
  // This prevents false negatives while permissions are still loading.
    
    logInfo('CategoryTypeContext: Starting fetchCategoryTypes', {
      page,
      pageSize,
      filterParams,
      isAuthenticated: isAuth
    });
    
    setLoading(true);
    clearError();
    
    try {
      // Build request options for API call
      const requestOptions = {
        page: page + 1, // Convert to 1-indexed for API
        page_size: pageSize,
        filters: filterParams && Object.keys(filterParams).length > 0 ? filterParams : null
      };
      
      // Add sorting if provided
      if (sortModel && sortModel.length > 0) {
        const sortField = sortModel[0].field;
        const sortOrder = sortModel[0].sort;
        
        logInfo(`Adding sort parameters: field=${sortField}, order=${sortOrder}`);
        
        requestOptions.sort_field = sortField;
        requestOptions.sort_order = sortOrder;
      }
      
      logInfo('API request options for category types:', requestOptions);
      
      const response = await categoryTypeApi.getCategoryTypes(requestOptions);
      
      // Log the structure of the response to debug
      logInfo('Response from getCategoryTypes API:', response);

      // Defensive: handle undefined/empty responses gracefully to avoid crashes in tests
      if (!response) {
        logError('Empty response from getCategoryTypes API; treating as empty result');
        setCategoryTypes([]);
        setPagination({
          page,
          pageSize,
          total: 0
        });
        return [];
      }

      // Handle both response structures: direct or nested in data
      const responseData = (response && response.data) ? response.data : response;
      const categoryTypesData = responseData.items || [];

      logInfo(`Received ${categoryTypesData.length} category types out of ${responseData.total || 0} total`);

      // Log each category type to debug
      if (categoryTypesData.length > 0) {
        logInfo('First few category types:', categoryTypesData.slice(0, 3));
      }

      // Ensure each item has a unique id for the DataGrid
      const processedData = categoryTypesData.map(ct => ({
        ...ct,
        id: ct.id ?? ct.code
      }));

      setCategoryTypes(processedData);
      setPagination({
        page,
        pageSize,
        total: responseData.total || 0
      });
      
      return processedData;
    } catch (err) {
      logError('Error fetching category types:', err);
      
      // Handle 401 errors specifically
      if (err.response?.status === 401) {
        logError('Authentication failed - clearing tokens and redirecting to login');
        // Clear auth state to prevent further retries
        localStorage.removeItem('csrf_token');
        localStorage.removeItem('isAuthenticated');
        setIsAuth(false);
        authService.logout();
        return;
      }

      // Handle 403 permission errors: set accessDenied to stop further retries
      if (err.response?.status === 403) {
        logError('Permission denied for category types (403). Stopping further retries.');
        setAccessDenied(true);
        setError(buildViewDeniedMessage('categorytypes'));
        setErrorType(ERROR_TYPES.PERMISSION);
        return;
      }
      
      setErrorWithType(err);
      return Promise.reject(err);
    } finally {
      setLoading(false);
    }
  }, [clearError, setErrorWithType]);

  // If access was previously denied but user now has access, clear the flag and refetch
  useEffect(() => {
    try {
      const canAccess = typeof canAccessModuleRef.current === 'function'
        ? canAccessModuleRef.current('categorytypes')
        : true;
      if (accessDenied && canAccess) {
        logInfo('Permissions updated; clearing accessDenied for category types and refetching');
        setAccessDenied(false);
        clearError();
        // Attempt a lightweight refetch
        fetchCategoryTypes(0, paginationRef.current.pageSize, filtersRef.current).catch(() => {});
      }
    } catch (e) {
      // no-op
    }
  }, [accessDenied, fetchCategoryTypes, clearError]);

  // Fetch a single category type by code
  const fetchCategoryTypeByCode = useCallback(async (code) => {
    if (!code) {
      logError('fetchCategoryTypeByCode: No code provided');
      return null;
    }
    
    // Check if user is authenticated before making API calls
    if (!authService.isAuthenticated()) {
      logInfo('User not authenticated, skipping category type fetch by code');
      return null;
    }
    
    setLoading(true);
    clearError();
    
    logInfo(`Fetching category type with code: ${code}`);
    
    try {
      const response = await categoryTypeApi.getCategoryTypeById(code);
      
      if (response && response.data) {
        logInfo(`Category type ${code} fetched successfully`);
        return response.data;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      logError(`Error fetching category type ${code}:`, err);
      
      // Handle 401 errors specifically
      if (err.response?.status === 401) {
        logError('Authentication failed - clearing tokens and redirecting to login');
        authService.logout();
        return null;
      }
      
      setErrorWithType(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearError, setErrorWithType]);

  // Create a new category type
  const createCategoryType = useCallback(async (categoryTypeData) => {
    // Check if user is authenticated before making API calls
    if (!authService.isAuthenticated()) {
      logInfo('User not authenticated, skipping category type creation');
      throw new Error('Authentication required');
    }
    
    setLoading(true);
    clearError();
    
    logInfo('Creating category type:', categoryTypeData);
    
    try {
      const response = await categoryTypeApi.createCategoryType(categoryTypeData);
      logInfo('Category type created successfully', response.data);
      
      // Refresh category types list with current filters
      const currentFilters = filtersRef.current && Object.keys(filtersRef.current).length > 0 ? filtersRef.current : {};
      await fetchCategoryTypes(0, paginationRef.current.pageSize, currentFilters);
      
      return response.data;
    } catch (err) {
      const { message, type } = setErrorWithType(err);
      
      if (type === ERROR_TYPES.CONFLICT) {
        logError(`Error creating category type - Code conflict:`, message);
      } else {
        logError(`Error creating category type (${type}):`, message);
      }
      
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [fetchCategoryTypes, clearError, setErrorWithType]);

  // Update an existing category type
  const updateCategoryType = useCallback(async (code, categoryTypeData) => {
    // Check if user is authenticated before making API calls
    if (!authService.isAuthenticated()) {
      logInfo('User not authenticated, skipping category type update');
      throw new Error('Authentication required');
    }
    
    setLoading(true);
    clearError();
    
    logInfo(`Updating category type ${code}:`, categoryTypeData);
    
    try {
      const response = await categoryTypeApi.updateCategoryType(code, categoryTypeData);
      logInfo(`Category type ${code} updated successfully`, response.data);
      
      // Refresh category types list with current filters
      const currentFilters = filtersRef.current && Object.keys(filtersRef.current).length > 0 ? filtersRef.current : {};
      await fetchCategoryTypes(paginationRef.current.page, paginationRef.current.pageSize, currentFilters);
      
      return response.data;
    } catch (err) {
      const { message, type } = setErrorWithType(err);
      
      if (type === ERROR_TYPES.CONFLICT) {
        logError(`Error updating category type ${code} - Code conflict:`, message);
      } else if (type === ERROR_TYPES.NOT_FOUND) {
        logError(`Error updating category type ${code} - Not found:`, message);
      } else {
        logError(`Error updating category type ${code} (${type}):`, message);
      }
      
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [fetchCategoryTypes, clearError, setErrorWithType]);

  // Delete a category type
  const deleteCategoryType = useCallback(async (code) => {
    // Check if user is authenticated before making API calls
    if (!authService.isAuthenticated()) {
      logInfo('User not authenticated, skipping category type deletion');
      throw new Error('Authentication required');
    }
    
    setLoading(true);
    clearError();
    
    logInfo(`Deleting category type ${code}`);
    
    try {
      await categoryTypeApi.deleteCategoryType(code);
      logInfo(`Category type ${code} deleted successfully`);
      
      // Refresh the list, potentially adjusting page if needed
      const currentPage = paginationRef.current.page;
      const currentPageSize = paginationRef.current.pageSize;
      const currentTotal = paginationRef.current.total;
      const newTotal = currentTotal - 1;
      
      // If we're on a page with only one item or deleting the last item would result in an empty page,
      // go back one page (unless we're already on page 0)
      const newPage = (currentPage > 0 && (newTotal % currentPageSize === 0 || categoryTypes.length === 1)) 
                     ? currentPage - 1 
                     : currentPage;
      
      // Get current filters
      const currentFilters = filtersRef.current && Object.keys(filtersRef.current).length > 0 ? filtersRef.current : {};
      await fetchCategoryTypes(newPage, currentPageSize, currentFilters);
      
      return true;
    } catch (err) {
      const { message, type } = setErrorWithType(err);
      
      if (type === ERROR_TYPES.PERMISSION) {
        logError(`Cannot delete category type ${code} - Category type in use:`, message);
      } else if (type === ERROR_TYPES.NOT_FOUND) {
        logError(`Error deleting category type ${code} - Not found:`, message);
      } else {
        logError(`Error deleting category type ${code} (${type}):`, message);
      }
      
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [fetchCategoryTypes, categoryTypes, clearError, setErrorWithType]);

  // Check if a category type code exists
  const checkCodeExists = useCallback(async (code) => {
    if (!code || code.trim() === '') {
      return false;
    }
    
    // Check if user is authenticated before making API calls
    if (!authService.isAuthenticated()) {
      logInfo('User not authenticated, skipping code existence check');
      return false;
    }
    
    try {
      logInfo(`Checking if category type code exists: ${code}`);
      const response = await categoryTypeApi.checkCodeExists(code);
      logInfo(`Category type code ${code} exists: ${response.exists}`);
      return response.exists;
    } catch (err) {
      logError(`Error checking if category type code exists (${code}):`, err);
      // Return false instead of throwing to not break the form validation
      return false;
    }
  }, []);

  // Update filters and refresh data
  const updateFilters = useCallback((newFilters) => {
    logInfo('Updating category type filters in context:', newFilters);
    
    // Ensure the new filters are a different object for re-rendering
    const updatedFilters = { ...newFilters };
    setFilters(updatedFilters);
    
    // Force state update by creating a new state object
    setPagination(prev => ({
      ...prev,
      page: 0  // Reset to first page when filters change
    }));
    
    // Log the resulting filter state
    logInfo('Category type filters after update:', updatedFilters);
    
    return updatedFilters;
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    logInfo('Clearing all category type filters');
    
    setFilters({
      code: '',
      name: ''
    });
    
    filtersRef.current = {
      code: '',
      name: ''
    };
    
    // Reset pagination to first page
    setPagination(prev => ({
      ...prev,
      page: 0
    }));
    
    // Only fetch if authenticated - don't call fetchCategoryTypes directly
    if (authService.isAuthenticated()) {
      fetchCategoryTypes(0, paginationRef.current.pageSize, {});
    } else {
      logInfo('User not authenticated, skipping filter clear fetch');
    }
  }, [fetchCategoryTypes]);

  // Add an effect to fetch category types when the context is mounted or auth changes
  useEffect(() => {
    logInfo('CategoryTypeContext: useEffect triggered', {
      categoryTypesLength: categoryTypes.length,
      loading,
      authenticated: authService.isAuthenticated(),
      isAuth: isAuth
    });
    
    // Only fetch if we haven't already loaded category types and user is authenticated
  if (categoryTypes.length === 0 && !loading && authService.isAuthenticated() && isAuth && !accessDeniedRef.current) {
      logInfo('CategoryTypeContext: Conditions met for initial load of category types');
      fetchCategoryTypes(0, 100, {}).catch(err => {
        logError('Failed to load initial category types:', err);
      });
    } else {
      logInfo('CategoryTypeContext: Skipping initial load - conditions not met');
    }
    // Removed fetchCategoryTypes from dependencies to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryTypes.length, loading, isAuth]);

  // Create the context value
  const contextValue = useMemo(() => ({
    categoryTypes,
    loading,
    error,
    errorType,
  accessDenied,
    pagination,
    filters,
    fetchCategoryTypes,
    fetchCategoryTypeByCode,
    createCategoryType,
    updateCategoryType,
    deleteCategoryType,
    checkCodeExists,
    updateFilters,
    clearFilters,
  clearError
  }), [
    categoryTypes, 
    loading, 
    error, 
    errorType,
  accessDenied,
    pagination, 
    filters,
    fetchCategoryTypes,
    fetchCategoryTypeByCode, 
    createCategoryType, 
    updateCategoryType, 
    deleteCategoryType,
    checkCodeExists,
    updateFilters,
    clearFilters,
    clearError
  ]);

  return (
    <CategoryTypeContext.Provider value={contextValue}>
      {children}
    </CategoryTypeContext.Provider>
  );
};

// Error boundary component for category type related errors
export class CategoryTypeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError('CategoryType component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Something went wrong in the Category Types module.</h2>
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

export default CategoryTypeContext; 