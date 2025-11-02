
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CardActions,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  Autocomplete,
  TablePagination
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  PhotoLibrary as PhotoLibraryIcon,
  AttachFile as AttachFileIcon,
  ViewModule as SectionIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Language as LanguageIcon,
  ArrowBack as ArrowBackIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { api, projectsApi, sectionsApi, languagesApi } from '../services/api';
import { useSnackbar } from 'notistack';
import SERVER_URL from '../components/common/BackendServerData';
import PermissionGate from '../components/common/PermissionGate';

// Tab Panel Component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
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

// Helper component for adding sections to project
const SectionAddManager = ({ sectionsConnected, onAddMany }) => {
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [options, setOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const connectedIds = sectionsConnected.map(s => s.id);
  const filteredOptions = (options || []).filter(opt => !connectedIds.includes(opt.id));

  const getLabel = (item) => item?.code || `Section ${item?.id}`;

  const loadAll = async () => {
    try {
      setLoadingOptions(true);
      const res = await sectionsApi.getSections({ page: 1, page_size: 100 });
      const list = res.data?.items || res.data || [];
      setOptions(list);
    } catch (e) {
      // noop
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleInputChange = async (_e, value, reason) => {
    if (reason === 'input' && typeof value === 'string') {
      try {
        setLoadingOptions(true);
        const params = {
          page: 1,
          page_size: 100,
          filter_field: ['code','text'],
          filter_value: [value, value],
          filter_operator: ['contains','contains']
        };
        const res = await sectionsApi.getSections(params);
        const list = res.data?.items || res.data || [];
        setOptions(list);
      } catch (_) {
        // ignore
      } finally {
        setLoadingOptions(false);
      }
    }
  };

  const handleAdd = async () => {
    if (!selectedOptions.length) return;
    const ids = selectedOptions.map(o => o.id);
    await onAddMany(ids);
    setSelectedOptions([]);
  };

  const handleRemoveSelected = (id) => {
    setSelectedOptions(prev => prev.filter(o => o.id !== id));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Add Sections ({filteredOptions.length} available)
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={selectedOptions.length === 0}
          size="small"
          sx={{ bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' } }}
        >
          Add {selectedOptions.length > 0 ? `(${selectedOptions.length})` : ''}
        </Button>
      </Box>
      <Autocomplete
        multiple
        options={filteredOptions}
        value={selectedOptions}
        onChange={(e, newValue) => setSelectedOptions(newValue)}
        onOpen={loadAll}
        onInputChange={handleInputChange}
        getOptionLabel={getLabel}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        filterSelectedOptions
        loading={loadingOptions}
        size="small"
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder="Search sections to add..."
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
            }}
          />
        )}
      />
      {selectedOptions.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Selected:</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {selectedOptions.map(opt => (
              <Chip
                key={opt.id}
                label={getLabel(opt)}
                onDelete={() => handleRemoveSelected(opt.id)}
                size="small"
              />
            ))}
          </Stack>
        </Box>
      )}
      {filteredOptions.length === 0 && !loadingOptions && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          All available sections have been added
        </Typography>
      )}
    </Box>
  );
};

function ProjectDataPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const [tabValue, setTabValue] = useState(location.state?.initialTab || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Project data states
  const [projectData, setProjectData] = useState(null);
  const [sections, setSections] = useState([]);
  const [images, setImages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  
  // Available options states
  const [availableSections, setAvailableSections] = useState([]);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [languagesLoading, setLanguagesLoading] = useState(false);
  const [imageCategories, setImageCategories] = useState([]);
  const [attachmentCategories, setAttachmentCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Upload dialog states
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [attachmentUploadOpen, setAttachmentUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [imageCategory, setImageCategory] = useState('');
  const [imageLanguage, setImageLanguage] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  
  // Attachment category states
  const [attachmentCategory, setAttachmentCategory] = useState('');
  const [setAsDefaultResume, setSetAsDefaultResume] = useState(false);
  const [attachmentLanguage, setAttachmentLanguage] = useState('');

  // Section modal states
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);

  // Image states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [editImageOpen, setEditImageOpen] = useState(false);
  const [selectedImageForEdit, setSelectedImageForEdit] = useState(null);
  const [editImageFileName, setEditImageFileName] = useState('');
  const [editImageCategory, setEditImageCategory] = useState('');
  const [editImageLanguage, setEditImageLanguage] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [replacementImageFile, setReplacementImageFile] = useState(null);

  // Attachment states
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  const [editAttachmentOpen, setEditAttachmentOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [editAttachmentCategory, setEditAttachmentCategory] = useState('');
  const [editAttachmentLanguage, setEditAttachmentLanguage] = useState('');
  const [editSetAsDefault, setEditSetAsDefault] = useState(false);

  // Delete confirmation states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'image', 'attachment', or 'section'
  const [deleting, setDeleting] = useState(false);

  // Edit project overview states
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedRepositoryUrl, setEditedRepositoryUrl] = useState('');
  const [editedWebsiteUrl, setEditedWebsiteUrl] = useState('');
  const [editedProjectDate, setEditedProjectDate] = useState(null);
  const [savingOverview, setSavingOverview] = useState(false);
  
  // Multilingual edit states
  const [languageTexts, setLanguageTexts] = useState({}); // { language_id: { name, description } }
  const [selectedLanguageTab, setSelectedLanguageTab] = useState(0);

  // Search states
  const [sectionsSearchTerm, setSectionsSearchTerm] = useState('');
  const [sectionsPage, setSectionsPage] = useState(0);
  const [sectionsRowsPerPage, setSectionsRowsPerPage] = useState(5);

  // Fetch project data
  const fetchProjectData = useCallback(async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch project details with all related data
      const response = await api.get(`/api/projects/${projectId}`, {
        params: { include_full_details: true }
      });
      const project = response.data;
      
      setProjectData(project);
      setSections(project.sections || []);
      
      // Always fetch images and attachments separately since backend doesn't include them
      try {
        const imagesRes = await projectsApi.getProjectImages(projectId);
        console.log('Images fetched:', imagesRes.data);
        setImages(imagesRes.data || []);
      } catch (e) {
        console.error('Error fetching images:', e);
        setImages([]);
      }
      
      try {
        const attachmentsRes = await projectsApi.getProjectAttachments(projectId);
        console.log('Attachments fetched:', attachmentsRes.data);
        setAttachments(attachmentsRes.data || []);
      } catch (e) {
        console.error('Error fetching attachments:', e);
        setAttachments([]);
      }
      
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to fetch project data';
      setError(errorMessage);
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [projectId, enqueueSnackbar]);

  // Fetch available options for dropdowns
  const fetchAvailableOptions = useCallback(async () => {
    try {
      const sectionsRes = await sectionsApi.getSections({ page: 1, page_size: 100 });
      setAvailableSections(sectionsRes.data.items || sectionsRes.data || []);
    } catch (err) {
      console.error('Error fetching available options:', err);
    }
  }, []);

  // Fetch languages
  const fetchLanguages = useCallback(async () => {
    setLanguagesLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/languages/?page_size=100`, {
        credentials: 'include',
        mode: 'cors'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch languages');
      }
      const data = await response.json();
      // Filter to only show enabled languages
      // The backend field is 'enabled', not 'is_enabled'
      const allLanguages = data.items || data || [];
      console.log('All languages fetched:', allLanguages);
      const enabledLanguages = allLanguages.filter(lang => lang.enabled === true || lang.enabled === 1);
      console.log('Enabled languages after filter:', enabledLanguages);
      setAvailableLanguages(enabledLanguages);
    } catch (error) {
      console.error('Error fetching languages:', error);
      setAvailableLanguages([]);
    } finally {
      setLanguagesLoading(false);
    }
  }, []);

  // Fetch image categories (PROI type)
  const fetchImageCategories = useCallback(async () => {
    try {
      const response = await api.get('/api/categories/by-code-pattern/PROI');
      setImageCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching image categories:', error);
      setImageCategories([]);
    }
  }, []);

  // Fetch attachment categories (PDOC and RESU types)
  const fetchAttachmentCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/categories/?page_size=100`, {
        credentials: 'include',
        mode: 'cors'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      const data = await response.json();
      
      const docResumeCategories = (data.items || data || []).filter(cat => 
        cat.type_code === 'PDOC' || cat.type_code === 'RESU'
      );
      
      setAttachmentCategories(docResumeCategories);
    } catch (error) {
      console.error('Error fetching attachment categories:', error);
      setAttachmentCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  // Initialize data on component mount
  useEffect(() => {
    if (projectId) {
      fetchProjectData();
      fetchAvailableOptions();
      fetchLanguages();
      fetchImageCategories();
      fetchAttachmentCategories();
    }
  }, [projectId, fetchProjectData, fetchAvailableOptions, fetchLanguages, fetchImageCategories, fetchAttachmentCategories]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Back handler
  const handleBack = () => {
    navigate('/projects');
  };

  // Helper to get category display name
  const getCategoryDisplayName = (category) => {
    if (!category) return '';
    
    if (category.texts && Array.isArray(category.texts)) {
      const englishText = category.texts.find(t => t.language?.code === 'en' || t.language_id === 1);
      if (englishText?.name) return englishText.name;
    }
    
    if (category.category_texts && Array.isArray(category.category_texts)) {
      const englishText = category.category_texts.find(t => t.language?.code === 'en' || t.language_id === 1);
      if (englishText?.name) return englishText.name;
    }
    
    return category.name || category.code || `Category ${category.id}`;
  };

  // Get project title
  const getProjectTitle = () => {
    if (!projectData) return `Project #${projectId}`;
    if (projectData.project_texts && projectData.project_texts.length > 0) {
      return projectData.project_texts[0].name || projectData.project_texts[0].title || `Project #${projectId}`;
    }
    return `Project #${projectId}`;
  };

  // Placeholder handlers - to be implemented in subsequent tasks
  const handleImageUpload = async () => {
    if (!uploadFile) {
      enqueueSnackbar('Please select a file', { variant: 'error' });
      return;
    }

    try {
      setUploadLoading(true);
      const languageIdToSend = imageLanguage ? parseInt(imageLanguage, 10) : null;
      await projectsApi.uploadProjectImage(projectId, uploadFile, imageCategory, languageIdToSend);
      await fetchProjectData();
      enqueueSnackbar('Image uploaded successfully', { variant: 'success' });
      setImageUploadOpen(false);
      setUploadFile(null);
      setImageCategory('');
      setImageLanguage('');
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

  const handleEditImage = (image) => {
    setSelectedImageForEdit(image);
    // Extract filename from path if file_name doesn't exist
    const fileName = image.file_name || image.image_path?.split('/').pop() || 'Unnamed file';
    setEditImageFileName(fileName);
    setEditImageCategory(image.category || '');
    setEditImageLanguage(image.language_id || image.language?.id || '');
    setReplacementImageFile(null);
    setEditImageOpen(true);
  };

  const handleImageUpdate = async () => {
    if (!selectedImageForEdit) return;
    
    if (!editImageFileName.trim()) {
      enqueueSnackbar('Please enter a valid filename', { variant: 'error' });
      return;
    }
    
    try {
      setEditLoading(true);
      
      // If a replacement file is provided, upload it as a replacement
      if (replacementImageFile) {
        const formData = new FormData();
        formData.append('image', replacementImageFile);  // Backend expects 'image', not 'file'
        if (editImageCategory) {
          formData.append('category', editImageCategory);  // Backend expects 'category', not 'category_code'
        }
        if (editImageLanguage) {
          formData.append('language_id', editImageLanguage);
        }
        
        await api.put(`/api/projects/${projectId}/images/${selectedImageForEdit.id}`, formData);
        enqueueSnackbar('Image replaced successfully', { variant: 'success' });
      } else {
        // Just update metadata
        await projectsApi.renameProjectImage(projectId, selectedImageForEdit.id, {
          file_name: editImageFileName.trim(),
          category: editImageCategory || null,
          language_id: editImageLanguage || null
        });
        enqueueSnackbar('Image updated successfully', { variant: 'success' });
      }
      
      setEditImageOpen(false);
      setSelectedImageForEdit(null);
      setEditImageFileName('');
      setEditImageCategory('');
      setEditImageLanguage('');
      setReplacementImageFile(null);
      await fetchProjectData();
    } catch (err) {
      console.error('Update image error:', err);
      const errorMsg = Array.isArray(err.response?.data?.detail) 
        ? err.response.data.detail.map(e => e.msg || e).join(', ')
        : err.response?.data?.detail || 'Failed to update image';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleImagePreview = (image) => {
    setPreviewImage(image);
    setPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    setPreviewOpen(false);
    setPreviewImage(null);
  };

  const handleAttachmentUpload = async () => {
    if (!uploadFile) {
      enqueueSnackbar('Please select a file', { variant: 'error' });
      return;
    }

    try {
      setUploadLoading(true);
      await projectsApi.uploadProjectAttachment(
        projectId, 
        uploadFile,
        attachmentCategory || null,
        setAsDefaultResume,
        attachmentLanguage || null
      );
      await fetchProjectData();
      enqueueSnackbar('Attachment uploaded successfully', { variant: 'success' });
      setAttachmentUploadOpen(false);
      setUploadFile(null);
      setAttachmentCategory('');
      setSetAsDefaultResume(false);
      setAttachmentLanguage('');
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to upload attachment';
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
    } finally {
      setUploadLoading(false);
    }
  };

  // Section handlers
  const handleAddSection = async (sectionId) => {
    try {
      await api.post(`/api/projects/${projectId}/sections/${sectionId}`, {
        section_id: sectionId,
        display_order: 0
      });
      await fetchProjectData();
      // Success message shown by handleBulkAddSections when called from bulk add
    } catch (err) {
      enqueueSnackbar('Failed to add section', { variant: 'error' });
      throw err; // Re-throw for bulk add error handling
    }
  };

  const handleBulkAddSections = async (sectionIds, addCallback) => {
    const successes = [];
    const failures = [];
    
    for (const id of sectionIds) {
      try {
        await addCallback(id);
        successes.push(id);
      } catch (e) {
        failures.push(id);
      }
    }
    
    if (successes.length > 0) {
      enqueueSnackbar(`Successfully added ${successes.length} section(s)`, { variant: 'success' });
    }
    if (failures.length > 0) {
      enqueueSnackbar(`Failed to add ${failures.length} section(s)`, { variant: 'warning' });
    }
  };

  const handleRemoveSection = async (sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    if (section) {
      setItemToDelete(section);
      setDeleteType('section');
      setDeleteDialogOpen(true);
    }
  };

  const handleViewSection = (section) => {
    setSelectedSection(section);
    setSectionModalOpen(true);
  };

  const handleAttachmentDelete = (attachment) => {
    setItemToDelete(attachment);
    setDeleteType('attachment');
    setDeleteDialogOpen(true);
  };

  const handleEditAttachment = (attachment) => {
    setSelectedAttachment(attachment);
    setEditAttachmentCategory(attachment.category_id || '');
    setEditAttachmentLanguage(attachment.language_id || '');
    setEditSetAsDefault(attachment.is_default || false);
    setEditAttachmentOpen(true);
  };

  const handleAttachmentUpdate = async () => {
    if (!selectedAttachment) return;
    
    try {
      setEditLoading(true);
      
      await projectsApi.updateProjectAttachment(
        projectId,
        selectedAttachment.id,
        editAttachmentCategory || null,
        editSetAsDefault,
        editAttachmentLanguage || null
      );
      
      enqueueSnackbar('Attachment updated successfully', { variant: 'success' });
      setEditAttachmentOpen(false);
      setSelectedAttachment(null);
      setEditAttachmentCategory('');
      setEditAttachmentLanguage('');
      setEditSetAsDefault(false);
      await fetchProjectData();
    } catch (err) {
      console.error('Update attachment error:', err);
      enqueueSnackbar(err.response?.data?.detail || 'Failed to update attachment', { variant: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleAttachmentDownload = async (attachment) => {
    if (!attachment) return;
    try {
      setDownloadingAttachmentId(attachment.id);
      const url = attachment.file_url
        ? `${SERVER_URL}${attachment.file_url}`
        : (attachment.file_path.startsWith('static/')
            ? `${SERVER_URL}/${attachment.file_path}`
            : `${SERVER_URL}/static/${attachment.file_path}`);

      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }
      const blob = await response.blob();

      let filename = attachment.file_name || 'download';
      const disposition = response.headers.get('content-disposition');
      if (disposition) {
        const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
        if (match) {
          filename = decodeURIComponent(match[1] || match[2] || filename);
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const msg = err?.message || 'Failed to download file';
      enqueueSnackbar(`Error: ${msg}`, { variant: 'error' });
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      setDeleting(true);
      
      if (deleteType === 'image') {
        await projectsApi.deleteProjectImage(projectId, itemToDelete.id);
        enqueueSnackbar('Image deleted successfully', { variant: 'success' });
      } else if (deleteType === 'attachment') {
        await projectsApi.deleteProjectAttachment(projectId, itemToDelete.id);
        enqueueSnackbar('Attachment deleted successfully', { variant: 'success' });
      } else if (deleteType === 'section') {
        await api.delete(`/api/projects/${projectId}/sections/${itemToDelete.id}`);
        enqueueSnackbar('Section removed successfully', { variant: 'success' });
      }
      
      await fetchProjectData();
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

  // Project overview edit handlers
  const handleEditOverview = () => {
    const title = projectData?.project_texts?.[0]?.name || projectData?.project_texts?.[0]?.title || '';
    const description = projectData?.project_texts?.[0]?.description || '';
    const repositoryUrl = projectData?.repository_url || '';
    const websiteUrl = projectData?.website_url || '';
    // Keep date in YYYY-MM-DD format for date input (no timezone conversion)
    const projectDate = projectData?.project_date || null;
    
    // Initialize language texts from project data
    const langTexts = {};
    if (projectData?.project_texts && Array.isArray(projectData.project_texts)) {
      projectData.project_texts.forEach(text => {
        if (text.language_id) {
          langTexts[text.language_id] = {
            name: text.name || text.title || '',
            description: text.description || ''
          };
        }
      });
    }
    
    setEditedTitle(title);
    setEditedDescription(description);
    setEditedRepositoryUrl(repositoryUrl);
    setEditedWebsiteUrl(websiteUrl);
    setEditedProjectDate(projectDate);
    setLanguageTexts(langTexts);
    setSelectedLanguageTab(0);
    setIsEditingOverview(true);
  };

  const handleCancelEditOverview = () => {
    setIsEditingOverview(false);
    setEditedTitle('');
    setEditedDescription('');
    setEditedRepositoryUrl('');
    setEditedWebsiteUrl('');
    setEditedProjectDate(null);
    setLanguageTexts({});
    setSelectedLanguageTab(0);
  };

  const handleSaveOverview = async () => {
    // Validate that all languages have a name
    const languagesWithText = Object.keys(languageTexts);
    if (languagesWithText.length === 0) {
      enqueueSnackbar('At least one language is required', { variant: 'error' });
      return;
    }
    
    for (const langId of languagesWithText) {
      if (!languageTexts[langId]?.name?.trim()) {
        const lang = availableLanguages.find(l => l.id === parseInt(langId));
        const langName = lang?.name || `Language ${langId}`;
        enqueueSnackbar(`Title is required for ${langName}`, { variant: 'error' });
        return;
      }
    }

    try {
      setSavingOverview(true);
      
      // Build project texts from language texts state
      const updatedProjectTexts = languagesWithText.map(langId => ({
        language_id: parseInt(langId),
        name: languageTexts[langId].name.trim(),
        title: languageTexts[langId].name.trim(),
        description: languageTexts[langId].description.trim() || null
      }));

      const updateData = {
        repository_url: editedRepositoryUrl.trim() || null,
        website_url: editedWebsiteUrl.trim() || null,
        project_date: editedProjectDate || null,
        project_texts: updatedProjectTexts
      };
      
      await api.put(`/api/projects/${projectId}`, updateData);
      
      enqueueSnackbar('Project updated successfully', { variant: 'success' });
      setIsEditingOverview(false);
      await fetchProjectData();
    } catch (err) {
      console.error('Update project error:', err);
      const errorMsg = err.response?.data?.detail || 'Failed to update project';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    } finally {
      setSavingOverview(false);
    }
  };

  return (
    <Container 
      maxWidth={false} 
      disableGutters 
      sx={{ 
        ml: 0, 
        mr: 0, 
        pl: { xs: 2, sm: 3 }, 
        pr: { xs: 2, sm: 3 }, 
        mt: 2, 
        mb: 4,
        maxWidth: '100%'
      }}
    >
      <Paper>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="div">
            {getProjectTitle()}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
          >
            Back to Projects
          </Button>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<InfoIcon />} label="Overview" />
            <Tab icon={<PhotoLibraryIcon />} label="Images" />
            <Tab icon={<AttachFileIcon />} label="Attachments" />
            <Tab icon={<SectionIcon />} label="Sections" />
          </Tabs>
        </Box>

        <Box>
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
                <PermissionGate 
                  permission="VIEW_PROJECTS" 
                  showError 
                  errorMessage="You do not have permission to see Project information, please contact your system administrator."
                >
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                        <InfoIcon sx={{ mr: 1 }} />
                        Overview
                      </Typography>
                      <PermissionGate permission="EDIT_PROJECT">
                        {!isEditingOverview ? (
                          <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={handleEditOverview}
                            size="small"
                          >
                            Edit
                          </Button>
                        ) : (
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              onClick={handleCancelEditOverview}
                              disabled={savingOverview}
                              size="small"
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="contained"
                              onClick={handleSaveOverview}
                              disabled={savingOverview}
                              size="small"
                            >
                              {savingOverview ? <CircularProgress size={20} /> : 'Save'}
                            </Button>
                          </Stack>
                        )}
                      </PermissionGate>
                    </Box>

                    <Card>
                      <CardContent>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" color="text.secondary">ID</Typography>
                            <Typography variant="body1" sx={{ mb: 2 }}>{projectData?.id || '-'}</Typography>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" color="text.secondary">Project Date</Typography>
                            {isEditingOverview ? (
                              <TextField
                                fullWidth
                                type="date"
                                value={editedProjectDate || ''}
                                onChange={(e) => setEditedProjectDate(e.target.value)}
                                size="small"
                                sx={{ mt: 1 }}
                                InputLabelProps={{ shrink: true }}
                              />
                            ) : (
                              <Typography variant="body1" sx={{ mb: 2 }}>
                                {projectData?.project_date ? (() => {
                                  // Parse as local date to avoid timezone issues
                                  const dateStr = projectData.project_date;
                                  if (dateStr.includes('T')) {
                                    // If it has time component, use the date part only
                                    const [year, month, day] = dateStr.split('T')[0].split('-');
                                    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString();
                                  } else {
                                    // Already in YYYY-MM-DD format
                                    const [year, month, day] = dateStr.split('-');
                                    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString();
                                  }
                                })() : '-'}
                              </Typography>
                            )}
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                              Title & Description (Multilingual)
                            </Typography>
                            {isEditingOverview ? (
                              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                                {languagesLoading ? (
                                  <Alert severity="info">Loading languages...</Alert>
                                ) : availableLanguages.length === 0 ? (
                                  <Alert severity="warning">No enabled languages found. Please enable at least one language in the system settings.</Alert>
                                ) : (
                                  <>
                                    <Tabs
                                      value={selectedLanguageTab}
                                      onChange={(e, newValue) => setSelectedLanguageTab(newValue)}
                                      variant="scrollable"
                                      scrollButtons="auto"
                                      sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
                                    >
                                      {availableLanguages.map((lang, index) => {
                                        const hasText = languageTexts[lang.id];
                                        return (
                                          <Tab
                                            key={lang.id}
                                            label={
                                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <LanguageIcon fontSize="small" />
                                                {lang.name}
                                                {hasText && (
                                                  <Chip
                                                    label="✓"
                                                    size="small"
                                                    color="success"
                                                    sx={{ height: 16, minWidth: 16, '& .MuiChip-label': { px: 0.5 } }}
                                                  />
                                                )}
                                              </Box>
                                            }
                                          />
                                        );
                                      })}
                                    </Tabs>
                                    
                                    {availableLanguages.map((lang, index) => (
                                      <Box
                                        key={lang.id}
                                        hidden={selectedLanguageTab !== index}
                                        sx={{ display: selectedLanguageTab === index ? 'block' : 'none' }}
                                      >
                                        <Stack spacing={2}>
                                          <TextField
                                            fullWidth
                                            label={`Title (${lang.name})`}
                                            value={languageTexts[lang.id]?.name || ''}
                                            onChange={(e) => setLanguageTexts({
                                              ...languageTexts,
                                              [lang.id]: {
                                                ...languageTexts[lang.id],
                                                name: e.target.value
                                              }
                                            })}
                                            placeholder={`Enter project title in ${lang.name}`}
                                            size="small"
                                            required
                                          />
                                          <TextField
                                            fullWidth
                                            multiline
                                            rows={4}
                                            label={`Description (${lang.name})`}
                                            value={languageTexts[lang.id]?.description || ''}
                                            onChange={(e) => setLanguageTexts({
                                              ...languageTexts,
                                              [lang.id]: {
                                                ...languageTexts[lang.id],
                                                description: e.target.value
                                              }
                                            })}
                                            placeholder={`Enter project description in ${lang.name}`}
                                            size="small"
                                          />
                                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                            {!languageTexts[lang.id] && (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<AddIcon />}
                                                onClick={() => setLanguageTexts({
                                                  ...languageTexts,
                                                  [lang.id]: { name: '', description: '' }
                                                })}
                                              >
                                                Add {lang.name} Translation
                                              </Button>
                                            )}
                                            {languageTexts[lang.id] && (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                startIcon={<DeleteIcon />}
                                                onClick={() => {
                                                  const newTexts = { ...languageTexts };
                                                  delete newTexts[lang.id];
                                                  setLanguageTexts(newTexts);
                                                }}
                                              >
                                                Remove {lang.name}
                                              </Button>
                                            )}
                                          </Box>
                                        </Stack>
                                      </Box>
                                    ))}
                                  </>
                                )}
                              </Box>
                            ) : (
                              <Box>
                                {projectData?.project_texts && projectData.project_texts.length > 0 ? (
                                  projectData.project_texts.map((text, index) => {
                                    const lang = availableLanguages.find(l => l.id === text.language_id);
                                    const langName = lang?.name || `Language ${text.language_id}`;
                                    return (
                                      <Box key={text.language_id || index} sx={{ mb: 2, pb: 2, borderBottom: index < projectData.project_texts.length - 1 ? 1 : 0, borderColor: 'divider' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                          <LanguageIcon fontSize="small" color="primary" />
                                          <Typography variant="subtitle2" color="primary">{langName}</Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">Title:</Typography>
                                        <Typography variant="body1" sx={{ mb: 1 }}>{text.name || text.title || '-'}</Typography>
                                        <Typography variant="body2" color="text.secondary">Description:</Typography>
                                        <Typography variant="body1">{text.description || 'No description provided'}</Typography>
                                      </Box>
                                    );
                                  })
                                ) : (
                                  <Typography variant="body1" color="text.secondary">No translations available</Typography>
                                )}
                              </Box>
                            )}
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" color="text.secondary">Repository URL</Typography>
                            {isEditingOverview ? (
                              <TextField
                                fullWidth
                                value={editedRepositoryUrl}
                                onChange={(e) => setEditedRepositoryUrl(e.target.value)}
                                placeholder="https://github.com/..."
                                size="small"
                                sx={{ mt: 1 }}
                              />
                            ) : (
                              <Typography variant="body1" sx={{ mb: 2 }}>
                                {projectData?.repository_url ? (
                                  <a href={projectData.repository_url} target="_blank" rel="noopener noreferrer">
                                    {projectData.repository_url}
                                  </a>
                                ) : '-'}
                              </Typography>
                            )}
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" color="text.secondary">Website URL</Typography>
                            {isEditingOverview ? (
                              <TextField
                                fullWidth
                                value={editedWebsiteUrl}
                                onChange={(e) => setEditedWebsiteUrl(e.target.value)}
                                placeholder="https://..."
                                size="small"
                                sx={{ mt: 1 }}
                              />
                            ) : (
                              <Typography variant="body1" sx={{ mb: 2 }}>
                                {projectData?.website_url ? (
                                  <a href={projectData.website_url} target="_blank" rel="noopener noreferrer">
                                    {projectData.website_url}
                                  </a>
                                ) : '-'}
                              </Typography>
                            )}
                          </Grid>
                        </Grid>
                        
                        <Divider sx={{ my: 3 }} />
                        
                        <Typography variant="h6" sx={{ mb: 2 }}>Quick Stats</Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6} sm={4} md={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="primary">{images.length}</Typography>
                              <Typography variant="caption">Images</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6} sm={4} md={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="primary">{attachments.length}</Typography>
                              <Typography variant="caption">Attachments</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6} sm={4} md={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="primary">{sections.length}</Typography>
                              <Typography variant="caption">Sections</Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Box>
                </PermissionGate>
              </TabPanel>

              {/* Images Tab */}
              <TabPanel value={tabValue} index={1}>
                <PermissionGate 
                  permissions={["VIEW_PROJECT_IMAGES", "MANAGE_PROJECT_IMAGES", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}
                  showError
                  errorMessage="You do not have permission to see Project Images, please contact your system administrator."
                >
                  <Card>
                    <CardHeader
                      avatar={<Avatar sx={{ bgcolor: '#1976d2' }}><PhotoLibraryIcon /></Avatar>}
                      title="Project Images"
                      subheader={`${images.length} images uploaded`}
                      action={
                        <PermissionGate 
                          permissions={["UPLOAD_PROJECT_IMAGES", "MANAGE_PROJECT_IMAGES", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}
                        >
                          <Button
                            variant="contained"
                            startIcon={<CloudUploadIcon />}
                            onClick={() => setImageUploadOpen(true)}
                            sx={{ bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' } }}
                          >
                            Upload Image
                          </Button>
                        </PermissionGate>
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
                                <Box
                                  sx={{
                                    position: 'relative',
                                    width: '100%',
                                    paddingTop: '60%',
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
                                    alt={`Project image ${image.category}`}
                                    onClick={() => handleImagePreview(image)}
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'contain',
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
                                    title={image.file_name || image.image_path?.split('/').pop() || 'Unnamed file'}
                                  >
                                    {image.file_name || image.image_path?.split('/').pop() || 'Unnamed file'}
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                    {(image.language || (image.language_id && availableLanguages.find(l => l.id === image.language_id))) && (() => {
                                      const lang = image.language || availableLanguages.find(l => l.id === image.language_id);
                                      return (
                                        <Chip
                                          size="small"
                                          icon={lang.image ? (
                                            <Box
                                              component="img"
                                              src={`${SERVER_URL}/uploads/${lang.image.replace(/^.*language_images\//, "language_images/")}`}
                                              alt={lang.name}
                                              sx={{ width: 16, height: 12, objectFit: 'cover' }}
                                            />
                                          ) : <LanguageIcon />}
                                          label={lang.name}
                                          sx={{ height: 20 }}
                                        />
                                      );
                                    })()}
                                    {image.category && (() => {
                                      // Try to find the category object from imageCategories
                                      const categoryObj = imageCategories.find(cat => cat.code === image.category);
                                      if (categoryObj) {
                                        return (
                                          <Chip
                                            size="small"
                                            icon={<CategoryIcon />}
                                            label={getCategoryDisplayName(categoryObj)}
                                            color="primary"
                                            variant="outlined"
                                            sx={{ height: 20 }}
                                          />
                                        );
                                      }
                                      return (
                                        <Chip 
                                          label={image.category} 
                                          size="small" 
                                          variant="outlined"
                                          sx={{ 
                                            fontSize: '0.75rem',
                                            height: 20,
                                            bgcolor: image.category.includes('LOGO') ? '#e3f2fd' : 
                                                   image.category.includes('THUMB') ? '#f3e5f5' :
                                                   image.category.includes('GALLERY') ? '#e8f5e8' :
                                                   image.category.includes('BACK') ? '#fff3e0' : '#f5f5f5'
                                          }}
                                        />
                                      );
                                    })()}
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
                                    {image.created_at && new Date(image.created_at).toLocaleDateString()}
                                  </Typography>
                                  <Box>
                                    <PermissionGate permissions={["EDIT_PROJECT_IMAGES", "MANAGE_PROJECT_IMAGES", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}>
                                      <Tooltip title="Edit image">
                                        <IconButton
                                          size="small"
                                          color="primary"
                                          onClick={() => handleEditImage(image)}
                                          sx={{ mr: 0.5 }}
                                        >
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </PermissionGate>
                                    <PermissionGate permissions={["DELETE_PROJECT_IMAGES", "MANAGE_PROJECT_IMAGES", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}>
                                      <Tooltip title="Delete image">
                                        <IconButton
                                          size="small"
                                          color="error"
                                          onClick={() => handleImageDelete(image)}
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </PermissionGate>
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
                </PermissionGate>
              </TabPanel>

              {/* Attachments Tab */}
              <TabPanel value={tabValue} index={2}>
                <PermissionGate 
                  permissions={["VIEW_PROJECT_ATTACHMENTS", "MANAGE_PROJECT_ATTACHMENTS", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}
                  showError
                  errorMessage="You do not have permission to see Project Attachments, please contact your system administrator."
                >
                  <Card>
                    <CardHeader
                      avatar={<Avatar sx={{ bgcolor: '#1976d2' }}><AttachFileIcon /></Avatar>}
                      title="Project Attachments"
                      subheader={`${attachments.length} files attached`}
                      action={
                        <PermissionGate permissions={["UPLOAD_PROJECT_ATTACHMENTS", "MANAGE_PROJECT_ATTACHMENTS", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}>
                          <Button
                            variant="contained"
                            startIcon={<CloudUploadIcon />}
                            onClick={() => setAttachmentUploadOpen(true)}
                            sx={{ bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' } }}
                          >
                            Upload File
                          </Button>
                        </PermissionGate>
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
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                    <Typography variant="caption" color="text.secondary">
                                      ID: {attachment.id}
                                    </Typography>
                                    {attachment.language && (
                                      <Chip
                                        size="small"
                                        icon={attachment.language.image ? (
                                          <Box
                                            component="img"
                                            src={`${SERVER_URL}/uploads/${attachment.language.image.replace(/^.*language_images\//, "language_images/")}`}
                                            alt={attachment.language.name}
                                            sx={{ width: 16, height: 12, objectFit: 'cover' }}
                                          />
                                        ) : <LanguageIcon />}
                                        label={attachment.language.name}
                                        sx={{ height: 20 }}
                                      />
                                    )}
                                    {attachment.category && (
                                      <Chip
                                        size="small"
                                        icon={<CategoryIcon />}
                                        label={getCategoryDisplayName(attachment.category)}
                                        color="primary"
                                        variant="outlined"
                                        sx={{ height: 20 }}
                                      />
                                    )}
                                    {attachment.is_default && (
                                      <Chip
                                        size="small"
                                        label="Default"
                                        color="success"
                                        sx={{ height: 20 }}
                                      />
                                    )}
                                  </Box>
                                </Box>
                                <PermissionGate permissions={["MANAGE_PROJECT_ATTACHMENTS", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}>
                                  <Tooltip title="Edit">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => handleEditAttachment(attachment)}
                                    >
                                      <EditIcon />
                                    </IconButton>
                                  </Tooltip>
                                </PermissionGate>
                                <Button
                                  size="small"
                                  startIcon={downloadingAttachmentId === attachment.id ? <CircularProgress size={16} /> : <DownloadIcon />}
                                  onClick={() => handleAttachmentDownload(attachment)}
                                  disabled={downloadingAttachmentId === attachment.id}
                                  sx={{ mr: 1 }}
                                >
                                  {downloadingAttachmentId === attachment.id ? 'Downloading…' : 'Download'}
                                </Button>
                                <PermissionGate permissions={["DELETE_PROJECT_ATTACHMENTS", "MANAGE_PROJECT_ATTACHMENTS", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleAttachmentDelete(attachment)}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </PermissionGate>
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
                </PermissionGate>
              </TabPanel>

              {/* Sections Tab */}
              <TabPanel value={tabValue} index={3}>
                <PermissionGate 
                  permission="VIEW_SECTIONS" 
                  showError 
                  errorMessage="You do not have permission to see Sections, please contact your system administrator."
                >
                  <Box sx={{ mb: 3 }}>
                    {/* Title and Add Section */}
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                      <SectionIcon sx={{ mr: 1 }} />
                      Sections
                    </Typography>

                    {/* Add Sections */}
                    <PermissionGate permissions={["MANAGE_PROJECTS", "SYSTEM_ADMIN"]}>
                      <SectionAddManager
                        sectionsConnected={sections}
                        onAddMany={async (ids) => {
                          await handleBulkAddSections(ids, handleAddSection);
                        }}
                      />
                    </PermissionGate>

                    <Divider sx={{ my: 3 }} />

                    {/* Connected Sections Section */}
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                      Connected Sections
                    </Typography>

                    {/* Search bar for connected sections */}
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search connected sections..."
                      value={sectionsSearchTerm}
                      onChange={(e) => {
                        setSectionsSearchTerm(e.target.value);
                        setSectionsPage(0); // Reset to first page on search
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                        endAdornment: sectionsSearchTerm && (
                          <InputAdornment position="end">
                            <IconButton 
                              size="small" 
                              onClick={() => {
                                setSectionsSearchTerm('');
                                setSectionsPage(0);
                              }}
                            >
                              <ClearIcon />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                      sx={{ mb: 2 }}
                    />

                    {sections.length > 0 ? (
                      <>
                        <List>
                          {sections
                            .filter((section) => {
                              if (!sectionsSearchTerm) return true;
                              const searchLower = sectionsSearchTerm.toLowerCase();
                              const code = section.code || '';
                              return (
                                code.toLowerCase().includes(searchLower) ||
                                section.id.toString().includes(searchLower)
                              );
                            })
                            .slice(
                              sectionsPage * sectionsRowsPerPage,
                              sectionsPage * sectionsRowsPerPage + sectionsRowsPerPage
                            )
                            .map((section) => (
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
                                <PermissionGate permissions={["MANAGE_PROJECTS", "SYSTEM_ADMIN"]}>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoveSection(section.id)}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </PermissionGate>
                              </ListItem>
                            ))}
                        </List>
                        <TablePagination
                          component="div"
                          count={sections.filter((section) => {
                            if (!sectionsSearchTerm) return true;
                            const searchLower = sectionsSearchTerm.toLowerCase();
                            const code = section.code || '';
                            return (
                              code.toLowerCase().includes(searchLower) ||
                              section.id.toString().includes(searchLower)
                            );
                          }).length}
                          page={sectionsPage}
                          onPageChange={(event, newPage) => setSectionsPage(newPage)}
                          rowsPerPage={sectionsRowsPerPage}
                          onRowsPerPageChange={(event) => {
                            setSectionsRowsPerPage(parseInt(event.target.value, 10));
                            setSectionsPage(0);
                          }}
                          rowsPerPageOptions={[5, 10, 20]}
                        />
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No sections connected yet.
                      </Typography>
                    )}
                  </Box>
                </PermissionGate>
              </TabPanel>
            </>
          )}
        </Box>
      </Paper>

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
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Are you sure you want to delete this {deleteType}? This action cannot be undone.
            </Typography>
          </Alert>

          {itemToDelete && deleteType === 'image' && (
            <Box sx={{ display: 'flex', gap: 2 }}>
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
                />
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
                  {itemToDelete.file_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ID: {itemToDelete.id}
                </Typography>
              </Box>
            </Box>
          )}

          {itemToDelete && deleteType === 'attachment' && (
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
                  ID: {itemToDelete.id}
                </Typography>
              </Box>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
            <Button
              onClick={handleDeleteCancel}
              variant="outlined"
              disabled={deleting}
              sx={{ minWidth: 100 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              variant="contained"
              color="error"
              disabled={deleting}
              startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
              sx={{ minWidth: 100 }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Image Upload Dialog */}
      <PermissionGate permissions={["UPLOAD_PROJECT_IMAGES", "MANAGE_PROJECT_IMAGES", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}>
        <Dialog open={imageUploadOpen} onClose={() => !uploadLoading && setImageUploadOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Upload Project Image</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
              <Box>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="image-upload-input"
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setUploadFile(file);
                    }
                  }}
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
              
              {uploadFile && (
                <Box 
                  sx={{ 
                    position: 'relative',
                    width: '100%', 
                    maxHeight: 300,
                    overflow: 'hidden',
                    borderRadius: 2,
                    border: '2px solid #e0e0e0',
                    bgcolor: '#f5f5f5'
                  }}
                >
                  <Box
                    component="img"
                    src={URL.createObjectURL(uploadFile)}
                    alt="Preview"
                    sx={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: 300,
                      objectFit: 'contain'
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setUploadFile(null);
                      const fileInput = document.getElementById('image-upload-input');
                      if (fileInput) {
                        fileInput.value = '';
                      }
                    }}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      bgcolor: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.8)'
                      }
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
              
              <FormControl fullWidth>
                <InputLabel>Image Category</InputLabel>
                <Select
                  value={imageCategory}
                  onChange={(e) => setImageCategory(e.target.value)}
                  label="Image Category"
                >
                  {imageCategories.map((category) => (
                    <MenuItem key={category.id} value={category.code}>
                      {getCategoryDisplayName(category)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>Language (Optional)</InputLabel>
                <Select
                  value={imageLanguage}
                  onChange={(e) => setImageLanguage(e.target.value)}
                  label="Language (Optional)"
                  disabled={uploadLoading || languagesLoading}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {availableLanguages.map((language) => (
                    <MenuItem key={language.id} value={language.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {language.image && (
                          <Box
                            component="img"
                            src={`${SERVER_URL}/uploads/${language.image.replace(/^.*language_images\//, "language_images/")}`}
                            alt={language.name}
                            sx={{ width: 24, height: 16, border: '1px solid #eee', borderRadius: 0.5, objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <Typography>{language.name}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImageUploadOpen(false)} disabled={uploadLoading}>Cancel</Button>
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
      </PermissionGate>

      {/* Edit Image Dialog */}
      <PermissionGate permissions={["EDIT_PROJECT_IMAGES", "MANAGE_PROJECT_IMAGES", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}>
        <Dialog open={editImageOpen} onClose={() => !editLoading && setEditImageOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Image</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              {selectedImageForEdit && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Current Image
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                    <Box
                      component="img"
                      src={selectedImageForEdit.image_url 
                        ? `${SERVER_URL}${selectedImageForEdit.image_url}` 
                        : (selectedImageForEdit.file_url 
                            ? `${SERVER_URL}${selectedImageForEdit.file_url}`
                            : `${SERVER_URL}/static/${selectedImageForEdit.image_path || selectedImageForEdit.file_path || ''}`)}
                      alt={selectedImageForEdit.file_name || selectedImageForEdit.image_path?.split('/').pop() || 'Image'}
                      sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1 }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<div style="width:80px;height:80px;display:flex;align-items:center;justify-content:center;background:#eee;border-radius:4px;">No Preview</div>';
                      }}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {selectedImageForEdit.file_name || selectedImageForEdit.image_path?.split('/').pop() || 'Unnamed file'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Category: {selectedImageForEdit.category || 'None'}
                      </Typography>
                      {selectedImageForEdit.language && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Language: {selectedImageForEdit.language.name}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              )}
              
              <Box>
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                  startIcon={<CloudUploadIcon />}
                  sx={{ mb: 1 }}
                >
                  Replace Image File
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setReplacementImageFile(file);
                        // Auto-fill filename if empty
                        if (!editImageFileName.trim()) {
                          setEditImageFileName(file.name);
                        }
                      }
                    }}
                  />
                </Button>
                {replacementImageFile && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    New file selected: {replacementImageFile.name}
                  </Alert>
                )}
              </Box>
              
              <TextField
                label="File Name"
                value={editImageFileName}
                onChange={(e) => setEditImageFileName(e.target.value)}
                fullWidth
                required
                disabled={editLoading}
                helperText="Display name for the image"
              />
              
              <FormControl fullWidth>
                <InputLabel>Language (Optional)</InputLabel>
                <Select
                  value={editImageLanguage}
                  onChange={(e) => setEditImageLanguage(e.target.value)}
                  label="Language (Optional)"
                  disabled={editLoading || languagesLoading}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {availableLanguages.map((language) => (
                    <MenuItem key={language.id} value={language.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {language.image && (
                          <Box
                            component="img"
                            src={`${SERVER_URL}/uploads/${language.image.replace(/^.*language_images\//, "language_images/")}`}
                            alt={language.name}
                            sx={{ width: 24, height: 16, border: '1px solid #eee', borderRadius: 0.5, objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <Typography>{language.name}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={editImageCategory}
                  onChange={(e) => setEditImageCategory(e.target.value)}
                  label="Category"
                  disabled={editLoading}
                >
                  {imageCategories.map((category) => (
                    <MenuItem key={category.id} value={category.code}>
                      {getCategoryDisplayName(category)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditImageOpen(false)} disabled={editLoading}>Cancel</Button>
            <Button
              onClick={handleImageUpdate}
              variant="contained"
              disabled={editLoading}
              startIcon={editLoading ? <CircularProgress size={16} /> : <EditIcon />}
            >
              {editLoading ? 'Updating...' : replacementImageFile ? 'Replace Image' : 'Update'}
            </Button>
          </DialogActions>
        </Dialog>
      </PermissionGate>

      {/* Image Preview Dialog */}
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

          {previewImage && (
            <>
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
                  {previewImage.created_at && (
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {new Date(previewImage.created_at).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
              </Box>

              <Box
                component="img"
                src={previewImage.image_url ? `${SERVER_URL}${previewImage.image_url}` : 
                     (previewImage.image_path.startsWith('static/') 
                      ? `${SERVER_URL}/${previewImage.image_path}` 
                      : `${SERVER_URL}/static/${previewImage.image_path}`)}
                alt={`Project image ${previewImage.category}`}
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
            </>
          )}
        </Box>
      </Dialog>

      {/* Attachment Upload Dialog */}
      <PermissionGate permissions={["UPLOAD_PROJECT_ATTACHMENTS", "MANAGE_PROJECT_ATTACHMENTS", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}>
        <Dialog open={attachmentUploadOpen} onClose={() => !uploadLoading && setAttachmentUploadOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Upload Project Attachment</DialogTitle>
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
              
              <FormControl fullWidth>
                <InputLabel>Language (Optional)</InputLabel>
                <Select
                  value={attachmentLanguage}
                  onChange={(e) => setAttachmentLanguage(e.target.value)}
                  label="Language (Optional)"
                  disabled={uploadLoading || languagesLoading}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {languagesLoading ? (
                    <MenuItem disabled>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      <em>Loading languages...</em>
                    </MenuItem>
                  ) : availableLanguages.length === 0 ? (
                    <MenuItem disabled><em>No languages available</em></MenuItem>
                  ) : (
                    availableLanguages.map((language) => (
                      <MenuItem key={language.id} value={language.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {language.image && (
                            <Box
                              component="img"
                              src={`${SERVER_URL}/uploads/${language.image.replace(/^.*language_images\//, "language_images/")}`}
                              alt={language.name}
                              sx={{ width: 24, height: 16, border: '1px solid #eee', borderRadius: 0.5, objectFit: 'cover' }}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          <Typography>{language.name}</Typography>
                        </Box>
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>Category (Optional)</InputLabel>
                <Select
                  value={attachmentCategory}
                  onChange={(e) => setAttachmentCategory(e.target.value)}
                  label="Category (Optional)"
                  disabled={uploadLoading || categoriesLoading}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {categoriesLoading ? (
                    <MenuItem disabled>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      <em>Loading categories...</em>
                    </MenuItem>
                  ) : attachmentCategories.length === 0 ? (
                    <MenuItem disabled><em>No categories available</em></MenuItem>
                  ) : (
                    attachmentCategories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {getCategoryDisplayName(category)}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
              
              {attachmentCategory && attachmentCategories.find(c => c.id === parseInt(attachmentCategory))?.type_code === 'RESU' && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={setAsDefaultResume}
                      onChange={(e) => setSetAsDefaultResume(e.target.checked)}
                      disabled={uploadLoading}
                    />
                  }
                  label="Set as default resume (for website download button)"
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAttachmentUploadOpen(false)} disabled={uploadLoading}>Cancel</Button>
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
      </PermissionGate>

      {/* Edit Attachment Dialog */}
      <PermissionGate permissions={["MANAGE_PROJECT_ATTACHMENTS", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]}>
        <Dialog open={editAttachmentOpen} onClose={() => !editLoading && setEditAttachmentOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Attachment</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>File:</strong> {selectedAttachment?.file_name}
              </Typography>
              
              <FormControl fullWidth>
                <InputLabel>Language (Optional)</InputLabel>
                <Select
                  value={editAttachmentLanguage}
                  onChange={(e) => setEditAttachmentLanguage(e.target.value)}
                  label="Language (Optional)"
                  disabled={editLoading || languagesLoading}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {languagesLoading ? (
                    <MenuItem disabled>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      <em>Loading languages...</em>
                    </MenuItem>
                  ) : availableLanguages.length === 0 ? (
                    <MenuItem disabled><em>No languages available</em></MenuItem>
                  ) : (
                    availableLanguages.map((language) => (
                      <MenuItem key={language.id} value={language.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {language.image && (
                            <Box
                              component="img"
                              src={`${SERVER_URL}/uploads/${language.image.replace(/^.*language_images\//, "language_images/")}`}
                              alt={language.name}
                              sx={{ width: 24, height: 16, border: '1px solid #eee', borderRadius: 0.5, objectFit: 'cover' }}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          <Typography>{language.name}</Typography>
                        </Box>
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>Category (Optional)</InputLabel>
                <Select
                  value={editAttachmentCategory}
                  onChange={(e) => setEditAttachmentCategory(e.target.value)}
                  label="Category (Optional)"
                  disabled={editLoading || categoriesLoading}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {categoriesLoading ? (
                    <MenuItem disabled>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      <em>Loading categories...</em>
                    </MenuItem>
                  ) : attachmentCategories.length === 0 ? (
                    <MenuItem disabled><em>No categories available</em></MenuItem>
                  ) : (
                    attachmentCategories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {getCategoryDisplayName(category)}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
              
              {editAttachmentCategory && attachmentCategories.find(c => c.id === parseInt(editAttachmentCategory))?.type_code === 'RESU' && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={editSetAsDefault}
                      onChange={(e) => setEditSetAsDefault(e.target.checked)}
                      disabled={editLoading}
                    />
                  }
                  label="Set as default resume (for website download button)"
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditAttachmentOpen(false)} disabled={editLoading}>Cancel</Button>
            <Button
              onClick={handleAttachmentUpdate}
              variant="contained"
              disabled={editLoading}
              startIcon={editLoading ? <CircularProgress size={16} /> : <EditIcon />}
            >
              {editLoading ? 'Updating...' : 'Update'}
            </Button>
          </DialogActions>
        </Dialog>
      </PermissionGate>

      {/* Section Details Dialog */}
      <Dialog 
        open={sectionModalOpen} 
        onClose={() => setSectionModalOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <LanguageIcon sx={{ mr: 1 }} />
          Section: {selectedSection?.code || `Section ${selectedSection?.id ?? ''}`}
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
    </Container>
  );
}

export default ProjectDataPage;
