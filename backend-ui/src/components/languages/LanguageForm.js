import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControlLabel,
  Checkbox,
  Alert,
  Typography,
  IconButton,
  Paper
} from '@mui/material';
import { PhotoCamera, Delete, Add as AddIcon, Save as SaveIcon, Close as CloseIcon } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import SERVER_URL from '../common/BackendServerData';
import { useLanguage } from '../../contexts/LanguageContext';
import { API_CONFIG } from '../../config/apiConfig';

function LanguageForm({ open, onClose, language, mode = 'create' }) {
  const { createLanguage, updateLanguage, deleteLanguage } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    is_default: false,
    enabled: true
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef(null);

  // Initialize form data when language prop changes or mode changes
  useEffect(() => {
    if (mode === 'edit' || mode === 'delete') {
      if (language) {
        setFormData({
          id: language.id,
          name: language.name || '',
          code: language.code || '',
          is_default: language.is_default || false,
          enabled: language.enabled !== undefined ? language.enabled : true
        });
        
        // Set image preview if available
        if (language.image) {
          // IMPORTANT: The backend serves static files from /uploads
          const imageUrl = `${API_CONFIG.BASE_URL}/uploads/${language.image.replace(/^.*language_images\//, "language_images/")}`;
          setImagePreview(imageUrl);
          console.log(`Language ${language.name} image URL:`, {
            original: language.image,
            constructed: imageUrl
          });
        } else {
          setImagePreview('');
          console.log(`Language ${language.name} has no image`);
        }
      }
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        code: '',
        is_default: false,
        enabled: true
      });
      setImageFile(null);
      setImagePreview('');
    }
  }, [language, mode]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be 100 characters or less';
    }
    
    if (!formData.code.trim()) {
      newErrors.code = 'Code is required';
    } else if (formData.code.length < 2) {
      newErrors.code = 'Code must be at least 2 characters';
    } else if (formData.code.length > 10) {
      newErrors.code = 'Code must be 10 characters or less';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setSuccessMessage(null);
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Debug logs to check what's being sent
      console.log('Language form values being sent:', {
        name: formData.name,
        code: formData.code,
        is_default: formData.is_default,
        enabled: formData.enabled
      });
      
      let result;
      let successMsg;
      
      if (mode === 'create') {
        successMsg = 'Language created successfully';
        // Send raw data for create - context will create FormData
        const languageData = {
          name: formData.name,
          code: formData.code,
          is_default: formData.is_default,
          enabled: formData.enabled
        };
        
        // Add image if it exists
        if (imageFile) {
          languageData.image = imageFile;
        }
        
        result = await createLanguage(languageData);
      } else if (mode === 'edit') {
        successMsg = 'Language updated successfully';
        // Send raw data for update - context will create FormData
        const languageData = {
          name: formData.name,
          code: formData.code,
          is_default: formData.is_default,
          enabled: formData.enabled
        };
        
        // Add image if it exists
        if (imageFile) {
          languageData.image = imageFile;
        }
        
        result = await updateLanguage(formData.id, languageData);
      } else if (mode === 'delete') {
        successMsg = 'Language deleted successfully';
        result = await deleteLanguage(formData.id);
      }
      
      if (result) {
        setSuccessMessage(successMsg);
        
        // Close the form and refresh data after a brief delay
        setTimeout(() => {
          onClose(true);
        }, 500);
      } else {
        throw new Error(`Failed to ${mode} language`);
      }
    } catch (error) {
      console.error(`Error ${mode}ing language:`, error);
      setApiError(error.message || `Failed to ${mode} language`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    console.log(`Field ${name} changed to:`, newValue);
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: newValue
      };
      console.log('Updated formData:', updated);
      return updated;
    });
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setApiError(`Invalid file type. Allowed types: ${validTypes.map(t => t.split('/')[1]).join(', ')}`);
      return;
    }
    
    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setApiError(`File too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size: 2MB`);
      return;
    }
    
    // Clear any previous errors
    setApiError('');
    
    // Set the file for upload
    setImageFile(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.onerror = () => {
      setApiError('Error reading file');
      setImageFile(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancel = () => {
    onClose(false);
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
        text = 'Update';
        icon = <SaveIcon fontSize="small" />;
        color = '#1976d2';
        break;
      case 'delete':
        text = 'Delete';
        icon = <Delete fontSize="small" />;
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
        disabled={isSubmitting}
        startIcon={isSubmitting ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : icon}
      >
        {isSubmitting ? 'Processing...' : text}
      </Button>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={() => onClose(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ 
        fontWeight: 500, 
        fontSize: '16px', 
        color: '#505050',
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        padding: '16px 24px',
      }}>
        {mode === 'create' ? 'Create New Language' : mode === 'edit' ? 'Edit Language' : 'Delete Language'}
      </DialogTitle>
      
      <DialogContent sx={{ padding: '0px' }}>
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
            <form onSubmit={handleSubmit}>
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
                    Delete this language?
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
                    This action cannot be undone. Content in this language may be lost.
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
                      <strong>Name:</strong> {formData.name}
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
                      <strong>Code:</strong> {formData.code}
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
                      <strong>Default Language:</strong> {formData.is_default ? 'Yes' : 'No'}
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
                      <strong>Enabled:</strong> {formData.enabled ? 'Yes' : 'No'}
                    </Typography>
                  </Box>
                </Box>
              </Alert>
              
              {/* Display image in read-only mode for delete */}
              {imagePreview && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 500, color: '#505050', mb: 1 }}>
                    Language Flag/Image
                  </Typography>
                  <Paper 
                    elevation={1} 
                    sx={{ 
                      p: 2, 
                      backgroundColor: '#f5f5f5', 
                      textAlign: 'center',
                      borderRadius: '4px' 
                    }}
                  >
                    <img 
                      src={imagePreview} 
                      alt={`${formData.name} flag`} 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '150px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '4px'
                      }} 
                      onError={(e) => {
                        console.error("Error loading image:", e);
                        e.target.onerror = null;
                        e.target.src = ''; // Clear the src to prevent further attempts
                        e.target.alt = 'Image failed to load';
                        e.target.style.display = 'none';
                      }}
                    />
                    <Typography variant="body2" color="error" sx={{ mt: 1, fontSize: '12px' }}>
                      Warning: This image will be permanently deleted.
                    </Typography>
                  </Paper>
                </Box>
              )}
              
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
                {getActionButton()}
              </Box>
            </form>
          ) : (
            // Create/Edit form UI
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  error={!!errors.name}
                  helperText={errors.name}
                  disabled={isSubmitting}
                  size="small"
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
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    }
                  }}
                />
                
                <TextField
                  fullWidth
                  label="Code"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  error={!!errors.code}
                  helperText={errors.code}
                  disabled={isSubmitting}
                  size="small"
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
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    }
                  }}
                />
                
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.is_default}
                      onChange={handleChange}
                      name="is_default"
                      disabled={isSubmitting}
                      sx={{
                        color: '#1976d2',
                        '&.Mui-checked': {
                          color: '#1976d2',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography
                      sx={{
                        fontSize: '13px',
                        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                        color: '#505050',
                      }}
                    >
                      Default Language
                    </Typography>
                  }
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(formData.enabled)}
                      onChange={handleChange}
                      name="enabled"
                      disabled={isSubmitting}
                      sx={{
                        color: '#1976d2',
                        '&.Mui-checked': {
                          color: '#1976d2',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography
                      sx={{
                        fontSize: '13px',
                        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                        color: '#505050',
                      }}
                    >
                      Enabled
                    </Typography>
                  }
                />

                {/* Image Upload Section */}
                <Box sx={{ mt: 1 }}>
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      fontWeight: 500, 
                      color: '#505050',
                      fontSize: '13px',
                      mb: 1,
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    }}
                  >
                    Language Flag/Image
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<PhotoCamera />}
                      sx={{
                        borderRadius: '4px',
                        textTransform: 'none',
                        fontWeight: 400,
                        fontSize: '13px',
                        py: 0.5,
                        height: '32px',
                        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                        color: '#1976d2',
                        border: '1px solid #1976d2',
                        '&:hover': {
                          backgroundColor: alpha('#1976d2', 0.04),
                          borderColor: '#1976d2'
                        }
                      }}
                    >
                      Upload Image
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handleImageChange}
                      />
                    </Button>
                    {imagePreview && (
                      <IconButton 
                        color="error" 
                        onClick={handleRemoveImage}
                        size="small"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                  {imagePreview && (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <img 
                        src={imagePreview} 
                        alt="Language preview" 
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '150px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          padding: '4px'
                        }} 
                        onError={(e) => {
                          console.error("Error loading image preview:", e);
                          e.target.onerror = null;
                          e.target.src = ''; // Clear the src to prevent further attempts
                          e.target.alt = 'Image failed to load';
                          e.target.style.display = 'none';
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
              
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
                {getActionButton()}
              </Box>
            </form>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default LanguageForm;
