import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Dialog, 
  DialogTitle, 
  DialogContent,
  Container,
  IconButton,
  Tooltip
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import { ArrowUpward, ArrowDownward, InfoOutlined } from '@mui/icons-material';
import SkillTypeForm from './SkillTypeForm';
import SkillTypeFilters from './SkillTypeFilters';
import { SkillTypeProvider, useSkillType } from '../../contexts/SkillTypeContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import ModuleGate from '../common/ModuleGate';
import PermissionGate from '../common/PermissionGate';
import SkillTypeErrorBoundary from './SkillTypeErrorBoundary';
import { logInfo } from '../../utils/logger';
import { evaluateGridColumnAccess } from '../../utils/accessControl';
import { CONTAINER_PY, HEADER_SPACER_MT, HEADER_SPACER_MB, SECTION_PX, GRID_WRAPPER_PB } from '../common/layoutTokens';

// Custom pagination component (exact copy from CategoryTypeIndex)
const CustomPagination = (props) => {
  const { pagination, pageSizeOptions = [5, 10, 15, 20, 25], onPaginationChange } = props;
  
  const handleChangePageSize = (e) => {
    const newPageSize = parseInt(e.target.value, 10);
    logInfo('CustomPagination: Page size changed to', newPageSize);
    
    // Call the provided callback to update pagination
    if (onPaginationChange) {
      onPaginationChange({ page: 0, pageSize: newPageSize });
    }
  };
  
  const handlePrevPage = () => {
    if (pagination.page > 0) {
      logInfo('CustomPagination: Moving to previous page');
      if (onPaginationChange) {
        onPaginationChange({ ...pagination, page: pagination.page - 1 });
      }
    }
  };
  
  const handleNextPage = () => {
    const lastPage = Math.ceil(pagination.total / pagination.pageSize) - 1;
    if (pagination.page < lastPage) {
      logInfo('CustomPagination: Moving to next page');
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

// Actual component content wrapped with error boundary
const SkillTypeIndexContent = () => {
  const { 
    skillTypes, 
    loading, 
    error, 
    pagination, 
    fetchSkillTypes,
    filters
  } = useSkillType();
  
  const { canPerformOperation, isSystemAdmin, hasPermission, hasAnyPermission } = useAuthorization();
  
  // Force component to re-render when skill types change
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);
  
  // Local state for dialog
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selectedSkillType, setSelectedSkillType] = useState(null);
  
  // Sorting state
  const [sortModel, setSortModel] = useState([
    {
      field: 'code',
      sort: 'asc'
    }
  ]);
  
  // Effect to force re-render when data changes
  useEffect(() => {
    setForceUpdateCounter(prev => prev + 1);
    logInfo(`SkillTypes updated - length: ${skillTypes?.length}`);
  }, [skillTypes]);
  
  // Load skill types on initial render and when dependencies change
  useEffect(() => {
    logInfo('SkillTypeIndexContent - Loading skill types');
    
    // Add guard condition: only fetch if we don't already have data
    if (skillTypes.length === 0 && !loading) {
      // Create request options for initial load
      const initialFilters = filters && Object.keys(filters).length > 0 ? filters : {};
      
      // Call with updated format (exactly like CategoryTypeIndex)
      fetchSkillTypes(pagination.page, pagination.pageSize, initialFilters, sortModel);
    }
  }, [fetchSkillTypes, pagination.pageSize, skillTypes.length, loading]);

  // Handle pagination change
  const handlePaginationChange = (newModel) => {
    logInfo('Pagination changed:', newModel);
    
    // Get current filters from context
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    
    // Call with updated format
    fetchSkillTypes(newModel.page, newModel.pageSize, currentFilters, sortModel);
  };
  
  // Handle sort model change
  const handleSortModelChange = (newSortModel) => {
    logInfo('Sort model changed:', newSortModel);
    
    // Create a new model to apply
    let updatedSortModel = [];
    
    // If new model has data
    if (newSortModel.length > 0) {
      updatedSortModel = [newSortModel[0]];
    } else {
      // Empty model, default to code ascending
      updatedSortModel = [{ field: 'code', sort: 'asc' }];
    }
    
    // Update state with the new model
    setSortModel(updatedSortModel);
    
    // Force a re-render
    setForceUpdateCounter(Date.now());
    
    // Get current filters from context
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    
    // Call with updated format
    fetchSkillTypes(pagination.page, pagination.pageSize, currentFilters, updatedSortModel);
  };

  const handleOpenCreateForm = () => {
    setFormMode('create');
    setSelectedSkillType(null);
    setIsFormOpen(true);
    logInfo('Opening create skill type form');
  };

  const handleOpenEditForm = (skillType) => {
    setFormMode('edit');
    setSelectedSkillType(skillType);
    setIsFormOpen(true);
    logInfo('Opening edit skill type form for:', skillType);
  };

  const handleOpenDeleteForm = (skillType) => {
    setFormMode('delete');
    setSelectedSkillType(skillType);
    setIsFormOpen(true);
    logInfo('Opening delete skill type confirmation for:', skillType);
  };
  
  const handleFormClose = (shouldRefresh = false) => {
    setIsFormOpen(false);
    logInfo('Closing skill type form, shouldRefresh:', shouldRefresh);
    
    if (shouldRefresh) {
      // Get current filters from context
      const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
      
      // Call with updated format
      fetchSkillTypes(pagination.page, pagination.pageSize, currentFilters, sortModel);
    }
  };

  // Define columns for the data grid (exact copy from CategoryTypeIndex)
  const baseColumns = [
    {
      field: 'code',
      headerName: 'Code',
      flex: 1,
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
      field: 'name',
      headerName: 'Name',
      flex: 2,
      minWidth: 200,
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
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      width: 120,
      renderHeader: (params) => (
        <Typography 
          sx={{ 
            fontWeight: 500, 
            fontSize: '13px', 
            color: '#505050',
            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            letterSpacing: '0.3px'
          }}
        >
          {params.colDef.headerName}
        </Typography>
      ),
  renderCell: (params) => (
        <Box>
          <PermissionGate permission="EDIT_SKILL_TYPE">
            <Tooltip title="Edit">
              <IconButton
        aria-label="Edit skill type"
                onClick={() => handleOpenEditForm(params.row)}
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
          <PermissionGate permission="DELETE_SKILL_TYPE">
            <Tooltip title="Delete">
              <IconButton
        aria-label="Delete skill type"
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

  // Permission-aware column visibility
  const COLUMN_ACCESS_MAP = React.useMemo(() => ({
    code: { required: 'VIEW_SKILL_TYPES', moduleKey: 'skilltypes' },
    name: { required: 'VIEW_SKILL_TYPES', moduleKey: 'skilltypes' },
    actions: { required: ['EDIT_SKILL_TYPE', 'DELETE_SKILL_TYPE', 'MANAGE_SKILL_TYPES'], moduleKey: 'skilltypes' }
  }), []);

  const { allowedColumns, deniedColumns } = React.useMemo(() => {
    const authorization = { isSystemAdmin, hasPermission, hasAnyPermission };
    return evaluateGridColumnAccess(COLUMN_ACCESS_MAP, authorization);
  }, [isSystemAdmin, hasPermission, hasAnyPermission, COLUMN_ACCESS_MAP]);

  const columns = React.useMemo(() => {
    const hideActions = deniedColumns.length > 0;
    return baseColumns.filter(c => allowedColumns.has(c.field) && (!hideActions || c.field !== 'actions'));
  }, [baseColumns, allowedColumns, deniedColumns]);

  const deniedColumnTitles = React.useMemo(() => {
    const titleFor = (field) => baseColumns.find(c => c.field === field)?.headerName || field;
    return Array.from(new Set(deniedColumns.map(titleFor)));
  }, [deniedColumns, baseColumns]);

  if (error) {
    return (
      <Box mt={3} p={3} bgcolor="#ffebee" borderRadius={1}>
        <Typography color="error" variant="h6">Error loading skill types</Typography>
        <Typography color="error">{error}</Typography>
        <Button 
          variant="contained" 
          onClick={() => {
            // Get current filters from context
            const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
            
            // Call with updated format
            fetchSkillTypes(pagination.page, pagination.pageSize, currentFilters, sortModel);
          }} 
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
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
          Skill Types Management
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
        {/* Keep header spacing consistent with Users/Skills index via tokens */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center', 
          mt: HEADER_SPACER_MT, 
          mb: HEADER_SPACER_MB 
        }} />
      </Box>
      
      <Box sx={{ px: SECTION_PX }}>
        <SkillTypeFilters />
      </Box>
      
      <Box sx={{ 
        flex: 1,
        minHeight: 'auto',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        px: SECTION_PX,
        pb: GRID_WRAPPER_PB,
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
          `}
        </style>
        
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
          <PermissionGate permission="CREATE_SKILL_TYPE">
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateForm}
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
              New Skill Type
            </Button>
          </PermissionGate>
          
          <CustomPagination 
            pagination={{
              page: pagination.page,
              pageSize: pagination.pageSize,
              total: pagination.total
            }}
            pageSizeOptions={[5, 10, 25, 50]}
            onPaginationChange={handlePaginationChange}
          />
        </Box>

        {deniedColumnTitles.length > 0 && (
          <Box sx={{ mt: 1, mb: 1, display: 'inline-flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            <InfoOutlined sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: '12px', lineHeight: 1.4 }}>
              {`You do not have permission to view the columns ${deniedColumnTitles.join(', ')}`}
            </Typography>
          </Box>
        )}

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
          <DataGrid
            rows={skillTypes || []}
            columns={columns}
            rowCount={pagination.total}
            loading={loading}
            page={pagination.page}
            pageSize={pagination.pageSize}
            rowsPerPageOptions={[]}
            disableColumnMenu
            disableSelectionOnClick
            disableColumnFilter
            disableColumnSelector
            disableDensitySelector
            disableVirtualization
            autoHeight
            headerHeight={50}
            rowHeight={48}
            sortingMode="server"
            sortModel={sortModel}
            onSortModelChange={handleSortModelChange}
            getRowId={(row) => row.code}
            hideFooter={true}
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
                display: 'none !important',
                visibility: 'hidden !important',
                height: '0px !important',
                minHeight: '0px !important',
                maxHeight: '0px !important'
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
      
      {/* Form Dialog */}
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
            {formMode === 'create' ? 'Create Skill Type' : 
             formMode === 'edit' ? 'Edit Skill Type' : 'Delete Skill Type'}
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <SkillTypeForm 
              mode={formMode}
              initialData={selectedSkillType}
              onClose={handleFormClose}
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

// Main component with error boundary and security
const SkillTypeIndex = () => {
  return (
    <ModuleGate moduleName="skilltypes" showError={true}>
      <SkillTypeProvider>
  <Container maxWidth={false} disableGutters sx={{ py: CONTAINER_PY }}>
          <SkillTypeErrorBoundary>
            <SkillTypeIndexContent />
          </SkillTypeErrorBoundary>
        </Container>
      </SkillTypeProvider>
    </ModuleGate>
  );
};

export default SkillTypeIndex; 