import React from 'react';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { Alert, Box, CircularProgress } from '@mui/material';

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
      const defaultMessage = operation 
        ? `You don't have permission to ${operation.toLowerCase()} ${moduleName}.`
        : `You don't have permission to access the ${moduleName} module.`;
      
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          {errorMessage || defaultMessage}
        </Alert>
      );
    }
    return fallback;
  }

  return children;
};

export default ModuleGate; 