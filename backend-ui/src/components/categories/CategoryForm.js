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
import { useCategory } from '../../contexts/CategoryContext';
import { useCategoryType } from '../../contexts/CategoryTypeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { logInfo, logError } from '../../utils/logger';
import { alpha } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { buildViewDeniedMessage } from '../../utils/permissionMessages';
import usePermissionNotice from '../../hooks/usePermissionNotice';

function CategoryForm({ open, onClose, category, mode = 'create' }) {
  const { createCategory, updateCategory, deleteCategory, getCategoryById, checkCodeExists } = useCategory();
  const { categoryTypes, loading: loadingCategoryTypes, fetchCategoryTypes, error: categoryTypesError } = useCategoryType();
  const { languages: availableLanguages, loading: loadingLanguages, fetchLanguages } = useLanguage();

  const [formData, setFormData] = useState({
    id: '',
    code: '',
    type_code: '',
    category_texts: []
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
  const [categoryTypesAccessDenied, setCategoryTypesAccessDenied] = useState(false);
  const [categoryTypesErrorMessage, setCategoryTypesErrorMessage] = useState('');

  // Field-level permission notice for category types (VIEW or MANAGE)
  const categoryTypesPerm = usePermissionNotice(['VIEW_CATEGORY_TYPES', 'MANAGE_CATEGORY_TYPES'], 'categorytypes', categoryTypesError);
  const languagesPerm = usePermissionNotice('VIEW_LANGUAGES', 'languages');

  // Explicitly fetch category types when the form opens
  useEffect(() => {
    if (open) {
      // Fetch the category types when the form opens
      logInfo('CategoryForm', 'Explicitly fetching category types');
      fetchCategoryTypes(0, 100).then(() => {
        setCategoryTypesAccessDenied(false);
        setCategoryTypesErrorMessage('');
      }).catch(error => {
        logError('CategoryForm', 'Error fetching category types:', error);
        if (error?.response?.status === 403) {
          setCategoryTypesAccessDenied(true);
          setCategoryTypesErrorMessage(buildViewDeniedMessage('categorytypes'));
        }
      }); // Fetch a large number to get all types
    }
  }, [open, fetchCategoryTypes]);

  // Explicitly fetch languages when the form opens
  useEffect(() => {
    if (open) {
      // Fetch languages when the form opens
      logInfo('CategoryForm', 'Explicitly fetching languages');
      fetchLanguages(1, 100, {}).then(() => {
        logInfo('CategoryForm', 'Languages fetched successfully');
      }).catch(error => {
        logError('CategoryForm', 'Error fetching languages:', error);
      });
    }
  }, [open, fetchLanguages]);

  // Add explicit check to debug available languages
  useEffect(() => {
    if (open) {
      logInfo('CategoryForm', 'Available languages check:', {
        count: availableLanguages?.length || 0,
        loading: loadingLanguages,
        languages: availableLanguages?.slice(0, 3)
      });
    }
  }, [open, availableLanguages, loadingLanguages]);

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
        logInfo('CategoryForm', `Auto-adding default language in create mode: ${defaultLanguage.name}`);
        
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
        
        // Update formData.category_texts to include the new language
        setFormData(prev => ({
          ...prev,
          category_texts: [{
            name: '',
            description: '',
            language_id: defaultLanguage.id,
            language: defaultLanguage
          }]
        }));
      }
    }
  }, [mode, availableLanguages, selectedLanguages.length, loadingLanguages]);

  // Effect to load category data if in edit or delete mode
  useEffect(() => {
    if ((mode === 'edit' || mode === 'delete') && category) {
      // Log the initial category data received from parent component
      logInfo('CategoryForm', `Processing provided category data for ${mode}:`, category);
      
      // Directly process the category prop, no need to re-fetch if data is complete
      const formattedData = {
        ...category,
        category_texts: Array.isArray(category.category_texts) ? category.category_texts : []
      };
      
      // Extract all languages and texts from category_texts
      const textsMap = {};
      const languageList = [];
      const originalIds = []; // Track original language IDs
      
      formattedData.category_texts.forEach(text => {
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

      logInfo('CategoryForm', 'Extracted language texts from prop:', textsMap);
      logInfo('CategoryForm', 'Language list derived from prop:', languageList);
      
      // Set form state based on the processed prop data
      setFormData({
        id: category.id || '',
        code: category.code || '',
        type_code: category.type_code || '',
        category_texts: formattedData.category_texts || [] // Keep original structure here too
      });
      
      setSelectedLanguages(languageList);
      setLanguageTexts(textsMap);
      setOriginalLanguageIds(originalIds); // Set original IDs based on prop
      setRemovedLanguageIds([]); // Reset removed IDs
      setLoading(false); // Ensure loading is set to false

    } else if (mode === 'create') {
      // Reset form for create mode
      logInfo('CategoryForm', 'Initializing form for create mode');
      setFormData({
        id: '',
        code: '',
        type_code: '', // Will be set by the categoryTypes effect if types are loaded
        category_texts: []
      });
      setSelectedLanguages([]);
      setLanguageTexts({});
      setOriginalLanguageIds([]);
      setRemovedLanguageIds([]);
      setErrors({});
      setApiError('');
      setLoading(false);
    }
  }, [mode, category, availableLanguages]);

  // Reflect CategoryTypeContext permission errors into local inline helper
  useEffect(() => {
    if (!open) return;
    if (categoryTypesError) {
      const msg = String(categoryTypesError).toLowerCase();
      if (msg.includes('403') || msg.includes('forbidden') || msg.includes('permission')) {
        setCategoryTypesAccessDenied(true);
        setCategoryTypesErrorMessage(buildViewDeniedMessage('categorytypes'));
      }
    }
  }, [open, categoryTypesError]);

  // Add effect to set default type_code once categoryTypes are loaded
  useEffect(() => {
    if (categoryTypes && categoryTypes.length > 0) {
      logInfo('CategoryForm', 'Category types loaded:', categoryTypes.map(t => t.code));
      
      if (mode === 'create' && !formData.type_code) {
        // In create mode, if we have category types and no current selection, set the first one as default
        const defaultTypeCode = categoryTypes[0]?.code || '';
        setFormData(prev => ({
          ...prev,
          type_code: defaultTypeCode
        }));
        logInfo('CategoryForm', `Setting default type_code to ${defaultTypeCode} for create mode`);
      } else if (mode === 'edit' && formData.type_code) {
        // In edit mode, validate that the type_code exists in available types
        const typeExists = categoryTypes.some(type => type.code === formData.type_code);
        logInfo('CategoryForm', `Validating type_code ${formData.type_code} in edit mode, exists: ${typeExists}`);
        
        if (!typeExists && categoryTypes.length > 0) {
          // If type doesn't exist, set a default
          logInfo('CategoryForm', `Type code ${formData.type_code} not found in available types, setting default`);
          setFormData(prev => ({
            ...prev,
            type_code: categoryTypes[0]?.code || ''
          }));
        }
      }
    }
  }, [categoryTypes, formData.type_code, mode]);

  // Check if code exists when code changes
  useEffect(() => {
    const checkCodeExistsDebounced = async () => {
      if (!formData.code || formData.code.trim() === '') {
        setCodeExists(false);
        return;
      }

      setIsCheckingCode(true);
      try {
        const exists = await checkCodeExists(formData.code, formData.id);
        setCodeExists(exists);
        if (exists) {
          setErrors(prev => ({ ...prev, code: 'Code already exists' }));
        } else {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.code;
            return newErrors;
          });
        }
      } catch (error) {
        logError('CategoryForm', 'Error checking code:', error);
      } finally {
        setIsCheckingCode(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      checkCodeExistsDebounced();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [formData.code, formData.id, checkCodeExists]);

  // Effect to reset the form when dialog opens or closes
  useEffect(() => {
    if (open) {
      logInfo('CategoryForm', `Form opened in ${mode} mode`, { 
        categoryId: category?.id, 
        mode,
        availableLanguagesCount: availableLanguages?.length || 0,
        loadingLanguages,
        selectedLanguagesCount: selectedLanguages.length
      });
      
      // Errors and API error should be reset when the form opens
      setErrors({});
      setApiError('');
      
      // Reset code exists flag
      setCodeExists(false);
      
      // Loading states should be reset
      setIsSubmitting(false);
      setIsCheckingCode(false);
    } else {
      // When form closes, we can reset sensitive state
      // (Don't reset everything as it causes flicker when closing)
      setApiError('');
      setIsSubmitting(false);
    }
  }, [open, mode, category, availableLanguages?.length, loadingLanguages, selectedLanguages.length]);

  const validateForm = async () => {
    const newErrors = {};
    
    // Validate code
    if (!formData.code) {
      newErrors.code = 'Code is required';
    } else if (codeExists) {
      newErrors.code = 'Code already exists';
    }
    
    // Validate type_code
    if (!formData.type_code) {
      newErrors.type_code = 'Category type is required';
    }
    
    // Validate that at least one language is selected
    if (selectedLanguages.length === 0) {
      newErrors.languages = 'At least one language must be selected';
    } else {
      // Validate each language has name
      selectedLanguages.forEach(lang => {
        const langId = lang.id;
        const langTexts = languageTexts[langId] || {};
        
        if (!langTexts.name || langTexts.name.trim() === '') {
          newErrors[`${langId}_name`] = 'Name is required';
        }
        
        // Only validate description if required
        if (!langTexts.description || langTexts.description.trim() === '') {
          newErrors[`${langId}_description`] = 'Description is required';
        }
      });
    }
    
    // Log the errors for debugging
    if (Object.keys(newErrors).length > 0) {
      logInfo('CategoryForm', 'Validation errors:', newErrors);
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    logInfo(`CategoryForm`, `Starting ${mode} operation for category ${formData.id || 'new'}`);
    
    // For delete mode, we don't need to validate
    if (mode !== 'delete') {
      // Validate form
      const valid = await validateForm();
      if (!valid) {
        logError('CategoryForm', 'Form validation failed - not submitting');
        return;
      }
    } else {
      logInfo('CategoryForm', 'Delete mode - skipping validation');
    }
    
    setIsSubmitting(true);
    setApiError('');
    
    try {
      let response;
      let submitData;
      
      if (mode === 'create' || mode === 'edit') {
        submitData = prepareSubmitData();
        logInfo('CategoryForm', `Submitting form in ${mode} mode with data:`, submitData);
      }
      
      if (mode === 'create') {
        logInfo('CategoryForm', 'Creating category with data:', submitData);
        response = await createCategory(submitData);
      } else if (mode === 'edit') {
        logInfo('CategoryForm', `Updating category ${formData.id} with data:`, submitData);
        response = await updateCategory(formData.id, submitData);
      } else if (mode === 'delete') {
        logInfo('CategoryForm', `Deleting category with ID: ${formData.id}`);
        response = await deleteCategory(formData.id);
      }
      
      // Show success message
      const successMessage = mode === 'create' 
        ? 'Category created successfully' 
        : mode === 'edit' 
        ? 'Category updated successfully' 
        : 'Category deleted successfully';
      
      logInfo('CategoryForm', successMessage);
      
      // Close form and refresh data
      logInfo('CategoryForm', `Operation ${mode} successful. Closing form with refresh=true`);
      onClose(true, response);
      
    } catch (error) {
      logError('CategoryForm', `Error ${mode}ing category:`, error);
      
      // Provide more specific error messages based on error type and status
      let errorMessage = `Failed to ${mode} category`;
      
      // Handle different types of errors
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        // Network errors - often happen when operation succeeds but response has issues
        errorMessage = `Category ${mode === 'create' ? 'creation' : mode === 'edit' ? 'update' : 'deletion'} may have completed successfully, but there was a network issue retrieving the response. Please refresh the page to see if the operation was successful.`;
        
        // For network errors, let's still try to close the form and refresh
        logInfo('CategoryForm', `Network error occurred, but operation may have succeeded. Refreshing data.`);
        
        // Set error but also try to refresh
        setApiError(errorMessage);
        
        // Delay a bit then close and refresh to give user time to see the message
        setTimeout(() => {
          onClose(true); // Refresh the data
        }, 3000);
        
      } else if (error.response && error.response.status === 409) {
        // 409 Conflict - usually duplicate code
        if (error.response.data && error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else {
          errorMessage = `Category with code "${formData.code}" already exists. Please choose a different code.`;
        }
      } else if (error.response && error.response.status === 400) {
        // 400 Bad Request - validation errors
        if (error.response.data && error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else {
          errorMessage = "Invalid data provided. Please check your inputs and try again.";
        }
      } else if (error.response && error.response.status === 422) {
        // 422 Unprocessable Entity - usually validation errors
        if (error.response.data && error.response.data.detail) {
          if (Array.isArray(error.response.data.detail)) {
            // Handle Pydantic validation errors
            const validationErrors = error.response.data.detail.map(err => 
              `${err.loc?.join('.')} - ${err.msg}`
            ).join('; ');
            errorMessage = `Validation error: ${validationErrors}`;
          } else {
            errorMessage = error.response.data.detail;
          }
        } else {
          errorMessage = "Data validation failed. Please check your inputs and try again.";
        }
      } else if (error.response && error.response.status >= 500) {
        // 500+ Server errors
        errorMessage = "Server error occurred. The operation may have been completed. Please refresh the page to check.";
      } else if (error.message) {
        // Use the error message if available
        errorMessage = error.message;
      }
      
      setApiError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle adding a language
  const handleAddLanguage = () => {
    // Get the already selected language IDs
    const selectedLangIds = selectedLanguages.map(lang => lang.id);
    
    // Debug log for troubleshooting
    logInfo('CategoryForm', 'Adding language - current state:', {
      availableLanguages: availableLanguages?.length || 0, 
      selectedLanguages: selectedLangIds
    });
    
    // Find available languages that are not already selected
    const availableToAdd = availableLanguages.filter(
      lang => !selectedLangIds.includes(lang.id)
    );
    
    logInfo('CategoryForm', `Found ${availableToAdd.length} available languages to add`);
    
    if (availableToAdd.length > 0) {
      // Add the first available language
      const langToAdd = availableToAdd[0];
      logInfo('CategoryForm', `Adding language: ${langToAdd.name} (${langToAdd.id})`);
      
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
      
      // Also update formData.category_texts to include the new language
      setFormData(prev => {
        // First filter out any existing entry for this language to avoid duplicates
        const filteredTexts = prev.category_texts.filter(text => {
          const textLangId = text.language_id || (text.language ? text.language.id : null);
          return textLangId !== langToAdd.id;
        });
        
        // Then add the new entry
        return {
          ...prev,
          category_texts: [
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
      logError('CategoryForm', 'No languages available to add', {
        availableLanguages: availableLanguages?.length || 0,
        selectedLanguages: selectedLangIds
      });
    }
  };

  // Handle removing a language
  const handleRemoveLanguage = (langId) => {
    // Remove the language from selected languages
    setSelectedLanguages(selectedLanguages.filter(lang => lang.id !== langId));
    
    // Also remove the language from formData.category_texts
    setFormData(prev => ({
      ...prev,
      category_texts: prev.category_texts.filter(text => {
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
    
    logInfo('CategoryForm', `Removed language with ID: ${langId}`);
  };

  // Handle text changes for a language
  const handleTextChange = (langId, field, value) => {
    logInfo('CategoryForm', `Updating ${field} for language ${langId}:`, value);
    
    // Update the languageTexts state
    setLanguageTexts(prev => {
      const updatedTexts = {
        ...prev,
        [langId]: {
          ...(prev[langId] || {}),  // Make sure we have an object to spread
          [field]: value
        }
      };
      
      logInfo('CategoryForm', 'Updated languageTexts state:', {
        before: prev[langId],
        after: updatedTexts[langId]
      });
      
      return updatedTexts;
    });
    
    // Also update the formData.category_texts to keep everything in sync
    setFormData(prev => {
      // Find if this language already exists in the texts
      const textIndex = prev.category_texts.findIndex(text => {
        const textLangId = text.language_id || (text.language && text.language.id);
        return textLangId === langId;
      });
      
      let updatedCategoryTexts;
      
      if (textIndex >= 0) {
        // Update existing text
        updatedCategoryTexts = [...prev.category_texts];
        updatedCategoryTexts[textIndex] = {
          ...updatedCategoryTexts[textIndex],
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
        
        updatedCategoryTexts = [...prev.category_texts, newText];
      }
      
      return {
        ...prev,
        category_texts: updatedCategoryTexts
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
        return 'Create New Category';
      case 'edit':
        return 'Edit Category';
      case 'delete':
        return 'Delete Category';
      default:
        return 'Category';
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
              Delete this category?
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
                <strong>Type:</strong> {categoryTypes?.find(t => t.code === formData.type_code)?.name || formData.type_code}
              </Typography>
            </Box>
            
            {/* Languages and Category Names */}
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
    
    // If changing type_code, validate it exists in categoryTypes
    if (name === 'type_code') {
      // Only accept values that exist in categoryTypes or empty string
      const isValidTypeCode = value === '' || categoryTypes.some(type => type.code === value);
      if (!isValidTypeCode) {
        logError('CategoryForm', `Invalid type_code selected: ${value}`);
        return; // Don't update with invalid value
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
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
    
    logInfo('CategoryForm', 'Filtered language texts (excluding removed languages):', filteredLanguageTexts);
    logInfo('CategoryForm', 'Removed language IDs:', removedLanguageIds);
    
    // Prepare data for submission
    const submitData = {
      ...formData,
      type_code: formData.type_code || '',
      // Format category_texts properly and exclude removed languages
      category_texts: Object.entries(filteredLanguageTexts).map(([langId, text]) => {
        const categoryText = {
          language_id: Number(langId),
          name: text.name || '',
          description: text.description || ''
        };
        
        // Only include ID if it exists and we're in edit mode (for updating existing texts)
        if (mode === 'edit' && text.id && text.id !== null) {
          categoryText.id = text.id;
        }
        
        return categoryText;
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
    const categoryTypeErrorSx = (categoryTypesAccessDenied || categoryTypesPerm.isDenied) ? {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: (theme) => theme.palette.error.main
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: (theme) => theme.palette.error.main
      },
      '& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline': {
        borderColor: (theme) => theme.palette.error.main
      },
      '& .MuiInputLabel-root.Mui-disabled': {
        color: (theme) => theme.palette.error.main
      }
    } : undefined;

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
            <FormControl
              fullWidth
              required
              error={categoryTypesAccessDenied || categoryTypesPerm.isDenied || !!errors.type_code}
              size="small"
              disabled={categoryTypesAccessDenied || categoryTypesPerm.isDenied || isSubmitting || mode === 'delete'}
              sx={categoryTypeErrorSx}
            >
              <InputLabel id="category-type-label">Category Type</InputLabel>
              <Select
                labelId="category-type-label"
                id="type_code"
                name="type_code"
                value={formData.type_code || ''}
                onChange={handleChange}
                label="Category Type"
                disabled={categoryTypesAccessDenied || categoryTypesPerm.isDenied || isSubmitting || mode === 'delete'}
              >
                <MenuItem value="" disabled>
                  <em>Select a type</em>
                </MenuItem>
                {loadingCategoryTypes ? (
                  <MenuItem disabled value="loading">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      Loading category types...
                    </Box>
                  </MenuItem>
                ) : (categoryTypesAccessDenied || categoryTypesPerm.isDenied) ? (
                  <MenuItem disabled value="">
                    Not available
                  </MenuItem>
                ) : categoryTypes && categoryTypes.length > 0 ? (
                  categoryTypes.map((type) => (
                    <MenuItem key={type.code} value={type.code}>
                      {type.name}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled value="">
                    No category types available
                  </MenuItem>
                )}
              </Select>
              {categoryTypesAccessDenied || categoryTypesPerm.isDenied ? (
                <FormHelperText>{categoryTypesErrorMessage || categoryTypesPerm.message}</FormHelperText>
              ) : (
                errors.type_code && (
                  <FormHelperText>{errors.type_code}</FormHelperText>
                )
              )}
            </FormControl>
          </Grid>
          
          {/* Language selector section */}
          {renderLanguageSelector()}
          
          {/* Error message if any */}
          {apiError && (
            <Grid item xs={12}>
              <Alert severity="error">{apiError}</Alert>
            </Grid>
          )}
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

      logInfo('CategoryForm', `Rendering language section for language ${lang.name} (${langId})`, { 
        texts: langTexts,
        hasErrors: !!nameError || !!descError 
      });

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
            All available languages ({availableLanguages.length}) have been added to this category.
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
      </DialogActions>
    </Dialog>
  );
}

export default CategoryForm;
