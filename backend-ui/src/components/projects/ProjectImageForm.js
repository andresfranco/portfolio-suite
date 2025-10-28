import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  TextField,
  CircularProgress
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Add as AddIcon
} from '@mui/icons-material';
import SERVER_URL from '../common/BackendServerData';

function ProjectImageForm({ open, onClose, project }) {
  const [images, setImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [defaultLanguage, setDefaultLanguage] = useState(null);
  const [newImage, setNewImage] = useState({
    file: null,
    category: '',
    language_id: '',  // Changed from null to empty string to match MenuItem value
    description: ''
  });
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);

  // Fetch categories and other data when component opens
  useEffect(() => {
    const fetchData = async () => {
      if (!project || !project.id || !open) return;
      
      try {
        setLoadingCategories(true);
        
        // Fetch languages to identify default language
        const languagesResponse = await fetch(`${SERVER_URL}/api/languages/?page=1&page_size=100`, {
          credentials: 'include',
          mode: 'cors'
        });
        if (!languagesResponse.ok) {
          throw new Error(`Failed to fetch languages: ${languagesResponse.statusText}`);
        }
        
        const languagesData = await languagesResponse.json();
        const languagesList = languagesData.items || [];
        const defaultLang = languagesList.find(lang => lang.is_default || lang.isDefault) || 
                         (languagesList.length > 0 ? languagesList[0] : null);
        setDefaultLanguage(defaultLang);
        setLanguages(languagesList);  // Store all languages
        
        // Fetch PROI categories using the same endpoint as ProjectImages
        const categoriesResponse = await fetch(`${SERVER_URL}/api/categories/by-code-pattern/PROI`, {
          credentials: 'include',
          mode: 'cors'
        });
        if (!categoriesResponse.ok) {
          throw new Error(`Failed to fetch categories: ${categoriesResponse.statusText}`);
        }
        
        const categoriesData = await categoriesResponse.json();
        let categoriesList = categoriesData || [];
        
        console.log("ProjectImageForm - PROI categories from API:", categoriesList);
        
        // Map categories to format with code and display name
        const formattedCategories = categoriesList.map(category => {
          let displayName = category.name || category.code;
          let cleanCode = category.code ? category.code.trim() : category.code;
          let friendlyName = '';
          
          // Create a user-friendly display name if no name is set
          if (!displayName || displayName === cleanCode) {
            // Extract name part from code (e.g., "PROI-GALLERY" -> "Gallery")
            if (cleanCode && cleanCode.includes('-')) {
              const parts = cleanCode.split('-');
              if (parts.length > 1) {
                // Convert "GALLERY" to "Gallery"
                friendlyName = parts[1].charAt(0).toUpperCase() + 
                               parts[1].slice(1).toLowerCase();
              }
            }
            displayName = friendlyName || cleanCode;
          }
          
          // Get name in default language if available
          if (defaultLang && category.category_texts && Array.isArray(category.category_texts)) {
            const defaultText = category.category_texts.find(text => 
              text.language_id === defaultLang.id
            );
            if (defaultText && defaultText.name) {
              displayName = defaultText.name;
            }
          }
          
          return {
            code: category.code,
            name: displayName,
            id: category.id,
            // Trim code for display
            displayCode: cleanCode
          };
        });
        
        console.log("ProjectImageForm - Formatted categories for select:", formattedCategories);
        
        setCategories(formattedCategories);
        
        // Set default category if available
        if (formattedCategories.length > 0) {
          setNewImage(prev => ({
            ...prev,
            category: formattedCategories[0].code
          }));
        }
        
      } catch (error) {
        console.error('ProjectImageForm - Error fetching categories:', error);
        setApiError('Failed to load categories: ' + error.message);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchData();
  }, [project, open]);

  // Fetch project images
  useEffect(() => {
    const fetchImages = async () => {
      if (!project || !project.id) return;
      
      try {
        const response = await fetch(`${SERVER_URL}/api/projects/${project.id}/images`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch project images');
        }
        
        const data = await response.json();
        setImages(data || []);
      } catch (error) {
        console.error('Error fetching project images:', error);
        setApiError('Failed to load project images');
      }
    };

    fetchImages();
  }, [project]);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewImage(prev => ({
        ...prev,
        file
      }));
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewImage(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUploadImage = async () => {
    if (!newImage.file) {
      setApiError('Please select an image to upload');
      return;
    }
    
    setIsSubmitting(true);
    setApiError('');
    
    try {
      // Define categories that should only have one image per language
      const UNIQUE_CATEGORIES = ['PROI-LOGO', 'PROI-THUMBNAIL'];
      const categoryCode = newImage.category;
      const languageId = newImage.language_id;
      
      // For unique categories, check if an image already exists and delete it
      if (UNIQUE_CATEGORIES.includes(categoryCode)) {
        const existingImage = images.find(img => 
          img.category === categoryCode && 
          (languageId ? img.language_id === parseInt(languageId) : !img.language_id)
        );
        
        if (existingImage) {
          console.log(`Deleting existing ${categoryCode} image (ID: ${existingImage.id}) before uploading new one`);
          
          try {
            const deleteResponse = await fetch(
              `${SERVER_URL}/api/projects/${project.id}/images/${existingImage.id}`,
              {
                method: 'DELETE',
                credentials: 'include'
              }
            );
            
            if (!deleteResponse.ok) {
              console.warn('Failed to delete old image, backend will handle it');
            } else {
              console.log('Successfully deleted old image');
              // Update local state immediately
              setImages(images.filter(img => img.id !== existingImage.id));
            }
          } catch (deleteErr) {
            console.warn('Error deleting old image, backend will handle it:', deleteErr);
          }
        }
      }
      
      // Proceed with upload
      const formData = new FormData();
      formData.append('file', newImage.file);
      formData.append('category_code', newImage.category);
      if (newImage.language_id) {
        formData.append('language_id', newImage.language_id.toString());
      }
      if (newImage.description) {
        formData.append('description', newImage.description);
      }
      
      const response = await fetch(`${SERVER_URL}/api/projects/${project.id}/images`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to upload image: ${response.status}`);
      }
      
      // Refresh the images list
      const updatedResponse = await fetch(`${SERVER_URL}/api/projects/${project.id}/images`, {
        credentials: 'include'
      });
      
      if (!updatedResponse.ok) {
        throw new Error('Failed to refresh project images');
      }
      
      const updatedData = await updatedResponse.json();
      setImages(updatedData || []);
      
      // Reset the form
      setNewImage({
        file: null,
        category: categories.length > 0 ? categories[0].code : '',
        language_id: '',  // Changed from null to empty string
        description: ''
      });
      setUploadPreview(null);
      
      // Reset the file input
      const fileInput = document.getElementById('project-image-upload');
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setApiError(error.message || 'Failed to upload image');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }
    
    setIsSubmitting(true);
    setApiError('');
    
    try {
      const response = await fetch(`${SERVER_URL}/api/projects/${project.id}/images/${imageId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to delete image: ${response.status}`);
      }
      
      // Update the images list
      setImages(images.filter(img => img.id !== imageId));
    } catch (error) {
      console.error('Error deleting image:', error);
      setApiError(error.message || 'Failed to delete image');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryLabel = (categoryValue) => {
    const category = categories.find(cat => cat.code === categoryValue);
    return category ? category.name : categoryValue;
  };

  return (
    <Dialog 
      open={open} 
      onClose={() => onClose(false)}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        Manage Project Images - {project?.title}
      </DialogTitle>
      <DialogContent>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {apiError}
          </Alert>
        )}
        
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ color: '#1976d2' }}>
            Upload New Image
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <Box 
                sx={{ 
                  border: '1px dashed grey', 
                  height: 200, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {uploadPreview ? (
                  <CardMedia
                    component="img"
                    image={uploadPreview}
                    alt="Upload preview"
                    sx={{ 
                      height: '100%', 
                      width: '100%', 
                      objectFit: 'contain' 
                    }}
                  />
                ) : (
                  <Box sx={{ textAlign: 'center' }}>
                    <UploadIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Select an image to upload
                    </Typography>
                  </Box>
                )}
                <input
                  id="project-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel id="image-category-label">Category</InputLabel>
                  <Select
                    labelId="image-category-label"
                    id="image-category"
                    name="category"
                    value={newImage.category}
                    onChange={handleInputChange}
                    label="Category"
                    disabled={loadingCategories || categories.length === 0}
                  >
                    {loadingCategories ? (
                      <MenuItem disabled>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CircularProgress size={16} sx={{ mr: 1 }} />
                          Loading categories...
                        </Box>
                      </MenuItem>
                    ) : categories.length === 0 ? (
                      <MenuItem disabled>
                        <em>No project image categories available. Please create PROI type categories.</em>
                      </MenuItem>
                    ) : (
                      categories.map((category) => (
                        <MenuItem key={category.code} value={category.code}>
                          {category.name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  {loadingCategories && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      Loading available categories...
                    </Typography>
                  )}
                  {!loadingCategories && categories.length === 0 && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                      No project image categories found. Please create categories with type_code 'PROI'.
                    </Typography>
                  )}
                </FormControl>
                
                <FormControl fullWidth>
                  <InputLabel id="image-language-label">Language (Optional)</InputLabel>
                  <Select
                    labelId="image-language-label"
                    name="language_id"
                    value={newImage.language_id || ''}
                    onChange={handleInputChange}
                    label="Language (Optional)"
                  >
                    <MenuItem value="">
                      <em>None (Default)</em>
                    </MenuItem>
                    {languages.map((language) => (
                      <MenuItem key={language.id} value={language.id}>
                        {language.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Select a language if this image is language-specific
                  </Typography>
                </FormControl>
                
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={newImage.description}
                  onChange={handleInputChange}
                  multiline
                  rows={2}
                />
                
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={handleUploadImage}
                  disabled={isSubmitting || !newImage.file || !newImage.category || categories.length === 0}
                  sx={{
                    mr: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 2,
                    px: 3,
                    py: 1,
                    boxShadow: 0,
                    '&:hover': {
                      boxShadow: 1
                    }
                  }}
                >
                  Upload Image
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
        
        <Typography variant="h6" gutterBottom>
          Current Images
        </Typography>
        {images.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No images have been uploaded for this project yet.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {images.map((image) => (
              <Grid item xs={12} sm={6} md={4} key={image.id}>
                <Card>
                  <CardMedia
                    component="img"
                    height="140"
                    image={image.image_url ? `${SERVER_URL}${image.image_url}` : `${SERVER_URL}/static/${image.image_path}`}
                    alt={image.description || 'Project image'}
                    sx={{ objectFit: 'contain', bgcolor: 'background.paper' }}
                  />
                  <CardContent sx={{ pb: 0 }}>
                    <Typography variant="subtitle1" color="primary">
                      {getCategoryLabel(image.category)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {image.description || 'No description'}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <IconButton 
                      color="error" 
                      onClick={() => handleDeleteImage(image.id)}
                      disabled={isSubmitting}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={() => onClose(true)} 
          variant="contained"
        >
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProjectImageForm;
