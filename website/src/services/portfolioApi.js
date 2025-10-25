/**
 * Portfolio API Service
 * Handles all API communication between the website and the backend
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Handles API responses and errors
 * @param {Response} response - Fetch response object
 * @returns {Promise<any>} - Parsed JSON data
 * @throws {Error} - If response is not ok
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: `HTTP error! status: ${response.status}`
    }));
    throw new Error(error.detail || 'An error occurred');
  }
  return response.json();
};

/**
 * Portfolio API methods
 */
export const portfolioApi = {
  /**
   * Authentication Methods
   */

  /**
   * Login with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} - Access token and user info
   */
  login: async (email, password) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  },

  /**
   * Verify authentication token
   * @param {string} token - Authentication token
   * @returns {Promise<boolean>} - True if token is valid
   */
  verifyToken: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return response.ok;
    } catch (error) {
      console.error('Error verifying token:', error);
      return false;
    }
  },

  /**
   * Get current user information
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} - User data with permissions
   */
  getCurrentUser: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw error;
    }
  },

  /**
   * Public API Methods
   */

  /**
   * Fetch the default portfolio with specified language
   * @param {string} languageCode - Language code (e.g., 'en', 'es')
   * @returns {Promise<Object>} - Portfolio data
   */
  getDefaultPortfolio: async (languageCode = 'en') => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/website/default?language_code=${languageCode}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error('Error fetching default portfolio:', error);
      throw error;
    }
  },

  /**
   * Fetch a specific portfolio by ID with specified language
   * @param {number} portfolioId - Portfolio ID
   * @param {string} languageCode - Language code (e.g., 'en', 'es')
   * @returns {Promise<Object>} - Portfolio data
   */
  getPortfolio: async (portfolioId, languageCode = 'en') => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/website/portfolios/${portfolioId}/public?language_code=${languageCode}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error(`Error fetching portfolio ${portfolioId}:`, error);
      throw error;
    }
  },

  /**
   * CMS Operations (require authentication)
   */

  /**
   * Update project text content
   * @param {number} textId - Project text ID
   * @param {Object} content - Content to update (name, description)
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} - Updated project text
   */
  updateProjectText: async (textId, content, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cms/content/project-text/${textId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(content),
        }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error(`Error updating project text ${textId}:`, error);
      throw error;
    }
  },

  /**
   * Update experience text content
   * @param {number} textId - Experience text ID
   * @param {Object} content - Content to update (name, description)
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} - Updated experience text
   */
  updateExperienceText: async (textId, content, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cms/content/experience-text/${textId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(content),
        }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error(`Error updating experience text ${textId}:`, error);
      throw error;
    }
  },

  /**
   * Update section text content
   * @param {number} textId - Section text ID
   * @param {Object} content - Content to update (text)
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} - Updated section text
   */
  updateSectionText: async (textId, content, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cms/content/section-text/${textId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(content),
        }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error(`Error updating section text ${textId}:`, error);
      throw error;
    }
  },

  /**
   * Upload an image for a content entity
   * @param {File} file - Image file to upload
   * @param {string} entityType - Entity type ('portfolio', 'project', 'experience')
   * @param {number} entityId - Entity ID
   * @param {string} category - Image category ('main', 'thumbnail', 'gallery', 'background')
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} - Uploaded image details
   */
  uploadImage: async (file, entityType, entityId, category, token) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${API_BASE_URL}/api/cms/content/images?entity_type=${entityType}&entity_id=${entityId}&category=${category}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  },

  /**
   * Reorder content (projects, experiences, sections)
   * @param {string} entityType - Entity type ('project', 'experience', 'section')
   * @param {Array<number>} entityIds - Array of entity IDs in new order
   * @param {number} portfolioId - Portfolio ID
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} - Reorder confirmation
   */
  reorderContent: async (entityType, entityIds, portfolioId, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cms/content/order`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            entity_type: entityType,
            entity_ids: entityIds,
            portfolio_id: portfolioId,
          }),
        }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error('Error reordering content:', error);
      throw error;
    }
  },

  /**
   * Update project metadata (repository_url, website_url)
   * @param {number} projectId - Project ID
   * @param {Object} metadata - Metadata to update (repository_url, website_url)
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} - Updated project metadata
   */
  updateProjectMetadata: async (projectId, metadata, token) => {
    try {
      const queryParams = new URLSearchParams();
      if (metadata.repository_url !== undefined) {
        queryParams.append('repository_url', metadata.repository_url);
      }
      if (metadata.website_url !== undefined) {
        queryParams.append('website_url', metadata.website_url);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/cms/content/project/${projectId}?${queryParams.toString()}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error(`Error updating project ${projectId} metadata:`, error);
      throw error;
    }
  },
};

export default portfolioApi;
