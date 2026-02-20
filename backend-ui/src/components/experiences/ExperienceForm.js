import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Stack,
  Grid,
  FormHelperText,
  CircularProgress,
  Chip,
  Paper,
  IconButton,
  Divider,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';
import RichTextEditor from '../common/RichTextEditor';
import { useExperience } from '../../contexts/ExperienceContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import PermissionGate from '../common/PermissionGate';
import { alpha } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SERVER_URL from '../common/BackendServerData';

function ExperienceForm({ open, onClose, experience, mode = 'create' }) {
  const { createExperience, updateExperience, deleteExperience, checkCodeExists } = useExperience();
  const { languages: availableLanguages, loading: loadingLanguages, fetchLanguages } = useLanguage();
  const { canPerformOperation } = useAuthorization();

  const [formData, setFormData] = useState({
    id: '',
    code: '',
    years: '',
    experience_texts: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [languageTexts, setLanguageTexts] = useState({});
  const [errors, setErrors] = useState({});
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeExists, setCodeExists] = useState(false);
  const [removedLanguageIds, setRemovedLanguageIds] = useState([]);
  const [originalLanguageIds, setOriginalLanguageIds] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch languages when the form opens
  useEffect(() => {
    if (open) {
      fetchLanguages(1, 100, {}).then(() => {
      }).catch(error => {
        console.error('Error fetching languages:', error);
        setApiError('Failed to load languages: ' + error.message);
      });
    }
  }, [open, fetchLanguages]);

  // Auto-add default language in create mode when languages become available
  useEffect(() => {
    if (mode === 'create' && 
        availableLanguages && 
        availableLanguages.length > 0 && 
        selectedLanguages.length === 0 && 
        !loadingLanguages) {
      
      // Find the default language or use the first available one
      const defaultLanguage = availableLanguages.find(lang => lang.is_default) || availableLanguages[0];
      
      if (defaultLanguage) {
        
        // Add the default language
        setSelectedLanguages([defaultLanguage]);
        
        // Initialize the language texts for this language
        setLanguageTexts({
          [defaultLanguage.id]: {
            id: null,
            name: '',
            description: ''
          }
        });
        
        // Update formData.experience_texts to include the new language
        setFormData(prev => ({
          ...prev,
          experience_texts: [{
            name: '',
            description: '',
            language_id: defaultLanguage.id,
            language: defaultLanguage
          }]
        }));
      }
    }
  }, [mode, availableLanguages, selectedLanguages.length, loadingLanguages]);

  // Effect to load experience data if in edit or delete mode
  useEffect(() => {
    if ((mode === 'edit' || mode === 'delete') && experience) {
      
      // Directly process the experience prop
      const formattedData = {
        ...experience,
        experience_texts: Array.isArray(experience.experience_texts) ? experience.experience_texts : []
      };
      
      
      // Extract all languages and texts from experience_texts
      const textsMap = {};
      const languageList = [];
      const originalIds = []; // Track original language IDs
      
      formattedData.experience_texts.forEach(text => {
        const langId = text.language_id || (text.language && text.language.id);
        
        if (langId) {
          originalIds.push(langId);
          
          // Find or create the language object for this text
          let langObj = null;
          if (text.language && typeof text.language === 'object') {
            langObj = {
              id: text.language.id,
              code: text.language.code || `lang-${text.language.id}`,
              name: text.language.name || `Language ${text.language.id}`,
              is_default: text.language.is_default || false
            };
          } else if (availableLanguages && availableLanguages.length > 0) {
            langObj = availableLanguages.find(lang => lang.id === langId);
          }
          
          // If language not found yet (e.g., availableLanguages still loading), create minimal representation
          if (!langObj) {
            langObj = {
              id: langId,
              code: `lang-${langId}`,
              name: `Language ${langId}`,
              is_default: false
            };
          }
          
          // Add to language list if valid and not already added
          if (langObj && !languageList.some(l => l.id === langObj.id)) {
            languageList.push(langObj);
          }
          
          // Always add to texts map
          textsMap[langId] = {
            id: text.id || null, 
            name: text.name || '',
            description: text.description || ''
          };
        }
      });


      // Set the form data
      setFormData(formattedData);
      
      // Add a timeout to check if the formData was set correctly
      setTimeout(() => {
      }, 100);
      
      setSelectedLanguages(languageList);
      setLanguageTexts(textsMap);
      setOriginalLanguageIds(originalIds);
      setRemovedLanguageIds([]);
    } else if (mode === 'create') {
      // Reset form for create mode
      setFormData({
        id: '',
        code: '',
        years: '',
        experience_texts: []
      });
      setSelectedLanguages([]);
      setLanguageTexts({});
      setRemovedLanguageIds([]);
      setOriginalLanguageIds([]);
    }
  }, [experience, mode, availableLanguages]);

  // Debug: Log formData whenever it changes
  useEffect(() => {
  }, [formData, mode]);

  // Check if code exists when code changes
  useEffect(() => {
    const checkCodeExistsDebounced = async () => {
      if (!formData.code || formData.code.trim() === '') {
        setCodeExists(false);
        return;
      }


      setIsCheckingCode(true);
      try {
        const result = await checkCodeExists(formData.code, formData.id || null);
        
        setCodeExists(result.exists);
        if (result.exists) {
          setErrors(prev => ({ ...prev, code: 'Code already exists' }));
        } else {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.code;
            return newErrors;
          });
        }
      } catch (error) {
        console.error('Error checking code:', error);
        // Don't set error state for this operation
      } finally {
        setIsCheckingCode(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      checkCodeExistsDebounced();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [formData.code, formData.id, checkCodeExists]);

  // Validate form
  const validateForm = async () => {
    
    const newErrors = {};
    
    // Validate code
    if (!formData.code) {
      newErrors.code = 'Code is required';
    } else if (codeExists) {
      newErrors.code = 'Code already exists';
    }
    
    // Validate years
    if (!formData.years) {
      newErrors.years = 'Years is required';
    } else if (isNaN(formData.years) || parseInt(formData.years) < 0) {
      newErrors.years = 'Years must be a positive number';
    }
    
    // Validate that at least one language is selected
    if (selectedLanguages.length === 0) {
      newErrors.languages = 'At least one language must be selected';
    }
    
    // Validate each language has name and description
    const languageErrors = {};
    selectedLanguages.forEach(lang => {
      const langId = lang.id;
      const langTexts = languageTexts[langId] || {};
      
      if (!langTexts.name || langTexts.name.trim() === '') {
        languageErrors[`${langId}_name`] = 'Name is required';
      }
      
      if (!langTexts.description || langTexts.description.trim() === '') {
        languageErrors[`${langId}_description`] = 'Description is required';
      }
    });
    
    const allErrors = { ...newErrors, ...languageErrors };
    const isValid = Object.keys(newErrors).length === 0 && Object.keys(languageErrors).length === 0;
    
    
    setErrors(allErrors);
    return isValid;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    setApiError('');
    
    // Skip validation for delete mode
    if (mode === 'delete') {
      handleDelete();
      return;
    }
    
    const isValid = await validateForm();
    if (!isValid) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const submitData = prepareSubmitData();
      
      let result;
      
      if (mode === 'create') {
        result = await createExperience(submitData);
      } else if (mode === 'edit') {
        result = await updateExperience(formData.id, submitData);
      }
      
      onClose(true); // Close and refresh data
    } catch (error) {
      console.error('Error saving experience:', error);
      setApiError(error.message || 'An error occurred while saving the experience');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    setIsSubmitting(true);
    
    try {
      await deleteExperience(formData.id);
      onClose(true); // Close and refresh data
    } catch (error) {
      console.error('Error deleting experience:', error);
      setApiError(error.message || 'An error occurred while deleting the experience');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle adding a language
  const handleAddLanguage = () => {
    // Get the already selected language IDs
    const selectedLangIds = selectedLanguages.map(lang => lang.id);
    
    
    // Find available languages that are not already selected
    const availableToAdd = availableLanguages.filter(
      lang => !selectedLangIds.includes(lang.id)
    );
    
    
    if (availableToAdd.length > 0) {
      // Add the first available language
      const langToAdd = availableToAdd[0];
      
      // Update the selected languages array
      setSelectedLanguages(prev => [...prev, langToAdd]);
      
      // Initialize the language texts for this language
      setLanguageTexts(prev => ({
        ...prev,
        [langToAdd.id]: {
          id: null, // No ID for a new text
          name: '',
          description: ''
        }
      }));
      
      // Also update formData.experience_texts to include the new language
      setFormData(prev => {
        // First filter out any existing entry for this language to avoid duplicates
        const filteredTexts = prev.experience_texts.filter(text => {
          const textLangId = text.language_id || (text.language ? text.language.id : null);
          return textLangId !== langToAdd.id;
        });
        
        // Then add the new entry
        return {
          ...prev,
          experience_texts: [
            ...filteredTexts,
            {
              name: '',
              description: '',
              language_id: langToAdd.id,
              language: langToAdd // Include the language object for UI display
            }
          ]
        };
      });
      
      // If this language was previously removed, remove it from the removed list
      if (removedLanguageIds.includes(langToAdd.id)) {
        setRemovedLanguageIds(removedLanguageIds.filter(id => id !== langToAdd.id));
      }
    } else {
      setApiError('All languages are already added or no languages available');
      console.error('No languages available to add', {
        availableLanguages: availableLanguages?.length || 0,
        selectedLanguages: selectedLangIds
      });
    }
  };

  // Handle removing a language
  const handleRemoveLanguage = (langId) => {
    // Remove the language from selected languages
    setSelectedLanguages(selectedLanguages.filter(lang => lang.id !== langId));
    
    // Also remove the language from formData.experience_texts
    setFormData(prev => ({
      ...prev,
      experience_texts: prev.experience_texts.filter(text => {
        const textLangId = text.language_id || (text.language ? text.language.id : null);
        return textLangId !== langId;
      })
    }));
    
    // Remove from languageTexts object
    setLanguageTexts(prev => {
      const newTexts = { ...prev };
      delete newTexts[langId];
      return newTexts;
    });
    
    // If this language was in the original set, add it to removed list
    if (originalLanguageIds.includes(langId)) {
      setRemovedLanguageIds([...removedLanguageIds, langId]);
    }
    
    // Clear any errors for this language
    const newErrors = { ...errors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`${langId}_`)) {
        delete newErrors[key];
      }
    });
    setErrors(newErrors);
    
  };

  // Handle text changes for a language
  const handleTextChange = (langId, field, value) => {
    
    // Update the languageTexts state
    setLanguageTexts(prev => {
      const updatedTexts = {
        ...prev,
        [langId]: {
          ...(prev[langId] || {}),  // Make sure we have an object to spread
          [field]: value
        }
      };
      
      
      return updatedTexts;
    });
    
    // Also update the formData.experience_texts to keep everything in sync
    setFormData(prev => {
      // Find if this language already exists in the texts
      const textIndex = prev.experience_texts.findIndex(text => {
        const textLangId = text.language_id || (text.language && text.language.id);
        return textLangId === langId;
      });
      
      let updatedExperienceTexts;
      
      if (textIndex >= 0) {
        // Update existing text
        updatedExperienceTexts = [...prev.experience_texts];
        updatedExperienceTexts[textIndex] = {
          ...updatedExperienceTexts[textIndex],
          [field]: value
        };
      } else {
        // Add new text if not found
        const newText = {
          language_id: langId,
          [field]: value
        };
        
        // Try to add language object if available
        const langObj = selectedLanguages.find(lang => lang.id === langId);
        if (langObj) {
          newText.language = langObj;
        }
        
        updatedExperienceTexts = [...prev.experience_texts, newText];
      }
      
      return {
        ...prev,
        experience_texts: updatedExperienceTexts
      };
    });
    
    // Clear any errors for this field
    if (errors[`${langId}_${field}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${langId}_${field}`];
        return newErrors;
      });
    }
  };

  // Get dialog title based on mode
  const getDialogTitle = () => {
    switch (mode) {
      case 'create':
        return 'Create New Experience';
      case 'edit':
        return 'Edit Experience';
      case 'delete':
        return 'Delete Experience';
      default:
        return 'Experience';
    }
  };

  // Render delete confirmation
  const renderDeleteConfirmation = () => {
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
              Delete this experience?
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
              This action cannot be undone. All associated translations will also be deleted.
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
                <strong>Code:</strong> {formData.code}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#505050',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  fontSize: '13px'
                }}
              >
                <strong>Years:</strong> {formData.years}
              </Typography>
            </Box>
            
            {/* Languages and Experience Names */}
            {selectedLanguages.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#505050',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    mb: 1
                  }}
                >
                  <strong>Content to be deleted:</strong>
                </Typography>
                
                <Box sx={{ pl: 2 }}>
                  {selectedLanguages.map((lang) => {
                    const langId = lang.id;
                    const langTexts = languageTexts[langId] || {};
                    
                    return (
                      <Box key={langId} sx={{ mb: 1 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: '#505050',
                            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 0.5
                          }}
                        >
                          <span style={{ fontWeight: 500, minWidth: '80px' }}>
                            {lang.name}:
                          </span>
                          <span style={{ flexGrow: 1 }}>
                            {langTexts.name || 'No name set'}
                          </span>
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>
        </Alert>
        
        {apiError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {apiError}
          </Alert>
        )}
      </Box>
    );
  };

  // Handle text change for base fields
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    
    setFormData(prev => {
      const newFormData = {
        ...prev,
        [name]: value
      };
      
      
      return newFormData;
    });
    
    // Clear error for this field if any
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  // Prepare data for submission
  const prepareSubmitData = () => {
    // Get only the currently selected language IDs
    const currentLanguageIds = selectedLanguages.map(lang => lang.id);
    
    // Only include language texts for languages that are still selected
    const filteredLanguageTexts = {};
    Object.entries(languageTexts).forEach(([langId, text]) => {
      if (currentLanguageIds.includes(Number(langId))) {
        filteredLanguageTexts[langId] = text;
      }
    });
    
    
    
    // Prepare data for submission
    const submitData = {
      code: formData.code,
      years: parseInt(formData.years),
      // Format experience_texts properly and exclude removed languages
      experience_texts: Object.entries(filteredLanguageTexts).map(([langId, text]) => {
        const experienceText = {
          language_id: Number(langId),
          name: text.name || '',
          description: text.description || ''
        };
        
        // Only include ID if it exists and we're in edit mode (for updating existing texts)
        if (mode === 'edit' && text.id && text.id !== null) {
          experienceText.id = text.id;
        }
        
        return experienceText;
      })
    };
    
    // Include removed_language_ids only for edit mode
    if (mode === 'edit') {
      submitData.removed_language_ids = removedLanguageIds;
    }
    
    
    return submitData;
  };

  // Render the form body for regular modes (create/edit)
  const renderFormBody = () => {
    return (
      <form>
        <Grid container spacing={2}>
          {/* Base field section */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              id="code"
              name="code"
              label="Code"
              value={formData.code || ''}
              onChange={handleChange}
              disabled={isSubmitting || mode === 'delete'}
              error={!!errors.code || codeExists}
              helperText={errors.code || (codeExists ? 'Code already exists' : '')}
              size="small"
              InputProps={{
                endAdornment: isCheckingCode && (
                  <InputAdornment position="end">
                    <CircularProgress size={20} />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              id="years"
              name="years"
              label="Years of Experience"
              type="number"
              value={formData.years || ''}
              onChange={handleChange}
              disabled={isSubmitting || mode === 'delete'}
              error={!!errors.years}
              helperText={errors.years || ''}
              size="small"
              InputProps={{ inputProps: { min: 0 } }}
            />
          </Grid>
          
          {/* Language selector section */}
          {renderLanguageSelector()}
        </Grid>
      </form>
    );
  };

  // Render language sections
  const renderLanguageSections = () => {
    return selectedLanguages.map((lang) => {
      const langId = lang.id;
      const langTexts = languageTexts[langId] || { name: '', description: '' };
      const nameError = errors[`${langId}_name`];
      const descError = errors[`${langId}_description`];


      return (
        <Grid item xs={12} key={langId}>
          <Paper
            elevation={1}
            sx={{
              p: 2,
              mb: 2,
              position: 'relative',
              borderLeft: lang.is_default ? '4px solid #4caf50' : undefined
            }}
          >
            {/* Language header with remove button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {lang.name}
                  {lang.is_default && (
                    <Chip
                      label="Default"
                      size="small"
                      color="success"
                      sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </Typography>
                <Typography variant="caption" sx={{ ml: 1 }}>
                  ({lang.code})
                </Typography>
              </Box>
              
              <IconButton
                size="small"
                onClick={() => handleRemoveLanguage(langId)}
                disabled={isSubmitting || mode === 'delete'}
                color="error"
                aria-label={`Remove ${lang.name} language`}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Text fields for this language */}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  id={`${langId}_name`}
                  name={`${langId}_name`}
                  label="Name"
                  value={langTexts.name || ''}
                  onChange={(e) => handleTextChange(langId, 'name', e.target.value)}
                  error={!!nameError}
                  helperText={nameError || ''}
                  size="small"
                  disabled={isSubmitting || mode === 'delete'}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  id={`${langId}_description`}
                  name={`${langId}_description`}
                  label="Description"
                  value={langTexts.description || ''}
                  onChange={(e) => handleTextChange(langId, 'description', e.target.value)}
                  error={!!descError}
                  helperText={descError || ''}
                  size="small"
                  multiline
                  rows={3}
                  disabled={isSubmitting || mode === 'delete'}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      );
    });
  };

  // Render the form body section for adding languages
  const renderLanguageSelector = () => {
    // Check if there are languages available to add
    const hasAvailableLanguages = availableLanguages && availableLanguages.length > 0;
    const canAddMoreLanguages = hasAvailableLanguages && (selectedLanguages.length < availableLanguages.length);
    
    return (
      <Grid item xs={12}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 1.5
        }}>
          <Typography variant="subtitle1" sx={{ 
            fontWeight: 500, 
            color: '#1976d2',
            fontSize: '1rem' 
          }}>
            Languages ({selectedLanguages.length} selected)
          </Typography>
          <Tooltip title="Add Language">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddLanguage}
                disabled={
                  loadingLanguages || 
                  isSubmitting || 
                  loading || 
                  !canAddMoreLanguages
                }
                sx={{
                  borderColor: '#1976d2',
                  color: '#1976d2',
                  '&:hover': {
                    backgroundColor: alpha('#1976d2', 0.04),
                    borderColor: '#1976d2'
                  },
                  '&.Mui-disabled': {
                    borderColor: 'rgba(0, 0, 0, 0.12)',
                    color: 'rgba(0, 0, 0, 0.26)'
                  }
                }}
              >
                Add Language
              </Button>
            </span>
          </Tooltip>
        </Box>
        
        {/* Show any language selection errors */}
        {errors.languages && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.languages}
          </Alert>
        )}
        
        {/* Show loading indicator when fetching languages */}
        {loadingLanguages && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <CircularProgress size={16} sx={{ mr: 1 }} />
            <Typography variant="body2">Loading available languages...</Typography>
          </Box>
        )}
        
        {/* Show message if no languages are available */}
        {!loadingLanguages && (!availableLanguages || availableLanguages.length === 0) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No languages available in the system. Please add languages first using the Languages management page.
          </Alert>
        )}
        
        {/* Show helpful message when all languages are selected */}
        {!loadingLanguages && hasAvailableLanguages && !canAddMoreLanguages && (
          <Alert severity="info" sx={{ mb: 2 }}>
            All available languages ({availableLanguages.length}) have been added to this experience.
          </Alert>
        )}
      </Grid>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={() => onClose(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }
      }}
    >
      <DialogTitle sx={{
        fontSize: '1.25rem',
        fontWeight: 500,
        color: '#1976d2',
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        borderBottom: '1px solid #f0f0f0',
        py: 1.5
      }}>
        {getDialogTitle()}
      </DialogTitle>
      
      <DialogContent sx={{ 
        p: 3, 
        pt: mode === 'delete' ? '24px !important' : '32px !important',
        '&.MuiDialogContent-root': {
          paddingTop: mode === 'delete' ? '24px !important' : '32px !important'
        }
      }}>
        {apiError && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2.5, 
              fontSize: '0.875rem',
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              '& .MuiAlert-icon': {
                color: '#f44336'
              },
              '& .MuiAlert-message': {
                padding: '6px 0'
              }
            }}
          >
            {apiError}
          </Alert>
        )}
        
        {mode === 'delete' ? (
          renderDeleteConfirmation()
        ) : (
          <>
            {renderFormBody()}
            {/* Add language sections separately after the form */}
            <Box sx={{ mt: 3 }}>
              {selectedLanguages.length === 0 ? (
                <Alert severity="info" sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  '& .MuiAlert-message': {
                    flexGrow: 1
                  }
                }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                      No languages selected for content
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {loadingLanguages 
                        ? 'Loading available languages...' 
                        : availableLanguages && availableLanguages.length > 0
                        ? `Click "Add Language" above to add content in one of ${availableLanguages.length} available languages.`
                        : 'No languages are available. Please add languages to the system first.'
                      }
                    </Typography>
                  </Box>
                </Alert>
              ) : (
                renderLanguageSections()
              )}
            </Box>
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #f0f0f0' }}>
        <Button 
          onClick={() => onClose(false)} 
          disabled={isSubmitting || loading}
          startIcon={<CloseIcon fontSize="small" />}
          variant="outlined"
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
        <PermissionGate
          permissions={mode === 'create' ? ['CREATE_EXPERIENCE', 'MANAGE_EXPERIENCES'] : 
                      mode === 'edit' ? ['EDIT_EXPERIENCE', 'MANAGE_EXPERIENCES'] : 
                      ['DELETE_EXPERIENCE', 'MANAGE_EXPERIENCES']}
        >
          <Button 
            onClick={handleSubmit}
            variant="outlined"
            disabled={isSubmitting || loading}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : 
              mode === 'create' ? <AddIcon fontSize="small" /> : 
              mode === 'edit' ? <SaveIcon fontSize="small" /> : 
              <DeleteIcon fontSize="small" />
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
              color: mode === 'delete' ? '#e53935' : '#1976d2',
              border: mode === 'delete' ? '1px solid #e53935' : '1px solid #1976d2',
              '&:hover': {
                backgroundColor: mode === 'delete' ? alpha('#e53935', 0.04) : alpha('#1976d2', 0.04),
                borderColor: mode === 'delete' ? '#e53935' : '#1976d2',
                boxShadow: 'none'
              },
              '&.Mui-disabled': {
                opacity: 0.6,
                color: 'rgba(0, 0, 0, 0.26)',
                borderColor: 'rgba(0, 0, 0, 0.12)'
              }
            }}
          >
            {isSubmitting ? 'Processing...' : mode === 'create' ? 'Create' : mode === 'edit' ? 'Save' : 'Delete'}
          </Button>
        </PermissionGate>
      </DialogActions>
    </Dialog>
  );
}

export default ExperienceForm;
