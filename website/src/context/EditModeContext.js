import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import NotificationDialog from '../components/common/NotificationDialog';

/**
 * Edit Mode Context
 * Manages CMS edit mode state triggered from backend admin UI
 * No login UI - authentication comes from URL parameters
 */
export const EditModeContext = createContext();

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'cms_auth_token';
const USER_KEY = 'cms_user';
const EDIT_MODE_KEY = 'cms_edit_mode';

/**
 * Edit Mode Provider Component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export const EditModeProvider = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [error, setError] = useState(null);
  const [activeEditor, setActiveEditor] = useState(null); // Track which editor is currently open
  const [notification, setNotification] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  /**
   * Show notification dialog
   */
  const showNotification = (title, message, type = 'info') => {
    setNotification({
      isOpen: true,
      title,
      message,
      type
    });
  };

  /**
   * Close notification dialog
   */
  const closeNotification = () => {
    setNotification({
      ...notification,
      isOpen: false
    });
  };

  /**
   * Check if user has editor permissions
   */
  const canEdit = React.useMemo(() => {
    if (!user) return false;
    
    // Check if user has roles with permissions
    if (user.roles && Array.isArray(user.roles)) {
      for (const role of user.roles) {
        if (role.permissions && Array.isArray(role.permissions)) {
          const hasEditPermission = role.permissions.some(
            p => p === 'EDIT_CONTENT' || p === 'MANAGE_CONTENT' || p === 'SYSTEM_ADMIN'
          );
          if (hasEditPermission) return true;
        }
      }
    }
    
    return false;
  }, [user]);

  /**
   * Load authentication from URL parameters or localStorage
   */
  useEffect(() => {
    const loadAuth = async () => {
      try {
        // Check URL parameters first (from backend redirect)
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        const editMode = urlParams.get('edit') === 'true';

        console.log('🔐 EditModeContext: Loading auth', {
          urlToken: urlToken ? `${urlToken.substring(0, 20)}...` : 'null',
          editMode,
          hasUrlToken: !!urlToken,
          fullUrl: window.location.href
        });

        if (urlToken && editMode) {
          console.log('🔐 Token found in URL, verifying...');
          
          // Token from URL - verify and store it
          const isValid = await verifyAndLoadUser(urlToken);
          
          console.log('🔐 Token verification result:', isValid);
          
          if (isValid) {
            setAuthToken(urlToken);
            setIsEditMode(true);
            localStorage.setItem(TOKEN_KEY, urlToken);
            localStorage.setItem(EDIT_MODE_KEY, 'true');
            
            console.log('✅ Edit mode activated successfully!');
            
            // Clean URL params after storing token
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
            
            // Show success notification
            showNotification(
              'Edit Mode Activated',
              'You can now edit website content. Changes will be saved to the backend.',
              'success'
            );
          } else {
            console.error('❌ Invalid token from URL');
            setError('Invalid authentication token');
            showNotification(
              'Authentication Failed',
              'The authentication token is invalid or has expired. Please try logging in again from the backend.',
              'error'
            );
          }
        } else {
          // Check localStorage for existing session
          const storedToken = localStorage.getItem(TOKEN_KEY);
          const storedUser = localStorage.getItem(USER_KEY);
          const storedEditMode = localStorage.getItem(EDIT_MODE_KEY);

          if (storedToken && storedUser) {
            const parsedUser = JSON.parse(storedUser);
            
            // Verify token is still valid
            const isValid = await verifyToken(storedToken);
            
            if (isValid) {
              setAuthToken(storedToken);
              setUser(parsedUser);
              // Restore edit mode state from localStorage
              setIsEditMode(storedEditMode === 'true');
            } else {
              // Clear invalid token
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
              localStorage.removeItem(EDIT_MODE_KEY);
            }
          }
        }
      } catch (err) {
        console.error('Error loading authentication:', err);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(EDIT_MODE_KEY);
      } finally {
        setIsAuthenticating(false);
      }
    };

    loadAuth();
  }, []);

  /**
   * Verify token and load user data
   * @param {string} token - Authentication token
   * @returns {Promise<boolean>} - True if token is valid
   */
  const verifyAndLoadUser = async (token) => {
    try {
      console.log('🔍 Verifying token...');
      const isValid = await verifyToken(token);
      console.log('🔍 Token valid:', isValid);
      
      if (!isValid) return false;

      // Fetch user details with permissions
      console.log('👤 Fetching user data...');
      const response = await fetch(`${API_BASE_URL}/api/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('👤 User data response status:', response.status);
      
      if (!response.ok) return false;

      const userData = await response.json();
      console.log('👤 User data loaded:', userData.username);
      
      setUser(userData);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      
      return true;
    } catch (err) {
      console.error('❌ Error verifying token and loading user:', err);
      return false;
    }
  };

  /**
   * Verify authentication token is still valid
   * @param {string} token - Authentication token
   * @returns {Promise<boolean>} - True if token is valid
   */
  const verifyToken = async (token) => {
    try {
      console.log('🔐 Calling /api/auth/verify...');
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      console.log('🔐 Verify response status:', response.status);
      return response.ok;
    } catch (err) {
      console.error('❌ Token verification failed:', err);
      return false;
    }
  };

  /**
   * Exit edit mode and clear authentication
   */
  const exitEditMode = useCallback(() => {
    setUser(null);
    setAuthToken(null);
    setIsEditMode(false);
    setError(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EDIT_MODE_KEY);
    
    // Redirect back to normal view
    window.location.href = '/';
  }, []);

  /**
   * Toggle edit mode (only if authenticated)
   */
  const toggleEditMode = useCallback(() => {
    if (canEdit && authToken) {
      const newEditMode = !isEditMode;
      setIsEditMode(newEditMode);
      localStorage.setItem(EDIT_MODE_KEY, newEditMode ? 'true' : 'false');
    } else {
      console.warn('User does not have edit permissions or is not authenticated');
    }
  }, [canEdit, authToken, isEditMode]);

  /**
   * Enable edit mode
   */
  const enableEditMode = useCallback(() => {
    if (canEdit && authToken) {
      setIsEditMode(true);
      localStorage.setItem(EDIT_MODE_KEY, 'true');
    }
  }, [canEdit, authToken]);

  /**
   * Disable edit mode
   */
  const disableEditMode = useCallback(() => {
    setIsEditMode(false);
    localStorage.setItem(EDIT_MODE_KEY, 'false');
  }, []);

  const value = {
    // State
    isEditMode,
    user,
    authToken,
    canEdit,
    isAuthenticating,
    error,
    isAuthenticated: !!authToken,
    activeEditor, // Which editor is currently active

    // Actions
    exitEditMode,
    toggleEditMode,
    enableEditMode,
    disableEditMode,
    clearError: () => setError(null),
    showNotification,
    setActiveEditor, // Lock/unlock editors
  };

  return (
    <EditModeContext.Provider value={value}>
      {children}
      <NotificationDialog
        isOpen={notification.isOpen}
        onClose={closeNotification}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />
    </EditModeContext.Provider>
  );
};

/**
 * Custom hook to use Edit Mode Context
 * @returns {Object} Edit mode context value
 */
export const useEditMode = () => {
  const context = useContext(EditModeContext);
  
  if (context === undefined) {
    throw new Error('useEditMode must be used within an EditModeProvider');
  }
  
  return context;
};

export default EditModeContext;
