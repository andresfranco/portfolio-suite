/**
 * API Configuration
 * Includes base URL and endpoints for the application
 */

// Determine the base URL from environment variables or use default
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// API Configuration object
const API_CONFIG = {
  // Base URL for all API requests
  BASE_URL,
  
  // Default timeout in milliseconds (30 seconds)
  TIMEOUT: 30000,
  
  // Default headers for requests
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  
  // API endpoints organized by resource
  ENDPOINTS: {
    // Authentication endpoints
    auth: {
      login: '/api/auth/login',
      register: '/api/auth/register',
      refreshToken: '/api/auth/refresh-token',
      forgotPassword: '/api/auth/forgot-password',
      resetPassword: '/api/auth/reset-password',
      me: '/api/auth/me'
    },
    
    // User management endpoints
    users: {
      list: '/api/users',
      detail: '/api/users/:id',
      profile: '/api/users/profile'
    },
    
    // Role management endpoints
    roles: {
      list: '/api/roles',
      detail: '/api/roles/:id',
      names: '/api/roles/names'
    },
    
    // Permission management endpoints
    permissions: {
      list: '/api/permissions',
      detail: '/api/permissions/:id',
      categories: '/api/permissions/categories'
    },
    
    // Language management endpoints
    languages: {
      list: '/api/languages',
      detail: '/api/languages/:id',
      codes: '/api/languages/codes'
    },
    
    // Project management endpoints
    projects: {
      list: '/api/projects',
      detail: '/api/projects/:id'
    },
    
    // Skill management endpoints
    skills: {
      list: '/api/skills',
      detail: '/api/skills/:id'
    },
    
    // Skill type management endpoints
    skillTypes: {
      list: '/api/skill-types',
      detail: '/api/skill-types/:id'
    },
    
    // Category management endpoints
    categories: {
      list: '/api/categories',
      detail: '/api/categories/:id'
    },
    
    // Category type management endpoints
    categoryTypes: {
      list: '/api/category-types',
      detail: '/api/category-types/:id'
    }
  }
};

export { API_CONFIG };
export default API_CONFIG; 