import { api } from './api';
import { logError, logInfo } from '../utils/logger';
import { API_CONFIG } from '../config/apiConfig';

/**
 * User API service
 * This service handles all API interactions related to users
 */
const userApi = {
  /**
   * Get users with pagination, filtering and sorting
   * @param {Object} params - Request parameters including page, page_size, filters, sort_by, sort_order
   * @returns {Promise} - Response from API
   */
  getUsers: async (params = {}) => {
    const {
      page = 1,
      pageSize,
      page_size = pageSize,
      sort_by,
      sort_order,
      filter_field,
      filter_value,
      filter_operator,
      ...otherParams
    } = params;

    console.log('userApi.getUsers - Raw params:', params);
    console.log('userApi.getUsers - Extracted page_size:', page_size);

    // Initialize request parameters
    const requestParams = {
      page,
      page_size: page_size,
      ...otherParams
    };

    console.log('userApi.getUsers - Using page_size:', requestParams.page_size);

    // Handle sorting if provided
    if (sort_by && sort_order) {
      requestParams.sort_field = sort_by;
      requestParams.sort_order = sort_order;
    }

    // Process filters if provided
    if ((filter_field && filter_value) || 
        params.roles || params.username || 
        params.email || params.is_active !== undefined) {
      
      // Initialize filters array
      const filters = [];
      
      // Handle explicit filter arrays if provided
      if (filter_field && filter_value) {
        // Convert to arrays if they aren't already
        const fields = Array.isArray(filter_field) ? filter_field : [filter_field];
        const values = Array.isArray(filter_value) ? filter_value : [filter_value];
        const operators = Array.isArray(filter_operator) ? filter_operator : [filter_operator || 'eq'];
        
        // Create filter objects for each field/value pair
        for (let i = 0; i < fields.length; i++) {
          if (fields[i] && values[i] !== undefined && values[i] !== '') {
            filters.push({
              field: fields[i],
              value: values[i],
              operator: operators[i] || 'eq'
            });
          }
        }
      }
      
      // Handle specific filter fields
      if (params.username) {
        filters.push({
          field: 'username',
          value: params.username,
          operator: 'contains'
        });
      }
      
      if (params.email) {
        filters.push({
          field: 'email',
          value: params.email,
          operator: 'contains'
        });
      }
      
      if (params.is_active !== undefined) {
        filters.push({
          field: 'is_active',
          value: String(params.is_active), // Ensure is_active is a string
          operator: 'eq'
        });
      }
      
      // Handle roles filter - support both simple id and array of ids
      if (params.roles) {
        if (Array.isArray(params.roles) && params.roles.length > 0) {
          console.log('userApi.getUsers - Processing roles array:', params.roles);
          // Use 'in' operator for array of role IDs
          filters.push({
            field: 'roles.id',
            value: params.roles.map(id => Number(id)), // Ensure IDs are numbers
            operator: 'in'
          });
        } else if (!Array.isArray(params.roles) && params.roles) {
          // Single role ID
          filters.push({
            field: 'roles.id',
            value: Number(params.roles), // Ensure ID is a number
            operator: 'eq'
          });
        }
      }
      
      console.log('userApi.getUsers - Built filters array:', filters);
      
      // Add filters to request params as JSON string
      if (filters.length > 0) {
        requestParams.filters = JSON.stringify(filters);
      }
    }
    
    console.log('userApi.getUsers - Final request params:', requestParams);
    
    try {
      const response = await api.get(`${API_CONFIG.ENDPOINTS.users.list}/`, { params: requestParams });
      console.log('userApi.getUsers - Response:', response.data);
      console.log('userApi.getUsers - Response page_size/pageSize:', { 
        page_size: response.data.page_size,
        pageSize: response.data.pageSize,
        requestedSize: page_size,
        actualItems: response.data.items?.length
      });
      return response;
    } catch (error) {
      console.error('Error fetching users:', error);
      logError('Error fetching users', error);
      throw error;
    }
  },

  /**
   * Get a specific user by ID
   * @param {number} id - User ID
   * @returns {Promise} - Response from API
   */
  getUserById: (id) => api.get(API_CONFIG.ENDPOINTS.users.detail.replace(':id', id)),

  /**
   * Create a new user
   * @param {Object} data - User data to create (username, email, password, roles, is_active)
   * @returns {Promise} - Response from API
   */
  createUser: (data) => api.post(`${API_CONFIG.ENDPOINTS.users.list}/`, data),

  /**
   * Update an existing user
   * @param {number} id - User ID to update
   * @param {Object} data - User data to update (email, password, roles, is_active)
   * @returns {Promise} - Response from API
   */
  updateUser: (id, data) => {
    // Ensure id is a number rather than an object to prevent [object Object] in URL
    id = Number(id);
    if (isNaN(id)) {
      throw new Error('Invalid user ID provided');
    }
    
    // Log the request details
    logInfo(`Updating user ${id} with data:`, data);
    
    // Ensure is_active is a boolean before sending
    const userData = {
      ...data,
      is_active: Boolean(data.is_active)
    };
    
    return api.put(API_CONFIG.ENDPOINTS.users.detail.replace(':id', id), userData);
  },

  /**
   * Delete a user
   * @param {number} id - User ID to delete
   * @returns {Promise} - Response from API
   */
  deleteUser: (id) => api.delete(API_CONFIG.ENDPOINTS.users.detail.replace(':id', id)),

  /**
   * Check username availability
   */
  checkUsername: (username, excludeUserId) => {
    const params = { username };
    if (excludeUserId) params.exclude_user_id = excludeUserId;
    return api.get(`${API_CONFIG.ENDPOINTS.users.list}/check-username`, { params });
  },

  /**
   * Get current user's information
   * @returns {Promise} - Response from API with current user data
   */
  getCurrentUser: async () => {
    try {
      logInfo('Fetching current user information');
      const response = await api.get(`${API_CONFIG.ENDPOINTS.users.list}/me`);
      return response;
    } catch (error) {
      logError('Error fetching current user:', error);
      throw error;
    }
  },

  /**
   * Change current user's own password (self-service)
   * @param {Object} data - Contains old_password, new_password, and confirm_password
   * @returns {Promise} - Response from API
   */
  changeOwnPassword: async (data) => {
    try {
      logInfo('Changing own password');
      const response = await api.post(`${API_CONFIG.ENDPOINTS.users.list}/me/change-password`, data);
      return response;
    } catch (error) {
      logError('Error changing own password:', error);
      throw error;
    }
  },

  /**
   * Change user password (admin function)
   * @param {Object} data - Contains username, password, and password_confirmation
   * @returns {Promise} - Response from API
   */
  // Change a user's password (requires user ID path segment)
  // data should include username, password, password_confirmation
  changePassword: (userId, data) => {
    // Ensure numeric id to avoid accidental [object Object]
    userId = Number(userId);
    if (isNaN(userId)) {
      throw new Error('Invalid user ID provided for changePassword');
    }
    return api.post(`${API_CONFIG.ENDPOINTS.users.list}/${userId}/change-password`, data);
  },

  /**
   * Get all roles (for user role assignment)
   * @returns {Promise} - Response from API
   */
  getRoles: () => api.get(`${API_CONFIG.ENDPOINTS.roles.list}/`),

  /**
   * Request password reset (forgot password)
   * @param {string} email - User's email
   * @returns {Promise} - Response from API
   */
  forgotPassword: async (email) => {
    try {
      logInfo(`Requesting password reset for email: ${email}`);
      const response = await api.post(`${API_CONFIG.ENDPOINTS.users.list}/forgot-password`, { email });
      
      logInfo(`Password reset request processed for email: ${email}`);
      return response;
    } catch (error) {
      logError(`Error requesting password reset for email ${email}:`, error);
      throw error;
    }
  }
};

export default userApi;