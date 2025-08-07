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
  Chip,
  Paper,
  IconButton,
  OutlinedInput,
  CircularProgress,
  Divider,
  InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import WarningIcon from '@mui/icons-material/Warning';
import { alpha } from '@mui/material/styles';
import RichTextEditor from '../common/RichTextEditor';
import { categoriesApi, languagesApi, skillsApi, projectsApi } from '../../services/api';
import { logInfo, logError } from '../../utils/logger';

function ProjectForm({ open, onClose, project, mode = 'create' }) {
  const [formData, setFormData] = useState({
    id: '',
    repository_url: '',
    website_url: '',
    project_texts: [],
    categories: [],
    skills: []
  });

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Language, category, and skills states
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [languageTexts, setLanguageTexts] = useState({});
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [defaultLanguage, setDefaultLanguage] = useState(null);
  
  // Loading states
  const [loadingLanguages, setLoadingLanguages] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);

  // Fetch available languages and categories when form opens
  useEffect(() => {
    if (open) {
      fetchFormData();
    }
  }, [open]);

  const fetchFormData = async () => {
    setLoading(true);
    setApiError('');
    
    try {
      // Fetch languages
      setLoadingLanguages(true);
      const languagesResponse = await languagesApi.getLanguages({ page: 1, page_size: 100 });
      const languages = languagesResponse.data.items || languagesResponse.data || [];
      
      logInfo('ProjectForm', 'Languages fetched:', languages);
      setAvailableLanguages(languages);
      
      // Find default language
      const defaultLang = languages.find(lang => lang.is_default || lang.isDefault) || 
                        (languages.length > 0 ? languages[0] : null);
      setDefaultLanguage(defaultLang);
      setLoadingLanguages(false);

      // Fetch categories
      setLoadingCategories(true);
      const categoriesResponse = await categoriesApi.getCategories({ page: 1, page_size: 100 });
      
      let categoriesList = [];
      if (categoriesResponse.data && categoriesResponse.data.items) {
        categoriesList = categoriesResponse.data.items;
      } else if (categoriesResponse.data && Array.isArray(categoriesResponse.data)) {
        categoriesList = categoriesResponse.data;
      } else if (Array.isArray(categoriesResponse)) {
        categoriesList = categoriesResponse;
      }
      
      logInfo('ProjectForm', 'Total categories fetched:', categoriesList.length);
      
      // Filter for project categories (PROJ type)
      const projectCategories = categoriesList.filter(category => 
        category && category.type_code === "PROJ"
      );
      
      logInfo('ProjectForm', 'Project categories filtered:', {
        total: categoriesList.length,
        projectCategories: projectCategories.length,
        availableTypes: [...new Set(categoriesList.map(c => c.type_code))]
      });
      
      if (projectCategories.length === 0) {
        logError('ProjectForm', 'No PROJ type categories found in database', {
          totalCategories: categoriesList.length,
          availableTypes: [...new Set(categoriesList.map(c => c.type_code))]
        });
      }
      
      setAvailableCategories(projectCategories);
      setLoadingCategories(false);
      
      // Fetch skills
      setLoadingSkills(true);
      const skillsResponse = await skillsApi.getSkills({ page: 1, page_size: 100 });
      
      let skillsList = [];
      if (skillsResponse.data && skillsResponse.data.items) {
        skillsList = skillsResponse.data.items;
      } else if (skillsResponse.data && Array.isArray(skillsResponse.data)) {
        skillsList = skillsResponse.data;
      } else if (Array.isArray(skillsResponse)) {
        skillsList = skillsResponse;
      }
      
      logInfo('ProjectForm', 'Total skills fetched:', skillsList.length);
      
      if (skillsList.length === 0) {
        logError('ProjectForm', 'No skills found in database', {
          totalSkills: skillsList.length
        });
      }
      
      setAvailableSkills(skillsList);
      setLoadingSkills(false);
      
      // Auto-add default language in create mode
      if (mode === 'create' && defaultLang && selectedLanguages.length === 0) {
        setSelectedLanguages([defaultLang]);
        setLanguageTexts({
          [defaultLang.id]: { name: '', description: '' }
        });
      }
      
    } catch (error) {
      logError('ProjectForm', 'Error fetching form data:', error);
      setApiError('Failed to load form data: ' + error.message);
      setLoadingLanguages(false);
      setLoadingCategories(false);
      setLoadingSkills(false);
    } finally {
      setLoading(false);
    }
  };

  // Initialize form data when project prop changes or mode changes
  useEffect(() => {
    if (mode === 'edit' || mode === 'delete') {
      if (project) {
        logInfo('ProjectForm', 'Initializing form with project:', project);
        
        // Extract language texts
        const langTexts = {};
        const selectedLangs = [];
        
        if (project.project_texts && Array.isArray(project.project_texts)) {
          project.project_texts.forEach(text => {
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
              
              langTexts[text.language_id] = {
                name: text.name || '',
                description: text.description || ''
              };
            }
          });
        }
        
        setLanguageTexts(langTexts);
        setSelectedLanguages(selectedLangs);
        
        // Extract selected category IDs
        const categoryIds = [];
        if (project.categories && Array.isArray(project.categories)) {
          project.categories.forEach(category => {
            if (category && category.id) {
              categoryIds.push(category.id);
            }
          });
        }
        setSelectedCategories(categoryIds);
        
        // Extract selected skill IDs
        const skillIds = [];
        if (project.skills && Array.isArray(project.skills)) {
          project.skills.forEach(skill => {
            if (skill && skill.id) {
              skillIds.push(skill.id);
            }
          });
        }
        setSelectedSkills(skillIds);
        
        // Set form data
        setFormData({
          id: project.id || '',
          repository_url: project.repository_url || '',
          website_url: project.website_url || '',
          project_texts: project.project_texts || [],
          categories: project.categories || [],
          skills: project.skills || []
        });
      }
    } else {
      // Reset form for create mode
      setFormData({
        id: '',
        repository_url: '',
        website_url: '',
        project_texts: [],
        categories: [],
        skills: []
      });
      setSelectedCategories([]);
      setSelectedSkills([]);
      setLanguageTexts({});
      setSelectedLanguages([]);
    }
  }, [project, mode, availableLanguages]);

  const validateForm = () => {
    const newErrors = {};
    
    // Skip validation for delete operations
    if (mode === 'delete') {
      return true;
    }
    
    // Validate that at least one language is selected
    if (selectedLanguages.length === 0) {
      newErrors.languages = 'At least one language is required';
    } else {
      // Check each language has a name
      for (const lang of selectedLanguages) {
        const langId = lang.id;
        if (!languageTexts[langId]?.name?.trim()) {
          newErrors.languages = 'All languages must have a name';
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
        repository_url: formData.repository_url,
        website_url: formData.website_url,
        categories: selectedCategories,
        project_texts: selectedLanguages.map(lang => ({
          language_id: lang.id,
          name: languageTexts[lang.id]?.name || '',
          description: languageTexts[lang.id]?.description || ''
        })),
        skills: selectedSkills
      };
      
      logInfo('ProjectForm', `${mode.toUpperCase()} request:`, { mode, data: requestData });
      
      if (mode === 'delete') {
        response = await projectsApi.deleteProject(formData.id);
      } else if (mode === 'edit') {
        response = await projectsApi.updateProject(formData.id, requestData);
      } else {
        response = await projectsApi.createProject(requestData);
      }
      
      logInfo('ProjectForm', `${mode.toUpperCase()} successful:`, response.data);
      
      // Success - close form and refresh data
      onClose(true);
    } catch (error) {
      logError('ProjectForm', `Error ${mode}ing project:`, error);
      const errorMessage = error.response?.data?.detail || error.message || `Failed to ${mode} project`;
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
        [newLang.id]: { name: '', description: '' }
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

  const handleLanguageTextChange = (langId, field, value) => {
    setLanguageTexts(prev => ({
      ...prev,
      [langId]: {
        ...prev[langId],
        [field]: value
      }
    }));
    
    // Clear language validation error if it exists
    if (errors.languages) {
      setErrors(prev => ({ ...prev, languages: null }));
    }
  };

  const handleCategorySelect = (e) => {
    setSelectedCategories(e.target.value);
  };

  const handleSkillSelect = (e) => {
    setSelectedSkills(e.target.value);
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'create':
        return 'Create New Project';
      case 'edit':
        return 'Edit Project';
      case 'delete':
        return 'Delete Project';
      default:
        return 'Project';
    }
  };

  const getCategoryLabel = (categoryId) => {
    const category = availableCategories.find(cat => cat.id === categoryId);
    if (!category) return `Category ID: ${categoryId}`;
    
    // Try to get name from default language
    if (defaultLanguage && category.category_texts?.length > 0) {
      const defaultText = category.category_texts.find(text => 
        text.language_id === defaultLanguage.id
      );
      if (defaultText && defaultText.name) {
        return defaultText.name;
      }
    }
    
    return category.name || category.code || `Category ID: ${categoryId}`;
  };

  const getSkillLabel = (skillId) => {
    const skill = availableSkills.find(sk => sk.id === skillId);
    if (!skill) return `Skill ID: ${skillId}`;
    
    // Try to get name from default language
    if (defaultLanguage && skill.skill_texts?.length > 0) {
      const defaultText = skill.skill_texts.find(text => 
        text.language_id === defaultLanguage.id
      );
      if (defaultText && defaultText.name) {
        return defaultText.name;
      }
    }
    
    return skill.name || skill.type || `Skill ID: ${skillId}`;
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
              Delete this project?
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
              This action cannot be undone. All associated content, categories, skills, and translations will also be deleted.
            </Typography>
          
            {/* Repository URL */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#505050',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  fontSize: '13px'
                }}
              >
                <strong>Repository URL:</strong> {formData.repository_url || 'None'}
              </Typography>
            </Box>
            
            {/* Website URL */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#505050',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  fontSize: '13px'
                }}
              >
                <strong>Website URL:</strong> {formData.website_url || 'None'}
              </Typography>
            </Box>
            
            {/* Categories */}
            {selectedCategories.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#505050',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    fontSize: '13px'
                  }}
                >
                  <strong>Categories:</strong> {selectedCategories.map(catId => getCategoryLabel(catId)).join(', ')}
                </Typography>
              </Box>
            )}
            
            {/* Skills */}
            {selectedSkills.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#505050',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    fontSize: '13px'
                  }}
                >
                  <strong>Skills:</strong> {selectedSkills.map(skillId => getSkillLabel(skillId)).join(', ')}
                </Typography>
              </Box>
            )}
            
            {/* Languages and Project Names */}
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
              id="repository_url"
              name="repository_url"
              label="Repository URL"
              value={formData.repository_url || ''}
              onChange={handleChange}
              disabled={isSubmitting || mode === 'delete'}
              placeholder="e.g. https://github.com/username/repo"
              size="small"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              id="website_url"
              name="website_url"
              label="Website URL"
              value={formData.website_url || ''}
              onChange={handleChange}
              disabled={isSubmitting || mode === 'delete'}
              placeholder="e.g. https://myproject.com"
              size="small"
            />
          </Grid>
          
          {/* Categories Section */}
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel id="categories-select-label">Select Categories</InputLabel>
              <Select
                labelId="categories-select-label"
                id="categories-select"
                multiple
                value={selectedCategories}
                onChange={handleCategorySelect}
                input={<OutlinedInput label="Select Categories" />}
                disabled={mode === 'delete' || isSubmitting || loadingCategories}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((catId) => (
                      <Chip key={catId} label={getCategoryLabel(catId)} size="small" />
                    ))}
                  </Box>
                )}
              >
                {loadingCategories ? (
                  <MenuItem disabled>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      Loading categories...
                    </Box>
                  </MenuItem>
                ) : availableCategories.length === 0 ? (
                  <MenuItem disabled>
                    <em>No project categories available. Please create PROJ type categories in the Categories management page.</em>
                  </MenuItem>
                ) : (
                  availableCategories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {getCategoryLabel(category.id)}
                    </MenuItem>
                  ))
                )}
              </Select>
              {loadingCategories && (
                <FormHelperText>Loading available categories...</FormHelperText>
              )}
              {!loadingCategories && availableCategories.length === 0 && (
                <FormHelperText error>
                  No project categories found. Please create categories with type_code 'PROJ' using the Categories management page.
                </FormHelperText>
              )}
            </FormControl>
          </Grid>
          
          {/* Skills Section */}
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel id="skills-select-label">Select Skills</InputLabel>
              <Select
                labelId="skills-select-label"
                id="skills-select"
                multiple
                value={selectedSkills}
                onChange={handleSkillSelect}
                input={<OutlinedInput label="Select Skills" />}
                disabled={mode === 'delete' || isSubmitting || loadingSkills}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((skillId) => (
                      <Chip key={skillId} label={getSkillLabel(skillId)} size="small" />
                    ))}
                  </Box>
                )}
              >
                {loadingSkills ? (
                  <MenuItem disabled>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      Loading skills...
                    </Box>
                  </MenuItem>
                ) : availableSkills.length === 0 ? (
                  <MenuItem disabled>
                    <em>No skills available. Please create skills using the Skills management page.</em>
                  </MenuItem>
                ) : (
                  availableSkills.map((skill) => (
                    <MenuItem key={skill.id} value={skill.id}>
                      {getSkillLabel(skill.id)}
                    </MenuItem>
                  ))
                )}
              </Select>
              {loadingSkills && (
                <FormHelperText>Loading available skills...</FormHelperText>
              )}
              {!loadingSkills && availableSkills.length === 0 && (
                <FormHelperText>
                  No skills found. You can create skills using the Skills management page.
                </FormHelperText>
              )}
            </FormControl>
          </Grid>
          
          {/* Language Selector Section */}
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
                  selectedLanguages.length >= availableLanguages.length
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
                All available languages ({availableLanguages.length}) have been added to this project.
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
      const langTexts = languageTexts[langId] || { name: '', description: '' };
      const nameError = errors[`${langId}_name`];

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

            {/* Text fields for this language */}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  id={`${langId}_name`}
                  name={`${langId}_name`}
                  label="Project Name"
                  value={langTexts.name || ''}
                  onChange={(e) => handleLanguageTextChange(langId, 'name', e.target.value)}
                  error={!!nameError}
                  helperText={nameError || ''}
                  size="small"
                  disabled={isSubmitting || mode === 'delete'}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>Description</Typography>
                  {mode === 'delete' ? (
                    <Box 
                      sx={{ 
                        p: 2, 
                        border: '1px solid #e0e0e0', 
                        borderRadius: 1, 
                        minHeight: '100px',
                        bgcolor: 'background.default'
                      }}
                      dangerouslySetInnerHTML={{ __html: langTexts.description || '' }}
                    />
                  ) : (
                    <RichTextEditor
                      value={langTexts.description || ''}
                      onChange={(value) => handleLanguageTextChange(langId, 'description', value)}
                      placeholder="Enter a detailed description of the project"
                      style={{ minHeight: '150px' }}
                      readOnly={isSubmitting}
                    />
                  )}
                </Box>
              </Grid>
            </Grid>
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

export default ProjectForm;
