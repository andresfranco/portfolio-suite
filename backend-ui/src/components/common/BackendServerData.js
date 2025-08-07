/**
 * Backend server configuration
 * Centralizes server URL configuration for API requests
 */

// Access environment variables
const SERVER_HOSTNAME = process.env.REACT_APP_SERVER_HOSTNAME || '127.0.0.1';
const SERVER_PORT = process.env.REACT_APP_SERVER_PORT || '8000';
const SERVER_PROTOCOL = process.env.REACT_APP_SERVER_PROTOCOL || 'http';

// Construct the full server URL ensuring it has no trailing slash
const SERVER_URL = `${SERVER_PROTOCOL}://${SERVER_HOSTNAME}:${SERVER_PORT}`;

// Debug info for development
if (process.env.NODE_ENV === 'development') {
  console.log('Using backend server URL:', SERVER_URL);
}

export default SERVER_URL;