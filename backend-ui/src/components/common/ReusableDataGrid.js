import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Typography, Button, Stack, Alert, CircularProgress } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import SERVER_URL from './BackendServerData';
import { logError, logInfo } from '../../utils/logger';
import { isEqual } from 'lodash';
import AddIcon from '@mui/icons-material/Add';

/**
 * ReusableDataGrid - A configurable grid component that can be used across the application
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - The title of the grid
 * @param {Object} props.columnVisibilityModel - Column visibility model
 * @param {boolean} props.disableRowSelectionOnClick - Disables row selection on click
 * @param {Array} props.columns - Column definitions for the grid
 * @param {string} props.apiEndpoint - API endpoint to fetch data from
 * @param {Object} props.initialFilters - Initial filter values
 * @param {Object} props.currentFilters - Current filter values
 * @param {React.Component} props.FiltersComponent - Custom filter component
 * @param {Function} props.onFiltersChange - Function to call when filters change
 * @param {Function} props.onSearch - Function to call when search is triggered
 * @param {string} props.createButtonText - Text for the create button
 * @param {Function} props.onCreateClick - Function to call when create button is clicked
 * @param {Function} props.onEditClick - Function to call when edit button is clicked
 * @param {Function} props.onDeleteClick - Function to call when delete button is clicked
 * @param {number} props.defaultPageSize - Default page size
 * @param {string} props.height - Height of the grid
 * @param {Function} props.customFetchData - Custom function to override default fetch behavior
 * @param {Object} props.additionalParams - Additional parameters to include in API requests
 * @param {React.Component} [props.PaginationComponent] - Optional custom pagination component
 * @param {Array} props.rows - Existing rows in external data mode
 * @param {boolean} props.loading - Loading state for external data mode
 * @param {number} props.totalRows - Total rows in external data mode
 * @param {Function} props.onPaginationModelChange - Function to call when pagination model changes
 * @param {Function} props.onSortModelChange - Function to call when sort model changes
 * @param {Array} props.sortModel - Existing sort model in external data mode
 * @param {'top'|'bottom'} [props.paginationPosition='bottom'] - Position of the custom pagination component
 * @param {string} [props.uiVariant='default'] - Optional UI variant for custom styling
 * @param {Object} [props.gridSx={}] - Additional sx styles to apply to the DataGrid
 * @returns {React.Component} - The reusable grid component
 */
