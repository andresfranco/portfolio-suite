import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  Paper,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Grid,
  TextField,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CardActions
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  PhotoLibrary as PhotoLibraryIcon,
  AttachFile as AttachFileIcon,
  Work as WorkIcon,
  Category as CategoryIcon,
  Assignment as ProjectIcon,
  ViewModule as SectionIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  SelectAll as SelectAllIcon,
  Clear as ClearIcon,
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Language as LanguageIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { api, projectsApi } from '../../services/api';
import { useSnackbar } from 'notistack';
import SERVER_URL from '../common/BackendServerData';

// Tab Panel Component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`portfolio-tabpanel-${index}`}
      aria-labelledby={`portfolio-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function PortfolioData({ open, onClose, portfolioId, portfolioName }) {
  const { enqueueSnackbar } = useSnackbar();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Portfolio data states
  const [portfolioData, setPortfolioData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [images, setImages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  
  // Available options states
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableExperiences, setAvailableExperiences] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);

  // Upload dialog states
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [attachmentUploadOpen, setAttachmentUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [imageCategory, setImageCategory] = useState('gallery');
  const [uploadLoading, setUploadLoading] = useState(false);

  // Section modal states
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);

  // Image rename states
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [newImageName, setNewImageName] = useState('');

  // Image preview states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Delete confirmation states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'image' or 'attachment'
  const [deleting, setDeleting] = useState(false);

  // Fetch portfolio data
  const fetchPortfolioData = useCallback(async () => {
    if (!portfolioId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch portfolio details with all related data
      const response = await api.get(`/api/portfolios/${portfolioId}`);
      const portfolio = response.data;
      
      setPortfolioData(portfolio);
      setCategories(portfolio.categories || []);
      setExperiences(portfolio.experiences || []);
      setProjects(portfolio.projects || []);
      setSections(portfolio.sections || []);
      setImages(portfolio.images || []);
      setAttachments(portfolio.attachments || []);
      
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to fetch portfolio data';
      setError(errorMessage);
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [portfolioId, enqueueSnackbar]);

  // Fetch available options for dropdowns
  const fetchAvailableOptions = useCallback(async () => {
    try {
      const [categoriesRes, experiencesRes, projectsRes, sectionsRes] = await Promise.all([
        api.get('/api/categories/by-type/PORT'),
        api.get('/api/experiences/'),
        api.get('/api/projects/'),
        api.get('/api/sections/')
      ]);
      
      // Categories by-type endpoint returns array directly
      setAvailableCategories(categoriesRes.data || []);
      setAvailableExperiences(experiencesRes.data.items || experiencesRes.data || []);
      setAvailableProjects(projectsRes.data.items || projectsRes.data || []);
      setAvailableSections(sectionsRes.data.items || sectionsRes.data || []);
      
    } catch (err) {
      console.error('Error fetching available options:', err);
    }
  }, []);

  // Initialize data on open
  useEffect(() => {
    if (open && portfolioId) {
      fetchPortfolioData();
      fetchAvailableOptions();
    }
  }, [open, portfolioId, fetchPortfolioData, fetchAvailableOptions]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Close handler
  const handleClose = () => {
    setTabValue(0);
    setError(null);
    onClose();
  };

  // Add/Remove category handlers
  const handleAddCategory = async (categoryId) => {
    try {
      await api.post(`/api/portfolios/${portfolioId}/categories/${categoryId}`);
      await fetchPortfolioData();
      enqueueSnackbar('Category added successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to add category', { variant: 'error' });
    }
  };

  const handleRemoveCategory = async (categoryId) => {
    try {
      await api.delete(`/api/portfolios/${portfolioId}/categories/${categoryId}`);
      await fetchPortfolioData();
      enqueueSnackbar('Category removed successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to remove category', { variant: 'error' });
    }
  };

  // Add/Remove experience handlers
  const handleAddExperience = async (experienceId) => {
    try {
      await api.post(`/api/portfolios/${portfolioId}/experiences/${experienceId}`);
      await fetchPortfolioData();
      enqueueSnackbar('Experience added successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to add experience', { variant: 'error' });
    }
  };

  const handleRemoveExperience = async (experienceId) => {
    try {
      await api.delete(`/api/portfolios/${portfolioId}/experiences/${experienceId}`);
      await fetchPortfolioData();
      enqueueSnackbar('Experience removed successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to remove experience', { variant: 'error' });
    }
  };

  // Add/Remove project handlers
  const handleAddProject = async (projectId) => {
    try {
      await api.post(`/api/portfolios/${portfolioId}/projects/${projectId}`);
      await fetchPortfolioData();
      enqueueSnackbar('Project added successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to add project', { variant: 'error' });
    }
  };

  const handleRemoveProject = async (projectId) => {
    try {
      await api.delete(`/api/portfolios/${portfolioId}/projects/${projectId}`);
      await fetchPortfolioData();
      enqueueSnackbar('Project removed successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to remove project', { variant: 'error' });
    }
  };

  // Add/Remove section handlers
  const handleAddSection = async (sectionId) => {
    try {
      await api.post(`/api/portfolios/${portfolioId}/sections/${sectionId}`);
      await fetchPortfolioData();
      enqueueSnackbar('Section added successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to add section', { variant: 'error' });
    }
  };

  const handleRemoveSection = async (sectionId) => {
    try {
      await api.delete(`/api/portfolios/${portfolioId}/sections/${sectionId}`);
      await fetchPortfolioData();
      enqueueSnackbar('Section removed successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to remove section', { variant: 'error' });
    }
  };

  // Image upload/delete handlers
  const handleImageUpload = async () => {
    if (!uploadFile) {
      enqueueSnackbar('Please select a file', { variant: 'error' });
      return;
    }

    try {
      setUploadLoading(true);
      await projectsApi.uploadPortfolioImage(portfolioId, uploadFile, imageCategory);
      await fetchPortfolioData();
      enqueueSnackbar('Image uploaded successfully', { variant: 'success' });
      setImageUploadOpen(false);
      setUploadFile(null);
      setImageCategory('gallery');
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to upload image';
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleImageDelete = (image) => {
    setItemToDelete(image);
    setDeleteType('image');
    setDeleteDialogOpen(true);
  };

  const handleImageRename = (image) => {
    setSelectedImage(image);
    setNewImageName(image.file_name);
    setRenameDialogOpen(true);
  };

  const handleImageRenameConfirm = async () => {
    if (!selectedImage || !newImageName.trim()) {
      enqueueSnackbar('Please enter a valid filename', { variant: 'error' });
      return;
    }

    try {
      await projectsApi.renamePortfolioImage(portfolioId, selectedImage.id, {
        file_name: newImageName.trim()
      });
      await fetchPortfolioData();
      enqueueSnackbar('Image renamed successfully', { variant: 'success' });
      setRenameDialogOpen(false);
      setSelectedImage(null);
      setNewImageName('');
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to rename image';
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
    }
  };

  const handleImageRenameCancel = () => {
    setRenameDialogOpen(false);
    setSelectedImage(null);
    setNewImageName('');
  };

  const handleImagePreview = (image) => {
    setPreviewImage(image);
    setPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    setPreviewOpen(false);
    setPreviewImage(null);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      setDeleting(true);
      
      if (deleteType === 'image') {
        await projectsApi.deletePortfolioImage(portfolioId, itemToDelete.id);
        enqueueSnackbar('Image deleted successfully', { variant: 'success' });
      } else if (deleteType === 'attachment') {
        await projectsApi.deletePortfolioAttachment(portfolioId, itemToDelete.id);
        enqueueSnackbar('Attachment deleted successfully', { variant: 'success' });
      }
      
      await fetchPortfolioData();
      handleDeleteCancel();
    } catch (err) {
      const errorMessage = err.response?.data?.detail || `Failed to delete ${deleteType}`;
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
    setDeleteType(null);
    setDeleting(false);
  };

  // Attachment upload/delete handlers
  const handleAttachmentUpload = async () => {
    if (!uploadFile) {
      enqueueSnackbar('Please select a file', { variant: 'error' });
      return;
    }

    try {
      setUploadLoading(true);
      await projectsApi.uploadPortfolioAttachment(portfolioId, uploadFile);
      await fetchPortfolioData();
      enqueueSnackbar('Attachment uploaded successfully', { variant: 'success' });
      setAttachmentUploadOpen(false);
      setUploadFile(null);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to upload attachment';
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleAttachmentDelete = (attachment) => {
    setItemToDelete(attachment);
    setDeleteType('attachment');
    setDeleteDialogOpen(true);
  };

  // Section modal handlers
  const handleViewSection = (section) => {
    setSelectedSection(section);
    setSectionModalOpen(true);
  };

  // Bulk operations
  const handleBulkAdd = async (itemIds, addHandler) => {
    try {
      const promises = itemIds.map(id => addHandler(id));
      await Promise.all(promises);
      enqueueSnackbar(`${itemIds.length} items added successfully`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to add some items', { variant: 'error' });
    }
  };

  const handleBulkRemove = async (itemIds, removeHandler) => {
    try {
      const promises = itemIds.map(id => removeHandler(id));
      await Promise.all(promises);
      enqueueSnackbar(`${itemIds.length} items removed successfully`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to remove some items', { variant: 'error' });
    }
  };

  // Generic component for managing associations
  const AssociationManager = ({ 
    title, 
    icon, 
    items, 
    availableItems, 
    onAdd, 
    onRemove, 
    getItemLabel,
    getItemId 
  }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    const [showConnected, setShowConnected] = useState(true);
    
    const connectedIds = items.map(item => getItemId(item));
    const availableToAdd = availableItems.filter(item => !connectedIds.includes(getItemId(item)));

    // Filter available items based on search term
    const filteredAvailable = availableToAdd.filter(item =>
      getItemLabel(item).toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter connected items based on search term (when showing connected items)
    const filteredConnected = items.filter(item =>
      getItemLabel(item).toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Handle search input change
    const handleSearchChange = (event) => {
      setSearchTerm(event.target.value);
      setSelectedItems([]); // Clear selections when search changes
    };

    // Handle individual item selection
    const handleItemSelect = (itemId) => {
      setSelectedItems(prev => 
        prev.includes(itemId) 
          ? prev.filter(id => id !== itemId)
          : [...prev, itemId]
      );
    };

    // Handle select all/none
    const handleSelectAll = () => {
      const currentItems = showConnected ? filteredConnected : filteredAvailable;
      const currentIds = currentItems.map(item => getItemId(item));
      
      if (selectedItems.length === currentIds.length) {
        setSelectedItems([]);
      } else {
        setSelectedItems(currentIds);
      }
    };

    // Handle bulk operations
    const handleBulkOperation = async () => {
      if (selectedItems.length === 0) return;
      
      if (showConnected) {
        // Bulk remove
        await handleBulkRemove(selectedItems, onRemove);
      } else {
        // Bulk add
        await handleBulkAdd(selectedItems, onAdd);
      }
      
      setSelectedItems([]);
      await fetchPortfolioData();
    };

    // Clear search and selections
    const handleClearSearch = () => {
      setSearchTerm('');
      setSelectedItems([]);
    };

    const currentItems = showConnected ? filteredConnected : filteredAvailable;
    const currentIds = currentItems.map(item => getItemId(item));
    const allSelected = selectedItems.length > 0 && selectedItems.length === currentIds.length;
    const someSelected = selectedItems.length > 0 && selectedItems.length < currentIds.length;

    return (
      <Card sx={{ mb: 3 }}>
        <CardHeader
          avatar={<Avatar sx={{ bgcolor: '#1976d2' }}>{icon}</Avatar>}
          title={title}
          subheader={`${items.length} ${title.toLowerCase()} connected • ${availableToAdd.length} available to add`}
        />
        <CardContent>
          {/* Search and Controls */}
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={`Search ${title.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={handleSearchChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: searchTerm && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={handleClearSearch}>
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showConnected}
                        onChange={(e) => {
                          setShowConnected(e.target.checked);
                          setSelectedItems([]);
                        }}
                        size="small"
                      />
                    }
                    label="Show connected"
                    sx={{ mr: 2 }}
                  />
                  {currentItems.length > 0 && (
                    <>
                      <Button
                        size="small"
                        onClick={handleSelectAll}
                        startIcon={<SelectAllIcon />}
                        variant="outlined"
                      >
                        {allSelected ? 'None' : 'All'}
                      </Button>
                      {selectedItems.length > 0 && (
                        <Button
                          size="small"
                          onClick={handleBulkOperation}
                          color={showConnected ? 'error' : 'primary'}
                          variant="contained"
                          startIcon={showConnected ? <DeleteIcon /> : <AddIcon />}
                        >
                          {showConnected ? 'Remove' : 'Add'} ({selectedItems.length})
                        </Button>
                      )}
                    </>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </Box>

          {/* Items Display */}
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 500 }}>
            {showConnected ? 'Connected' : 'Available'} {title}:
            {searchTerm && ` (filtered by "${searchTerm}")`}
          </Typography>

          {currentItems.length > 0 ? (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {currentItems.map((item) => {
                const itemId = getItemId(item);
                const isSelected = selectedItems.includes(itemId);
                
                return (
                  <Chip
                    key={itemId}
                    label={getItemLabel(item)}
                    color={showConnected ? 'primary' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    onClick={() => handleItemSelect(itemId)}
                    onDelete={showConnected ? () => onRemove(itemId) : undefined}
                    deleteIcon={showConnected ? <DeleteIcon /> : undefined}
                    icon={!showConnected ? <AddIcon /> : undefined}
                    sx={{ 
                      cursor: 'pointer',
                      backgroundColor: isSelected 
                        ? alpha('#1976d2', 0.2)
                        : showConnected 
                          ? undefined 
                          : 'transparent',
                      '&:hover': { 
                        backgroundColor: isSelected
                          ? alpha('#1976d2', 0.3)
                          : alpha('#1976d2', 0.08)
                      },
                      mb: 1
                    }}
                  />
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {searchTerm 
                ? `No ${title.toLowerCase()} found matching "${searchTerm}"`
                : showConnected 
                  ? `No ${title.toLowerCase()} connected yet.`
                  : `All available ${title.toLowerCase()} are already connected.`
              }
            </Typography>
          )}

          {/* Quick Actions */}
          {!showConnected && filteredAvailable.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Quick Actions:
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  onClick={() => handleBulkAdd(filteredAvailable.map(getItemId), onAdd)}
                  disabled={filteredAvailable.length === 0}
                  startIcon={<AddIcon />}
                >
                  Add All Visible ({filteredAvailable.length})
                </Button>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh', display: 'flex', flexDirection: 'column' }
        }}
      >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Box>
          <Typography variant="h6" component="div">
            {portfolioName || `Portfolio #${portfolioId}`}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<InfoIcon />} label="Overview" />
          <Tab icon={<CategoryIcon />} label="Categories" />
          <Tab icon={<WorkIcon />} label="Experiences" />
          <Tab icon={<ProjectIcon />} label="Projects" />
          <Tab icon={<SectionIcon />} label="Sections" />
          <Tab icon={<PhotoLibraryIcon />} label="Images" />
          <Tab icon={<AttachFileIcon />} label="Attachments" />
        </Tabs>
      </Box>

      <DialogContent sx={{ flex: 1, p: 0, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : (
          <>
            {/* Overview Tab */}
            <TabPanel value={tabValue} index={0}>
              <Card>
                <CardHeader
                  avatar={<Avatar sx={{ bgcolor: '#1976d2' }}><InfoIcon /></Avatar>}
                  title="Portfolio Information"
                  subheader="Basic portfolio details"
                />
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>{portfolioData?.name || '-'}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">ID</Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>{portfolioData?.id || '-'}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        {portfolioData?.description || 'No description provided'}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  <Divider sx={{ my: 3 }} />
                  
                  <Typography variant="h6" sx={{ mb: 2 }}>Quick Stats</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={4} md={2}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">{categories.length}</Typography>
                        <Typography variant="caption">Categories</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">{experiences.length}</Typography>
                        <Typography variant="caption">Experiences</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">{projects.length}</Typography>
                        <Typography variant="caption">Projects</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">{sections.length}</Typography>
                        <Typography variant="caption">Sections</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">{images.length}</Typography>
                        <Typography variant="caption">Images</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">{attachments.length}</Typography>
                        <Typography variant="caption">Attachments</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </TabPanel>

            {/* Categories Tab */}
            <TabPanel value={tabValue} index={1}>
              <AssociationManager
                title="Categories"
                icon={<CategoryIcon />}
                items={categories}
                availableItems={availableCategories}
                onAdd={handleAddCategory}
                onRemove={handleRemoveCategory}
                getItemLabel={(item) => {
                  // Try to get name from category_texts, fallback to code
                  const name = item.category_texts?.[0]?.name || item.code || `Category ${item.id}`;
                  return name;
                }}
                getItemId={(item) => item.id}
              />
            </TabPanel>

            {/* Experiences Tab */}
            <TabPanel value={tabValue} index={2}>
              <AssociationManager
                title="Experiences"
                icon={<WorkIcon />}
                items={experiences}
                availableItems={availableExperiences}
                onAdd={handleAddExperience}
                onRemove={handleRemoveExperience}
                getItemLabel={(item) => {
                  // Try to get name from experience_texts, fallback to code
                  const name = item.experience_texts?.[0]?.name || item.code || `Experience ${item.id}`;
                  const years = item.years ? ` (${item.years} years)` : '';
                  return `${name}${years}`;
                }}
                getItemId={(item) => item.id}
              />
            </TabPanel>

            {/* Projects Tab */}
            <TabPanel value={tabValue} index={3}>
              <AssociationManager
                title="Projects"
                icon={<ProjectIcon />}
                items={projects}
                availableItems={availableProjects}
                onAdd={handleAddProject}
                onRemove={handleRemoveProject}
                getItemLabel={(item) => {
                  // Try to get name/title from project_texts, fallback to a generic name
                  const title = item.project_texts?.[0]?.name || item.project_texts?.[0]?.title || `Project ${item.id}`;
                  return title;
                }}
                getItemId={(item) => item.id}
              />
            </TabPanel>

            {/* Sections Tab */}
            <TabPanel value={tabValue} index={4}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                  <SectionIcon sx={{ mr: 1 }} />
                  Connected Sections
                </Typography>
                {sections.length > 0 ? (
                  <List>
                    {sections.map((section) => (
                      <ListItem key={section.id} divider>
                        <ListItemIcon>
                          <SectionIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={section.code || `Section ${section.id}`}
                          secondary={`ID: ${section.id}`}
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleViewSection(section)}
                          sx={{ mr: 1 }}
                        >
                          <VisibilityIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveSection(section.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No sections connected yet.
                  </Typography>
                )}
              </Box>

              <Divider sx={{ my: 3 }} />

              <AssociationManager
                title="Available Sections"
                icon={<SectionIcon />}
                items={[]}
                availableItems={availableSections.filter(item => !sections.some(s => s.id === item.id))}
                onAdd={handleAddSection}
                onRemove={handleRemoveSection}
                getItemLabel={(item) => {
                  return item.code || `Section ${item.id}`;
                }}
                getItemId={(item) => item.id}
              />
            </TabPanel>

            {/* Images Tab */}
            <TabPanel value={tabValue} index={5}>
              <Card>
                <CardHeader
                  avatar={<Avatar sx={{ bgcolor: '#1976d2' }}><PhotoLibraryIcon /></Avatar>}
                  title="Portfolio Images"
                  subheader={`${images.length} images uploaded`}
                  action={
                    <Button
                      variant="contained"
                      startIcon={<CloudUploadIcon />}
                      onClick={() => setImageUploadOpen(true)}
                      sx={{ bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' } }}
                    >
                      Upload Image
                    </Button>
                  }
                />
                <CardContent>
                  {images.length > 0 ? (
                    <Grid container spacing={3}>
                      {images.map((image) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={image.id}>
                          <Card 
                            variant="outlined" 
                            sx={{ 
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: 2
                              }
                            }}
                          >
                            {/* Image Container with aspect ratio */}
                            <Box
                              sx={{
                                position: 'relative',
                                width: '100%',
                                paddingTop: '60%', // 5:3 aspect ratio
                                overflow: 'hidden',
                                borderRadius: '4px 4px 0 0',
                                bgcolor: '#f8f9fa'
                              }}
                            >
                              <Box
                                component="img"
                                src={image.image_url ? `${SERVER_URL}${image.image_url}` : 
                                     (image.image_path.startsWith('static/') 
                                      ? `${SERVER_URL}/${image.image_path}` 
                                      : `${SERVER_URL}/static/${image.image_path}`)}
                                alt={`Portfolio image ${image.category}`}
                                onClick={() => handleImagePreview(image)}
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain', // Changed from 'cover' to 'contain'
                                  objectPosition: 'center',
                                  cursor: 'pointer',
                                  transition: 'transform 0.2s ease-in-out',
                                  '&:hover': {
                                    transform: 'scale(1.05)'
                                  }
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.querySelector('.error-placeholder').style.display = 'flex';
                                }}
                              />
                              {/* Error placeholder */}
                              <Box
                                className="error-placeholder"
                                sx={{
                                  display: 'none',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  bgcolor: '#f5f5f5',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexDirection: 'column',
                                  gap: 1
                                }}
                              >
                                <PhotoLibraryIcon color="disabled" fontSize="large" />
                                <Typography variant="caption" color="text.secondary">
                                  Image not found
                                </Typography>
                              </Box>
                            </Box>
                            <CardContent sx={{ 
                              p: 2, 
                              flexGrow: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.5
                            }}>
                              <Typography 
                                variant="body2" 
                                fontWeight={500}
                                sx={{ 
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={image.file_name || 'Unnamed file'}
                              >
                                {image.file_name || 'Unnamed file'}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Chip 
                                  label={image.category || 'Uncategorized'} 
                                  size="small" 
                                  variant="outlined"
                                  sx={{ 
                                    fontSize: '0.75rem',
                                    height: 20,
                                    bgcolor: image.category === 'main' ? '#e3f2fd' : 
                                           image.category === 'thumbnail' ? '#f3e5f5' :
                                           image.category === 'gallery' ? '#e8f5e8' :
                                           image.category === 'background' ? '#fff3e0' : '#f5f5f5'
                                  }}
                                />
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                ID: {image.id}
                              </Typography>
                            </CardContent>
                            <CardActions sx={{ 
                              pt: 0, 
                              pb: 1.5,
                              px: 2,
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(image.created_at).toLocaleDateString()}
                              </Typography>
                              <Box>
                                <Tooltip title="Rename image">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleImageRename(image)}
                                    sx={{ mr: 0.5 }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete image">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleImageDelete(image)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </CardActions>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No images uploaded yet. Click the Upload Image button to add images.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            {/* Attachments Tab */}
            <TabPanel value={tabValue} index={6}>
              <Card>
                <CardHeader
                  avatar={<Avatar sx={{ bgcolor: '#1976d2' }}><AttachFileIcon /></Avatar>}
                  title="Portfolio Attachments"
                  subheader={`${attachments.length} files attached`}
                  action={
                    <Button
                      variant="contained"
                      startIcon={<CloudUploadIcon />}
                      onClick={() => setAttachmentUploadOpen(true)}
                      sx={{ bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' } }}
                    >
                      Upload File
                    </Button>
                  }
                />
                <CardContent>
                  {attachments.length > 0 ? (
                    <Stack spacing={1}>
                      {attachments.map((attachment) => (
                        <Paper key={attachment.id} variant="outlined" sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <AttachFileIcon color="primary" />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight={500}>
                                {attachment.file_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ID: {attachment.id}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              startIcon={<DownloadIcon />}
                              href={attachment.file_url ? `${SERVER_URL}${attachment.file_url}` :
                                   (attachment.file_path.startsWith('static/') 
                                    ? `${SERVER_URL}/${attachment.file_path}` 
                                    : `${SERVER_URL}/static/${attachment.file_path}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ mr: 1 }}
                            >
                              Download
                            </Button>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleAttachmentDelete(attachment)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No attachments uploaded yet. Click the Upload File button to add attachments.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </TabPanel>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
        <Button onClick={handleClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>

    {/* Image Upload Dialog */}
    <Dialog open={imageUploadOpen} onClose={() => setImageUploadOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Portfolio Image</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <Box>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="image-upload-input"
              type="file"
              onChange={(e) => setUploadFile(e.target.files[0])}
            />
            <label htmlFor="image-upload-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                fullWidth
                sx={{ height: 56 }}
              >
                {uploadFile ? uploadFile.name : 'Select Image File'}
              </Button>
            </label>
          </Box>
          
          <FormControl fullWidth>
            <InputLabel>Image Category</InputLabel>
            <Select
              value={imageCategory}
              onChange={(e) => setImageCategory(e.target.value)}
              label="Image Category"
            >
              <MenuItem value="main">Main Image</MenuItem>
              <MenuItem value="thumbnail">Thumbnail</MenuItem>
              <MenuItem value="gallery">Gallery</MenuItem>
              <MenuItem value="background">Background</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setImageUploadOpen(false)}>Cancel</Button>
        <Button
          onClick={handleImageUpload}
          variant="contained"
          disabled={!uploadFile || uploadLoading}
          startIcon={uploadLoading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
        >
          {uploadLoading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Attachment Upload Dialog */}
    <Dialog open={attachmentUploadOpen} onClose={() => setAttachmentUploadOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Portfolio Attachment</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <input
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json,.xml,.zip"
            style={{ display: 'none' }}
            id="attachment-upload-input"
            type="file"
            onChange={(e) => setUploadFile(e.target.files[0])}
          />
          <label htmlFor="attachment-upload-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<AttachFileIcon />}
              fullWidth
              sx={{ height: 56 }}
            >
              {uploadFile ? uploadFile.name : 'Select File'}
            </Button>
          </label>
          
          <Typography variant="caption" color="text.secondary">
            Supported formats: PDF, Word, Excel, CSV, Text, JSON, XML, ZIP (max 10MB)
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setAttachmentUploadOpen(false)}>Cancel</Button>
        <Button
          onClick={handleAttachmentUpload}
          variant="contained"
          disabled={!uploadFile || uploadLoading}
          startIcon={uploadLoading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
        >
          {uploadLoading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Section Content Modal */}
    <Dialog 
      open={sectionModalOpen} 
      onClose={() => setSectionModalOpen(false)} 
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <LanguageIcon sx={{ mr: 1 }} />
        Section Content: {selectedSection?.code}
      </DialogTitle>
      <DialogContent>
        {selectedSection?.section_texts && selectedSection.section_texts.length > 0 ? (
          <Stack spacing={3}>
            {selectedSection.section_texts.map((text, index) => (
              <Paper key={index} variant="outlined" sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  {/* Language Flag */}
                  {text.language?.image ? (
                    <Box
                      component="img"
                      src={`${SERVER_URL}/uploads/${text.language.image.replace(/^.*language_images\//, "language_images/")}`}
                      alt={`${text.language.name} flag`}
                      sx={{
                        width: 32,
                        height: 24,
                        border: '1px solid #eee',
                        borderRadius: 1,
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'inline-flex';
                      }}
                    />
                  ) : null}
                  <Box
                    sx={{
                      display: text.language?.image ? 'none' : 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 24,
                      border: '1px solid #eee',
                      borderRadius: 1,
                      bgcolor: '#f0f0f0',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: '#666'
                    }}
                  >
                    {text.language?.code?.substring(0, 2).toUpperCase() || 'XX'}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    {text.language?.name || text.language_code || 'Unknown Language'}
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {text.text || 'No content available'}
                </Typography>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">
            No multilingual content available for this section.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSectionModalOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>

    {/* Image Rename Dialog */}
    <Dialog open={renameDialogOpen} onClose={handleImageRenameCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Rename Image</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <TextField
            autoFocus
            fullWidth
            label="Image filename"
            value={newImageName}
            onChange={(e) => setNewImageName(e.target.value)}
            placeholder="Enter new filename"
            helperText="Include the file extension (e.g., .jpg, .png)"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleImageRenameCancel}>Cancel</Button>
        <Button
          onClick={handleImageRenameConfirm}
          variant="contained"
          disabled={!newImageName.trim()}
        >
          Rename
        </Button>
      </DialogActions>
    </Dialog>

    {/* Fullscreen Image Preview Dialog */}
    <Dialog 
      open={previewOpen} 
      onClose={handlePreviewClose} 
      maxWidth={false}
      fullScreen
      sx={{
        '& .MuiDialog-paper': {
          bgcolor: 'rgba(0, 0, 0, 0.9)',
          margin: 0,
          maxHeight: '100vh',
          maxWidth: '100vw'
        }
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4
        }}
      >
        {/* Close Button */}
        <IconButton
          onClick={handlePreviewClose}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: 'white',
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.2)'
            },
            zIndex: 1
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* Image Info */}
        {previewImage && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              right: 16,
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(10px)',
              borderRadius: 2,
              p: 2,
              zIndex: 1
            }}
          >
            <Typography variant="h6" sx={{ mb: 1 }}>
              {previewImage.file_name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip 
                label={previewImage.category || 'Uncategorized'} 
                size="small" 
                sx={{ color: 'white', borderColor: 'white' }}
                variant="outlined"
              />
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                ID: {previewImage.id}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {new Date(previewImage.created_at).toLocaleDateString()}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Main Image */}
        {previewImage && (
          <Box
            component="img"
            src={previewImage.image_url ? `${SERVER_URL}${previewImage.image_url}` : 
                 (previewImage.image_path.startsWith('static/') 
                  ? `${SERVER_URL}/${previewImage.image_path}` 
                  : `${SERVER_URL}/static/${previewImage.image_path}`)}
            alt={`Portfolio image ${previewImage.category}`}
            sx={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: 1,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        )}
             </Box>
     </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog 
      open={deleteDialogOpen} 
      onClose={handleDeleteCancel} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
        }
      }}
    >
      <Box sx={{ p: 3 }}>
        {/* Warning Message */}
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Are you sure you want to delete this {deleteType}? This action will permanently remove it from your portfolio and cannot be undone.
          </Typography>
        </Alert>

        {/* Item Information */}
        {itemToDelete && (
          <Box sx={{ mb: 3 }}>
            {deleteType === 'image' ? (
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Image Preview */}
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '2px solid #e0e0e0',
                    flexShrink: 0
                  }}
                >
                  <Box
                    component="img"
                    src={itemToDelete.image_url ? `${SERVER_URL}${itemToDelete.image_url}` : 
                         (itemToDelete.image_path.startsWith('static/') 
                          ? `${SERVER_URL}/${itemToDelete.image_path}` 
                          : `${SERVER_URL}/static/${itemToDelete.image_path}`)}
                    alt="Preview"
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <Box
                    sx={{
                      display: 'none',
                      width: '100%',
                      height: '100%',
                      bgcolor: '#f5f5f5',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <PhotoLibraryIcon color="disabled" />
                  </Box>
                </Box>
                
                {/* Image Details */}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
                    {itemToDelete.file_name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Chip 
                      label={itemToDelete.category || 'Uncategorized'} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.75rem', height: 20 }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    ID: {itemToDelete.id} • Created: {new Date(itemToDelete.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            ) : (
              // Attachment Details
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: alpha('#1976d2', 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <AttachFileIcon sx={{ color: '#1976d2' }} />
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                    {itemToDelete.file_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ID: {itemToDelete.id} • Created: {new Date(itemToDelete.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
                 )}

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            onClick={handleDeleteCancel}
            variant="outlined"
            disabled={deleting}
            sx={{ 
              minWidth: 100,
              borderColor: '#e0e0e0',
              color: 'text.secondary',
              '&:hover': {
                borderColor: '#bdbdbd',
                bgcolor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
            sx={{ 
              minWidth: 100,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)',
              '&:hover': {
                boxShadow: '0 6px 16px rgba(244, 67, 54, 0.4)'
              }
            }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  </>
);
}

export default PortfolioData; 