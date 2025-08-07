import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Box, IconButton, Tooltip, Chip, Alert, CircularProgress, Typography, Container, Button, Stack } from '@mui/material';
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
  
  // Use a ref to maintain selected page size across re-renders
  const selectedPageSizeRef = useRef(pagination.page_size);
  
  // Add a ref to track the last change to prevent duplicate calls
  const lastChangeRef = useRef(null);
  
  // Update ref when pagination changes from parent
  useEffect(() => {
    if (pagination.page_size && pagination.page_size !== selectedPageSizeRef.current) {
      console.log('CustomPagination - Syncing selectedPageSizeRef with pagination.page_size:', pagination.page_size);
      selectedPageSizeRef.current = pagination.page_size;
    }
  }, [pagination.page_size]);
  
  const handleChangePageSize = (e) => {
    const newPageSize = parseInt(e.target.value, 10);
    
    // Skip if same size already selected (prevents duplicate calls)
    if (newPageSize === selectedPageSizeRef.current) {
      console.log('CustomPagination - Skipping duplicate page size change:', newPageSize);
      return;
    }
    
    console.log('CustomPagination - handleChangePageSize - Selected new page size:', newPageSize);
    
    // Update our ref immediately for UI consistency
    selectedPageSizeRef.current = newPageSize;
    
    // Generate a change key to prevent duplicate calls
    const changeKey = `${0}-${newPageSize}`;
    
    // Check if this is a duplicate change
    if (lastChangeRef.current === changeKey) {
      console.log('CustomPagination - Skipping duplicate pagination change');
      return;
    }
    
    // Store current change
    lastChangeRef.current = changeKey;
    
    // Call the provided callback to update pagination in the parent
    if (onPaginationChange) {
      console.log('CustomPagination - handleChangePageSize - Calling onPaginationChange with:', { 
        page: 0, 
        pageSize: newPageSize 
      });
      
      // Always reset to page 1 (0-indexed) when changing page size and trigger refresh
      onPaginationChange({ 
        page: 0, 
        pageSize: newPageSize 
      });
    }
  };
  
  const handlePrevPage = () => {
    console.log('CustomPagination - Previous page calculation:', {
      totalItems: pagination.total,
      pageSize: pagination.page_size,
      currentPage: pagination.page
    });
    
    if (pagination.page > 0) {
      console.log('CustomPagination - Moving to previous page', {

      });
      
      const targetPage = pagination.page - 1;
      if (onPaginationChange) {
        onPaginationChange({ 
          page: targetPage, 
          pageSize: pagination.page_size
        });
      }
    } else {
      console.log('CustomPagination - Already at first page, cannot go back', {
        currentPage: pagination.page
      });
    }
  };
  
  const handleNextPage = () => {
    // Calculate the last possible page more carefully, based on the total and page size
    const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.page_size));
    const lastPage = totalPages - 1; // Convert to 0-indexed for UI
    
    console.log('CustomPagination - Next page calculation:', {
      totalItems: pagination.total,
      pageSize: pagination.page_size,
      totalPages,
      lastPage: lastPage,
      currentPage: pagination.page
    });
    
    if (pagination.page < lastPage) {
      console.log('CustomPagination - Moving to next page', {
        currentPage: pagination.page,
        targetPage: pagination.page + 1
      });
      
      // Check if moving to the target page is safe
      const targetPage = pagination.page + 1;
      if (targetPage > lastPage) {
        console.warn(`CustomPagination - Target page ${targetPage} exceeds last valid page ${lastPage}, adjusting to ${lastPage}`);
        
      if (onPaginationChange) {
          onPaginationChange({ 
            page: lastPage,
            pageSize: pagination.page_size
          });
        }
        return;
      }
      
      if (onPaginationChange) {
        onPaginationChange({ 
          page: targetPage,
          pageSize: pagination.page_size
        });
      }
    } else {
      console.log('CustomPagination - Already at last page, cannot go forward', {
        currentPage: pagination.page,
        lastPage: lastPage
      });
    }
  };
  
  // Calculate displayed range using the page size and making sure it's accurate
  // This is important for showing correct pagination info when the backend returns more items than requested
  const effectivePageSize = pagination.page_size;
  const start = pagination.page * effectivePageSize + 1;
  const end = Math.min((pagination.page + 1) * effectivePageSize, pagination.total);
  const isFirstPage = pagination.page === 0;
  const isLastPage = pagination.page >= Math.ceil(pagination.total / effectivePageSize) - 1;
  
  console.log('CustomPagination rendering with:', {
    page_size: pagination.page_size,
    effective_page_size: effectivePageSize, 
    total: pagination.total,
    currentPage: pagination.page,
    displayedRange: `${start}-${end} of ${pagination.total}`,
    actualUsers: props.users?.length || 0
  });
  
  // Log any discrepancies between the selected page size and the API's page size
  if (pageSizeOptions.includes(pagination.page_size) && props.onPaginationChange) {
    // Note: this is just for logging/debugging and doesn't affect functionality
    console.log('Current page size from API:', pagination.page_size);
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
    console.log('Backend pagination state changed:', pagination);
    
    // Only update if there's an actual change and it's not from a manual update
    if (
      pagination && 
      (paginationModel.page !== Math.max((pagination.page || 1) - 1, 0) || 
       paginationModel.pageSize !== pagination.page_size)
    ) {
      // Skip automatic API calls - we only want to sync the local state with backend
      console.log('Syncing paginationModel with backend pagination state (UI update only)');
      
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
    console.log('paginationModel changed:', paginationModel);
    
    // Use a ref declared outside the useEffect callback
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    
    // This useEffect should only fire on direct paginationModel updates not handled elsewhere
    // We'll leave this empty as our handlePaginationModelChange already handles the API calls
    console.log('Direct paginationModel change detected - no action needed as API calls happen through the handlers');
  }, [paginationModel]);

  // Fetch users on initial load only - remove paginationModel dependency
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Verify token before fetching
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.error('No authentication token found in UserIndex');
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
    console.log('handleFormClose called with shouldRefresh:', shouldRefresh);
    console.log('Current form mode:', formMode);
    
    // First close the dialog
    setOpenDialog(false);
    
    // If we need to refresh, do it immediately
    if (shouldRefresh) {
      console.log('Refreshing user list after form close');
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
      console.log('Resetting form state after dialog close');
      clearSelectedUser();
      setSelectedUserId(null);
      setFormMode('create');
    }, 300);
  };

  // Handle filters change
  const handleFiltersChange = (newFilters) => {
    console.log('UserIndex handleFiltersChange - Received filters:', newFilters);
    logInfo('Filters changed:', newFilters);
    
    // Detect if we're clearing all filters
    const isClearing = newFilters && Object.keys(newFilters).length === 0;
    
    if (isClearing) {
      console.log('UserIndex handleFiltersChange - Clearing all filters detected');
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
    console.log('UserIndex handleFiltersChange - Previous filters state:', filters);
    
    // Determine which filters were removed by comparing with previous state
    const removedFilterTypes = Object.keys(filters).filter(
      key => !(key in newFilters)
    );
    
    if (removedFilterTypes.length > 0) {
      console.log('UserIndex handleFiltersChange - Detected removed filter types:', removedFilterTypes);
    }
    
    // Ensure we're working with an object
    const filtersToApply = newFilters || {};
    console.log('UserIndex handleFiltersChange - filtersToApply:', filtersToApply);
    
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
              console.log(`UserIndex handleFiltersChange - Including roles filter with ${cleanedFilters[key].length} values:`, JSON.stringify(cleanedFilters[key]));
            } else {
              cleanedFilters[key] = value;
              console.log(`UserIndex handleFiltersChange - Including array filter: ${key} with ${value.length} values`);
            }
            logInfo(`Including array filter: ${key} with ${value.length} values: ${JSON.stringify(value)}`);
          } else {
            console.log(`UserIndex handleFiltersChange - Skipping empty array for ${key}`);
          }
        } else if (typeof value === 'string') {
          // Only include non-empty strings
          if (value.trim() !== '') {
            cleanedFilters[key] = value.trim();
            console.log(`UserIndex handleFiltersChange - Including string filter: ${key}=${value}`);
            logInfo(`Including string filter: ${key}=${value}`);
          } else {
            console.log(`UserIndex handleFiltersChange - Skipping empty string for ${key}`);
          }
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          // Special handling for is_active to ensure it's passed correctly to the API
          if (key === 'is_active') {
            cleanedFilters[key] = String(value); // Convert to string for API compatibility
            console.log(`UserIndex handleFiltersChange - Including is_active filter: ${key}=${cleanedFilters[key]} (string value)`);
          } else {
            cleanedFilters[key] = value;
            console.log(`UserIndex handleFiltersChange - Including ${typeof value} filter: ${key}=${value}`);
          }
          logInfo(`Including ${typeof value} filter: ${key}=${value}`);
        }
      }
    });
    
    console.log('UserIndex handleFiltersChange - Final cleanedFilters:', cleanedFilters);
    logInfo('Applying cleaned filters:', cleanedFilters);
    
    // Double-check to make sure removed filters aren't somehow still in the cleanedFilters
    for (const type of removedFilterTypes) {
      if (type in cleanedFilters) {
        console.warn(`UserIndex handleFiltersChange - REMOVED FILTER TYPE ${type} WAS STILL PRESENT! Removing it.`);
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
    
    console.log('handlePaginationModelChange - Processing pagination change:', {
      newModel,
      currentPagination: pagination,
      currentPaginationModel: paginationModel,
      effectiveNewPageSize: newPageSize
    });
    
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
    
    console.log('Calling fetchUsers with:', requestParams);
    
    // Set a loading state indicator
    setLoading(true);
    
    // Make the API call with the complete request parameters
    fetchUsers(requestParams)
      .then(response => {
        console.log('Successfully fetched users with new pagination:', {
          requestedPageSize: newPageSize,
          returnedPageSize: response?.page_size || response?.pageSize || pagination.page_size,
          actualItemCount: response?.items?.length || 0
        });
        
        // The page size discrepancy is now handled in fetchUsers - we'll always use what we requested
        if (newPageSize !== (response?.page_size || response?.pageSize)) {
          console.warn('Page size discrepancy handled: Grid is showing correct number of rows:', {
            requested: newPageSize,
            returned: response?.page_size || response?.pageSize,
            actualItemsDisplayed: response?.items?.length || 0
          });
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
                color: isSorted ? '#1976d2' : '#505050'
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
                color: isSorted ? '#1976d2' : '#505050'
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
                color: isSorted ? '#1976d2' : '#505050'
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
            User Management
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
         
          </Box>
        </Box>
        
        <Box sx={{ px: 3 }}>
          <UserFilters 
            onFilterChange={handleFiltersChange} 
            filters={filters} 
            onSearch={handleFiltersChange} 
          />
        </Box>
        
        <Box sx={{ 
          flex: 1,
          minHeight: 'auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          px: 3,
          pb: 3,
          position: 'relative',
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
            border: 'none',
          },
          '& .MuiDataGrid-main': {
            borderTopLeftRadius: '5px',
            borderTopRightRadius: '5px',
            marginBottom: 0,
            paddingBottom: 0
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: 'rgba(250, 250, 250, 0.8)',
            borderTopLeftRadius: '5px',
            borderTopRightRadius: '5px'
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: '1px solid rgba(224, 224, 224, 1)',
            backgroundColor: 'rgba(245, 247, 250, 0.8)',
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 24px',
            height: '52px',
            minHeight: '52px',
            maxHeight: '52px',
            boxSizing: 'border-box',
            marginTop: 0
          }
        }}>
          <style>
            {`
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
              
              .css-1xs4aeo-MuiContainer-root {
                margin: 0 !important;
                padding: 0 !important;
                max-width: 100% !important;
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
              
              /* Hide default sort icons */
              .MuiDataGrid-sortIcon,
              .MuiDataGrid-iconButtonContainer,
              .css-1pe4mpk-MuiButtonBase-root,
              button[aria-label="Sort"],
              .MuiDataGrid-columnHeaderTitleContainer button {
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
                width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              
              /* Hide column menu (three dots) */
              .MuiDataGrid-menuIcon,
              .MuiDataGrid-columnHeaderMenuButton,
              button[aria-label="Menu"],
              button[title="Menu"],
              .MuiDataGrid-menuIconButton,
              .MuiButtonBase-root.MuiIconButton-root.MuiIconButton-sizeSmall.MuiDataGrid-menuIconButton {
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
                width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              
              /* Hide all pagination footer */
              .MuiDataGrid-footerContainer,
              .MuiTablePagination-root,
              .MuiDataGrid-panelFooter,
              .MuiTablePagination-selectLabel,
              .MuiTablePagination-displayedRows,
              .MuiTablePagination-select,
              .MuiTablePagination-actions,
              div[class*="MuiDataGrid-footerContainer"],
              div[class*="MuiTablePagination-root"] {
                display: none !important;
                height: 0 !important;
                max-height: 0 !important;
                overflow: hidden !important;
                visibility: hidden !important;
              }
              
              .MuiDataGrid-columnHeaderTitle {
                font-weight: 500 !important;
                color: #333 !important;
              }
              
              .MuiDataGrid-columnSeparator {
                visibility: visible !important;
                color: rgba(224, 224, 224, 1) !important;
              }
              
              .MuiDataGrid-footerContainer {
                border-top: 1px solid rgba(224, 224, 224, 1) !important;
                background-color: rgba(245, 247, 250, 0.8) !important;
                position: relative !important;
                z-index: 10 !important;
                display: flex !important;
                justify-content: flex-end !important;
                align-items: center !important;
                padding: 0 24px !important;
                height: 52px !important;
                min-height: 52px !important;
                max-height: 52px !important;
                box-sizing: border-box !important;
                margin-top: 0 !important;
              }
            `}
          </style>
          
          {/* Position the custom pagination at the top right, but above the grid */}
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
              justifyContent: 'space-between',
                width: '100%',
                marginBottom: '16px',
                paddingTop: '4px',
                paddingBottom: '4px',
              }}
            >
            {/* New User button placed at the left side */}
            {(hasPermission('CREATE_USER') || hasPermission('MANAGE_USERS')) && (
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
                New User
              </Button>
            )}

            {/* Use a stable key that doesn't force a remount on every render */}
              <CustomPagination 
                pagination={{
                  page: paginationModel.page,
                page_size: paginationModel.pageSize,
                  total: pagination.total
                }}
                pageSizeOptions={[5, 10, 15, 20, 25]}
              onPaginationChange={handlePaginationModelChange}
              key={`pagination-${paginationModel.page}-${pagination.total}`}
              users={users}
              />
            </Box>

          {/* Error Message Area */}
          {(error || errorMessage) && (
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
          
          {/* Loading Indicator */}
          {loading && !users?.length && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress size={40} />
            </Box>
          )}
          
          {!loading && (!users || users.length === 0) && !error && !errorMessage && (
            <Alert 
              severity="info" 
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle2">
                No users data available
              </Typography>
              <Box sx={{ mt: 1, fontSize: '12px' }}>
                <div>Users array: {Array.isArray(users) ? `Array with ${users.length} items` : 'Not an array'}</div>
                <div>Pagination: Page {pagination.page}, Size {pagination.page_size}, Total {pagination.total}</div>
                <Button 
                  size="small" 
                  variant="outlined" 
                  color="primary" 
                  sx={{ mt: 1 }}
                  onClick={() => {
                    // Force refresh with default settings
                    fetchUsers({
                      page: 1,
                      page_size: 10,
                      sort_by: 'username',
                      sort_order: 'asc'
                    });
                  }}
                >
                  Reload Data
                </Button>
              </Box>
            </Alert>
          )}

          {/* User Data Grid */}
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
            }}>
            {/* If ReusableDataGrid is available, use it; otherwise, implement a standard solution */}
            {typeof ReusableDataGrid !== 'undefined' ? (
              <ReusableDataGrid
                columns={columns}
                rows={users || []}
                loading={loading}
                totalRows={pagination.total || 0}
                paginationModel={paginationModel}
                onPaginationModelChange={null}
                sortModel={sortModel}
                onSortModelChange={handleSortModelChange}
                paginationMode="server"
                sortingMode="server"
                filterMode="server"
                disableColumnMenu={true}
                disableMultipleColumnsSorting={true} 
                disableColumnFilter={true}
                disableSelectionOnClick={true}
                disableRowSelectionOnClick={true}
                pageSize={paginationModel.pageSize}
                height="auto"
                autoHeight={true}
                hideFooter={true}
                hideFooterPagination={true}
                hideFooterSelectedRowCount={true}
                disableColumnSelector={true}
                disableDensitySelector={true}
                disableExtendRowFullWidth={true}
                sortingOrder={['asc', 'desc']}
                componentsProps={{
                  columnHeader: {
                    sx: {
                      '& .MuiDataGrid-sortIcon': {
                        display: 'none !important', // Hide default sort icons
                      },
                      '& .MuiDataGrid-iconButtonContainer': {
                        display: 'none !important', // Hide sort icon containers
                      }
                    }
                  }
                }}
                // Add slots to completely remove footer components
                slots={{
                  footer: () => null,
                  pagination: () => null,
                  noRowsOverlay: () => (
                    <Box sx={{ 
                  display: 'flex',
                  flexDirection: 'column',
                      alignItems: 'center', 
                      justifyContent: 'center',
                      p: 4
                    }}>
                      <Typography variant="h6" sx={{ mb: 1, color: '#666' }}>
                        No users found
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#888', mb: 2 }}>
                        {loading ? 'Loading users data...' : 'Try changing your filters or adding a new user'}
                      </Typography>
                      {!loading && (
                        <Button 
                          variant="outlined" 
                          size="small" 
                          onClick={() => fetchUsers({
                            page: 1,
                            page_size: 10,
                            sort_by: 'username',
                            sort_order: 'asc'
                          })}
                        >
                          Reset Filters & Reload
                        </Button>
                      )}
                    </Box>
                  )
                }}
                getRowHeight={() => 'auto'}
                sx={{
                  // Remove minHeight completely
                  height: 'auto',
                  
                  // Force main containers to show all content
                  '& .MuiDataGrid-main': {
                    position: 'static !important',
                    overflow: 'visible !important',
                    height: 'auto !important'
                  },
                  
                  '& .MuiDataGrid-virtualScroller': {
                    position: 'static !important',
                    overflow: 'visible !important',
                    height: 'auto !important',
                    transform: 'none !important'
                  },
                  
                  '& .MuiDataGrid-virtualScrollerContent': {
                    position: 'static !important',
                    height: 'auto !important',
                    transform: 'none !important',
                    width: '100% !important'
                  },
                  
                  '& .MuiDataGrid-virtualScrollerRenderZone': {
                    position: 'static !important',
                    transform: 'none !important',
                    width: '100% !important'
                  },
                  
                  // Target rows directly via the sx prop too for maximum override
                  '& .MuiDataGrid-row': {
                    height: 'auto !important',
                    maxHeight: 'none !important',
                    minHeight: '60px !important'
                  },
                  
                  '& .MuiDataGrid-row .MuiDataGrid-cell': {
                    height: 'auto !important',
                    minHeight: '100% !important',
                    maxHeight: 'none !important',
                    overflow: 'visible !important'
                  },
                  
                  '& .MuiDataGrid-columnHeader': {
                    backgroundColor: 'rgba(245, 247, 250, 1)',
                    borderBottom: '1px solid rgba(224, 224, 224, 1)',
                    '& .MuiDataGrid-columnHeaderTitle': {
                      fontWeight: '500',
                      fontSize: '14px',
                      color: '#333333'
                    }
                  },
                  '& .MuiDataGrid-footerContainer': {
                    borderTop: '1px solid rgba(224, 224, 224, 1)',
                    backgroundColor: 'rgba(245, 247, 250, 0.8)',
                    position: 'relative',
                    zIndex: 2,
                    height: '52px',
                    minHeight: '52px',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    boxShadow: 'none',
                    marginTop: 0,
                    paddingBottom: 0,
                    padding: '0 24px'
                  }
                }}
                key={`user-grid-${forceUpdateCounter}`}
              />
            ) : (
              // Fallback implementation
              <Box 
                sx={{ 
                  height: '100%', 
                  width: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  overflow: 'auto',
                  backgroundColor: 'white'
                }}
              >
                {/* Custom table header */}
                <Box 
                  sx={{ 
                    display: 'flex', 
                    borderBottom: '1px solid #e0e0e0',
                    backgroundColor: '#f5f5f5',
                    padding: '8px 16px',
                  }}
                >
                  {columns.map((column) => (
                    <Box 
                      key={column.field} 
                      sx={{ 
                        flex: column.flex || 'none', 
                        width: column.width ? `${column.width}px` : 'auto',
                        minWidth: column.minWidth ? `${column.minWidth}px` : 'auto',
                        fontWeight: 'bold',
                        cursor: column.sortable !== false ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 16px',
                        color: sortModel[0]?.field === column.field ? '#1976d2' : 'inherit',
                        '&:hover': {
                          color: column.sortable !== false ? '#1976d2' : 'inherit',
                        }
                      }}
                      onClick={() => {
                        if (column.sortable !== false) {
                          const currentSort = sortModel[0];
                          const newSort = currentSort?.field === column.field 
                            ? { field: column.field, sort: currentSort.sort === 'asc' ? 'desc' : 'asc' }
                            : { field: column.field, sort: 'asc' };
                          
                          handleSortModelChange([newSort]);
                        }
                      }}
                    >
                      {column.renderHeader 
                        ? column.renderHeader() 
                        : column.headerName}
                      {sortModel[0]?.field === column.field && column.sortable !== false && (
                        sortModel[0].sort === 'asc' 
                          ? <ArrowUpward sx={{ fontSize: 14, ml: 0.5 }} /> 
                          : <ArrowDownward sx={{ fontSize: 14, ml: 0.5 }} />
                      )}
            </Box>
                  ))}
      </Box>
      
                {/* Custom table body */}
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <CircularProgress size={30} />
                    </Box>
                  ) : (
                    users && users.length > 0 ? (
                      // Only show the number of rows matching the page size
                      users.slice(0, paginationModel.pageSize).map((user) => (
                        <Box 
                          key={user.id}
                          sx={{ 
                            display: 'flex', 
                            borderBottom: '1px solid #f0f0f0',
                            '&:hover': {
                              backgroundColor: 'rgba(25, 118, 210, 0.04)'
                            }
                          }}
                        >
                          {columns.map((column) => (
                            <Box 
                              key={`${user.id}-${column.field}`}
            sx={{
                                flex: column.flex || 'none',
                                width: column.width ? `${column.width}px` : 'auto',
                                minWidth: column.minWidth ? `${column.minWidth}px` : 'auto',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {column.renderCell(user)}
                            </Box>
                          ))}
                        </Box>
                      ))
                    ) : (
                      <Box sx={{ p: 4 }}>
                        <Typography variant="h6" sx={{ mb: 1, color: '#666' }}>
                          No users found
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#888', mb: 2 }}>
                          {loading ? 'Loading users data...' : 'Try changing your filters or adding a new user'}
                        </Typography>
                        {!loading && (
                          <Button 
                            variant="outlined" 
                            size="small" 
                            onClick={() => fetchUsers({
                              page: 1,
                              page_size: 10,
                              sort_by: 'username',
                              sort_order: 'asc'
                            })}
                          >
                            Reset Filters & Reload
                          </Button>
                        )}
                      </Box>
                    )
                  )}
                </Box>
              </Box>
            )}
          </Box>
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
    </Container>
  );
}

export default UserIndexContent;