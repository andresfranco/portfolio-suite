import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { 
  Box, 
  TextField, 
  Button, 
  Stack, 
  Alert,
  CircularProgress,
  Typography,
  InputAdornment
} from '@mui/material';
import { useCategoryType } from '../../contexts/CategoryTypeContext';
import { logInfo, logError } from '../../utils/logger';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import ErrorIcon from '@mui/icons-material/Error';

const CategoryTypeForm = ({ mode = 'create', initialData = null, onClose }) => {
  const [apiError, setApiError] = useState(null);
  const [apiSuccess, setApiSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeExists, setCodeExists] = useState(false);
  const [codeValidationError, setCodeValidationError] = useState('');
  const { createCategoryType, updateCategoryType, deleteCategoryType, checkCodeExists } = useCategoryType();

  const { control, handleSubmit, reset, watch, setError, clearErrors, formState: { errors, isValid, isDirty } } = useForm({
    defaultValues: {
      code: '',
      name: ''
    },
    mode: 'onChange'
  });

  const watchedCode = watch('code');

  useEffect(() => {
    setApiError(null);
    setApiSuccess(null);
    setCodeExists(false);
    setCodeValidationError('');
    
    if (initialData && (mode === 'edit' || mode === 'delete')) {
      const defaultValues = {
        code: initialData.code || '',
        name: initialData.name || ''
      };
      logInfo('Resetting form with initial data for edit/delete:', defaultValues);
      reset(defaultValues);
    } else if (mode === 'create') {
      const createDefaults = {
        code: '',
        name: ''
      };
      logInfo('Resetting form for create mode:', createDefaults);
      reset(createDefaults);
    }
  }, [initialData, mode, reset]);

  // Real-time code validation with debouncing
  useEffect(() => {
    const validateCode = async () => {
      // Only validate if we're in create mode and have a non-empty code
      if (mode !== 'create' || !watchedCode || watchedCode.trim() === '') {
        setCodeExists(false);
        setCodeValidationError('');
        clearErrors('code');
        return;
      }

      setIsCheckingCode(true);
      setCodeValidationError('');
      
      try {
        const exists = await checkCodeExists(watchedCode.trim());
        setCodeExists(exists);
        
        if (exists) {
          const errorMessage = `Code '${watchedCode.trim()}' already exists`;
          setCodeValidationError(errorMessage);
          setError('code', {
            type: 'manual',
            message: errorMessage
          });
        } else {
          setCodeValidationError('');
          clearErrors('code');
        }
      } catch (error) {
        logError('Error checking code existence:', error);
        setCodeValidationError('Error validating code');
      } finally {
        setIsCheckingCode(false);
      }
    };

    // Debounce the validation
    const debounceTimer = setTimeout(validateCode, 500);
    return () => clearTimeout(debounceTimer);
  }, [watchedCode, mode, checkCodeExists, setError, clearErrors]);

  const onSubmit = async (formData) => {
    // Additional validation before submit
    if (mode === 'create' && codeExists) {
      setApiError(`Code '${formData.code}' already exists. Please choose a different code.`);
      return;
    }

    setApiError(null);
    setApiSuccess(null);
    setIsSubmitting(true);
    
    const apiData = {
      code: formData.code,
      name: formData.name
    };

    try {
      if (mode === 'create') {
        logInfo('Creating category type:', apiData);
        await createCategoryType(apiData);
        setApiSuccess('Category type created successfully!');
        reset({ code: '', name: '' });
        setTimeout(() => {
          if (onClose) onClose(true);
        }, 1500);
      } else if (mode === 'edit' && initialData?.code) {
        const updatePayload = { name: apiData.name }; // Don't include code in update
        logInfo(`Updating category type ${initialData.code}:`, updatePayload);
        await updateCategoryType(initialData.code, updatePayload);
        setApiSuccess('Category type updated successfully!');
        setTimeout(() => {
          if (onClose) onClose(true);
        }, 1500);
      } else if (mode === 'delete' && initialData?.code) {
        logInfo(`Deleting category type ${initialData.code}`);
        await deleteCategoryType(initialData.code);
        setApiSuccess('Category type deleted successfully!');
        setTimeout(() => {
          if (onClose) onClose(true);
        }, 1500);
      }
    } catch (error) {
      logError('API error:', error);
      setApiError(error.message || 'An error occurred during the operation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to get code field validation icon
  const getCodeValidationIcon = () => {
    if (mode !== 'create' || !watchedCode || watchedCode.trim() === '') {
      return null;
    }
    
    if (isCheckingCode) {
      return <CircularProgress size={16} />;
    }
    
    if (codeExists) {
      return <ErrorIcon fontSize="small" sx={{ color: '#e53935' }} />;
    }
    
    if (watchedCode.trim() !== '' && !codeExists) {
      return <CheckIcon fontSize="small" sx={{ color: '#4caf50' }} />;
    }
    
    return null;
  };

  if (mode === 'delete') {
    return (
      <Box sx={{ p: 2 }}>
        <Alert 
          severity="error" 
          variant="outlined"
          sx={{ 
            p: 2,
            borderRadius: '4px',
            border: '1px solid #ffcdd2',
            backgroundColor: alpha('#ffebee', 0.3),
            mb: 3,
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
              Delete this category type?
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
              This action cannot be undone and may affect categories using this type.
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
                <strong>Code:</strong> {initialData?.code}
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
                <strong>Name:</strong> {initialData?.name}
              </Typography>
            </Box>
          </Box>
        </Alert>
        
        {apiError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {apiError}
          </Alert>
        )}
        
        {apiSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {apiSuccess}
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button 
            variant="outlined" 
            onClick={() => onClose(false)}
            disabled={apiSuccess || isSubmitting}
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
              },
              '&.Mui-disabled': {
                opacity: 0.6,
                color: 'rgba(0, 0, 0, 0.26)',
                borderColor: 'rgba(0, 0, 0, 0.12)'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="outlined" 
            onClick={handleSubmit(onSubmit)}
            disabled={apiSuccess || isSubmitting}
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
              '&.Mui-disabled': {
                opacity: 0.6,
                color: 'rgba(0, 0, 0, 0.26)',
                borderColor: 'rgba(0, 0, 0, 0.12)'
              }
            }}
          >
            {isSubmitting ? 'Processing...' : 'Delete'}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Controller
          name="code"
          control={control}
          rules={{ 
            required: 'Code is required',
            minLength: { value: 1, message: 'Code must be at least 1 character' },
            maxLength: { value: 5, message: 'Code must not exceed 5 characters' }
          }}
          render={({ field }) => (
            <Box>
              <TextField
                {...field}
                label="Code"
                size="small"
                fullWidth
                error={!!errors.code}
                helperText={errors.code?.message}
                disabled={mode === 'edit' || apiSuccess || isSubmitting}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {getCodeValidationIcon()}
                    </InputAdornment>
                  ),
                }}
              />
              {mode === 'create' && watchedCode && watchedCode.trim() !== '' && !errors.code && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 0.5,
                    fontSize: '11px',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    color: isCheckingCode ? '#757575' : 
                           codeExists ? '#e53935' : '#4caf50'
                  }}
                >
                  {isCheckingCode ? 'Checking code availability...' :
                   codeExists ? `Code '${watchedCode.trim()}' is already in use` :
                   `Code '${watchedCode.trim()}' is available`}
                </Typography>
              )}
            </Box>
          )}
        />

        <Controller
          name="name"
          control={control}
          rules={{ 
            required: 'Name is required',
            minLength: { value: 1, message: 'Name must be at least 1 character' },
            maxLength: { value: 100, message: 'Name must not exceed 100 characters' }
          }}
          render={({ field }) => (
            <TextField
              {...field}
              label="Name"
              size="small"
              fullWidth
              error={!!errors.name}
              helperText={errors.name?.message}
              disabled={apiSuccess || isSubmitting}
            />
          )}
        />

        {apiError && (
          <Alert severity="error">
            {apiError}
          </Alert>
        )}

        {apiSuccess && (
          <Alert severity="success">
            {apiSuccess}
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button 
            type="button"
            variant="outlined" 
            onClick={() => onClose(false)}
            disabled={apiSuccess || isSubmitting}
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
              },
              '&.Mui-disabled': {
                opacity: 0.6,
                color: 'rgba(0, 0, 0, 0.26)',
                borderColor: 'rgba(0, 0, 0, 0.12)'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="outlined"
            disabled={!isValid || !isDirty || apiSuccess || isSubmitting || (mode === 'create' && (isCheckingCode || codeExists))}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : 
              mode === 'create' ? <AddIcon fontSize="small" /> : <SaveIcon fontSize="small" />
            }
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
              '&.Mui-disabled': {
                opacity: 0.6,
                color: 'rgba(0, 0, 0, 0.26)',
                borderColor: 'rgba(0, 0, 0, 0.12)'
              }
            }}
          >
            {isSubmitting 
              ? 'Processing...' 
              : (mode === 'create' ? 'Create' : 'Save')
            }
          </Button>
        </Box>
      </Stack>
    </Box>
  );
};

export default CategoryTypeForm; 