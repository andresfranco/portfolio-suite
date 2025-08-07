import React, { useState, useEffect } from 'react';
import { Box, IconButton, Tooltip, Paper, Chip, Container, Typography, Button, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add, KeyboardArrowLeft, KeyboardArrowRight, ArrowUpward, ArrowDownward, Visibility as VisibilityIcon } from '@mui/icons-material';
import PermissionForm from './PermissionForm';
import ReusableDataGrid from '../common/ReusableDataGrid';
import PermissionFilters from './PermissionFilters';
import { usePermission, PermissionProvider } from '../../contexts/PermissionContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { logInfo } from '../../utils/logger';
import PermissionErrorBoundary from './PermissionErrorBoundary';

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

function PermissionIndexContent() {
  // Get permission context for state management
  const { 
    permissions, 
    loading, 
    error, 
    pagination, 
    filters, 
    fetchPermissions, 
    updateFilters 
  } = usePermission();

  const { hasPermission } = useAuthorization();
  
  // Force component to re-render when permissions change
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);
  
  // Effect to update counter when permissions change, forcing a re-render
  useEffect(() => {
    setForceUpdateCounter(prev => prev + 1);
    logInfo(`Permissions updated - length: ${permissions?.length}, applying filters: ${JSON.stringify(filters)}`);
  }, [permissions, filters]);
  
  // UI state management
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selectedPermission, setSelectedPermission] = useState(null);
  // Initialize with default sort by 'name' ascending
  const [sortModel, setSortModel] = useState([
    {
      field: 'name',
      sort: 'asc'
    }
  ]);
  
  // Load permissions on initial render and when dependencies change
  useEffect(() => {
    logInfo('PermissionIndexContent - Loading permissions with filters:', filters);
    fetchPermissions(1, pagination.page_size, filters, sortModel);
  }, [fetchPermissions, pagination.page_size]);
  
  // Create a separate effect that triggers only when filters or sort change
  useEffect(() => {
    logInfo('PermissionIndexContent - Filters or sort changed, refreshing data');
    fetchPermissions(1, pagination.page_size, filters, sortModel);
  }, [fetchPermissions, filters, sortModel, pagination.page_size]);
  
  // Log updated permissions for debugging
  useEffect(() => {
    logInfo(`PermissionIndexContent - Received ${permissions?.length || 0} permissions, with filters: ${JSON.stringify(filters)}`);
    if (permissions && permissions.length > 0) {
      logInfo('PermissionIndexContent - Sample permission names:',
        permissions.slice(0, 3).map(p => p.name));
    }
  }, [permissions, filters]);
  
  // Handle pagination change
  const handlePaginationModelChange = (newModel) => {
    console.log('Pagination changed:', newModel);
    // Convert from 0-indexed (DataGrid) to 1-indexed (API)
    fetchPermissions(newModel.page + 1, newModel.pageSize, filters, sortModel);
  };
  
  // Handle sort model change
  const handleSortModelChange = (newSortModel) => {
    // Log the exact received model for debugging
    logInfo('SORT DEBUG - Received from DataGrid:', JSON.stringify(newSortModel));
    
    // Create a new model to apply
    let updatedSortModel = [];
    
    // If new model has data
    if (newSortModel.length > 0) {
      const newField = newSortModel[0].field;
      
      // Check if we're sorting the same field as before (user clicked same column again)
      if (sortModel.length > 0 && sortModel[0].field === newField) {
        // Same field - toggle direction from current state
        const currentDirection = sortModel[0].sort || 'asc';
        const nextDirection = currentDirection === 'asc' ? 'desc' : 'asc';
        
        updatedSortModel = [{
          field: newField,
          sort: nextDirection
        }];
        logInfo(`SORT DEBUG - Same column clicked, toggling from ${currentDirection} to ${nextDirection}`);
      } else {
        // Different field or first sort, start with ascending
        updatedSortModel = [{
          field: newField,
          sort: 'asc'
        }];
        logInfo(`SORT DEBUG - New column selected: ${newField}, starting with asc`);
      }
    } else {
      // Empty model, default to name ascending
      updatedSortModel = [{ field: 'name', sort: 'asc' }];
      logInfo('SORT DEBUG - Empty model, using default:', JSON.stringify(updatedSortModel));
    }
    
    // Update state with the new model - this will trigger a re-render with our custom headers
    setSortModel(updatedSortModel);
    
    // Log the final sort model being applied
    logInfo('SORT DEBUG - Final sort model being applied:', JSON.stringify(updatedSortModel));
    
    // Force a re-render
    setForceUpdateCounter(Date.now());
    
    // Fetch data with the updated sort model
    fetchPermissions(pagination.page, pagination.page_size, filters, updatedSortModel);
  };
  
  // Handle filter change
  const handleFilterChange = (newFilters) => {
    logInfo('Filter changed:', newFilters);
    
    // Ensure we're working with an object
    const filtersToApply = newFilters || {};
    
    // Clean filters to only include those with actual values
    const cleanedFilters = {};
    
    // Process each filter
    Object.entries(filtersToApply).forEach(([key, value]) => {
      // Handle array values like roles
      if (Array.isArray(value)) {
        if (value.length > 0) {
          cleanedFilters[key] = value;
          logInfo(`Including array filter for ${key} with ${value.length} values`);
        }
      }
      // Handle string values
      else if (value !== undefined && value !== null) {
        const strValue = value.toString().trim();
        if (strValue !== '') {
          cleanedFilters[key] = strValue;
          logInfo(`Including string filter for ${key}: "${strValue}"`);
        }
      }
    });
    
    logInfo('Applying cleaned filters:', cleanedFilters);
    
    // Update filters in context - this will trigger the useEffect due to filters dependency
    updateFilters(cleanedFilters);
    
    // Force a re-render by updating the counter
    setForceUpdateCounter(prev => prev + 1);
    
    // Explicitly fetch permissions with the new filters - force page 1 when filtering
    fetchPermissions(1, pagination.page_size, cleanedFilters, sortModel);
  };
  
  // Create a new permission
  const handleCreateClick = () => {
    setFormMode('create');
    setSelectedPermission(null);
    setIsFormOpen(true);
    console.log('Opening create permission form');
  };
  
  // Edit an existing permission
  const handleEditClick = (permission) => {
    setFormMode('edit');
    setSelectedPermission(permission);
    setIsFormOpen(true);
    console.log('Opening edit permission form for:', permission);
  };
  
  // Delete a permission
  const handleDeleteClick = (permission) => {
    setFormMode('delete');
    setSelectedPermission(permission);
    setIsFormOpen(true);
    console.log('Opening delete permission confirmation for:', permission);
  };

  // View a permission
  const handleViewClick = (permission) => {
    setFormMode('view');
    setSelectedPermission(permission);
    setIsFormOpen(true);
    console.log('Opening view permission for:', permission);
  };
  
  // Form close handler
  const handleFormClose = (shouldRefresh) => {
    setIsFormOpen(false);
    console.log('Closing permission form, shouldRefresh:', shouldRefresh);
    
    // If changes were made, refresh the data
    if (shouldRefresh) {
      fetchPermissions(pagination.page, pagination.page_size, filters, sortModel);
    }
  };

  // Define columns for the data grid
  const columns = [
    {
      field: "id",
      headerName: "ID",
      flex: 0.5,
      minWidth: 70,
      disableColumnMenu: true,
    },
    {
      field: "name",
      headerName: "Permission Name",
      flex: 1,
      minWidth: 180,
      disableColumnMenu: true,
      renderHeader: (params) => {
        const isSorted = sortModel.length > 0 && sortModel[0].field === 'name';
        const sortDirection = isSorted ? sortModel[0].sort : null;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <Typography 
              sx={{ 
                fontWeight: 500, 
                fontSize: '13px', 
                color: '#505050'
              }}
            >
              Permission Name
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
      field: "description",
      headerName: "Description",
      flex: 2,
      minWidth: 250,
      disableColumnMenu: true,
      renderHeader: (params) => {
        const isSorted = sortModel.length > 0 && sortModel[0].field === 'description';
        const sortDirection = isSorted ? sortModel[0].sort : null;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
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
      field: "roles",
      headerName: "Assigned Roles",
      flex: 1.5,
      minWidth: 200,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const roles = params.row.roles || [];
        return roles.length > 0 ? (
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
            {roles.map((role, index) => (
              <Chip 
                key={index} 
                label={typeof role === 'string' ? role : role.name} 
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
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: '12px' }}>
            No roles assigned
          </Typography>
        )
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const canView = hasPermission('VIEW_PERMISSIONS');
        const canEdit = hasPermission('EDIT_PERMISSION') || hasPermission('MANAGE_PERMISSIONS');
        const canDelete = hasPermission('DELETE_PERMISSION') || hasPermission('MANAGE_PERMISSIONS');
        
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {canView && !canEdit && (
              <Tooltip title="View Permission">
                <IconButton
                  onClick={() => handleViewClick(params.row)}
                  size="small"
                  sx={{ 
                    color: '#1976d2',
                    padding: '4px',
                    '&:hover': {
                      backgroundColor: 'rgba(25, 118, 210, 0.04)'
                    }
                  }}
                >
                  <VisibilityIcon sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title="Edit Permission">
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
            {canDelete && (
              <Tooltip title="Delete Permission">
                <IconButton
                  onClick={() => handleDeleteClick(params.row)}
                  size="small"
                  sx={{ 
                    color: '#e53935',
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

  // Convert 1-indexed backend pagination to 0-indexed DataGrid pagination
  const paginationModel = {
    page: (pagination.page || 1) - 1,
    pageSize: pagination.page_size || 10
  };

  const columnVisibilityModel = {
    id: false
  };
  
  // Use memoized sort model to prevent unnecessary re-renders
  const currentSortModel = React.useMemo(() => {
    return sortModel && sortModel.length > 0 ? 
      [...sortModel] : // Use spread operator instead of JSON for reference copying
      [{ field: 'name', sort: 'asc' }];
  }, [sortModel]);
  
  // Debug log whenever sortModel changes to track issues
  useEffect(() => {
    logInfo("PermissionIndex - sortModel changed:", JSON.stringify(sortModel));
  }, [sortModel]);
  
  // Debug log whenever currentSortModel changes
  useEffect(() => {
    logInfo("PermissionIndex - currentSortModel updated:", JSON.stringify(currentSortModel));
  }, [currentSortModel]);

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: '650px',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <Box sx={{ p: 3, pb: 2 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 600, 
              color: '#1976d2',
              mb: 1,
              letterSpacing: '0.015em'
            }}
          >
            Permissions Management
          </Typography>
          <Box 
            sx={{ 
              height: '2px', 
              width: '100%', 
              bgcolor: '#1976d2', 
              opacity: 0.7,
              mb: 2
            }} 
          />
          
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'flex-end',
            alignItems: 'center',
            mt: 2,
            mb: 1
          }}>
            {/* Removing the New Permission button from here */}
          </Box>
        </Box>
        
        <Box sx={{ px: 3 }}>
          <PermissionFilters 
            onFilterChange={handleFilterChange} 
            filters={filters} 
            onSearch={handleFilterChange} 
            key={`permission-filters-${JSON.stringify(filters)}`}
          />
        </Box>
        
        <Box sx={{ 
          flex: 1,
          minHeight: 'auto', // Changed from '550px' to 'auto'
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          px: 3,
          pb: 3,
          '& .css-19midj6': {
            padding: '0px !important',
          },
          '&::-webkit-scrollbar': {
            display: 'none',
            width: '0px',
            height: '0px',
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '& *': {
            '&::-webkit-scrollbar': {
              display: 'none',
              width: '0px',
              height: '0px',
            },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          },
          '& .MuiDataGrid-root': {
            borderRadius: '5px',
            overflow: 'hidden',
          },
          '& .MuiDataGrid-main': {
            borderTopLeftRadius: '5px',
            borderTopRightRadius: '5px'
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: 'rgba(250, 250, 250, 0.8)',
            borderTopLeftRadius: '5px',
            borderTopRightRadius: '5px'
          }
        }}>
          <style>
            {`
              ::-webkit-scrollbar {
                display: none !important;
                width: 0 !important;
                height: 0 !important;
              }
              * {
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
              }
              
              .css-1xs4aeo-MuiContainer-root {
                margin: 0 !important;
                padding: 0 !important;
                max-width: 100% !important;
              }
              
              /* MAXIMUM FORCE OVERRIDES - Target all possible row/cell classes */
              
              /* Disable all virtual scrolling features */
              .MuiDataGrid-root .MuiDataGrid-virtualScroller,
              .MuiDataGrid-virtualScroller,
              .MuiDataGrid-root .MuiDataGrid-virtualScrollerContent,
              .MuiDataGrid-virtualScrollerContent,
              .MuiDataGrid-root .MuiDataGrid-virtualScrollerRenderZone,
              .MuiDataGrid-virtualScrollerRenderZone {
                position: static !important;
                transform: none !important;
                width: 100% !important; 
                height: auto !important;
                overflow: visible !important;
                display: block !important;
              }
              
              /* Direct targeting of base rows - highest priority */
              .MuiDataGrid-row,
              .MuiDataGrid-root .MuiDataGrid-row,
              div[class*="-MuiDataGrid-row"],
              .css-1jim79h-MuiDataGrid-root .MuiDataGrid-row,
              div.MuiDataGrid-root div.MuiDataGrid-row {
                height: auto !important;
                min-height: 60px !important;
                max-height: none !important;
                width: 100% !important;
                display: flex !important;
                align-items: stretch !important;
                position: relative !important;
                box-sizing: border-box !important;
                border-bottom: 1px solid rgba(224, 224, 224, 0.7) !important;
                transform: none !important;
                overflow: visible !important;
              }
              
              /* Direct targeting of row cells */
              .MuiDataGrid-cell,
              .MuiDataGrid-root .MuiDataGrid-cell,
              div[class*="-MuiDataGrid-cell"],
              .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell {
                height: auto !important;
                min-height: 100% !important;
                max-height: none !important;
                display: flex !important;
                align-items: stretch !important;
                white-space: normal !important;
                line-height: 1.5 !important;
                position: relative !important;
                padding: 8px 16px !important;
                box-sizing: border-box !important;
                transform: none !important;
                overflow: visible !important;
                border-right: 1px solid rgba(224, 224, 224, 0.5) !important;
              }
              
              /* Roles cells override */
              .MuiDataGrid-cell[data-field="roles"],
              .MuiDataGrid-root .MuiDataGrid-cell[data-field="roles"],
              div[class*="-MuiDataGrid-cell"][data-field="roles"],
              .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell[data-field="roles"] {
                height: auto !important;
                min-height: 100% !important;
                max-height: none !important;
                padding: 0 !important;
                align-items: flex-start !important;
                overflow: visible !important;
                z-index: 1 !important;
              }
              
              /* Roles cell inner container */
              .MuiDataGrid-cell[data-field="roles"] > div,
              .MuiDataGrid-root .MuiDataGrid-cell[data-field="roles"] > div,
              div[class*="-MuiDataGrid-cell"][data-field="roles"] > div,
              .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell[data-field="roles"] > div {
                height: auto !important;
                min-height: 100% !important;
                max-height: none !important;
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 8px !important;
                align-items: flex-start !important;
                align-content: flex-start !important;
                width: 100% !important;
                padding: 12px 16px !important;
                overflow: visible !important;
              }
              
              /* Role chips styling */
              .MuiDataGrid-cell[data-field="roles"] .MuiChip-root,
              .MuiDataGrid-root .MuiDataGrid-cell[data-field="roles"] .MuiChip-root {
                height: auto !important;
                min-height: 24px !important;
                margin: 2px !important;
                border-radius: 16px !important;
                background-color: #f5f5f5 !important;
                border: 1px solid #e0e0e0 !important;
                flex-shrink: 0 !important;
                max-width: none !important;
              }
              
              /* Actions cell styling */
              .MuiDataGrid-cell[data-field="actions"],
              .MuiDataGrid-root .MuiDataGrid-cell[data-field="actions"],
              div[class*="-MuiDataGrid-cell"][data-field="actions"],
              .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell[data-field="actions"] {
                width: 120px !important;
                min-width: 120px !important;
                max-width: 120px !important;
                justify-content: center !important;
                align-items: center !important;
                flex-shrink: 0 !important;
                padding: 8px 0 !important;
                overflow: visible !important;
                z-index: 2 !important;
              }
              
              /* Base grid styling keeps intact */
              .MuiDataGrid-root {
                border: 1px solid rgba(224, 224, 224, 1) !important;
                border-radius: 4px !important;
                overflow: visible !important;
              }
              
              /* Structure styles to ensure the grid stays cohesive */
              .MuiDataGrid-columnHeaders {
                background-color: rgba(245, 247, 250, 1) !important;
                border-bottom: 1px solid rgba(224, 224, 224, 1) !important;
                z-index: 10 !important;
                position: sticky !important;
                top: 0 !important;
              }
              
              .MuiDataGrid-columnHeaderTitle {
                font-weight: 500 !important;
                color: #333 !important;
              }
              
              .MuiDataGrid-columnSeparator {
                visibility: visible !important;
                color: rgba(224, 224, 224, 1) !important;
              }
              
              /* Eliminate space between rows and footer */
              .MuiDataGrid-main {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
              }
              
              .MuiDataGrid-virtualScroller {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
              }
              
              .MuiDataGrid-virtualScrollerContent {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
              }
              
              .MuiDataGrid-virtualScrollerRenderZone {
                margin-bottom: 0 !important;
                padding-bottom: 0 !important;
              }
              
              /* Any class that matches DataGrid main container */
              div[class*="-MuiDataGrid-main"],
              .MuiDataGrid-main {
                position: static !important;
                overflow: visible !important;
                height: auto !important;
                width: 100% !important;
              }
              
              /* Catch-all for any internal virtualization classes */
              [class*="MuiDataGrid-"][style*="height"],
              [class*="MuiDataGrid-"][style*="maxHeight"],
              [class*="MuiDataGrid-"][style*="overflow"] {
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
              }
              
              /* Completely hide built-in pagination footer - extreme approach */
              .MuiDataGrid-footerContainer, 
              div.MuiDataGrid-footerContainer,
              .MuiDataGrid-root .MuiDataGrid-footerContainer,
              div[class*="-MuiDataGrid-footerContainer"] {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                min-height: 0 !important;
                max-height: 0 !important;
                overflow: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
              }
              
              /* Fix for sort icons - ONLY hide the buttons, not the entire header */
              .MuiDataGrid-columnHeader .MuiDataGrid-iconButtonContainer {
                display: none !important;
                visibility: hidden !important;
                width: 0 !important;
                opacity: 0 !important;
              }
              
              /* Hide ONLY the default sort icon */
              .MuiDataGrid-sortIcon {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
              }
              
              /* Make sure column headers stay visible */
              .MuiDataGrid-columnHeader,
              .MuiDataGrid-columnHeaderTitle,
              .MuiDataGrid-columnHeaderTitleContainer {
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
              }
              
              /* Ensure our custom sort icons are always visible */
              .custom-sort-icon {
                display: inline-flex !important;
                visibility: visible !important;
                opacity: 1 !important;
              }

              /* For hiding MUI DataGrid native sort icons */
              .hide-sort-icons {
                display: none !important;
                width: 0 !important;
                height: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                opacity: 0 !important;
                visibility: hidden !important;
              }
              
              /* Extra specific selectors to forcibly hide sort icons */
              div[role="columnheader"] > div > div > button,
              .MuiDataGrid-columnHeader > .MuiDataGrid-columnHeaderTitleContainer > .MuiDataGrid-iconButtonContainer,
              .MuiDataGrid-columnSeparator {
                display: none !important;
                visibility: hidden !important;
                width: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
              }
            `}
          </style>
          <PermissionErrorBoundary>
            {/* Position the custom pagination at the top right, above the grid */}
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                marginBottom: '16px',
                paddingTop: '4px',
                paddingBottom: '4px',
              }}
            >
              {/* New Permission button placed at the left side */}
              {(hasPermission('CREATE_PERMISSION') || hasPermission('MANAGE_PERMISSIONS')) && (
                <Button 
                  variant="outlined" 
                  size="small" 
                  startIcon={<Add fontSize="small" />} 
                  onClick={handleCreateClick}
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
                  New Permission
                </Button>
              )}

              <CustomPagination 
                pagination={{
                  page: paginationModel.page,
                  pageSize: paginationModel.pageSize,
                  total: pagination.total
                }}
                pageSizeOptions={[5, 10, 15, 20, 25]}
                onPaginationChange={(newModel) => {
                  console.log('Custom pagination change:', newModel);
                  handlePaginationModelChange(newModel);
                }}
              />
            </Box>

            <Box sx={{
              backgroundColor: 'rgba(250, 250, 250, 0.8)',
              borderRadius: '5px',
              overflow: 'hidden',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              '& .MuiDataGrid-root, & .MuiDataGrid-main, & .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeadersInner': {
                backgroundColor: 'rgba(250, 250, 250, 0.8) !important',
                borderTopLeftRadius: '5px !important',
                borderTopRightRadius: '5px !important',
              }
            }}
            key={`grid-container-${JSON.stringify(sortModel)}-${forceUpdateCounter}`}
            >
              {/* Create a key that changes every time sort changes */}
              <Box 
                key={`grid-container-${sortModel[0]?.field}-${sortModel[0]?.sort}-${Date.now()}`} 
                sx={{ width: '100%', height: '100%' }}
              >
                <ReusableDataGrid
                  columns={columns}
                  rows={permissions || []}
                  loading={loading}
                  totalRows={pagination.total || 0}
                  paginationModel={paginationModel}
                  onPaginationModelChange={handlePaginationModelChange}
                  sortModel={sortModel}
                  onSortModelChange={handleSortModelChange}
                  paginationMode="server"
                  sortingMode="server"
                  filterMode="server"
                  columnVisibilityModel={columnVisibilityModel}
                  disableRowSelectionOnClick={true}
                  height="auto"
                  autoHeight={true}
                  hideFooter={true}
                  hideFooterPagination={true}
                  hideFooterSelectedRowCount={true}
                  disableColumnMenu={true}
                  disableColumnSelector={true}
                  disableDensitySelector={true}
                  disableColumnFilter={true}
                  slots={{
                    footer: () => null,
                    pagination: () => null
                  }}
                  getRowHeight={(params) => {
                    const roles = params.model.roles || [];
                    if (roles.length === 0) {
                      return 70; // More space for empty rows
                    }
                    
                    // Generous space calculation for chips
                    const containerPadding = 20;
                    const chipHeight = 32; // Increased height
                    const verticalGap = 10; // Increased gap
                    const horizontalGap = 8;
                    
                    // Calculate approximate chips per line
                    const avgChipWidth = 110; // Assume wider chips
                    const columnWidth = 320; // Slightly reduced effective width
                    const approxChipsPerLine = Math.max(1, Math.floor((columnWidth - containerPadding*2) / (avgChipWidth + horizontalGap)));
                    
                    // Calculate lines needed with safety buffer
                    const numLines = Math.ceil(roles.length / approxChipsPerLine) + 1; // +1 for extra safety
                    const chipsTotalHeight = numLines * chipHeight + Math.max(0, numLines - 1) * verticalGap;
                    
                    // Add extra padding for safety
                    const calculatedHeight = chipsTotalHeight + containerPadding * 2 + 30;
                    
                    return Math.max(70, calculatedHeight);
                  }}
                  disableVirtualization={true}
                  sx={{
                    flex: 1,
                    minHeight: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    border: 'none',
                    backgroundColor: 'rgba(250, 250, 250, 0.8)',
                    '.MuiDataGrid-main, .MuiDataGrid-columnHeaders, .MuiDataGrid-columnHeadersInner': {
                      backgroundColor: 'rgba(250, 250, 250, 0.8) !important',
                    },
                    '.MuiDataGrid-footerContainer': {
                      visibility: 'visible !important',
                      display: 'flex !important',
                      borderTop: '1px solid #f0f0f0',
                      backgroundColor: 'white !important'
                    },
                    '.css-e8dn0e': {
                      backgroundColor: 'white !important'
                    },
                    '.MuiDataGrid-columnHeaders': {
                      backgroundColor: 'rgba(250, 250, 250, 0.8) !important',
                      color: '#505050',
                      fontWeight: 500,
                      fontSize: 13,
                      letterSpacing: '0.3px',
                      borderBottom: '1px solid #e0e0e0',
                      borderTopLeftRadius: '5px',
                      borderTopRightRadius: '5px',
                    },
                    '.MuiDataGrid-main': {
                      backgroundColor: 'rgba(250, 250, 250, 0.8) !important', 
                      borderTopLeftRadius: '5px',
                      borderTopRightRadius: '5px'
                    },
                    '.MuiDataGrid-columnHeadersInner': {
                      backgroundColor: 'rgba(250, 250, 250, 0.8) !important',
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
                    },
                    // Ensure sort icons are hidden but headers are visible
                    '.MuiDataGrid-iconButtonContainer': {
                      display: 'none',
                      visibility: 'hidden',
                      width: 0,
                      opacity: 0
                    },
                    '.MuiDataGrid-sortIcon': {
                      display: 'none',
                      visibility: 'hidden',
                      opacity: 0
                    },
                    // Ensure column headers are visible
                    '.MuiDataGrid-columnHeader': {
                      display: 'flex',
                      visibility: 'visible',
                      opacity: 1
                    },
                    '.MuiDataGrid-columnHeaderTitle': {
                      display: 'block',
                      visibility: 'visible',
                      opacity: 1,
                      fontWeight: 500,
                      color: '#505050'
                    }
                  }}
                />
              </Box>
            </Box>
          </PermissionErrorBoundary>
        </Box>
      </Box>
      
      {/* Display Form Modal when needed */}
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
            {formMode === 'create' ? 'Create Permission' : 
             formMode === 'edit' ? 'Edit Permission' : 
             formMode === 'view' ? `Permission - ${selectedPermission?.name}` :
             'Delete Permission'}
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <PermissionForm
              mode={formMode}
              permission={selectedPermission}
              onClose={handleFormClose}
            />
          </DialogContent>
        </Dialog>
      )}
    </Container>
  );
}

function PermissionIndex() {
  return (
    <PermissionProvider>
      <PermissionIndexContent />
    </PermissionProvider>
  );
}

export default PermissionIndex;