/**
 * Utility functions for handling errors
 */

// Error type constants for categorizing errors
export const ERROR_TYPES = {
  VALIDATION: 'VALIDATION_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  NETWORK: 'NETWORK_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  SERVER: 'SERVER_ERROR',
  CONFLICT: 'CONFLICT_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * Extracts a user-friendly error message from an error object
 * @param {Error|Object} error - The error object
 * @returns {string} A user-friendly error message
 */
export const getErrorMessage = (error) => {
  if (!error) {
    return 'An unknown error occurred';
  }

  // If it's an axios error with a response
  if (error.response) {
    // First try to get the error message from the response data
    if (error.response.data && error.response.data.detail) {
      return error.response.data.detail;
    }
    
    if (error.response.data && error.response.data.message) {
      return error.response.data.message;
    }
    
    // If no specific message, use the status text with code
    if (error.response.statusText) {
      return `${error.response.statusText} (${error.response.status})`;
    }
    
    // Last resort for response errors
    return `Request failed with status code ${error.response.status}`;
  }
  
  // For network errors
  if (error.request && !error.response) {
    return 'Network error: Unable to connect to server';
  }
  
  // For message property (standard Error objects)
  if (error.message) {
    return error.message;
  }
  
  // If the error is a string
  if (typeof error === 'string') {
    return error;
  }
  
  // Last resort
  return 'An unexpected error occurred';
};

/**
 * Determines the type of error based on the error object
 * @param {Error|Object} error - The error object
 * @returns {string} The error type from ERROR_TYPES
 */
export const getErrorType = (error) => {
  if (!error) {
    return ERROR_TYPES.UNKNOWN;
  }

  // Check response status code for HTTP errors
  if (error.response) {
    const status = error.response.status;
    
    // 400 series errors
    if (status === 400) return ERROR_TYPES.VALIDATION;
    if (status === 401 || status === 403) return ERROR_TYPES.AUTHENTICATION;
    if (status === 404) return ERROR_TYPES.NOT_FOUND;
    if (status === 409) return ERROR_TYPES.CONFLICT;
    if (status === 422) return ERROR_TYPES.VALIDATION;
    
    // 500 series errors
    if (status >= 500) return ERROR_TYPES.SERVER;
  }
  
  // Check for network errors
  if (error.request && !error.response) {
    return ERROR_TYPES.NETWORK;
  }
  
  // Check message content for specific errors
  if (error.message) {
    if (error.message.includes('permission') || error.message.includes('forbidden')) {
      return ERROR_TYPES.PERMISSION;
    }
    if (error.message.includes('not found')) {
      return ERROR_TYPES.NOT_FOUND;
    }
    if (error.message.includes('already exists') || error.message.includes('conflict')) {
      return ERROR_TYPES.CONFLICT;
    }
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return ERROR_TYPES.VALIDATION;
    }
  }
  
  // Default case
  return ERROR_TYPES.UNKNOWN;
};

/**
 * Gets a user-friendly error message based on error type
 * @param {string} errorType - The error type from ERROR_TYPES
 * @param {string} originalMessage - The original error message
 * @returns {string} A more user-friendly message
 */
export const getErrorMessageByType = (errorType, originalMessage) => {
  switch(errorType) {
    case ERROR_TYPES.VALIDATION:
      return `Validation error: ${originalMessage}`;
    case ERROR_TYPES.PERMISSION:
      return `Permission error: ${originalMessage}`;
    case ERROR_TYPES.NETWORK:
      return 'Network error: Unable to connect to the server. Please check your internet connection.';
    case ERROR_TYPES.AUTHENTICATION:
      return 'Authentication error: You do not have permission to perform this action.';
    case ERROR_TYPES.NOT_FOUND:
      return `Not found: ${originalMessage}`;
    case ERROR_TYPES.CONFLICT:
      return `Conflict error: ${originalMessage}`;
    case ERROR_TYPES.SERVER:
      return 'Server error: The server encountered an error. Please try again later.';
    default:
      return originalMessage || 'An unknown error occurred';
  }
}; 