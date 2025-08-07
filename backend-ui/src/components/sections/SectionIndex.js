import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, IconButton, Tooltip, Chip, Stack, Typography } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import SectionForm from './SectionForm';
import ReusableDataGrid from '../common/ReusableDataGrid';
import ReusableFilters from '../common/ReusableFilters';
import ReusablePagination from '../common/ReusablePagination';
import SectionErrorBoundary from './SectionErrorBoundary';
import { SectionProvider, useSections } from '../../contexts/SectionContext';
import { languagesApi } from '../../services/api';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import ModuleGate from '../common/ModuleGate';
import PermissionGate from '../common/PermissionGate';
import { logInfo, logError } from '../../utils/logger';

// Filter type definitions matching the backend API parameters
const FILTER_TYPES = {
  code: {
    label: 'Code',
    type: 'text',
    placeholder: 'Filter by section code'
  },
  language_id: {
    label: 'Languages',
    type: 'multiselect',
    placeholder: 'Filter by languages',
    optionsUrl: '/api/languages/',
    optionLabelKey: 'name',
    optionValueKey: 'id',
    renderOption: (option) => `${option.name} (${option.code})`
  }
};

function SectionIndexContent() {
  const {
    sections,
    loading,
    error,
    pagination,
    filters,
    fetchSections,
    updateFilters,
    updatePagination
  } = useSections();

  const { hasPermission, loading: authLoading, permissions } = useAuthorization();

  const [sortModel, setSortModel] = useState([{ field: 'code', sort: 'asc' }]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selectedSection, setSelectedSection] = useState(null);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [gridKey, setGridKey] = useState(0);

  // Fetch available languages for filter options
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await languagesApi.getLanguages({ page: 1, page_size: 100 });
        setAvailableLanguages(response.data.items || []);
      } catch (error) {
        logError('SectionIndex', 'Error fetching languages:', error);
      }
    };
    
    fetchLanguages();
  }, []);

  // Update FILTER_TYPES with dynamic language options
  const dynamicFilterTypes = useMemo(() => {
    const types = { ...FILTER_TYPES };
    if (availableLanguages.length > 0) {
      types.language_id = {
        ...types.language_id,
        options: availableLanguages.map(lang => ({
          value: lang.id,
          label: `${lang.name} (${lang.code})`
        }))
      };
    }
    return types;
  }, [availableLanguages]);

  const FiltersWrapper = ({ filters: currentFilters, onFiltersChange, onSearch }) => (
    <ReusableFilters
      filterTypes={dynamicFilterTypes}
      filters={currentFilters}
      onFiltersChange={onFiltersChange}
      onSearch={onSearch}
    />
  );

  // Define columns for the grid
  const columns = [
    { 
      field: 'code', 
      headerName: 'Code', 
      flex: 1, 
      disableColumnMenu: true,
      minWidth: 150,
      renderHeader: (params) => (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          fontWeight: 500, 
          fontSize: '13px', 
          color: '#505050',
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          letterSpacing: '0.3px'
        }}>
          {params.colDef.headerName}
          {sortModel[0]?.field === 'code' && (
            <Box component="span" sx={{ display: 'inline-flex', ml: 0.5 }}>
              {sortModel[0].sort === 'asc' ? 
                <ArrowUpward fontSize="small" sx={{ fontSize: '1rem', color: '#1976d2' }} /> : 
                <ArrowDownward fontSize="small" sx={{ fontSize: '1rem', color: '#1976d2' }} />
              }
            </Box>
          )}
        </Box>
      ),
    },
    { 
      field: 'section_texts', 
      headerName: 'Languages', 
      flex: 2,
      disableColumnMenu: true,
      sortable: false,
      minWidth: 200,
      valueGetter: (params) => {
        if (!params?.row?.section_texts) return '-';
        const texts = Array.isArray(params.row.section_texts) ? params.row.section_texts : [];
        if (texts.length === 0) return '-';
        return texts.map(text => `${text.language.name} (${text.language.code})`).join(', ');
      },
      renderCell: (params) => {
        if (!params?.row?.section_texts) return <div>-</div>;
        const texts = Array.isArray(params.row.section_texts) ? params.row.section_texts : [];
        if (texts.length === 0) return <div>-</div>;
        
        return (
          <Stack 
            direction="row" 
            spacing={0.5} 
            sx={{ 
              flexWrap: 'wrap', 
              gap: '4px', 
              maxWidth: '100%',
              overflow: 'hidden'
            }}
          >
            {texts.map((text) => (
              <Chip 
                key={text.id}
                label={`${text.language.name} (${text.language.code})`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ 
                  maxWidth: '120px',
                  '.MuiChip-label': {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }
                }}
              />
            ))}
          </Stack>
        );
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        if (!params || !params.row) return null;
        return (
          <Box>
            <PermissionGate permission="EDIT_SECTION">
              <Tooltip title="Edit Section">
                <IconButton 
                  onClick={() => handleEditClick(params.row)} 
                  size="small"
                  sx={{ 
                    color: '#1976d2', 
                    p: 0.5, 
                    mr: 0.5,
                    '&:hover': {
                      backgroundColor: 'rgba(25, 118, 210, 0.04)'
                    }
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </PermissionGate>
            <PermissionGate permission="DELETE_SECTION">
              <Tooltip title="Delete Section">
                <IconButton 
                  onClick={() => handleDeleteClick(params.row)} 
                  size="small" 
                  sx={{ 
                    color: '#e53935', 
                    p: 0.5 
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </PermissionGate>
          </Box>
        );
      }
    }
  ];

  // Initial fetch
  useEffect(() => {
    const initialFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchSections({
      page: pagination.page || 1,
      pageSize: pagination.pageSize || 10,
      include_full_details: true,
      ...initialFilters
    });
  }, [fetchSections]);

  const handlePaginationChange = (model) => {
    logInfo('SectionIndex', 'DataGrid pagination change:', model);
    
    // Convert 0-indexed page from component to 1-indexed for backend
    const backendPaginationModel = {
      ...model,
      page: model.page + 1
    };
    
    // Update context pagination
    updatePagination({
      page: backendPaginationModel.page,
      pageSize: backendPaginationModel.pageSize
    });
    
    // Fetch with new pagination
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchSections({
      page: backendPaginationModel.page,
      pageSize: backendPaginationModel.pageSize,
      include_full_details: true,
      ...currentFilters
    });
  };

  const handleSortModelChange = (newModel) => {
    logInfo('SectionIndex', 'Sort model change:', newModel);
    const updated = newModel.length > 0 ? [newModel[0]] : [{ field: 'code', sort: 'asc' }];
    setSortModel(updated);
    
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchSections({
      page: pagination.page || 1,
      pageSize: pagination.pageSize || 10,
      include_full_details: true,
      ...currentFilters,
      sort_field: updated[0].field,
      sort_order: updated[0].sort
    });
  };

  const handleFiltersChange = (newFilters) => {
    logInfo('SectionIndex', 'Filters changed:', newFilters);
    updateFilters(newFilters);
  };

  const handleSearch = (searchFilters) => {
    logInfo('SectionIndex', 'Search triggered with filters:', searchFilters);
    updateFilters(searchFilters);
    
    // Reset to first page when searching
    updatePagination({
      page: 1,
      pageSize: pagination.pageSize || 10
    });
    
    fetchSections({
      page: 1,
      pageSize: pagination.pageSize || 10,
      include_full_details: true,
      ...searchFilters
    });
  };

  // Handle create button click
  const handleCreateClick = () => {
    logInfo('SectionIndex', 'Create section button clicked');
    setSelectedSection(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  // Handle edit button click
  const handleEditClick = (section) => {
    logInfo('SectionIndex', 'Edit section clicked:', section);
    setSelectedSection(section);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  // Handle delete button click
  const handleDeleteClick = (section) => {
    logInfo('SectionIndex', 'Delete section clicked:', section);
    setSelectedSection(section);
    setFormMode('delete');
    setIsFormOpen(true);
  };

  // Handle form close
  const handleFormClose = (refreshData) => {
    setIsFormOpen(false);
    if (refreshData) {
      const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
      fetchSections({
        page: pagination.page || 1,
        pageSize: pagination.pageSize || 10,
        include_full_details: true,
        ...currentFilters
      });
    }
  };

  if (error) {
    return (
      <Box mt={3} p={3} bgcolor="#ffebee" borderRadius={1}>
        <Typography color="error" variant="h6">Error loading sections</Typography>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%', p: 2 }}>
      <ReusableDataGrid
        key={gridKey}
        title="Sections Management"
        columns={columns}
        rows={sections}
        loading={loading}
        totalRows={pagination.total}
        disableRowSelectionOnClick
        sortModel={sortModel}
        onPaginationModelChange={handlePaginationChange}
        onSortModelChange={handleSortModelChange}
        currentFilters={filters}
        FiltersComponent={FiltersWrapper}
        onFiltersChange={handleFiltersChange}
        onSearch={handleSearch}
        PaginationComponent={({ pagination: paginationData, onPaginationChange }) => {
          const adjustedPaginationData = {
            // Convert 1-indexed page from context to 0-indexed for ReusablePagination
            page: Math.max(0, (paginationData.page || pagination.page || 1) - 1),
            pageSize: paginationData.pageSize || pagination.pageSize || 10,
            total: paginationData.total || pagination.total || 0
          };
          
          return (
            <ReusablePagination
              pagination={adjustedPaginationData}
              onPaginationChange={(newPaginationModel) => {
                logInfo('SectionIndex', 'ReusablePagination change:', newPaginationModel);
                
                // Convert 0-indexed page from ReusablePagination to 1-indexed for backend
                const backendPaginationModel = {
                  ...newPaginationModel,
                  page: newPaginationModel.page + 1
                };
                
                // Update context pagination state FIRST
                updatePagination({
                  page: backendPaginationModel.page,
                  pageSize: backendPaginationModel.pageSize
                });
                
                // Force grid refresh by updating key
                setGridKey(prev => prev + 1);
                
                // Then call fetchSections with the new pagination
                const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
                fetchSections({
                  page: backendPaginationModel.page,
                  pageSize: backendPaginationModel.pageSize,
                  include_full_details: true,
                  ...currentFilters
                });
              }}
            />
          );
        }}
        {...(hasPermission('CREATE_SECTION') ? {
          createButtonText: "Section",
          onCreateClick: handleCreateClick
        } : {})}
        defaultPageSize={pagination.pageSize}
        uiVariant="categoryIndex"
        paginationPosition="top"
        gridSx={{
          '.MuiDataGrid-iconButtonContainer': { display: 'none', visibility: 'hidden', width: 0, opacity: 0 },
          '.MuiDataGrid-sortIcon': { display: 'none', visibility: 'hidden', opacity: 0 },
          '.MuiDataGrid-columnHeader': { display: 'flex', visibility: 'visible', opacity: 1 },
          '.MuiDataGrid-columnHeaderTitle': { display: 'block', visibility: 'visible', opacity: 1, fontWeight: 500, color: '#505050' },
          '& .MuiDataGrid-footerContainer': { display: 'none' }
        }}
      />

      {isFormOpen && (
        <SectionForm
          open={isFormOpen}
          onClose={handleFormClose}
          section={selectedSection}
          mode={formMode}
        />
      )}
    </Box>
  );
}

// Main Section Index component with context provider and error boundary
function SectionIndex() {
  return (
    <ModuleGate moduleName="sections" showError={true}>
      <SectionErrorBoundary>
        <SectionProvider>
          <SectionIndexContent />
        </SectionProvider>
      </SectionErrorBoundary>
    </ModuleGate>
  );
}

export default SectionIndex;
