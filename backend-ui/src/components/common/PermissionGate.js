import React from 'react';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { CircularProgress } from '@mui/material';
import PermissionDenied from './PermissionDenied';
import { buildGenericDeniedMessage } from '../../utils/permissionMessages';

/**
 * Component that conditionally renders children based on user permissions
 */
const PermissionGate = ({ 
  permission, 
  permissions, 
  requireAll = false, 
  fallback = null, 
  showError = false,
  errorMessage = "You don't have permission to access this resource.",
  children 
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading, isAuthenticated } = useAuthorization();

  // Show loading state
  if (loading) {
    return fallback || <CircularProgress size={20} />;
  }

  // If user is not authenticated, don't show anything (avoid permission spam)
  if (!isAuthenticated()) {
    return fallback;
  }

  let hasAccess = false;

  if (permission) {
    // Single permission check
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    // Multiple permissions check
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  if (!hasAccess) {
    if (showError) {
      const defaultMsg = buildGenericDeniedMessage();
      return <PermissionDenied message={errorMessage || defaultMsg} />;
    }
    return fallback;
  }

  return children;
};

export default PermissionGate; 