import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import skillTypeApi from '../services/skillTypeApi';
import { useAuthorization } from './AuthorizationContext';
import { logInfo, logError } from '../utils/logger';
import { getErrorMessage, getErrorType, getErrorMessageByType, ERROR_TYPES } from '../utils/errorUtils';

// Create context
const SkillTypeContext = createContext(null);

// Custom hook for using the context
export const useSkillType = () => {
  const context = useContext(SkillTypeContext);
  if (!context) {
    throw new Error('useSkillType must be used within a SkillTypeProvider');
  }
  return context;
};

// Provider component
export const SkillTypeProvider = ({ children }) => {
  const { hasPermission } = useAuthorization();
  
  // State for skill types data
  const [skillTypes, setSkillTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  
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

  // Fetch skill types
  const fetchSkillTypes = useCallback(async (page = 0, pageSize = 10, filterParams = {}, sortModel = []) => {
    if (!hasPermission('VIEW_SKILL_TYPES')) {
      setError('You do not have permission to view skill types');
      return;
    }

    setLoading(true);
    clearError();
    
    logInfo('Fetching skill types with filters:', filterParams);
    
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
      
      logInfo('API request options for skill types:', requestOptions);
      
      const response = await skillTypeApi.getSkillTypes(requestOptions);
      
      // Log the structure of the response to debug
      logInfo('Response from getSkillTypes API:', response);
      
      // Handle both response structures: direct or nested in data
      const responseData = response.data || response;
      const skillTypesData = responseData.items || [];
      
      logInfo(`Received ${skillTypesData.length} skill types out of ${responseData.total || 0} total`);
      
      // Log each skill type to debug
      if (skillTypesData.length > 0) {
        logInfo('First few skill types:', skillTypesData.slice(0, 3));
      }
      
      setSkillTypes(skillTypesData);
      setPagination({
        page,
        pageSize,
        total: responseData.total || 0
      });
      
      return skillTypesData;
    } catch (err) {
      logError('Error fetching skill types:', err);
      
      if (err.response?.status === 403) {
        setError('You do not have permission to view skill types');
      } else {
        setErrorWithType(err);
      }
      return Promise.reject(err);
    } finally {
      setLoading(false);
    }
  }, [hasPermission, clearError, setErrorWithType]);

  // Fetch a single skill type by code
  const fetchSkillTypeByCode = useCallback(async (code) => {
    if (!hasPermission('VIEW_SKILL_TYPES')) {
      throw new Error('You do not have permission to view skill types');
    }

    if (!code) {
      logError('fetchSkillTypeByCode: No code provided');
      return null;
    }
    
    setLoading(true);
    clearError();
    
    logInfo(`Fetching skill type with code: ${code}`);
    
    try {
      const response = await skillTypeApi.getSkillTypeById(code);
      
      if (response && response.data) {
        logInfo(`Skill type ${code} fetched successfully`);
        return response.data;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You do not have permission to view skill types');
        throw new Error('You do not have permission to view skill types');
      }
      logError(`Error fetching skill type ${code}:`, err);
      setErrorWithType(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [hasPermission, clearError, setErrorWithType]);

  // Create a new skill type
  const createSkillType = useCallback(async (skillTypeData) => {
    if (!hasPermission('CREATE_SKILL_TYPE')) {
      throw new Error('You do not have permission to create skill types');
    }

    setLoading(true);
    clearError();
    
    logInfo('Creating skill type:', skillTypeData);
    
    try {
      const response = await skillTypeApi.createSkillType(skillTypeData);
      logInfo('Skill type created successfully', response.data);
      
      // Refresh skill types list with current filters
      const currentFilters = filtersRef.current && Object.keys(filtersRef.current).length > 0 ? filtersRef.current : {};
      await fetchSkillTypes(0, paginationRef.current.pageSize, currentFilters);
      
      return response.data;
    } catch (err) {
      if (err.response?.status === 403) {
        throw new Error('You do not have permission to create skill types');
      }
      
      const { message, type } = setErrorWithType(err);
      
      if (type === ERROR_TYPES.CONFLICT) {
        logError(`Error creating skill type - Code conflict:`, message);
      } else {
        logError(`Error creating skill type (${type}):`, message);
      }
      
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [hasPermission, fetchSkillTypes, clearError, setErrorWithType]);

  // Update an existing skill type
  const updateSkillType = useCallback(async (code, skillTypeData) => {
    if (!hasPermission('EDIT_SKILL_TYPE')) {
      throw new Error('You do not have permission to edit skill types');
    }

    setLoading(true);
    clearError();
    
    logInfo(`Updating skill type ${code}:`, skillTypeData);
    
    try {
      const response = await skillTypeApi.updateSkillType(code, skillTypeData);
      logInfo(`Skill type ${code} updated successfully`, response.data);
      
      // Refresh skill types list with current filters
      const currentFilters = filtersRef.current && Object.keys(filtersRef.current).length > 0 ? filtersRef.current : {};
      await fetchSkillTypes(paginationRef.current.page, paginationRef.current.pageSize, currentFilters);
      
      return response.data;
    } catch (err) {
      if (err.response?.status === 403) {
        throw new Error('You do not have permission to edit skill types');
      }
      
      const { message, type } = setErrorWithType(err);
      
      if (type === ERROR_TYPES.CONFLICT) {
        logError(`Error updating skill type ${code} - Code conflict:`, message);
      } else if (type === ERROR_TYPES.NOT_FOUND) {
        logError(`Error updating skill type ${code} - Not found:`, message);
      } else {
        logError(`Error updating skill type ${code} (${type}):`, message);
      }
      
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [hasPermission, fetchSkillTypes, clearError, setErrorWithType]);

  // Delete a skill type
  const deleteSkillType = useCallback(async (code) => {
    if (!hasPermission('DELETE_SKILL_TYPE')) {
      throw new Error('You do not have permission to delete skill types');
    }

    setLoading(true);
    clearError();
    
    logInfo(`Deleting skill type ${code}`);
    
    try {
      await skillTypeApi.deleteSkillType(code);
      logInfo(`Skill type ${code} deleted successfully`);
      
      // Refresh the list, potentially adjusting page if needed
      const currentPage = paginationRef.current.page;
      const currentPageSize = paginationRef.current.pageSize;
      const currentTotal = paginationRef.current.total;
      const newTotal = currentTotal - 1;
      
      // If we're on a page with only one item or deleting the last item would result in an empty page,
      // go back one page (unless we're already on page 0)
      const newPage = (currentPage > 0 && (newTotal % currentPageSize === 0 || skillTypes.length === 1)) 
                     ? currentPage - 1 
                     : currentPage;
      
      // Get current filters
      const currentFilters = filtersRef.current && Object.keys(filtersRef.current).length > 0 ? filtersRef.current : {};
      await fetchSkillTypes(newPage, currentPageSize, currentFilters);
      
      return true;
    } catch (err) {
      if (err.response?.status === 403) {
        throw new Error('You do not have permission to delete skill types');
      }
      
      const { message, type } = setErrorWithType(err);
      
      if (type === ERROR_TYPES.PERMISSION) {
        logError(`Cannot delete skill type ${code} - Skill type in use:`, message);
      } else if (type === ERROR_TYPES.NOT_FOUND) {
        logError(`Error deleting skill type ${code} - Not found:`, message);
      } else {
        logError(`Error deleting skill type ${code} (${type}):`, message);
      }
      
      throw new Error(message, { cause: err });
    } finally {
      setLoading(false);
    }
  }, [hasPermission, fetchSkillTypes, skillTypes, clearError, setErrorWithType]);

  // Check if a skill type code exists
  const checkCodeExists = useCallback(async (code) => {
    if (!hasPermission('VIEW_SKILL_TYPES')) {
      throw new Error('You do not have permission to check skill type codes');
    }

    if (!code || code.trim() === '') {
      return false;
    }
    
    try {
      logInfo(`Checking if skill type code exists: ${code}`);
      const response = await skillTypeApi.checkCodeExists(code);
      logInfo(`Skill type code ${code} exists: ${response.exists}`);
      return response.exists;
    } catch (err) {
      if (err.response?.status === 403) {
        throw new Error('You do not have permission to check skill type codes');
      }
      logError(`Error checking if skill type code exists (${code}):`, err);
      // Return false instead of throwing to not break the form validation
      return false;
    }
  }, [hasPermission]);

  // Update filters and refresh data
  const updateFilters = useCallback((newFilters) => {
    logInfo('Updating skill type filters in context:', newFilters);
    
    // Ensure the new filters are a different object for re-rendering
    const updatedFilters = { ...newFilters };
    setFilters(updatedFilters);
    
    // Force state update by creating a new state object
    setPagination(prev => ({
      ...prev,
      page: 0  // Reset to first page when filters change
    }));
    
    // Log the resulting filter state
    logInfo('Skill type filters after update:', updatedFilters);
    
    return updatedFilters;
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    logInfo('Clearing all skill type filters');
    
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
    
    // Fetch without filters (restore exact same pattern as CategoryTypeContext)
    fetchSkillTypes(0, paginationRef.current.pageSize, {});
  }, [fetchSkillTypes]);

  // Create the context value
  const contextValue = useMemo(() => ({
    skillTypes,
    loading,
    error,
    errorType,
    pagination,
    filters,
    fetchSkillTypes,
    fetchSkillTypeByCode,
    createSkillType,
    updateSkillType,
    deleteSkillType,
    checkCodeExists,
    updateFilters,
    clearFilters,
    clearError
  }), [
    skillTypes, 
    loading, 
    error, 
    errorType,
    pagination, 
    filters,
    fetchSkillTypes,
    fetchSkillTypeByCode, 
    createSkillType, 
    updateSkillType, 
    deleteSkillType,
    checkCodeExists,
    updateFilters,
    clearFilters,
    clearError
  ]);

  return (
    <SkillTypeContext.Provider value={contextValue}>
      {children}
    </SkillTypeContext.Provider>
  );
};

// Error boundary component for skill type related errors
export class SkillTypeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError('SkillType component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Something went wrong in the Skill Types module.</h2>
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

export default SkillTypeContext; 