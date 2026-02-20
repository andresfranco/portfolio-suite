import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Paper,
  Box,
  FormHelperText,
  Grid
} from '@mui/material';
import SERVER_URL from '../common/BackendServerData';
import RichTextEditor from '../common/RichTextEditor';

function TranslationForm({ open, onClose, translation, mode = 'create' }) {
  const [formData, setFormData] = useState({
    id: '',
    identifier: '',
    language_id: '',
    text: ''
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(null);

  // Fetch available languages
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/api/languages/full`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch languages');
        }
        
        const data = await response.json();
        setAvailableLanguages(data.items || []);
      } catch (error) {
        console.error('Error fetching languages:', error);
        setApiError('Failed to load languages: ' + error.message);
      }
    };
    
    fetchLanguages();
  }, []);

  // Set form data when translation is provided (for edit/delete)
  useEffect(() => {
    if (mode === 'edit' || mode === 'delete') {
      if (translation) {

        // Get the first language from the language array
        const firstLanguage = translation.language?.[0];
        const languageId = firstLanguage?.id?.toString() || '';

        setFormData({
          id: translation.id,
          identifier: translation.identifier || '',
          language_id: languageId,
          text: translation.text || ''
        });

        setSelectedLanguage(firstLanguage || null);
      }
    } else {
      // Reset form for create mode
      setFormData({
        id: '',
        identifier: '',
        language_id: '',
        text: ''
      });
    }
  }, [translation, mode]);

    // Validate form fields
    const validateForm = async () => {
      const newErrors = {};

      if (!formData.identifier?.trim()) {
          newErrors.identifier = 'Identifier is required';
      }
      if (!formData.language_id) {
          newErrors.language_id = 'Language is required';
      }
      if (!formData.text || formData.text === '<p><br></p>' || formData.text === '<br>') {
          newErrors.text = 'Text is required';
      }

      // Check for uniqueness of identifier + language combination
      if (formData.identifier?.trim() && formData.language_id) {
          try {
              const url = `${SERVER_URL}/api/translations/check-unique?identifier=${encodeURIComponent(formData.identifier)}&language_id=${formData.language_id}${mode === 'edit' ? `&exclude_id=${formData.id}` : ''}`;
              const response = await fetch(url, {
                  credentials: 'include'
              });

              if (!response.ok) {
                  throw new Error('Failed to check uniqueness');
              }

              const data = await response.json();
              if (data.exists) {
                  newErrors.identifier = 'A translation with this identifier and language already exists';
              }
          } catch (error) {
              console.error('Error checking uniqueness:', error);
              setApiError('Failed to validate uniqueness: ' + error.message);
          }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    // Skip validation for delete mode
    if (mode !== 'delete') {
      const isValid = await validateForm();
      if (!isValid) {
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let url = `${SERVER_URL}/api/translations`;
      let method = 'POST';

      // Create a copy of formData to modify for the API request
      let body = {
        identifier: formData.identifier,
        languages: formData.language_id ? [parseInt(formData.language_id, 10)] : [],
        text: formData.text
      };

      // For edit and delete, use the translation ID in the URL
      if (mode === 'edit' || mode === 'delete') {
        url = `${SERVER_URL}/api/translations/${formData.id}`;
        method = mode === 'edit' ? 'PUT' : 'DELETE';

        if (mode === 'edit') {
          body.id = formData.id;
        }
      }


      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: method !== 'DELETE' ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to ${mode} translation: ${response.status}`);
      }

      // Close the form and refresh data
      onClose(true);
    } catch (error) {
      console.error(`Error ${mode}ing translation:`, error);
      setApiError(error.message);
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
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Update selected language when language_id changes
    if (name === 'language_id') {
      const language = availableLanguages.find(lang => lang.id.toString() === value);
      setSelectedLanguage(language || null);
    }
  };

  const handleRichTextChange = (content) => {
    setFormData(prev => ({ ...prev, text: content }));
    if (errors.text) {
      setErrors(prev => ({ ...prev, text: '' }));
    }
  };

  return (
    <Dialog
        open={open}
        onClose={() => !isSubmitting && onClose(false)}
        maxWidth="sm"
        fullWidth
    >
        <DialogTitle>
            {mode === 'create' ? 'Create Translation' : mode === 'edit' ? 'Edit Translation' : 'Delete Translation'}
        </DialogTitle>

        <form onSubmit={handleSubmit}>
            <DialogContent>
                {apiError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {apiError}
                    </Alert>
                )}

                {mode === 'delete' ? (
                    <>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            Are you sure you want to delete this translation? This action cannot be undone.
                        </Alert>

                        <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <TextField
                                    label="Identifier"
                                    name="identifier"
                                    value={formData.identifier}
                                    disabled
                                    fullWidth
                                />

                                <FormControl fullWidth>
                                    <InputLabel>Language</InputLabel>
                                    <Select
                                        name="language_id"
                                        value={formData.language_id}
                                        label="Language"
                                        disabled
                                    >
                                        <MenuItem value={formData.language_id}>
                                            {selectedLanguage ? `${selectedLanguage.name} (${selectedLanguage.code})` : ''}
                                        </MenuItem>
                                    </Select>
                                </FormControl>

                                <Grid item xs={12}>
                                  <FormControl fullWidth error={!!errors.text}>
                                    <RichTextEditor
                                      value={formData.text}
                                      onChange={handleRichTextChange}
                                      placeholder="Enter translation text here..."
                                      readOnly={true} // Always readOnly in delete mode
                                      style={{ 
                                        minHeight: '300px',
                                        marginBottom: '20px'
                                      }}
                                    />
                                    {errors.text && (
                                      <FormHelperText error>{errors.text}</FormHelperText>
                                    )}
                                  </FormControl>
                                </Grid>
                            </Box>
                        </Paper>
                    </>
                ) : (
                    <Stack spacing={2}>
                        <TextField
                            label="Identifier"
                            name="identifier"
                            value={formData.identifier}
                            onChange={handleChange}
                            error={!!errors.identifier}
                            helperText={errors.identifier}
                            disabled={isSubmitting}
                            required
                            fullWidth
                        />

                        <FormControl
                            fullWidth
                            error={!!errors.language_id}
                            required
                        >
                            <InputLabel>Language</InputLabel>
                            <Select
                                name="language_id"
                                value={formData.language_id}
                                onChange={handleChange}
                                label="Language"
                                disabled={isSubmitting}
                            >
                                <MenuItem value="">
                                    <em>Select a language</em>
                                </MenuItem>
                                {availableLanguages.map((lang) => (
                                    <MenuItem key={lang.id} value={lang.id.toString()}>
                                        {lang.name} ({lang.code})
                                    </MenuItem>
                                ))}
                            </Select>
                            {errors.language_id && (
                                <FormHelperText>{errors.language_id}</FormHelperText>
                            )}
                        </FormControl>

                        <Grid item xs={12}>
                          <FormControl fullWidth error={!!errors.text}>
                            <RichTextEditor
                              value={formData.text}
                              onChange={handleRichTextChange}
                              placeholder="Enter translation text here..."
                              readOnly={isSubmitting} // readOnly when submitting
                              style={{ 
                                minHeight: '300px',
                                marginBottom: '20px'
                              }}
                            />
                            {errors.text && (
                              <FormHelperText error>{errors.text}</FormHelperText>
                            )}
                          </FormControl>
                        </Grid>
                    </Stack>
                )}
            </DialogContent>

            <DialogActions>
                <Button
                    onClick={() => onClose(false)}
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    color={mode === 'delete' ? 'error' : 'primary'}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <CircularProgress size={24} />
                    ) : mode === 'create' ? (
                        'Create'
                    ) : mode === 'edit' ? (
                        'Save'
                    ) : (
                        'Delete'
                    )}
                </Button>
            </DialogActions>
        </form>
    </Dialog>
);
}

export default TranslationForm;