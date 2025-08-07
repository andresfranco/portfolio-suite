import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import ReusableDataGrid from '../common/ReusableDataGrid';
import CategoryTypeForm from './CategoryTypeForm';
import ReusableFilters from '../common/ReusableFilters';
import ReusablePagination from '../common/ReusablePagination';
import { CategoryTypeErrorBoundary, useCategoryType } from '../../contexts/CategoryTypeContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import ModuleGate from '../common/ModuleGate';
import PermissionGate from '../common/PermissionGate';

const FILTER_TYPES = {
  code: {
    label: 'Code',
    type: 'text',
    placeholder: 'Filter by category type code'
  },
  name: {
    label: 'Name',
    type: 'text',
    placeholder: 'Filter by category type name'
  }
};

const CategoryTypeIndexContent = () => {
  const {
    categoryTypes,
    loading,
    error,
    pagination,
    fetchCategoryTypes,
    filters,
    updateFilters,
    clearFilters,
  } = useCategoryType();
  
  const { canPerformOperation } = useAuthorization();

  const [sortModel, setSortModel] = useState([{ field: 'code', sort: 'asc' }]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selectedCategoryType, setSelectedCategoryType] = useState(null);

  const FiltersWrapper = ({ filters: currentFilters, onFiltersChange, onSearch }) => (
    <ReusableFilters
      filterTypes={FILTER_TYPES}
      filters={currentFilters}
      onFiltersChange={onFiltersChange}
      onSearch={onSearch}
    />
  );

  useEffect(() => {
    const initialFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchCategoryTypes(pagination.page, pagination.pageSize, initialFilters, sortModel);
  }, [fetchCategoryTypes]);

  const handlePaginationChange = (model) => {
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchCategoryTypes(model.page, model.pageSize, currentFilters, sortModel);
  };

  const handleSortModelChange = (newModel) => {
    const updated = newModel.length > 0 ? [newModel[0]] : [{ field: 'code', sort: 'asc' }];
    setSortModel(updated);
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchCategoryTypes(pagination.page, pagination.pageSize, currentFilters, updated);
  };

  const handleFiltersChange = (newFilters) => {
    updateFilters(newFilters);
  };

  const handleSearch = (searchFilters) => {
    updateFilters(searchFilters);
    fetchCategoryTypes(0, pagination.pageSize, searchFilters, sortModel);
  };

  const handleOpenCreateForm = () => {
    setFormMode('create');
    setSelectedCategoryType(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (categoryType) => {
    setFormMode('edit');
    setSelectedCategoryType(categoryType);
    setIsFormOpen(true);
  };

  const handleOpenDeleteForm = (categoryType) => {
    setFormMode('delete');
    setSelectedCategoryType(categoryType);
    setIsFormOpen(true);
  };

  const handleFormClose = (shouldRefresh = false) => {
    setIsFormOpen(false);
    if (shouldRefresh) {
      const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
      fetchCategoryTypes(pagination.page, pagination.pageSize, currentFilters, sortModel);
    }
  };

  const columns = [
    {
      field: 'code',
      headerName: 'Code',
      flex: 1,
      minWidth: 150,
      disableColumnMenu: true,
      sortable: true,
      renderHeader: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '13px', color: '#505050', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', letterSpacing: '0.3px' }}>
          {params.colDef.headerName}
          {sortModel[0]?.field === 'code' && (
            <Box component="span" sx={{ display: 'inline-flex', ml: 0.5 }}>
              {sortModel[0].sort === 'asc' ? (
                <ArrowUpward fontSize="small" sx={{ fontSize: '1rem', color: '#1976d2' }} />
              ) : (
                <ArrowDownward fontSize="small" sx={{ fontSize: '1rem', color: '#1976d2' }} />
              )}
            </Box>
          )}
        </Box>
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 2,
      minWidth: 200,
      disableColumnMenu: true,
      sortable: true,
      renderHeader: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '13px', color: '#505050', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', letterSpacing: '0.3px' }}>
          {params.colDef.headerName}
          {sortModel[0]?.field === 'name' && (
            <Box component="span" sx={{ display: 'inline-flex', ml: 0.5 }}>
              {sortModel[0].sort === 'asc' ? (
                <ArrowUpward fontSize="small" sx={{ fontSize: '1rem', color: '#1976d2' }} />
              ) : (
                <ArrowDownward fontSize="small" sx={{ fontSize: '1rem', color: '#1976d2' }} />
              )}
            </Box>
          )}
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      width: 120,
      renderCell: (params) => (
        <Box>
          <PermissionGate permission="EDIT_CATEGORY_TYPE">
            <Tooltip title="Edit">
              <IconButton
                aria-label="edit category type"
                onClick={() => handleOpenEditForm(params.row)}
                size="small"
                sx={{ color: '#1976d2', p: 0.5, mr: 0.5 }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </PermissionGate>
          <PermissionGate permission="DELETE_CATEGORY_TYPE">
            <Tooltip title="Delete">
              <IconButton
                aria-label="delete category type"
                onClick={() => handleOpenDeleteForm(params.row)}
                size="small"
                sx={{ color: '#e53935', p: 0.5 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </PermissionGate>
        </Box>
      ),
    },
  ];

  if (error) {
    return (
      <Box mt={3} p={3} bgcolor="#ffebee" borderRadius={1}>
        <Typography color="error" variant="h6">Error loading category types</Typography>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <>
      <ReusableDataGrid
        title="Category Types Management"
        columns={columns}
        rows={categoryTypes || []}
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
        PaginationComponent={ReusablePagination}
        createButtonText="Category Type"
        onCreateClick={canPerformOperation('create', 'category_type') ? handleOpenCreateForm : undefined}
        defaultPageSize={10}
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
        <Dialog
          open={isFormOpen}
          onClose={() => handleFormClose()}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '6px',
              boxShadow: '0 3px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            },
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
              letterSpacing: '0.015em',
            }}
          >
            {formMode === 'create'
              ? 'Create Category Type'
              : formMode === 'edit'
              ? 'Edit Category Type'
              : 'Delete Category Type'}
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <CategoryTypeForm
              mode={formMode}
              initialData={selectedCategoryType}
              onClose={handleFormClose}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

const CategoryTypeIndex = () => (
  <ModuleGate moduleName="categorytypes" showError={true}>
    <Container maxWidth={false} sx={{ py: 0 }}>
      <CategoryTypeErrorBoundary>
        <CategoryTypeIndexContent />
      </CategoryTypeErrorBoundary>
    </Container>
  </ModuleGate>
);

export default CategoryTypeIndex;
