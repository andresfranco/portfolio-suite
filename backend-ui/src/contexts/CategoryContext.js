import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import categoryApi from '../services/categoryApi';
import { logInfo, logError } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';

// Create context
const CategoryContext = createContext(null);

// Custom hook for using the context
export const useCategory = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategory must be used within a CategoryProvider');
  }
  return context;
};

// Provider component
export const CategoryProvider = ({ children }) => {
  // State for categories data
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 10,
    total: 0
  });
  const [filters, setFilters] = useState([]);
  const [sortModel, setSortModel] = useState([]);

  // Fetch categories with current pagination and filters
  const fetchCategories = useCallback(async (page = 1, page_size = 10, customFilters = null, customSortModel = null) => {
    setLoading(true);
    setError(null);

    // Prepare parameters
    const params = {
      page: page,
      page_size: page_size
    };

    // Add sorting if available
    const sortModelToUse = customSortModel || sortModel;
    if (sortModelToUse && sortModelToUse.length > 0) {
      params.sort_field = sortModelToUse[0].field;
      params.sort_order = sortModelToUse[0].sort;
    }

    // Add filters if available
    const filtersToUse = customFilters !== null ? customFilters : filters;
    if (filtersToUse && filtersToUse.length > 0) {
      // filtersToUse is already in the correct array format from CategoryFilters
      params.filters = filtersToUse.filter(f => 
        f.value !== undefined && 
        f.value !== null && 
        f.field && 
        f.operator &&
        (typeof f.value !== 'string' || f.value.trim() !== '') &&
        (!Array.isArray(f.value) || f.value.length > 0)
      );
    }

    try {
      logInfo('CategoryContext', 'Fetching categories', params);
      const response = await categoryApi.fetchCategories(params);
      
      // Add detailed logging to debug the response
      logInfo('CategoryContext', 'Raw API response received:', response);
      logInfo('CategoryContext', 'Response structure:', {
        hasItems: 'items' in response,
        hasTotal: 'total' in response,
        hasPage: 'page' in response,
        itemsType: typeof response.items,
        itemsLength: response.items?.length,
        totalValue: response.total,
        pageValue: response.page
      });
      
      setCategories(response.items || []);
      setPagination({
        page: response.page || 1,
        pageSize: response.page_size || 10,
        total: response.total || 0
      });
      
      logInfo('CategoryContext', 'Categories fetched successfully', { 
        count: response.items?.length || 0,
        total: response.total || 0,
        page: response.page || 1
      });
      
      return response;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logError('CategoryContext', 'Error fetching categories', error);
      setError(errorMessage);
      return { items: [], total: 0 };
    } finally {
      setLoading(false);
    }
  }, []); // Remove all dependencies to make this stable

  // Create a new category
  const createCategory = useCallback(async (categoryData) => {
    setLoading(true);
    setError(null);
    
    try {
      logInfo('CategoryContext', 'Creating category', { data: categoryData });
      const response = await categoryApi.createCategory(categoryData);
      logInfo('CategoryContext', 'Category created successfully', { id: response.id });
      
      // Refresh the categories list
      await fetchCategories();
      
      return response;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logError('CategoryContext', 'Error creating category', error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchCategories]);

  // Update an existing category
  const updateCategory = useCallback(async (id, categoryData) => {
    setLoading(true);
    setError(null);
    
    try {
      logInfo('CategoryContext', 'Updating category', { id, data: categoryData });
      const response = await categoryApi.updateCategory(id, categoryData);
      logInfo('CategoryContext', 'Category updated successfully', { id });
      
      // Refresh the categories list
      await fetchCategories();
      
      return response;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logError('CategoryContext', 'Error updating category', error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchCategories]);

  // Delete a category
  const deleteCategory = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    
    try {
      logInfo('CategoryContext', 'Deleting category', { id });
      const response = await categoryApi.deleteCategory(id);
      logInfo('CategoryContext', 'Category deleted successfully', { id });
      
      // Refresh the categories list
      await fetchCategories();
      
      return response;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logError('CategoryContext', 'Error deleting category', error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchCategories]);

  // Fetch a single category by ID
  const getCategoryById = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    
    try {
      logInfo('CategoryContext', 'Fetching category by ID', { id });
      const response = await categoryApi.fetchCategoryById(id);
      logInfo('CategoryContext', 'Category fetched successfully', { id });
      return response;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logError('CategoryContext', 'Error fetching category by ID', { id, error });
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if a category code exists
  const checkCodeExists = useCallback(async (code, excludeId = null) => {
    try {
      logInfo('CategoryContext', 'Checking if category code exists', { code, excludeId });
      const response = await categoryApi.checkCategoryCodeExists(code, excludeId);
      logInfo('CategoryContext', 'Category code check completed', { exists: response.exists });
      return response.exists;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logError('CategoryContext', 'Error checking category code', error);
      setError(errorMessage);
      throw error;
    }
  }, []);

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    logInfo('CategoryContext', 'Updating filters', { newFilters });
    setFilters(Array.isArray(newFilters) ? newFilters : []);
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Update pagination
  const updatePagination = useCallback((newPagination) => {
    logInfo('CategoryContext', 'Updating pagination', { newPagination });
    setPagination(prev => ({ ...prev, ...newPagination }));
  }, []);

  // Update sort model
  const updateSortModel = useCallback((newSortModel) => {
    logInfo('CategoryContext', 'Updating sort model', { newSortModel });
    setSortModel(newSortModel);
  }, []);

  // Load categories when component mounts
  useEffect(() => {
    // Initial load - call fetchCategories without dependency to avoid loops
    const initialLoad = async () => {
      setLoading(true);
      setError(null);

      // Prepare parameters for initial load
      const params = {
        page: 1, // Start with page 1
        page_size: 10 // Default page size
      };

      try {
        logInfo('CategoryContext', 'Initial fetch of categories', params);
        const response = await categoryApi.fetchCategories(params);
        
        // Add detailed logging to debug the initial response
        logInfo('CategoryContext', 'Initial raw API response received:', response);
        logInfo('CategoryContext', 'Initial response structure:', {
          hasItems: 'items' in response,
          hasTotal: 'total' in response,
          hasPage: 'page' in response,
          itemsType: typeof response.items,
          itemsLength: response.items?.length,
          totalValue: response.total,
          pageValue: response.page
        });
        
        setCategories(response.items || []);
        setPagination({
          page: response.page || 1,
          pageSize: response.page_size || 10,
          total: response.total || 0
        });
        
        logInfo('CategoryContext', 'Initial categories fetch successful', { 
          count: response.items?.length || 0,
          total: response.total || 0,
          page: response.page || 1
        });
        
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        logError('CategoryContext', 'Error in initial categories fetch', error);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    initialLoad();
  }, []); // Empty dependency array - only run once on mount

  // Note: Manual data fetching is handled by UI components calling fetchCategories when needed
  // Auto-fetch effects were removed to prevent infinite loops

  // Context value
  const value = useMemo(() => ({
    categories,
    loading,
    error,
    pagination,
    filters,
    sortModel,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    checkCodeExists,
    updateFilters,
    updatePagination,
    updateSortModel
  }), [
    categories,
    loading,
    error,
    pagination,
    filters,
    sortModel,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    checkCodeExists,
    updateFilters,
    updatePagination,
    updateSortModel
  ]);

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
};

export default CategoryContext; 