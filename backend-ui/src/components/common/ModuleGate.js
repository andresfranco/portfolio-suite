import React from 'react';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { CircularProgress } from '@mui/material';
import PermissionDenied from './PermissionDenied';
import { buildViewDeniedMessage } from '../../utils/permissionMessages';

/**
 * Component that conditionally renders children based on module access
 */
const ModuleGate = ({ 
  moduleName, 
  operation = null, 
  fallback = null, 
  showError = false,
  errorMessage = null,
  children 
}) => {
  const { canAccessModule, canPerformOperation, loading, isAuthenticated } = useAuthorization();

  // Show loading state
  if (loading) {
    return fallback || <CircularProgress size={20} />;
  }

  // If user is not authenticated, don't show anything (avoid permission spam)
  if (!isAuthenticated()) {
    return fallback;
  }

  let hasAccess = false;

  if (operation) {
    // Check specific operation permission
    hasAccess = canPerformOperation(operation, moduleName);
  } else {
    // Check general module access
    hasAccess = canAccessModule(moduleName);
  }

  if (!hasAccess) {
    if (showError) {
      const defaultMessage = buildViewDeniedMessage(moduleName);
      return <PermissionDenied message={errorMessage || defaultMessage} />;
    }
    return fallback;
  }

  return children;
};

export default ModuleGate; 