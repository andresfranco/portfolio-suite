import React, { useState, useEffect } from 'react';
import { Box, IconButton, Tooltip, Chip, Alert, CircularProgress, Typography, Container, Button, Stack, Grid } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add, KeyboardArrowLeft, KeyboardArrowRight, ArrowUpward, ArrowDownward, Visibility as VisibilityIcon } from '@mui/icons-material';
import RoleForm from './RoleForm';
import ReusableDataGrid from '../common/ReusableDataGrid';
import RoleFilters from './RoleFilters';
import { useRole, RoleProvider } from '../../contexts/RoleContext';
import RoleErrorBoundary from './RoleErrorBoundary';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import PermissionGate from '../common/PermissionGate';
import ModuleGate from '../common/ModuleGate';
import { logInfo, logError } from '../../utils/logger';
import { API_CONFIG } from '../../config/apiConfig';

// Custom pagination component with a native select
const CustomPagination = (props) => {
  const { pagination, setPagination, pageSizeOptions = [5, 10, 15, 20, 25], onPaginationChange } = props;
  
  const handleChangePageSize = (e) => {
    const newPageSize = parseInt(e.target.value, 10);
    console.log('CustomPagination: Page size changed to', newPageSize);
    
    // Call the provided callback to update pagination
    if (onPaginationChange) {
      onPaginationChange({ page: 0, pageSize: newPageSize });
    }
  };
  
  const handlePrevPage = () => {
    if (pagination.page > 0) {
      console.log('CustomPagination: Moving to previous page');
      if (onPaginationChange) {
        onPaginationChange({ ...pagination, page: pagination.page - 1 });
      }
    }
  };
  
  const handleNextPage = () => {
    const lastPage = Math.ceil(pagination.total / pagination.pageSize) - 1;
    if (pagination.page < lastPage) {
      console.log('CustomPagination: Moving to next page');
      if (onPaginationChange) {
        onPaginationChange({ ...pagination, page: pagination.page + 1 });
      }
    }
  };
  
  // Calculate displayed range
  const start = pagination.page * pagination.pageSize + 1;
  const end = Math.min((pagination.page + 1) * pagination.pageSize, pagination.total);
  const isFirstPage = pagination.page === 0;
  const isLastPage = pagination.page >= Math.ceil(pagination.total / pagination.pageSize) - 1;
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'flex-end',
        backgroundColor: 'transparent',
        height: '52px',
        padding: '0 24px',
      }}
    >
      <Typography 
        variant="body2" 
        sx={{ 
          color: 'rgba(0, 0, 0, 0.6)',
          fontSize: '0.8125rem',
          mr: 1
        }}
      >
        Rows per page:
      </Typography>
      
      <select 
        value={pagination.pageSize}
        onChange={handleChangePageSize}
        style={{
          marginRight: '24px',
          padding: '4px 24px 4px 8px',
          border: 'none',
          borderRadius: '4px',
          backgroundColor: 'transparent',
          color: 'rgba(0, 0, 0, 0.6)',
          fontSize: '0.8125rem',
          cursor: 'pointer',
          appearance: 'menulist'
        }}
      >
        {pageSizeOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      
      <Typography 
        variant="body2" 
        sx={{ 
          color: 'rgba(0, 0, 0, 0.6)',
          fontSize: '0.8125rem',
          minWidth: '100px',
          textAlign: 'center',
        }}
      >
        {start}-{end} of {pagination.total}
      </Typography>
      
      <Box sx={{ display: 'flex', ml: 2 }}>
        <IconButton 
          onClick={handlePrevPage} 
          disabled={isFirstPage}
          size="small"
          sx={{ 
            color: isFirstPage ? 'rgba(0, 0, 0, 0.26)' : 'rgba(0, 0, 0, 0.54)',
            padding: '6px'
          }}
        >
          <KeyboardArrowLeft />
        </IconButton>
        
        <IconButton 
          onClick={handleNextPage} 
          disabled={isLastPage}
          size="small"
          sx={{
            color: isLastPage ? 'rgba(0, 0, 0, 0.26)' : 'rgba(0, 0, 0, 0.54)',
            padding: '6px'
          }}
        >
          <KeyboardArrowRight />
        </IconButton>
      </Box>
    </Box>
  );
};

