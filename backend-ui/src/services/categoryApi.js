import { API_CONFIG } from '../config/apiConfig';
import { logInfo, logError } from '../utils/logger';
import { api } from './api';

const BASE_URL = `${API_CONFIG.BASE_URL}/api/categories`;

/**
 * Fetch categories with pagination and optional filtering
 * 
 * @param {Object} params - Query parameters for the request
 * @returns {Promise<Object>} - Promise resolving to the API response
 */
export const fetchCategories = async (params = {}) => {
  try {
    logInfo('categoryApi', 'Fetching categories', params);
    
    // Extract filters from params if they exist
    const { filters, ...restParams } = params;
    
    // Prepare query parameters
    const queryParams = new URLSearchParams();
    
    // Add standard pagination and sorting parameters
    Object.entries(restParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    
    // Handle filters if provided
    if (filters && Array.isArray(filters) && filters.length > 0) {
      // Convert filters array to JSON string
      queryParams.append('filters', JSON.stringify(filters));
    }
    
    // Build the URL with query parameters
    const url = `/api/categories?${queryParams.toString()}`;
    
    const response = await api.get(url);
    
    // FIX: Extract the actual data from the axios response
    // The response structure is { data: { items: [...], total: N, page: N, page_size: N }, status: 200, ... }
    // We need to return response.data, not response
    const data = response.data;
    
    logInfo('categoryApi', 'Categories fetched successfully', { 
      count: data.items?.length,
      total: data.total,
      page: data.page
    });
    
    return data; // Return the data directly, not the full axios response
  } catch (error) {
    logError('categoryApi', 'Error fetching categories', error);
    throw error;
  }
};

/**
 * Fetch a single category by ID
 * 
 * @param {number} id - Category ID
 * @returns {Promise<Object>} - Promise resolving to the category data
 */
export const fetchCategoryById = async (id) => {
  try {
    logInfo('categoryApi', 'Fetching category by ID', { id });
    const response = await api.get(`/api/categories/${id}`);
    logInfo('categoryApi', 'Category fetched successfully', { id });
    return response.data; // Return data, not full response
  } catch (error) {
    logError('categoryApi', 'Error fetching category by ID', { id, error });
    throw error;
  }
};

/**
 * Create a new category
 * 
 * @param {Object} categoryData - Category data to create
 * @returns {Promise<Object>} - Promise resolving to the created category
 */
export const createCategory = async (categoryData) => {
  try {
    logInfo('categoryApi', 'Creating category', { data: categoryData });
    const response = await api.post('/api/categories', categoryData);
    logInfo('categoryApi', 'Category created successfully', { id: response.data.id });
    return response.data; // Return data, not full response
  } catch (error) {
    logError('categoryApi', 'Error creating category', error);
    throw error;
  }
};

/**
 * Update an existing category
 * 
 * @param {number} id - Category ID to update
 * @param {Object} categoryData - Updated category data
 * @returns {Promise<Object>} - Promise resolving to the updated category
 */
export const updateCategory = async (id, categoryData) => {
  try {
    logInfo('categoryApi', 'Updating category', { id, data: categoryData });
    const response = await api.put(`/api/categories/${id}`, categoryData);
    logInfo('categoryApi', 'Category updated successfully', { id });
    return response.data; // Return data, not full response
  } catch (error) {
    logError('categoryApi', 'Error updating category', error);
    throw error;
  }
};

/**
 * Delete a category
 * 
 * @param {number} id - Category ID to delete
 * @returns {Promise<Object>} - Promise resolving to the API response
 */
export const deleteCategory = async (id) => {
  try {
    logInfo('categoryApi', 'Deleting category', { id });
    const response = await api.delete(`/api/categories/${id}`);
    logInfo('categoryApi', 'Category deleted successfully', { id });
    return response.data; // Return data, not full response
  } catch (error) {
    logError('categoryApi', 'Error deleting category', error);
    throw error;
  }
};

/**
 * Check if a category code already exists
 * 
 * @param {string} code - Category code to check
 * @param {number} excludeId - Optional ID to exclude from the check
 * @returns {Promise<boolean>} - Promise resolving to whether the code exists
 */
export const checkCategoryCodeExists = async (code, excludeId = null) => {
  try {
    logInfo('categoryApi', 'Checking if category code exists', { code, excludeId });
    const url = `/api/categories/check-code/${code}${excludeId ? `?category_id=${excludeId}` : ''}`;
    const response = await api.get(url);
    logInfo('categoryApi', 'Category code check completed', { exists: response.data.exists });
    return response.data; // Return data, not full response
  } catch (error) {
    logError('categoryApi', 'Error checking category code', error);
    throw error;
  }
};

const categoryApi = {
  fetchCategories,
  fetchCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  checkCategoryCodeExists
};

export default categoryApi; 