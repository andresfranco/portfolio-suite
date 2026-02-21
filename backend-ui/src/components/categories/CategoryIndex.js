import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, IconButton, Tooltip, Chip, Stack, CircularProgress, Button, Typography, Container, Paper } from '@mui/material';
import { CONTAINER_PY, SECTION_PX } from '../common/layoutTokens';
import { Edit as EditIcon, Delete as DeleteIcon, Add, KeyboardArrowLeft, KeyboardArrowRight, ArrowUpward, ArrowDownward, InfoOutlined } from '@mui/icons-material';
import ReusableDataGrid from '../common/ReusableDataGrid';
import CategoryForm from './CategoryForm';
import CategoryFilters from './CategoryFilters';
import CategoryErrorBoundary from './CategoryErrorBoundary';
import { useCategory } from '../../contexts/CategoryContext';
import { useCategoryType } from '../../contexts/CategoryTypeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { evaluateGridColumnAccess } from '../../utils/accessControl';
import ModuleGate from '../common/ModuleGate';
import PermissionGate from '../common/PermissionGate';
import { logInfo, logError } from '../../utils/logger';

// Custom pagination component with a native select
const CustomPagination = (props) => {
  const { pagination, onPaginationChange } = props;
  
  const handleChangePageSize = (e) => {
    const newPageSize = parseInt(e.target.value, 10);
    
    // Call the provided callback to update pagination
    if (onPaginationChange) {
      onPaginationChange({ page: 0, pageSize: newPageSize });
    }
  };
  
  const handlePrevPage = () => {
    if (pagination.page > 0) {
      if (onPaginationChange) {
        onPaginationChange({ ...pagination, page: pagination.page - 1 });
      }
    }
  };
  
  const handleNextPage = () => {
    const lastPage = Math.ceil(pagination.total / pagination.pageSize) - 1;
    if (pagination.page < lastPage) {
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
        {[5, 10, 15, 20, 25].map((option) => (
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

function CategoryIndexContent() {
  const { 
    categories,
    loading: categoriesLoading, 
    error: categoryError,
    filters, 
    updateFilters,
    pagination,
    fetchCategories,
    updatePagination,
    updateSortModel
  } = useCategory();
  
  const { categoryTypes, loading: categoryTypesLoading } = useCategoryType();
  const { languages, loading: languagesLoading } = useLanguage();
  const { canPerformOperation, isSystemAdmin, hasPermission, hasAnyPermission } = useAuthorization();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [gridKey, setGridKey] = useState(0);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10
  });

  // Add sortModel state to enable sort icons
  const [sortModel, setSortModel] = useState([
    {
      field: 'code',
      sort: 'asc'
    }
  ]);

  // Force component to re-render when sort model changes (similar to CategoryTypeIndex)
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);

  // Function to get language name and code from ID
  const getLanguageInfo = useCallback((languageId) => {
    // Ensure languageId is a number
    const langId = typeof languageId === 'string' ? parseInt(languageId, 10) : languageId;
    
    if (!langId || isNaN(langId)) {
      return { name: 'Unknown', code: 'N/A' };
    }
    
    const language = languages.find(lang => lang.id === langId);
    return language 
      ? { name: language.name, code: language.code } 
      : { name: 'Unknown', code: `ID:${langId}` };
  }, [languages]);

  // Define base columns for the grid
  const baseColumns = [
    { 
      field: 'code', 
      headerName: 'Code', 
      flex: 0.5, 
      disableColumnMenu: true,
      sortable: true,
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
      field: 'type_code', 
      headerName: 'Type', 
      flex: 0.5, 
      disableColumnMenu: true,
      sortable: true,
      valueGetter: (params) => {
        if (!params || !params.row) return '-';
        const typeCode = params.row.type_code || 'GEN';
        const categoryType = categoryTypes.find(type => type.code === typeCode);
        return categoryType ? categoryType.name : typeCode;
      },
      renderCell: (params) => {
        if (!params || !params.row) return <div>-</div>;
        const typeCode = params.row.type_code || 'GEN';
        const categoryType = categoryTypes.find(type => type.code === typeCode);
        return <div>{categoryType ? categoryType.name : typeCode}</div>;
      },
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
          {sortModel[0]?.field === 'type_code' && (
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
      field: 'category_names', 
      headerName: 'Names', 
      flex: 1,
      sortable: false,
      disableColumnMenu: true,
      valueGetter: (params) => {
        if (!params?.row?.category_texts) return '-';
        const texts = Array.isArray(params.row.category_texts) ? params.row.category_texts : [];
        if (texts.length === 0) return '-';
        
        return texts.map(text => {
          if (!text || !text.name) return '';
          
          // Get language info either from the language object or by looking up the language_id
          let languageDisplay = '';
          if (text.language) {
            if (typeof text.language === 'object' && text.language !== null) {
              const lang = text.language;
              languageDisplay = `${lang.code || ''}`;
            }
          }
          
          // Fallback to using language_id
          if (!languageDisplay && text.language_id) {
            const langInfo = getLanguageInfo(text.language_id);
            languageDisplay = langInfo.code;
          }
          
          return `${text.name} (${languageDisplay})`;
        }).filter(Boolean).join(', ');
      },
      renderCell: (params) => {
        if (!params?.row?.category_texts) return <div>-</div>;
        const texts = Array.isArray(params.row.category_texts) ? params.row.category_texts : [];
        if (texts.length === 0) return <div>-</div>;
        
        // Create text representation of all names with languages
        const namesList = texts.map((text, index) => {
          if (!text || !text.name) return null;
          
          // Get language display information
          let languageDisplay = '';
          
          if (text.language) {
            if (typeof text.language === 'object' && text.language !== null) {
              const lang = text.language;
              languageDisplay = lang.code || `ID:${lang.id}`;
            }
          } 
          
          // Fallback to language_id if needed
          if (!languageDisplay && text.language_id) {
            const langInfo = getLanguageInfo(text.language_id);
            languageDisplay = langInfo.code;
          }
          
          // Skip if we couldn't determine language info
          if (!languageDisplay) return null;
          
          return `${text.name} (${languageDisplay})`;
        }).filter(Boolean);
        
        return (
          <Box sx={{ 
            width: '100%',
            wordWrap: 'break-word',
            whiteSpace: 'normal',
            lineHeight: 1.4,
            py: 0.5
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                fontSize: '13px',
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                color: '#424242',
                wordBreak: 'break-word',
                whiteSpace: 'normal'
              }}
            >
              {namesList.join(', ')}
            </Typography>
          </Box>
        );
      },
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
        </Box>
      ),
    },
    { 
      field: 'category_texts', 
      headerName: 'Languages', 
      flex: 0.8,
      sortable: false,
      disableColumnMenu: true,
      valueGetter: (params) => {
        if (!params?.row?.category_texts) return '-';
        const texts = Array.isArray(params.row.category_texts) ? params.row.category_texts : [];
        if (texts.length === 0) return '-';
        
        return texts.map(text => {
          if (!text) return '';
          
          // Get language info either from the language object or by looking up the language_id
          if (text.language) {
            // Check if language is an object with properties or a Language instance
            if (typeof text.language === 'object' && text.language !== null) {
              const lang = text.language;
              return `${lang.name || ''} (${lang.code || ''})`;
            }
          }
          
          // Fallback to using language_id
          if (text.language_id) {
            const langInfo = getLanguageInfo(text.language_id);
            return `${langInfo.name} (${langInfo.code})`;
          }
          
          return '';
        }).filter(Boolean).join(', ');
      },
      renderCell: (params) => {
        if (!params?.row?.category_texts) return <div>-</div>;
        const texts = Array.isArray(params.row.category_texts) ? params.row.category_texts : [];
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
            {texts.map((text, index) => {
              if (!text) return null;
              
              // Get language display information
              let languageDisplay = '';
              let languageId = '';
              
              if (text.language) {
                // Check if language is an object with properties 
                if (typeof text.language === 'object' && text.language !== null) {
                  const lang = text.language;
                  languageDisplay = `${lang.name || ''} (${lang.code || ''})`;
                  languageId = lang.id;
                }
              } 
              
              // Fallback to language_id if needed
              if (!languageDisplay && text.language_id) {
                const langInfo = getLanguageInfo(text.language_id);
                languageDisplay = `${langInfo.name} (${langInfo.code})`;
                languageId = text.language_id;
              }
              
              // Skip if we couldn't determine language info
              if (!languageDisplay) return null;
              
              return (
                <Chip 
                  key={text.id || `lang-${languageId}-${index}`}
                  label={languageDisplay}
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
              );
            }).filter(Boolean)}
          </Stack>
        );
      },
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
        </Box>
      ),
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
            <PermissionGate permission="EDIT_CATEGORY">
              <Tooltip title="Edit Category">
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
            <PermissionGate permission="DELETE_CATEGORY">
              <Tooltip title="Delete Category">
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
      },
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
    }
  ];

  // Column access mapping for Categories grid
  const COLUMN_ACCESS_MAP = useMemo(() => ({
    code: { required: 'VIEW_CATEGORIES', moduleKey: 'categories' },
    type_code: { required: 'VIEW_CATEGORY_TYPES', moduleKey: 'categorytypes' },
    category_names: { required: 'VIEW_CATEGORIES', moduleKey: 'categories' },
    category_texts: { required: 'VIEW_LANGUAGES', moduleKey: 'languages' },
    actions: { required: ['EDIT_CATEGORY', 'DELETE_CATEGORY', 'MANAGE_CATEGORIES'], moduleKey: 'categories' }
  }), []);

  // Compute allowed/denied columns based on permissions
  const { allowedColumns, deniedColumns } = useMemo(() => {
    const authorization = { isSystemAdmin, hasPermission, hasAnyPermission };
    return evaluateGridColumnAccess(COLUMN_ACCESS_MAP, authorization);
  }, [isSystemAdmin, hasPermission, hasAnyPermission, COLUMN_ACCESS_MAP]);

  // Filter visible columns and hide actions when any denial exists
  const columns = useMemo(() => {
    const hideActions = deniedColumns.length > 0;
    return baseColumns.filter(col => allowedColumns.has(col.field) && (!hideActions || col.field !== 'actions'));
  }, [baseColumns, allowedColumns, deniedColumns]);

  // Friendly titles for denied columns
  const deniedColumnTitles = useMemo(() => {
    const titleFor = (field) => baseColumns.find(c => c.field === field)?.headerName || field;
    return Array.from(new Set(deniedColumns.map(titleFor)));
  }, [deniedColumns, baseColumns]);

  // Handle create button click
  const handleCreateClick = () => {
    logInfo('CategoryIndex', 'Create category button clicked');
    setSelectedCategory(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  // Handle edit button click
  const handleEditClick = (category) => {
    logInfo('CategoryIndex', 'Edit category button clicked', { 
      id: category.id,
      code: category.code,
      type_code: category.type_code,
      category_texts: category.category_texts
    });
    
    // Make sure we're passing a complete category object
    if (category) {
      // Ensure the category has all required fields
      const completeCategory = {
        ...category,
        code: category.code || '',
        type_code: category.type_code || '',
        category_texts: Array.isArray(category.category_texts) ? category.category_texts : []
      };
      
      setSelectedCategory(completeCategory);
      setFormMode('edit');
      setIsFormOpen(true);
    } else {
      logError('CategoryIndex', 'Cannot edit category: no category data provided');
    }
  };

  // Handle delete button click
  const handleDeleteClick = (category) => {
    logInfo('CategoryIndex', 'Delete category button clicked', { id: category.id });
    setSelectedCategory(category);
    setFormMode('delete');
    setIsFormOpen(true);
  };

  // Handle form close
  const handleFormClose = (refreshData) => {
    logInfo('CategoryIndex', 'Category form closed', { refreshData });
    setIsFormOpen(false);
    if (refreshData) {
      // Refresh the grid by incrementing the key
      setGridKey(prevKey => prevKey + 1);
      // The context will handle refreshing the data automatically
    }
  };

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters) => {
    logInfo('CategoryIndex', 'Filters changed', { newFilters });
    
    // newFilters is already in the correct array format from CategoryFilters
    // No need to modify it since CategoryFilters now sends proper filter arrays
    
    updateFilters(newFilters);
  }, [updateFilters]);

  // Handle pagination change
  const handlePaginationChange = useCallback((params) => {
    logInfo('CategoryIndex', 'Pagination changed', { params });
    setPaginationModel(params);
    updatePagination({
      page: params.page + 1, // Convert from 0-indexed to 1-indexed for backend
      pageSize: params.pageSize
    });
    fetchCategories(params.page + 1, params.pageSize, filters, sortModel); // Convert to 1-indexed
  }, [updatePagination, fetchCategories, filters, sortModel]);

  // Handle sort model change
  const handleSortModelChange = (newSortModel) => {
    logInfo('CategoryIndex', 'Sort model changed', { newSortModel });
    
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
    
    // Force a re-render to update sort icons
    setForceUpdateCounter(Date.now());
    
    // Get current filters from context
    const currentFilters = filters && Array.isArray(filters) ? filters : [];
    
    // Update context
    updateSortModel(updatedSortModel);
    
    // Fetch data with new sort
    fetchCategories(pagination.page, pagination.pageSize, currentFilters, updatedSortModel);
  };

  // Handle search
  const handleSearch = useCallback((searchFilters) => {
    logInfo('CategoryIndex', 'Search triggered with filters', { searchFilters });
    
    // searchFilters is already in the correct array format from CategoryFilters
    // No need to modify it since CategoryFilters now sends proper filter arrays
    
    updateFilters(searchFilters);
    fetchCategories(1, pagination.pageSize, searchFilters, sortModel); // Use page 1 for 1-indexed backend
  }, [updateFilters, fetchCategories, pagination.pageSize, sortModel]);

  const isLoading = categoriesLoading || categoryTypesLoading || languagesLoading;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '650px', overflow: 'hidden', backgroundColor: '#ffffff', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <Box sx={{ px: SECTION_PX, pb: 2 }}>
        <ReusableDataGrid
          title="Categories Management"
          columns={columns}
          rows={categories || []}
          loading={isLoading}
          totalRows={pagination.total || 0}
          onPaginationModelChange={handlePaginationChange}
          sortModel={sortModel}
          onSortModelChange={handleSortModelChange}
          disableRowSelectionOnClick
          PaginationComponent={CustomPagination}
          paginationPosition="top"
          FiltersComponent={CategoryFilters}
          currentFilters={filters}
          onFiltersChange={handleFiltersChange}
          onSearch={handleSearch}
          createButtonText="Category"
          onCreateClick={hasPermission('CREATE_CATEGORY') ? handleCreateClick : undefined}
          topNotice={deniedColumnTitles.length > 0 ? (
            <Box sx={{ mt: 1, display: 'inline-flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
              <InfoOutlined sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: '12px', lineHeight: 1.4 }}>
                {`You do not have permission to view the columns ${deniedColumnTitles.join(', ')}`}
              </Typography>
            </Box>
          ) : null}
          uiVariant="categoryIndex"
        />
      </Box>

      {isFormOpen && (
        <CategoryForm
          open={isFormOpen}
          onClose={handleFormClose}
          category={selectedCategory}
          mode={formMode}
        />
      )}
    </Box>
  );
}

// Main component with error boundary and security
const CategoryIndex = () => {
  return (
    <ModuleGate moduleName="categories" showError={true}>
  <Container maxWidth={false} disableGutters sx={{ py: CONTAINER_PY }}>
        <CategoryErrorBoundary>
          <CategoryIndexContent />
        </CategoryErrorBoundary>
      </Container>
    </ModuleGate>
  );
};

export default CategoryIndex;
