import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  TextField,
  Checkbox,
  Toolbar,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  SelectAll as SelectAllIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import SERVER_URL from '../common/BackendServerData';
import { api } from '../../services/api';

// File type constants
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

// Get file icon based on file type
const getFileIcon = (fileName, contentType) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  if (contentType?.includes('pdf') || extension === 'pdf') {
    return <AttachFileIcon sx={{ color: '#d32f2f', fontSize: 24 }} />;
  } else if (contentType?.includes('word') || ['doc', 'docx'].includes(extension)) {
    return <AttachFileIcon sx={{ color: '#1976d2', fontSize: 24 }} />;
  } else if (contentType?.includes('sheet') || contentType?.includes('excel') || ['xls', 'xlsx'].includes(extension)) {
    return <AttachFileIcon sx={{ color: '#388e3c', fontSize: 24 }} />;
  } else if (contentType?.includes('csv') || extension === 'csv') {
    return <AttachFileIcon sx={{ color: '#ff9800', fontSize: 24 }} />;
  } else if (contentType?.includes('json') || extension === 'json') {
    return <AttachFileIcon sx={{ color: '#9c27b0', fontSize: 24 }} />;
  } else if (contentType?.includes('xml') || extension === 'xml') {
    return <AttachFileIcon sx={{ color: '#795548', fontSize: 24 }} />;
  } else if (contentType?.includes('zip') || extension === 'zip') {
    return <AttachFileIcon sx={{ color: '#607d8b', fontSize: 24 }} />;
  }
  return <AttachFileIcon sx={{ color: '#757575', fontSize: 24 }} />;
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

