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
import { Edit as EditIcon, Delete as DeleteIcon, ArrowUpward, ArrowDownward, InfoOutlined } from '@mui/icons-material';
import ReusableDataGrid from '../common/ReusableDataGrid';
import CategoryTypeForm from './CategoryTypeForm';
import ReusableFilters from '../common/ReusableFilters';
import ReusablePagination from '../common/ReusablePagination';
import { CategoryTypeErrorBoundary, useCategoryType } from '../../contexts/CategoryTypeContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import ModuleGate from '../common/ModuleGate';
import PermissionGate from '../common/PermissionGate';
import PermissionDenied from '../common/PermissionDenied';
import { buildViewDeniedMessage } from '../../utils/permissionMessages';
import { evaluateGridColumnAccess, evaluateFilterAccess } from '../../utils/accessControl';
import { CONTAINER_PY, SECTION_PX, GRID_WRAPPER_PB } from '../common/layoutTokens';

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
  accessDenied,
    pagination,
    fetchCategoryTypes,
    filters,
    updateFilters,
    clearFilters,
  } = useCategoryType();
  
  const { canPerformOperation, isSystemAdmin, hasPermission, hasAnyPermission } = useAuthorization();

  const [sortModel, setSortModel] = useState([{ field: 'code', sort: 'asc' }]);
  const [formMode, setFormMode] = useState('create');
  const [selectedCategoryType, setSelectedCategoryType] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Build access notices for filters (both require viewing category types)
  const { noticesByType } = (() => {
    const authorization = { isSystemAdmin, hasPermission, hasAnyPermission };
    return evaluateFilterAccess(Object.keys(FILTER_TYPES), {
      code: { required: 'VIEW_CATEGORY_TYPES', moduleKey: 'categorytypes' },
      name: { required: 'VIEW_CATEGORY_TYPES', moduleKey: 'categorytypes' }
    }, authorization);
  })();

  const FiltersWrapper = ({ filters: currentFilters, onFiltersChange, onSearch }) => (
    <ReusableFilters
      filterTypes={FILTER_TYPES}
      filters={currentFilters}
      onFiltersChange={onFiltersChange}
      onSearch={onSearch}
      accessNotices={noticesByType}
    />
  );

  // Initial data is loaded by the CategoryTypeProvider; this component fetches only on user actions.

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

  // Base grid columns (permission-independent definition)
  const baseColumns = [
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

  // Column access mapping and evaluation
  const COLUMN_ACCESS_MAP = React.useMemo(() => ({
    code: { required: 'VIEW_CATEGORY_TYPES', moduleKey: 'categorytypes' },
    name: { required: 'VIEW_CATEGORY_TYPES', moduleKey: 'categorytypes' },
    actions: { required: ['EDIT_CATEGORY_TYPE', 'DELETE_CATEGORY_TYPE', 'MANAGE_CATEGORY_TYPES'], moduleKey: 'categorytypes' }
  }), []);

  const { allowedColumns, deniedColumns } = React.useMemo(() => {
    const authorization = { isSystemAdmin, hasPermission, hasAnyPermission };
    return evaluateGridColumnAccess(COLUMN_ACCESS_MAP, authorization);
  }, [isSystemAdmin, hasPermission, hasAnyPermission, COLUMN_ACCESS_MAP]);

  // Filter visible columns; hide Actions when any denial exists
  const columns = React.useMemo(() => {
    const hideActions = deniedColumns.length > 0;
    return baseColumns.filter(c => allowedColumns.has(c.field) && (!hideActions || c.field !== 'actions'));
  }, [baseColumns, allowedColumns, deniedColumns]);

  // Friendly titles for denied columns
  const deniedColumnTitles = React.useMemo(() => {
    const titleFor = (field) => baseColumns.find(c => c.field === field)?.headerName || field;
    return Array.from(new Set(deniedColumns.map(titleFor)));
  }, [deniedColumns, baseColumns]);

  if (error) {
    return (
      <Box mt={3} p={3} bgcolor="#ffebee" borderRadius={1}>
        <Typography color="error" variant="h6">Error loading category types</Typography>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (accessDenied) {
    return <PermissionDenied message={buildViewDeniedMessage('categorytypes')} />;
  }

  return (
    <>
      {/* Outer container to mirror UserIndex look & spacing (distance to header/menu) */}
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
            topNotice={deniedColumnTitles.length > 0 ? (
              <Box sx={{ mt: 0.5, mb: 1, display: 'inline-flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                <InfoOutlined sx={{ fontSize: 16 }} />
                <Typography sx={{ fontSize: '12px', lineHeight: 1.4 }}>
                  {`You do not have permission to view the columns ${deniedColumnTitles.join(', ')}`}
                </Typography>
              </Box>
            ) : null}
            gridSx={{
              '.MuiDataGrid-iconButtonContainer': { display: 'none', visibility: 'hidden', width: 0, opacity: 0 },
              '.MuiDataGrid-sortIcon': { display: 'none', visibility: 'hidden', opacity: 0 },
              '.MuiDataGrid-columnHeader': { display: 'flex', visibility: 'visible', opacity: 1 },
              '.MuiDataGrid-columnHeaderTitle': { display: 'block', visibility: 'visible', opacity: 1, fontWeight: 500, color: '#505050' },
              '& .MuiDataGrid-footerContainer': { display: 'none' }
            }}
          />
        </Box>
      </Box>

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
  <ModuleGate moduleName="categorytypes" showError={true} errorMessage={buildViewDeniedMessage('categorytypes')}>
    <Container maxWidth={false} disableGutters sx={{ py: CONTAINER_PY }}>
      <CategoryTypeErrorBoundary>
        <CategoryTypeIndexContent />
      </CategoryTypeErrorBoundary>
    </Container>
  </ModuleGate>
);

export default CategoryTypeIndex;
