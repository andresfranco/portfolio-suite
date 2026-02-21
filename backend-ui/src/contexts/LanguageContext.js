import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { API_CONFIG } from '../config/apiConfig';
import languageApi from '../services/languageApi';
import { logInfo, logError } from '../utils/logger';
import { getErrorMessage, getErrorType, getErrorMessageByType, ERROR_TYPES } from '../utils/errorUtils';
import { useSnackbar } from 'notistack';

// Create the context
const LanguageContext = createContext(null);

/**
 * LanguageProvider component
 * Manages global state for languages and provides methods for CRUD operations
 */
export const LanguageProvider = ({ children }) => {
  // State for languages list
  const [languages, setLanguages] = useState([]);
  // Loading state
  const [loading, setLoading] = useState(false);
  // Track if we've already performed an initial successful fetch to guard against remount loops
  const hasFetchedOnceRef = useRef(false);
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
    code: '',
    is_default: null,
  });
  
  const { enqueueSnackbar } = useSnackbar();
  
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
   * Fetch languages with pagination and filters
   * @param {number} page - Page number
   * @param {number} pageSize - Items per page
   * @param {Object} filters - Filter object with field names as keys
   * @param {Array} sortModel - Sorting model from DataGrid
   */
  const fetchLanguages = useCallback(async (page = 1, pageSize = 10, filters = {}, sortModel = []) => {
    // If we've already fetched once and no filters / sorting changed, skip redundant identical call
    if (
      hasFetchedOnceRef.current &&
      languages && languages.length > 0 &&
      (!filters || Object.keys(filters).length === 0) &&
      (!sortModel || sortModel.length === 0) &&
      page === 1
    ) {
      logInfo('LanguageContext', 'Skipping duplicate initial fetchLanguages call (already have data)');
      return;
    }

    setLoading(true);
    setError(null);
    logInfo('Fetching languages with filters:', filters);
    
    try {
      // Build the URL with pagination parameters
      let url = `${API_CONFIG.ENDPOINTS.languages.list}?page=${page}&page_size=${pageSize}`;
      
      // Handle filters according to the backend's expected format
      if (filters && Object.keys(filters).length > 0) {
        logInfo('Processing filters for API request:', filters);
        
        // Convert our filter object to the array format expected by the backend
        // Backend expects a JSON string representing an array of filter objects:
        // e.g., [{"field":"name", "value":"English", "operator":"contains"}]
        const filterArray = [];
        
        Object.entries(filters).forEach(([key, value]) => {
          if (key && value !== undefined && value !== null && value !== '') {
            // Handle string filters
            if (typeof value === 'string' && value.trim() !== '') {
              logInfo(`Processing string filter ${key}:`, value);
              filterArray.push({
                field: key,
                value: value.trim(),
                operator: 'contains'
              });
            }
            // Handle boolean filters
            else if (typeof value === 'boolean') {
              logInfo(`Processing boolean filter ${key}:`, value);
              filterArray.push({
                field: key,
                value: value,
                operator: 'eq'
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
          url += `&json_filter=${encodeURIComponent(filtersJson)}`;
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
      
      logInfo(`Fetching languages from: ${url}`);
      
      // Call the API with our custom URL
      const response = await languageApi.getLanguagesCustom(url);
      
      if (response) {
        // Log the received data
        logInfo(`Received ${response.items?.length || 0} languages out of ${response.total || 0} total`);
        
        // Check actual data received
        const languagesData = response.items || [];
        logInfo(`First 3 languages after filtering: ${JSON.stringify(languagesData.slice(0, 3).map(l => l.name))}`);
        
        // Update state with the response data
        setLanguages(languagesData);
        setPagination({
          page,
          page_size: pageSize,
          total: response.total || 0
        });
  hasFetchedOnceRef.current = true;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      logError('Error fetching languages:', err);
      const errorMessage = err.message || 'Failed to fetch languages';
      setError(errorMessage);
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
      return Promise.reject(err);
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, languages]);

  /**
   * Create a new language
   */
  const createLanguage = useCallback(async (languageData) => {
    setLoading(true);
    clearError();
    
    logInfo('Creating language', languageData);
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add the required fields explicitly to ensure correct field names
      // Make sure we're adding string values, not undefined or null
      formData.append('code', String(languageData.code || '').trim());
      formData.append('name', String(languageData.name || '').trim());

      // Convert boolean to string for form data
      formData.append('is_default', languageData.is_default ? 'true' : 'false');
      formData.append('enabled', languageData.enabled !== undefined ? (languageData.enabled ? 'true' : 'false') : 'true');

      // Add image only if it exists and is a File
      if (languageData.image && languageData.image instanceof File) {
        formData.append('image', languageData.image);
      }

      // Debug logs to help identify issues
      logInfo('Sending form data to server with fields:');
      for (let [key, value] of formData.entries()) {
        logInfo(`- ${key}: ${value instanceof File ? `File: ${value.name}` : value}`);
      }
      
      const response = await languageApi.createLanguage(formData);
      logInfo('Language created successfully', response.data);
      enqueueSnackbar('Language created successfully', { variant: 'success' });
      
      // Refresh language list to include the new item
      await fetchLanguages(1, paginationRef.current.page_size, filtersRef.current);
      return response.data;
    } catch (err) {
      const { message, type } = setErrorWithType(err);
      
      // Add specific handling for conflict errors (duplicate language names)
      if (type === ERROR_TYPES.CONFLICT) {
        logError(`Error creating language - Code conflict:`, message);
      } else {
        logError(`Error creating language (${type}):`, message);
      }
      
      enqueueSnackbar(`Error: ${message}`, { variant: 'error' });
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [fetchLanguages, clearError, setErrorWithType, enqueueSnackbar]);

  /**
   * Update an existing language
   */
  const updateLanguage = useCallback(async (id, languageData) => {
    setLoading(true);
    clearError();
    
    logInfo(`Updating language ${id}`, languageData);
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Only add fields that are provided (for PATCH semantics)
      if (languageData.code !== undefined) {
        formData.append('code', languageData.code);
      }
      
      if (languageData.name !== undefined) {
        formData.append('name', languageData.name);
      }
      
      if (languageData.is_default !== undefined) {
        formData.append('is_default', languageData.is_default ? 'true' : 'false');
      }

      if (languageData.enabled !== undefined) {
        formData.append('enabled', languageData.enabled ? 'true' : 'false');
      }

      // Add image only if it exists and is a File
      if (languageData.image && languageData.image instanceof File) {
        formData.append('image', languageData.image);
      }

      logInfo('Sending form data to server for update:', formData);
      
      const response = await languageApi.updateLanguage(id, formData);
      logInfo(`Language ${id} updated successfully`, response.data);
      enqueueSnackbar('Language updated successfully', { variant: 'success' });
      
      // Refresh language list with current pagination and filters
      await fetchLanguages(paginationRef.current.page, paginationRef.current.page_size, filtersRef.current);
      return response.data;
    } catch (err) {
      const { message, type } = setErrorWithType(err);
      
      // Specific messages based on error type
      if (type === ERROR_TYPES.CONFLICT) {
        logError(`Error updating language ${id} - Code conflict:`, message);
      } else if (type === ERROR_TYPES.NOT_FOUND) {
        logError(`Error updating language ${id} - Not found:`, message);
      } else {
        logError(`Error updating language ${id} (${type}):`, message);
      }
      
      enqueueSnackbar(`Error: ${message}`, { variant: 'error' });
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [fetchLanguages, clearError, setErrorWithType, enqueueSnackbar]);

  /**
   * Delete a language
   */
  const deleteLanguage = useCallback(async (id) => {
    setLoading(true);
    clearError();
    
    logInfo(`Deleting language ${id}`);
    
    try {
      await languageApi.deleteLanguage(id);
      logInfo(`Language ${id} deleted successfully`);
      enqueueSnackbar('Language deleted successfully', { variant: 'success' });
      
      // Refresh languages list. Check if we need to adjust current page.
      const currentPage = paginationRef.current.page;
      const currentPageSize = paginationRef.current.page_size;
      const currentTotal = paginationRef.current.total;
      const newTotal = currentTotal - 1;
      
      // If we're on a page with only one item or deleting the last item would result in an empty page,
      // go back one page (unless we're already on page 1)
      const newPage = (currentPage > 1 && (newTotal % currentPageSize === 0 || languages.length === 1)) 
                     ? currentPage - 1 
                     : currentPage;

      await fetchLanguages(newPage, currentPageSize, filtersRef.current);
      return true;
    } catch (err) {
      const { message, type } = setErrorWithType(err);
      
      // Specific handling for language deletion errors
      if (type === ERROR_TYPES.PERMISSION) {
        // This could be from our custom validation on the backend
        logError(`Cannot delete language ${id} - Default language:`, message);
      } else if (type === ERROR_TYPES.NOT_FOUND) {
        logError(`Error deleting language ${id} - Not found:`, message);
      } else {
        logError(`Error deleting language ${id} (${type}):`, message);
      }
      
      enqueueSnackbar(`Error: ${message}`, { variant: 'error' });
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [fetchLanguages, languages, clearError, setErrorWithType, enqueueSnackbar]);

  /**
   * Update the filter state
   */
  const updateFilters = useCallback((newFilters) => {
    logInfo('Updating language filters in context:', newFilters);
    
    // Ensure the new filters are a different object for re-rendering
    const updatedFilters = { ...newFilters };
    setFilters(updatedFilters);
    
    // Force state update by creating a new state object
    setPagination(prev => ({
      ...prev,
      page: 1  // Reset to first page when filters change
    }));
    
    // Log the resulting filter state
    logInfo('Language filters after update:', updatedFilters);
    
    return updatedFilters;
  }, []);

  /**
   * Context value with memoization to prevent unnecessary renders
   */
  const contextValue = useMemo(() => ({
    languages,
    loading,
    error,
    errorType, // Add error type to context
    pagination,
    setPagination,
    filters,
    fetchLanguages,
    createLanguage,
    updateLanguage,
    deleteLanguage,
    updateFilters, // Use the proper function instead of setFilters
    clearError // Expose error clearing function
  }), [
    languages, loading, error, errorType, pagination, filters,
    fetchLanguages, createLanguage, updateLanguage, deleteLanguage, 
    updateFilters, clearError // Update dependency list
  ]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * Hook to use the language context
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

/**
 * Error boundary component specifically for language-related errors
 */
export class LanguageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError('Language component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="error-container">
          <h2>Something went wrong in the Languages module.</h2>
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

export default LanguageContext; 