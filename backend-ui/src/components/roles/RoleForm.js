import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, CircularProgress, Autocomplete, Chip, Alert, Stack, alpha } from '@mui/material';
import { Add as AddIcon, Save as SaveIcon, Delete as DeleteIcon, Close as CloseIcon, Check } from '@mui/icons-material';
import { useRole } from '../../contexts/RoleContext';
import { usePermission, PermissionProvider } from '../../contexts/PermissionContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import PermissionGate from '../common/PermissionGate';
import { API_CONFIG } from '../../config/apiConfig';
import { logInfo, logError } from '../../utils/logger';
import { useForm, Controller } from 'react-hook-form';
import permissionApi from '../../services/permissionApi';

// Wrap the form component with PermissionProvider
const RoleFormWithPermissionProvider = (props) => {
  return (
    <PermissionProvider>
      <RoleForm {...props} />
    </PermissionProvider>
  );
};

const RoleForm = ({ open, onClose, role, mode }) => {
  // State management
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [permissionError, setPermissionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Permission selection states (moved from inside Controller)
  const [searchText, setSearchText] = useState('');
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [selectedForDeletion, setSelectedForDeletion] = useState([]);

  // Initialize React Hook Form
  const { 
      control, 
      handleSubmit, 
      reset, 
      formState: { errors }, 
      setValue,
      watch
  } = useForm({
      defaultValues: {
          name: '',
          description: '',
          permissions: []
      }
  });

  // Get permission and role contexts for API operations
  const { permissions } = usePermission();
  const { createRole, updateRole, deleteRole } = useRole();
  const { canPerformOperation } = useAuthorization();

  // Filter options based on search text (moved from inside Controller)
  useEffect(() => {
      if (!searchText) {
          setFilteredOptions(availablePermissions);
      } else {
          const filtered = availablePermissions.filter(permission =>
              permission.toLowerCase().includes(searchText.toLowerCase())
          );
          setFilteredOptions(filtered);
      }
  }, [searchText, availablePermissions]);
  
  // Fetch permissions using the proper API service
  useEffect(() => {
    const fetchPermissions = async () => {
      setLoadingPermissions(true);
      setPermissionError('');
      
      try {
        logInfo('Fetching permissions for RoleForm');
        
        // First try to use permissions from context if available
        if (permissions && permissions.length > 0) {
          logInfo('Using permissions from context');
          const permissionNames = permissions.map(p => 
            typeof p === 'string' ? p : (p.name || '')
          ).filter(name => name); // Filter out any empty names
          
          setAvailablePermissions(permissionNames);
          setPermissionError('');
          logInfo(`Loaded ${permissionNames.length} permissions from context`);
          
          // Debug: Check if VIEW_USERS is in context permissions
          const hasViewUsers = permissionNames.includes('VIEW_USERS');
          logInfo(`VIEW_USERS found in context: ${hasViewUsers}`);
          if (!hasViewUsers) {
            logError('VIEW_USERS missing from context permissions:', permissionNames.slice(0, 10));
          }
        } else {
          // If context doesn't have permissions, fetch from API
          logInfo('Fetching permissions from API using getAllPermissionNamesForRoleForm');
          const permissionNames = await permissionApi.getAllPermissionNamesForRoleForm();
          
          setAvailablePermissions(permissionNames);
          setPermissionError('');
          logInfo(`Loaded ${permissionNames.length} permissions from API`);
          
          // Debug: Check if VIEW_USERS is in API response
          const hasViewUsers = permissionNames.includes('VIEW_USERS');
          logInfo(`VIEW_USERS found in API response: ${hasViewUsers}`);
          if (!hasViewUsers) {
            logError('VIEW_USERS missing from API response:', permissionNames.slice(0, 10));
          }
        }
      } catch (error) {
        logError('Error fetching permissions:', error);
        setPermissionError('Failed to load permissions. Please try again.');
        setAvailablePermissions([]);
      } finally {
        setLoadingPermissions(false);
      }
    };
    
    // Only fetch if dialog is open
    if (open) {
      fetchPermissions();
    }
  }, [open, permissions]);

  // Reset form when role or mode changes
  useEffect(() => {
      setApiError(''); // Clear API errors on open/mode change
      setIsSubmitting(false);
      setSuccessMessage('');
      setSearchText(''); // Clear search text on dialog open/close
      setSelectedForDeletion([]); // Clear selected for deletion
      
      if (mode === 'create') {
          reset({ name: '', description: '', permissions: [] });
      } else if (role) {
          // Normalize permissions to ensure they're in the correct format
          let normalizedPermissions = [];
          
          if (role.permissions) {
              normalizedPermissions = Array.isArray(role.permissions) 
                  ? role.permissions.map(perm => typeof perm === 'string' ? perm : perm.name || perm)
                  : [];
          }
          
          reset({
              name: role.name || '',
              description: role.description || '',
              permissions: normalizedPermissions
          });
      } else {
           // Reset if role becomes null (e.g., error during load?)
           reset({ name: '', description: '', permissions: [] });
      }
  }, [role, mode, reset]);

  // Permission selection handlers (only keep the ones that are still needed)
  const handleChipClick = (permission, event) => {
      event.stopPropagation();
      if (event.ctrlKey || event.metaKey) {
          // Multi-select mode
          setSelectedForDeletion(prev => 
              prev.includes(permission) 
                  ? prev.filter(p => p !== permission)
                  : [...prev, permission]
          );
      } else {
          // Single select mode
          setSelectedForDeletion([permission]);
      }
  };
  
  const handleClearSearch = () => {
      setSearchText('');
  };

  // Handle form submission
  const onSubmit = async (formData) => {
      setApiError('');
      setIsSubmitting(true);
      setSuccessMessage('');
      logInfo(`Attempting to ${mode} role:`, formData);
      
      try {
          // Check permissions before performing operations
          if (mode === 'create' && !canPerformOperation('create', 'role')) {
              throw new Error('You do not have permission to create roles');
          }
          
          if (mode === 'edit' && !canPerformOperation('edit', 'role')) {
              throw new Error('You do not have permission to edit roles');
          }
          
          if (mode === 'delete' && !canPerformOperation('delete', 'role')) {
              throw new Error('You do not have permission to delete roles');
          }
          // Ensure permissions data is formatted correctly for the backend
          const roleData = {
              name: formData.name.trim(),
              description: formData.description.trim(),
              permissions: Array.isArray(formData.permissions) 
                  ? formData.permissions.map(p => typeof p === 'string' ? p : p.name || p) 
                  : []
          };

          console.log(`Submitting ${mode} role form with data:`, roleData);

          let result;
          let successMsg = '';

          if (mode === 'create') {
              console.log('Creating new role:', roleData);
              result = await createRole(roleData);
              successMsg = 'Role created successfully';
              console.log('Role creation result:', result);
          } else if (mode === 'edit') {
              if (!role || !role.id) {
                  throw new Error('Cannot update role: Missing role ID');
              }
              console.log(`Updating role ${role.id}:`, roleData);
              result = await updateRole(role.id, roleData);
              successMsg = 'Role updated successfully';
              console.log('Role update result:', result);
          } else if (mode === 'delete') {
              if (!role || !role.id) {
                  throw new Error('Cannot delete role: Missing role ID');
              }
              console.log(`Deleting role ${role.id}`);
              result = await deleteRole(role.id);
              successMsg = 'Role deleted successfully';
              console.log(`Role ${role.id} deleted.`);
          }
          
          setSuccessMessage(successMsg);
          logInfo(`Role ${mode} successful.`);
          
          // Wait briefly to show success message before closing
          setTimeout(() => {
              if (onClose) {
                  onClose(true); // true indicates we should refresh data
              }
          }, 500);
      } catch (error) {
          console.error(`Error in ${mode} role form submission:`, error);
          logError(`Error ${mode}ing role:`, error);
          
          // Provide more specific error messages based on error type
          let errorMsg = `Failed to ${mode} role.`;
          
          if (error.response) {
              // Handle common status codes from the backend
              if (error.response.status === 409 || 
                  (error.response.status === 400 && error.response.data?.detail?.includes("already exists"))) {
                  errorMsg = `A role with this name already exists.`;
              } else if (error.response.status === 422) {
                  errorMsg = `Validation error: ${error.response.data?.detail || 'Please check your inputs.'}`;
              } else if (error.response.status === 403) {
                  errorMsg = `You don't have permission to ${mode} roles.`;
              } else if (error.response.status === 404) {
                  errorMsg = `Role not found. It may have been deleted already.`;
              } else if (error.response.status === 204 && mode === 'delete') {
                  // 204 No Content is a success response for DELETE
                  setSuccessMessage('Role deleted successfully');
                  setTimeout(() => {
                      if (onClose) {
                          onClose(true); // true indicates we should refresh data
                      }
                  }, 500);
                  return; // Exit early as this is a success case
              } else if (error.response.data?.detail) {
                  errorMsg = error.response.data.detail;
              }
          } else if (error.message) {
              errorMsg = error.message;
          }
          
          setApiError(errorMsg);
      } finally {
          setIsSubmitting(false);
      }
  };

  // Handle cancel button click
  const handleCancel = () => {
      if (onClose) {
          onClose(false); // false indicates we should not refresh data
      }
  };

  const handleRetryPermissions = async () => {
      setLoadingPermissions(true);
      setPermissionError('');
      
      try {
          logInfo('Manually retrying permission fetch from retry button');
          
          // Use the proper API service to fetch permissions
          const permissionNames = await permissionApi.getAllPermissionNamesForRoleForm();
          
          setAvailablePermissions(permissionNames);
          setPermissionError('');
          logInfo(`Successfully loaded ${permissionNames.length} permissions on manual retry`);
      } catch (error) {
          // Log detailed error information
          logError('Error fetching permissions in manual retry', {
              error,
              message: error.message,
              code: error.code,
              responseStatus: error.response?.status,
              responseData: error.response?.data
          });
          
          // Set appropriate error message based on error type
          setPermissionError('Failed to load available permissions');
      } finally {
          setLoadingPermissions(false);
      }
  };

  // Determine action button text and icon based on the mode
  const getActionButton = () => {
      let text, icon, color;
      
      switch (mode) {
          case 'create':
              text = 'Create';
              icon = <AddIcon fontSize="small" />; 
              color = '#1976d2';
              break;
          case 'edit':
              text = 'Save';
              icon = <SaveIcon fontSize="small" />;
              color = '#1976d2';
              break;
          case 'delete':
              text = 'Delete';
              icon = <DeleteIcon fontSize="small" />;
              color = '#e53935';
              break;
          default:
              text = 'Submit';
              icon = <SaveIcon fontSize="small" />;
              color = '#1976d2';
      }

      return (
          <Button
              type="submit"
              variant="outlined"
              disabled={isSubmitting || (mode !== 'delete' && Object.keys(errors).length > 0)}
              sx={{
                  px: 2,
                  py: 0.5,
                  height: '32px',
                  borderRadius: '4px',
                  fontWeight: 400,
                  textTransform: 'none',
                  fontSize: '13px',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  boxShadow: 'none',
                  color: color,
                  border: `1px solid ${color}`,
                  '&:hover': {
                      backgroundColor: alpha(color, 0.04),
                      borderColor: color,
                      boxShadow: 'none'
                  },
                  '&:disabled': {
                      opacity: 0.6,
                      color: 'rgba(0, 0, 0, 0.26)',
                  }
              }}
              startIcon={isSubmitting ? <CircularProgress size={16} /> : icon}
          >
              {isSubmitting ? 'Processing...' : text}
          </Button>
      );
  };

  return (
      <Dialog 
          open={open} 
          onClose={isSubmitting ? null : onClose}
          maxWidth="sm" 
          fullWidth
          PaperProps={{
              sx: {
                  borderRadius: '6px',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
              }
          }}
      >
          <DialogTitle sx={{ 
              pb: 1.5, 
              pt: 2.5,
              px: 2.5,
              fontWeight: mode === 'view' ? 600 : 500,
              fontSize: mode === 'view' ? '1.5rem' : '1.125rem',
              color: mode === 'view' ? '#1976d2' : '#333333',
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
              marginBottom: '20px', // Added explicit bottom margin to the title
              letterSpacing: mode === 'view' ? '0.015em' : 'normal'
          }}>
              {mode === 'create' ? 'Create New Role' : 
               mode === 'edit' ? `Edit Role: ${role?.name}` :
               mode === 'view' ? `Role - ${role?.name}` :
               `Delete Role: ${role?.name}`}
          </DialogTitle>
          
          <DialogContent sx={{ 
              p: 2.5, 
              pt: 0, 
              mt: 1,
              '&.MuiDialogContent-root': {
                  paddingTop: 0
              }
          }}>
              {apiError && (
                  <Alert 
                      severity="error" 
                      sx={{ 
                          mb: 2,
                          borderRadius: '4px',
                          '& .MuiAlert-icon': {
                              fontSize: '1.125rem'
                          }
                      }}
                  >
                      {apiError}
                  </Alert>
              )}
              {successMessage && (
                  <Alert 
                      severity="success" 
                      sx={{ 
                          mb: 2,
                          borderRadius: '4px',
                          '& .MuiAlert-icon': {
                              fontSize: '1.125rem'
                          }
                      }}
                  >
                      {successMessage}
                  </Alert>
              )}
              
              {/* Add extra spacing div */}
              <Box sx={{ height: '24px' }}></Box>
              
              {mode === 'view' ? (
                  // View mode UI - read-only display
                  <Box sx={{ mt: 0.20}}>
                      <Alert 
                          severity="info" 
                          variant="outlined"
                          icon={false}
                          sx={{ 
                              p: 2,
                              borderRadius: '4px',
                              border: '1px solid #e3f2fd',
                              backgroundColor: alpha('#e3f2fd', 0.1)
                          }}
                      >
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                  <Typography 
                                      variant="body2" 
                                      sx={{ 
                                          color: '#505050',
                                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                          fontSize: '13px'
                                      }}
                                  >
                                      <strong>Name:</strong> {role?.name}
                                  </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                  <Typography 
                                      variant="body2" 
                                      sx={{ 
                                          color: '#505050',
                                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                          fontSize: '13px'
                                      }}
                                  >
                                      <strong>Description:</strong> {role?.description || 'No description available'}
                                  </Typography>
                              </Box>
                              
                              {role?.permissions && role.permissions.length > 0 ? (
                                  <Box sx={{ mb: 1 }}>
                                      <Typography 
                                          variant="body2" 
                                          sx={{ 
                                              color: '#505050',
                                              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                              fontSize: '13px',
                                              mb: 0.5
                                          }}
                                      >
                                          <strong>Permissions ({role.permissions.length}):</strong>
                                      </Typography>
                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                          {role.permissions.map((permission) => (
                                              <Chip 
                                                  key={permission} 
                                                  label={permission} 
                                                  size="small"
                                                  sx={{
                                                      height: '24px',
                                                      fontSize: '12px',
                                                      bgcolor: '#f5f5f5',
                                                      border: '1px solid #e0e0e0',
                                                      borderRadius: '16px',
                                                      color: '#333',
                                                      '& .MuiChip-label': {
                                                          padding: '0 8px',
                                                      }
                                                  }}
                                              />
                                          ))}
                                      </Box>
                                  </Box>
                              ) : (
                                  <Typography 
                                      variant="body2" 
                                      sx={{ 
                                          color: '#999',
                                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                          fontSize: '13px',
                                          fontStyle: 'italic'
                                      }}
                                  >
                                      No permissions assigned to this role
                                  </Typography>
                              )}
                          </Box>
                      </Alert>
                  </Box>
              ) : mode === 'delete' ? (
                  // Delete confirmation UI
                  <Box component="form" id="role-form" onSubmit={handleSubmit(onSubmit)}>
                      <Alert 
                          severity="error" 
                          variant="outlined"
                          sx={{ 
                              p: 2,
                              borderRadius: '4px',
                              border: '1px solid #ffcdd2',
                              backgroundColor: alpha('#ffebee', 0.3),
                              '& .MuiAlert-icon': {
                                  color: '#e53935'
                              }
                          }}
                      >
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Typography 
                                  variant="subtitle1" 
                                  sx={{ 
                                      fontWeight: 500,
                                      color: '#e53935',
                                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                      fontSize: '15px',
                                      mb: 0.5
                                  }}
                              >
                                  Delete this role?
                              </Typography>
                              
                              <Typography 
                                  variant="body2" 
                                  sx={{ 
                                      color: '#e53935',
                                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                      fontSize: '13px',
                                      mb: 1.5
                                  }}
                              >
                                  This action cannot be undone and may affect users with this role.
                                  {role?.users_count > 0 && (
                                      <Typography 
                                          component="span" 
                                          sx={{ 
                                              display: 'block',
                                              mt: 1, 
                                              fontWeight: 500 
                                          }}
                                      >
                                          Warning: This role is assigned to {role?.users_count} {role?.users_count === 1 ? 'user' : 'users'}.
                                      </Typography>
                                  )}
                              </Typography>
                          
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                  <Typography 
                                      variant="body2" 
                                      sx={{ 
                                          color: '#505050',
                                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                          fontSize: '13px'
                                      }}
                                  >
                                      <strong>Name:</strong> {role?.name}
                                  </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                  <Typography 
                                      variant="body2" 
                                      sx={{ 
                                          color: '#505050',
                                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                          fontSize: '13px'
                                      }}
                                  >
                                      <strong>Description:</strong> {role?.description}
                                  </Typography>
                              </Box>
                              
                              {role?.permissions && role.permissions.length > 0 && (
                                  <Box sx={{ mb: 1 }}>
                                      <Typography 
                                          variant="body2" 
                                          sx={{ 
                                              color: '#505050',
                                              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                              fontSize: '13px',
                                              mb: 0.5
                                          }}
                                      >
                                          <strong>Permissions:</strong>
                                      </Typography>
                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                          {role.permissions.map((permission) => (
                                              <Chip 
                                                  key={permission} 
                                                  label={permission} 
                                                  size="small"
                                                  sx={{
                                                      height: '24px',
                                                      fontSize: '12px',
                                                      bgcolor: '#f5f5f5',
                                                      border: '1px solid #e0e0e0',
                                                      borderRadius: '16px',
                                                      color: '#333',
                                                      '& .MuiChip-label': {
                                                          padding: '0 8px',
                                                      }
                                                  }}
                                              />
                                          ))}
                                      </Box>
                                  </Box>
                              )}
                          </Box>
                      </Alert>
                  </Box>
              ) : (
                  // Form fields for create/edit
                  <Stack spacing={2.5} component="form" id="role-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                      <Controller
                          name="name"
                          control={control}
                          rules={{ 
                              required: 'Role name is required',
                              minLength: { value: 3, message: 'Name must be at least 3 characters' }
                          }}
                          render={({ field }) => (
                              <TextField
                                  {...field}
                                  label="Role Name"
                                  fullWidth
                                  size="small"
                                  error={!!errors.name}
                                  helperText={errors.name?.message || 'Name of the role (e.g., Admin, Editor, Viewer)'}
                                  disabled={isSubmitting}
                                  sx={{
                                      '& .MuiInputLabel-root': {
                                          fontSize: '13px',
                                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                          color: '#505050',
                                      },
                                      '& .MuiOutlinedInput-root': {
                                          borderRadius: '4px',
                                          height: '40px',
                                          '&:hover .MuiOutlinedInput-notchedOutline': {
                                              borderColor: '#1976d2',
                                          },
                                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                              borderColor: '#1976d2',
                                              borderWidth: 1,
                                          },
                                          '& .MuiOutlinedInput-input': {
                                              fontSize: '13px',
                                              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                              color: '#505050',
                                          },
                                      },
                                      '& .MuiFormHelperText-root': {
                                          marginTop: '4px',
                                          fontSize: '12px',
                                          fontStyle: 'italic',
                                          opacity: errors.name ? 1 : 0.7,
                                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                      }
                                  }}
                              />
                          )}
                      />
                      
                      <Controller
                          name="description"
                          control={control}
                          rules={{
                              required: 'Description is required',
                              maxLength: {
                                value: 255,
                                message: 'Description must be less than 255 characters'
                              }
                          }}
                          render={({ field }) => (
                              <TextField
                                  {...field}
                                  label="Description"
                                  fullWidth
                                  error={!!errors.description}
                                  helperText={errors.description?.message}
                                  multiline
                                  rows={3}
                                  disabled={isSubmitting}
                                  sx={{
                                      '& .MuiInputLabel-root': {
                                          fontSize: '13px',
                                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                          color: '#505050',
                                      },
                                      '& .MuiOutlinedInput-root': {
                                          borderRadius: '4px',
                                          '&:hover .MuiOutlinedInput-notchedOutline': {
                                              borderColor: '#1976d2',
                                          },
                                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                              borderColor: '#1976d2',
                                              borderWidth: 1,
                                          },
                                          '& .MuiOutlinedInput-input': {
                                              fontSize: '13px',
                                              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                              color: '#505050',
                                          },
                                      },
                                      '& .MuiFormHelperText-root': {
                                          marginTop: '4px',
                                          fontSize: '12px',
                                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                      }
                                  }}
                              />
                          )}
                      />
                      
                      <Controller
                          name="permissions"
                          control={control}
                          render={({ field }) => {
                              return (
                                  <Box sx={{ width: '100%' }}>
                                      <Typography 
                                          variant="subtitle2" 
                                          sx={{ 
                                              mb: 1, 
                                              fontWeight: 500,
                                              fontSize: '14px',
                                              color: permissionError ? '#d32f2f' : '#333333'
                                          }}
                                      >
                                          Permissions ({(field.value || []).length} selected)
                                      </Typography>
                                      
                                      {permissionError ? (
                                          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                              <Button 
                                                  variant="outlined" 
                                                  size="small"
                                                  onClick={handleRetryPermissions}
                                                  disabled={loadingPermissions}
                                                  sx={{
                                                      borderRadius: '4px',
                                                      textTransform: 'none',
                                                      fontWeight: 400,
                                                      fontSize: '13px',
                                                  }}
                                              >
                                                  {loadingPermissions ? <CircularProgress size={20} /> : 'Retry Loading Permissions'}
                                              </Button>
                                          </Box>
                                      ) : (
                                          <>
                                              {/* Bulk Action Buttons */}
                                              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                                  <Button
                                                      size="small"
                                                      variant="outlined"
                                                      onClick={() => field.onChange(availablePermissions)}
                                                      disabled={isSubmitting || loadingPermissions}
                                                      sx={{
                                                          fontSize: '12px',
                                                          textTransform: 'none',
                                                          minWidth: 'auto',
                                                          px: 1,
                                                          py: 0.5,
                                                          borderRadius: '4px',
                                                          borderColor: '#1976d2',
                                                          color: '#1976d2',
                                                          '&:hover': {
                                                              backgroundColor: alpha('#1976d2', 0.04),
                                                          }
                                                      }}
                                                  >
                                                      Select All ({availablePermissions.length})
                                                  </Button>
                                                  <Button
                                                      size="small"
                                                      variant="outlined"
                                                      onClick={() => {
                                                          field.onChange([]);
                                                          setSelectedForDeletion([]);
                                                      }}
                                                      disabled={isSubmitting || loadingPermissions || (field.value || []).length === 0}
                                                      sx={{
                                                          fontSize: '12px',
                                                          textTransform: 'none',
                                                          minWidth: 'auto',
                                                          px: 1,
                                                          py: 0.5,
                                                          borderRadius: '4px',
                                                          borderColor: '#757575',
                                                          color: '#757575',
                                                          '&:hover': {
                                                              backgroundColor: alpha('#757575', 0.04),
                                                          }
                                                      }}
                                                  >
                                                      Deselect All
                                                  </Button>
                                                  {searchText && filteredOptions.length > 0 && (
                                                      <Button
                                                          size="small"
                                                          variant="outlined"
                                                          onClick={() => {
                                                              const currentValues = field.value || [];
                                                              const newValues = [...new Set([...currentValues, ...filteredOptions])];
                                                              field.onChange(newValues);
                                                          }}
                                                          disabled={isSubmitting || loadingPermissions}
                                                          sx={{
                                                              fontSize: '12px',
                                                              textTransform: 'none',
                                                              minWidth: 'auto',
                                                              px: 1,
                                                              py: 0.5,
                                                              borderRadius: '4px',
                                                              borderColor: '#2e7d32',
                                                              color: '#2e7d32',
                                                              '&:hover': {
                                                                  backgroundColor: alpha('#2e7d32', 0.04),
                                                              }
                                                          }}
                                                      >
                                                          Select Filtered ({filteredOptions.length})
                                                      </Button>
                                                  )}
                                                  {searchText && (
                                                      <Button
                                                          size="small"
                                                          variant="outlined"
                                                          onClick={handleClearSearch}
                                                          disabled={isSubmitting || loadingPermissions}
                                                          sx={{
                                                              fontSize: '12px',
                                                              textTransform: 'none',
                                                              minWidth: 'auto',
                                                              px: 1,
                                                              py: 0.5,
                                                              borderRadius: '4px',
                                                              borderColor: '#ed6c02',
                                                              color: '#ed6c02',
                                                              '&:hover': {
                                                                  backgroundColor: alpha('#ed6c02', 0.04),
                                                              }
                                                          }}
                                                      >
                                                          Clear Search
                                                      </Button>
                                                  )}
                                              </Box>
                                              
                                              {/* Search Status Indicator */}
                                              {searchText && (
                                                  <Box sx={{ mb: 1 }}>
                                                      <Typography 
                                                          variant="caption" 
                                                          sx={{ 
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              gap: 0.5,
                                                              fontSize: '12px',
                                                              color: '#1976d2',
                                                              fontWeight: 500,
                                                              bgcolor: alpha('#1976d2', 0.08),
                                                              px: 1,
                                                              py: 0.5,
                                                              borderRadius: '4px',
                                                              border: `1px solid ${alpha('#1976d2', 0.2)}`
                                                          }}
                                                      >
                                                          🔍 Active Filter: "{searchText}" • {filteredOptions.length} results
                                                          {filteredOptions.length === 0 && (
                                                              <span style={{ color: '#ed6c02', marginLeft: 4 }}>
                                                                  (No matches found)
                                                              </span>
                                                          )}
                                                      </Typography>
                                                  </Box>
                                              )}
                                              
                                              <Autocomplete
                                                  {...field}
                                                  multiple
                                                  id="permissions-autocomplete"
                                                  options={availablePermissions}
                                                  disabled={isSubmitting || loadingPermissions}
                                                  loading={loadingPermissions}
                                                  filterSelectedOptions
                                                  disableCloseOnSelect
                                                  value={field.value || []}
                                                  inputValue={searchText}
                                                  onChange={(_, newValue) => {
                                                      field.onChange(newValue);
                                                  }}
                                                  onInputChange={(_, newInputValue, reason) => {
                                                      // Only update search text if user is typing, not from other interactions
                                                      if (reason === 'input') {
                                                          setSearchText(newInputValue);
                                                      }
                                                  }}
                                                  renderInput={(params) => (
                                                      <TextField 
                                                          {...params} 
                                                          placeholder={searchText ? `Searching: "${searchText}"` : "Search and select permissions"} 
                                                          size="small"
                                                          error={Boolean(permissionError)}
                                                          InputProps={{
                                                              ...params.InputProps,
                                                              endAdornment: (
                                                                  <>
                                                                      {loadingPermissions ? <CircularProgress size={20} /> : null}
                                                                      {params.InputProps.endAdornment}
                                                                  </>
                                                              ),
                                                          }}
                                                          sx={{
                                                              '& .MuiOutlinedInput-root': {
                                                                  borderRadius: '4px',
                                                                  '&:hover .MuiOutlinedInput-notchedOutline': {
                                                                      borderColor: '#1976d2',
                                                                  },
                                                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                                      borderColor: '#1976d2',
                                                                      borderWidth: 1,
                                                                  }
                                                              }
                                                          }}
                                                      />
                                                  )}
                                                  renderTags={(value, getTagProps) => (
                                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, width: '100%' }}>
                                                          {value.map((option, index) => (
                                                              <Chip
                                                                  {...getTagProps({ index })}
                                                                  key={option}
                                                                  label={option}
                                                                  size="small"
                                                                  clickable
                                                                  onClick={(event) => handleChipClick(option, event)}
                                                                  sx={{
                                                                      height: 'auto',
                                                                      minHeight: '24px',
                                                                      fontSize: '12px',
                                                                      margin: '2px',
                                                                      bgcolor: selectedForDeletion.includes(option) ? '#ffebee' : '#f5f5f5',
                                                                      border: selectedForDeletion.includes(option) ? '1px solid #e57373' : '1px solid #e0e0e0',
                                                                      borderRadius: '16px',
                                                                      color: selectedForDeletion.includes(option) ? '#c62828' : '#333',
                                                                      '& .MuiChip-label': {
                                                                          padding: '4px 8px',
                                                                          whiteSpace: 'normal',
                                                                          lineHeight: '1.2',
                                                                          display: 'block'
                                                                      },
                                                                      '& .MuiChip-deleteIcon': {
                                                                          color: selectedForDeletion.includes(option) ? '#c62828' : '#757575',
                                                                          '&:hover': {
                                                                              color: '#d32f2f'
                                                                          }
                                                                      },
                                                                      '&:hover': {
                                                                          backgroundColor: selectedForDeletion.includes(option) ? '#ffcdd2' : '#eeeeee'
                                                                      }
                                                                  }}
                                                              />
                                                          ))}
                                                          {selectedForDeletion.length > 0 && (
                                                              <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                                                                  <Button
                                                                      size="small"
                                                                      variant="outlined"
                                                                      color="error"
                                                                      onClick={() => {
                                                                          const currentValues = field.value || [];
                                                                          const newValues = currentValues.filter(item => !selectedForDeletion.includes(item));
                                                                          field.onChange(newValues);
                                                                          setSelectedForDeletion([]);
                                                                      }}
                                                                      sx={{
                                                                          fontSize: '11px',
                                                                          textTransform: 'none',
                                                                          minWidth: 'auto',
                                                                          px: 1,
                                                                          py: 0.25,
                                                                          height: '24px',
                                                                          borderRadius: '12px',
                                                                      }}
                                                                  >
                                                                      Remove {selectedForDeletion.length}
                                                                  </Button>
                                                              </Box>
                                                          )}
                                                      </Box>
                                                  )}
                                                  renderOption={(props, option, { selected }) => (
                                                      <li {...props}>
                                                          <Box 
                                                              component="span" 
                                                              sx={{ 
                                                                  display: 'flex', 
                                                                  alignItems: 'center',
                                                                  width: '100%',
                                                                  fontSize: '13px'
                                                              }}
                                                          >
                                                              <Box 
                                                                  component="span" 
                                                                  sx={{ 
                                                                      borderRadius: '2px', 
                                                                      width: '18px', 
                                                                      height: '18px',
                                                                      border: '1px solid #bdbdbd',
                                                                      display: 'flex',
                                                                      alignItems: 'center',
                                                                      justifyContent: 'center',
                                                                      mr: 1,
                                                                      backgroundColor: selected ? '#1976d2' : 'transparent',
                                                                      '& svg': {
                                                                          color: '#fff',
                                                                          fontSize: '14px'
                                                                      }
                                                                  }}
                                                              >
                                                                  {selected && <Check />}
                                                              </Box>
                                                              {option}
                                                          </Box>
                                                      </li>
                                                  )}
                                                  ListboxProps={{
                                                      style: {
                                                          maxHeight: '200px',
                                                          fontSize: '13px'
                                                      }
                                                  }}
                                                  sx={{
                                                      '& .MuiAutocomplete-inputRoot': {
                                                          fontSize: '13px',
                                                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                                      },
                                                      '& .MuiAutocomplete-option': {
                                                          fontSize: '13px',
                                                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                                          padding: '4px 8px',
                                                          minHeight: '32px',
                                                          '&:hover': {
                                                              backgroundColor: alpha('#1976d2', 0.08),
                                                          },
                                                          '&[aria-selected="true"]': {
                                                              backgroundColor: alpha('#1976d2', 0.12),
                                                              '&:hover': {
                                                                  backgroundColor: alpha('#1976d2', 0.16),
                                                              }
                                                          }
                                                      }
                                                  }}
                                              />
                                              
                                              {/* Instructions for bulk operations */}
                                              <Typography 
                                                  variant="caption" 
                                                  sx={{ 
                                                      mt: 1, 
                                                      color: '#757575',
                                                      fontSize: '11px',
                                                      fontStyle: 'italic',
                                                      lineHeight: 1.4
                                                  }}
                                              >
                                                  💡 Tips: • Search filters remain active while selecting multiple permissions • Hold Ctrl/Cmd and click permission chips to select multiple for deletion • Use "Select Filtered" to quickly add all matching permissions
                                              </Typography>
                                          </>
                                      )}
                                  </Box>
                              );
                          }}
                      />
                  </Stack>
              )}
          </DialogContent>
          
          <DialogActions sx={{ px: 2.5, py: 2, borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
              <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                  <Button 
                      variant="outlined"
                      onClick={handleCancel}
                      disabled={isSubmitting}
                      startIcon={<CloseIcon fontSize="small" />}
                      sx={{
                          borderRadius: '4px',
                          textTransform: 'none',
                          fontWeight: 400,
                          py: 0.5,
                          height: '32px',
                          fontSize: '13px',
                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                          color: '#757575',
                          border: '1px solid #757575',
                          boxShadow: 'none',
                          '&:hover': {
                              backgroundColor: alpha('#757575', 0.04),
                              borderColor: '#757575'
                          }
                      }}
                  >
                      Cancel
                  </Button>
                  
                  {mode === 'view' ? (
                      // View mode - no action buttons needed
                      null
                  ) : mode === 'delete' ? (
                      <PermissionGate permissions={['DELETE_ROLE', 'MANAGE_ROLES']} showError={false}>
                          <Button
                              variant="outlined"
                              onClick={handleSubmit(onSubmit)}
                              disabled={isSubmitting}
                              startIcon={isSubmitting ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                              sx={{
                                  px: 2,
                                  py: 0.5,
                                  height: '32px',
                                  borderRadius: '4px',
                                  fontWeight: 400,
                                  textTransform: 'none',
                                  fontSize: '13px',
                                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                  boxShadow: 'none',
                                  color: '#e53935',
                                  border: '1px solid #e53935',
                                  '&:hover': {
                                      backgroundColor: alpha('#e53935', 0.04),
                                      borderColor: '#e53935',
                                      boxShadow: 'none'
                                  },
                                  '&:disabled': {
                                      opacity: 0.6,
                                      color: 'rgba(0, 0, 0, 0.26)',
                                  }
                              }}
                          >
                              {isSubmitting ? 'Processing...' : 'Delete Role'}
                          </Button>
                      </PermissionGate>
                  ) : (
                      <PermissionGate 
                          permissions={mode === 'create' ? ['CREATE_ROLE', 'MANAGE_ROLES'] : ['EDIT_ROLE', 'MANAGE_ROLES']} 
                          showError={false}
                      >
                          <Button
                              type="submit"
                              form="role-form"
                              variant="outlined"
                              disabled={isSubmitting || (mode !== 'delete' && Object.keys(errors).length > 0)}
                              sx={{
                                  px: 2,
                                  py: 0.5,
                                  height: '32px',
                                  borderRadius: '4px',
                                  fontWeight: 400,
                                  textTransform: 'none',
                                  fontSize: '13px',
                                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                  boxShadow: 'none',
                                  color: mode === 'create' ? '#1976d2' : mode === 'edit' ? '#1976d2' : '#e53935',
                                  border: `1px solid ${mode === 'create' ? '#1976d2' : mode === 'edit' ? '#1976d2' : '#e53935'}`,
                                  '&:hover': {
                                      backgroundColor: alpha(mode === 'create' ? '#1976d2' : mode === 'edit' ? '#1976d2' : '#e53935', 0.04),
                                      borderColor: mode === 'create' ? '#1976d2' : mode === 'edit' ? '#1976d2' : '#e53935',
                                      boxShadow: 'none'
                                  },
                                  '&:disabled': {
                                      opacity: 0.6,
                                      color: 'rgba(0, 0, 0, 0.26)',
                                  }
                              }}
                              startIcon={isSubmitting ? <CircularProgress size={16} /> : 
                                        mode === 'create' ? <AddIcon fontSize="small" /> : 
                                        mode === 'edit' ? <SaveIcon fontSize="small" /> : 
                                        <DeleteIcon fontSize="small" />}
                          >
                              {isSubmitting ? 'Processing...' : 
                               mode === 'create' ? 'Create' : 
                               mode === 'edit' ? 'Save' : 'Delete'}
                          </Button>
                      </PermissionGate>
                  )}
              </Box>
          </DialogActions>
      </Dialog>
  );
}

export default RoleFormWithPermissionProvider;