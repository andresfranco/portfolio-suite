import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Divider
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  CloudUpload as UploadIcon
} from '@mui/icons-material';
import SERVER_URL from '../common/BackendServerData';
import PermissionGate from '../common/PermissionGate';

// Define image categories
const IMAGE_CATEGORIES = [
  { value: 'main', label: 'Main Image' },
  { value: 'thumbnail', label: 'Thumbnail' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'background', label: 'Background' }
];

function PortfolioImageForm({ open, onClose, portfolio }) {
  const [images, setImages] = useState([]);
  const [newImage, setNewImage] = useState({
    file: null,
    category: 'gallery',
    alt_text: ''
  });
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);

  // Define fetchImages with useCallback to prevent dependency cycle
  const fetchImages = useCallback(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/portfolios/${portfolio.id}/images`);
      
      if (response.ok) {
        const data = await response.json();
        setImages(data);
      } else {
        console.error('Failed to fetch portfolio images');
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  }, [portfolio]);

  // Fetch portfolio images
  useEffect(() => {
    if (portfolio && portfolio.id) {
      fetchImages();
    }
  }, [portfolio, fetchImages]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewImage(prev => ({
        ...prev,
        file
      }));
      
      // Create preview URL
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
      // Define categories that should only have one image
      // Portfolio images use different category names than project images
      const UNIQUE_CATEGORIES = ['main', 'thumbnail', 'background'];
      const categoryValue = newImage.category;
      
      // For unique categories, check if an image already exists and delete it
      if (UNIQUE_CATEGORIES.includes(categoryValue)) {
        const existingImage = images.find(img => img.category === categoryValue);
        
        if (existingImage) {
          console.log(`Deleting existing ${categoryValue} image (ID: ${existingImage.id}) before uploading new one`);
          
          try {
            const deleteResponse = await fetch(
              `${SERVER_URL}/api/portfolios/${portfolio.id}/images/${existingImage.id}`,
              {
                method: 'DELETE'
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
      formData.append('category', newImage.category);
      formData.append('alt_text', newImage.alt_text || '');
      
      const response = await fetch(`${SERVER_URL}/api/portfolios/${portfolio.id}/images`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to upload image');
      }
      
      // Reset form and refresh images
      setNewImage({
        file: null,
        category: 'gallery',
        alt_text: ''
      });
      setUploadPreview(null);
      fetchImages();
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
    
    try {
      const response = await fetch(`${SERVER_URL}/api/portfolios/${portfolio.id}/images/${imageId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete image');
      }
      
      // Refresh images
      fetchImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      setApiError('Failed to delete image');
    }
  };

  const handleClose = () => {
    onClose(true);
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        Manage Portfolio Images - {portfolio?.title}
      </DialogTitle>
      <DialogContent>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {apiError}
          </Alert>
        )}
        
        <PermissionGate permission="EDIT_PORTFOLIO">
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Upload New Image
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <Box 
                  sx={{ 
                    border: '1px dashed grey', 
                    height: 200, 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {uploadPreview ? (
                    <Box 
                      component="img" 
                      src={uploadPreview} 
                      sx={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover' 
                      }} 
                    />
                  ) : (
                    <Box sx={{ textAlign: 'center' }}>
                      <input
                        accept="image/*"
                        id="upload-image-button"
                        type="file"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                      />
                      <label htmlFor="upload-image-button">
                        <Button
                          variant="outlined"
                          component="span"
                          startIcon={<UploadIcon />}
                        >
                          Select Image
                        </Button>
                      </label>
                    </Box>
                  )}
                </Box>
                {uploadPreview && (
                  <Box sx={{ mt: 1, textAlign: 'center' }}>
                    <Button 
                      size="small" 
                      color="error" 
                      onClick={() => {
                        setNewImage(prev => ({ ...prev, file: null }));
                        setUploadPreview(null);
                      }}
                    >
                      Remove
                    </Button>
                  </Box>
                )}
              </Grid>
              <Grid item xs={12} md={8}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel id="image-category-label">Image Category</InputLabel>
                    <Select
                      labelId="image-category-label"
                      id="image-category"
                      name="category"
                      value={newImage.category}
                      onChange={handleInputChange}
                      label="Image Category"
                    >
                      {IMAGE_CATEGORIES.map((category) => (
                        <MenuItem key={category.value} value={category.value}>
                          {category.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    label="Alt Text"
                    name="alt_text"
                    value={newImage.alt_text}
                    onChange={handleInputChange}
                    placeholder="Describe the image for accessibility"
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleUploadImage}
                    disabled={isSubmitting || !newImage.file}
                  >
                    {isSubmitting ? 'Uploading...' : 'Upload Image'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </PermissionGate>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom>
          Current Images
        </Typography>
        
        {images.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No images have been uploaded for this portfolio yet.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {images.map((image) => (
              <Grid item xs={12} sm={6} md={4} key={image.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardMedia
                    component="img"
                    height="180"
                    image={`${SERVER_URL}/static/${image.image_path}`}
                    alt={image.alt_text || 'Portfolio image'}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" component="div">
                      {IMAGE_CATEGORIES.find(cat => cat.value === image.category)?.label || image.category}
                    </Typography>
                    {image.alt_text && (
                      <Typography variant="body2" color="text.secondary">
                        {image.alt_text}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions>
                    <PermissionGate permission="EDIT_PORTFOLIO">
                      <IconButton 
                        color="error" 
                        onClick={() => handleDeleteImage(image.id)}
                        aria-label="delete image"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </PermissionGate>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PortfolioImageForm;
