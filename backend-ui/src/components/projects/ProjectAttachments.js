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
  CardContent,
  CardActions,
  Tooltip,
  Chip,
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
  FormControl,
  Select,
  InputLabel,
  MenuItem,
  alpha,
  Pagination,
  Stack,
  InputAdornment
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  Add as AddIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  AttachFile as AttachFileIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  TableChart as ExcelIcon,
  DataUsage as CsvIcon,
  Code as CodeIcon,
  Archive as ZipIcon,
  InsertDriveFile as FileIcon,
  SelectAll as SelectAllIcon,
  DeleteSweep as DeleteSweepIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Visibility as VisibilityIcon,
  Fullscreen as FullscreenIcon
} from '@mui/icons-material';
import SERVER_URL from '../common/BackendServerData';
import ModuleGate from '../common/ModuleGate';
import PermissionGate from '../common/PermissionGate';
import ErrorBoundary from '../common/ErrorBoundary';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { api } from '../../services/api';

// Max file size: 10MB for attachments
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'application/json',
  'application/xml',
  'text/xml',
  'application/zip',
  'application/x-zip-compressed'
];
const MAX_FILES = 10;

// Helper function to get file icon
const getFileIcon = (fileName, contentType) => {
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  const type = contentType?.toLowerCase() || '';
  
  if (type.includes('pdf') || ext === 'pdf') {
    return <PdfIcon sx={{ color: '#d32f2f' }} />;
  } else if (type.includes('word') || ['doc', 'docx'].includes(ext)) {
    return <DocIcon sx={{ color: '#1976d2' }} />;
  } else if (type.includes('excel') || type.includes('spreadsheet') || ['xls', 'xlsx'].includes(ext)) {
    return <ExcelIcon sx={{ color: '#2e7d32' }} />;
  } else if (type.includes('csv') || ext === 'csv') {
    return <CsvIcon sx={{ color: '#ff9800' }} />;
  } else if (type.includes('json') || type.includes('xml') || ['json', 'xml'].includes(ext)) {
    return <CodeIcon sx={{ color: '#9c27b0' }} />;
  } else if (type.includes('zip') || ext === 'zip') {
    return <ZipIcon sx={{ color: '#795548' }} />;
  } else {
    return <FileIcon sx={{ color: '#757575' }} />;
  }
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to get file extension
const getFileExtension = (filename) => {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

// Helper function to check if file is previewable
const isPreviewable = (filename) => {
  const ext = getFileExtension(filename);
  const previewableExtensions = ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx'];
  return previewableExtensions.includes(ext);
};

// Helper function to get preview type
const getPreviewType = (filename) => {
  const ext = getFileExtension(filename);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'txt') return 'text';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  return null;
};

function ProjectAttachmentsContent() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { hasPermission, isSystemAdmin, permissions, loading: authLoading } = useAuthorization();
  
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [project, setProject] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const dragAreaRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  // Bulk selection state
  const [selectedAttachments, setSelectedAttachments] = useState(new Set());
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);

  // Languages and categories for file metadata
  const [languages, setLanguages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingLanguages, setLoadingLanguages] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('[PROJECT ATTACHMENTS DEBUG] Authentication Status:');
    console.log('  - Auth Loading:', authLoading);
    console.log('  - Permissions:', permissions);
    console.log('  - Is System Admin:', isSystemAdmin());
    console.log('  - Has VIEW_PROJECT_ATTACHMENTS:', hasPermission('VIEW_PROJECT_ATTACHMENTS'));
    console.log('  - Has UPLOAD_PROJECT_ATTACHMENTS:', hasPermission('UPLOAD_PROJECT_ATTACHMENTS'));
    console.log('  - Has DELETE_PROJECT_ATTACHMENTS:', hasPermission('DELETE_PROJECT_ATTACHMENTS'));
    console.log('  - Has MANAGE_PROJECT_ATTACHMENTS:', hasPermission('MANAGE_PROJECT_ATTACHMENTS'));
    console.log('  - Has MANAGE_PROJECTS:', hasPermission('MANAGE_PROJECTS'));
    console.log('  - Has SYSTEM_ADMIN:', hasPermission('SYSTEM_ADMIN'));
    console.log('  - Can Access (any of above):', 
      hasPermission('VIEW_PROJECT_ATTACHMENTS') || 
      hasPermission('MANAGE_PROJECT_ATTACHMENTS') || 
      hasPermission('MANAGE_PROJECTS') || 
      hasPermission('SYSTEM_ADMIN')
    );
  }, [authLoading, permissions, hasPermission, isSystemAdmin]);

  // Permission checking helpers
  const canUploadAttachments = () => {
    return hasPermission('UPLOAD_PROJECT_ATTACHMENTS') || 
           hasPermission('MANAGE_PROJECT_ATTACHMENTS') || 
           hasPermission('MANAGE_PROJECTS') || 
           hasPermission('SYSTEM_ADMIN');
  };

  const canDeleteAttachments = () => {
    return hasPermission('DELETE_PROJECT_ATTACHMENTS') || 
           hasPermission('MANAGE_PROJECT_ATTACHMENTS') || 
           hasPermission('MANAGE_PROJECTS') || 
           hasPermission('SYSTEM_ADMIN');
  };

  // Pagination and filtering state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filenameFilter, setFilenameFilter] = useState('');
  const [extensionFilter, setExtensionFilter] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ filename: '', extension: '' });

  // Preview state
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewMethod, setPreviewMethod] = useState('google'); // 'google' or 'download'

  // Fetch project and attachments
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // First, verify authentication by checking current user permissions
        console.log('[PROJECT ATTACHMENTS DEBUG] Testing authentication...');
        const authTestResponse = await api.get('/api/users/me/permissions');
        
        console.log('[PROJECT ATTACHMENTS DEBUG] Auth test response status:', authTestResponse.status);
        console.log('[PROJECT ATTACHMENTS DEBUG] Auth test response data:', authTestResponse.data);
        
        // Fetch project details
        console.log('[PROJECT ATTACHMENTS DEBUG] Fetching project details for ID:', projectId);
        const projectResponse = await api.get(`/api/projects/${projectId}`);
        
        console.log('[PROJECT ATTACHMENTS DEBUG] Project response status:', projectResponse.status);
        console.log('[PROJECT ATTACHMENTS DEBUG] Project response data:', projectResponse.data);
        
        setProject(projectResponse.data);
        
        // Fetch project attachments
        await fetchAttachments(1, { filename: '', extension: '' });
        
      } catch (error) {
        console.error('ProjectAttachments - Error fetching data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  // Fetch languages and categories for file metadata
  useEffect(() => {
    const fetchLanguagesAndCategories = async () => {
      try {
        // Fetch languages
        setLoadingLanguages(true);
        const languagesResponse = await api.get('/api/languages');
        setLanguages(languagesResponse.data);
        setLoadingLanguages(false);

        // Fetch project attachment categories (type_code='PROA')
        setLoadingCategories(true);
        const categoriesResponse = await api.get('/api/categories', {
          params: { 
            type_code: 'PROA',
            page: 1,
            page_size: 100  // Get all project attachment categories
          }
        });
        // Categories endpoint returns paginated response
        setCategories(categoriesResponse.data.items || []);
        setLoadingCategories(false);
      } catch (error) {
        console.error('Error fetching languages or categories:', error);
        setLoadingLanguages(false);
        setLoadingCategories(false);
      }
    };

    fetchLanguagesAndCategories();
  }, []);

  const fetchAttachments = async (currentPage = page, filters = appliedFilters) => {
    try {
      console.log(`ProjectAttachments - Fetching attachments for project ${projectId}`);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString()
      });
      
      if (filters.filename) {
        params.append('filename_filter', filters.filename);
      }
      
      if (filters.extension) {
        params.append('extension_filter', filters.extension);
      }
      
      const attachmentsResponse = await api.get(`/api/projects/${projectId}/attachments?${params}`);
      console.log('ProjectAttachments - API response received');
      
      const attachmentsData = attachmentsResponse.data;
      console.log(`ProjectAttachments - Fetched ${attachmentsData.items?.length || 0} attachments out of ${attachmentsData.total || 0}:`, attachmentsData);
      
      setAttachments(attachmentsData.items || []);
      setTotal(attachmentsData.total || 0);
      setPage(attachmentsData.page || 1);
    } catch (error) {
      console.error('ProjectAttachments - Error fetching attachments:', error);
      setError(error.message);
    }
  };

  // Handle file input change
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
    e.target.value = ''; // Reset file input
  };

  // Process selected files
  const processFiles = (files) => {
    setUploadError(null);
    
    if (files.length === 0) return;
    
    if (files.length > MAX_FILES) {
      setUploadError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const validFiles = [];
    const errors = [];

    files.forEach((file, index) => {
      // Check file type
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        errors.push(`File "${file.name}" has an unsupported file type`);
        return;
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`File "${file.name}" is too large (${formatFileSize(file.size)}). Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`);
        return;
      }

      validFiles.push({
        file,
        id: Date.now() + index,
        name: file.name,
        size: file.size,
        type: file.type,
        nameEdited: false,
        language_id: '',
        category_id: ''
      });
    });

    if (errors.length > 0) {
      setUploadError(errors.join('. '));
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setIsUploadDialogOpen(true);
    }
  };

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    }
  }, []);

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

  // Handle language/category change for file metadata
  const handleFileMetadataChange = (index, field, value) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = {
        ...newFiles[index],
        [field]: value
      };
      return newFiles;
    });
  };

  // Handle upload files
  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('No files selected');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    
    const successfulUploads = [];
    const failedUploads = [];

    for (const fileObj of selectedFiles) {
      try {
        setUploadProgress(prev => ({ ...prev, [fileObj.id]: 0 }));
        
        const formData = new FormData();
        
        // If filename was edited, create a new file with the new name
        if (fileObj.nameEdited) {
          const newFile = new File([fileObj.file], fileObj.name, { type: fileObj.file.type });
          formData.append('file', newFile);
        } else {
          formData.append('file', fileObj.file);
        }

        // Add language_id and category_id if selected
        if (fileObj.language_id) {
          formData.append('language_id', fileObj.language_id);
        }
        if (fileObj.category_id) {
          formData.append('category_id', fileObj.category_id);
        }

        console.log(`ProjectAttachments - Uploading file: ${fileObj.name}`);
        const response = await api.post(`/api/projects/${projectId}/attachments`, formData);

        console.log(`ProjectAttachments - Upload response status: ${response.status} for file: ${fileObj.name}`);

        const uploadedAttachment = response.data;
        console.log(`ProjectAttachments - Successfully uploaded: ${fileObj.name}`, uploadedAttachment);
        successfulUploads.push(uploadedAttachment);
        setUploadProgress(prev => ({ ...prev, [fileObj.id]: 100 }));
        
      } catch (error) {
        console.error(`ProjectAttachments - Error uploading ${fileObj.name}:`, error);
        
        // Check if it's a filename conflict error
        const errorMessage = error.response?.data?.detail || error.message;
        if (errorMessage.includes('already exists')) {
          setUploadProgress(prev => ({ ...prev, [fileObj.id]: 'conflict' }));
          failedUploads.push({ name: fileObj.name, error: errorMessage });
          continue;
        }
        
        failedUploads.push({ name: fileObj.name, error: errorMessage });
        setUploadProgress(prev => ({ ...prev, [fileObj.id]: -1 }));
      }
    }

    console.log(`ProjectAttachments - Upload results: ${successfulUploads.length} successful, ${failedUploads.length} failed`);

    // Update state based on results
    if (successfulUploads.length > 0) {
      console.log('ProjectAttachments - Refreshing attachments list...');
      await fetchAttachments(page, appliedFilters); // Refresh attachments list
      console.log('ProjectAttachments - Attachments list refreshed');
    }

    if (failedUploads.length > 0) {
      const errorMessage = failedUploads.map(f => `${f.name}: ${f.error}`).join('; ');
      setUploadError(`Some files failed to upload: ${errorMessage}`);
    } else {
      // All uploads successful (no failed uploads)
      console.log('ProjectAttachments - All uploads successful, closing dialog');
      setIsUploadDialogOpen(false);
      setSelectedFiles([]);
      setUploadProgress({});
    }

    setUploadLoading(false);
  };

  // Handle delete attachment
  const handleDeleteClick = (attachment) => {
    setSelectedAttachment(attachment);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAttachment) return;

    try {
      await api.delete(`/api/projects/${projectId}/attachments/${selectedAttachment.id}`);

      // Refresh attachments list
      await fetchAttachments(page, appliedFilters);
      setIsDeleteDialogOpen(false);
      setSelectedAttachment(null);
      
    } catch (error) {
      console.error('Error deleting attachment:', error);
      setError(error.response?.data?.detail || error.message);
    }
  };

  // Handle bulk selection
  const handleAttachmentSelect = (attachmentId) => {
    setSelectedAttachments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(attachmentId)) {
        newSet.delete(attachmentId);
      } else {
        newSet.add(attachmentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedAttachments.size === attachments.length) {
      setSelectedAttachments(new Set());
    } else {
      setSelectedAttachments(new Set(attachments.map(attachment => attachment.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedAttachments.size === 0) return;
    setIsBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedAttachments.size === 0) return;

    setBulkDeleteLoading(true);
    const deletePromises = Array.from(selectedAttachments).map(attachmentId =>
      api.delete(`/api/projects/${projectId}/attachments/${attachmentId}`)
    );

    try {
      await Promise.all(deletePromises);
      await fetchAttachments(page, appliedFilters); // Refresh attachments
      setSelectedAttachments(new Set());
      setSelectionMode(false);
      setIsBulkDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error during bulk delete:', error);
      setError('Some attachments could not be deleted');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Handle file download
  const handleDownload = (attachment) => {
    if (attachment.file_url) {
      const link = document.createElement('a');
      link.href = `${SERVER_URL}${attachment.file_url}`;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Pagination handlers
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    fetchAttachments(newPage, appliedFilters);
  };

  // Filter handlers
  const handleApplyFilters = () => {
    const newFilters = { filename: filenameFilter, extension: extensionFilter };
    setAppliedFilters(newFilters);
    setPage(1); // Reset to first page when filtering
    fetchAttachments(1, newFilters);
  };

  const handleClearFilters = () => {
    setFilenameFilter('');
    setExtensionFilter('');
    const clearedFilters = { filename: '', extension: '' };
    setAppliedFilters(clearedFilters);
    setPage(1);
    fetchAttachments(1, clearedFilters);
  };

  const handleFilenameFilterChange = (event) => {
    setFilenameFilter(event.target.value);
  };

  const handleExtensionFilterChange = (event) => {
    setExtensionFilter(event.target.value);
  };

  // Preview handlers
  const handlePreviewClick = async (attachment) => {
    setPreviewAttachment(attachment);
    setPreviewError(null);
    setPreviewLoading(true);
    setIsPreviewDialogOpen(true);
    setPreviewMethod('google');

    const previewType = getPreviewType(attachment.file_name);
    
    try {
      if (previewType === 'text') {
        // For text files, fetch the content directly using api service
        const response = await api.get(attachment.file_url.replace('/static', ''));
        setPreviewContent(response.data);
      } else if (previewType === 'pdf') {
        // For PDFs, use the direct file URL
        setPreviewContent(attachment.file_url);
      } else if (previewType === 'word' || previewType === 'excel') {
        // For Word/Excel files, get a temporary token for external viewers
        try {
          const tokenResponse = await api.post(`/api/projects/${projectId}/attachments/${attachment.id}/preview-token`);
          
          const tokenData = tokenResponse.data;
          console.log('Generated preview token:', tokenData);
          
          // Store the public URL for external viewers
          setPreviewContent(tokenData.full_url);
        } catch (tokenError) {
          console.error('Error generating preview token:', tokenError);
          // Fallback to direct file URL (might not work for external viewers)
          setPreviewContent(attachment.file_url);
        }
      } else {
        // For other file types, use the direct file URL
        setPreviewContent(attachment.file_url);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      setPreviewError('Failed to load file preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setIsPreviewDialogOpen(false);
    setPreviewAttachment(null);
    setPreviewContent('');
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewMethod('google');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button 
          variant="outlined" 
          onClick={() => navigate('/projects')}
          startIcon={<ArrowBackIcon />}
        >
          Back to Projects
        </Button>
      </Box>
    );
  }

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
          Project Attachments
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
      </Box>

      {/* Filters Section */}
      <Box sx={{ 
        p: { xs: 2, sm: 2.5 }, 
        backgroundColor: 'white', 
        border: '1px solid #f0f0f0', 
        borderRadius: '5px', 
        mb: 2.5, 
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)' 
      }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FilterListIcon sx={{ mr: 1.5, color: '#1976d2', opacity: 0.8, fontSize: '1rem' }} />
            <Typography variant="subtitle1" sx={{ 
              fontWeight: 500, 
              color: '#505050', 
              fontSize: '14px', 
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' 
            }}>
              Filters & Search
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ 
              color: '#757575', 
              fontSize: '13px', 
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' 
            }}>
              {total} total files
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
          <TextField
            label="Filter by filename"
            value={filenameFilter}
            onChange={handleFilenameFilterChange}
            placeholder="Enter filename..."
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '1rem', color: '#757575' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              minWidth: 240,
              flex: 1,
              '& .MuiInputLabel-root': {
                fontSize: '13px',
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                color: '#505050',
                transform: 'translate(14px, 11px) scale(1)',
                '&.MuiInputLabel-shrink': {
                  transform: 'translate(14px, -6px) scale(0.75)'
                }
              },
              '& .MuiOutlinedInput-root': {
                borderRadius: '4px',
                height: '40px',
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2',
                  borderWidth: 1
                }
              },
              '& .MuiOutlinedInput-input': {
                fontSize: '13px',
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                color: '#505050'
              }
            }}
          />
          
          <TextField
            label="Filter by extension"
            value={extensionFilter}
            onChange={handleExtensionFilterChange}
            placeholder="e.g., pdf, docx, txt"
            size="small"
            sx={{
              minWidth: 180,
              flex: 1,
              '& .MuiInputLabel-root': {
                fontSize: '13px',
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                color: '#505050',
                transform: 'translate(14px, 11px) scale(1)',
                '&.MuiInputLabel-shrink': {
                  transform: 'translate(14px, -6px) scale(0.75)'
                }
              },
              '& .MuiOutlinedInput-root': {
                borderRadius: '4px',
                height: '40px',
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2',
                  borderWidth: 1
                }
              },
              '& .MuiOutlinedInput-input': {
                fontSize: '13px',
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                color: '#505050'
              }
            }}
          />
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Active filters display */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {appliedFilters.filename && (
              <Chip
                label={`Filename: ${appliedFilters.filename}`}
                size="small"
                onDelete={() => {
                  setFilenameFilter('');
                  const newFilters = { ...appliedFilters, filename: '' };
                  setAppliedFilters(newFilters);
                  setPage(1);
                  fetchAttachments(1, newFilters);
                }}
                sx={{ 
                  fontSize: '12px',
                  height: '24px',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  '& .MuiChip-label': {
                    px: 1
                  }
                }}
              />
            )}
            {appliedFilters.extension && (
              <Chip
                label={`Extension: ${appliedFilters.extension}`}
                size="small"
                onDelete={() => {
                  setExtensionFilter('');
                  const newFilters = { ...appliedFilters, extension: '' };
                  setAppliedFilters(newFilters);
                  setPage(1);
                  fetchAttachments(1, newFilters);
                }}
                sx={{ 
                  fontSize: '12px',
                  height: '24px',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  '& .MuiChip-label': {
                    px: 1
                  }
                }}
              />
            )}
          </Box>
          
          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleApplyFilters}
              startIcon={<SearchIcon sx={{ fontSize: '0.875rem' }} />}
              sx={{ 
                borderRadius: '4px', 
                textTransform: 'none', 
                fontWeight: 400, 
                boxShadow: 'none', 
                border: '1px solid #1976d2', 
                color: '#1976d2', 
                py: 0.5, 
                height: '32px', 
                fontSize: '13px', 
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', 
                '&:hover': { 
                  backgroundColor: 'rgba(25, 118, 210, 0.04)', 
                  borderColor: '#1976d2' 
                } 
              }}
            >
              Apply Filters
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={handleClearFilters}
              startIcon={<ClearIcon sx={{ fontSize: '0.875rem' }} />}
              disabled={!appliedFilters.filename && !appliedFilters.extension}
              sx={{ 
                borderRadius: '4px', 
                textTransform: 'none', 
                fontWeight: 400, 
                boxShadow: 'none', 
                border: '1px solid #757575', 
                color: '#757575', 
                py: 0.5, 
                height: '32px', 
                fontSize: '13px', 
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', 
                '&:hover': { 
                  backgroundColor: 'rgba(117, 117, 117, 0.04)', 
                  borderColor: '#757575' 
                },
                '&.Mui-disabled': {
                  opacity: 0.6,
                  color: 'rgba(0, 0, 0, 0.26)',
                  borderColor: 'rgba(0, 0, 0, 0.12)'
                }
              }}
            >
              Clear
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Actions Toolbar */}
      <Box sx={{ 
        p: { xs: 2, sm: 2.5 }, 
        backgroundColor: 'white', 
        border: '1px solid #f0f0f0', 
        borderRadius: '5px', 
        mb: 2.5, 
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {canUploadAttachments() && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<CloudUploadIcon sx={{ fontSize: '0.875rem' }} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLoading}
              sx={{ 
                borderRadius: '4px', 
                textTransform: 'none', 
                fontWeight: 400, 
                boxShadow: 'none', 
                border: '1px solid #1976d2', 
                color: '#1976d2', 
                py: 0.5, 
                height: '32px', 
                fontSize: '13px', 
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', 
                '&:hover': { 
                  backgroundColor: 'rgba(25, 118, 210, 0.04)', 
                  borderColor: '#1976d2' 
                },
                '&:disabled': {
                  opacity: 0.6,
                  color: 'rgba(0, 0, 0, 0.26)',
                  borderColor: 'rgba(0, 0, 0, 0.12)'
                }
              }}
            >
              Upload Files
            </Button>
          )}
          
          <FormControlLabel
            control={
              <Checkbox
                checked={selectionMode}
                onChange={(e) => {
                  setSelectionMode(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedAttachments(new Set());
                  }
                }}
                size="small"
                sx={{
                  color: '#1976d2',
                  '&.Mui-checked': {
                    color: '#1976d2'
                  }
                }}
              />
            }
            label="Selection Mode"
            sx={{ 
              ml: 0,
              '& .MuiFormControlLabel-label': {
                fontSize: '13px',
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                color: '#505050'
              }
            }}
          />
        </Box>

        {selectionMode && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleSelectAll}
              startIcon={<SelectAllIcon sx={{ fontSize: '0.875rem' }} />}
              disabled={attachments.length === 0}
              sx={{ 
                borderRadius: '4px', 
                textTransform: 'none', 
                fontWeight: 400, 
                boxShadow: 'none', 
                border: '1px solid #1976d2', 
                color: '#1976d2', 
                py: 0.5, 
                height: '32px', 
                fontSize: '13px', 
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', 
                '&:hover': { 
                  backgroundColor: 'rgba(25, 118, 210, 0.04)', 
                  borderColor: '#1976d2' 
                },
                '&:disabled': {
                  opacity: 0.6,
                  color: 'rgba(0, 0, 0, 0.26)',
                  borderColor: 'rgba(0, 0, 0, 0.12)'
                }
              }}
            >
              {selectedAttachments.size === attachments.length ? 'Deselect All' : 'Select All'}
            </Button>
            {canDeleteAttachments() && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={handleBulkDelete}
                startIcon={<DeleteSweepIcon sx={{ fontSize: '0.875rem' }} />}
                disabled={selectedAttachments.size === 0 || bulkDeleteLoading}
              sx={{ 
                borderRadius: '4px', 
                textTransform: 'none', 
                fontWeight: 400, 
                boxShadow: 'none', 
                border: '1px solid #e53935', 
                color: '#e53935', 
                py: 0.5, 
                height: '32px', 
                fontSize: '13px', 
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', 
                '&:hover': { 
                  backgroundColor: 'rgba(229, 57, 53, 0.04)', 
                  borderColor: '#e53935' 
                },
                '&:disabled': {
                  opacity: 0.6,
                  color: 'rgba(0, 0, 0, 0.26)',
                  borderColor: 'rgba(0, 0, 0, 0.12)'
                }
              }}
            >
              Delete Selected ({selectedAttachments.size})
            </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept={ACCEPTED_FILE_TYPES.join(',')}
        style={{ display: 'none' }}
      />

      {/* Drag and drop area */}
      <Paper
        ref={dragAreaRef}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        sx={{
          p: 4,
          mb: 3,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: dragActive ? '#1976d2' : '#e0e0e0',
          bgcolor: dragActive ? alpha('#1976d2', 0.04) : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <AttachFileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Drag & Drop Files Here
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          or click to browse files
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Supported: PDF, Word, Excel, CSV, Text, JSON, XML, ZIP • Max size: {formatFileSize(MAX_FILE_SIZE)} • Max {MAX_FILES} files
        </Typography>
      </Paper>

      {/* Attachments Grid */}
      {attachments.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <AttachFileIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No attachments yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload files to get started
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {attachments.map((attachment) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={attachment.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  position: 'relative',
                  border: selectionMode && selectedAttachments.has(attachment.id) ? '2px solid #1976d2' : '1px solid #e0e0e0',
                  '&:hover': {
                    boxShadow: 3
                  }
                }}
              >
                {selectionMode && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      zIndex: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      borderRadius: '50%',
                      padding: 0.5
                    }}
                  >
                    <Checkbox
                      checked={selectedAttachments.has(attachment.id)}
                      onChange={() => handleAttachmentSelect(attachment.id)}
                      size="small"
                      sx={{ padding: 0 }}
                    />
                  </Box>
                )}
                
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {getFileIcon(attachment.file_name, '')}
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        ml: 1, 
                        fontSize: '1rem',
                        fontWeight: 500,
                        wordWrap: 'break-word',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '200px'
                      }}
                      title={attachment.file_name}
                    >
                      {attachment.file_name}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary">
                    Uploaded: {attachment.created_at ? new Date(attachment.created_at).toLocaleDateString() : 'Unknown'}
                  </Typography>
                </CardContent>
                
                <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      onClick={() => handleDownload(attachment)}
                      startIcon={<DownloadIcon />}
                      sx={{ color: '#1976d2' }}
                    >
                      Download
                    </Button>
                    
                    {isPreviewable(attachment.file_name) && (
                      <Button
                        size="small"
                        onClick={() => handlePreviewClick(attachment)}
                        startIcon={<VisibilityIcon />}
                        sx={{ color: '#2e7d32' }}
                      >
                        Preview
                      </Button>
                    )}
                  </Box>
                  
                  {!selectionMode && canDeleteAttachments() && (
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(attachment)}
                      sx={{ color: '#e53935' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Stack spacing={2}>
            <Pagination
              count={Math.ceil(total / pageSize)}
              page={page}
              onChange={handlePageChange}
              color="primary"
              size="large"
              showFirstButton
              showLastButton
            />
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} of {total} files
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onClose={() => setIsUploadDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload Attachments</DialogTitle>
        <DialogContent>
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadError}
            </Alert>
          )}
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedFiles.length} file(s) selected for upload
          </Typography>
          
          <List>
            {selectedFiles.map((fileObj, index) => (
              <ListItem key={fileObj.id} divider sx={{ display: 'block', py: 2 }}>
                <Grid container spacing={2}>
                  {/* File icon and name */}
                  <Grid item xs={12} sm={8}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      {getFileIcon(fileObj.name, fileObj.type)}
                      <TextField
                        fullWidth
                        value={fileObj.name}
                        onChange={(e) => handleFilenameChange(index, e.target.value)}
                        disabled={uploadLoading}
                        size="small"
                        variant="outlined"
                        label="Filename"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 5 }}>
                      {formatFileSize(fileObj.size)}
                    </Typography>
                  </Grid>
                  
                  {/* Upload progress/status */}
                  <Grid item xs={12} sm={4}>
                    {uploadProgress[fileObj.id] !== undefined && (
                      <Box>
                        {uploadProgress[fileObj.id] === -1 ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ErrorIcon color="error" fontSize="small" />
                            <Typography variant="caption" color="error" sx={{ ml: 0.5 }}>
                              Failed
                            </Typography>
                          </Box>
                        ) : uploadProgress[fileObj.id] === 'conflict' ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ErrorIcon color="warning" fontSize="small" />
                            <Typography variant="caption" color="warning.main" sx={{ ml: 0.5 }}>
                              File exists
                            </Typography>
                          </Box>
                        ) : uploadProgress[fileObj.id] === 100 ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <CheckCircleIcon color="success" fontSize="small" />
                            <Typography variant="caption" color="success.main" sx={{ ml: 0.5 }}>
                              Complete
                            </Typography>
                          </Box>
                        ) : (
                          <Box>
                            <LinearProgress variant="determinate" value={uploadProgress[fileObj.id]} />
                            <Typography variant="caption">
                              {uploadProgress[fileObj.id]}%
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Grid>

                  {/* Category selector */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`file-category-label-${index}`}>Category (Optional)</InputLabel>
                      <Select
                        labelId={`file-category-label-${index}`}
                        value={fileObj.category_id}
                        onChange={(e) => handleFileMetadataChange(index, 'category_id', e.target.value)}
                        label="Category (Optional)"
                        disabled={uploadLoading || loadingCategories}
                      >
                        <MenuItem value="">
                          <em>None (Default)</em>
                        </MenuItem>
                        {loadingCategories ? (
                          <MenuItem disabled>
                            <CircularProgress size={16} sx={{ mr: 1 }} /> Loading...
                          </MenuItem>
                        ) : (
                          categories.map((category) => (
                            <MenuItem key={category.id} value={category.id}>
                              {category.name}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Language selector */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`file-language-label-${index}`}>Language (Optional)</InputLabel>
                      <Select
                        labelId={`file-language-label-${index}`}
                        value={fileObj.language_id}
                        onChange={(e) => handleFileMetadataChange(index, 'language_id', e.target.value)}
                        label="Language (Optional)"
                        disabled={uploadLoading || loadingLanguages}
                      >
                        <MenuItem value="">
                          <em>None (Default)</em>
                        </MenuItem>
                        {loadingLanguages ? (
                          <MenuItem disabled>
                            <CircularProgress size={16} sx={{ mr: 1 }} /> Loading...
                          </MenuItem>
                        ) : (
                          languages.map((language) => (
                            <MenuItem key={language.id} value={language.id}>
                              {language.name}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setIsUploadDialogOpen(false)} 
            disabled={uploadLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUploadFiles} 
            variant="contained" 
            disabled={uploadLoading || selectedFiles.length === 0}
            startIcon={uploadLoading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
          >
            {uploadLoading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

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
          Delete Attachment
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <DialogContentText sx={{ 
            fontSize: '1rem',
            color: '#e53935',
            mb: 2
          }}>
            Are you sure you want to delete this file?
          </DialogContentText>
          {selectedAttachment && (
            <Box sx={{ 
              mt: 2, 
              textAlign: 'center',
              p: 2,
              backgroundColor: alpha('#ffebee', 0.3),
              borderRadius: 2,
              border: '1px solid',
              borderColor: '#ffcdd2'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                {getFileIcon(selectedAttachment.file_name, '')}
                <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                  {selectedAttachment.file_name}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {selectedAttachment.created_at ? `Uploaded: ${new Date(selectedAttachment.created_at).toLocaleDateString()}` : 'File attachment'}
              </Typography>
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
            onClick={handleDeleteConfirm} 
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
          Delete Multiple Attachments
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <DialogContentText sx={{ 
            fontSize: '1rem',
            color: '#e53935',
            mb: 2
          }}>
            Are you sure you want to delete {selectedAttachments.size} selected attachment{selectedAttachments.size > 1 ? 's' : ''}? 
            This action cannot be undone.
          </DialogContentText>
          {selectedAttachments.size > 0 && (
            <Box sx={{ 
              mt: 2,
              p: 2,
              backgroundColor: alpha('#ffebee', 0.3),
              borderRadius: 2,
              border: '1px solid',
              borderColor: '#ffcdd2'
            }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Attachments to be deleted:
              </Typography>
              <Box sx={{ 
                maxHeight: '200px', 
                overflow: 'auto',
                borderRadius: 2,
                p: 1
              }}>
                <Grid container spacing={1}>
                  {attachments
                    .filter(attachment => selectedAttachments.has(attachment.id))
                    .map((attachment) => (
                      <Grid item xs={6} md={4} key={attachment.id}>
                        <Box sx={{ 
                          textAlign: 'center',
                          p: 1,
                          border: '1px solid #f44336',
                          borderRadius: 1,
                          backgroundColor: 'rgba(244, 67, 54, 0.05)'
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
                            {getFileIcon(attachment.file_name, '')}
                          </Box>
                          <Typography variant="caption" display="block" sx={{ 
                            fontWeight: 500,
                            wordWrap: 'break-word',
                            fontSize: '0.75rem'
                          }}>
                            {attachment.file_name}
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
            onClick={handleBulkDeleteConfirm} 
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
            {bulkDeleteLoading ? 'Deleting...' : `Delete ${selectedAttachments.size} Attachment${selectedAttachments.size > 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog 
        open={isPreviewDialogOpen} 
        onClose={handleClosePreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { 
            height: '90vh',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {previewAttachment && getFileIcon(previewAttachment.file_name, '')}
            <Typography variant="h6" sx={{ ml: 1 }}>
              {previewAttachment?.file_name || 'File Preview'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Viewer selection for Office documents */}
            {previewAttachment && (getPreviewType(previewAttachment.file_name) === 'word' || 
             getPreviewType(previewAttachment.file_name) === 'excel') && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button
                  size="small"
                  variant={previewMethod === 'google' ? 'contained' : 'outlined'}
                  onClick={() => setPreviewMethod('google')}
                  sx={{ 
                    minWidth: 'auto', 
                    px: 1, 
                    fontSize: '0.75rem',
                    textTransform: 'none'
                  }}
                >
                  Google
                </Button>
                <Button
                  size="small"
                  variant={previewMethod === 'microsoft' ? 'contained' : 'outlined'}
                  onClick={() => setPreviewMethod('microsoft')}
                  sx={{ 
                    minWidth: 'auto', 
                    px: 1, 
                    fontSize: '0.75rem',
                    textTransform: 'none'
                  }}
                >
                  Office
                </Button>
              </Box>
            )}
            
            <IconButton onClick={handleClosePreview}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0, height: '100%', overflow: 'hidden' }}>
          {previewLoading && (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '400px' 
            }}>
              <CircularProgress />
            </Box>
          )}
          
          {previewError && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Alert severity="error">
                {previewError}
              </Alert>
            </Box>
          )}
          
          {!previewLoading && !previewError && previewAttachment && (
            <Box sx={{ height: '100%', width: '100%' }}>
              {getPreviewType(previewAttachment.file_name) === 'text' && (
                <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
                  <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', height: '100%' }}>
                    <Typography 
                      component="pre" 
                      sx={{ 
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        margin: 0
                      }}
                    >
                      {previewContent}
                    </Typography>
                  </Paper>
                </Box>
              )}
              
              {getPreviewType(previewAttachment.file_name) === 'pdf' && (
                <Box sx={{ height: '100%', width: '100%' }}>
                  <iframe
                    src={`${SERVER_URL}${previewContent}`}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      border: 'none' 
                    }}
                    title="PDF Preview"
                  />
                </Box>
              )}
              
              {(getPreviewType(previewAttachment.file_name) === 'word' || 
                getPreviewType(previewAttachment.file_name) === 'excel') && (
                <Box sx={{ height: '100%', width: '100%' }}>
                  {/* Check if we're in development mode */}
                  {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? (
                    <Box sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      p: 4,
                      textAlign: 'center'
                    }}>
                      <Box sx={{ mb: 3 }}>
                        {getFileIcon(previewAttachment.file_name, '')}
                      </Box>
                      <Typography variant="h6" gutterBottom>
                        {previewAttachment.file_name}
                      </Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        External preview services (Google Docs, Microsoft Office) cannot access files from localhost in development mode.
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                        This feature will work properly when deployed to production with a public domain.
                      </Typography>
                      <Button
                        variant="contained"
                        size="large"
                        onClick={() => handleDownload(previewAttachment)}
                        startIcon={<DownloadIcon />}
                        sx={{ mb: 2 }}
                      >
                        Download File to View
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        File size: {previewAttachment.file_size ? formatFileSize(previewAttachment.file_size) : 'Unknown'}
                      </Typography>
                    </Box>
                  ) : previewMethod === 'google' ? (
                    <Box sx={{ height: '100%', position: 'relative' }}>
                      <iframe
                        src={`https://docs.google.com/gview?url=${encodeURIComponent(previewContent)}&embedded=true`}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          border: 'none' 
                        }}
                        title="Document Preview"
                        onLoad={(e) => {
                          console.log('Google Docs viewer iframe loaded');
                          // Check if the iframe shows "No preview available" after a delay
                          setTimeout(() => {
                            try {
                              // This is a workaround since we can't directly check iframe content due to CORS
                              // We'll rely on user feedback or implement a different approach
                              console.log('Google Docs viewer loaded, checking for content...');
                            } catch (error) {
                              console.log('Cannot check iframe content due to CORS restrictions');
                            }
                          }, 3000);
                        }}
                        onError={(e) => {
                          console.error('Google Docs viewer failed, trying alternative method');
                          setPreviewMethod('microsoft');
                        }}
                      />
                      
                      {/* Enhanced help message */}
                      <Box sx={{ 
                        position: 'absolute', 
                        bottom: 10, 
                        left: 10, 
                        right: 10,
                        display: 'flex',
                        justifyContent: 'center'
                      }}>
                        <Alert severity="warning" sx={{ maxWidth: '80%' }}>
                          <Typography variant="body2">
                            <strong>External Preview Limitation:</strong> Google Docs viewer cannot access files from localhost (development environment). 
                            This will work in production with a public domain. For now, please{' '}
                            <Button 
                              size="small" 
                              onClick={() => handleDownload(previewAttachment)}
                              sx={{ textTransform: 'none', p: 0, minWidth: 'auto', color: 'inherit', textDecoration: 'underline' }}
                            >
                              download the file
                            </Button>{' '}
                            to view it, or try the{' '}
                            <Button 
                              size="small" 
                              onClick={() => setPreviewMethod('microsoft')}
                              sx={{ textTransform: 'none', p: 0, minWidth: 'auto', color: 'inherit', textDecoration: 'underline' }}
                            >
                              Microsoft Office viewer
                            </Button>.
                          </Typography>
                        </Alert>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ height: '100%', position: 'relative' }}>
                      <iframe
                        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewContent)}`}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          border: 'none' 
                        }}
                        title="Microsoft Office Preview"
                        onError={(e) => {
                          console.error('Microsoft Office viewer also failed');
                          setPreviewError('External viewers cannot access this document. This is common in development environments or when files require authentication. Please download the file to view it.');
                        }}
                      />
                      
                      {/* Enhanced help message for Office viewer */}
                      <Box sx={{ 
                        position: 'absolute', 
                        bottom: 10, 
                        left: 10, 
                        right: 10,
                        display: 'flex',
                        justifyContent: 'center'
                      }}>
                        <Alert severity="warning" sx={{ maxWidth: '80%' }}>
                          <Typography variant="body2">
                            <strong>External Preview Limitation:</strong> Microsoft Office viewer cannot access files from localhost (development environment). 
                            This will work in production with a public domain. For now, please{' '}
                            <Button 
                              size="small" 
                              onClick={() => handleDownload(previewAttachment)}
                              sx={{ textTransform: 'none', p: 0, minWidth: 'auto', color: 'inherit', textDecoration: 'underline' }}
                            >
                              download the file
                            </Button>{' '}
                            to view it, or try the{' '}
                            <Button 
                              size="small" 
                              onClick={() => setPreviewMethod('google')}
                              sx={{ textTransform: 'none', p: 0, minWidth: 'auto', color: 'inherit', textDecoration: 'underline' }}
                            >
                              Google Docs viewer
                            </Button>.
                          </Typography>
                        </Alert>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={handleClosePreview} startIcon={<CloseIcon />}>
            Close
          </Button>
          {previewAttachment && (
            <Button 
              onClick={() => handleDownload(previewAttachment)}
              startIcon={<DownloadIcon />}
              variant="outlined"
            >
              Download
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Wrapper component with authorization protection
const ProjectAttachments = () => {
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
        permissions={["VIEW_PROJECT_ATTACHMENTS", "MANAGE_PROJECT_ATTACHMENTS", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]} 
        requireAll={false}
        showError={true}
      >
        <ErrorBoundary>
          <ProjectAttachmentsContent />
        </ErrorBoundary>
      </PermissionGate>
    </ModuleGate>
  );
};

export default ProjectAttachments; 