function ReusableDataGrid({
  title,
  columns,
  apiEndpoint,
  initialFilters = {},
  currentFilters,
  FiltersComponent,
  onFiltersChange,
  onSearch,
  createButtonText,
  onCreateClick,
  defaultPageSize = 10,
  customFetchData,
  additionalParams = {},
  PaginationComponent,
  rows,
  loading: externalLoading,
  totalRows,
  onPaginationModelChange,
  onSortModelChange,
  sortModel: externalSortModel,
  paginationPosition = 'bottom',
  uiVariant = 'default',
  gridSx = {},
  disableRowSelectionOnClick,
}) {
  const isExternalDataMode = Boolean(rows !== undefined);
  const [data, setData] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [sortModel, setSortModel] = useState(externalSortModel || []);
  const [paginationModel, setPaginationModel] = useState({ pageSize: defaultPageSize, page: 0 });

  const initialFetchComplete = useRef(false);
  const prevPaginationModel = useRef(paginationModel);
  const prevSortModel = useRef(sortModel);
  const fetchInProgressRef = useRef(false);
  const filtersRef = useRef(initialFilters);

  useEffect(() => { filtersRef.current = filters; }, [filters]);

  useEffect(() => {
    if (!isEqual(filters, initialFilters)) {
      setFilters(initialFilters);
      setPaginationModel(prev => ({ ...prev, page: 0 }));
    }
  }, [initialFilters]);

  // Sync internal pagination model with external pagination when in external mode
  useEffect(() => {
    if (isExternalDataMode) {
      setPaginationModel(prev => {
        const newModel = {
          page: prev.page, // Keep current page unless explicitly changed
          pageSize: defaultPageSize // Always use the current defaultPageSize from props
        };
        
        // Only update if values actually changed to avoid infinite loops
        if (prev.pageSize !== newModel.pageSize) {
          console.log('ReusableDataGrid - Syncing pagination model with external data:', {
            previous: prev,
            new: newModel,
            defaultPageSize,
            reason: 'pageSize prop changed'
          });
          return newModel;
        }
        
        return prev;
      });
    }
  }, [isExternalDataMode, defaultPageSize]);

  const fetchData = useCallback(async (searchFilters = filtersRef.current) => {
    if (isExternalDataMode || fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;

    if (customFetchData) {
      setLoading(true);
      try {
        const result = await customFetchData(paginationModel.page, paginationModel.pageSize, sortModel, searchFilters);
        if (result) {
          setData(result.data || []);
          setTotalItems(result.totalCount || 0);
          setError(null);
        }
      } catch (err) {
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setLoading(false);
        fetchInProgressRef.current = false;
      }
      return;
    }
    
    if (!apiEndpoint) {
      fetchInProgressRef.current = false;
      return;
    }

    const params = new URLSearchParams({
      page: paginationModel.page + 1,
      page_size: paginationModel.pageSize,
      ...additionalParams
    });

    if (sortModel.length > 0) {
      params.append('sort_field', sortModel[0].field);
      params.append('sort_order', sortModel[0].sort);
    }
    
    if (Array.isArray(searchFilters) && searchFilters.length > 0) {
      params.append('filters', JSON.stringify(searchFilters));
    } else if (typeof searchFilters === 'object' && searchFilters !== null) {
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value) {
            params.append(key, String(value));
        }
      });
    }

    const formattedEndpoint = apiEndpoint.startsWith('/') ? apiEndpoint : `/${apiEndpoint}`;
    const apiUrl = `${SERVER_URL}${formattedEndpoint}?${params.toString()}`;
    setLoading(true);

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.detail);
      }
      const responseData = await response.json();
      if (responseData) {
        setData(responseData.items || []);
        setTotalItems(responseData.total || 0);
        setError(null);
      }
    } catch (err) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [apiEndpoint, customFetchData, isExternalDataMode, paginationModel, sortModel, additionalParams]);

  useEffect(() => {
    if (isExternalDataMode) return;
    if (initialFetchComplete.current && isEqual(prevPaginationModel.current, paginationModel) && isEqual(prevSortModel.current, sortModel)) {
      return;
    }
    prevPaginationModel.current = paginationModel;
    prevSortModel.current = sortModel;
    if (!fetchInProgressRef.current) {
        fetchData(filters);
    }
    if (!initialFetchComplete.current) {
        initialFetchComplete.current = true;
    }
  }, [fetchData, isExternalDataMode, paginationModel, sortModel, filters]);

  const displayData = useMemo(() => isExternalDataMode ? (rows || []) : (data || []), [isExternalDataMode, rows, data]);
  const displayLoading = useMemo(() => isExternalDataMode ? externalLoading : loading, [isExternalDataMode, externalLoading, loading]);
  const displayTotal = useMemo(() => isExternalDataMode ? (totalRows || 0) : (totalItems || 0), [isExternalDataMode, totalRows, totalItems]);
  
  // Use external filters when in external data mode, internal filters otherwise
  const effectiveFilters = useMemo(() => {
    if (isExternalDataMode && onFiltersChange && currentFilters !== undefined) {
      // In external mode, use currentFilters passed from parent
      return currentFilters || {};
    }
    return filters;
  }, [isExternalDataMode, onFiltersChange, currentFilters, filters]);

  const handlePaginationModelChange = useCallback((newModel) => {
    console.log('ReusableDataGrid - handlePaginationModelChange called:', {
      newModel,
      isExternalDataMode,
      currentPaginationModel: paginationModel
    });
    
    setPaginationModel(newModel);
    if (onPaginationModelChange) {
      console.log('ReusableDataGrid - Calling external onPaginationModelChange');
      onPaginationModelChange(newModel);
    }
  }, [onPaginationModelChange, isExternalDataMode, paginationModel]);

  const handleSortModelChange = useCallback((newModel) => {
    setSortModel(newModel);
    if (onSortModelChange) onSortModelChange(newModel);
  }, [onSortModelChange]);

  const handleFiltersChangeInternal = useCallback((newFilters) => {
    setFilters(newFilters);
    if(onFiltersChange) onFiltersChange(newFilters);
  }, [onFiltersChange]);

  const handleSearchInternal = useCallback((searchFilters) => {
    fetchData(searchFilters);
    if(onSearch) onSearch(searchFilters);
  }, [fetchData, onSearch]);

  // Calculate effective pagination data based on mode
  const effectivePaginationData = useMemo(() => {
    if (isExternalDataMode) {
      // In external mode, derive pagination from props or use defaults
      // Since we don't have direct access to external pagination state,
      // we need to calculate it from the current totalRows and other indicators
      return {
        page: paginationModel.page,
        pageSize: paginationModel.pageSize,
        total: displayTotal
      };
    } else {
      // In internal mode, use internal pagination
      return {
        page: paginationModel.page,
        pageSize: paginationModel.pageSize,
        total: displayTotal
      };
    }
  }, [isExternalDataMode, paginationModel, displayTotal]);

  const CustomToolbar = useMemo(() => {
    return ({ title, createButtonText, onCreateClick, FilterComponent, filters, handleFiltersChange, handleSearch, PaginationComponent, paginationData, handlePaginationChange, uiVariant }) => {
      const categoryStyle = uiVariant === 'categoryIndex';
      return (
        <Box>
          <Stack spacing={0}>
            {title && (
              <Box sx={{ p: 0, pb: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#1976d2', mb: 1, letterSpacing: '0.015em' }}>{title}</Typography>
                <Box sx={{ height: '2px', width: '100%', bgcolor: '#1976d2', opacity: categoryStyle ? 0.7 : 1, mb: categoryStyle ? 2 : 0 }} />
              </Box>
            )}
            {FilterComponent && (
              <Box sx={{ px: 0 }}>
                <FilterComponent filters={filters} onFiltersChange={handleFiltersChange} onSearch={handleSearch} />
              </Box>
            )}
            {(onCreateClick || (PaginationComponent && paginationPosition === 'top')) && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', py: 1, px: 0, mt: 1, mb: 2 }}>
                {onCreateClick ? (
                  <Button variant="outlined" size="small" onClick={onCreateClick} startIcon={<AddIcon fontSize="small" />} sx={{ textTransform: 'none' }}>
                    New {createButtonText}
                  </Button>
                ) : <Box />}
                {PaginationComponent && paginationPosition === 'top' && (
                  <PaginationComponent pagination={paginationData} onPaginationChange={handlePaginationChange} />
                )}
              </Box>
            )}
          </Stack>
        </Box>
      );
    };
  }, [paginationPosition]);

  // Add global styles for pagination dropdown items and container overrides
  useEffect(() => {
    // Create a style element
    const style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = `
      .css-skogx9-MuiButtonBase-root-MuiMenuItem-root-MuiTablePagination-menuItem {
        min-height: auto !important;
        font-size: 13px !important;
      }
      .MuiTablePagination-select + .MuiMenu-paper .MuiMenuItem-root {
        min-height: auto !important;
        font-size: 13px !important;
      }
      .MuiMenu-paper .MuiMenuItem-root {
        min-height: auto !important;
        font-size: 13px !important;
      }
      li.MuiMenuItem-root {
        min-height: auto !important;
        font-size: 13px !important;
      }
      
      /* Critical container override to prevent centering and enable full width */
      .css-1xs4aeo-MuiContainer-root {
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
      
      /* Additional container overrides for full width behavior */
      .MuiContainer-root {
        max-width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        margin: 0 !important;
      }
      
      /* Override any fixed heights in the grid wrapper */
      .MuiDataGrid-root, .MuiDataGrid-root .MuiDataGrid-main {
        height: auto !important;
        min-height: 400px !important;
        flex: 1 !important;
      }
    `;
    
    // Append the style to the document head
    document.head.appendChild(style);
    
    // Cleanup function to remove the style when component unmounts
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      width: '100%',
      maxWidth: '100%',
      gap: 0, 
      backgroundColor: uiVariant === 'categoryIndex' ? 'white' : 'transparent',
    }}>
      <CustomToolbar
        title={title}
        createButtonText={createButtonText}
        onCreateClick={onCreateClick}
        FilterComponent={FiltersComponent}
        filters={effectiveFilters}
        handleFiltersChange={onFiltersChange || handleFiltersChangeInternal}
        handleSearch={onSearch || handleSearchInternal}
        PaginationComponent={PaginationComponent}
        paginationData={effectivePaginationData}
        handlePaginationChange={handlePaginationModelChange}
        uiVariant={uiVariant}
      />

      {displayLoading && !displayData.length ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress size={60} thickness={4} />
          <Typography sx={{ mt: 2 }} variant="subtitle1">Loading data...</Typography>
        </Box>
      ) : (
        <>
          {error && <Alert severity="error" sx={{ mx: 0, mb: 0 }}>{error}</Alert>}
          
          <Box sx={{ flex: 1, px: 0, pb: 0, width: '100%', maxWidth: '100%' }}>
            <Box sx={{ height: 'auto', display: 'flex', flexDirection: 'column', borderRadius: '0px', overflow: 'hidden', width: '100%' }}>
              <DataGrid
                rows={displayData}
                columns={columns}
                rowCount={displayTotal}
                loading={displayLoading}
                paginationModel={paginationModel}
                onPaginationModelChange={handlePaginationModelChange}
                sortModel={sortModel}
                onSortModelChange={handleSortModelChange}
                paginationMode="server"
                sortingMode="server"
                disableRowSelectionOnClick={Boolean(disableRowSelectionOnClick ?? true)}
                getRowId={(row) => row.id}
                autoHeight
                sx={{
                  flex: 1,
                  width: '100%',
                  border: 'none',
                  backgroundColor: uiVariant === 'categoryIndex' ? 'white' : 'rgba(250, 250, 250, 0.8)',
                  '.MuiDataGrid-columnHeaders': {
                    backgroundColor: uiVariant === 'categoryIndex' ? 'white' : 'rgba(250, 250, 250, 0.8)',
                    color: '#505050',
                    borderBottom: '1px solid #e0e0e0',
                  },
                  '.MuiDataGrid-row': {
                    backgroundColor: 'white',
                    '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.04)' },
                  },
                  '.MuiDataGrid-cell': {
                    borderBottom: '1px solid #f5f5f5',
                  },
                  '& .MuiDataGrid-footerContainer': {
                    display: 'none',
                  },
                  ...gridSx,
                }}
              />
            </Box>
          </Box>
        </>
      )}

      {paginationPosition === 'bottom' && PaginationComponent && !displayLoading && displayTotal > 0 && (
        <Box sx={{ 
          px: 0, 
          py: 0, 
          display: 'flex', 
          justifyContent: 'flex-end', 
          width: '100%',
          backgroundColor: uiVariant === 'categoryIndex' ? 'white' : 'transparent',
        }}>
          <PaginationComponent
            pagination={effectivePaginationData}
            onPaginationChange={handlePaginationModelChange}
          />
        </Box>
      )}
    </Box>
  );
}

export default ReusableDataGrid;


