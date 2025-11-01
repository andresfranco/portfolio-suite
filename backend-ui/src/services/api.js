import axios from 'axios';
import SERVER_URL from '../components/common/BackendServerData';
import { API_CONFIG } from '../config/apiConfig';
import { logInfo, logError, logDebug } from '../utils/logger';
import { isTokenExpired } from '../utils/jwt';

/**
 * Determines if an error is likely an authentication error
 * @param {Object} error - The error object
 * @returns {boolean} - Whether the error is likely an authentication error
 */
const isLikelyAuthError = (error) => {
  // Check for 401 status code
  if (error.response?.status === 401) return true;
  
  // Check for 500 errors from login endpoint - use more precise check
  if (error.response?.status === 500 && 
      error.config?.url?.includes('/login')) {
    return true;
  }
  
  return false;
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: SERVER_URL || 'http://localhost:8000',
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true, // Important: Send cookies with every request
  headers: {
    'Content-Type': 'application/json',
    ...API_CONFIG.HEADERS
  },
  paramsSerializer: {
    indexes: null // This ensures arrays are sent as multiple parameters: ?key=val1&key=val2
  }
});

// Create a separate axios instance for CSRF refresh to avoid interceptor recursion
const csrfRefreshInstance = axios.create({
  baseURL: SERVER_URL || 'http://localhost:8000',
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true, // Important: Send cookies with every request
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for CSRF token
api.interceptors.request.use(
  (config) => {
    const csrfToken = localStorage.getItem('csrf_token');
    logDebug('API Request Interceptor:', {
      url: config.url,
      method: config.method,
      csrfTokenExists: !!csrfToken,
      headers: config.headers,
      isFormData: config.data instanceof FormData
    });
    
    // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
    const stateMutatingMethods = ['post', 'put', 'delete', 'patch'];
    if (csrfToken && stateMutatingMethods.includes(config.method?.toLowerCase())) {
      config.headers['X-CSRF-Token'] = csrfToken;
      logDebug('CSRF token added to request');
    }
    
    // Handle FormData: Remove Content-Type to let axios/browser set it with boundary
    if (config.data instanceof FormData) {
      // Delete the Content-Type header to let browser set it with proper boundary
      delete config.headers['Content-Type'];
      logDebug('FormData detected, removed Content-Type header for proper boundary');
    }
    
    // Note: Access token is now in httpOnly cookie, sent automatically by browser
    // No need to manually add Authorization header
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
let isRefreshing = false;
let refreshPromise = null;

/**
 * Check if the 401 error is due to password verification failure (not token expiry)
 * These errors should NOT trigger token refresh
 */
const isPasswordVerificationError = (error) => {
  const { config, response } = error || {};
  
  // Check if it's an MFA endpoint with password verification
  const isMfaEndpoint = config?.url?.includes('/api/mfa/');
  const isAccountSecurityEndpoint = config?.url?.includes('/api/account/');
  
  // Check if the error message indicates password verification failure
  const errorDetail = response?.data?.detail || '';
  const isPasswordError = errorDetail.toLowerCase().includes('password') || 
                          errorDetail.toLowerCase().includes('invalid password');
  
  return (isMfaEndpoint || isAccountSecurityEndpoint) && isPasswordError;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error || {};
    if (!response) return Promise.reject(error);
    
    // Handle CSRF token validation failures (403) by refreshing tokens
    // The refresh endpoint will provide a new CSRF token
    if (response.status === 403 && 
        response.data?.code === 'CSRF_VALIDATION_FAILED') {
      logDebug('CSRF validation failed, refreshing tokens to get new CSRF token');
      
      // Avoid infinite loop
      if (config && config._csrfRetry) {
        logError('CSRF refresh already attempted, giving up');
        return Promise.reject(error);
      }
      
      // Check if we're authenticated (refresh token is in httpOnly cookie)
      const isAuth = localStorage.getItem('isAuthenticated');
      if (!isAuth) {
        logError('Not authenticated, cannot refresh CSRF token');
        localStorage.removeItem('csrf_token');
        return Promise.reject(error);
      }
      
      try {
        // Refresh tokens - this will give us a new CSRF token
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = csrfRefreshInstance.post(API_CONFIG.ENDPOINTS.auth.refreshToken, {})
            .then((res) => {
              // Update CSRF token from refresh response
              if (res.data?.csrf_token) {
                localStorage.setItem('csrf_token', res.data.csrf_token);
                logInfo('CSRF token refreshed via token refresh');
                return res.data.csrf_token;
              }
              return null;
            })
            .finally(() => {
              isRefreshing = false;
            });
        }
        
        const newCsrfToken = await refreshPromise;
        
        if (newCsrfToken) {
          // Retry original request with new CSRF token
          const retryConfig = { 
            ...config, 
            _csrfRetry: true,
            headers: {
              ...(config.headers || {}),
              'X-CSRF-Token': newCsrfToken
            }
          };
          
          return api.request(retryConfig);
        } else {
          logError('Failed to get CSRF token from refresh response');
          return Promise.reject(error);
        }
      } catch (refreshError) {
        logError('Token refresh failed for CSRF update:', refreshError);
        localStorage.removeItem('csrf_token');
        localStorage.removeItem('isAuthenticated');
        return Promise.reject(error);
      }
    }
    
    // Handle authentication failures (401)
    if (response.status !== 401) return Promise.reject(error);

    // Don't try to refresh token for password verification errors
    if (isPasswordVerificationError(error)) {
      logDebug('Password verification failed, not attempting token refresh');
      return Promise.reject(error);
    }

    // Avoid infinite loop
    if (config && config._retry) {
      // Finalize: clear authentication state
      localStorage.removeItem('csrf_token');
      localStorage.removeItem('isAuthenticated');
      return Promise.reject(error);
    }

    // Check if we're authenticated (refresh token is in httpOnly cookie)
    const isAuth = localStorage.getItem('isAuthenticated');
    if (!isAuth) {
      localStorage.removeItem('csrf_token');
      return Promise.reject(error);
    }

    try {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = csrfRefreshInstance.post(API_CONFIG.ENDPOINTS.auth.refreshToken,
          {}
        ).then((res) => {
          // Update CSRF token if provided
          if (res.data?.csrf_token) {
            localStorage.setItem('csrf_token', res.data.csrf_token);
          }
          return res.data?.success;
        }).finally(() => {
          isRefreshing = false;
        });
      }

      const success = await refreshPromise;
      if (success) {
        // Retry original request once (new token is in cookie)
        const retryConfig = { ...config, _retry: true };
        // Update CSRF token header if needed
        const csrfToken = localStorage.getItem('csrf_token');
        if (csrfToken) {
          retryConfig.headers = {
            ...(config.headers || {}),
            'X-CSRF-Token': csrfToken,
          };
        }
        return api.request(retryConfig);
      }
    } catch (e) {
      logError('Token refresh failed in api client:', e);
      localStorage.removeItem('csrf_token');
      localStorage.removeItem('isAuthenticated');
    }

    return Promise.reject(error);
  }
);

// Projects API
const projectsApi = {
  getProjects: (params) => api.get('/api/projects/', { params }),
  getProjectById: (id) => api.get(`/api/projects/${id}`),
  createProject: (data) => api.post('/api/projects/', data),
  updateProject: (id, data) => api.put(`/api/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/api/projects/${id}`),
  
  // Project images
  getProjectImages: (projectId) => api.get(`/api/projects/${projectId}/images/`),
  uploadProjectImage: (projectId, formData) => api.post(`/api/projects/${projectId}/images/`, formData),
  updateProjectImage: (projectId, imageId, formData) => api.put(`/api/projects/${projectId}/images/${imageId}`, formData),
  deleteProjectImage: (projectId, imageId) => api.delete(`/api/projects/${projectId}/images/${imageId}`),
  
  // Project attachments
  getProjectAttachments: (projectId) => api.get(`/api/projects/${projectId}/attachments/`),
  uploadProjectAttachment: (projectId, formData) => api.post(`/api/projects/${projectId}/attachments/`, formData),
  deleteProjectAttachment: (projectId, attachmentId) => api.delete(`/api/projects/${projectId}/attachments/${attachmentId}`),
  
  // Portfolio image methods
  getPortfolioImages: (portfolioId) => api.get(`/api/portfolios/${portfolioId}/images`),
  uploadPortfolioImage: (portfolioId, file, category, languageId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    
    // Build URL with query parameters
    let url = `/api/portfolios/${portfolioId}/images`;
    const params = new URLSearchParams();
    params.append('category', category);
    if (languageId) {
      console.log('Adding language_id to params:', languageId, 'Type:', typeof languageId);
      params.append('language_id', languageId);
    } else {
      console.log('No language_id provided, languageId is:', languageId);
    }
    url += `?${params.toString()}`;
    console.log('Final upload URL:', url);
    
    return api.post(url, formData);
  },
  deletePortfolioImage: (portfolioId, imageId) => api.delete(`/api/portfolios/${portfolioId}/images/${imageId}`),
  renamePortfolioImage: (portfolioId, imageId, updateData) => api.put(`/api/portfolios/${portfolioId}/images/${imageId}`, updateData),

  // Portfolio attachment methods
  getPortfolioAttachments: (portfolioId) => api.get(`/api/portfolios/${portfolioId}/attachments`),
  uploadPortfolioAttachment: (portfolioId, file, categoryId = null, isDefault = false, languageId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // Build URL with query parameters
    let url = `/api/portfolios/${portfolioId}/attachments`;
    const params = new URLSearchParams();
    if (categoryId) {
      params.append('category_id', categoryId);
    }
    if (isDefault) {
      params.append('is_default', 'true');
    }
    if (languageId) {
      params.append('language_id', languageId);
    }
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return api.post(url, formData);
  },
  updatePortfolioAttachment: (portfolioId, attachmentId, categoryId = null, isDefault = null, languageId = null) => {
    const params = new URLSearchParams();
    // Only add params if they have actual values (not null, undefined, or empty string)
    if (categoryId !== null && categoryId !== undefined && categoryId !== '') {
      params.append('category_id', categoryId);
    }
    if (isDefault !== null && isDefault !== undefined) {
      params.append('is_default', isDefault);
    }
    if (languageId !== null && languageId !== undefined && languageId !== '') {
      params.append('language_id', languageId);
    }
    const url = `/api/portfolios/${portfolioId}/attachments/${attachmentId}${params.toString() ? `?${params.toString()}` : ''}`;
    console.log('PUT request URL:', url);
    console.log('PUT request params:', { categoryId, isDefault, languageId });
    return api.put(url);
  },
  deletePortfolioAttachment: (portfolioId, attachmentId) => api.delete(`/api/portfolios/${portfolioId}/attachments/${attachmentId}`),
};

// Categories API
const categoriesApi = {
  getCategories: (params) => api.get('/api/categories/', { params }),
  getCategoryById: (id) => api.get(`/api/categories/${id}`),
  createCategory: (data) => api.post('/api/categories/', data),
  updateCategory: (id, data) => api.put(`/api/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/api/categories/${id}`),
  checkUnique: (params) => api.get('/api/categories/check-unique/', { params })
};

// Languages API
const languagesApi = {
  getLanguages: (params) => api.get('/api/languages/', { params }),
  getLanguageById: (id) => api.get(`/api/languages/${id}`),
  createLanguage: (data) => api.post('/api/languages/', data),
  updateLanguage: (id, data) => api.put(`/api/languages/${id}`, data),
  deleteLanguage: (id) => api.delete(`/api/languages/${id}`)
};

// Skills API
const skillsApi = {
  getSkills: (params) => api.get('/api/skills/', { params }),
  getSkillById: (id) => api.get(`/api/skills/${id}`),
  createSkill: (data) => api.post('/api/skills/', data),
  updateSkill: (id, data) => api.put(`/api/skills/${id}`, data),
  deleteSkill: (id) => api.delete(`/api/skills/${id}`),
  checkUnique: (params) => api.get('/api/skills/check-unique/', { params })
};

// Experiences API
const experiencesApi = {
  getExperiences: (params) => api.get('/api/experiences/', { params }),
  getExperienceById: (id) => api.get(`/api/experiences/${id}`),
  createExperience: (data) => api.post('/api/experiences/', data),
  updateExperience: (id, data) => api.put(`/api/experiences/${id}`, data),
  deleteExperience: (id) => api.delete(`/api/experiences/${id}`),
  checkUnique: (params) => api.get('/api/experiences/check-unique/', { params })
};

// Sections API
const sectionsApi = {
  getSections: (params) => api.get('/api/sections/', { params }),
  getSectionById: (id) => api.get(`/api/sections/${id}`),
  createSection: (data) => api.post('/api/sections/', data),
  updateSection: (id, data) => api.put(`/api/sections/${id}`, data),
  deleteSection: (id) => api.delete(`/api/sections/${id}`),
  checkUnique: (params) => api.get('/api/sections/check-unique/', { params })
};

export { 
  api, 
  projectsApi, 
  categoriesApi, 
  languagesApi, 
  skillsApi, 
  experiencesApi,
  sectionsApi 
}; 