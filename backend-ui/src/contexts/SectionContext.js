import React, { createContext, useContext, useState, useCallback } from 'react';
import { sectionsApi } from '../services/api';
import { logInfo, logError } from '../utils/logger';

// Create context
const SectionContext = createContext();

export function SectionProvider({ children }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({});

  const fetchSections = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      // Normalize pagination params to match backend expectations
      const apiParams = {
        ...params,
        page: params.page ?? 1,
        page_size: params.page_size ?? params.pageSize ?? pagination.pageSize ?? 10,
      };
      // Remove camelCase pageSize to avoid confusion
      if (apiParams.pageSize !== undefined) delete apiParams.pageSize;

      logInfo('SectionContext', 'Fetching sections with params (normalized):', apiParams);
      
      const response = await sectionsApi.getSections(apiParams);
      
      logInfo('SectionContext', 'Sections fetched successfully:', {
        itemsCount: response.data.items?.length || 0,
        total: response.data.total
      });
      
    setSections(response.data.items || []);
      
    // Only update the total from response, keep page and pageSize from params to avoid overriding user choices
      setPagination(prevPagination => {
        const newPaginationState = {
          ...prevPagination,
      page: (params.page ?? prevPagination.page ?? 1),
      pageSize: (params.pageSize ?? params.page_size ?? prevPagination.pageSize ?? 10),
          total: response.data.total || 0
        };
        logInfo('SectionContext', 'fetchSections updating pagination:', {
          prevPagination,
      params,
      apiParams,
          responseTotal: response.data.total,
          newPaginationState
        });
        return newPaginationState;
      });
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to fetch sections';
      logError('SectionContext', 'Error fetching sections:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize]);

  const createSection = useCallback(async (sectionData) => {
    try {
      setLoading(true);
      setError(null);
      
      logInfo('SectionContext', 'Creating section:', sectionData);
      
      const response = await sectionsApi.createSection(sectionData);
      
      logInfo('SectionContext', 'Section created successfully:', response.data);
      
      // Refresh the sections list
      await fetchSections({ 
        page: pagination.page, 
        pageSize: pagination.pageSize,
        ...filters 
      });
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create section';
      logError('SectionContext', 'Error creating section:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchSections, pagination, filters]);

  const updateSection = useCallback(async (id, sectionData) => {
    try {
      setLoading(true);
      setError(null);
      
      logInfo('SectionContext', 'Updating section:', { id, data: sectionData });
      
      const response = await sectionsApi.updateSection(id, sectionData);
      
      logInfo('SectionContext', 'Section updated successfully:', response.data);
      
      // Refresh the sections list
      await fetchSections({ 
        page: pagination.page, 
        pageSize: pagination.pageSize,
        ...filters 
      });
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update section';
      logError('SectionContext', 'Error updating section:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchSections, pagination, filters]);

  const deleteSection = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);
      
      logInfo('SectionContext', 'Deleting section:', id);
      
      const response = await sectionsApi.deleteSection(id);
      
      logInfo('SectionContext', 'Section deleted successfully');
      
      // Refresh the sections list
      await fetchSections({ 
        page: pagination.page, 
        pageSize: pagination.pageSize,
        ...filters 
      });
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to delete section';
      logError('SectionContext', 'Error deleting section:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchSections, pagination, filters]);

  const updateFilters = useCallback((newFilters) => {
    logInfo('SectionContext', 'Updating filters:', newFilters);
    setFilters(newFilters);
  }, []);

  const updatePagination = useCallback((newPagination) => {
    logInfo('SectionContext', 'Updating pagination:', { 
      newPagination, 
      currentPagination: pagination 
    });
    setPagination(prevPagination => {
      const updatedPagination = {
        ...prevPagination,
        page: newPagination.page ?? prevPagination.page,
        pageSize: (newPagination.pageSize ?? newPagination.page_size ?? prevPagination.pageSize)
      };
      logInfo('SectionContext', 'Pagination updated to:', updatedPagination);
      return updatedPagination;
    });
  }, [pagination]);

  const clearFilters = useCallback(() => {
    logInfo('SectionContext', 'Clearing filters');
    setFilters({});
  }, []);

  return (
    <SectionContext.Provider 
      value={{ 
        sections,
        loading, 
        error, 
        pagination,
        filters,
        fetchSections, 
        createSection, 
        updateSection, 
        deleteSection,
        updateFilters,
        updatePagination,
        clearFilters
      }}
    >
      {children}
    </SectionContext.Provider>
  );
}

// Custom hook to use the section context
export function useSections() {
  const context = useContext(SectionContext);
  if (!context) {
    throw new Error('useSections must be used within a SectionProvider');
  }
  return context;
} 