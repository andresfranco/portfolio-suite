import axios from 'axios';
import SERVER_URL from '../components/common/BackendServerData';
import { API_CONFIG } from '../config/apiConfig';
import { logInfo, logError, logDebug } from '../utils/logger';

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
  headers: {
    'Content-Type': 'application/json',
    ...API_CONFIG.HEADERS
  },
  paramsSerializer: {
    indexes: null // This ensures arrays are sent as multiple parameters: ?key=val1&key=val2
  }
});

// Request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    logDebug('API Request Interceptor:', {
      url: config.url,
      method: config.method,
      tokenExists: !!token,
      tokenLength: token ? token.length : 0,
      headers: config.headers
    });
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      logDebug('Authorization header added:', config.headers.Authorization.substring(0, 20) + '...');
    } else {
      logDebug('No access token found in localStorage');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle authentication errors
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refresh_token');
      // Redirect to login page if needed
      // window.location.href = '/login';
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
  uploadProjectImage: (projectId, formData) => api.post(`/api/projects/${projectId}/images/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateProjectImage: (projectId, imageId, formData) => api.put(`/api/projects/${projectId}/images/${imageId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteProjectImage: (projectId, imageId) => api.delete(`/api/projects/${projectId}/images/${imageId}`),
  
  // Project attachments
  getProjectAttachments: (projectId) => api.get(`/api/projects/${projectId}/attachments/`),
  uploadProjectAttachment: (projectId, formData) => api.post(`/api/projects/${projectId}/attachments/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteProjectAttachment: (projectId, attachmentId) => api.delete(`/api/projects/${projectId}/attachments/${attachmentId}`),
  
  // Portfolio image methods
  getPortfolioImages: (portfolioId) => api.get(`/api/portfolios/${portfolioId}/images`),
  uploadPortfolioImage: (portfolioId, file, category) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    return api.post(`/api/portfolios/${portfolioId}/images?category=${category}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deletePortfolioImage: (portfolioId, imageId) => api.delete(`/api/portfolios/${portfolioId}/images/${imageId}`),
  renamePortfolioImage: (portfolioId, imageId, updateData) => api.put(`/api/portfolios/${portfolioId}/images/${imageId}`, updateData),

  // Portfolio attachment methods
  getPortfolioAttachments: (portfolioId) => api.get(`/api/portfolios/${portfolioId}/attachments`),
  uploadPortfolioAttachment: (portfolioId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/portfolios/${portfolioId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
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