function RoleIndexContent() {
  const {
    roles,
    loading,
    error,
    pagination,
    filters,
    fetchRoles,
    updateFilters
  } = useRole();
  
  const { canPerformOperation, hasPermission } = useAuthorization();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  // Initialize with default sort by 'name' ascending
  const [sortModel, setSortModel] = useState([
    {
      field: 'name',
      sort: 'asc'
    }
  ]);
  // Add force update counter to ensure sort icons update
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);

  // Load roles on initial render
  useEffect(() => {
    // Initial data fetch when component mounts
    logInfo('Loading roles on initial render');
    logInfo('API Config for roles:', {
      baseUrl: API_CONFIG.BASE_URL,
      rolesList: API_CONFIG.ENDPOINTS.roles.list,
      fullUrl: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.roles.list}`
    });
    
    // Log initial params
    logInfo('Initial request params:', {
      page: 1,
      pageSize: pagination.page_size,
      filters: filters,
      sortModel: sortModel
    });
    
    // No need to call setLoading, the fetchRoles function handles this internally
    
    fetchRoles(1, pagination.page_size, filters, sortModel)
      .then(result => {
        logInfo('Initial fetch successful:', result);
        // Don't manually set loading, handled by fetchRoles
      })
      .catch(err => {
        const errorMessage = err.message || 'Unknown error';
        // Don't manually set loading, handled by fetchRoles
        
        // Check for specific error types to show helpful messages
        if (errorMessage.includes('Network Error')) {
          logError('Network error during roles fetch. API may be unreachable:', err);
          // The error state will be set by fetchRoles in the Context
        } else if (errorMessage.includes('CORS')) {
          logError('CORS error when fetching roles:', err);
          // The error state will be set by fetchRoles in the Context
        } else if (err.response && err.response.status === 404) {
          logError('API endpoint not found (404):', err);
          // Log API URL for debugging
          logError(`Attempted to access: ${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.roles.list}`);
        } else {
          logError('Error during initial roles fetch:', err);
          logError('Error details:', {
            message: err.message,
            stack: err.stack,
            response: err.response?.data
          });
        }
      });
  }, [fetchRoles, pagination.page_size]); // Remove filters and sortModel from dependencies

  const columns = [
    { 
      field: 'id', 
      headerName: 'ID', 
      flex: 0.5,
      minWidth: 70, 
      disableColumnMenu: true 
    },
    { 
      field: 'name', 
      headerName: 'Role Name', 
      flex: 1,
      minWidth: 180, 
      disableColumnMenu: true,
      sortingOrder: null, // Disable native sorting order
      renderHeader: (params) => {
        const isSorted = sortModel.length > 0 && sortModel[0].field === 'name';
        const sortDirection = isSorted ? sortModel[0].sort : null;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }} onClick={() => {
            // Handle custom sorting
            let newDirection = 'asc';
            if (isSorted && sortDirection === 'asc') newDirection = 'desc';
            handleSortModelChange([{ field: 'name', sort: newDirection }]);
          }}>
            <Typography 
              sx={{ 
                fontWeight: 500, 
                fontSize: '13px', 
                color: '#505050'
              }}
            >
              Role Name
            </Typography>
            {isSorted && (
              <Box sx={{ marginLeft: '4px', display: 'flex', alignItems: 'center' }}>
                {sortDirection === 'asc' ? (
                  <ArrowUpward sx={{ fontSize: '18px', color: '#1976d2' }} />
                ) : (
                  <ArrowDownward sx={{ fontSize: '18px', color: '#1976d2' }} />
                )}
              </Box>
            )}
          </Box>
        );
      }
    },
    { 
      field: 'description', 
      headerName: 'Description', 
      flex: 1.5, 
      minWidth: 250,
      disableColumnMenu: true,
      sortingOrder: null, // Disable native sorting order
      renderHeader: (params) => {
        const isSorted = sortModel.length > 0 && sortModel[0].field === 'description';
        const sortDirection = isSorted ? sortModel[0].sort : null;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }} onClick={() => {
            // Handle custom sorting
            let newDirection = 'asc';
            if (isSorted && sortDirection === 'asc') newDirection = 'desc';
            handleSortModelChange([{ field: 'description', sort: newDirection }]);
          }}>
            <Typography 
              sx={{ 
                fontWeight: 500, 
                fontSize: '13px', 
                color: '#505050'
              }}
            >
              Description
            </Typography>
            {isSorted && (
              <Box sx={{ marginLeft: '4px', display: 'flex', alignItems: 'center' }}>
                {sortDirection === 'asc' ? (
                  <ArrowUpward sx={{ fontSize: '18px', color: '#1976d2' }} />
                ) : (
                  <ArrowDownward sx={{ fontSize: '18px', color: '#1976d2' }} />
                )}
              </Box>
            )}
          </Box>
        );
      }
    },
    {
      field: 'permissions',
      headerName: 'Permissions',
      flex: 2,
      minWidth: 350,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const permissions = params.value || [];
        if (permissions.length === 0) {
          return (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '12px' }}>
              No permissions assigned
            </Typography>
          );
        }
        
        return (
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            width: '100%',
            padding: '12px 16px',
            alignItems: 'flex-start',
            alignContent: 'flex-start',
            overflow: 'visible',
            height: 'auto',
            minHeight: '100%'
          }}>
            {permissions.map((perm, index) => (
              <Chip 
                key={index} 
                label={typeof perm === 'string' ? perm : perm.name || perm.code || '?'} 
                size="small" 
                sx={{
                  height: 'auto',
                  minHeight: '24px',
                  fontSize: '12px',
                  margin: '2px',
                  bgcolor: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  borderRadius: '16px',
                  color: '#333',
                  whiteSpace: 'normal',
                  maxWidth: 'none',
                  '& .MuiChip-label': {
                    padding: '4px 8px',
                    whiteSpace: 'normal',
                    lineHeight: '1.2',
                    display: 'block'
                  }
                }}
              />
            ))}
          </Box>
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
        const canView = hasPermission('VIEW_ROLES');
        const canEdit = hasPermission('EDIT_ROLE');
        const canManage = hasPermission('MANAGE_ROLES');
        
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* Show view icon only if user has VIEW_ROLES but not EDIT_ROLE and not MANAGE_ROLES permission */}
            {canView && !canEdit && !canManage && (
              <Tooltip title="View Role">
                <IconButton
                  onClick={() => handleViewClick(params.row)}
                  size="small"
                  sx={{ 
                    color: '#666666',
                    padding: '4px',
                    '&:hover': {
                      backgroundColor: 'rgba(102, 102, 102, 0.04)'
                    }
                  }}
                >
                  <VisibilityIcon sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              </Tooltip>
            )}
            
            {/* Show edit icon if user has EDIT_ROLE or MANAGE_ROLES permission */}
            {(canEdit || canManage) && (
              <Tooltip title="Edit Role">
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
            )}
            
            {/* Show delete icon if user has DELETE_ROLE or MANAGE_ROLES permission */}
            {(hasPermission('DELETE_ROLE') || canManage) && (
              <Tooltip title="Delete Role">
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
            )}
          </Box>
        );
      },
    },
  ];

  const handleCreateClick = () => {
    setFormMode('create');
    setSelectedRole(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (role) => {
    setFormMode('edit');
    setSelectedRole(role);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (role) => {
    setFormMode('delete');
    setSelectedRole(role);
    setIsFormOpen(true);
  };

  const handleViewClick = (role) => {
    setFormMode('view');
    setSelectedRole(role);
    setIsFormOpen(true);
  };

  const handleFormClose = (shouldRefresh = false) => {
    setIsFormOpen(false);
    
    if (shouldRefresh) {
      // Fetch the current page data after form action
      fetchRoles(pagination.page, pagination.page_size, filters, sortModel);
    }
  };

  const handleFiltersChange = (newFilters) => {
    logInfo('Filter changed:', newFilters);
    
    // Ensure we're working with an object
    const filtersToApply = newFilters || {};
    
    // Clean filters to only include those with actual values
    const cleanedFilters = {};
    
    // Only include filters with values (not empty strings or empty arrays)
    Object.entries(filtersToApply).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Only include non-empty arrays
          if (value.length > 0) {
            cleanedFilters[key] = value;
            logInfo(`Including array filter: ${key} with ${value.length} values`);
          }
        } else if (typeof value === 'string') {
          // Only include non-empty strings
          if (value.trim() !== '') {
            cleanedFilters[key] = value.trim();
            logInfo(`Including string filter: ${key}=${value}`);
          }
        } else if (typeof value === 'number') {
          cleanedFilters[key] = value;
          logInfo(`Including number filter: ${key}=${value}`);
        }
      }
    });
    
    logInfo('Applying cleaned filters:', cleanedFilters);
    
    // Update filters in context (this will update the UI state)
    updateFilters(cleanedFilters);
    
    // When filters change, we should reset to page 1
    // but maintain the current sort order
    fetchRoles(1, pagination.page_size, cleanedFilters, sortModel);
  };

  // Convert 1-indexed pagination from backend to 0-indexed for DataGrid
  const paginationModel = {
    page: (pagination.page || 1) - 1,  // Backend uses 1-based indexing
    pageSize: pagination.page_size || 10
  };

  // Handle pagination model changes from the DataGrid
  const handlePaginationModelChange = (newModel) => {
    console.log('Pagination changed:', newModel);
    
    // Convert 0-indexed page from DataGrid to 1-indexed for backend
    fetchRoles(
      newModel.page + 1,
      newModel.pageSize,
      filters,
      sortModel
    );
  };

  // Handle sort model changes from the DataGrid
  const handleSortModelChange = (newSortModel) => {
    // Log the exact data structure we receive
    logInfo('Sort model changed - Raw data:', JSON.stringify(newSortModel));
    
    // If model is empty, use default sort
    if (!newSortModel || newSortModel.length === 0) {
      const defaultSort = [{ field: 'name', sort: 'asc' }];
      logInfo('Empty sort model provided, using default:', defaultSort);
      setSortModel(defaultSort);
      // Force update to refresh the sort icons
      setForceUpdateCounter(prev => prev + 1);
      fetchRoles(pagination.page, pagination.page_size, filters, defaultSort);
      return;
    }
    
    // Only update if actually changed
    if (JSON.stringify(newSortModel) !== JSON.stringify(sortModel)) {
      logInfo('Sort model changed - Field:', newSortModel[0].field, 'Direction:', newSortModel[0].sort);
      setSortModel(newSortModel);
      // Force update to refresh the sort icons
      setForceUpdateCounter(prev => prev + 1);
      
      // Fetch with new sort model, maintaining current page and filters
      fetchRoles(
        pagination.page,
        pagination.page_size,
        filters,
        newSortModel
      );
    } else {
      logInfo('Sort model unchanged, skipping refetch');
    }
  };

  const columnVisibilityModel = {
    id: false
  };

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '650px', overflow: 'hidden', backgroundColor: '#ffffff', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Box sx={{ px: 3, pb: 3 }}>
          {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 2, 
                  '& .MuiAlert-message': { 
                    width: '100%',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    fontSize: '13px'
                  } 
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                  {error}
                </Typography>
                
                {error.includes('404') && (
                  <Box sx={{ mt: 1, fontSize: '12px' }}>
                    <Typography variant="body2">
                      The API endpoint could not be found. This may be because:
                    </Typography>
                    <ul style={{ marginTop: '4px', paddingLeft: '20px' }}>
                      <li>The API URL path format has changed</li>
                      <li>The endpoint is not implemented on the server</li>
                    </ul>
                    <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace', fontSize: '12px' }}>
                      Expected URL: {API_CONFIG.BASE_URL}{API_CONFIG.ENDPOINTS.roles.list}
                    </Typography>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="error" 
                      sx={{ mt: 1 }}
                      onClick={() => {
                        // Retry the request
                        fetchRoles(pagination.page, pagination.page_size, filters, sortModel);
                      }}
                    >
                      Retry Request
                    </Button>
                  </Box>
                )}
                
                {error.includes('Network') && (
                  <Box sx={{ mt: 1, fontSize: '12px' }}>
                    • Check if the backend server is running at {API_CONFIG?.BASE_URL || '127.0.0.1:8000'}
                    <br />
                    • Verify that the API URL is correct in your configuration
                    <br />
                    • Check for CORS settings on the backend
                  </Box>
                )}
              </Alert>
          )}

          <Box sx={{ px: 3 }}>
            <ReusableDataGrid
              title="Roles Management"
              columns={columns}
              rows={roles || []}
              loading={loading}
              totalRows={pagination.total || 0}
              onPaginationModelChange={handlePaginationModelChange}
              sortModel={sortModel}
              onSortModelChange={handleSortModelChange}
              disableRowSelectionOnClick
              PaginationComponent={CustomPagination}
              paginationPosition="top"
              FiltersComponent={RoleFilters}
              currentFilters={filters}
              onFiltersChange={handleFiltersChange}
              onSearch={handleFiltersChange}
              createButtonText="Role"
              onCreateClick={(hasPermission('CREATE_ROLE') || hasPermission('MANAGE_ROLES')) ? handleCreateClick : undefined}
              columnVisibilityModel={columnVisibilityModel}
            />
          </Box>

          {loading && !roles.length && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress size={40} />
            </Box>
          )}

          {isFormOpen && (
          <RoleForm
            open={isFormOpen}
            onClose={handleFormClose}
            role={selectedRole}
            mode={formMode}
          />
          )}
        </Box>
      </Box>
    </Container>
  );
}

function RoleIndex() {
  return (
    <ModuleGate moduleName="roles" showError={true}>
      <RoleErrorBoundary>
        <RoleProvider>
          <RoleIndexContent />
        </RoleProvider>
      </RoleErrorBoundary>
    </ModuleGate>
  );
}

export default RoleIndex;