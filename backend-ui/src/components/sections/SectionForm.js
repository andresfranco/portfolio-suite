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
  Grid,
  Chip,
  Paper,
  IconButton,
  CircularProgress,
  Divider
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { alpha } from '@mui/material/styles';
import RichTextEditor from '../common/RichTextEditor';
import { languagesApi, sectionsApi } from '../../services/api';
import { logInfo, logError } from '../../utils/logger';

function SectionForm({ open, onClose, section, mode = 'create' }) {
  const [formData, setFormData] = useState({
    id: '',
    code: '',
    section_texts: []
  });

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Language states
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [languageTexts, setLanguageTexts] = useState({});
  const [defaultLanguage, setDefaultLanguage] = useState(null);
  
  // Loading states
  const [loadingLanguages, setLoadingLanguages] = useState(false);

  // Fetch available languages when form opens
  useEffect(() => {
    if (open) {
      fetchLanguages();
    }
  }, [open]);

  const fetchLanguages = async () => {
    setLoadingLanguages(true);
    try {
      const response = await languagesApi.getLanguages({ page: 1, page_size: 100 });
      const languages = response.data.items || [];
      
      setAvailableLanguages(languages);
      
      // Find default language
      const defaultLang = languages.find(lang => lang.is_default || lang.isDefault) || 
                         (languages.length > 0 ? languages[0] : null);
      setDefaultLanguage(defaultLang);
      
      logInfo('SectionForm', 'Languages loaded:', { 
        total: languages.length, 
        defaultLanguage: defaultLang?.name 
      });
    } catch (error) {
      logError('SectionForm', 'Error loading languages:', error);
      setApiError('Failed to load languages: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoadingLanguages(false);
    }
  };

  // Initialize form data when section prop changes or mode changes
  useEffect(() => {
    if (mode === 'edit' || mode === 'delete') {
      if (section) {
        logInfo('SectionForm', 'Initializing form with section:', section);
        
        // Extract language texts
        const langTexts = {};
        const selectedLangs = [];
        
        if (section.section_texts && Array.isArray(section.section_texts)) {
          section.section_texts.forEach(text => {
            if (text.language_id) {
              const langObj = availableLanguages.find(lang => lang.id === text.language_id);
              if (langObj) {
                selectedLangs.push(langObj);
              } else {
                // Create temporary language object if not in available languages yet
                selectedLangs.push({
                  id: text.language_id,
                  name: `Language ${text.language_id}`,
                  code: `lang-${text.language_id}`,
                  is_default: false
                });
              }
              
              langTexts[text.language_id] = text.text || '';
            }
          });
        }
        
        setLanguageTexts(langTexts);
        setSelectedLanguages(selectedLangs);
        
        // Set form data
        setFormData({
          id: section.id || '',
          code: section.code || '',
          section_texts: section.section_texts || []
        });
      }
    } else {
      // Reset form for create mode
      setFormData({
        id: '',
        code: '',
        section_texts: []
      });
      setLanguageTexts({});
      setSelectedLanguages([]);
    }
  }, [section, mode, availableLanguages]);

  const validateForm = () => {
    const newErrors = {};
    
    // Skip validation for delete operations
    if (mode === 'delete') {
      return true;
    }
    
    // Validate code
    if (!formData.code?.trim()) {
      newErrors.code = 'Code is required';
    }
    
    // Validate that at least one language is selected
    if (selectedLanguages.length === 0) {
      newErrors.languages = 'At least one language is required';
    } else {
      // Check each language has text
      for (const lang of selectedLanguages) {
        const langId = lang.id;
        const text = languageTexts[langId];
        if (!text || text.trim() === '' || text === '<p><br></p>' || text === '<br>') {
          newErrors.languages = 'All languages must have text content';
          break;
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setApiError('');
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      let response;
      const requestData = {
        code: formData.code,
        section_texts: selectedLanguages.map(lang => ({
          language_id: lang.id,
          text: languageTexts[lang.id] || ''
        }))
      };
      
      logInfo('SectionForm', `${mode.toUpperCase()} request:`, { mode, data: requestData });
      
      if (mode === 'delete') {
        response = await sectionsApi.deleteSection(formData.id);
      } else if (mode === 'edit') {
        response = await sectionsApi.updateSection(formData.id, requestData);
      } else {
        response = await sectionsApi.createSection(requestData);
      }
      
      logInfo('SectionForm', `${mode.toUpperCase()} successful:`, response.data);
      
      // Success - close form and refresh data
      onClose(true);
    } catch (error) {
      logError('SectionForm', `Error ${mode}ing section:`, error);
      const errorMessage = error.response?.data?.detail || error.message || `Failed to ${mode} section`;
      setApiError(errorMessage);
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
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleAddLanguage = () => {
    // Find available languages not yet selected
    const availableLangsToAdd = availableLanguages.filter(
      lang => !selectedLanguages.some(selected => selected.id === lang.id)
    );
    
    if (availableLangsToAdd.length > 0) {
      const newLang = availableLangsToAdd[0];
      setSelectedLanguages(prev => [...prev, newLang]);
      setLanguageTexts(prev => ({
        ...prev,
        [newLang.id]: ''
      }));
      
      // Clear language validation error if it exists
      if (errors.languages) {
        setErrors(prev => ({ ...prev, languages: null }));
      }
    }
  };

  const handleRemoveLanguage = (langId) => {
    setSelectedLanguages(prev => prev.filter(lang => lang.id !== langId));
    setLanguageTexts(prev => {
      const updated = { ...prev };
      delete updated[langId];
      return updated;
    });
  };

  const handleLanguageTextChange = (langId, value) => {
    setLanguageTexts(prev => ({
      ...prev,
      [langId]: value
    }));
    
    // Clear language validation error if it exists
    if (errors.languages) {
      setErrors(prev => ({ ...prev, languages: null }));
    }
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'create':
        return 'Create New Section';
      case 'edit':
        return 'Edit Section';
      case 'delete':
        return 'Delete Section';
      default:
        return 'Section';
    }
  };

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
              Delete this section?
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
              This action cannot be undone. All associated text content and translations will also be deleted.
            </Typography>
          
            {/* Section Code */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#505050',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  fontSize: '13px'
                }}
              >
                <strong>Code:</strong> {formData.code || 'None'}
              </Typography>
            </Box>
            
            {/* Languages and Section Content */}
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
                    const text = languageTexts[langId] || '';
                    const truncatedText = text.length > 100 ? text.substring(0, 100) + '...' : text;
                    
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
                            {truncatedText || 'No content'}
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
    return (
      <form>
        <Grid container spacing={2}>
          {/* Basic Information Section */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" sx={{ 
              fontWeight: 500, 
              color: '#1976d2',
              fontSize: '1rem',
              mb: 2
            }}>
              Basic Information
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              id="code"
              name="code"
              label="Section Code"
              value={formData.code || ''}
              onChange={handleChange}
              disabled={isSubmitting || mode === 'delete'}
              placeholder="e.g. about_me, contact_info"
              size="small"
              error={!!errors.code}
              helperText={errors.code || 'Unique identifier for this section'}
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mb: 1.5,
              mt: 2
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
                  selectedLanguages.length >= availableLanguages.length ||
                  mode === 'delete'
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
            {!loadingLanguages && availableLanguages.length === 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                No languages available in the system. Please add languages first using the Languages management page.
              </Alert>
            )}
            
            {/* Show helpful message when all languages are selected */}
            {!loadingLanguages && availableLanguages.length > 0 && selectedLanguages.length >= availableLanguages.length && (
              <Alert severity="info" sx={{ mb: 2 }}>
                All available languages ({availableLanguages.length}) have been added to this section.
              </Alert>
            )}
          </Grid>
        </Grid>
      </form>
    );
  };

  const renderLanguageSections = () => {
    return selectedLanguages.map((lang) => {
      const langId = lang.id;
      const text = languageTexts[langId] || '';

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
                disabled={isSubmitting || mode === 'delete' || selectedLanguages.length === 1}
                color="error"
                aria-label={`Remove ${lang.name} language`}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Rich text editor for this language */}
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" gutterBottom>Section Content</Typography>
              {mode === 'delete' ? (
                <Box 
                  sx={{ 
                    p: 2, 
                    border: '1px solid #e0e0e0', 
                    borderRadius: 1, 
                    minHeight: '100px',
                    bgcolor: 'background.default'
                  }}
                  dangerouslySetInnerHTML={{ __html: text || '' }}
                />
              ) : (
                <RichTextEditor
                  value={text || ''}
                  onChange={(value) => handleLanguageTextChange(langId, value)}
                  placeholder={`Enter content for this section in ${lang.name}`}
                  style={{ minHeight: '150px' }}
                  readOnly={isSubmitting}
                />
              )}
            </Box>
          </Paper>
        </Grid>
      );
    });
  };

  return (
    <Dialog 
      open={open} 
      onClose={() => !isSubmitting && onClose(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column'
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
        flexGrow: 1,
        overflowY: 'auto',
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

export default SectionForm;
