import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton, 
  Paper, 
  Grid, 
  CircularProgress, 
  Divider, 
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Tooltip,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Input,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  TextField,
  Checkbox,
  Toolbar,
  FormControlLabel,
  alpha
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  Add as AddIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Image as ImageIcon,
  Edit as EditIcon,
  SelectAll as SelectAllIcon,
  DeleteSweep as DeleteSweepIcon
} from '@mui/icons-material';
import SERVER_URL from '../common/BackendServerData';
import ModuleGate from '../common/ModuleGate';
import PermissionGate from '../common/PermissionGate';
import ErrorBoundary from '../common/ErrorBoundary';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { api } from '../../services/api';

// Max file size: 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
const MAX_FILES = 10;

function ProjectImagesContent() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isSystemAdmin, permissions, loading: authLoading } = useAuthorization();
  
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState(null);
  const [images, setImages] = useState([]);
  const [project, setProject] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [defaultLanguage, setDefaultLanguage] = useState(null);

  // Debug logging
  useEffect(() => {
    console.log('[PROJECT IMAGES DEBUG] Authentication Status:');
    console.log('  - Auth Loading:', authLoading);
    console.log('  - Permissions:', permissions);
    console.log('  - Is System Admin:', isSystemAdmin());
    console.log('  - Has VIEW_PROJECT_IMAGES:', hasPermission('VIEW_PROJECT_IMAGES'));
    console.log('  - Has UPLOAD_PROJECT_IMAGES:', hasPermission('UPLOAD_PROJECT_IMAGES'));
    console.log('  - Has EDIT_PROJECT_IMAGES:', hasPermission('EDIT_PROJECT_IMAGES'));
    console.log('  - Has DELETE_PROJECT_IMAGES:', hasPermission('DELETE_PROJECT_IMAGES'));
    console.log('  - Has MANAGE_PROJECT_IMAGES:', hasPermission('MANAGE_PROJECT_IMAGES'));
    console.log('  - Has MANAGE_PROJECTS:', hasPermission('MANAGE_PROJECTS'));
    console.log('  - Has SYSTEM_ADMIN:', hasPermission('SYSTEM_ADMIN'));
    console.log('  - Can Access (any of above):', 
      hasPermission('VIEW_PROJECT_IMAGES') || 
      hasPermission('MANAGE_PROJECT_IMAGES') || 
      hasPermission('MANAGE_PROJECTS') || 
      hasPermission('SYSTEM_ADMIN')
    );
  }, [authLoading, permissions, hasPermission, isSystemAdmin]);

  // Permission checking helpers
  const canUploadImages = () => {
    return hasPermission('UPLOAD_PROJECT_IMAGES') || 
           hasPermission('MANAGE_PROJECT_IMAGES') || 
           hasPermission('MANAGE_PROJECTS') || 
           hasPermission('SYSTEM_ADMIN');
  };

  const canEditImages = () => {
    return hasPermission('EDIT_PROJECT_IMAGES') || 
           hasPermission('MANAGE_PROJECT_IMAGES') || 
           hasPermission('MANAGE_PROJECTS') || 
           hasPermission('SYSTEM_ADMIN');
  };

  const canDeleteImages = () => {
    return hasPermission('DELETE_PROJECT_IMAGES') || 
           hasPermission('MANAGE_PROJECT_IMAGES') || 
           hasPermission('MANAGE_PROJECTS') || 
           hasPermission('SYSTEM_ADMIN');
  };
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const dragAreaRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  
  // Edit image state
  const [editImage, setEditImage] = useState({
    id: null,
    category: '',
    file: null,
    previewUrl: null
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  // Bulk selection state
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);

  // Fetch project, images, and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // First, verify authentication by checking current user permissions
        console.log('[PROJECT IMAGES DEBUG] Testing authentication...');
        const authTestResponse = await api.get('/api/users/me/permissions');
        
        console.log('[PROJECT IMAGES DEBUG] Auth test response status:', authTestResponse.status);
        console.log('[PROJECT IMAGES DEBUG] Auth test response data:', authTestResponse.data);
        
        // Fetch languages to identify default language
        console.log('[PROJECT IMAGES DEBUG] Fetching languages...');
        const languagesResponse = await api.get('/api/languages/?page=1&page_size=100');
        
        const languagesData = languagesResponse.data;
        const languages = languagesData.items || [];
        const defaultLang = languages.find(lang => lang.is_default || lang.isDefault) || 
                         (languages.length > 0 ? languages[0] : null);
        setDefaultLanguage(defaultLang);
        
        // Fetch project details
        console.log('[PROJECT IMAGES DEBUG] Fetching project details for ID:', projectId);
        console.log('[PROJECT IMAGES DEBUG] Request URL:', `/api/projects/${projectId}`);
        
        const projectResponse = await api.get(`/api/projects/${projectId}`);
        
        console.log('[PROJECT IMAGES DEBUG] Project response status:', projectResponse.status);
        console.log('[PROJECT IMAGES DEBUG] Project response data:', projectResponse.data);
        
        setProject(projectResponse.data);
        
        // Fetch project images
        const imagesResponse = await api.get(`/api/projects/${projectId}/images`);
        const imagesData = imagesResponse.data;
        setImages(imagesData);
        
        // Fetch PROI categories using the new endpoint
        const categoriesResponse = await api.get('/api/categories/by-code-pattern/PROI');
        const categoriesData = categoriesResponse.data;
        let categoriesList = categoriesData || [];
        
        console.log("PROI categories from API:", categoriesList);
        
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
        
        console.log("Formatted categories for select:", formattedCategories);
        
        setCategories(formattedCategories);
        
        // Set default category if available
        if (formattedCategories.length > 0) {
          setSelectedCategory(formattedCategories[0].code);
        }
        
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Cleanup function to revoke object URLs
    return () => {
      selectedFiles.forEach(fileObj => {
        if (fileObj.preview) {
          URL.revokeObjectURL(fileObj.preview);
        }
      });
      // Cleanup edit preview URL
      if (editImage.previewUrl) {
        URL.revokeObjectURL(editImage.previewUrl);
      }
    };
  }, [projectId]);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop event
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  // Handle file input change
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  // Process selected files
  const handleFiles = (files) => {
    // Only accept up to MAX_FILES
    const filesToProcess = files.slice(0, MAX_FILES - selectedFiles.length);
    
    if (filesToProcess.length === 0) {
      return;
    }
    
    // Check each file for errors (type, size)
    const validFiles = [];
    const errors = [];
    
    filesToProcess.forEach(file => {
      // Check file type
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Accepted types: ${ACCEPTED_IMAGE_TYPES.join(', ')}`);
        return;
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size: 2MB`);
        return;
      }
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      
      validFiles.push({
        file,
        name: file.name,
        size: file.size,
        preview: previewUrl,
        nameEdited: false
      });
    });
    
    if (validFiles.length > 0) {
      // Add valid files to selected files
      setSelectedFiles(prev => [...prev, ...validFiles].slice(0, MAX_FILES));
    }
    
    // Set error message if any
    if (errors.length > 0) {
      setUploadError(errors.join('\n'));
    } else {
      setUploadError(null);
    }
  };

  // Remove file from selected files
  const removeFile = (index) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      // Release object URL to prevent memory leaks
      if (newFiles[index]?.preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      return newFiles.filter((_, i) => i !== index);
    });
  };

  // Handle filename change
  const handleFilenameChange = (index, newName) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = {
        ...newFiles[index],
        name: newName,
        nameEdited: true
      };
      return newFiles;
    });
  };

  // Handle edit image click
  const handleEditClick = (image) => {
    setSelectedImage(image);
    setEditImage({
      id: image.id,
      category: image.category_code || image.category,
      file: null,
      previewUrl: null
    });
    setEditError(null);
    setIsEditDialogOpen(true);
  };

  // Handle edit image file change
  const handleEditFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file type
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setEditError(`Invalid file type. Accepted types: ${ACCEPTED_IMAGE_TYPES.join(', ')}`);
        return;
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        setEditError(`File too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size: 2MB`);
        return;
      }
      
      // Clean previous preview URL
      if (editImage.previewUrl) {
        URL.revokeObjectURL(editImage.previewUrl);
      }
      
      // Create new preview URL
      const previewUrl = URL.createObjectURL(file);
      
      setEditImage(prev => ({
        ...prev,
        file,
        previewUrl
      }));
      setEditError(null);
    }
  };

  // Handle edit category change
  const handleEditCategoryChange = (e) => {
    setEditImage(prev => ({
      ...prev,
      category: e.target.value
    }));
  };

  // Update image
  const updateImage = async () => {
    if (!editImage.id) return;
    
    // Check if anything has changed
    const originalImage = selectedImage;
    const categoryChanged = editImage.category !== (originalImage.category_code || originalImage.category);
    const fileChanged = editImage.file !== null;
    
    if (!categoryChanged && !fileChanged) {
      setEditError('No changes detected. Please modify the category or select a new image.');
      return;
    }
    
    try {
      setEditLoading(true);
      setEditError(null);
      
      const formData = new FormData();
      
      // Add category if changed
      if (categoryChanged) {
        formData.append('category', editImage.category);
      }
      
      // Add file if changed
      if (fileChanged) {
        formData.append('image', editImage.file);
      }
      
      const response = await api.put(`/api/projects/${projectId}/images/${editImage.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const updatedImage = response.data;
      
      // Update the images list
      setImages(prevImages => 
        prevImages.map(img => 
          img.id === editImage.id ? updatedImage : img
        )
      );
      
      // Close the dialog
      setIsEditDialogOpen(false);
      setSelectedImage(null);
      setEditImage({
        id: null,
        category: '',
        file: null,
        previewUrl: null
      });
      
      // Reset the file input
      if (editFileInputRef.current) {
        editFileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error updating image:', error);
      setEditError(error.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Upload multiple images
  const uploadImages = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one file');
      return;
    }
    
    if (!selectedCategory) {
      setUploadError('Please select a category');
      return;
    }
    
    try {
      setUploadLoading(true);
      setUploadError(null);
      setUploadProgress({});
      
      // Upload each file in sequence
      for (let i = 0; i < selectedFiles.length; i++) {
        const fileObj = selectedFiles[i];
        const file = fileObj.file;
        const formData = new FormData();
        formData.append('file', file);  // Use 'file' as the field name expected by the backend
        formData.append('category_code', selectedCategory);  // Use 'category_code' as expected by the backend
        
        // Update progress
        setUploadProgress(prev => ({
          ...prev,
          [i]: {
            status: 'uploading',
            progress: 0
          }
        }));
        
        try {
          const response = await api.post(`/api/projects/${projectId}/images`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          
          const newImage = response.data;
          
          // Add the new image to the list
          setImages(prev => [...prev, newImage]);
          
          // Update progress
          setUploadProgress(prev => ({
            ...prev,
            [i]: {
              status: 'success',
              progress: 100
            }
          }));
        } catch (uploadError) {
          // Check if error is due to filename conflict
          if (uploadError.response?.data?.detail && uploadError.response.data.detail.includes('already exists')) {
            setUploadProgress(prev => ({
              ...prev,
              [i]: {
                status: 'conflict',
                progress: 0,
                message: uploadError.response.data.detail
              }
            }));
            continue; // Skip to next file
          }
          
          // Update progress for other errors
          setUploadProgress(prev => ({
            ...prev,
            [i]: {
              status: 'error',
              progress: 0,
              message: uploadError.message || 'Upload failed'
            }
          }));
        }
      }
      
      // Check if all uploads succeeded
      const allSucceeded = Object.values(uploadProgress).every(p => p.status === 'success');
      const hasConflicts = Object.values(uploadProgress).some(p => p.status === 'conflict');
      
      if (allSucceeded && !hasConflicts) {
        // If all uploads succeeded and no conflicts, close dialog
        setTimeout(() => {
          // Release all object URLs
          selectedFiles.forEach(fileObj => {
            if (fileObj.preview) {
              URL.revokeObjectURL(fileObj.preview);
            }
          });
          // Reset state and close the upload dialog
          setSelectedFiles([]);
          setIsUploadDialogOpen(false);
        }, 1000);
      }
      
    } catch (error) {
      console.error('Error uploading images:', error);
      setUploadError(error.message);
    } finally {
      setUploadLoading(false);
    }
  };

  // Delete image function
  const deleteImage = async () => {
    if (!selectedImage) return;
    
    try {
      setLoading(true);
      
      await api.delete(`/api/projects/${projectId}/images/${selectedImage.id}`);
      
      // Remove the deleted image from the list
      setImages(prevImages => prevImages.filter(img => img.id !== selectedImage.id));
      
      // Close the dialog
      setIsDeleteDialogOpen(false);
      setSelectedImage(null);
    } catch (error) {
      console.error('Error deleting image:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle image delete click
  const handleDeleteClick = (image) => {
    setSelectedImage(image);
    setIsDeleteDialogOpen(true);
  };

  // Bulk selection functions
  const handleImageSelect = (imageId) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedImages.size === images.length) {
      // Deselect all
      setSelectedImages(new Set());
    } else {
      // Select all
      setSelectedImages(new Set(images.map(img => img.id)));
    }
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedImages(new Set()); // Clear selections when toggling mode
  };

  const handleBulkDeleteClick = () => {
    if (selectedImages.size === 0) return;
    setIsBulkDeleteDialogOpen(true);
  };

  // Bulk delete function
  const bulkDeleteImages = async () => {
    if (selectedImages.size === 0) return;
    
    try {
      setBulkDeleteLoading(true);
      
      const imageIds = Array.from(selectedImages);
      const deletePromises = imageIds.map(imageId => 
        api.delete(`/api/projects/${projectId}/images/${imageId}`)
      );
      
      // Wait for all deletions to complete
      const results = await Promise.allSettled(deletePromises);
      
      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected');
      
      if (failures.length > 0) {
        console.warn(`${failures.length} out of ${imageIds.length} deletions failed`);
        setError(`Some images could not be deleted (${failures.length}/${imageIds.length} failed)`);
      }
      
      // Remove successfully deleted images from the list
      const successfulDeletions = results
        .map((result, index) => ({ result, imageId: imageIds[index] }))
        .filter(({ result }) => result.status === 'fulfilled')
        .map(({ imageId }) => imageId);
      
      setImages(prevImages => 
        prevImages.filter(img => !successfulDeletions.includes(img.id))
      );
      
      // Clear selections and close dialog
      setSelectedImages(new Set());
      setIsBulkDeleteDialogOpen(false);
      setSelectionMode(false);
      
      if (failures.length === 0) {
        // All deletions successful
        console.log(`Successfully deleted ${successfulDeletions.length} images`);
      }
    } catch (error) {
      console.error('Error during bulk delete:', error);
      setError('Failed to delete images: ' + error.message);
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Get category label
  const getCategoryLabel = (categoryCode) => {
    const category = categories.find(cat => cat.code === categoryCode);
    return category ? category.name : formatCategoryName(categoryCode);
  };

  // Format category name from code
  const formatCategoryName = (code) => {
    if (!code) return '';
    
    // Trim any spaces
    const trimmed = code.trim();
    
    // Extract the part after the dash if it exists
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length > 1) {
        // Convert "GALLERY" to "Gallery"
        return parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
      }
    }
    
    return trimmed;
  };

  // Extract filename from path
  const getFilename = (path) => {
    if (!path) return '';
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  return (
    <Box sx={{ pt: 3, pr: 3, pb: 3, pl: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton 
          onClick={() => navigate('/projects')} 
          sx={{ mr: 2 }}
          aria-label="Back to projects"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography 
          variant="h5" 
          sx={{ fontWeight: 600, color: '#1976d2', mb: 1, letterSpacing: '0.015em' }}
        >
          Project Images
          {project && project.project_texts && project.project_texts[0] && (
            <Typography 
              component="span" 
              variant="h5"
              sx={{ 
                fontWeight: 600, 
                color: '#1976d2',
                letterSpacing: '0.015em',
                ml: 1
              }}
            >
              - {project.project_texts[0].name}
            </Typography>
          )}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {images.length > 0 && (
          <Button 
            variant="outlined"
            color="primary"
            startIcon={<SelectAllIcon />} 
            onClick={handleToggleSelectionMode}
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
            {selectionMode ? 'Exit Selection' : 'Select Images'}
          </Button>
        )}
        {canUploadImages() && (
          <Button 
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />} 
            onClick={() => setIsUploadDialogOpen(true)}
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
            Add Images
          </Button>
        )}
      </Box>
      
      {/* Bulk Actions Toolbar */}
      {selectionMode && images.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <Toolbar sx={{ 
            justifyContent: 'space-between',
            bgcolor: selectedImages.size > 0 ? 'action.selected' : 'background.paper',
            transition: 'background-color 0.3s ease'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedImages.size === images.length && images.length > 0}
                    indeterminate={selectedImages.size > 0 && selectedImages.size < images.length}
                    onChange={handleSelectAll}
                  />
                }
                label={
                  selectedImages.size === 0 
                    ? "Select All" 
                    : `${selectedImages.size} of ${images.length} selected`
                }
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {selectedImages.size > 0 && canDeleteImages() && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteSweepIcon />}
                  onClick={handleBulkDeleteClick}
                  disabled={bulkDeleteLoading}
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
                  Delete Selected ({selectedImages.size})
                </Button>
              )}
            </Box>
          </Toolbar>
        </Paper>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : images.length === 0 ? (
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              p: 5, 
              textAlign: 'center' 
            }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No images found
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {images.map((image) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={image.id}>
                <Card sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  position: 'relative',
                  border: selectionMode && selectedImages.has(image.id) ? '2px solid' : '1px solid',
                  borderColor: selectionMode && selectedImages.has(image.id) ? 'primary.main' : 'divider',
                  '&:hover': {
                    transform: selectionMode ? 'none' : 'scale(1.02)',
                    boxShadow: selectionMode ? 'none' : 3,
                  }
                }}>
                  <Box sx={{ position: 'relative' }}>
                    <CardMedia
                      component="img"
                      image={`${SERVER_URL}${image.image_url}`}
                      alt="Project image"
                      sx={{ 
                        height: { xs: 180, sm: 200, md: 220 },
                        objectFit: 'contain',
                        backgroundColor: 'background.paper',
                        cursor: selectionMode ? 'pointer' : 'default'
                      }}
                      onClick={selectionMode ? () => handleImageSelect(image.id) : undefined}
                    />
                    {selectionMode && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          zIndex: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          borderRadius: '50%',
                          padding: 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Checkbox
                          checked={selectedImages.has(image.id)}
                          onChange={() => handleImageSelect(image.id)}
                          size="small"
                          sx={{ padding: 0 }}
                        />
                      </Box>
                    )}
                  </Box>
                  <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                    <Chip
                      label={getCategoryLabel(image.category_code || image.category)}
                      color="primary"
                      variant="outlined"
                      size="small"
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                      {getFilename(image.image_path)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {image.id}
                    </Typography>
                  </CardContent>
                  {!selectionMode && (
                    <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
                      {canEditImages() && (
                        <Tooltip title="Edit Image">
                          <IconButton 
                            size="small" 
                            color="primary" 
                            onClick={() => handleEditClick(image)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDeleteImages() && (
                        <Tooltip title="Delete Image">
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => handleDeleteClick(image)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </CardActions>
                  )}
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: 24
          }
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 600, 
          fontSize: '1.25rem',
          pb: 1,
          color: '#e53935'
        }}>
          Delete Image
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <DialogContentText sx={{ 
            fontSize: '1rem',
            color: '#e53935',
            mb: 2
          }}>
            Are you sure you want to delete this image? This action cannot be undone.
          </DialogContentText>
          {selectedImage && (
            <Box sx={{ 
              mt: 2, 
              textAlign: 'center',
              p: 2,
              backgroundColor: alpha('#ffebee', 0.3),
              borderRadius: 2,
              border: '1px solid',
              borderColor: '#ffcdd2'
            }}>
              <img 
                src={`${SERVER_URL}${selectedImage.image_url}`} 
                alt="Preview" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '200px', 
                  objectFit: 'contain',
                  borderRadius: '8px'
                }} 
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            onClick={() => setIsDeleteDialogOpen(false)}
            variant="outlined"
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              borderRadius: 2,
              px: 3
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={deleteImage} 
            color="error" 
            variant="outlined"
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
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={isBulkDeleteDialogOpen}
        onClose={() => !bulkDeleteLoading && setIsBulkDeleteDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: 24
          }
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 600, 
          fontSize: '1.25rem',
          pb: 1,
          color: '#e53935'
        }}>
          Delete Multiple Images
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <DialogContentText sx={{ 
            fontSize: '1rem',
            color: '#e53935',
            mb: 2
          }}>
            Are you sure you want to delete {selectedImages.size} selected image{selectedImages.size > 1 ? 's' : ''}? 
            This action cannot be undone.
          </DialogContentText>
          {selectedImages.size > 0 && (
            <Box sx={{ 
              mt: 2,
              p: 2,
              backgroundColor: alpha('#ffebee', 0.3),
              borderRadius: 2,
              border: '1px solid',
              borderColor: '#ffcdd2'
            }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Images to be deleted:
              </Typography>
              <Box sx={{ 
                maxHeight: '200px', 
                overflow: 'auto',
                borderRadius: 2,
                p: 1
              }}>
                <Grid container spacing={1}>
                  {images
                    .filter(img => selectedImages.has(img.id))
                    .map((image) => (
                      <Grid item xs={4} key={image.id}>
                        <Box sx={{ textAlign: 'center' }}>
                          <img 
                            src={`${SERVER_URL}${image.image_url}`} 
                            alt="To delete" 
                            style={{ 
                              width: '60px', 
                              height: '60px', 
                              objectFit: 'cover',
                              border: '2px solid #f44336',
                              borderRadius: '8px'
                            }} 
                          />
                          <Typography variant="caption" display="block" sx={{ 
                            mt: 0.5,
                            fontWeight: 500
                          }}>
                            {getCategoryLabel(image.category_code || image.category)}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            onClick={() => setIsBulkDeleteDialogOpen(false)}
            disabled={bulkDeleteLoading}
            variant="outlined"
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              borderRadius: 2,
              px: 3
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={bulkDeleteImages} 
            color="error" 
            variant="outlined"
            disabled={bulkDeleteLoading}
            startIcon={bulkDeleteLoading ? <CircularProgress size={20} /> : <DeleteSweepIcon />}
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
            {bulkDeleteLoading ? 'Deleting...' : `Delete ${selectedImages.size} Image${selectedImages.size > 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Edit Image Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onClose={() => {
          if (!editLoading) {
            setIsEditDialogOpen(false);
            setEditError(null);
            setEditImage({
              id: null,
              category: '',
              file: null,
              previewUrl: null
            });
            if (editFileInputRef.current) {
              editFileInputRef.current.value = '';
            }
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Edit Image
        </DialogTitle>
        <DialogContent>
          {editError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editError}
            </Alert>
          )}
          
          <Grid container spacing={3}>
            {/* Current Image Preview */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Current Image</Typography>
              <Box sx={{ 
                height: '250px', 
                border: '1px solid #eee',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {selectedImage && (
                  <img 
                    src={`${SERVER_URL}${selectedImage.image_url}`} 
                    alt="Current" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '100%', 
                      objectFit: 'contain'
                    }} 
                  />
                )}
              </Box>
            </Grid>
            
            {/* New Image Preview / Upload */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                New Image (Optional)
              </Typography>
              <Box 
                sx={{ 
                  height: '250px',
                  border: '2px dashed #ccc',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  '&:hover': {
                    borderColor: 'primary.main'
                  }
                }}
                onClick={() => editFileInputRef.current?.click()}
              >
                {editImage.previewUrl ? (
                  <img 
                    src={editImage.previewUrl} 
                    alt="New preview" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '100%', 
                      objectFit: 'contain'
                    }} 
                  />
                ) : (
                  <Box sx={{ textAlign: 'center' }}>
                    <CloudUploadIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Click to select new image
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      (Optional - leave empty to keep current image)
                    </Typography>
                  </Box>
                )}
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  onChange={handleEditFileChange}
                  style={{ display: 'none' }}
                  disabled={editLoading}
                />
              </Box>
            </Grid>
            
            {/* Category Selection */}
            <Grid item xs={12}>
              <FormControl 
                fullWidth 
                variant="outlined"
                sx={{ mt: 2 }}
              >
                <InputLabel id="edit-category-select-label">
                  Image Category
                </InputLabel>
                <Select
                  labelId="edit-category-select-label"
                  id="edit-category-select"
                  value={editImage.category}
                  onChange={handleEditCategoryChange}
                  label="Image Category"
                  disabled={editLoading}
                >
                  {categories.length === 0 ? (
                    <MenuItem disabled value="">
                      <em>No categories available</em>
                    </MenuItem>
                  ) : (
                    categories.map((category) => (
                      <MenuItem 
                        key={category.code} 
                        value={category.code}
                      >
                        {category.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #f0f0f0' }}>
          <Button 
            onClick={() => setIsEditDialogOpen(false)}
            disabled={editLoading}
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
            onClick={updateImage}
            variant="outlined"
            disabled={editLoading || categories.length === 0}
            startIcon={editLoading ? <CircularProgress size={16} /> : <EditIcon fontSize="small" />}
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
            {editLoading ? 'Processing...' : 'Update Image'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Upload Dialog */}
      <Dialog
        open={isUploadDialogOpen}
        onClose={() => {
          if (!uploadLoading) {
            setIsUploadDialogOpen(false);
            setUploadError(null);
            setSelectedFiles([]);
          }
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { maxHeight: '90vh' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" component="div" sx={{ color: '#1976d2' }}>
                Upload Images
              </Typography>
            </Box>
            <IconButton 
              edge="end" 
              color="inherit" 
              onClick={() => setIsUploadDialogOpen(false)} 
              disabled={uploadLoading}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadError}
            </Alert>
          )}
          
          <FormControl 
            fullWidth 
            variant="outlined"
            sx={{ 
              mb: 3,
              mt: 1,
              '& .MuiInputLabel-root': {
                backgroundColor: 'rgba(255, 255, 255, 0.97)',
                px: 0.5,
                '&.Mui-focused': {
                  color: 'primary.main'
                }
              }
            }}
          >
            <InputLabel 
              id="category-select-label"
              shrink={true}
            >
              Project Image Category
            </InputLabel>
            <Select
              labelId="category-select-label"
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              label="Project Image Category"
              disabled={uploadLoading}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 300,
                    width: 'auto',
                    minWidth: '300px'
                  },
                },
                anchorOrigin: {
                  vertical: 'bottom',
                  horizontal: 'left',
                },
                transformOrigin: {
                  vertical: 'top',
                  horizontal: 'left',
                }
              }}
              sx={{
                '& .MuiSelect-select': {
                  whiteSpace: 'normal',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  paddingY: 1.2,
                  paddingRight: 4,
                  minHeight: 48,
                  lineHeight: 1.3,
                  display: 'flex',
                  alignItems: 'center'
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 0, 0, 0.23)'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 0, 0, 0.87)'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: 2
                }
              }}
              renderValue={(selected) => {
                const category = categories.find(cat => cat.code === selected);
                if (!category) return selected;
                
                return (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    width: '100%',
                    py: 0.25
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {category.name}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      color="text.secondary"
                      sx={{
                        display: 'inline-block',
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        borderRadius: '4px',
                        px: 1,
                        py: 0.25,
                        mt: 0.25,
                        fontFamily: 'monospace',
                        fontSize: '0.7rem',
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {category.displayCode}
                    </Typography>
                  </Box>
                );
              }}
            >
              {categories.length === 0 ? (
                <MenuItem disabled value="">
                  <em>No categories available</em>
                </MenuItem>
              ) : (
                categories.map((category) => (
                  <MenuItem 
                    key={category.code} 
                    value={category.code}
                    sx={{ 
                      whiteSpace: 'normal',
                      paddingY: 1.5,
                      paddingX: 2,
                      lineHeight: 1.3,
                      minHeight: '60px',
                      borderBottom: '1px solid rgba(0,0,0,0.08)',
                      '&:last-child': {
                        borderBottom: 'none'
                      },
                      '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.04)'
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(25, 118, 210, 0.08)'
                      },
                      '&.Mui-selected:hover': {
                        backgroundColor: 'rgba(25, 118, 210, 0.12)'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontWeight: 'medium',
                          mb: 0.5
                        }}
                      >
                        {category.name}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{
                          display: 'inline-block',
                          backgroundColor: 'rgba(0, 0, 0, 0.04)',
                          borderRadius: '4px',
                          px: 1,
                          py: 0.5,
                          fontFamily: 'monospace',
                          maxWidth: 'fit-content',
                          border: '1px solid rgba(0, 0, 0, 0.08)'
                        }}
                      >
                        {category.displayCode}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
            {categories.length === 0 && (
              <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                No PROI categories found. Please check category configuration.
              </Typography>
            )}
          </FormControl>
          
          {/* Drag and drop area */}
          <Box 
            ref={dragAreaRef}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => selectedFiles.length < MAX_FILES && fileInputRef.current.click()}
            sx={{ 
              border: '2px dashed',
              borderColor: selectedFiles.length >= MAX_FILES 
                ? 'error.main' 
                : dragActive 
                  ? 'primary.main' 
                  : '#ccc',
              borderRadius: 2, 
              p: 4,
              backgroundColor: selectedFiles.length >= MAX_FILES 
                ? 'rgba(244, 67, 54, 0.04)'
                : dragActive 
                  ? 'rgba(25, 118, 210, 0.04)' 
                  : 'background.paper',
              textAlign: 'center',
              cursor: selectedFiles.length >= MAX_FILES ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              mt: 1,
              opacity: selectedFiles.length >= MAX_FILES ? 0.6 : 1
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
              disabled={uploadLoading || selectedFiles.length >= MAX_FILES}
            />
            
            <CloudUploadIcon 
              color={selectedFiles.length >= MAX_FILES ? "error" : "primary"} 
              sx={{ fontSize: 48, mb: 2 }} 
            />
            
            <Typography variant="h6" gutterBottom>
              {selectedFiles.length >= MAX_FILES 
                ? 'Maximum files reached' 
                : dragActive 
                  ? 'Drop files here' 
                  : 'Drag & drop images here'
              }
            </Typography>
            
            {selectedFiles.length < MAX_FILES ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  or click to select files
                </Typography>
                <Box sx={{ mt: 2, mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip 
                      size="small" 
                      label={`${selectedFiles.length}/${MAX_FILES} selected`}
                      color={selectedFiles.length > 0 ? "primary" : "default"}
                      variant="outlined"
                    />
                    {selectedFiles.length > 0 && (
                      <Typography variant="caption" color="success.main">
                        {MAX_FILES - selectedFiles.length} slots remaining
                      </Typography>
                    )}
                  </Box>
                </Box>
              </>
            ) : (
              <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                Remove some files to add more
              </Typography>
            )}
            
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Supported: JPG, PNG, GIF, SVG, WebP • Max size: 2MB per file
            </Typography>
          </Box>
          
          {/* Selected files list with better layout */}
          {selectedFiles.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2">
                  Selected Files
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip 
                    size="small" 
                    label={`${selectedFiles.length}/${MAX_FILES}`}
                    color={selectedFiles.length >= MAX_FILES ? "error" : "primary"}
                    variant="filled"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {((selectedFiles.reduce((acc, file) => acc + file.size, 0)) / (1024 * 1024)).toFixed(1)}MB total
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ 
                maxHeight: '400px', 
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper'
              }}>
                                  {selectedFiles.map((fileObj, index) => (
                    <Box 
                      key={`${fileObj.name}-${index}`}
                      sx={{ 
                        p: 2,
                        borderBottom: index < selectedFiles.length - 1 ? '1px solid' : 'none',
                        borderColor: 'divider',
                        '&:hover': {
                          bgcolor: 'action.hover'
                        }
                      }}
                    >
                      <Grid container spacing={2} alignItems="center">
                      {/* Image preview */}
                      <Grid item xs={3} sm={2}>
                        <Box sx={{ 
                          height: '80px', 
                          width: '80px',
                          bgcolor: '#f5f5f5',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          overflow: 'hidden'
                        }}>
                          <img 
                            src={fileObj.preview} 
                            alt={`Preview of ${fileObj.name}`}
                            style={{ 
                              maxHeight: '100%', 
                              maxWidth: '100%', 
                              objectFit: 'cover'
                            }}
                          />
                        </Box>
                      </Grid>
                      
                      {/* File info */}
                      <Grid item xs={7} sm={8}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ mr: 1 }}>
                            {uploadProgress[index]?.status === 'success' ? (
                              <CheckCircleIcon color="success" fontSize="small" />
                            ) : uploadProgress[index]?.status === 'error' ? (
                              <ErrorIcon color="error" fontSize="small" />
                            ) : uploadProgress[index]?.status === 'conflict' ? (
                              <ErrorIcon color="warning" fontSize="small" />
                            ) : (
                              <ImageIcon color="action" fontSize="small" />
                            )}
                          </Box>
                          
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            {uploadProgress[index]?.status === 'conflict' ? (
                              <>
                                <Typography variant="body2" color="warning.main" sx={{ fontWeight: 'medium' }}>
                                  Filename conflict
                                </Typography>
                                <TextField
                                  size="small"
                                  fullWidth
                                  defaultValue={fileObj.name}
                                  onChange={(e) => handleFilenameChange(index, e.target.value)}
                                  sx={{ mt: 0.5 }}
                                />
                              </>
                            ) : (
                              <>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    fontWeight: 'medium',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {fileObj.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {(fileObj.size / 1024).toFixed(1)} KB
                                </Typography>
                              </>
                            )}
                            
                            {uploadProgress[index]?.status === 'uploading' && (
                              <LinearProgress size="small" sx={{ mt: 0.5 }} />
                            )}
                            
                            {uploadProgress[index]?.status === 'error' && (
                              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                {uploadProgress[index].message}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Grid>
                      
                      {/* Actions */}
                      <Grid item xs={2}>
                        {!uploadLoading && (
                          <IconButton 
                            color="error" 
                            size="small"
                            onClick={() => removeFile(index)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Grid>
                    </Grid>
                    </Box>
                  ))}
              </Box>
            </Box>
          )}
          
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              variant="outlined"
              color="primary" 
              onClick={uploadImages}
              disabled={uploadLoading || selectedFiles.length === 0 || !selectedCategory}
              startIcon={uploadLoading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
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
              {uploadLoading ? 'Uploading...' : 'Upload Images'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// Main component with proper authorization protection
function ProjectImages() {
  const { loading: authLoading } = useAuthorization();
  
  // Wait for authentication to load before showing the component
  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <ModuleGate moduleName="projects" showError={true}>
      <PermissionGate 
        permissions={["VIEW_PROJECT_IMAGES", "MANAGE_PROJECT_IMAGES", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]} 
        requireAll={false}
        showError={true}
      >
        <ErrorBoundary>
          <ProjectImagesContent />
        </ErrorBoundary>
      </PermissionGate>
    </ModuleGate>
  );
}

export default ProjectImages; 