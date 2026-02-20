import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  Stack,
  CircularProgress,
  Divider
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';
import { alpha } from '@mui/material/styles';
import { logInfo, logError } from '../../utils/logger';
import { api } from '../../services/api';

function PortfolioForm({ open, onClose, portfolio, mode = 'create' }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: ''
  });

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize form data when portfolio prop changes or mode changes
  useEffect(() => {
    if (mode === 'edit' || mode === 'delete') {
      if (portfolio) {
        logInfo('PortfolioForm', 'Initializing form with portfolio:', portfolio);
        
        setFormData({
          id: portfolio.id || '',
          name: portfolio.name || '',
          description: portfolio.description || ''
        });
      }
    } else {
      // Reset form for create mode
      setFormData({
        id: '',
        name: '',
        description: ''
      });
    }
    
    // Reset other states when form opens
    setErrors({});
    setApiError('');
    setIsSubmitting(false);
  }, [portfolio, mode, open]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Portfolio name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Portfolio name must be at least 2 characters long';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    
    // Skip validation for delete mode
    if (mode !== 'delete') {
      const isValid = validateForm();
      if (!isValid) {
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      // Build request using authenticated api client (adds Authorization header)
      let response;
      if (mode === 'create') {
        response = await api.post('/api/portfolios/', {
          name: formData.name.trim(),
          description: formData.description?.trim() || ''
        });
      } else if (mode === 'edit') {
        response = await api.put(`/api/portfolios/${formData.id}`, {
          name: formData.name.trim(),
          description: formData.description?.trim() || ''
        });
      } else if (mode === 'delete') {
        response = await api.delete(`/api/portfolios/${formData.id}`);
      }
      
      logInfo('PortfolioForm', `Portfolio ${mode}d successfully`, response?.data);
      onClose(true);
    } catch (error) {
      logError('PortfolioForm', `Error ${mode}ing portfolio:`, error);
      setApiError(error.message || `Failed to ${mode} portfolio`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleCancel = (e) => {
    e.preventDefault();
    onClose(false);
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'create':
        return 'Create New Portfolio';
      case 'edit':
        return 'Edit Portfolio';
      case 'delete':
        return 'Delete Portfolio';
      default:
        return 'Portfolio';
    }
  };

  const renderDeleteConfirmation = () => {
    if (mode !== 'delete') return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{
            backgroundColor: alpha('#ffebee', 0.3),
            border: '1px solid #ffcdd2',
            '& .MuiAlert-message': {
              color: '#e53935',
              fontWeight: 500
            }
          }}
        >
          <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>
            Are you sure you want to delete this portfolio?
          </Typography>
          <Typography variant="body2">
            This action will permanently delete "{formData.name}" and all associated data. 
            This action cannot be undone.
          </Typography>
        </Alert>

        <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Portfolio Details:
          </Typography>
          <Typography variant="body2"><strong>Name:</strong> {formData.name}</Typography>
          {formData.description && (
            <Typography variant="body2"><strong>Description:</strong> {formData.description}</Typography>
          )}
        </Box>
      </Box>
    );
  };

  const renderFormBody = () => {
    if (mode === 'delete') {
      return renderDeleteConfirmation();
    }

    return (
      <Stack spacing={3}>
        <TextField
          fullWidth
          label="Portfolio Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          error={!!errors.name}
          helperText={errors.name}
          required
          disabled={loading}
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              height: '40px',
              '&.Mui-focused fieldset': {
                borderColor: '#1976d2'
              }
            }
          }}
        />
        
        <TextField
          fullWidth
          label="Description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          multiline
          rows={4}
          disabled={loading}
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused fieldset': {
                borderColor: '#1976d2'
              }
            }
          }}
        />
      </Stack>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={() => onClose(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
        }
      }}
    >
      <DialogTitle sx={{
        pb: 1,
        fontSize: '1.25rem',
        fontWeight: 600,
        color: mode === 'delete' ? '#e53935' : '#1976d2'
      }}>
        {getDialogTitle()}
      </DialogTitle>
      
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pb: 2 }}>
          {apiError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {apiError}
            </Alert>
          )}
          
          {renderFormBody()}
        </DialogContent>
        
        <Divider />
        
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={handleCancel}
            variant="outlined"
            sx={{
              borderColor: '#e0e0e0',
              color: '#757575',
              '&:hover': {
                borderColor: '#bdbdbd',
                backgroundColor: '#f5f5f5'
              }
            }}
          >
            <CloseIcon sx={{ mr: 1, fontSize: '18px' }} />
            Cancel
          </Button>
          
          <Button 
            type="submit" 
            variant="outlined"
            color={mode === 'delete' ? 'error' : 'primary'}
            disabled={isSubmitting || loading}
            sx={{
              minWidth: '120px',
              boxShadow: mode === 'delete' ? 
                '0 2px 4px rgba(229,57,53,0.2)' : 
                '0 2px 4px rgba(25,118,210,0.2)',
              '&:hover': {
                boxShadow: mode === 'delete' ? 
                  '0 4px 8px rgba(229,57,53,0.3)' : 
                  '0 4px 8px rgba(25,118,210,0.3)'
              }
            }}
          >
            {isSubmitting ? (
              <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
            ) : mode === 'delete' ? (
              <DeleteOutlineIcon sx={{ mr: 1, fontSize: '18px' }} />
            ) : (
              <SaveIcon sx={{ mr: 1, fontSize: '18px' }} />
            )}
            {isSubmitting 
              ? `${mode === 'create' ? 'Creating' : mode === 'edit' ? 'Saving' : 'Deleting'}...`
              : mode === 'create' 
                ? 'Create Portfolio'
                : mode === 'edit' 
                  ? 'Save Changes' 
                  : 'Delete Portfolio'
            }
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default PortfolioForm;
