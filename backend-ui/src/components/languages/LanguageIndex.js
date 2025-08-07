import React, { useState, useCallback, useEffect } from 'react';
import { 
  Box, 
  IconButton, 
  Tooltip, 
  Avatar, 
  Container,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import LanguageForm from './LanguageForm';
import ReusableDataGrid from '../common/ReusableDataGrid';
import ReusableFilters from '../common/ReusableFilters';
import ReusablePagination from '../common/ReusablePagination';
import { useLanguage } from '../../contexts/LanguageContext';
import { LanguageErrorBoundary } from '../../contexts/LanguageContext';
import { API_CONFIG } from '../../config/apiConfig';
import { logInfo } from '../../utils/logger';

// Filter types configuration for ReusableFilters
const FILTER_TYPES = {
  name: {
    label: 'Name',
    type: 'text',
    placeholder: 'Search by language name'
  },
  code: {
    label: 'Code',
    type: 'text',
    placeholder: 'Search by language code'
  },
  is_default: {
    label: 'Default Language',
    type: 'multiselect',
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' }
    ]
  }
};

function LanguageIndexContent() {
  const { 
    languages, 
    loading, 
    error, 
    pagination, 
    setPagination,
    filters, 
    fetchLanguages, 
    updateFilters 
  } = useLanguage();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [sortModel, setSortModel] = useState([
    {
      field: 'name',
      sort: 'asc',
    },
  ]);

  // Helper function to convert filters from UI format to backend format
  const convertFiltersForBackend = useCallback((uiFilters) => {
    const backendFilters = { ...uiFilters };
    
    // Convert is_default multiselect array to boolean for backend
    if (backendFilters.is_default !== undefined) {
      if (Array.isArray(backendFilters.is_default)) {
        if (backendFilters.is_default.length === 1) {
          // Single selection from multiselect
          const value = backendFilters.is_default[0];
          if (value === 'true') {
            backendFilters.is_default = true;
          } else if (value === 'false') {
            backendFilters.is_default = false;
          } else {
            delete backendFilters.is_default;
          }
        } else if (backendFilters.is_default.length === 0) {
          // No selection - remove filter
          delete backendFilters.is_default;
        } else {
          // Multiple selections - this shouldn't happen for boolean, but handle gracefully
          delete backendFilters.is_default;
        }
      }
    }
    
    return backendFilters;
  }, []);

  // Fetch languages on component mount
  useEffect(() => {
    const backendFilters = convertFiltersForBackend(filters);
    fetchLanguages(
      pagination.page, 
      pagination.page_size, 
      backendFilters,
      sortModel
    );
  }, [fetchLanguages, pagination.page, pagination.page_size, filters, sortModel, convertFiltersForBackend]);

  // Handle pagination changes
  const handlePaginationChange = useCallback((newPaginationModel) => {
    logInfo('LanguageIndex - Pagination change:', newPaginationModel);
    
    // Convert 0-indexed page from ReusablePagination to 1-indexed for backend
    const backendPage = newPaginationModel.page + 1;
    
    // Update context pagination state
    setPagination(prev => ({ 
      ...prev, 
      page: backendPage, 
      page_size: newPaginationModel.pageSize 
    }));
    
    // Convert UI filters to backend format
    const backendFilters = convertFiltersForBackend(filters);
    
    // Fetch data with new pagination
    fetchLanguages(backendPage, newPaginationModel.pageSize, backendFilters, sortModel);
  }, [fetchLanguages, filters, sortModel, setPagination, convertFiltersForBackend]);

  // Handle sort model changes
  const handleSortModelChange = useCallback((newSortModel) => {
    logInfo('LanguageIndex - Sort model changed:', newSortModel);
    setSortModel(newSortModel);
    
    // Convert UI filters to backend format
    const backendFilters = convertFiltersForBackend(filters);
    
    // Refresh data with new sort model
    fetchLanguages(
      pagination.page, 
      pagination.page_size, 
      backendFilters,
      newSortModel
    );
  }, [fetchLanguages, pagination.page, pagination.page_size, filters, convertFiltersForBackend]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters) => {
    logInfo('LanguageIndex - Filters changed:', newFilters);
    
    // Keep the original UI format (arrays for multiselect) in context for proper display
    const uiFilters = { ...newFilters };
    
    // Remove empty filters for cleaner state
    Object.keys(uiFilters).forEach(key => {
      const value = uiFilters[key];
      if (value === undefined || value === null || value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        delete uiFilters[key];
      }
    });
    
    logInfo('LanguageIndex - UI filters to store in context:', uiFilters);
    
    // Update filters in context with UI format
    updateFilters(uiFilters);
    
    // Convert to backend format for API call
    const backendFilters = convertFiltersForBackend(uiFilters);
    logInfo('LanguageIndex - Backend filters for API call:', backendFilters);
    
    // Reset to first page when filters change and fetch data
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchLanguages(1, pagination.page_size, backendFilters, sortModel);
  }, [updateFilters, pagination.page_size, sortModel, fetchLanguages, setPagination, convertFiltersForBackend]);

  // Handle search
  const handleSearch = useCallback((searchFilters) => {
    logInfo('LanguageIndex - Search triggered:', searchFilters);
    handleFiltersChange(searchFilters);
  }, [handleFiltersChange]);

  // Define columns for the grid
  const columns = [
    { 
      field: 'image', 
      headerName: 'Flag', 
      width: 85,
      disableColumnMenu: true,
      sortable: false,
      renderCell: (params) => {
        // Construct proper image URL
        let imageUrl = '';
        if (params.row.image) {
          // The backend stores image paths like "language_images/filename.ext"
          // and serves static files from /uploads
          if (params.row.image.startsWith('language_images/')) {
            imageUrl = `${API_CONFIG.BASE_URL}/uploads/${params.row.image}`;
          } else {
            // Handle case where image might be just the filename
            imageUrl = `${API_CONFIG.BASE_URL}/uploads/language_images/${params.row.image}`;
          }
        }
          
        return (
          <Avatar 
            src={imageUrl} 
            alt={params.row.name}
            variant="rounded"
            sx={{ 
              width: 40, 
              height: 30, 
              border: '1px solid #eee',
              bgcolor: imageUrl ? 'transparent' : '#f0f0f0'
            }}
            onError={(e) => {
              // On error, show language code instead
              console.warn(`Failed to load flag image for ${params.row.name}: ${imageUrl}`);
              e.target.style.display = 'none';
            }}
          >
            {params.row.code?.substring(0, 2).toUpperCase()}
          </Avatar>
        );
      }
    },
    { 
      field: 'name', 
      headerName: 'Name', 
      flex: 1, 
      minWidth: 150,
      disableColumnMenu: true
    },
    { 
      field: 'code', 
      headerName: 'Code', 
      width: 120,
      disableColumnMenu: true
    },
    { 
      field: 'is_default', 
      headerName: 'Default', 
      width: 120,
      disableColumnMenu: true,
      type: 'boolean',
      renderCell: (params) => (
        <div>
          {params.value ? 'Yes' : 'No'}
        </div>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Edit Language">
            <IconButton 
              onClick={() => handleEditClick(params.row)} 
              size="small" 
              sx={{ 
                color: '#1976d2',
                padding: '4px',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.04)'
                }
              }}
            >
              <EditIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Language">
            <IconButton 
              onClick={() => handleDeleteClick(params.row)} 
              size="small" 
              sx={{ 
                color: '#e53935 !important',
                padding: '4px',
                '&:hover': {
                  backgroundColor: 'rgba(229, 57, 53, 0.04)'
                }
              }}
            >
              <DeleteIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  // Handle create button click
  const handleCreateClick = () => {
    setSelectedLanguage(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  // Handle edit button click
  const handleEditClick = (language) => {
    setSelectedLanguage(language);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  // Handle delete button click
  const handleDeleteClick = (language) => {
    setSelectedLanguage(language);
    setFormMode('delete');
    setIsFormOpen(true);
  };

  // Handle form close
  const handleFormClose = (shouldRefresh) => {
    setIsFormOpen(false);
    if (shouldRefresh) {
      // Convert UI filters to backend format
      const backendFilters = convertFiltersForBackend(filters);
      fetchLanguages(pagination.page, pagination.page_size, backendFilters, sortModel);
    }
  };
  
  return (
    <Box sx={{ height: '100%', width: '100%', p: 2 }}>
      <ReusableDataGrid
        title="Languages Management"
        columns={columns}
        rows={languages}
        loading={loading}
        totalRows={pagination.total}
        disableRowSelectionOnClick
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        currentFilters={filters}
        FiltersComponent={() => (
          <ReusableFilters
            filterTypes={FILTER_TYPES}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onSearch={handleSearch}
          />
        )}
        PaginationComponent={({ pagination: paginationData, onPaginationChange }) => {
          // Debug logging to understand what's happening
          logInfo('LanguageIndex - PaginationComponent render:', {
            paginationDataFromGrid: paginationData,
            contextPagination: pagination,
            languagesCount: languages.length
          });
          
          const adjustedPaginationData = {
            // Convert 1-indexed page from context to 0-indexed for ReusablePagination
            page: Math.max(0, (pagination.page || 1) - 1),
            pageSize: pagination.page_size || 10,
            total: pagination.total || 0
          };
          
          logInfo('LanguageIndex - Adjusted pagination data:', adjustedPaginationData);
          
          return (
            <ReusablePagination
              pagination={adjustedPaginationData}
              onPaginationChange={handlePaginationChange}
            />
          );
        }}
        createButtonText="Language"
        onCreateClick={handleCreateClick}
        defaultPageSize={pagination.page_size}
        uiVariant="categoryIndex"
        paginationPosition="top"
        gridSx={{
          '.MuiDataGrid-columnHeaders': {
            backgroundColor: 'rgba(250, 250, 250, 0.8)',
            color: '#505050',
            fontWeight: 500,
            fontSize: 13,
            letterSpacing: '0.3px',
            borderBottom: '1px solid #e0e0e0',
            borderTopLeftRadius: '5px',
            borderTopRightRadius: '5px',
          },
          '.MuiDataGrid-cell': {
            fontSize: '13px',
            borderBottom: '1px solid #f5f5f5',
            backgroundColor: 'white'
          },
          '.MuiDataGrid-row': {
            backgroundColor: 'white'
          },
          '.MuiDataGrid-row:hover': {
            backgroundColor: 'rgba(25, 118, 210, 0.04)'
          }
        }}
      />

      {isFormOpen && (
        <Dialog 
          open={isFormOpen} 
          onClose={() => handleFormClose(false)} 
          maxWidth="sm" 
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '6px',
              boxShadow: '0 3px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)',
              overflow: 'hidden'
            }
          }}
        >
          <DialogTitle 
            sx={{
              pb: 1.5, 
              pt: 2.5,
              px: 3, 
              fontWeight: 500,
              fontSize: '16px',
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              color: '#1976d2',
              borderBottom: 1,
              borderColor: '#f0f0f0',
              letterSpacing: '0.015em'
            }}
          >
            {formMode === 'create' ? 'Create Language' : 
             formMode === 'edit' ? 'Edit Language' : 'Delete Language'}
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <LanguageForm
              open={isFormOpen}
              onClose={handleFormClose}
              language={selectedLanguage}
              mode={formMode}
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
}

// Wrap the component with ErrorBoundary
function LanguageIndex() {
  return (
    <LanguageErrorBoundary>
      <LanguageIndexContent />
    </LanguageErrorBoundary>
  );
}

export default LanguageIndex;