function PortfolioAttachments() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // State management
  const [portfolio, setPortfolio] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Upload states
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});

  // Selection states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState(new Set());

  // Delete states
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Fetch portfolio and attachments on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch portfolio details
        const portfolioResponse = await fetch(`${SERVER_URL}/api/portfolios/${portfolioId}`, {
          credentials: 'include',
          mode: 'cors'
        });
        if (!portfolioResponse.ok) {
          throw new Error(`Failed to fetch portfolio: ${portfolioResponse.statusText}`);
        }
        
        const portfolioData = await portfolioResponse.json();
        setPortfolio(portfolioData);

        // Fetch attachments
        await fetchAttachments();
      } catch (error) {
        console.error('PortfolioAttachments - Error fetching data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (portfolioId) {
      fetchData();
    }
  }, [portfolioId]);

  const fetchAttachments = async () => {
    try {
      console.log(`PortfolioAttachments - Fetching attachments for portfolio ${portfolioId}`);
      const attachmentsResponse = await fetch(`${SERVER_URL}/api/portfolios/${portfolioId}/attachments`, {
        credentials: 'include',
        mode: 'cors'
      });
      if (!attachmentsResponse.ok) {
        throw new Error(`Failed to fetch attachments: ${attachmentsResponse.statusText}`);
      }
      
      const attachmentsData = await attachmentsResponse.json();
      console.log(`PortfolioAttachments - Fetched ${attachmentsData.length} attachments:`, attachmentsData);
      setAttachments(attachmentsData);
    } catch (error) {
      console.error('PortfolioAttachments - Error fetching attachments:', error);
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
        nameEdited: false
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

        console.log(`PortfolioAttachments - Uploading file: ${fileObj.name}`);
        const response = await fetch(`${SERVER_URL}/api/portfolios/${portfolioId}/attachments`, {
          method: 'POST',
          credentials: 'include',
          mode: 'cors',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Upload failed: ${response.status}`);
        }

        const uploadedAttachment = await response.json();
        console.log(`PortfolioAttachments - Successfully uploaded: ${fileObj.name}`, uploadedAttachment);
        successfulUploads.push(uploadedAttachment);
        setUploadProgress(prev => ({ ...prev, [fileObj.id]: 100 }));
        
      } catch (error) {
        console.error(`PortfolioAttachments - Error uploading ${fileObj.name}:`, error);
        failedUploads.push({ name: fileObj.name, error: error.message });
        setUploadProgress(prev => ({ ...prev, [fileObj.id]: -1 }));
      }
    }

    console.log(`PortfolioAttachments - Upload results: ${successfulUploads.length} successful, ${failedUploads.length} failed`);

    // Update state based on results
    if (successfulUploads.length > 0) {
      console.log('PortfolioAttachments - Refreshing attachments list...');
      await fetchAttachments(); // Refresh attachments list
      console.log('PortfolioAttachments - Attachments list refreshed');
    }

    if (failedUploads.length > 0) {
      const errorMessage = failedUploads.map(f => `${f.name}: ${f.error}`).join('; ');
      setUploadError(`Some files failed to upload: ${errorMessage}`);
    } else {
      // All uploads successful (no failed uploads)
      console.log('PortfolioAttachments - All uploads successful, closing dialog');
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
      const response = await fetch(
        `${SERVER_URL}/api/portfolios/${portfolioId}/attachments/${selectedAttachment.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
          mode: 'cors'
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete attachment');
      }

      // Refresh attachments list
      await fetchAttachments();
      setIsDeleteDialogOpen(false);
      setSelectedAttachment(null);
      
    } catch (error) {
      console.error('Error deleting attachment:', error);
      setError(error.message);
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
      fetch(`${SERVER_URL}/api/portfolios/${portfolioId}/attachments/${attachmentId}`, {
        method: 'DELETE',
        credentials: 'include',
        mode: 'cors'
      })
    );

    try {
      await Promise.all(deletePromises);
      await fetchAttachments(); // Refresh attachments
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
          onClick={() => navigate('/portfolios')}
          startIcon={<ArrowBackIcon />}
        >
          Back to Portfolios
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Button 
            variant="outlined" 
            onClick={() => navigate('/portfolios')}
            startIcon={<ArrowBackIcon />}
            sx={{ mb: 2 }}
          >
            Back to Portfolios
          </Button>
          
          <Typography variant="h4" component="h1" gutterBottom>
            Portfolio Attachments
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {portfolio?.name || 'Loading...'}
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            bgcolor: '#1976d2',
            '&:hover': { bgcolor: '#1565c0' }
          }}
        >
          Upload Files
        </Button>
      </Box>

      {/* Selection Toolbar */}
      {attachments.length > 0 && (
        <Toolbar 
          sx={{ 
            pl: 0, 
            pr: 0,
            mb: 2,
            bgcolor: selectionMode ? alpha('#1976d2', 0.08) : 'transparent',
            borderRadius: 1
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
            <Button
              startIcon={<SelectAllIcon />}
              onClick={() => setSelectionMode(!selectionMode)}
              variant={selectionMode ? 'contained' : 'outlined'}
              size="small"
            >
              {selectionMode ? 'Exit Selection' : 'Select Files'}
            </Button>

            {selectionMode && (
              <>
                <Button
                  onClick={handleSelectAll}
                  size="small"
                >
                  {selectedAttachments.size === attachments.length ? 'Deselect All' : 'Select All'}
                </Button>

                {selectedAttachments.size > 0 && (
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={handleBulkDelete}
                    color="error"
                    variant="outlined"
                    size="small"
                  >
                    Delete Selected ({selectedAttachments.size})
                  </Button>
                )}
              </>
            )}
          </Box>
        </Toolbar>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES.join(',')}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Drag and Drop Area */}
      <Paper
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
                    <Typography variant="h6" sx={{ ml: 1, fontSize: '1rem' }}>
                      Attachment
                    </Typography>
                  </Box>
                  
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontWeight: 500,
                      mb: 1,
                      wordWrap: 'break-word',
                      fontSize: '0.875rem'
                    }}
                  >
                    {attachment.file_name}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary">
                    Uploaded: {attachment.created_at ? new Date(attachment.created_at).toLocaleDateString() : 'Unknown'}
                  </Typography>
                </CardContent>
                
                <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    onClick={() => handleDownload(attachment)}
                    startIcon={<DownloadIcon />}
                    sx={{ color: '#1976d2' }}
                  >
                    Download
                  </Button>
                  
                  {!selectionMode && (
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
              <ListItem key={fileObj.id} divider>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={1}>
                    {getFileIcon(fileObj.name, fileObj.type)}
                  </Grid>
                  
                  <Grid item xs={7}>
                    <TextField
                      fullWidth
                      value={fileObj.name}
                      onChange={(e) => handleFilenameChange(index, e.target.value)}
                      disabled={uploadLoading}
                      size="small"
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(fileObj.size)}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={4}>
                    {uploadProgress[fileObj.id] !== undefined && (
                      <Box>
                        {uploadProgress[fileObj.id] === -1 ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ErrorIcon color="error" fontSize="small" />
                            <Typography variant="caption" color="error" sx={{ ml: 0.5 }}>
                              Failed
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
      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedAttachment?.file_name}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={isBulkDeleteDialogOpen} onClose={() => setIsBulkDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Bulk Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedAttachments.size} attachment(s)?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsBulkDeleteDialogOpen(false)} disabled={bulkDeleteLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleBulkDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={bulkDeleteLoading}
            startIcon={bulkDeleteLoading ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {bulkDeleteLoading ? 'Deleting...' : 'Delete All'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PortfolioAttachments; 