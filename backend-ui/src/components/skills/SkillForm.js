import React, { useState, useEffect, useCallback } from 'react';
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
  Tooltip,
  InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSkill } from '../../contexts/SkillContext';
import { useSkillType } from '../../contexts/SkillTypeContext';
import { useCategory } from '../../contexts/CategoryContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { logInfo, logError } from '../../utils/logger';
import { alpha } from '@mui/material/styles';

function SkillForm({ open, onClose, skill, mode = 'create' }) {
  const { createSkill, updateSkill, deleteSkill, checkNameExists } = useSkill();
  const { skillTypes, loading: loadingSkillTypes, fetchSkillTypes } = useSkillType();
  const { categories, loading: loadingCategories, fetchCategories } = useCategory();
  const { languages: availableLanguages, loading: loadingLanguages, fetchLanguages } = useLanguage();

  const [formData, setFormData] = useState({
    id: '',
    type_code: '',
    skill_texts: [],
    categories: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [languageTexts, setLanguageTexts] = useState({});
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [removedLanguageIds, setRemovedLanguageIds] = useState([]);
  const [originalLanguageIds, setOriginalLanguageIds] = useState([]);
  const [loading, setLoading] = useState(false);

  // Helper function to get category display name from default language
  const getCategoryDisplayName = useCallback((category) => {
    if (!category.category_texts || category.category_texts.length === 0) {
      return category.code || `Category ${category.id}`;
    }
    
    // Find text in default language first
    const defaultText = category.category_texts.find(text => 
      text.language && text.language.is_default
    );
    
    if (defaultText && defaultText.name) {
      return defaultText.name;
    }
    
    // Fallback to first available text
    const firstText = category.category_texts[0];
    return firstText?.name || category.code || `Category ${category.id}`;
  }, []);

  // Explicitly fetch data when the form opens
  useEffect(() => {
    if (open) {
      logInfo('SkillForm', 'Explicitly fetching required data');
      
      // Fetch skill types
      fetchSkillTypes(0, 100).then(() => {
        logInfo('SkillForm', 'Skill types fetched successfully');
      }).catch(error => {
        logError('SkillForm', 'Error fetching skill types:', error);
      });
      
      // Fetch categories
      fetchCategories({ page: 1, page_size: 100 }).then(() => {
        logInfo('SkillForm', 'Categories fetched successfully');
      }).catch(error => {
        logError('SkillForm', 'Error fetching categories:', error);
      });
      
      // Fetch languages
      fetchLanguages(1, 100, {}).then(() => {
        logInfo('SkillForm', 'Languages fetched successfully');
      }).catch(error => {
        logError('SkillForm', 'Error fetching languages:', error);
      });
    }
  }, [open, fetchSkillTypes, fetchCategories, fetchLanguages]);

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
        logInfo('SkillForm', `Auto-adding default language in create mode: ${defaultLanguage.name}`);
        
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
        
        // Update formData.skill_texts to include the new language
        setFormData(prev => ({
          ...prev,
          skill_texts: [{
            name: '',
            description: '',
            language_id: defaultLanguage.id,
            language: defaultLanguage
          }]
        }));
      }
    }
  }, [mode, availableLanguages, selectedLanguages.length, loadingLanguages]);

  // Effect to load skill data if in edit or delete mode
  useEffect(() => {
    if ((mode === 'edit' || mode === 'delete') && skill) {
      logInfo('SkillForm', `Processing provided skill data for ${mode}:`, skill);
      
      // Process the skill prop
      const formattedData = {
        ...skill,
        skill_texts: Array.isArray(skill.skill_texts) ? skill.skill_texts : []
      };
      
      // Extract all languages and texts from skill_texts
      const textsMap = {};
      const languageList = [];
      const originalIds = [];
      
      formattedData.skill_texts.forEach(text => {
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
          
          // If language not found yet, create minimal representation
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

      logInfo('SkillForm', 'Extracted language texts from prop:', textsMap);
      logInfo('SkillForm', 'Language list derived from prop:', languageList);
      
      // Extract selected category IDs
      const categoryIds = [];
      if (skill.categories && Array.isArray(skill.categories)) {
        skill.categories.forEach(category => {
          if (category && category.id) {
            categoryIds.push(category.id);
          }
        });
      }
      
      // Set form state based on the processed prop data
      setFormData({
        id: skill.id || '',
        type_code: skill.type_code || '',
        skill_texts: formattedData.skill_texts || [],
        categories: skill.categories || []
      });
      
      setSelectedLanguages(languageList);
      setLanguageTexts(textsMap);
      setSelectedCategories(categoryIds);
      setOriginalLanguageIds(originalIds);
      setRemovedLanguageIds([]);
      setLoading(false);

    } else if (mode === 'create') {
      // Reset form for create mode
      logInfo('SkillForm', 'Initializing form for create mode');
      setFormData({
        id: '',
        type_code: '',
        skill_texts: [],
        categories: []
      });
      setSelectedLanguages([]);
      setLanguageTexts({});
      setSelectedCategories([]);
      setOriginalLanguageIds([]);
      setRemovedLanguageIds([]);
      setErrors({});
      setApiError('');
      setLoading(false);
    }
  }, [mode, skill, availableLanguages]);

  // Add effect to set default type_code once skillTypes are loaded
  useEffect(() => {
    if (skillTypes && skillTypes.length > 0) {
      if (mode === 'create' && !formData.type_code && skillTypes.length > 0) {
        const defaultTypeCode = skillTypes[0]?.code || '';
        setFormData(prev => ({
          ...prev,
          type_code: defaultTypeCode
        }));
        logInfo('SkillForm', `Setting default type_code to ${defaultTypeCode} for create mode`);
      }
    }
  }, [skillTypes, formData.type_code, mode]);

  // Effect to reset the form when dialog opens or closes
  useEffect(() => {
    if (open) {
      logInfo('SkillForm', `Form opened in ${mode} mode`, { 
        skillId: skill?.id, 
        mode,
        availableLanguagesCount: availableLanguages?.length || 0,
        loadingLanguages,
        selectedLanguagesCount: selectedLanguages.length
      });
      
      setErrors({});
      setApiError('');
      setIsSubmitting(false);
    } else {
      setApiError('');
      setIsSubmitting(false);
    }
  }, [open, mode, skill, availableLanguages?.length, loadingLanguages, selectedLanguages.length]);

  const validateForm = async () => {
    const newErrors = {};
    
    // Skip validation for delete operations
    if (mode === 'delete') {
      return true;
    }
    
    // Validate type_code
    if (!formData.type_code) {
      newErrors.type_code = 'Skill type is required';
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
        
        if (!langTexts.description || langTexts.description.trim() === '') {
          newErrors[`${langId}_description`] = 'Description is required';
        }
      });
    }
    
    if (Object.keys(newErrors).length > 0) {
      logInfo('SkillForm', 'Validation errors:', newErrors);
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    logInfo('SkillForm', `Starting ${mode} operation for skill ${formData.id || 'new'}`);
    
    // For delete mode, we don't need to validate
    if (mode !== 'delete') {
      const valid = await validateForm();
      if (!valid) {
        logError('SkillForm', 'Form validation failed - not submitting');
        return;
      }
    }
    
    setIsSubmitting(true);
    setApiError('');
    
    try {
      let response;
      let submitData;
      
      if (mode === 'create' || mode === 'edit') {
        submitData = prepareSubmitData();
        logInfo('SkillForm', `Submitting form in ${mode} mode with data:`, submitData);
      }
      
      if (mode === 'create') {
        response = await createSkill(submitData);
      } else if (mode === 'edit') {
        response = await updateSkill(formData.id, submitData);
      } else if (mode === 'delete') {
        response = await deleteSkill(formData.id);
      }
      
      const successMessage = mode === 'create' 
        ? 'Skill created successfully' 
        : mode === 'edit' 
        ? 'Skill updated successfully' 
        : 'Skill deleted successfully';
      
      logInfo('SkillForm', successMessage);
      onClose(true, response);
      
    } catch (error) {
      logError('SkillForm', `Error ${mode}ing skill:`, error);
      
      let errorMessage = `Failed to ${mode} skill`;
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMessage = `Skill ${mode === 'create' ? 'creation' : mode === 'edit' ? 'update' : 'deletion'} may have completed successfully, but there was a network issue retrieving the response. Please refresh the page to see if the operation was successful.`;
        
        setApiError(errorMessage);
        setTimeout(() => {
          onClose(true);
        }, 3000);
        
      } else if (error.response && error.response.status === 409) {
        if (error.response.data && error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else {
          errorMessage = `Skill with this name already exists. Please choose a different name.`;
        }
      } else if (error.response && error.response.status === 400) {
        if (error.response.data && error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else {
          errorMessage = "Invalid data provided. Please check your inputs and try again.";
        }
      } else if (error.response && error.response.status === 422) {
        if (error.response.data && error.response.data.detail) {
          if (Array.isArray(error.response.data.detail)) {
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
        errorMessage = "Server error occurred. The operation may have been completed. Please refresh the page to check.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setApiError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLanguage = () => {
    const selectedLangIds = selectedLanguages.map(lang => lang.id);
    
    logInfo('SkillForm', 'Adding language - current state:', {
      availableLanguages: availableLanguages?.length || 0, 
      selectedLanguages: selectedLangIds
    });
    
    const availableToAdd = availableLanguages.filter(
      lang => !selectedLangIds.includes(lang.id)
    );
    
    if (availableToAdd.length > 0) {
      const langToAdd = availableToAdd[0];
      logInfo('SkillForm', `Adding language: ${langToAdd.name} (${langToAdd.id})`);
      
      setSelectedLanguages(prev => [...prev, langToAdd]);
      
      setLanguageTexts(prev => ({
        ...prev,
        [langToAdd.id]: {
          id: null,
          name: '',
          description: ''
        }
      }));
      
      setFormData(prev => {
        const filteredTexts = prev.skill_texts.filter(text => {
          const textLangId = text.language_id || (text.language ? text.language.id : null);
          return textLangId !== langToAdd.id;
        });
        
        return {
          ...prev,
          skill_texts: [
            ...filteredTexts,
            {
              name: '',
              description: '',
              language_id: langToAdd.id,
              language: langToAdd
            }
          ]
        };
      });
      
      if (removedLanguageIds.includes(langToAdd.id)) {
        setRemovedLanguageIds(removedLanguageIds.filter(id => id !== langToAdd.id));
      }
    } else {
      setApiError('All languages are already added or no languages available');
    }
  };

  const handleRemoveLanguage = (langId) => {
    setSelectedLanguages(selectedLanguages.filter(lang => lang.id !== langId));
    
    setFormData(prev => ({
      ...prev,
      skill_texts: prev.skill_texts.filter(text => {
        const textLangId = text.language_id || (text.language ? text.language.id : null);
        return textLangId !== langId;
      })
    }));
    
    setLanguageTexts(prev => {
      const newTexts = { ...prev };
      delete newTexts[langId];
      return newTexts;
    });
    
    if (originalLanguageIds.includes(langId)) {
      setRemovedLanguageIds([...removedLanguageIds, langId]);
    }
    
    const newErrors = { ...errors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`${langId}_`)) {
        delete newErrors[key];
      }
    });
    setErrors(newErrors);
    
    logInfo('SkillForm', `Removed language with ID: ${langId}`);
  };

  const handleTextChange = (langId, field, value) => {
    setLanguageTexts(prev => ({
      ...prev,
      [langId]: {
        ...(prev[langId] || {}),
        [field]: value
      }
    }));
    
    setFormData(prev => {
      const textIndex = prev.skill_texts.findIndex(text => {
        const textLangId = text.language_id || (text.language && text.language.id);
        return textLangId === langId;
      });
      
      let updatedSkillTexts;
      
      if (textIndex >= 0) {
        updatedSkillTexts = [...prev.skill_texts];
        updatedSkillTexts[textIndex] = {
          ...updatedSkillTexts[textIndex],
          [field]: value
        };
      } else {
        const newText = {
          language_id: langId,
          [field]: value
        };
        
        const langObj = selectedLanguages.find(lang => lang.id === langId);
        if (langObj) {
          newText.language = langObj;
        }
        
        updatedSkillTexts = [...prev.skill_texts, newText];
      }
      
      return {
        ...prev,
        skill_texts: updatedSkillTexts
      };
    });
    
    if (errors[`${langId}_${field}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${langId}_${field}`];
        return newErrors;
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleCategoryChange = (event) => {
    const { value } = event.target;
    setSelectedCategories(value);
    
    if (errors.categories) {
      setErrors(prev => ({ ...prev, categories: '' }));
    }
  };

  const prepareSubmitData = () => {
    const currentLanguageIds = selectedLanguages.map(lang => lang.id);
    
    const filteredLanguageTexts = {};
    Object.entries(languageTexts).forEach(([langId, text]) => {
      if (currentLanguageIds.includes(Number(langId))) {
        filteredLanguageTexts[langId] = text;
      }
    });
    
    const submitData = {
      ...formData,
      type_code: formData.type_code || '',
      skill_texts: Object.entries(filteredLanguageTexts).map(([langId, text]) => {
        const skillText = {
          language_id: Number(langId),
          name: text.name || '',
          description: text.description || ''
        };
        
        if (mode === 'edit' && text.id && text.id !== null) {
          skillText.id = text.id;
        }
        
        return skillText;
      }),
      categories: selectedCategories
    };
    
    if (mode === 'edit') {
      submitData.removed_language_ids = removedLanguageIds;
    }
    
    return submitData;
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'create':
        return 'Create New Skill';
      case 'edit':
        return 'Edit Skill';
      case 'delete':
        return 'Delete Skill';
      default:
        return 'Skill';
    }
  };

  const renderDeleteConfirmation = () => {
    // Get category names for display
    const getCategoryNamesForDisplay = () => {
      if (!selectedCategories || selectedCategories.length === 0) {
        return 'None selected';
      }
      
      const categoryNames = selectedCategories.map(categoryId => {
        const category = categories?.find(cat => cat.id === categoryId);
        return category ? getCategoryDisplayName(category) : `Category ${categoryId}`;
      });
      
      return categoryNames.join(', ');
    };

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
              Delete this skill?
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
          
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#505050',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  fontSize: '13px',
                  lineHeight: 1.4
                }}
              >
                <strong>Type:</strong> {skillTypes?.find(t => t.code === formData.type_code)?.name || formData.type_code}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#505050',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  fontSize: '13px',
                  lineHeight: 1.4,
                  wordBreak: 'break-word'
                }}
              >
                <strong>Categories:</strong> {getCategoryNamesForDisplay()}
              </Typography>
            </Box>
            
            {/* Languages and Skill Names */}
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

  const renderFormBody = () => {
    // Get ALL skill types (from skill_types table)
    const allSkillTypes = skillTypes || [];

    // Filter categories to only those whose category_type name equals 'Skill' (case-insensitive)
    const allCategories = (categories || []).filter(cat => {
      if (!cat) return false;
      // Prefer related category_type name if present
      const typeName = cat.category_type?.name || cat.category_type?.Name || '';
      if (typeName && typeof typeName === 'string') {
        return typeName.toLowerCase() === 'skill';
      }
      // Fallback: sometimes only type_code is available; add explicit codes here if needed
      // Adjust the allowed type codes if your backend uses a specific code for Skill categories
      const allowedTypeCodes = ['SKILL', 'SKL'];
      if (cat.type_code && allowedTypeCodes.includes(String(cat.type_code).toUpperCase())) {
        return true;
      }
      return false;
    });

    return (
      <form>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl
              fullWidth
              required
              error={!!errors.type_code}
              size="small"
              disabled={isSubmitting || mode === 'delete'}
            >
              <InputLabel id="skill-type-label">Skill Type</InputLabel>
              <Select
                labelId="skill-type-label"
                id="type_code"
                name="type_code"
                value={formData.type_code || ''}
                onChange={handleChange}
                label="Skill Type"
                disabled={isSubmitting || mode === 'delete'}
              >
                <MenuItem value="" disabled>
                  <em>Select a type</em>
                </MenuItem>
                {loadingSkillTypes ? (
                  <MenuItem disabled value="loading">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      Loading skill types...
                    </Box>
                  </MenuItem>
                ) : allSkillTypes && allSkillTypes.length > 0 ? (
                  allSkillTypes.map((type) => (
                    <MenuItem key={type.code} value={type.code}>
                      {type.name}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled value="">
                    No skill types available
                  </MenuItem>
                )}
              </Select>
              {errors.type_code && (
                <FormHelperText>{errors.type_code}</FormHelperText>
              )}
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth sx={{ mb: 2 }} error={!!errors.categories}>
              <InputLabel id="categories-label">Categories</InputLabel>
              <Select
                labelId="categories-label"
                id="categories"
                multiple
                value={selectedCategories}
                onChange={handleCategoryChange}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.length === 0 ? (
                      <em>No categories selected</em>
                    ) : (
                      selected.map((value) => {
                        const category = allCategories.find(cat => cat.id === value);
                        return (
                          <Chip key={value} label={getCategoryDisplayName(category) || `Category ${value}`} />
                        );
                      })
                    )}
                  </Box>
                )}
                disabled={isSubmitting || mode === 'delete'}
              >
                {loadingCategories ? (
                  <MenuItem disabled>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      Loading categories...
                    </Box>
                  </MenuItem>
        ) : allCategories.length === 0 ? (
                  <MenuItem disabled>
          <em>No skill categories available</em>
                  </MenuItem>
                ) : (
                  allCategories.map((category) => (
                    <MenuItem
                      key={category.id}
                      value={category.id}
                    >
                      {getCategoryDisplayName(category)}
                    </MenuItem>
                  ))
                )}
              </Select>
              {errors.categories && <FormHelperText>{errors.categories}</FormHelperText>}
            </FormControl>
          </Grid>
          
          {renderLanguageSelector()}
          
          {apiError && (
            <Grid item xs={12}>
              <Alert severity="error">{apiError}</Alert>
            </Grid>
          )}
        </Grid>
      </form>
    );
  };

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

  const renderLanguageSelector = () => {
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
        
        {errors.languages && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.languages}
          </Alert>
        )}
        
        {loadingLanguages && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <CircularProgress size={16} sx={{ mr: 1 }} />
            <Typography variant="body2">Loading available languages...</Typography>
          </Box>
        )}
        
        {!loadingLanguages && (!availableLanguages || availableLanguages.length === 0) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No languages available in the system. Please add languages first using the Languages management page.
          </Alert>
        )}
        
        {!loadingLanguages && hasAvailableLanguages && !canAddMoreLanguages && (
          <Alert severity="info" sx={{ mb: 2 }}>
            All available languages ({availableLanguages.length}) have been added to this skill.
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

export default SkillForm;