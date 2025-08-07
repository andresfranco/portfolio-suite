import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../services/api';

// Create context
const PortfolioContext = createContext();

export function PortfolioProvider({ children }) {
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    name: '',
    description: ''
  });

  const fetchPortfolios = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('PortfolioContext - fetchPortfolios called with raw params:', params);
      
      const requestParams = {
        page: params.page || pagination.page,
        page_size: params.pageSize || pagination.pageSize,
        include_full_details: true
      };

      // Handle name filter separately
      if (params.name) {
        console.log('PortfolioContext - Adding name_filter:', params.name);
        requestParams.name_filter = params.name;
      }

      // Handle description filter separately
      if (params.description) {
        console.log('PortfolioContext - Adding description_filter:', params.description);
        requestParams.description_filter = params.description;
      }

      // Convert filter arrays to backend format
      const filterFields = [];
      const filterValues = [];
      const filterOperators = [];

      // Add other parameters (like sort)
      Object.keys(params).forEach(key => {
        if (!['page', 'pageSize', 'name', 'description'].includes(key)) {
          requestParams[key] = params[key];
        }
      });

      // Add filter arrays to request if we have any filters
      if (filterFields.length > 0) {
        requestParams.filter_field = filterFields;
        requestParams.filter_value = filterValues;
        requestParams.filter_operator = filterOperators;
        console.log('PortfolioContext - Adding filter arrays:', {
          filter_field: filterFields,
          filter_value: filterValues,
          filter_operator: filterOperators
        });
      }

      console.log('PortfolioContext - Final request params being sent to API:', requestParams);
      
      const response = await api.get('/api/portfolios/', { params: requestParams });
      
      console.log('PortfolioContext - API response received:', {
        itemsCount: response.data.items?.length || 0,
        total: response.data.total || 0,
        page: response.data.page || 1
      });
      
      setPortfolios(response.data.items || []);
      setPagination({
        page: response.data.page || 1,
        pageSize: response.data.page_size || 10,
        total: response.data.total || 0
      });
      
      console.log('PortfolioContext - Portfolios fetched successfully:', {
        count: response.data.items?.length || 0,
        total: response.data.total || 0
      });
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to fetch portfolios';
      setError(errorMessage);
      console.error('PortfolioContext - Error fetching portfolios:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize]);

  const createPortfolio = useCallback(async (portfolioData) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('PortfolioContext - Creating portfolio:', portfolioData);
      
      const response = await api.post('/api/portfolios/', portfolioData);
      
      // Refresh the portfolios list
      await fetchPortfolios({ 
        page: pagination.page, 
        pageSize: pagination.pageSize,
        ...filters 
      });
      
      console.log('PortfolioContext - Portfolio created successfully:', response.data);
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create portfolio';
      setError(errorMessage);
      console.error('PortfolioContext - Error creating portfolio:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPortfolios, pagination, filters]);

  const updatePortfolio = useCallback(async (id, portfolioData) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('PortfolioContext - Updating portfolio:', { id, portfolioData });
      
      const response = await api.put(`/api/portfolios/${id}`, portfolioData);
      
      // Refresh the portfolios list
      await fetchPortfolios({ 
        page: pagination.page, 
        pageSize: pagination.pageSize,
        ...filters 
      });
      
      console.log('PortfolioContext - Portfolio updated successfully:', response.data);
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update portfolio';
      setError(errorMessage);
      console.error('PortfolioContext - Error updating portfolio:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPortfolios, pagination, filters]);

  const deletePortfolio = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('PortfolioContext - Deleting portfolio:', { id });
      
      const response = await api.delete(`/api/portfolios/${id}`);
      
      // Refresh the portfolios list
      await fetchPortfolios({ 
        page: pagination.page, 
        pageSize: pagination.pageSize,
        ...filters 
      });
      
      console.log('PortfolioContext - Portfolio deleted successfully:', response.data);
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to delete portfolio';
      setError(errorMessage);
      console.error('PortfolioContext - Error deleting portfolio:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPortfolios, pagination, filters]);

  const updateFilters = useCallback((newFilters) => {
    console.log('PortfolioContext - Updating filters:', newFilters);
    setFilters(newFilters || {});
  }, []);

  const updatePagination = useCallback((newPagination) => {
    console.log('PortfolioContext - Updating pagination:', newPagination);
    setPagination(prevPagination => ({ ...prevPagination, ...newPagination }));
  }, []);

  return (
    <PortfolioContext.Provider 
      value={{ 
        portfolios, 
        loading, 
        error, 
        pagination, 
        filters,
        fetchPortfolios, 
        createPortfolio, 
        updatePortfolio, 
        deletePortfolio,
        updateFilters,
        updatePagination
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

// Custom hook to use the portfolios context
export function usePortfolios() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolios must be used within a PortfolioProvider');
  }
  return context;
} 