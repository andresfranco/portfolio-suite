
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Checkbox,
  FormControlLabel,
  Autocomplete,
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
  TablePagination
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
  Language as LanguageIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { api, projectsApi, experiencesApi, sectionsApi } from '../services/api';
import { useSnackbar } from 'notistack';
import SERVER_URL from '../components/common/BackendServerData';
import PermissionGate from '../components/common/PermissionGate';

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

function PortfolioDataPage() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
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
  // eslint-disable-next-line no-unused-vars
  const [availableExperiences, setAvailableExperiences] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [availableProjects, setAvailableProjects] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [availableSections, setAvailableSections] = useState([]);

  // Upload dialog states
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [attachmentUploadOpen, setAttachmentUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [imageCategory, setImageCategory] = useState('gallery');
  const [imageLanguage, setImageLanguage] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  
  // Attachment category states
  const [attachmentCategory, setAttachmentCategory] = useState('');
  const [attachmentCategories, setAttachmentCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [setAsDefaultResume, setSetAsDefaultResume] = useState(false);
  
  // Attachment language state
  const [attachmentLanguage, setAttachmentLanguage] = useState('');
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [languagesLoading, setLanguagesLoading] = useState(false);

  // Section modal states
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);

  // Category modal states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  // Experience modal states
  const [experienceModalOpen, setExperienceModalOpen] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState(null);

  // Project modal states
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Image rename states
  // eslint-disable-next-line no-unused-vars
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
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  
  // Edit attachment states
  const [editAttachmentOpen, setEditAttachmentOpen] = useState(false);
  const [editAttachmentLanguage, setEditAttachmentLanguage] = useState('');
  const [editAttachmentCategory, setEditAttachmentCategory] = useState('');
  const [editSetAsDefault, setEditSetAsDefault] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Edit image states
  const [editImageOpen, setEditImageOpen] = useState(false);
  const [editImageLanguage, setEditImageLanguage] = useState('');
  const [selectedImageForEdit, setSelectedImageForEdit] = useState(null);
  const [editImageCategory, setEditImageCategory] = useState('');
  const [editImageFileName, setEditImageFileName] = useState('');

  // Pagination states for each tab
  const [categoriesPage, setCategoriesPage] = useState(0);
  const [categoriesRowsPerPage, setCategoriesRowsPerPage] = useState(10);
  const [experiencesPage, setExperiencesPage] = useState(0);
  const [experiencesRowsPerPage, setExperiencesRowsPerPage] = useState(10);
  const [projectsPage, setProjectsPage] = useState(0);
  const [projectsRowsPerPage, setProjectsRowsPerPage] = useState(10);
  const [sectionsPage, setSectionsPage] = useState(0);
  const [sectionsRowsPerPage, setSectionsRowsPerPage] = useState(10);

  // Search states for filtering connected items
  const [categoriesSearchTerm, setCategoriesSearchTerm] = useState('');
  const [experiencesSearchTerm, setExperiencesSearchTerm] = useState('');
  const [projectsSearchTerm, setProjectsSearchTerm] = useState('');
  const [sectionsSearchTerm, setSectionsSearchTerm] = useState('');

  // Edit portfolio overview states
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [savingOverview, setSavingOverview] = useState(false);

  // Fetch portfolio data
  const fetchPortfolioData = useCallback(async () => {
    console.log('============================================');
    console.log('FETCHPORTFOLIODATA FUNCTION CALLED!');
    console.log('portfolioId:', portfolioId);
    console.log('============================================');
    
    if (!portfolioId) {
      console.warn('fetchPortfolioData: No portfolioId, returning early');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('============================================');
      console.log('ABOUT TO MAKE API CALL');
      console.log('URL:', `/api/portfolios/${portfolioId}`);
      console.log('Params:', { include_full_details: true });
      console.log('============================================');
      
      // Fetch portfolio details with all related data (MUST include full_details to load relationships)
      const response = await api.get(`/api/portfolios/${portfolioId}`, { 
        params: { include_full_details: true } 
      });
      
      console.log('============================================');
      console.log('API RESPONSE RECEIVED!');
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);
      console.log('============================================');
      
      const portfolio = response.data;
      
      // Debug: log portfolio data structure
      console.log('Portfolio data received:', portfolio);
      console.log('Portfolio categories:', portfolio.categories);
      console.log('Portfolio experiences:', portfolio.experiences);
      console.log('Portfolio projects:', portfolio.projects);
      console.log('Portfolio sections:', portfolio.sections);
      console.log('Portfolio images:', portfolio.images);
      console.log('Portfolio attachments:', portfolio.attachments);
      
      setPortfolioData(portfolio);
      setCategories(portfolio.categories || []);
      setExperiences(portfolio.experiences || []);
      setProjects(portfolio.projects || []);
      setSections(portfolio.sections || []);
      setImages(portfolio.images || []);
      setAttachments(portfolio.attachments || []);
      
      console.log('============================================');
      console.log('STATE UPDATED SUCCESSFULLY');
      console.log('categories state:', portfolio.categories || []);
      console.log('============================================');
      
    } catch (err) {
      console.error('============================================');
      console.error('ERROR IN FETCHPORTFOLIODATA:');
      console.error('Error object:', err);
      console.error('Error message:', err.message);
      console.error('Error response:', err.response);
      console.error('============================================');
      
      const errorMessage = err.response?.data?.detail || 'Failed to fetch portfolio data';
      setError(errorMessage);
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
    } finally {
      setLoading(false);
      console.log('============================================');
      console.log('FETCHPORTFOLIODATA COMPLETE (finally block)');
      console.log('============================================');
    }
  }, [portfolioId, enqueueSnackbar]);

  // Fetch available options for dropdowns
  const fetchAvailableOptions = useCallback(async () => {
    try {
      const [categoriesRes, experiencesRes, projectsRes, sectionsRes] = await Promise.all([
        api.get('/api/categories/by-type/PORT'),
        api.get('/api/experiences/', { params: { page: 1, page_size: 100 } }),
        api.get('/api/projects/', { params: { page: 1, page_size: 100, include_full_details: true } }),
        api.get('/api/sections/', { params: { page: 1, page_size: 100 } })
      ]);
      
      // Categories by-type endpoint returns array directly
      const rawCategories = categoriesRes.data || [];
      // Ensure only Portfolio-type categories are available (by name or code fallback)
      const portfolioCategories = rawCategories.filter(cat => {
        const byName = cat.category_type?.name && String(cat.category_type.name).toLowerCase() === 'portfolio';
        const byCode = cat.type_code && ['PORT', 'PORTF'].includes(String(cat.type_code).toUpperCase());
        return byName || byCode;
      });
      setAvailableCategories(portfolioCategories);
  setAvailableExperiences(experiencesRes.data.items || experiencesRes.data || []);
  setAvailableProjects(projectsRes.data.items || projectsRes.data || []);
  setAvailableSections(sectionsRes.data.items || sectionsRes.data || []);
      
    } catch (err) {
      console.error('Error fetching available options:', err);
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
      
      // Filter for PDOC and RESU type categories
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

  // Fetch available languages
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
      setAvailableLanguages(data.items || data || []);
    } catch (error) {
      console.error('Error fetching languages:', error);
      setAvailableLanguages([]);
    } finally {
      setLanguagesLoading(false);
    }
  }, []);

  // Initialize data on component mount
  useEffect(() => {
    console.log('PortfolioDataPage mounted with portfolioId:', portfolioId);
    if (portfolioId) {
      console.log('Calling fetchPortfolioData...');
      fetchPortfolioData();
      console.log('Calling fetchAvailableOptions...');
      fetchAvailableOptions();
      console.log('Calling fetchAttachmentCategories...');
      fetchAttachmentCategories();
      console.log('Calling fetchLanguages...');
      fetchLanguages();
    } else {
      console.warn('No portfolioId provided to PortfolioDataPage!');
    }
  }, [portfolioId, fetchPortfolioData, fetchAvailableOptions, fetchAttachmentCategories, fetchLanguages]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Back handler
  const handleBack = () => {
    navigate('/portfolios');
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
      console.log('Uploading image with:', { 
        portfolioId, 
        fileName: uploadFile.name, 
        category: imageCategory, 
        languageId: imageLanguage,
        languageIdType: typeof imageLanguage
      });
      // Ensure languageId is a number or null
      const languageIdToSend = imageLanguage ? parseInt(imageLanguage, 10) : null;
      console.log('Parsed languageId:', languageIdToSend, 'Type:', typeof languageIdToSend);
      await projectsApi.uploadPortfolioImage(portfolioId, uploadFile, imageCategory, languageIdToSend);
      await fetchPortfolioData();
      enqueueSnackbar('Image uploaded successfully', { variant: 'success' });
      setImageUploadOpen(false);
      setUploadFile(null);
      setImageCategory('gallery');
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

  // Image rename functionality (currently unused, reserved for future feature)
  // eslint-disable-next-line no-unused-vars
  const handleImageRename = (image) => {
    setSelectedImage(image);
    setNewImageName(image.file_name);
    setRenameDialogOpen(true);
  };

  // eslint-disable-next-line no-unused-vars
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

  // eslint-disable-next-line no-unused-vars
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
      await projectsApi.uploadPortfolioAttachment(
        portfolioId, 
        uploadFile,
        attachmentCategory || null,
        setAsDefaultResume,
        attachmentLanguage || null
      );
      await fetchPortfolioData();
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
  
  // Helper to get category display name
  const getCategoryDisplayName = (category) => {
    if (!category) return '';
    
    // Try to get English name from texts array
    if (category.texts && Array.isArray(category.texts)) {
      const englishText = category.texts.find(t => t.language?.code === 'en' || t.language_id === 1);
      if (englishText?.name) return englishText.name;
    }
    
    // Try category_texts array (alternative structure)
    if (category.category_texts && Array.isArray(category.category_texts)) {
      const englishText = category.category_texts.find(t => t.language?.code === 'en' || t.language_id === 1);
      if (englishText?.name) return englishText.name;
    }
    
    // Fallback to name or code
    return category.name || category.code || `Category ${category.id}`;
  };

  const handleAttachmentDelete = (attachment) => {
    setItemToDelete(attachment);
    setDeleteType('attachment');
    setDeleteDialogOpen(true);
  };

  // Force file download without opening a new tab
  const handleAttachmentDownload = async (attachment) => {
    if (!attachment) return;
    try {
      setDownloadingAttachmentId(attachment.id);
      const url = attachment.file_url
        ? `${SERVER_URL}${attachment.file_url}`
        : (attachment.file_path.startsWith('static/')
            ? `${SERVER_URL}/${attachment.file_path}`
            : `${SERVER_URL}/static/${attachment.file_path}`);

      // Cookies are sent automatically with credentials: 'include'
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }
      const blob = await response.blob();

      // Try to get filename from Content-Disposition, fallback to attachment.file_name
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
      // Fallback: attempt basic anchor download
      try {
        const fallbackUrl = attachment.file_url
          ? `${SERVER_URL}${attachment.file_url}`
          : (attachment.file_path.startsWith('static/')
              ? `${SERVER_URL}/${attachment.file_path}`
              : `${SERVER_URL}/static/${attachment.file_path}`);
        const a = document.createElement('a');
        a.href = fallbackUrl;
        a.download = attachment.file_name || '';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (_) {
        // ignore
      }
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  // Edit attachment handlers
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
      
      // Debug: log what we're sending
      console.log('Updating attachment:', {
        portfolioId,
        attachmentId: selectedAttachment.id,
        categoryId: editAttachmentCategory || null,
        isDefault: editSetAsDefault,
        languageId: editAttachmentLanguage || null
      });
      
      await projectsApi.updatePortfolioAttachment(
        portfolioId,
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
      await fetchPortfolioData();
    } catch (err) {
      console.error('Update attachment error:', err);
      console.error('Error response:', err.response?.data);
      enqueueSnackbar(err.response?.data?.detail || 'Failed to update attachment', { variant: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  // Edit image handlers
  const handleEditImage = (image) => {
    setSelectedImageForEdit(image);
    setEditImageFileName(image.file_name || '');
    setEditImageCategory(image.category || '');
    setEditImageLanguage(image.language_id || image.language?.id || '');
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
      
      // Debug: log what we're sending
      console.log('Updating image:', {
        portfolioId,
        imageId: selectedImageForEdit.id,
        fileName: editImageFileName.trim(),
        category: editImageCategory || null,
        languageId: editImageLanguage || null
      });
      
      // Single API call with all updates
      await projectsApi.renamePortfolioImage(portfolioId, selectedImageForEdit.id, {
        file_name: editImageFileName.trim(),
        category: editImageCategory || null,
        language_id: editImageLanguage || null
      });
      
      enqueueSnackbar('Image updated successfully', { variant: 'success' });
      setEditImageOpen(false);
      setSelectedImageForEdit(null);
      setEditImageFileName('');
      setEditImageCategory('');
      setEditImageLanguage('');
      await fetchPortfolioData();
    } catch (err) {
      console.error('Update image error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error detail:', JSON.stringify(err.response?.data?.detail, null, 2));
      const errorMsg = Array.isArray(err.response?.data?.detail) 
        ? err.response.data.detail.map(e => e.msg || e).join(', ')
        : err.response?.data?.detail || 'Failed to update image';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  // Section modal handlers
  const handleViewSection = (section) => {
    setSelectedSection(section);
    setSectionModalOpen(true);
  };

  // Category modal handlers
  const handleViewCategory = (category) => {
    setSelectedCategory(category);
    setCategoryModalOpen(true);
  };

  // Experience modal handlers
  const handleViewExperience = (experience) => {
    setSelectedExperience(experience);
    setExperienceModalOpen(true);
  };

  // Project modal handlers
  const handleViewProject = (project) => {
    setSelectedProject(project);
    setProjectModalOpen(true);
  };

  // Portfolio overview edit handlers
  const handleEditOverview = () => {
    setEditedName(portfolioData?.name || '');
    setEditedDescription(portfolioData?.description || '');
    setIsEditingOverview(true);
  };

  const handleCancelEditOverview = () => {
    setIsEditingOverview(false);
    setEditedName('');
    setEditedDescription('');
  };

  const handleSaveOverview = async () => {
    if (!editedName.trim()) {
      enqueueSnackbar('Portfolio name is required', { variant: 'error' });
      return;
    }

    try {
      setSavingOverview(true);
      await api.put(`/api/portfolios/${portfolioId}`, {
        name: editedName.trim(),
        description: editedDescription.trim() || null
      });
      
      enqueueSnackbar('Portfolio updated successfully', { variant: 'success' });
      setIsEditingOverview(false);
      await fetchPortfolioData();
    } catch (err) {
      console.error('Update portfolio error:', err);
      const errorMsg = err.response?.data?.detail || 'Failed to update portfolio';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    } finally {
      setSavingOverview(false);
    }
  };

  // Bulk operations
  const handleBulkAdd = async (itemIds, addHandler) => {
    try {
      const promises = itemIds.map(id => addHandler(id));
      await Promise.all(promises);
      // Don't show bulk success message - individual handlers already show messages
      // enqueueSnackbar(`${itemIds.length} items added successfully`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to add some items', { variant: 'error' });
    }
  };

  const handleBulkRemove = async (itemIds, removeHandler) => {
    try {
      const promises = itemIds.map(id => removeHandler(id));
      await Promise.all(promises);
      // Don't show bulk success message - individual handlers already show messages
      // enqueueSnackbar(`${itemIds.length} items removed successfully`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to remove some items', { variant: 'error' });
    }
  };

  // Generic component for managing associations (currently unused, can be used for refactoring tabs)
  // eslint-disable-next-line no-unused-vars
  const AssociationManager = ({ 
    title, 
    icon, 
    items, 
    availableItems, 
    onAdd, 
    onRemove, 
    getItemLabel,
    getItemId,
    defaultShowConnected,
    page,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange
  }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    const [showConnected, setShowConnected] = useState(
      typeof defaultShowConnected === 'boolean' ? defaultShowConnected : true
    );
    
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

    // Pagination
    const currentItems = showConnected ? filteredConnected : filteredAvailable;
    const paginatedItems = currentItems.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    
    // Handle search input change
    const handleSearchChange = (event) => {
      setSearchTerm(event.target.value);
      setSelectedItems([]); // Clear selections when search changes
      onPageChange(null, 0); // Reset to first page
    };

    // Handle individual item selection
    const handleItemSelect = (itemId) => {
      setSelectedItems(prev => 
        prev.includes(itemId) 
          ? prev.filter(id => id !== itemId)
          : [...prev, itemId]
      );
    };

    // Handle select all/none (only for current page)
    const handleSelectAll = () => {
      const currentPageIds = paginatedItems.map(item => getItemId(item));
      
      if (selectedItems.length === currentPageIds.length && currentPageIds.every(id => selectedItems.includes(id))) {
        setSelectedItems([]);
      } else {
        setSelectedItems(currentPageIds);
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
      onPageChange(null, 0);
    };

    const currentIds = paginatedItems.map(item => getItemId(item));
    const allSelected = selectedItems.length > 0 && currentIds.every(id => selectedItems.includes(id));
    // eslint-disable-next-line no-unused-vars
    const someSelected = selectedItems.length > 0 && !allSelected;

    return (
      <Card sx={{ mb: 3 }}>
        <CardHeader
          avatar={<Avatar sx={{ bgcolor: '#1976d2' }}>{icon}</Avatar>}
          title={title}
          subheader={`${items.length} ${title.toLowerCase()} connected • ${availableToAdd.length} available to add`}
        />
        <CardContent>
          {/* Search and Controls - TOP */}
          <Box sx={{ mb: 2 }}>
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
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showConnected}
                        onChange={(e) => {
                          setShowConnected(e.target.checked);
                          setSelectedItems([]);
                          onPageChange(null, 0);
                        }}
                        size="small"
                      />
                    }
                    label="Show connected"
                    sx={{ mr: 2 }}
                  />
                  {paginatedItems.length > 0 && (
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

          <Divider sx={{ mb: 2 }} />

          {/* Items Display */}
          {currentItems.length > 0 ? (
            <>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, minHeight: 100 }}>
                {paginatedItems.map((item) => {
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
              
              {/* Pagination */}
              <TablePagination
                component="div"
                count={currentItems.length}
                page={page}
                onPageChange={onPageChange}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={onRowsPerPageChange}
                rowsPerPageOptions={[5, 10, 20]}
                sx={{ mt: 2, borderTop: 1, borderColor: 'divider' }}
              />
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              {searchTerm 
                ? `No ${title.toLowerCase()} found matching "${searchTerm}"`
                : showConnected 
                  ? `No ${title.toLowerCase()} connected yet.`
                  : `All available ${title.toLowerCase()} are already connected.`
              }
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  // Multi-select add manager for Categories
  const CategoryAddManager = ({ categories, availableCategories, onAddMany }) => {
    const [selectedOptions, setSelectedOptions] = useState([]);

    const connectedIds = categories.map(c => c.id);
    const options = (availableCategories || []).filter(opt => !connectedIds.includes(opt.id));

    const getLabel = (item) => item?.category_texts?.[0]?.name || item?.code || `Category ${item?.id}`;

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
            Add Categories ({options.length} available)
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
          options={options}
          value={selectedOptions}
          onChange={(e, newValue) => setSelectedOptions(newValue)}
          getOptionLabel={getLabel}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          filterSelectedOptions
          size="small"
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder="Search categories to add..."
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
        {options.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
            All available categories are already connected.
          </Typography>
        )}
      </Box>
    );
  };

  // Multi-select add manager for Experiences (loads all, client filters)
  const ExperienceAddManager = ({ experiences, onAddMany }) => {
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [options, setOptions] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(false);

    const connectedIds = experiences.map(e => e.id);
    const filteredOptions = (options || []).filter(opt => !connectedIds.includes(opt.id));

    const getLabel = (item) => item?.experience_texts?.[0]?.name || item?.code || `Experience ${item?.id}`;

    const loadAll = async () => {
      try {
        setLoadingOptions(true);
        const res = await experiencesApi.getExperiences({ page: 1, page_size: 100 });
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
          // Use backend filters (name contains)
          const params = { page: 1, page_size: 100, name: value };
          const res = await experiencesApi.getExperiences(params);
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
            Add Experiences ({filteredOptions.length} available)
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
              placeholder="Search experiences to add..."
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
            All available experiences are already connected.
          </Typography>
        )}
      </Box>
    );
  };

  // Multi-select add manager for Projects
  const ProjectAddManager = ({ projects, onAddMany }) => {
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [options, setOptions] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(false);

    const connectedIds = projects.map(p => p.id);
    const filteredOptions = (options || []).filter(opt => !connectedIds.includes(opt.id));

    const getLabel = (item) => item?.project_texts?.[0]?.name || item?.project_texts?.[0]?.title || item?.code || `Project ${item?.id}`;

    const loadAll = async () => {
      try {
        setLoadingOptions(true);
        const res = await projectsApi.getProjects({ page: 1, page_size: 100, include_full_details: true });
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
          // Backend accepts name_filter or legacy name
          const res = await projectsApi.getProjects({ page: 1, page_size: 100, include_full_details: true, name_filter: value });
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
            Add Projects ({filteredOptions.length} available)
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
              placeholder="Search projects to add..."
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
            All available projects are already connected.
          </Typography>
        )}
      </Box>
    );
  };

  // Multi-select add manager for Sections
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
          // Backend supports code or text filters; use filter_field/value pairs
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
            All available sections are already connected.
          </Typography>
        )}
      </Box>
    );
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
                {portfolioData?.name || `Portfolio #${portfolioId}`}
            </Typography>
            <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
            >
                Back to Portfolios
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
          <Tab icon={<CategoryIcon />} label="Categories" />
          <Tab icon={<WorkIcon />} label="Experiences" />
          <Tab icon={<ProjectIcon />} label="Projects" />
          <Tab icon={<SectionIcon />} label="Sections" />
          <Tab icon={<PhotoLibraryIcon />} label="Images" />
          <Tab icon={<AttachFileIcon />} label="Attachments" />
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
                permission="VIEW_PORTFOLIOS" 
                showError 
                errorMessage="You do not have permission to see Portfolio information, please contact your system administrator."
              >
                <Box sx={{ mb: 3 }}>
                  {/* Title and Edit Section */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                      <InfoIcon sx={{ mr: 1 }} />
                      Overview
                    </Typography>
                    <PermissionGate permission="EDIT_PORTFOLIO">
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
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" color="text.secondary">ID</Typography>
                          <Typography variant="body1" sx={{ mb: 2 }}>{portfolioData?.id || '-'}</Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                          {isEditingOverview ? (
                            <TextField
                              fullWidth
                              value={editedName}
                              onChange={(e) => setEditedName(e.target.value)}
                              placeholder="Portfolio name"
                              size="small"
                              sx={{ mt: 1 }}
                              required
                            />
                          ) : (
                            <Typography variant="body1" sx={{ mb: 2 }}>{portfolioData?.name || '-'}</Typography>
                          )}
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                          {isEditingOverview ? (
                            <TextField
                              fullWidth
                              multiline
                              rows={4}
                              value={editedDescription}
                              onChange={(e) => setEditedDescription(e.target.value)}
                              placeholder="Portfolio description"
                              size="small"
                              sx={{ mt: 1 }}
                            />
                          ) : (
                            <Typography variant="body1" sx={{ mb: 2 }}>
                              {portfolioData?.description || 'No description provided'}
                            </Typography>
                          )}
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
                </Box>
              </PermissionGate>
            </TabPanel>

            {/* Categories Tab */}
            <TabPanel value={tabValue} index={1}>
              <PermissionGate 
                permission="VIEW_CATEGORIES" 
                showError 
                errorMessage="You do not have permission to see Categories, please contact your system administrator."
              >
                <Box sx={{ mb: 3 }}>
                  {/* Title and Add Section */}
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                    <CategoryIcon sx={{ mr: 1 }} />
                    Categories
                  </Typography>

                  {/* Add Categories using multi-select search */}
                  <PermissionGate permissions={["EDIT_PORTFOLIO", "VIEW_CATEGORIES"]} requireAll>
                    <CategoryAddManager
                      categories={categories}
                      availableCategories={availableCategories}
                      onAddMany={async (ids) => {
                        await handleBulkAdd(ids, handleAddCategory);
                      }}
                    />
                  </PermissionGate>

                  <Divider sx={{ my: 3 }} />

                  {/* Connected Categories Section */}
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Connected Categories
                  </Typography>
                  
                  {/* Search bar for connected categories */}
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search connected categories..."
                    value={categoriesSearchTerm}
                    onChange={(e) => {
                      setCategoriesSearchTerm(e.target.value);
                      setCategoriesPage(0); // Reset to first page on search
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                      endAdornment: categoriesSearchTerm && (
                        <InputAdornment position="end">
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              setCategoriesSearchTerm('');
                              setCategoriesPage(0);
                            }}
                          >
                            <ClearIcon />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    sx={{ mb: 2 }}
                  />

                  {categories.length > 0 ? (
                    <>
                      <List>
                        {categories
                          .filter((cat) => {
                            if (!categoriesSearchTerm) return true;
                            const searchLower = categoriesSearchTerm.toLowerCase();
                            const name = cat.category_texts?.[0]?.name || cat.code || '';
                            const typeCode = cat.type_code || '';
                            return (
                              name.toLowerCase().includes(searchLower) ||
                              typeCode.toLowerCase().includes(searchLower) ||
                              cat.id.toString().includes(searchLower) ||
                              // Search in all language texts
                              cat.category_texts?.some(text => 
                                text.name?.toLowerCase().includes(searchLower)
                              )
                            );
                          })
                          .slice(
                            categoriesPage * categoriesRowsPerPage,
                            categoriesPage * categoriesRowsPerPage + categoriesRowsPerPage
                          )
                          .map((cat) => {
                            const name = cat.category_texts?.[0]?.name || cat.code || `Category ${cat.id}`;
                            return (
                              <ListItem key={cat.id} divider>
                                <ListItemIcon>
                                  <CategoryIcon />
                                </ListItemIcon>
                                <ListItemText
                                  primary={name}
                                  secondary={`ID: ${cat.id}${cat.type_code ? ` • Type: ${cat.type_code}` : ''}`}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewCategory(cat)}
                                  sx={{ mr: 1 }}
                                >
                                  <VisibilityIcon />
                                </IconButton>
                                <PermissionGate permission="EDIT_PORTFOLIO">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoveCategory(cat.id)}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </PermissionGate>
                              </ListItem>
                            );
                          })}
                      </List>
                      <TablePagination
                        component="div"
                        count={categories.filter((cat) => {
                          if (!categoriesSearchTerm) return true;
                          const searchLower = categoriesSearchTerm.toLowerCase();
                          const name = cat.category_texts?.[0]?.name || cat.code || '';
                          const typeCode = cat.type_code || '';
                          return (
                            name.toLowerCase().includes(searchLower) ||
                            typeCode.toLowerCase().includes(searchLower) ||
                            cat.id.toString().includes(searchLower) ||
                            cat.category_texts?.some(text => 
                              text.name?.toLowerCase().includes(searchLower)
                            )
                          );
                        }).length}
                        page={categoriesPage}
                        onPageChange={(event, newPage) => setCategoriesPage(newPage)}
                        rowsPerPage={categoriesRowsPerPage}
                        onRowsPerPageChange={(event) => {
                          setCategoriesRowsPerPage(parseInt(event.target.value, 10));
                          setCategoriesPage(0);
                        }}
                        rowsPerPageOptions={[5, 10, 20]}
                      />
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No categories connected yet.
                    </Typography>
                  )}
                </Box>
              </PermissionGate>
            </TabPanel>

            {/* Experiences Tab */}
            <TabPanel value={tabValue} index={2}>
              <PermissionGate 
                permission="VIEW_EXPERIENCES" 
                showError 
                errorMessage="You do not have permission to see Experiences, please contact your system administrator."
              >
                <Box sx={{ mb: 3 }}>
                  {/* Title and Add Section */}
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                    <WorkIcon sx={{ mr: 1 }} />
                    Experiences
                  </Typography>

                  {/* Add Experiences */}
                  <PermissionGate permissions={["EDIT_PORTFOLIO", "VIEW_EXPERIENCES"]} requireAll>
                    <ExperienceAddManager
                      experiences={experiences}
                      onAddMany={async (ids) => {
                        await handleBulkAdd(ids, handleAddExperience);
                      }}
                    />
                  </PermissionGate>

                  <Divider sx={{ my: 3 }} />

                  {/* Connected Experiences Section */}
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Connected Experiences
                  </Typography>

                  {/* Search bar for connected experiences */}
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search connected experiences..."
                    value={experiencesSearchTerm}
                    onChange={(e) => {
                      setExperiencesSearchTerm(e.target.value);
                      setExperiencesPage(0); // Reset to first page on search
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                      endAdornment: experiencesSearchTerm && (
                        <InputAdornment position="end">
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              setExperiencesSearchTerm('');
                              setExperiencesPage(0);
                            }}
                          >
                            <ClearIcon />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    sx={{ mb: 2 }}
                  />

                  {experiences.length > 0 ? (
                    <>
                      <List>
                        {experiences
                          .filter((exp) => {
                            if (!experiencesSearchTerm) return true;
                            const searchLower = experiencesSearchTerm.toLowerCase();
                            const name = exp.experience_texts?.[0]?.name || exp.code || '';
                            const years = exp.years ? exp.years.toString() : '';
                            return (
                              name.toLowerCase().includes(searchLower) ||
                              exp.code?.toLowerCase().includes(searchLower) ||
                              years.includes(searchLower) ||
                              exp.id.toString().includes(searchLower) ||
                              // Search in all language texts
                              exp.experience_texts?.some(text => 
                                text.name?.toLowerCase().includes(searchLower)
                              )
                            );
                          })
                          .slice(
                            experiencesPage * experiencesRowsPerPage,
                            experiencesPage * experiencesRowsPerPage + experiencesRowsPerPage
                          )
                          .map((exp) => {
                            const base = exp.experience_texts?.[0]?.name || exp.code || `Experience ${exp.id}`;
                            const years = exp.years ? ` (${exp.years} years)` : '';
                            const label = `${base}${years}`;
                            return (
                              <ListItem key={exp.id} divider>
                                <ListItemIcon>
                                  <WorkIcon />
                                </ListItemIcon>
                                <ListItemText
                                  primary={label}
                                  secondary={`ID: ${exp.id}`}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewExperience(exp)}
                                  sx={{ mr: 1 }}
                                >
                                  <VisibilityIcon />
                                </IconButton>
                                <PermissionGate permission="EDIT_PORTFOLIO">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoveExperience(exp.id)}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </PermissionGate>
                              </ListItem>
                            );
                          })}
                      </List>
                      <TablePagination
                        component="div"
                        count={experiences.filter((exp) => {
                          if (!experiencesSearchTerm) return true;
                          const searchLower = experiencesSearchTerm.toLowerCase();
                          const name = exp.experience_texts?.[0]?.name || exp.code || '';
                          const years = exp.years ? exp.years.toString() : '';
                          return (
                            name.toLowerCase().includes(searchLower) ||
                            exp.code?.toLowerCase().includes(searchLower) ||
                            years.includes(searchLower) ||
                            exp.id.toString().includes(searchLower) ||
                            exp.experience_texts?.some(text => 
                              text.name?.toLowerCase().includes(searchLower)
                            )
                          );
                        }).length}
                        page={experiencesPage}
                        onPageChange={(event, newPage) => setExperiencesPage(newPage)}
                        rowsPerPage={experiencesRowsPerPage}
                        onRowsPerPageChange={(event) => {
                          setExperiencesRowsPerPage(parseInt(event.target.value, 10));
                          setExperiencesPage(0);
                        }}
                        rowsPerPageOptions={[5, 10, 20]}
                      />
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No experiences connected yet.
                    </Typography>
                  )}
                </Box>
              </PermissionGate>
            </TabPanel>

            {/* Projects Tab */}
            <TabPanel value={tabValue} index={3}>
              <PermissionGate 
                permission="VIEW_PROJECTS" 
                showError 
                errorMessage="You do not have permission to see Projects, please contact your system administrator."
              >
                <Box sx={{ mb: 3 }}>
                  {/* Title and Add Section */}
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                    <ProjectIcon sx={{ mr: 1 }} />
                    Projects
                  </Typography>

                  {/* Add Projects */}
                  <PermissionGate permissions={["EDIT_PORTFOLIO", "VIEW_PROJECTS"]} requireAll>
                    <ProjectAddManager
                      projects={projects}
                      onAddMany={async (ids) => {
                        await handleBulkAdd(ids, handleAddProject);
                      }}
                    />
                  </PermissionGate>

                  <Divider sx={{ my: 3 }} />

                  {/* Connected Projects Section */}
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Connected Projects
                  </Typography>

                  {/* Search bar for connected projects */}
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search connected projects..."
                    value={projectsSearchTerm}
                    onChange={(e) => {
                      setProjectsSearchTerm(e.target.value);
                      setProjectsPage(0); // Reset to first page on search
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                      endAdornment: projectsSearchTerm && (
                        <InputAdornment position="end">
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              setProjectsSearchTerm('');
                              setProjectsPage(0);
                            }}
                          >
                            <ClearIcon />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    sx={{ mb: 2 }}
                  />

                  {projects.length > 0 ? (
                    <>
                      <List>
                        {projects
                          .filter((proj) => {
                            if (!projectsSearchTerm) return true;
                            const searchLower = projectsSearchTerm.toLowerCase();
                            const name = proj.project_texts?.[0]?.name || '';
                            const title = proj.project_texts?.[0]?.title || '';
                            const description = proj.project_texts?.[0]?.description || '';
                            return (
                              name.toLowerCase().includes(searchLower) ||
                              title.toLowerCase().includes(searchLower) ||
                              description.toLowerCase().includes(searchLower) ||
                              proj.id.toString().includes(searchLower) ||
                              // Search in all language texts
                              proj.project_texts?.some(text => 
                                text.name?.toLowerCase().includes(searchLower) ||
                                text.title?.toLowerCase().includes(searchLower) ||
                                text.description?.toLowerCase().includes(searchLower)
                              )
                            );
                          })
                          .slice(
                            projectsPage * projectsRowsPerPage,
                            projectsPage * projectsRowsPerPage + projectsRowsPerPage
                          )
                          .map((proj) => {
                            const title = proj.project_texts?.[0]?.name || proj.project_texts?.[0]?.title || `Project ${proj.id}`;
                            return (
                              <ListItem key={proj.id} divider>
                                <ListItemIcon>
                                  <ProjectIcon />
                                </ListItemIcon>
                                <ListItemText
                                  primary={title}
                                  secondary={`ID: ${proj.id}`}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewProject(proj)}
                                  sx={{ mr: 1 }}
                                >
                                  <VisibilityIcon />
                                </IconButton>
                                <PermissionGate permission="EDIT_PORTFOLIO">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoveProject(proj.id)}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </PermissionGate>
                              </ListItem>
                            );
                          })}
                      </List>
                      <TablePagination
                        component="div"
                        count={projects.filter((proj) => {
                          if (!projectsSearchTerm) return true;
                          const searchLower = projectsSearchTerm.toLowerCase();
                          const name = proj.project_texts?.[0]?.name || '';
                          const title = proj.project_texts?.[0]?.title || '';
                          const description = proj.project_texts?.[0]?.description || '';
                          return (
                            name.toLowerCase().includes(searchLower) ||
                            title.toLowerCase().includes(searchLower) ||
                            description.toLowerCase().includes(searchLower) ||
                            proj.id.toString().includes(searchLower) ||
                            proj.project_texts?.some(text => 
                              text.name?.toLowerCase().includes(searchLower) ||
                              text.title?.toLowerCase().includes(searchLower) ||
                              text.description?.toLowerCase().includes(searchLower)
                            )
                          );
                        }).length}
                        page={projectsPage}
                        onPageChange={(event, newPage) => setProjectsPage(newPage)}
                        rowsPerPage={projectsRowsPerPage}
                        onRowsPerPageChange={(event) => {
                          setProjectsRowsPerPage(parseInt(event.target.value, 10));
                          setProjectsPage(0);
                        }}
                        rowsPerPageOptions={[5, 10, 20]}
                      />
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No projects connected yet.
                    </Typography>
                  )}
                </Box>
              </PermissionGate>
            </TabPanel>

            {/* Sections Tab */}
            <TabPanel value={tabValue} index={4}>
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
                  <PermissionGate permissions={["EDIT_PORTFOLIO", "VIEW_SECTIONS"]} requireAll>
                    <SectionAddManager
                      sectionsConnected={sections}
                      onAddMany={async (ids) => {
                        await handleBulkAdd(ids, handleAddSection);
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
                              <PermissionGate permission="EDIT_PORTFOLIO">
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

            {/* Images Tab */}
            <TabPanel value={tabValue} index={5}>
              <PermissionGate 
                permissions={["VIEW_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}
                showError
                errorMessage="You do not have permission to see Portfolio Images, please contact your system administrator."
              >
              <Card>
                <CardHeader
                  avatar={<Avatar sx={{ bgcolor: '#1976d2' }}><PhotoLibraryIcon /></Avatar>}
                  title="Portfolio Images"
                  subheader={`${images.length} images uploaded`}
                  action={
                    <PermissionGate 
                      permissions={["UPLOAD_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}
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
                                {image.language && (
                                  <Chip
                                    size="small"
                                    icon={image.language.image ? (
                                      <Box
                                        component="img"
                                        src={`${SERVER_URL}/uploads/${image.language.image.replace(/^.*language_images\//, "language_images/")}`}
                                        alt={image.language.name}
                                        sx={{ width: 16, height: 12, objectFit: 'cover' }}
                                      />
                                    ) : <LanguageIcon />}
                                    label={image.language.name}
                                    sx={{ height: 20 }}
                                  />
                                )}
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
                                <PermissionGate permissions={["EDIT_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}>
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
                                <PermissionGate permissions={["DELETE_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}>
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
            <TabPanel value={tabValue} index={6}>
              <PermissionGate 
                permissions={["VIEW_PORTFOLIO_ATTACHMENTS", "MANAGE_PORTFOLIO_ATTACHMENTS", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}
                showError
                errorMessage="You do not have permission to see Portfolio Attachments, please contact your system administrator."
              >
              <Card>
                <CardHeader
                  avatar={<Avatar sx={{ bgcolor: '#1976d2' }}><AttachFileIcon /></Avatar>}
                  title="Portfolio Attachments"
                  subheader={`${attachments.length} files attached`}
                  action={
                    <PermissionGate permissions={["UPLOAD_PORTFOLIO_ATTACHMENTS", "MANAGE_PORTFOLIO_ATTACHMENTS", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}>
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
                            <PermissionGate permissions={["MANAGE_PORTFOLIO_ATTACHMENTS", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}>
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
                            <PermissionGate permissions={["DELETE_PORTFOLIO_ATTACHMENTS", "MANAGE_PORTFOLIO_ATTACHMENTS", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}>
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
          </>
        )}
      </Box>
      </Paper>

    {/* All Dialogs */}
    {/* Image Upload Dialog */}
  <PermissionGate permissions={["UPLOAD_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}>
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
          
          {/* Image Preview */}
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
                  // Reset the file input
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
              <MenuItem value="main">Main Image</MenuItem>
              <MenuItem value="thumbnail">Thumbnail</MenuItem>
              <MenuItem value="gallery">Gallery</MenuItem>
              <MenuItem value="background">Background</MenuItem>
            </Select>
          </FormControl>
          
          {/* Language Selection */}
          <FormControl fullWidth>
            <InputLabel id="image-language-label">Language (Optional)</InputLabel>
            <Select
              labelId="image-language-label"
              id="image-language-select"
              value={imageLanguage}
              label="Language (Optional)"
              onChange={(e) => {
                console.log('Language selected:', e.target.value, 'Type:', typeof e.target.value);
                setImageLanguage(e.target.value);
              }}
              disabled={uploadLoading || languagesLoading}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {languagesLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  <em>Loading languages...</em>
                </MenuItem>
              ) : availableLanguages.length === 0 ? (
                <MenuItem disabled>
                  <em>No languages available</em>
                </MenuItem>
              ) : (
                availableLanguages.map((language) => (
                  <MenuItem key={language.id} value={language.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {language.image && (
                        <Box
                          component="img"
                          src={`${SERVER_URL}/uploads/${language.image.replace(/^.*language_images\//, "language_images/")}`}
                          alt={language.name}
                          sx={{
                            width: 24,
                            height: 16,
                            border: '1px solid #eee',
                            borderRadius: 0.5,
                            objectFit: 'cover'
                          }}
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
  </PermissionGate>

    {/* Attachment Upload Dialog */}
  <PermissionGate permissions={["UPLOAD_PORTFOLIO_ATTACHMENTS", "MANAGE_PORTFOLIO_ATTACHMENTS", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}>
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
          
          {/* Language Selection */}
          <FormControl fullWidth>
            <InputLabel id="attachment-language-label">Language (Optional)</InputLabel>
            <Select
              labelId="attachment-language-label"
              id="attachment-language-select"
              value={attachmentLanguage}
              label="Language (Optional)"
              onChange={(e) => setAttachmentLanguage(e.target.value)}
              disabled={uploadLoading || languagesLoading}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {languagesLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  <em>Loading languages...</em>
                </MenuItem>
              ) : availableLanguages.length === 0 ? (
                <MenuItem disabled>
                  <em>No languages available</em>
                </MenuItem>
              ) : (
                availableLanguages.map((language) => (
                  <MenuItem key={language.id} value={language.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {language.image && (
                        <Box
                          component="img"
                          src={`${SERVER_URL}/uploads/${language.image.replace(/^.*language_images\//, "language_images/")}`}
                          alt={language.name}
                          sx={{
                            width: 24,
                            height: 16,
                            border: '1px solid #eee',
                            borderRadius: 0.5,
                            objectFit: 'cover'
                          }}
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
          
          {/* Category Selection */}
          <FormControl fullWidth>
            <InputLabel id="attachment-category-label">Category (Optional)</InputLabel>
            <Select
              labelId="attachment-category-label"
              id="attachment-category-select"
              value={attachmentCategory}
              label="Category (Optional)"
              onChange={(e) => setAttachmentCategory(e.target.value)}
              disabled={uploadLoading || categoriesLoading}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {categoriesLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  <em>Loading categories...</em>
                </MenuItem>
              ) : attachmentCategories.length === 0 ? (
                <MenuItem disabled>
                  <em>No categories available</em>
                </MenuItem>
              ) : (
                attachmentCategories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {getCategoryDisplayName(category)}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
          
          {/* Set as Default checkbox - only show for RESU categories */}
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
  </PermissionGate>

    {/* Edit Attachment Dialog */}
  <PermissionGate permissions={["MANAGE_PORTFOLIO_ATTACHMENTS", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}>
  <Dialog open={editAttachmentOpen} onClose={() => setEditAttachmentOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Attachment</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>File:</strong> {selectedAttachment?.file_name}
          </Typography>
          
          {/* Language Selection */}
          <FormControl fullWidth>
            <InputLabel id="edit-attachment-language-label">Language (Optional)</InputLabel>
            <Select
              labelId="edit-attachment-language-label"
              id="edit-attachment-language-select"
              value={editAttachmentLanguage}
              label="Language (Optional)"
              onChange={(e) => setEditAttachmentLanguage(e.target.value)}
              disabled={editLoading || languagesLoading}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {languagesLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  <em>Loading languages...</em>
                </MenuItem>
              ) : availableLanguages.length === 0 ? (
                <MenuItem disabled>
                  <em>No languages available</em>
                </MenuItem>
              ) : (
                availableLanguages.map((language) => (
                  <MenuItem key={language.id} value={language.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {language.image && (
                        <Box
                          component="img"
                          src={`${SERVER_URL}/uploads/${language.image.replace(/^.*language_images\//, "language_images/")}`}
                          alt={language.name}
                          sx={{
                            width: 24,
                            height: 16,
                            border: '1px solid #eee',
                            borderRadius: 0.5,
                            objectFit: 'cover'
                          }}
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
          
          {/* Category Selection */}
          <FormControl fullWidth>
            <InputLabel id="edit-attachment-category-label">Category (Optional)</InputLabel>
            <Select
              labelId="edit-attachment-category-label"
              id="edit-attachment-category-select"
              value={editAttachmentCategory}
              label="Category (Optional)"
              onChange={(e) => setEditAttachmentCategory(e.target.value)}
              disabled={editLoading || categoriesLoading}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {categoriesLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  <em>Loading categories...</em>
                </MenuItem>
              ) : attachmentCategories.length === 0 ? (
                <MenuItem disabled>
                  <em>No categories available</em>
                </MenuItem>
              ) : (
                attachmentCategories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {getCategoryDisplayName(category)}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
          
          {/* Set as Default checkbox - only show for RESU categories */}
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
        <Button onClick={() => setEditAttachmentOpen(false)}>Cancel</Button>
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

    {/* Edit Image Dialog */}
  <PermissionGate permissions={["EDIT_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIO_IMAGES", "MANAGE_PORTFOLIOS", "SYSTEM_ADMIN"]}>
  <Dialog open={editImageOpen} onClose={() => setEditImageOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Image</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {/* Filename Field */}
          <TextField
            label="File Name"
            value={editImageFileName}
            onChange={(e) => setEditImageFileName(e.target.value)}
            fullWidth
            required
            disabled={editLoading}
            helperText="Enter the new filename for this image"
          />
          
          {/* Language Selection */}
          <FormControl fullWidth>
            <InputLabel id="edit-image-language-label">Language (Optional)</InputLabel>
            <Select
              labelId="edit-image-language-label"
              id="edit-image-language-select"
              value={editImageLanguage}
              label="Language (Optional)"
              onChange={(e) => setEditImageLanguage(e.target.value)}
              disabled={editLoading || languagesLoading}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {languagesLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  <em>Loading languages...</em>
                </MenuItem>
              ) : availableLanguages.length === 0 ? (
                <MenuItem disabled>
                  <em>No languages available</em>
                </MenuItem>
              ) : (
                availableLanguages.map((language) => (
                  <MenuItem key={language.id} value={language.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {language.image && (
                        <Box
                          component="img"
                          src={`${SERVER_URL}/uploads/${language.image.replace(/^.*language_images\//, "language_images/")}`}
                          alt={language.name}
                          sx={{
                            width: 24,
                            height: 16,
                            border: '1px solid #eee',
                            borderRadius: 0.5,
                            objectFit: 'cover'
                          }}
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
          
          {/* Category Selection */}
          <FormControl fullWidth>
            <InputLabel id="edit-image-category-label">Category</InputLabel>
            <Select
              labelId="edit-image-category-label"
              id="edit-image-category-select"
              value={editImageCategory}
              label="Category"
              onChange={(e) => setEditImageCategory(e.target.value)}
              disabled={editLoading}
            >
              <MenuItem value="">
                <em>Uncategorized</em>
              </MenuItem>
              <MenuItem value="main">Main</MenuItem>
              <MenuItem value="thumbnail">Thumbnail</MenuItem>
              <MenuItem value="gallery">Gallery</MenuItem>
              <MenuItem value="background">Background</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setEditImageOpen(false)}>Cancel</Button>
        <Button
          onClick={handleImageUpdate}
          variant="contained"
          disabled={editLoading}
          startIcon={editLoading ? <CircularProgress size={16} /> : <EditIcon />}
        >
          {editLoading ? 'Updating...' : 'Update'}
        </Button>
      </DialogActions>
  </Dialog>
  </PermissionGate>

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

    {/* Category Translations Modal */}
    <Dialog 
      open={categoryModalOpen} 
      onClose={() => setCategoryModalOpen(false)} 
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <LanguageIcon sx={{ mr: 1 }} />
        Category Translations: {selectedCategory?.category_texts?.[0]?.name || selectedCategory?.code || `Category ${selectedCategory?.id ?? ''}`}
      </DialogTitle>
      <DialogContent>
        {selectedCategory?.category_texts && selectedCategory.category_texts.length > 0 ? (
          <Stack spacing={3}>
            {selectedCategory.category_texts.map((text, index) => (
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
                    {text.language?.code?.substring(0, 2).toUpperCase() || text.language_code?.substring(0, 2).toUpperCase() || 'XX'}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    {text.language?.name || text.language_code || 'Unknown Language'}
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {text.name || 'No name provided'}
                </Typography>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">
            No translations available for this category.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCategoryModalOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>

    {/* Experience Details / Translations Modal */}
    <Dialog 
      open={experienceModalOpen} 
      onClose={() => setExperienceModalOpen(false)} 
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <LanguageIcon sx={{ mr: 1 }} />
        Experience: {selectedExperience?.experience_texts?.[0]?.name || selectedExperience?.code || `Experience ${selectedExperience?.id ?? ''}`}
      </DialogTitle>
      <DialogContent>
        {selectedExperience?.experience_texts && selectedExperience.experience_texts.length > 0 ? (
          <Stack spacing={3}>
            {selectedExperience.experience_texts.map((text, index) => (
              <Paper key={index} variant="outlined" sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  {text.language?.image ? (
                    <Box
                      component="img"
                      src={`${SERVER_URL}/uploads/${text.language.image.replace(/^.*language_images\//, "language_images/")}`}
                      alt={`${text.language.name} flag`}
                      sx={{ width: 32, height: 24, border: '1px solid #eee', borderRadius: 1, objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'inline-flex';
                      }}
                    />
                  ) : null}
                  <Box sx={{ display: text.language?.image ? 'none' : 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 24, border: '1px solid #eee', borderRadius: 1, bgcolor: '#f0f0f0', fontSize: '10px', fontWeight: 'bold', color: '#666' }}>
                    {text.language?.code?.substring(0, 2).toUpperCase() || text.language_code?.substring(0, 2).toUpperCase() || 'XX'}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    {text.language?.name || text.language_code || 'Unknown Language'}
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {text.name || 'No name provided'}
                </Typography>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">No multilingual content available for this experience.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setExperienceModalOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>

    {/* Project Details / Translations Modal */}
    <Dialog 
      open={projectModalOpen} 
      onClose={() => setProjectModalOpen(false)} 
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <LanguageIcon sx={{ mr: 1 }} />
        Project: {selectedProject?.project_texts?.[0]?.name || selectedProject?.project_texts?.[0]?.title || selectedProject?.code || `Project ${selectedProject?.id ?? ''}`}
      </DialogTitle>
      <DialogContent>
        {selectedProject?.project_texts && selectedProject.project_texts.length > 0 ? (
          <Stack spacing={3}>
            {selectedProject.project_texts.map((text, index) => (
              <Paper key={index} variant="outlined" sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  {text.language?.image ? (
                    <Box
                      component="img"
                      src={`${SERVER_URL}/uploads/${text.language.image.replace(/^.*language_images\//, "language_images/")}`}
                      alt={`${text.language.name} flag`}
                      sx={{ width: 32, height: 24, border: '1px solid #eee', borderRadius: 1, objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'inline-flex';
                      }}
                    />
                  ) : null}
                  <Box sx={{ display: text.language?.image ? 'none' : 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 24, border: '1px solid #eee', borderRadius: 1, bgcolor: '#f0f0f0', fontSize: '10px', fontWeight: 'bold', color: '#666' }}>
                    {text.language?.code?.substring(0, 2).toUpperCase() || text.language_code?.substring(0, 2).toUpperCase() || 'XX'}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    {text.language?.name || text.language_code || 'Unknown Language'}
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {text.name || text.title || 'No name provided'}
                </Typography>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">No multilingual content available for this project.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setProjectModalOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>

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
    </Container>
  );
}

export default PortfolioDataPage;
