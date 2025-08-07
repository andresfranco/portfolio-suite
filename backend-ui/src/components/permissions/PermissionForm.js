import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, CircularProgress, Alert, Typography, Stack, Chip } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { logError, logInfo } from '../../utils/logger';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { alpha } from '@mui/material/styles';
import permissionApi from '../../services/permissionApi';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import PermissionGate from '../common/PermissionGate';

/**
 * PermissionForm component for creating, editing, and deleting permissions
 * 
 * @param {Object} props - Component props
 * @param {string} props.mode - Form mode (create, edit, or delete)
 * @param {Object} props.permission - Permission data for edit/delete mode
 * @param {Function} props.onClose - Function to call when closing the form
 * @returns {React.Component} - The permission form component
 */
function PermissionForm({ mode = 'create', permission = null, onClose }) {
  // State for API interactions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isViewMode, setIsViewMode] = useState(mode === 'view');

  // Authorization hooks
  const { hasPermission } = useAuthorization();

  // Initialize form with react-hook-form
  const { control, handleSubmit, formState: { errors, isValid, isDirty }, setValue, reset } = useForm({
    defaultValues: {
      name: permission?.name || '',
      description: permission?.description || ''
    },
    mode: 'onChange' // Validate on change for better UX
  });

  // Update form when permission changes
  useEffect(() => {
    setIsViewMode(mode === 'view');
    if (permission) {
      setValue('name', permission.name || '');
      setValue('description', permission.description || '');
    } else {
      reset({
        name: '',
        description: ''
      });
    }
  }, [permission, mode, setValue, reset]);

  // Form submission handler
  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      setApiError(null);
      setSuccessMessage(null);

      // Check permissions before performing operations
      if (mode === 'create' && !hasPermission('CREATE_PERMISSION') && !hasPermission('MANAGE_PERMISSIONS')) {
        throw new Error('You do not have permission to create permissions');
      }
      
      if (mode === 'edit' && !hasPermission('EDIT_PERMISSION') && !hasPermission('MANAGE_PERMISSIONS')) {
        throw new Error('You do not have permission to edit permissions');
      }
      
      if (mode === 'delete' && !hasPermission('DELETE_PERMISSION') && !hasPermission('MANAGE_PERMISSIONS')) {
        throw new Error('You do not have permission to delete permissions');
      }

      // Determine which API method to call based on mode
      let response;
      let successMsg;

      if (mode === 'create') {
        successMsg = 'Permission created successfully';
        response = await permissionApi.createPermission(data);
      } else if (mode === 'edit' && permission) {
        successMsg = 'Permission updated successfully';
        response = await permissionApi.updatePermission(permission.id, data);
      } else if (mode === 'delete' && permission) {
        successMsg = 'Permission deleted successfully';
        response = await permissionApi.deletePermission(permission.id);
      }

      // Handle success
      setSuccessMessage(successMsg);
      
      // Wait briefly to show success message before closing
      setTimeout(() => {
        if (onClose) {
          onClose(true); // true indicates we should refresh data
        }
      }, 500);
    } catch (error) {
      // Handle API error
      const errorMsg = error.response?.data?.detail || error.message || `Failed to ${mode} permission`;
      setApiError(errorMsg);
      logError('API Error:', errorMsg);
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

  // Determine button text and icon based on mode
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
        disabled={isSubmitting || (mode !== 'delete' && (!isValid || !isDirty))}
        startIcon={isSubmitting ? <CircularProgress size={16} /> : icon}
      >
        {isSubmitting ? 'Processing...' : text}
      </Button>
    );
  };

  return (
    <Box sx={{ p: 2.5, pt: 2 }}>
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
          sx={{ mb: 2, borderRadius: '4px' }}
        >
          {successMessage}
        </Alert>
      )}
      
      {mode === 'delete' ? (
        // Delete confirmation UI
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
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
                Delete this permission?
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
                This action cannot be undone and may affect roles with this permission.
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
                  <strong>Name:</strong> {permission?.name}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#505050',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    fontSize: '13px'
                  }}
                >
                  <strong>Description:</strong> {permission?.description}
                </Typography>
              </Box>
            </Box>
          </Alert>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
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
            <PermissionGate 
              permissions={
                mode === 'create' ? ['CREATE_PERMISSION', 'MANAGE_PERMISSIONS'] :
                mode === 'edit' ? ['EDIT_PERMISSION', 'MANAGE_PERMISSIONS'] :
                mode === 'delete' ? ['DELETE_PERMISSION', 'MANAGE_PERMISSIONS'] :
                []
              }
              showError={false}
            >
              {getActionButton()}
            </PermissionGate>
          </Box>
        </Box>
      ) : isViewMode ? (
        // View mode UI
        <Box sx={{ mt: 0.20 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" sx={{ color: '#666' }}>
              <strong>Name:</strong> {permission?.name}
            </Typography>
            
            <Typography variant="body2" sx={{ color: '#666' }}>
              <strong>Description:</strong> {permission?.description}
            </Typography>
            
            <Box>
              <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                <strong>Assigned to Roles:</strong>
              </Typography>
              {permission?.roles && permission.roles.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {permission.roles.map((roleName, index) => (
                    <Chip
                      key={index}
                      label={roleName}
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
              ) : (
                <Typography variant="body2" sx={{ color: '#888', fontStyle: 'italic' }}>
                  Not assigned to any roles
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      ) : (
        // Create/Edit form UI
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Controller
              name="name"
              control={control}
              rules={{ 
                required: 'Permission name is required',
                pattern: {
                  value: /^[A-Z0-9_]+$/,
                  message: 'Permission name must be uppercase with underscores only'
                }
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Permission Name"
                  fullWidth
                  size="small"
                  error={!!errors.name}
                  helperText={errors.name?.message || 'Use uppercase letters and underscores only (e.g., CREATE_USER)'}
                  disabled={isSubmitting}
                  // Auto-convert to uppercase
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
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
          </Box>
          
          {!isViewMode && (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                onClick={handleCancel}
                variant="outlined"
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
              <PermissionGate 
                permissions={
                  mode === 'create' ? ['CREATE_PERMISSION', 'MANAGE_PERMISSIONS'] :
                  mode === 'edit' ? ['EDIT_PERMISSION', 'MANAGE_PERMISSIONS'] :
                  mode === 'delete' ? ['DELETE_PERMISSION', 'MANAGE_PERMISSIONS'] :
                  []
                }
                showError={false}
              >
                {getActionButton()}
              </PermissionGate>
            </Box>
          )}
        </form>
      )}
    </Box>
  );
}

export default PermissionForm;