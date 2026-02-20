import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Box, IconButton, Tooltip, Chip, Alert, CircularProgress, Typography, Container, Button, Stack } from '@mui/material';
import { CONTAINER_PY, SECTION_PX, GRID_WRAPPER_PB } from '../common/layoutTokens';
import { Edit as EditIcon, Delete as DeleteIcon, Add, KeyboardArrowLeft, KeyboardArrowRight, ArrowUpward, ArrowDownward, Refresh as RefreshIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import UserForm from './UserForm';
import UserFilters from './UserFilters';
import { useUsers } from '../../contexts/UserContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import UserErrorBoundary from './UserErrorBoundary';
import { logInfo, logError } from '../../utils/logger';
import { API_CONFIG } from '../../config/apiConfig';
import ReusableDataGrid from '../common/ReusableDataGrid';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

// Custom pagination component with a native select
const CustomPagination = (props) => {
  const { pagination, pageSizeOptions = [5, 10, 15, 20, 25], onPaginationChange } = props;

  // Normalize pagination keys from shared grid (page/pageSize) or legacy (page/page_size)
  const currentPage = typeof pagination.page === 'number' ? pagination.page : 0;
  const currentPageSize = typeof pagination.pageSize === 'number'
    ? pagination.pageSize
    : (typeof pagination.page_size === 'number' ? pagination.page_size : (pageSizeOptions?.[0] || 10));
  const totalItems = typeof pagination.total === 'number' ? pagination.total : 0;

  // Use a ref to maintain selected page size across re-renders
  const selectedPageSizeRef = useRef(currentPageSize);
  
  // Add a ref to track the last change to prevent duplicate calls
  const lastChangeRef = useRef(null);
  
  // Update ref when pagination changes from parent
  useEffect(() => {
    if (currentPageSize && currentPageSize !== selectedPageSizeRef.current) {
      selectedPageSizeRef.current = currentPageSize;
    }
  }, [currentPageSize]);
  
  const handleChangePageSize = (e) => {
    const newPageSize = parseInt(e.target.value, 10);
    
    // Skip if same size already selected (prevents duplicate calls)
    if (newPageSize === selectedPageSizeRef.current) {
      return;
    }
    
    
    // Update our ref immediately for UI consistency
    selectedPageSizeRef.current = newPageSize;
    
    // Generate a change key to prevent duplicate calls
    const changeKey = `${0}-${newPageSize}`;
    
    // Check if this is a duplicate change
    if (lastChangeRef.current === changeKey) {
      return;
    }
    
    // Store current change
    lastChangeRef.current = changeKey;
    
    // Call the provided callback to update pagination in the parent
    if (onPaginationChange) {
      
      // Always reset to page 1 (0-indexed) when changing page size and trigger refresh
      onPaginationChange({ 
        page: 0, 
        pageSize: newPageSize 
      });
    }
  };
  
  const handlePrevPage = () => {
    
    if (currentPage > 0) {
      const targetPage = currentPage - 1;
      if (onPaginationChange) {
        onPaginationChange({ 
          page: targetPage, 
          pageSize: currentPageSize
        });
      }
    } else {
    }
  };
  
  const handleNextPage = () => {
    // Calculate the last possible page based on the total and page size
    const totalPages = Math.max(1, Math.ceil(totalItems / currentPageSize));
    const lastPage = totalPages - 1; // Convert to 0-indexed for UI
    
    
    if (currentPage < lastPage) {
      
      // Check if moving to the target page is safe
      const targetPage = currentPage + 1;
      if (targetPage > lastPage) {
        
      if (onPaginationChange) {
          onPaginationChange({ 
            page: lastPage,
            pageSize: currentPageSize
          });
        }
        return;
      }
      
      if (onPaginationChange) {
        onPaginationChange({ 
          page: targetPage,
          pageSize: currentPageSize
        });
      }
    } else {
    }
  };
  
  // Calculate displayed range using the page size and making sure it's accurate
  // This is important for showing correct pagination info when the backend returns more items than requested
  const effectivePageSize = currentPageSize;
  const start = totalItems === 0 ? 0 : currentPage * effectivePageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min((currentPage + 1) * effectivePageSize, totalItems);
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage >= Math.ceil((totalItems || 1) / (effectivePageSize || 1)) - 1;
  
  
  // Log current page size for debugging
  if (props.onPaginationChange) {
  }
  
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
        value={selectedPageSizeRef.current}
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
  {start}-{end} of {totalItems}
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

function UserIndexContent() {
  const { 
    users, 
    loading: contextLoading, 
    error, 
    pagination, 
    fetchUsers, 
    fetchUser,
    deleteUser,
    applyFilters,
    clearFilters,
    clearSelectedUser,
    setLoading: setContextLoading
  } = useUsers();

  const { hasPermission } = useAuthorization();

  // Local loading state as a fallback if context doesn't provide one
  const [localLoading, setLocalLoading] = useState(false);
  
  // Use context loading state if available, otherwise use local state
  const loading = contextLoading !== undefined ? contextLoading : localLoading;
  const setLoading = setContextLoading || setLocalLoading;

  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  // Initialize with default sort by 'username' ascending
  const [sortModel, setSortModel] = useState([
    {
      field: 'username',
      sort: 'asc'
    }
  ]);
  const [errorMessage, setError] = useState('');
  
  // Add force update counter to ensure sort icons update
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);

  // Add form mode state
  const [formMode, setFormMode] = useState('create');

  // Add filters state
  const [filters, setFilters] = useState({});

  // Add pagination model state
  const [paginationModel, setPaginationModel] = useState({
    page: Math.max((pagination.page || 1) - 1, 0), // API is 1-indexed, DataGrid is 0-indexed
    pageSize: pagination.page_size || 10  // DataGrid expects 'pageSize' but we use 'page_size' internally
  });

  // isInitialRender ref for pagination effect
  const isInitialRender = useRef(true);

  // Add a ref to store the last call params to prevent duplicate API calls
  const lastCallParamsRef = useRef(null);

  // Update useEffect to sync paginationModel with backend pagination
  useEffect(() => {
    
    // Only update if there's an actual change and it's not from a manual update
    if (
      pagination && 
      (paginationModel.page !== Math.max((pagination.page || 1) - 1, 0) || 
       paginationModel.pageSize !== pagination.page_size)
    ) {
      // Skip automatic API calls - we only want to sync the local state with backend
      
      // Update paginationModel to match backend state WITHOUT triggering a fetch
      setPaginationModel(prevModel => {
        // Only update if actually different to avoid loops
        if (prevModel.page !== Math.max((pagination.page || 1) - 1, 0) || 
            prevModel.pageSize !== pagination.page_size) {
          return {
            page: Math.max((pagination.page || 1) - 1, 0), // Convert 1-indexed to 0-indexed
            pageSize: pagination.page_size || 10
          };
        }
        return prevModel;
      });
    }
  }, [pagination]);

  // Modify the paginationModel effect to prevent redundant API calls
  useEffect(() => {
    
    // Use a ref declared outside the useEffect callback
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    
    // This useEffect should only fire on direct paginationModel updates not handled elsewhere
    // We'll leave this empty as our handlePaginationModelChange already handles the API calls
  }, [paginationModel]);

  // Fetch users on initial load only - remove paginationModel dependency
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Verify authentication before fetching
        const isAuth = localStorage.getItem('isAuthenticated') === 'true';
        if (!isAuth) {
          console.error('User not authenticated in UserIndex');
          setOpenDeleteDialog(false);
          setOpenDialog(false);
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
          return;
        }

        logInfo('Loading users on initial render');
        logInfo('API Config for users:', {
          baseUrl: API_CONFIG.BASE_URL,
          usersList: API_CONFIG.ENDPOINTS.users.list,
          fullUrl: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.users.list}`
        });
        
        // Log initial params
        const apiPage = paginationModel.page + 1; // Convert to 1-indexed for API
        logInfo('Initial request params:', {
          page: apiPage,
          page_size: paginationModel.pageSize,
          sortModel: sortModel
        });

        await fetchUsers({ 
          page: apiPage,
          page_size: paginationModel.pageSize,
          sort_by: sortModel[0]?.field || 'username',
          sort_order: sortModel[0]?.sort || 'asc'
        });
        
        // Clear any existing error if successful
        setError('');
      } catch (err) {
        console.error('Error fetching users:', err);
        
        // Handle different error types
        if (err.message === 'Network Error') {
          setError('Network error: Unable to connect to the server. Please check if the backend is running.');
        } else if (err.response?.status === 500 && err.response?.data?.detail?.includes('validation')) {
          setError('Backend schema validation error. Please check the API response format.');
        } else if (err.response?.status === 404) {
          setError('Resource not found. The requested endpoint may not exist.');
        } else if (!err.isAuthError) {
          // Only set general error if it's not an auth error (auth errors are handled by interceptor)
          setError(`Error loading users: ${err.message || 'Unknown error'}`);
        }
        
        // Auth errors are handled by the API interceptor, no need to handle here
        if (err?.isAuthError) {
          return; // Let the interceptor handle the redirect
        }
      }
    };
    
    fetchData();
    // Remove paginationModel from dependencies - handlePaginationModelChange will handle those updates
  }, [fetchUsers, sortModel]);

  // Handle creating a new user
  const handleCreateClick = () => {
    setSelectedUserId(null);
    setOpenDialog(true);
    setFormMode('create');
  };

  // Handle editing a user
  const handleEditClick = (userId) => {
    setSelectedUserId(userId);
    fetchUser(userId);
    setOpenDialog(true);
    setFormMode('edit');
  };

  // Handle deleting a user
  const handleDeleteClick = (userId) => {
    setSelectedUserId(userId);
    fetchUser(userId);
    setOpenDialog(true);
    setFormMode('delete');
  };

  // Handle viewing a user
  const handleViewClick = (userId) => {
    setSelectedUserId(userId);
    fetchUser(userId);
    setOpenDialog(true);
    setFormMode('view');
  };

  // Close the form dialog
  const handleFormClose = (shouldRefresh = false) => {
    
    // First close the dialog
    setOpenDialog(false);
    
    // If we need to refresh, do it immediately
    if (shouldRefresh) {
      fetchUsers({ 
        page: pagination.page, 
        page_size: pagination.page_size,
        sort_by: sortModel[0]?.field || 'username',
        sort_order: sortModel[0]?.sort || 'asc',
        ...filters // Include filters when refreshing after form actions
      });
    }
    
    // Reset other states after dialog animation is complete
    // This prevents unwanted flashes of the form in different modes
    setTimeout(() => {
      clearSelectedUser();
      setSelectedUserId(null);
      setFormMode('create');
    }, 300);
  };

  // Handle filters change
  const handleFiltersChange = (newFilters) => {
    logInfo('Filters changed:', newFilters);
    
    // Detect if we're clearing all filters
    const isClearing = newFilters && Object.keys(newFilters).length === 0;
    
    if (isClearing) {
      // Update local state
      setFilters({});
      
      // Clear filters in context
      clearFilters();
      
      // Fetch users with no filters
      fetchUsers({
        page: 1, // Reset to first page
        page_size: pagination.page_size,
        sort_by: sortModel[0]?.field || 'username',
        sort_order: sortModel[0]?.sort || 'asc'
      });
      return;
    }
    
    // For debugging - check what filters are in the old state vs new state
    
    // Determine which filters were removed by comparing with previous state
    const removedFilterTypes = Object.keys(filters).filter(
      key => !(key in newFilters)
    );
    
    if (removedFilterTypes.length > 0) {
    }
    
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
            // For roles array, ensure values are numbers for proper comparison
            if (key === 'roles') {
              cleanedFilters[key] = value.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
            } else {
              cleanedFilters[key] = value;
            }
            logInfo(`Including array filter: ${key} with ${value.length} values: ${JSON.stringify(value)}`);
          } else {
          }
        } else if (typeof value === 'string') {
          // Only include non-empty strings
          if (value.trim() !== '') {
            cleanedFilters[key] = value.trim();
            logInfo(`Including string filter: ${key}=${value}`);
          } else {
          }
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          // Special handling for is_active to ensure it's passed correctly to the API
          if (key === 'is_active') {
            cleanedFilters[key] = String(value); // Convert to string for API compatibility
          } else {
            cleanedFilters[key] = value;
          }
          logInfo(`Including ${typeof value} filter: ${key}=${value}`);
        }
      }
    });
    
    logInfo('Applying cleaned filters:', cleanedFilters);
    
    // Double-check to make sure removed filters aren't somehow still in the cleanedFilters
    for (const type of removedFilterTypes) {
      if (type in cleanedFilters) {
        delete cleanedFilters[type];
      }
    }
    
    // Update local state with the fully cleaned filters
    setFilters(cleanedFilters);
    
    // Update filters in context
    applyFilters(cleanedFilters);
    
    // Explicitly fetch users with the new filters
    // When filters change, reset to page 1 but maintain the current sort
    fetchUsers({
      page: 1, // Reset to first page when filtering
      page_size: pagination.page_size,
      sort_by: sortModel[0]?.field || 'username',
      sort_order: sortModel[0]?.sort || 'asc',
      ...cleanedFilters // Include filters in the fetch request
    });
  };

  // Try to reconnect to the backend
  const handleRetry = async () => {
    try {
      setError('Attempting to reconnect to the server...');
      await fetchUsers({ 
        page: pagination.page, 
        page_size: pagination.page_size,
        sort_by: sortModel[0]?.field || 'username',
        sort_order: sortModel[0]?.sort || 'asc',
        ...filters // Include current filters when retrying
      });
      setError('');
    } catch (err) {
      console.error('Retry failed:', err);
      setError('Failed to reconnect. Please check if the backend server is running.');
    }
  };

  // Handle pagination change
  const handlePaginationModelChange = useCallback((newModel) => {
    logInfo('Pagination model changed:', newModel);
    
    // Validate pageSize is a number and set a reasonable default if not
    const newPageSize = (newModel.pageSize !== undefined && !isNaN(parseInt(newModel.pageSize)))
      ? parseInt(newModel.pageSize)
      : pagination.page_size;
    
    
    // Update local pagination model state (UI)
    setPaginationModel({
      page: newModel.page,
      pageSize: newPageSize
    });
    
    // Calculate API page (1-indexed) from UI page (0-indexed)
    const apiPage = newModel.page + 1;
    
    // Create a complete request object for the API
    const requestParams = {
      page: apiPage,
      page_size: newPageSize,
      
      // Include current sort settings
      ...(sortModel.length > 0 && {
        sort_by: sortModel[0].field,
        sort_order: sortModel[0].sort
      }),
      
      // Include any active filters
      ...filters
    };
    
    
    // Set a loading state indicator
    setLoading(true);
    
    // Make the API call with the complete request parameters
    fetchUsers(requestParams)
      .then(response => {
        
        // The page size discrepancy is now handled in fetchUsers - we'll always use what we requested
        if (newPageSize !== (response?.page_size || response?.pageSize)) {
        }
        
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching users with new pagination:', error);
        setLoading(false);
      });
  }, [pagination, sortModel, filters, fetchUsers, setLoading]);

  // Handle sort model change
  const handleSortModelChange = (newSortModel) => {
    logInfo('Sort model changed:', newSortModel);
    
    if (newSortModel.length > 0) {
      const { field, sort } = newSortModel[0];
      
      // Only update if actually changed
      if (!sortModel[0] || sortModel[0].field !== field || sortModel[0].sort !== sort) {
        // Update the UI state
        setSortModel(newSortModel);
        
        // Force update to refresh the sort icons
        setForceUpdateCounter(prev => prev + 1);
        
        // Fetch with new sort model, maintaining current page and filters
        fetchUsers({
          page: pagination.page,
          page_size: pagination.page_size,
          sort_by: field,
          sort_order: sort,
          ...filters // Include current filters when sorting
        });
      } else {
        logInfo('Sort model unchanged, skipping refetch');
      }
    } else {
      // If there's no sort model (user cleared sorting), default to username ascending
      const defaultSortModel = [{ field: 'username', sort: 'asc' }];
      setSortModel(defaultSortModel);
      
      // Force update to refresh the sort icons
      setForceUpdateCounter(prev => prev + 1);
      
      fetchUsers({
        page: pagination.page,
        page_size: pagination.page_size,
        sort_by: 'username',
        sort_order: 'asc',
        ...filters // Include current filters when sorting
      });
    }
  };

  // Column definitions for the users grid
  const columns = [
    {
      field: 'username', 
      headerName: 'Username', 
      flex: 1,
      minWidth: 150,
      sortingOrder: null, // Disable native sorting order
      renderHeader: () => {
        const isSorted = sortModel.length > 0 && sortModel[0].field === 'username';
        const sortDirection = isSorted ? sortModel[0].sort : null;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }} onClick={() => {
            // Handle custom sorting
            let newDirection = 'asc';
            if (isSorted && sortDirection === 'asc') newDirection = 'desc';
            handleSortModelChange([{ field: 'username', sort: newDirection }]);
          }}>
            <Typography 
              sx={{ 
                fontWeight: 500, 
                fontSize: '13px', 
                color: '#505050'
              }}
            >
              Username
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
      },
    },
    { 
      field: 'email', 
      headerName: 'Email', 
      flex: 1.5,
      minWidth: 200,
      sortingOrder: null, // Disable native sorting order
      renderHeader: () => {
        const isSorted = sortModel.length > 0 && sortModel[0].field === 'email';
        const sortDirection = isSorted ? sortModel[0].sort : null;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }} onClick={() => {
            // Handle custom sorting
            let newDirection = 'asc';
            if (isSorted && sortDirection === 'asc') newDirection = 'desc';
            handleSortModelChange([{ field: 'email', sort: newDirection }]);
          }}>
            <Typography 
              sx={{ 
                fontWeight: 500, 
                fontSize: '13px', 
                color: '#505050'
              }}
            >
              Email
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
      },
    },
    { 
      field: 'is_active', 
      headerName: 'Status', 
      width: 120,
      sortingOrder: null, // Disable native sorting order
      renderHeader: () => {
        const isSorted = sortModel.length > 0 && sortModel[0].field === 'is_active';
        const sortDirection = isSorted ? sortModel[0].sort : null;
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }} onClick={() => {
            // Handle custom sorting
            let newDirection = 'asc';
            if (isSorted && sortDirection === 'asc') newDirection = 'desc';
            handleSortModelChange([{ field: 'is_active', sort: newDirection }]);
          }}>
            <Typography 
              sx={{ 
                fontWeight: 500, 
                fontSize: '13px', 
                color: '#505050'
              }}
            >
              Status
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
      },
      renderCell: (params) => {
        return (
        <Chip
            label={params.value === true ? "Active" : "Inactive"}
            color={params.value === true ? "success" : "error"}
          size="small"
            variant={params.value === true ? "filled" : "outlined"}
          sx={{ 
              fontSize: '0.7rem',
            height: '24px'
          }}
        />
        );
      }
    },
    {
      field: 'roles', 
      headerName: 'Roles', 
      flex: 1.5,
      minWidth: 200,
      sortable: false,
      renderHeader: () => (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <Typography 
            sx={{ 
              fontWeight: 500, 
              fontSize: '13px', 
              color: '#505050'
            }}
          >
            Roles
          </Typography>
        </Box>
      ),
      renderCell: (params) => {
          return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: '100%', overflow: 'hidden' }}>
            {params.value && params.value.map((role) => (
              <Chip 
                key={role.id} 
                label={role.name} 
                size="small" 
                sx={{
                  height: '20px', 
                  fontSize: '0.65rem',
                  '& .MuiChip-label': {
                    padding: '0 6px',
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
      renderHeader: () => (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <Typography 
            sx={{ 
              fontWeight: 500, 
              fontSize: '13px', 
              color: '#505050'
            }}
          >
            Actions
          </Typography>
        </Box>
      ),
      renderCell: (params) => {
        const canView = hasPermission('VIEW_USERS');
        const canEdit = hasPermission('EDIT_USER') || hasPermission('MANAGE_USERS');
        const canDelete = hasPermission('DELETE_USER') || hasPermission('MANAGE_USERS');
        
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {canView && !canEdit && (
              <Tooltip title="View User">
                <IconButton
                  onClick={() => handleViewClick(params.row.id)}
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
              <Tooltip title="Edit User">
                <IconButton
                  onClick={() => handleEditClick(params.row.id)}
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
              <Tooltip title="Delete User">
                <IconButton
                  onClick={() => handleDeleteClick(params.row.id)}
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

  return (
    <Container maxWidth={false} disableGutters sx={{ py: CONTAINER_PY }}>
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
        <Box sx={{ px: SECTION_PX, pb: GRID_WRAPPER_PB }}>
          {/* Error Message Area */}
          {(error || errorMessage) && !openDialog && (
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
                {error || errorMessage}
              </Typography>
              
              {(error || errorMessage)?.includes('404') && (
                <Box sx={{ mt: 1, fontSize: '12px' }}>
                  <Typography variant="body2">
                    The API endpoint could not be found. This may be because:
                  </Typography>
                  <ul style={{ marginTop: '4px', paddingLeft: '20px' }}>
                    <li>The API URL path format has changed</li>
                    <li>The endpoint is not implemented on the server</li>
                  </ul>
                  <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace', fontSize: '12px' }}>
                    Expected URL: {API_CONFIG.BASE_URL}{API_CONFIG.ENDPOINTS.users.list}
                  </Typography>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    color="error" 
                    sx={{ mt: 1 }}
                    onClick={handleRetry}
                  >
                    Retry Request
                  </Button>
                </Box>
              )}
              
              {(error || errorMessage)?.includes('Network') && (
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

          {/* Standardized Grid */}
          <Box sx={{ px: SECTION_PX }}>
            <ReusableDataGrid
              title="User Management"
              columns={columns}
              rows={users || []}
              loading={loading}
              totalRows={pagination.total || 0}
              onPaginationModelChange={handlePaginationModelChange}
              sortModel={sortModel}
              onSortModelChange={handleSortModelChange}
              disableColumnMenu
              disableRowSelectionOnClick
              PaginationComponent={CustomPagination}
              paginationPosition="top"
              FiltersComponent={UserFilters}
              currentFilters={filters}
              onFiltersChange={handleFiltersChange}
              onSearch={handleFiltersChange}
              createButtonText="User"
              onCreateClick={(hasPermission('CREATE_USER') || hasPermission('MANAGE_USERS')) ? handleCreateClick : undefined}
            />
          </Box>

          {/* User Form Dialog */}
          {openDialog && (
            <UserForm
              userId={selectedUserId}
              onClose={handleFormClose}
              mode={formMode}
            />
          )}
        </Box>
      </Box>
    </Container>
  );
}

export default UserIndexContent;