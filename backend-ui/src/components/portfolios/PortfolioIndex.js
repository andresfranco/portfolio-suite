import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, IconButton, Tooltip, Chip, Stack, Typography, Avatar } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, PhotoLibrary as PhotoLibraryIcon, AttachFile as AttachFileIcon, ArrowUpward, ArrowDownward, Dashboard as DashboardIcon } from '@mui/icons-material';
import PortfolioForm from './PortfolioForm';
import PortfolioImageForm from './PortfolioImageForm';
import PortfolioData from './PortfolioData';
import ReusableDataGrid from '../common/ReusableDataGrid';
import ReusableFilters from '../common/ReusableFilters';
import ReusablePagination from '../common/ReusablePagination';
import ErrorBoundary from '../common/ErrorBoundary';
import { PortfolioProvider, usePortfolios } from '../../contexts/PortfolioContext';
import SERVER_URL from '../common/BackendServerData';
import { useNavigate } from 'react-router-dom';

function PortfolioIndexContent() {
  const navigate = useNavigate();
  const {
    portfolios,
    loading,
    error,
    pagination,
    filters,
    fetchPortfolios,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    updateFilters,
    updatePagination
  } = usePortfolios();

  const [sortModel, setSortModel] = useState([{ field: 'name', sort: 'asc' }]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImageFormOpen, setIsImageFormOpen] = useState(false);
  const [isPortfolioDataOpen, setIsPortfolioDataOpen] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);

  // Define filter types with dynamic options - memoized to prevent recreation
  const FILTER_TYPES = useMemo(() => ({
    name: {
      label: 'Portfolio Name',
      type: 'text',
      placeholder: 'Filter by portfolio name'
    },
    description: {
      label: 'Description',
      type: 'text',
      placeholder: 'Filter by description'
    }
  }), []);

  // Initial fetch of portfolios
  useEffect(() => {
    const initialFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchPortfolios({
      page: pagination.page || 1,
      pageSize: pagination.pageSize || 10,
      include_full_details: true,
      ...initialFilters
    });
  }, []);

  // Watch for filter changes and refetch data
  useEffect(() => {
    // Skip the initial render (handled by the initial fetch above)
    if (pagination.page === 1 && (!filters || Object.keys(filters).length === 0)) {
      return;
    }
    
    console.log('PortfolioIndex - Filters changed, refetching data:', filters);
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchPortfolios({
      page: pagination.page || 1,
      pageSize: pagination.pageSize || 10,
      include_full_details: true,
      ...currentFilters
    });
  }, [filters, fetchPortfolios, pagination.page, pagination.pageSize]);

  const handlePaginationChange = (model) => {
    console.log('PortfolioIndex - Pagination change:', model);
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    
    // Update context pagination
    updatePagination({
      page: model.page + 1, // Convert 0-indexed to 1-indexed
      pageSize: model.pageSize
    });
    
    // Fetch data with new pagination
    fetchPortfolios({
      page: model.page + 1, // Convert 0-indexed to 1-indexed
      pageSize: model.pageSize,
      include_full_details: true,
      ...currentFilters
    });
  };

  const handleSortModelChange = (newModel) => {
    console.log('PortfolioIndex - Sort model change:', newModel);
    const updated = newModel.length > 0 ? [newModel[0]] : [{ field: 'name', sort: 'asc' }];
    setSortModel(updated);
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchPortfolios({
      page: pagination.page || 1,
      pageSize: pagination.pageSize || 10,
      include_full_details: true,
      ...currentFilters,
      sort_field: updated[0].field,
      sort_order: updated[0].sort
    });
  };

  const handleFiltersChange = (newFilters) => {
    console.log('PortfolioIndex - Filters changed:', newFilters);
    updateFilters(newFilters);
  };

  const handleSearch = (searchFilters) => {
    console.log('PortfolioIndex - Search triggered with filters:', searchFilters);
    updateFilters(searchFilters);
    
    // Reset to first page when searching
    updatePagination({
      page: 1,
      pageSize: pagination.pageSize || 10
    });
    
    fetchPortfolios({
      page: 1,
      pageSize: pagination.pageSize || 10,
      include_full_details: true,
      ...searchFilters
    });
  };

  // Custom fetch function for ReusableDataGrid
  const customFetchData = useCallback(async (page, pageSize, sortModel, searchFilters) => {
    console.log('PortfolioIndex - customFetchData called:', { page, pageSize, sortModel, searchFilters });
    
    const params = {
      page: page + 1, // Convert 0-indexed to 1-indexed
      pageSize: pageSize,
      include_full_details: true,
      ...searchFilters
    };
    
    if (sortModel && sortModel.length > 0) {
      params.sort_field = sortModel[0].field;
      params.sort_order = sortModel[0].sort;
    }
    
    const result = await fetchPortfolios(params);
    
    return {
      data: result.items || [],
      totalCount: result.total || 0
    };
  }, [fetchPortfolios]);

  // Define columns for the grid
  const columns = [
    { 
      field: 'name', 
      headerName: 'Portfolio Name', 
      flex: 1, 
      minWidth: 200,
      disableColumnMenu: true,
      sortable: true,
      renderCell: (params) => (
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 500,
            color: '#1976d2',
            fontSize: '0.875rem'
          }}
        >
          {params.value}
        </Typography>
      ),
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
          {sortModel[0]?.field === 'name' && (
            <Box component="span" sx={{ display: 'inline-flex', ml: 0.5 }}>
              {sortModel[0].sort === 'asc' ? 
                <ArrowUpward fontSize="small" sx={{ fontSize: '1rem', color: '#1976d2' }} /> : 
                <ArrowDownward fontSize="small" sx={{ fontSize: '1rem', color: '#1976d2' }} />
              }
            </Box>
          )}
        </Box>
      )
    },
    { 
      field: 'description', 
      headerName: 'Description', 
      flex: 2, 
      minWidth: 300,
      disableColumnMenu: true,
      sortable: true,
      renderCell: (params) => (
        <Typography 
          variant="body2" 
          sx={{ 
            fontSize: '0.875rem',
            color: '#424242',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {params.value || '-'}
        </Typography>
      ),
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
          {sortModel[0]?.field === 'description' && (
            <Box component="span" sx={{ display: 'inline-flex', ml: 0.5 }}>
              {sortModel[0].sort === 'asc' ? 
                <ArrowUpward fontSize="small" sx={{ fontSize: '1rem', color: '#1976d2' }} /> : 
                <ArrowDownward fontSize="small" sx={{ fontSize: '1rem', color: '#1976d2' }} />
              }
            </Box>
          )}
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 220,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Portfolio Data">
            <IconButton 
              onClick={() => handlePortfolioDataClick(params.row)} 
              size="small" 
              sx={{ 
                color: '#1976d2',
                '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.04)' }
              }}
            >
              <DashboardIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Portfolio">
            <IconButton 
              onClick={() => handleEditClick(params.row)} 
              size="small"
              sx={{ 
                color: '#1976d2',
                '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.04)' }
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Portfolio">
            <IconButton 
              onClick={() => handleDeleteClick(params.row)} 
              size="small" 
              sx={{ 
                color: '#e53935',
                '&:hover': { backgroundColor: 'rgba(229, 57, 53, 0.04)' }
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  // Handle create button click
  const handleCreateClick = () => {
    setSelectedPortfolio(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  // Handle edit button click
  const handleEditClick = (portfolio) => {
    setSelectedPortfolio(portfolio);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  // Handle delete button click
  const handleDeleteClick = (portfolio) => {
    setSelectedPortfolio(portfolio);
    setFormMode('delete');
    setIsFormOpen(true);
  };

  // Handle images button click
  const handleImagesClick = (portfolio) => {
    setSelectedPortfolio(portfolio);
    setIsImageFormOpen(true);
  };

  // Handle attachments button click
  const handleAttachmentsClick = (portfolio) => {
    navigate(`/portfolios/${portfolio.id}/attachments`);
  };

  // Handle portfolio data button click
  const handlePortfolioDataClick = (portfolio) => {
    setSelectedPortfolio(portfolio);
    setIsPortfolioDataOpen(true);
  };

  // Handle form close
  const handleFormClose = (refreshData) => {
    setIsFormOpen(false);
    if (refreshData) {
      // Refresh the grid
      const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
      fetchPortfolios({
        page: pagination.page || 1,
        pageSize: pagination.pageSize || 10,
        include_full_details: true,
        ...currentFilters
      });
    }
  };

  // Handle image form close
  const handleImageFormClose = (refreshData) => {
    setIsImageFormOpen(false);
    if (refreshData) {
      // Refresh the grid
      const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
      fetchPortfolios({
        page: pagination.page || 1,
        pageSize: pagination.pageSize || 10,
        include_full_details: true,
        ...currentFilters
      });
    }
  };

  // Handle portfolio data close
  const handlePortfolioDataClose = () => {
    setIsPortfolioDataOpen(false);
    setSelectedPortfolio(null);
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error loading portfolios: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%', p: 2 }}>
      <ReusableDataGrid
        title="Portfolios Management"
        rows={portfolios}
        columns={columns}
        loading={loading}
        totalRows={pagination.total}
        disableRowSelectionOnClick
        pagination={{
          page: (pagination.page || 1) - 1, // Convert 1-indexed to 0-indexed for DataGrid
          pageSize: pagination.pageSize || 10,
          total: pagination.total || 0
        }}
        onPaginationChange={handlePaginationChange}
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        onCreateClick={handleCreateClick}
        createButtonText="Portfolio"
        currentFilters={filters}
        FiltersComponent={() => (
          <ReusableFilters
            filterTypes={FILTER_TYPES}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onSearch={handleSearch}
          />
        )}
        onFiltersChange={handleFiltersChange}
        onSearch={handleSearch}
        PaginationComponent={(props) => (
          <ReusablePagination
            pagination={{
              page: (pagination.page || 1) - 1, // Convert 1-indexed to 0-indexed for ReusablePagination
              pageSize: pagination.pageSize || 10,
              total: pagination.total || 0
            }}
            onPaginationChange={handlePaginationChange}
          />
        )}
        defaultPageSize={pagination.pageSize}
        uiVariant="categoryIndex"
        paginationPosition="top"
        initialState={{
          columns: {
            columnVisibilityModel: {
              id: false
            }
          }
        }}
        gridSx={{
          // Hide default DataGrid sort icons (we use custom ones)
          '.MuiDataGrid-iconButtonContainer': { display: 'none', visibility: 'hidden', width: 0, opacity: 0 },
          '.MuiDataGrid-sortIcon': { display: 'none', visibility: 'hidden', opacity: 0 },
          // Ensure column headers are visible for our custom sort icons
          '.MuiDataGrid-columnHeader': { display: 'flex', visibility: 'visible', opacity: 1 },
          '.MuiDataGrid-columnHeaderTitle': { display: 'block', visibility: 'visible', opacity: 1, fontWeight: 500, color: '#505050' },
          '& .MuiDataGrid-footerContainer': { display: 'none' },
          '& .MuiDataGrid-cell': {
            fontSize: '0.875rem',
            borderBottom: '1px solid #f0f0f0'
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#fafafa',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderBottom: '2px solid #e0e0e0'
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: '#f8f9fa'
          }
        }}
      />

      {isFormOpen && (
        <PortfolioForm
          open={isFormOpen}
          onClose={handleFormClose}
          portfolio={selectedPortfolio}
          mode={formMode}
        />
      )}

      {isImageFormOpen && (
        <PortfolioImageForm
          open={isImageFormOpen}
          onClose={handleImageFormClose}
          portfolio={selectedPortfolio}
        />
      )}

      {isPortfolioDataOpen && (
        <PortfolioData
          open={isPortfolioDataOpen}
          onClose={handlePortfolioDataClose}
          portfolioId={selectedPortfolio?.id}
          portfolioName={selectedPortfolio?.name}
        />
      )}
    </Box>
  );
}

function PortfolioIndex() {
  return (
    <PortfolioProvider>
      <ErrorBoundary>
        <PortfolioIndexContent />
      </ErrorBoundary>
    </PortfolioProvider>
  );
}

export default PortfolioIndex;
