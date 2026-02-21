import React, { createContext, useContext, useState, useCallback } from 'react';
import experienceApi from '../services/experienceApi';
import { useAuthorization } from './AuthorizationContext';
import { logInfo, logError } from '../utils/logger';

// Create the context
const ExperienceContext = createContext();

// Helper function to get error message
const getErrorMessage = (error) => {
  if (error?.response?.data?.detail) {
    if (Array.isArray(error.response.data.detail)) {
      return error.response.data.detail.map(item => item.msg || item).join(', ');
    }
    return error.response.data.detail;
  }
  if (error?.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

// Provider component
export const ExperienceProvider = ({ children }) => {
  const { hasPermission } = useAuthorization();
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0
  });

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters || {});
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Fetch experiences with pagination, filtering, and sorting
  const fetchExperiences = useCallback(async (page = 1, pageSize = 10, customFilters = null, customSortModel = null) => {
    // Check permission before making API call
    if (!hasPermission('VIEW_EXPERIENCES')) {
      const errorMessage = 'You do not have permission to view experiences';
      setError(errorMessage);
      return { items: [], total: 0 };
    }

    setLoading(true);
    setError(null);

    // Build params for the API call
    const params = {
      page,
      page_size: pageSize
    };

    // Add filters if provided
    if (customFilters && Object.keys(customFilters).length > 0) {
      // Convert filters object to array format for API
      const filtersArray = [];
      Object.entries(customFilters).forEach(([field, value]) => {
        if (field === 'language_id' && Array.isArray(value) && value.length > 0) {
          // Handle language_id array - create a filter for each language
          value.forEach(langId => {
            if (langId && langId.toString().trim() !== '') {
              filtersArray.push({
                field: 'language_id',
                value: langId.toString().trim(),
                operator: 'equals'
              });
            }
          });
        } else if (value && value.toString().trim() !== '') {
          filtersArray.push({
            field: field,
            value: value.toString().trim(),
            operator: 'contains'
          });
        }
      });
      
      if (filtersArray.length > 0) {
        params.filters = filtersArray;
      }
    }

    // Add sorting if provided
    if (customSortModel && customSortModel.length > 0) {
      const sortItem = customSortModel[0];
      params.sort_field = sortItem.field;
      params.sort_order = sortItem.sort;
    }

    try {
      logInfo('ExperienceContext', 'Fetching experiences', params);
      const response = await experienceApi.fetchExperiences(params);
      
      // Add detailed logging to debug the response
      logInfo('ExperienceContext', 'Raw API response received:', response);
      logInfo('ExperienceContext', 'Response structure:', {
        hasItems: 'items' in response,
        hasTotal: 'total' in response,
        hasPage: 'page' in response,
        itemsType: typeof response.items,
        itemsLength: response.items?.length,
        totalValue: response.total,
        pageValue: response.page
      });
      
      setExperiences(response.items || []);
      setPagination({
        page: page,
        pageSize: pageSize,
        total: response.total || 0
      });
      
      logInfo('ExperienceContext', 'Experiences fetched successfully', { 
        count: response.items?.length || 0,
        total: response.total || 0,
        page: response.page || 1
      });
      
      return response;
    } catch (error) {
      let errorMessage = getErrorMessage(error);
      if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to view experiences';
      }
      logError('ExperienceContext', 'Error fetching experiences', error);
      setError(errorMessage);
      return { items: [], total: 0 };
    } finally {
      setLoading(false);
    }
  }, [hasPermission]); // Remove all dependencies to make this stable

  // Create a new experience
  const createExperience = useCallback(async (experienceData) => {
    if (!hasPermission('CREATE_EXPERIENCE')) {
      throw new Error('You do not have permission to create experiences');
    }

    setLoading(true);
    setError(null);
    
    try {
      logInfo('ExperienceContext', 'Creating experience', { data: experienceData });
      const response = await experienceApi.createExperience(experienceData);
      logInfo('ExperienceContext', 'Experience created successfully', { id: response.id });
      
      // Don't automatically refresh here - let the UI component handle it
      // await fetchExperiences();
      
      return response;
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to create experiences');
      }
      const errorMessage = getErrorMessage(error);
      logError('ExperienceContext', 'Error creating experience', error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  // Update an existing experience
  const updateExperience = useCallback(async (id, experienceData) => {
    if (!hasPermission('EDIT_EXPERIENCE')) {
      throw new Error('You do not have permission to edit experiences');
    }

    setLoading(true);
    setError(null);
    
    try {
      logInfo('ExperienceContext', 'Updating experience', { id, data: experienceData });
      const response = await experienceApi.updateExperience(id, experienceData);
      logInfo('ExperienceContext', 'Experience updated successfully', { id: response.id });
      
      // Don't automatically refresh here - let the UI component handle it
      // await fetchExperiences();
      
      return response;
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to edit experiences');
      }
      const errorMessage = getErrorMessage(error);
      logError('ExperienceContext', 'Error updating experience', error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  // Delete an experience
  const deleteExperience = useCallback(async (id) => {
    if (!hasPermission('DELETE_EXPERIENCE')) {
      throw new Error('You do not have permission to delete experiences');
    }

    setLoading(true);
    setError(null);
    
    try {
      logInfo('ExperienceContext', 'Deleting experience', { id });
      const response = await experienceApi.deleteExperience(id);
      logInfo('ExperienceContext', 'Experience deleted successfully', { id });
      
      // Don't automatically refresh here - let the UI component handle it
      // await fetchExperiences();
      
      return response;
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to delete experiences');
      }
      const errorMessage = getErrorMessage(error);
      logError('ExperienceContext', 'Error deleting experience', error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  // Get a single experience by ID
  const getExperience = useCallback(async (id) => {
    // Check permission before making API call
    if (!hasPermission('VIEW_EXPERIENCES')) {
      const errorMessage = 'You do not have permission to view experiences';
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    setLoading(true);
    setError(null);
    
    try {
      logInfo('ExperienceContext', 'Fetching experience by ID', { id });
      const response = await experienceApi.fetchExperienceById(id);
      logInfo('ExperienceContext', 'Experience fetched successfully', { id: response.id });
      return response;
    } catch (error) {
      let errorMessage = getErrorMessage(error);
      if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to view experiences';
      }
      logError('ExperienceContext', 'Error fetching experience', error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  // Check if a code already exists
  const checkCodeExists = useCallback(async (code, excludeId = null) => {
    try {
      logInfo('ExperienceContext', 'Checking code existence', { code, excludeId });
      const response = await experienceApi.checkCodeExists(code, excludeId);
      logInfo('ExperienceContext', 'Code check completed', { code, exists: response.exists });
      return response;
    } catch (error) {
      logError('ExperienceContext', 'Error checking code existence', error);
      // Don't set global error for this operation
      throw error;
    }
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset all state
  const resetState = useCallback(() => {
    setExperiences([]);
    setLoading(false);
    setError(null);
    setFilters({});
    setPagination({
      page: 1,
      pageSize: 10,
      total: 0
    });
  }, []);

  // Context value
  const value = {
    // State
    experiences,
    loading,
    error,
    pagination,
    filters,
    
    // Actions
    fetchExperiences,
    createExperience,
    updateExperience,
    deleteExperience,
    getExperience,
    checkCodeExists,
    clearError,
    resetState,
    updateFilters,
    clearFilters
  };

  return (
    <ExperienceContext.Provider value={value}>
      {children}
    </ExperienceContext.Provider>
  );
};

// Custom hook to use the experience context
export const useExperience = () => {
  const context = useContext(ExperienceContext);
  if (!context) {
    throw new Error('useExperience must be used within an ExperienceProvider');
  }
  return context;
};

// Export the context for advanced usage
export default ExperienceContext; 