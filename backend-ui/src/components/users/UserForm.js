import React, { useEffect, useState } from 'react';
import userApi from '../../services/userApi';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  FormHelperText,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Stack,
  Alert,
  alpha,
  LinearProgress,
  Collapse,
  Tabs,
  Tab,
  Divider,
  Paper
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useUsers } from '../../contexts/UserContext';
import { 
  Add as AddIcon, 
  Save as SaveIcon, 
  Delete as DeleteIcon, 
  Close as CloseIcon, 
  Check as CheckIcon,
  Clear as ClearIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  VpnKey as VpnKeyIcon
} from '@mui/icons-material';
import MfaManagement from './MfaManagement';

const UserForm = ({ userId, onClose, mode = 'create' }) => {
  const { 
    selectedUser, 
    createUser, 
    updateUser, 
    deleteUser,
    changePassword, 
    roles, 
    fetchRoles,
    loading,
    clearError
  } = useUsers();
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [apiError, setApiError] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  
  const { 
    control, 
    handleSubmit, 
    formState: { errors }, 
    reset, 
    setValue,
    watch 
  } = useForm({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      roles: [],
      is_active: true
    }
  });
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState(null); // null | true | false
  const [activeTab, setActiveTab] = useState(0); // 0 = Basic Info, 1 = MFA Security, 2 = Change Password
  
  // Add password strength state
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    specialChar: false
  });
  
  // Watch password field for validation
  const passwordValue = watch('password');
  const usernameWatch = watch('username');
  
  // Fetch roles on component mount
  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);
  
  // Set form values and mode when selected user changes
  useEffect(() => {
    // Don't change mode if the dialog is closing
    if (isClosing) return;
    
    if (mode === 'delete') {
      setIsDeleteMode(true);
      setIsEditMode(false);
      setIsViewMode(false);
    } else if (mode === 'edit') {
      setIsEditMode(true);
      setIsDeleteMode(false);
      setIsViewMode(false);
    } else if (mode === 'view') {
      setIsViewMode(true);
      setIsEditMode(false);
      setIsDeleteMode(false);
    } else {
      setIsEditMode(false);
      setIsDeleteMode(false);
      setIsViewMode(false);
      // Always explicitly reset form in create mode
      reset({
        username: '',
        email: '',
        password: '',
        roles: [],
        is_active: true
      });
    }

    if (selectedUser && (mode === 'edit' || mode === 'delete')) {
      // Log the raw selectedUser data for debugging
      console.log('Selected user data:', selectedUser);
      
      setValue('username', selectedUser.username || '');
      setValue('email', selectedUser.email || '');
      setValue('roles', selectedUser.roles?.map(role => role.id) || []);
      
      // Explicitly test both true and false cases
      const isActive = selectedUser.is_active === true || 
                      selectedUser.is_active === 'true' || 
                      selectedUser.is_active === 1;
      console.log('Setting is_active from', selectedUser.is_active, 'to', isActive, 'type:', typeof selectedUser.is_active);
      
      // Force a boolean value
      setValue('is_active', isActive);
      
      // Clear password field in edit mode
      setValue('password', '');
    } 
  }, [selectedUser, mode, setValue, reset, isClosing]);
  
  // Check password strength
  useEffect(() => {
    if (!passwordValue) {
      setPasswordStrength(0);
      setPasswordChecks({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        specialChar: false
      });
      return;
    }
    
    // Check requirements
    const hasLength = passwordValue.length >= 8;
    const hasUppercase = /[A-Z]/.test(passwordValue);
    const hasLowercase = /[a-z]/.test(passwordValue);
    const hasNumber = /[0-9]/.test(passwordValue);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/.test(passwordValue);
    
    // Update checks
    setPasswordChecks({
      length: hasLength,
      uppercase: hasUppercase,
      lowercase: hasLowercase,
      number: hasNumber,
      specialChar: hasSpecialChar
    });
    
    // Calculate strength (0-100)
    let strength = 0;
    if (hasLength) strength += 20;
    if (hasUppercase) strength += 20;
    if (hasLowercase) strength += 20;
    if (hasNumber) strength += 20;
    if (hasSpecialChar) strength += 20;
    
    setPasswordStrength(strength);
    
    // Check confirm password match
    if (confirmPassword && confirmPassword !== passwordValue) {
      setPasswordError('Passwords do not match');
    } else {
      setPasswordError('');
    }
  }, [passwordValue, confirmPassword]);

  // Debounced username availability check (create & edit; edit excludes current user)
  useEffect(() => {
    let active = true;
    const username = usernameWatch?.trim();
    if (!username || username.length < 3) {
      setUsernameAvailability(null);
      return;
    }
    setUsernameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const resp = await userApi.checkUsername(username, isEditMode ? selectedUser?.id : undefined);
        if (active) setUsernameAvailability(resp.data.available);
      } catch (e) {
        if (active) setUsernameAvailability(null);
      } finally {
        if (active) setUsernameChecking(false);
      }
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [usernameWatch, isEditMode, selectedUser]);
  
  // Check if passwords match when confirm password changes
  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    
    if (value && passwordValue !== value) {
      setPasswordError('Passwords do not match');
    } else {
      setPasswordError('');
    }
  };
  
  // Form submission handler
  const onSubmit = async (data) => {
    // Add confirm password check for create mode
    if (!isEditMode && !isDeleteMode && passwordValue !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (usernameAvailability === false) {
      setApiError('Username already taken');
      return;
    }
    
    setApiError('');
    setSuccessMessage('');
    
    try {
      if (isDeleteMode) {
        // Handle delete operation
        await deleteUser(selectedUser.id);
        setSuccessMessage('User deleted successfully');
        
        // Close form immediately with refresh
        setTimeout(() => {
          if (onClose) onClose(true);
        }, 500);
      } else if (isEditMode) {
        // Handle edit operation
        // Convert is_active to a proper boolean value
        const isActiveValue = Boolean(data.is_active === true || data.is_active === "true" || data.is_active === 1);
        
        const userData = {
          ...data,
          id: selectedUser.id,
          is_active: isActiveValue
        };
        
        // Log the data being sent for debugging
        console.log('Updating user with data:', userData);
        console.log('User status value being sent:', isActiveValue, 'type:', typeof isActiveValue);
        
        // Set closing state immediately to prevent re-renders of the form
        setIsClosing(true);
        
        await updateUser(selectedUser.id, userData);
        setSuccessMessage('User updated successfully');
        
        // Close form immediately with refresh
        if (onClose) onClose(true);
      } else {
        // Handle create operation
        // Convert is_active to a proper boolean value
        const isActiveValue = Boolean(data.is_active === true || data.is_active === "true" || data.is_active === 1);
        
        // Set closing state immediately to prevent re-renders of the form
        setIsClosing(true);
        
        await createUser({
          ...data,
          is_active: isActiveValue
        });
        setSuccessMessage('User created successfully');
        
        // Close form immediately with refresh
        if (onClose) onClose(true);
      }
    } catch (error) {
      // Reset closing state if there was an error
      setIsClosing(false);
      
      console.error('Error submitting user form:', error);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      
      // Set error message based on the error
      let errorMsg = error.formMessage || `Failed to ${isDeleteMode ? 'delete' : isEditMode ? 'update' : 'create'} user.`;
      
      try {
        if (error.response) {
          if (error.response.status === 409 || 
              (error.response.status === 400 && error.response.data?.detail?.includes("already exists"))) {
            errorMsg = `A user with this username or email already exists.`;
          } else if (error.response.status === 422) {
            // Handle validation error details
            console.log('Processing 422 validation error:', error.response.data?.detail);
            
            if (Array.isArray(error.response.data?.detail)) {
              // Extract specific validation error messages
              const errorDetails = error.response.data.detail.map(err => {
                console.log('Processing error object:', err);
                
                // Safely handle error object structure
                const field = err && err.loc && Array.isArray(err.loc) && err.loc.length > 1 ? err.loc[1] : '';
                const message = err && err.msg ? String(err.msg) : 'Invalid input';
                
                return `${field ? field.charAt(0).toUpperCase() + field.slice(1) + ': ' : ''}${message}`;
              }).join('. ');
              
              errorMsg = `Validation error: ${errorDetails}`;
              console.log('Final error message:', errorMsg);
            } else {
              // Handle non-array detail
              const detail = error.response.data?.detail;
              if (typeof detail === 'string') {
                errorMsg = `Validation error: ${detail}`;
              } else if (detail && typeof detail === 'object') {
                errorMsg = `Validation error: ${JSON.stringify(detail)}`;
              } else {
                errorMsg = `Validation error: Please check your inputs.`;
              }
            }
          } else if (error.response.data?.detail) {
            // Handle other types of detail
            const detail = error.response.data.detail;
            
            if (typeof detail === 'string') {
              errorMsg = detail;
            } else if (Array.isArray(detail)) {
              // Join multiple error messages
              errorMsg = detail.map(err => {
                if (typeof err === 'string') {
                  return err;
                } else if (err && typeof err === 'object' && err.msg) {
                  return String(err.msg);
                } else {
                  return String(err);
                }
              }).join('. ');
            } else if (typeof detail === 'object') {
              // Convert object to string
              errorMsg = JSON.stringify(detail);
            } else {
              errorMsg = String(detail);
            }
          }
        } else if (error.message) {
          errorMsg = String(error.message);
        }
      } catch (processingError) {
        console.error('Error processing error message:', processingError);
        errorMsg = `Failed to ${isDeleteMode ? 'delete' : isEditMode ? 'update' : 'create'} user. Please try again.`;
      }
      
      // Ensure errorMsg is always a string
      if (typeof errorMsg !== 'string') {
        console.error('Error message is not a string:', errorMsg);
        errorMsg = `Failed to ${isDeleteMode ? 'delete' : isEditMode ? 'update' : 'create'} user. Please try again.`;
      }
      
      console.log('Setting API error (form-local only):', errorMsg);
      setApiError(errorMsg);
    }
  };
  
  // Password change dialog handlers
  const handleOpenPasswordDialog = () => {
    setPasswordDialogOpen(true);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    clearError?.();
  };
  
  const handleClosePasswordDialog = () => {
    setPasswordDialogOpen(false);
    clearError?.();
  };
  
  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    
    try {
      // Build payload matching backend schema UserPasswordChange
      const payload = {
        username: selectedUser.username,
        password: newPassword,
        password_confirmation: confirmPassword
      };
      await changePassword(selectedUser.id, payload);
      setSuccessMessage('Password changed successfully');
      
      // Clear password fields
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      
      // Switch back to Basic Info tab after successful password change
      setActiveTab(0);
      
      // Show success message briefly
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('Failed to change password. Please try again.');
    }
  };
  
  // Handle close with transition
  const handleClose = (refresh = false) => {
    console.log('handleClose called with refresh:', refresh);
    setIsClosing(true);
    clearError?.();
    // Clear form errors and reset form values on close
    if (mode === 'create') {
      reset({
        username: '',
        email: '',
        password: '',
        roles: [],
        is_active: true
      });
    }
    
    // Call the onClose handler with the refresh parameter
    if (onClose) onClose(refresh);
  };

  return (
    <Dialog 
      open={true} 
      onClose={loading ? null : () => handleClose(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '6px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
        }
      }}
      // Reset the closing state when dialog is fully closed
      TransitionProps={{
        onExited: () => setIsClosing(false)
      }}
    >
      <DialogTitle sx={{ 
        pb: 1.5, 
        pt: 2.5,
        px: 2.5,
        fontWeight: 500,
        fontSize: '1.125rem',
        color: '#333333',
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        marginBottom: '20px'
      }}>
        {isDeleteMode ? `Delete User: ${selectedUser?.username}` : 
         isEditMode ? `Edit User: ${selectedUser?.username}` : 
         isViewMode ? `User - ${selectedUser?.username}` :
         'Create New User'}
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
        
        {/* Tabs for Edit Mode */}
        {isEditMode && !isDeleteMode && (
          <Box sx={{ mb: 2 }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, newValue) => setActiveTab(newValue)}
              sx={{ 
                borderBottom: 1, 
                borderColor: 'divider',
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontSize: '13px',
                  fontWeight: 500
                }
              }}
            >
              <Tab icon={<PersonIcon fontSize="small" />} iconPosition="start" label="Basic Information" />
              <Tab icon={<SecurityIcon fontSize="small" />} iconPosition="start" label="MFA Security" />
              <Tab icon={<VpnKeyIcon fontSize="small" />} iconPosition="start" label="Change Password" />
            </Tabs>
          </Box>
        )}
        
        {isDeleteMode ? (
          // Delete confirmation UI
          <Box component="form" id="user-form" onSubmit={handleSubmit(onSubmit)}>
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
                  Delete this user?
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
                  {selectedUser?.roles && selectedUser.roles.length > 0 && (
                    <Typography 
                      component="span" 
                      sx={{ 
                        display: 'block',
                        mt: 1, 
                        fontWeight: 500 
                      }}
                    >
                      Warning: This user has {selectedUser.roles.length} {selectedUser.roles.length === 1 ? 'role' : 'roles'} assigned.
                    </Typography>
                  )}
                </Typography>
              
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <Typography 
                    variant="body2" 
                    component="span"
                    sx={{ 
                      color: '#505050',
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      minWidth: '100px'
                    }}
                  >
                    Username:
                  </Typography>
                  <Typography 
                    variant="body2" 
                    component="span"
                    sx={{ 
                      color: '#505050',
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                      fontSize: '13px'
                    }}
                  >
                    {selectedUser?.username}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <Typography 
                    variant="body2" 
                    component="span"
                    sx={{ 
                      color: '#505050',
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      minWidth: '100px'
                    }}
                  >
                    Email:
                  </Typography>
                  <Typography 
                    variant="body2" 
                    component="span"
                    sx={{ 
                      color: '#505050',
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                      fontSize: '13px'
                    }}
                  >
                    {selectedUser?.email}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <Typography 
                    variant="body2" 
                    component="span"
                    sx={{ 
                      color: '#505050',
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      minWidth: '100px'
                    }}
                  >
                    Status:
                  </Typography>
                  <Box>
                    <Chip 
                      label={selectedUser?.is_active ? "Active" : "Inactive"} 
                      color={selectedUser?.is_active ? "success" : "error"}
                      size="small"
                      variant={selectedUser?.is_active ? "filled" : "outlined"}
                      sx={{ 
                        fontSize: '0.7rem',
                        height: '20px'
                      }}
                    />
                  </Box>
                </Box>
                
                {selectedUser?.roles && selectedUser.roles.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                    <Typography 
                      variant="body2" 
                      component="span"
                      sx={{ 
                        color: '#505050',
                        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                        fontSize: '13px',
                        fontWeight: 500,
                        minWidth: '100px'
                      }}
                    >
                      Roles:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selectedUser.roles.map((role) => (
                        <Chip 
                          key={role.id || role} 
                          label={role.name || role} 
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
        ) : isViewMode ? (
          // View mode UI
          <Box sx={{ mt: 0.20 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" sx={{ color: '#666' }}>
                <strong>Username:</strong> {selectedUser?.username}
              </Typography>
              
              <Typography variant="body2" sx={{ color: '#666' }}>
                <strong>Email:</strong> {selectedUser?.email}
              </Typography>
              
              <Typography variant="body2" sx={{ color: '#666' }}>
                <strong>Status:</strong> {selectedUser?.is_active ? 'Active' : 'Inactive'}
              </Typography>
              
              <Box>
                <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                  <strong>Roles:</strong>
                </Typography>
                {selectedUser?.roles && selectedUser.roles.length > 0 ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedUser.roles.map((role) => (
                      <Chip
                        key={role.id}
                        label={role.name}
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
                    No roles assigned
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        ) : isEditMode ? (
          // Edit mode with tabs
          <Box>
            {/* Tab Panel 0: Basic Information */}
            {activeTab === 0 && (
              <Stack spacing={2.5} component="form" id="user-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                <Controller
                  name="username"
                  control={control}
                  rules={{ 
                    required: 'Username is required',
                    minLength: { value: 3, message: 'Username must be at least 3 characters' }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Username"
                      fullWidth
                      size="small"
                      error={!!errors.username || usernameAvailability === false}
                      helperText={
                        errors.username?.message
                          ? errors.username.message
                          : usernameChecking
                            ? 'Checking availability...'
                            : usernameAvailability === false
                              ? 'Username already taken'
                              : 'Unique username for the user'
                      }
                      disabled={loading}
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
                          opacity: errors.username ? 1 : 0.7,
                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                        }
                      }}
                    />
                  )}
                />
                
                <Controller
                  name="email"
                  control={control}
                  rules={{ 
                    required: 'Email is required',
                    pattern: { 
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Email"
                      size="small"
                      error={!!errors.email}
                      helperText={errors.email?.message || 'User\'s email address'}
                      disabled={loading}
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
                          opacity: errors.email ? 1 : 0.7,
                          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                        }
                      }}
                    />
                  )}
                />
                
                <Controller
                  name="roles"
                  control={control}
                  rules={{ required: 'At least one role is required' }}
                  render={({ field }) => (
                    <Box sx={{ width: '100%' }}>
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          mb: 1, 
                          fontWeight: 500,
                          fontSize: '14px',
                          color: errors.roles ? '#d32f2f' : '#333333'
                        }}
                      >
                        Roles
                      </Typography>
                    <FormControl 
                      fullWidth 
                      error={!!errors.roles} 
                        size="small"
                    >
                      <Select
                        {...field}
                        multiple
                          displayEmpty
                          input={<OutlinedInput />}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.length === 0 ? (
                                <Typography sx={{ color: 'text.secondary', fontSize: '13px' }}>
                                  Select roles for this user
                                </Typography>
                              ) : (
                                selected.map((roleId) => {
                                  const role = roles.find(r => r.id === roleId);
                                  return (
                              <Chip 
                                      key={roleId} 
                                      label={role ? role.name : roleId} 
                                size="small" 
                                      sx={{
                                        height: 'auto',
                                        minHeight: '24px',
                                        fontSize: '12px',
                                        margin: '2px',
                                        bgcolor: '#f5f5f5',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '16px',
                                        color: '#333',
                                        '& .MuiChip-label': {
                                          padding: '4px 8px',
                                          whiteSpace: 'normal',
                                          lineHeight: '1.2',
                                          display: 'block'
                                        }
                                      }}
                                    />
                                  );
                                })
                              )}
                            </Box>
                        )}
                        MenuProps={{
                          PaperProps: {
                            style: {
                                maxHeight: 240,
                            },
                          },
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
                        >
                          {roles.map((role) => (
                            <MenuItem key={role.id} value={role.id} sx={{ fontSize: '13px' }}>
                            {role.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.roles && (
                          <FormHelperText sx={{ fontSize: '12px' }}>
                          {errors.roles.message}
                          </FormHelperText>
                      )}
                    </FormControl>
                    </Box>
                  )}
                />
                
                <Controller
                  name="is_active"
                  control={control}
                  render={({ field }) => (
                    <Box sx={{ width: '100%' }}>
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          mb: 1, 
                          fontWeight: 500,
                          fontSize: '14px',
                          color: '#333333'
                        }}
                      >
                        Status
                      </Typography>
                      <FormControl size="small" fullWidth>
                        <Select
                          {...field}
                          displayEmpty
                          value={field.value === true || field.value === 'true' || field.value === 1 ? true : false}
                          onChange={(e) => {
                            console.log('Status changed to:', e.target.value);
                            console.log('Status type:', typeof e.target.value);
                            // Ensure we pass a boolean value
                            const boolValue = Boolean(e.target.value === true || e.target.value === 'true' || e.target.value === 1);
                            console.log('Converted status value:', boolValue, 'type:', typeof boolValue);
                            field.onChange(boolValue);
                          }}
                          disabled={loading}
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
                        >
                          <MenuItem value={true}>
                            <Chip 
                              label="Active" 
                              color="success" 
                              size="small"
                              sx={{ 
                                fontWeight: 500,
                                height: '24px',
                                fontSize: '12px'
                              }}
                            />
                          </MenuItem>
                          <MenuItem value={false}>
                            <Chip 
                              label="Inactive" 
                              color="error"
                              variant="outlined"
                              size="small" 
                              sx={{ 
                                fontWeight: 500,
                                height: '24px',
                                fontSize: '12px'
                              }}
                            />
                          </MenuItem>
                        </Select>
                      </FormControl>
              </Box>
                  )}
                />
              </Stack>
            )}
            
            {/* Tab Panel 1: MFA Security */}
            {activeTab === 1 && selectedUser && (
              <Box sx={{ py: 1 }}>
                <MfaManagement 
                  user={selectedUser}
                  onMfaChange={() => {
                    // Optionally refresh user data
                    console.log('MFA status changed');
                  }}
                />
              </Box>
            )}
            
            {/* Tab Panel 2: Change Password */}
            {activeTab === 2 && selectedUser && (
              <Box sx={{ py: 2 }}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 2.5, 
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '6px'
                  }}
                >
                  <Stack spacing={2.5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <VpnKeyIcon color="primary" />
                      <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 500 }}>
                        Change Password for {selectedUser.username}
                      </Typography>
                    </Box>
                    
                    <Divider />
                    
                    {passwordError && (
                      <Alert severity="error" onClose={() => setPasswordError('')}>
                        {passwordError}
                      </Alert>
                    )}
                    
                    <TextField
                      fullWidth
                      type="password"
                      label="New Password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordError('');
                      }}
                      size="medium"
                      autoComplete="new-password"
                    />
                    
                    <TextField
                      fullWidth
                      type="password"
                      label="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError('');
                      }}
                      size="medium"
                      autoComplete="new-password"
                    />
                    
                    <Alert severity="info" icon={<VpnKeyIcon />}>
                      <Typography variant="caption">
                        Password must be at least 8 characters long and include uppercase, lowercase, numbers, and special characters.
                      </Typography>
                    </Alert>
                  </Stack>
                </Paper>
              </Box>
            )}
          </Box>
        ) : (
          // Create mode - original form
          <Stack spacing={2.5} component="form" id="user-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Controller
              name="username"
              control={control}
              rules={{ 
                required: 'Username is required',
                minLength: { value: 3, message: 'Username must be at least 3 characters' }
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Username"
                  fullWidth
                  size="small"
                  error={!!errors.username || usernameAvailability === false}
                  helperText={
                    errors.username?.message
                      ? errors.username.message
                      : usernameChecking
                        ? 'Checking availability...'
                        : usernameAvailability === false
                          ? 'Username already taken'
                          : 'Unique username for the user'
                  }
                  disabled={loading}
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
                      opacity: errors.username ? 1 : 0.7,
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    }
                  }}
                />
              )}
            />
            
            <Controller
              name="email"
              control={control}
              rules={{ 
                required: 'Email is required',
                pattern: { 
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Email"
                  size="small"
                  error={!!errors.email}
                  helperText={errors.email?.message || 'User\'s email address'}
                  disabled={loading}
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
                      opacity: errors.email ? 1 : 0.7,
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    }
                  }}
                />
              )}
            />
            
            {!isEditMode && (
              <>
                <Controller
                  name="password"
                  control={control}
                  rules={{ 
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                    validate: {
                      hasUppercase: (value) => 
                        /[A-Z]/.test(value) || 'Password must contain at least one uppercase letter',
                      hasLowercase: (value) => 
                        /[a-z]/.test(value) || 'Password must contain at least one lowercase letter',
                      hasNumber: (value) => 
                        /[0-9]/.test(value) || 'Password must contain at least one number',
                      hasSpecialChar: (value) => 
                        /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/.test(value) || 'Password must contain at least one special character'
                    }
                  }}
                  render={({ field }) => (
                    <Box sx={{ width: '100%' }}>
                    <TextField
                      {...field}
                        label="Password"
                        type="password"
                      fullWidth
                        size="small"
                      error={!!errors.password}
                        helperText={errors.password?.message || 'Minimum 8 characters with uppercase, lowercase, number, and special character'}
                        disabled={loading}
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
                            opacity: errors.password ? 1 : 0.7,
                            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                          }
                        }}
                      />
                      
                      {/* Password strength meter */}
                      <Collapse in={!!passwordValue}>
                        <Box sx={{ mt: 1, mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption" sx={{ mr: 1, fontSize: '11px', color: '#666' }}>
                              Password strength:
                    </Typography>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontWeight: 500,
                                fontSize: '11px',
                                color: passwordStrength < 50 ? '#f44336' : 
                                       passwordStrength < 75 ? '#ff9800' : 
                                       passwordStrength < 100 ? '#2196f3' : '#4caf50'
                              }}
                            >
                              {passwordStrength < 50 ? 'Weak' : 
                               passwordStrength < 75 ? 'Fair' : 
                               passwordStrength < 100 ? 'Good' : 'Strong'}
                            </Typography>
                          </Box>
                          
                    <LinearProgress 
                      variant="determinate" 
                      value={passwordStrength} 
                            sx={{ 
                              height: 4,
                              borderRadius: 2,
                              mb: 1,
                              backgroundColor: alpha('#000', 0.08),
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: passwordStrength < 50 ? '#f44336' : 
                                                passwordStrength < 75 ? '#ff9800' : 
                                                passwordStrength < 100 ? '#2196f3' : '#4caf50'
                              }
                            }}
                          />
                          
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {passwordChecks.length ? (
                                <CheckIcon sx={{ color: '#4caf50', fontSize: 14, mr: 0.5 }} />
                              ) : (
                                <ClearIcon sx={{ color: '#f44336', fontSize: 14, mr: 0.5 }} />
                              )}
                              <Typography variant="caption" sx={{ fontSize: '11px', color: '#666' }}>
                                8+ characters
                              </Typography>
                  </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {passwordChecks.uppercase ? (
                                <CheckIcon sx={{ color: '#4caf50', fontSize: 14, mr: 0.5 }} />
                              ) : (
                                <ClearIcon sx={{ color: '#f44336', fontSize: 14, mr: 0.5 }} />
                              )}
                              <Typography variant="caption" sx={{ fontSize: '11px', color: '#666' }}>
                                Uppercase letter
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {passwordChecks.lowercase ? (
                                <CheckIcon sx={{ color: '#4caf50', fontSize: 14, mr: 0.5 }} />
                              ) : (
                                <ClearIcon sx={{ color: '#f44336', fontSize: 14, mr: 0.5 }} />
                              )}
                              <Typography variant="caption" sx={{ fontSize: '11px', color: '#666' }}>
                                Lowercase letter
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {passwordChecks.number ? (
                                <CheckIcon sx={{ color: '#4caf50', fontSize: 14, mr: 0.5 }} />
                              ) : (
                                <ClearIcon sx={{ color: '#f44336', fontSize: 14, mr: 0.5 }} />
                              )}
                              <Typography variant="caption" sx={{ fontSize: '11px', color: '#666' }}>
                                Number
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {passwordChecks.specialChar ? (
                                <CheckIcon sx={{ color: '#4caf50', fontSize: 14, mr: 0.5 }} />
                              ) : (
                                <ClearIcon sx={{ color: '#f44336', fontSize: 14, mr: 0.5 }} />
                              )}
                              <Typography variant="caption" sx={{ fontSize: '11px', color: '#666' }}>
                                Special character
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Collapse>
                    </Box>
                  )}
                />
                
                {/* Confirm Password Field */}
                    <TextField
                      label="Confirm Password"
                  type="password"
                  fullWidth
                  size="small"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  error={!!passwordError}
                  helperText={passwordError || 'Re-enter your password to confirm'}
                  disabled={loading}
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
                      opacity: passwordError ? 1 : 0.7,
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    }
                  }}
                />
              </>
            )}
            
            <Controller
              name="roles"
              control={control}
              rules={{ required: 'At least one role is required' }}
              render={({ field }) => (
                <Box sx={{ width: '100%' }}>
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      mb: 1, 
                      fontWeight: 500,
                      fontSize: '14px',
                      color: errors.roles ? '#d32f2f' : '#333333'
                    }}
                  >
                    Roles
                  </Typography>
                <FormControl 
                  fullWidth 
                  error={!!errors.roles} 
                    size="small"
                >
                  <Select
                    {...field}
                    multiple
                      displayEmpty
                      input={<OutlinedInput />}
                    renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.length === 0 ? (
                            <Typography sx={{ color: 'text.secondary', fontSize: '13px' }}>
                              Select roles for this user
                            </Typography>
                          ) : (
                            selected.map((roleId) => {
                              const role = roles.find(r => r.id === roleId);
                              return (
                          <Chip 
                                  key={roleId} 
                                  label={role ? role.name : roleId} 
                            size="small" 
                                  sx={{
                                    height: 'auto',
                                    minHeight: '24px',
                                    fontSize: '12px',
                                    margin: '2px',
                                    bgcolor: '#f5f5f5',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '16px',
                                    color: '#333',
                                    '& .MuiChip-label': {
                                      padding: '4px 8px',
                                      whiteSpace: 'normal',
                                      lineHeight: '1.2',
                                      display: 'block'
                                    }
                                  }}
                                />
                              );
                            })
                          )}
                        </Box>
                    )}
                    MenuProps={{
                      PaperProps: {
                        style: {
                            maxHeight: 240,
                        },
                      },
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
                    >
                      {roles.map((role) => (
                        <MenuItem key={role.id} value={role.id} sx={{ fontSize: '13px' }}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.roles && (
                      <FormHelperText sx={{ fontSize: '12px' }}>
                      {errors.roles.message}
                      </FormHelperText>
                  )}
                </FormControl>
                </Box>
              )}
            />
            
            <Controller
              name="is_active"
              control={control}
              render={({ field }) => (
                <Box sx={{ width: '100%' }}>
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      mb: 1, 
                      fontWeight: 500,
                      fontSize: '14px',
                      color: '#333333'
                    }}
                  >
                    Status
                  </Typography>
                  <FormControl size="small" fullWidth>
                    <Select
                      {...field}
                      displayEmpty
                      value={field.value === true || field.value === 'true' || field.value === 1 ? true : false}
                      onChange={(e) => {
                        console.log('Status changed to:', e.target.value);
                        console.log('Status type:', typeof e.target.value);
                        // Ensure we pass a boolean value
                        const boolValue = Boolean(e.target.value === true || e.target.value === 'true' || e.target.value === 1);
                        console.log('Converted status value:', boolValue, 'type:', typeof boolValue);
                        field.onChange(boolValue);
                      }}
                      disabled={loading}
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
                    >
                      <MenuItem value={true}>
                        <Chip 
                          label="Active" 
                          color="success" 
                          size="small"
                          sx={{ 
                            fontWeight: 500,
                            height: '24px',
                            fontSize: '12px'
                          }}
                        />
                      </MenuItem>
                      <MenuItem value={false}>
                        <Chip 
                          label="Inactive" 
                          color="error"
                          variant="outlined"
                          size="small" 
                          sx={{ 
                            fontWeight: 500,
                            height: '24px',
                            fontSize: '12px'
                          }}
                        />
                      </MenuItem>
                    </Select>
                  </FormControl>
          </Box>
              )}
            />
          </Stack>
        )}
        </DialogContent>
      
      {!isViewMode && (
        <DialogActions sx={{ px: 2.5, py: 2, borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto', width: '100%', justifyContent: 'flex-end' }}>
          
          {/* Cancel button - show on Basic Info (0) and Change Password (2) tabs */}
          {(activeTab === 0 || activeTab === 2) && (
            <Button 
              variant="outlined"
              onClick={() => handleClose(false)}
              disabled={loading}
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
                minWidth: '80px',
                '&:hover': {
                  backgroundColor: alpha('#757575', 0.04),
                  borderColor: '#757575'
                }
              }}
            >
              Cancel
            </Button>
          )}
          
          {isDeleteMode ? (
          <Button 
            type="submit"
              form="user-form"
              variant="outlined"
              disabled={loading}
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
                minWidth: '100px',
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
              startIcon={loading ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
            >
              {loading ? 'Processing...' : 'Delete User'}
            </Button>
          ) : (
            <Button
              type={activeTab === 0 ? "submit" : "button"}
              form={activeTab === 0 ? "user-form" : undefined}
              onClick={activeTab === 1 ? () => handleClose(false) : activeTab === 2 ? handlePasswordChange : undefined}
              variant="outlined"
              disabled={loading || (activeTab === 0 && Object.keys(errors).length > 0) || (activeTab === 2 && (!newPassword || !confirmPassword))}
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
                color: '#1976d2',
                border: '1px solid #1976d2',
                minWidth: '100px',
                '&:hover': {
                  backgroundColor: alpha('#1976d2', 0.04),
                  borderColor: '#1976d2',
                  boxShadow: 'none'
                },
                '&:disabled': {
                  opacity: 0.6,
                  color: 'rgba(0, 0, 0, 0.26)',
                }
              }}
              startIcon={loading ? <CircularProgress size={16} /> : activeTab === 1 ? <CloseIcon fontSize="small" /> : activeTab === 2 ? <VpnKeyIcon fontSize="small" /> : isEditMode ? <SaveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
            >
              {loading ? 'Processing...' : activeTab === 1 ? 'Close' : activeTab === 2 ? 'Change Password' : isEditMode ? 'Save' : 'Create'}
          </Button>
          )}
        </Box>
        </DialogActions>
      )}
      
      {/* Password Change Dialog */}
      <Dialog 
        open={passwordDialogOpen} 
        onClose={loading ? null : handleClosePasswordDialog}
        maxWidth="xs"
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
          fontWeight: 500,
          fontSize: '1.125rem',
          color: '#333333',
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        }}>
          Change Password
        </DialogTitle>
        
        <DialogContent sx={{ p: 2.5, pt: 2 }}>
          <DialogContentText sx={{ 
            fontSize: '14px',
            color: '#505050',
            mb: 2
          }}>
            Enter a new password for user <strong>{selectedUser?.username}</strong>
          </DialogContentText>
          
          <Stack spacing={2.5}>
            <TextField
              autoFocus
              label="New Password"
              type="password"
              fullWidth
              size="small"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={!!passwordError}
              disabled={loading}
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
                }
              }}
            />
            
            <TextField
              label="Confirm Password"
              type="password"
              fullWidth
              size="small"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={!!passwordError}
              helperText={passwordError}
              disabled={loading}
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
                  fontSize: '12px',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                }
              }}
            />
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ px: 2.5, py: 2, borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            <Button 
              onClick={handleClosePasswordDialog} 
              disabled={loading}
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
              variant="outlined"
            >
              Cancel
            </Button>
            
            <Button 
              onClick={handlePasswordChange} 
              disabled={loading || !newPassword || !confirmPassword}
              startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
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
                color: '#1976d2',
                border: '1px solid #1976d2',
                '&:hover': {
                  backgroundColor: alpha('#1976d2', 0.04),
                  borderColor: '#1976d2',
                  boxShadow: 'none'
                },
                '&:disabled': {
                  opacity: 0.6,
                  color: 'rgba(0, 0, 0, 0.26)',
                }
              }}
              variant="outlined"
            >
              {loading ? 'Processing...' : 'Change Password'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default UserForm;