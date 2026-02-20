import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { logInfo, logError } from '../utils/logger';
import { isTokenExpired } from '../utils/jwt';

const AuthorizationContext = createContext();

export const useAuthorization = () => {
  const context = useContext(AuthorizationContext);
  if (!context) {
    throw new Error('useAuthorization must be used within an AuthorizationProvider');
  }
  return context;
};

export const AuthorizationProvider = ({ children }) => {
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isSystemAdminUser, setIsSystemAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authToken, setAuthToken] = useState(() => {
    // With httpOnly cookies, we check the isAuthenticated flag instead of token
    return localStorage.getItem('isAuthenticated') === 'true' ? 'cookie-based' : null;
  });

  // System admin users who bypass all permission checks
  const SYSTEM_ADMIN_USERS = ['systemadmin'];
  const SYSTEM_ADMIN_PERMISSION = 'SYSTEM_ADMIN';

  // Watch for authentication changes in localStorage
  useEffect(() => {
    const checkAuthChange = () => {
      const isAuth = localStorage.getItem('isAuthenticated') === 'true';
      const effectiveToken = isAuth ? 'cookie-based' : null;
      if (effectiveToken !== authToken) {
        setAuthToken(effectiveToken);
      }
    };

    // Check for auth changes less frequently and only if we currently have auth
    // If we don't have auth, we don't need to poll as frequently
    const pollInterval = authToken ? 2000 : 5000; // 2 seconds if authenticated, 5 seconds if not
    const interval = setInterval(checkAuthChange, pollInterval);
    
    // Also listen for storage events (though these only fire in other tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'isAuthenticated') {
        const isAuth = e.newValue === 'true';
        setAuthToken(isAuth ? 'cookie-based' : null);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [authToken]);

  // Load user permissions when token changes
  useEffect(() => {
    const loadUserPermissions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get current user permissions from the API
        const response = await api.get('/api/users/me/permissions');
        
        setPermissions(response.data.permissions || []);
        setRoles(response.data.roles || []);
        setIsSystemAdminUser(response.data.is_systemadmin || false);
        
        
        logInfo('User permissions loaded:', response.data.permissions?.length || 0, 'permissions');
        logInfo('System admin status:', response.data.is_systemadmin);
      } catch (error) {
        logError('Failed to load user permissions:', error);
        setError('Failed to load user permissions');
        setPermissions([]);
        setRoles([]);
        setIsSystemAdminUser(false);
      } finally {
        setLoading(false);
      }
    };

  if (authToken) {
      logInfo('Auth token detected, loading permissions...');
      loadUserPermissions();
    } else {
      logInfo('No auth token, clearing permissions...');
      setPermissions([]);
      setRoles([]);
      setIsSystemAdminUser(false);
      setLoading(false);
    }
  }, [authToken]); // Now depends on authToken changes!

  // Check if user is system admin
  const isSystemAdmin = useCallback(() => {
    // If no auth token, return false without logging (avoid spam when logged out)
    if (!authToken) {
      return false;
    }
    
    // Primary check: use the is_systemadmin flag from the backend
    if (isSystemAdminUser) {
      return true;
    }
    
    // Fallback: check if user has SYSTEM_ADMIN permission
    const hasSystemAdminPerm = permissions.includes(SYSTEM_ADMIN_PERMISSION);
    if (hasSystemAdminPerm) {
      return true;
    }
    
    return false;
  }, [isSystemAdminUser, permissions, authToken]);

  // Check if user has specific permission
  const hasPermission = useCallback((permission) => {
    if (!permission) return false;
    
    // If no auth token, immediately return false without excessive logging
    if (!authToken) {
      return false;
    }
    
    // System admin bypass
    if (isSystemAdmin()) {
      return true;
    }
    
    // Check specific permission directly
    if (permissions.includes(permission)) {
      return true;
    }
    
    // Define manage permissions that grant multiple permissions
    const managePermissions = {
      "MANAGE_ROLES": ["VIEW_ROLES", "CREATE_ROLE", "EDIT_ROLE", "DELETE_ROLE"],
      "MANAGE_USERS": ["VIEW_USERS", "CREATE_USER", "EDIT_USER", "DELETE_USER"],
      "MANAGE_PERMISSIONS": ["VIEW_PERMISSIONS", "CREATE_PERMISSION", "EDIT_PERMISSION", "DELETE_PERMISSION"],
      "MANAGE_SKILLS": ["VIEW_SKILLS", "CREATE_SKILL", "EDIT_SKILL", "DELETE_SKILL"],
      "MANAGE_SKILL_TYPES": ["VIEW_SKILL_TYPES", "CREATE_SKILL_TYPE", "EDIT_SKILL_TYPE", "DELETE_SKILL_TYPE"],
      "MANAGE_CATEGORIES": ["VIEW_CATEGORIES", "CREATE_CATEGORY", "EDIT_CATEGORY", "DELETE_CATEGORY"],
      "MANAGE_CATEGORY_TYPES": ["VIEW_CATEGORY_TYPES", "CREATE_CATEGORY_TYPE", "EDIT_CATEGORY_TYPE", "DELETE_CATEGORY_TYPE"],
      "MANAGE_PORTFOLIOS": ["VIEW_PORTFOLIOS", "CREATE_PORTFOLIO", "EDIT_PORTFOLIO", "DELETE_PORTFOLIO"],
      "MANAGE_PROJECTS": ["VIEW_PROJECTS", "CREATE_PROJECT", "EDIT_PROJECT", "DELETE_PROJECT", "VIEW_PROJECT_IMAGES", "UPLOAD_PROJECT_IMAGES", "EDIT_PROJECT_IMAGES", "DELETE_PROJECT_IMAGES", "VIEW_PROJECT_ATTACHMENTS", "UPLOAD_PROJECT_ATTACHMENTS", "EDIT_PROJECT_ATTACHMENTS", "DELETE_PROJECT_ATTACHMENTS"],
      "MANAGE_PROJECT_IMAGES": ["VIEW_PROJECT_IMAGES", "UPLOAD_PROJECT_IMAGES", "EDIT_PROJECT_IMAGES", "DELETE_PROJECT_IMAGES"],
      "MANAGE_PROJECT_ATTACHMENTS": ["VIEW_PROJECT_ATTACHMENTS", "UPLOAD_PROJECT_ATTACHMENTS", "EDIT_PROJECT_ATTACHMENTS", "DELETE_PROJECT_ATTACHMENTS"],
      "MANAGE_EXPERIENCES": ["VIEW_EXPERIENCES", "CREATE_EXPERIENCE", "EDIT_EXPERIENCE", "DELETE_EXPERIENCE"],
      "MANAGE_LANGUAGES": ["VIEW_LANGUAGES", "CREATE_LANGUAGE", "EDIT_LANGUAGE", "DELETE_LANGUAGE"],
      "MANAGE_SECTIONS": ["VIEW_SECTIONS", "CREATE_SECTION", "EDIT_SECTION", "DELETE_SECTION"],
      "MANAGE_TRANSLATIONS": ["VIEW_TRANSLATIONS", "CREATE_TRANSLATION", "EDIT_TRANSLATION", "DELETE_TRANSLATION"],
    };
    
    // Check if user has a manage permission that grants the required permission
    for (const [managePerm, grantedPermissions] of Object.entries(managePermissions)) {
      if (permissions.includes(managePerm) && grantedPermissions.includes(permission)) {
        return true;
      }
    }
    
    // Only log detailed debug info if there's an auth token (avoid spam when logged out)
    if (authToken) {
    }
    return false;
  }, [permissions, isSystemAdmin, authToken]);

  // Check if user has any of the specified permissions
  const hasAnyPermission = useCallback((permissionList) => {
    if (!permissionList || permissionList.length === 0) return false;
    
    // System admin bypass
    if (isSystemAdmin()) return true;
    
    // Check if user has any of the permissions (using hasPermission for manage permission support)
    return permissionList.some(permission => hasPermission(permission));
  }, [hasPermission, isSystemAdmin]);

  // Check if user has all specified permissions
  const hasAllPermissions = useCallback((permissionList) => {
    if (!permissionList || permissionList.length === 0) return false;
    
    // System admin bypass
    if (isSystemAdmin()) return true;
    
    // Check if user has all permissions (using hasPermission for manage permission support)
    return permissionList.every(permission => hasPermission(permission));
  }, [hasPermission, isSystemAdmin]);

  // Check if user has specific role
  const hasRole = useCallback((roleName) => {
    if (!roleName) return false;
    
    // System admin bypass
    if (isSystemAdmin()) return true;
    
    return roles.some(role => role.name === roleName);
  }, [roles, isSystemAdmin]);

  // Module-specific permission mapping
  const modulePermissions = {
    'users': ['VIEW_USERS', 'CREATE_USER', 'EDIT_USER', 'DELETE_USER', 'MANAGE_USERS'],
    'roles': ['VIEW_ROLES', 'CREATE_ROLE', 'EDIT_ROLE', 'DELETE_ROLE', 'MANAGE_ROLES'],
    'permissions': ['VIEW_PERMISSIONS', 'CREATE_PERMISSION', 'EDIT_PERMISSION', 'DELETE_PERMISSION', 'MANAGE_PERMISSIONS'],
    'categories': ['VIEW_CATEGORIES', 'CREATE_CATEGORY', 'EDIT_CATEGORY', 'DELETE_CATEGORY', 'MANAGE_CATEGORIES'],
    'categorytypes': ['VIEW_CATEGORY_TYPES', 'CREATE_CATEGORY_TYPE', 'EDIT_CATEGORY_TYPE', 'DELETE_CATEGORY_TYPE', 'MANAGE_CATEGORY_TYPES'],
    'portfolios': ['VIEW_PORTFOLIOS', 'CREATE_PORTFOLIO', 'EDIT_PORTFOLIO', 'DELETE_PORTFOLIO', 'MANAGE_PORTFOLIOS'],
    'projects': ['VIEW_PROJECTS', 'CREATE_PROJECT', 'EDIT_PROJECT', 'DELETE_PROJECT', 'MANAGE_PROJECTS'],
    'experiences': ['VIEW_EXPERIENCES', 'CREATE_EXPERIENCE', 'EDIT_EXPERIENCE', 'DELETE_EXPERIENCE', 'MANAGE_EXPERIENCES'],
    'skills': ['VIEW_SKILLS', 'CREATE_SKILL', 'EDIT_SKILL', 'DELETE_SKILL', 'MANAGE_SKILLS'],
    'skilltypes': ['VIEW_SKILL_TYPES', 'CREATE_SKILL_TYPE', 'EDIT_SKILL_TYPE', 'DELETE_SKILL_TYPE', 'MANAGE_SKILL_TYPES'],
    'languages': ['VIEW_LANGUAGES', 'CREATE_LANGUAGE', 'EDIT_LANGUAGE', 'DELETE_LANGUAGE', 'MANAGE_LANGUAGES'],
    'sections': ['VIEW_SECTIONS', 'CREATE_SECTION', 'EDIT_SECTION', 'DELETE_SECTION', 'MANAGE_SECTIONS'],
    'translations': ['VIEW_TRANSLATIONS', 'CREATE_TRANSLATION', 'EDIT_TRANSLATION', 'DELETE_TRANSLATION', 'MANAGE_TRANSLATIONS']
  };

  // Check if user can access module
  const canAccessModule = useCallback((moduleName) => {
    if (!moduleName) return false;
    
    const requiredPermissions = modulePermissions[moduleName.toLowerCase()];
    if (!requiredPermissions) return false;

    // User needs at least one permission for the module (typically VIEW)
    return hasAnyPermission(requiredPermissions);
  }, [hasAnyPermission]);

  // CRUD operation permission checks
  const canPerformOperation = useCallback((operation, moduleName) => {
    if (!operation || !moduleName) return false;
    
    const permission = `${operation.toUpperCase()}_${moduleName.toUpperCase()}`;
    return hasPermission(permission);
  }, [hasPermission]);

  // Refresh permissions (useful after role changes)
  const refreshPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/users/me/permissions');
      setPermissions(response.data.permissions || []);
      setRoles(response.data.roles || []);
      setIsSystemAdminUser(response.data.is_systemadmin || false);
      
      logInfo('User permissions refreshed:', response.data.permissions?.length || 0, 'permissions');
      logInfo('System admin status refreshed:', response.data.is_systemadmin);
    } catch (error) {
      logError('Failed to refresh user permissions:', error);
      setError('Failed to refresh user permissions');
      setIsSystemAdminUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Force auth check (useful for login scenarios)
  const checkAuthState = useCallback(() => {
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';
    const effectiveToken = isAuth ? 'cookie-based' : null;
    if (effectiveToken !== authToken) {
      logInfo('Forcing auth state check, authentication changed');
      setAuthToken(effectiveToken);
    }
  }, [authToken]);

  // Check if user is authenticated (has valid token)
  const isAuthenticated = useCallback(() => {
    return !!authToken;
  }, [authToken]);

  const value = {
    permissions,
    roles,
    isSystemAdminUser,
    loading,
    error,
    isAuthenticated,
    isSystemAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canAccessModule,
    canPerformOperation,
    refreshPermissions,
    checkAuthState
  };

  return (
    <AuthorizationContext.Provider value={value}>
      {children}
    </AuthorizationContext.Provider>
  );
}; 