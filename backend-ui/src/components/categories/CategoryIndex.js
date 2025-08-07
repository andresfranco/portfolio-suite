import React, { useState, useCallback, useEffect } from 'react';
import { Box, IconButton, Tooltip, Chip, Stack, CircularProgress, Button, Typography, Container, Paper } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add, KeyboardArrowLeft, KeyboardArrowRight, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import CategoryForm from './CategoryForm';
import CategoryFilters from './CategoryFilters';
import CategoryErrorBoundary from './CategoryErrorBoundary';
import { useCategory } from '../../contexts/CategoryContext';
import { useCategoryType } from '../../contexts/CategoryTypeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
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
  const { canPerformOperation } = useAuthorization();

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

  // Define columns for the grid
  const columns = [
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
          Categories Management
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
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress size={60} thickness={4} />
          <Box sx={{ mt: 2, typography: 'subtitle1' }}>Loading data...</Box>
        </Box>
      ) : (
        <>
          <Box sx={{ px: 3 }}>
            <CategoryFilters 
              onFiltersChange={handleFiltersChange} 
              onSearch={handleSearch}
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
                
                .MuiDataGrid-root .MuiDataGrid-virtualScroller::-webkit-scrollbar {
                  width: 8px;
                  height: 8px;
                }
                .MuiDataGrid-root .MuiDataGrid-virtualScroller::-webkit-scrollbar-thumb {
                  background-color: rgba(0, 0, 0, 0.2);
                  border-radius: 4px;
                }
                .MuiDataGrid-root .MuiDataGrid-virtualScroller::-webkit-scrollbar-track {
                  background-color: rgba(0, 0, 0, 0.05);
                }
                .css-1xs4aeo-MuiContainer-root {
                  margin: 0 !important;
                  padding: 0 !important;
                  max-width: 100% !important;
                }
                
                /* Fix for the fixed height issue */
                .css-29opl-MuiPaper-root {
                  height: auto !important;
                  min-height: 400px !important;
                  flex-grow: 1 !important;
                  max-height: none !important;
                  display: flex !important;
                  flex-direction: column !important;
                }
                
                /* Additional selector for the Paper component when rendered in the grid container */
                .MuiContainer-root .css-29opl-MuiPaper-root, 
                .MuiContainer-root [class*="MuiPaper-root"] {
                  height: auto !important;
                  min-height: 400px !important;
                  flex-grow: 1 !important;
                  max-height: none !important;
                }
                
                /* Override any fixed heights in the grid wrapper */
                .MuiDataGrid-root, .MuiDataGrid-root .MuiDataGrid-main {
                  height: auto !important;
                  min-height: 400px !important;
                  flex: 1 !important;
                }
                
                /* Hide bottom pagination completely */
                .MuiDataGrid-footerContainer {
                  display: none !important;
                  visibility: hidden !important;
                  height: 0 !important;
                  overflow: hidden !important;
                  opacity: 0 !important;
                  position: absolute !important;
                  pointer-events: none !important;
                }
                
                /* Additional selectors to make sure pagination is hidden */
                .MuiTablePagination-root {
                  display: none !important;
                  visibility: hidden !important;
                  height: 0 !important;
                  opacity: 0 !important;
                }

                /* COMPREHENSIVE ROW AND CELL EXPANSION OVERRIDES */
                
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
                  align-items: flex-start !important;
                  white-space: normal !important;
                  line-height: 1.5 !important;
                  position: relative !important;
                  padding: 12px 16px !important;
                  box-sizing: border-box !important;
                  transform: none !important;
                  overflow: visible !important;
                  border-right: 1px solid rgba(224, 224, 224, 0.5) !important;
                  word-wrap: break-word !important;
                  word-break: break-word !important;
                }
                
                /* Category names cells override */
                .MuiDataGrid-cell[data-field="category_names"],
                .MuiDataGrid-root .MuiDataGrid-cell[data-field="category_names"],
                div[class*="-MuiDataGrid-cell"][data-field="category_names"],
                .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell[data-field="category_names"] {
                  height: auto !important;
                  min-height: 100% !important;
                  max-height: none !important;
                  padding: 12px 16px !important;
                  align-items: flex-start !important;
                  overflow: visible !important;
                  white-space: normal !important;
                  word-wrap: break-word !important;
                  word-break: break-word !important;
                  z-index: 1 !important;
                }
                
                /* Category names cell inner container */
                .MuiDataGrid-cell[data-field="category_names"] > div,
                .MuiDataGrid-root .MuiDataGrid-cell[data-field="category_names"] > div,
                div[class*="-MuiDataGrid-cell"][data-field="category_names"] > div,
                .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell[data-field="category_names"] > div {
                  height: auto !important;
                  min-height: 100% !important;
                  max-height: none !important;
                  width: 100% !important;
                  overflow: visible !important;
                  white-space: normal !important;
                  word-wrap: break-word !important;
                  word-break: break-word !important;
                }
                
                /* Languages cells override */
                .MuiDataGrid-cell[data-field="category_texts"],
                .MuiDataGrid-root .MuiDataGrid-cell[data-field="category_texts"],
                div[class*="-MuiDataGrid-cell"][data-field="category_texts"],
                .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell[data-field="category_texts"] {
                  height: auto !important;
                  min-height: 100% !important;
                  max-height: none !important;
                  padding: 8px 16px !important;
                  align-items: flex-start !important;
                  overflow: visible !important;
                  z-index: 1 !important;
                }
                
                /* Languages cell inner container */
                .MuiDataGrid-cell[data-field="category_texts"] > div,
                .MuiDataGrid-root .MuiDataGrid-cell[data-field="category_texts"] > div,
                div[class*="-MuiDataGrid-cell"][data-field="category_texts"] > div,
                .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell[data-field="category_texts"] > div {
                  height: auto !important;
                  min-height: 100% !important;
                  max-height: none !important;
                  display: flex !important;
                  flex-wrap: wrap !important;
                  gap: 8px !important;
                  align-items: flex-start !important;
                  align-content: flex-start !important;
                  width: 100% !important;
                  overflow: visible !important;
                }
                
                /* Language chips styling */
                .MuiDataGrid-cell[data-field="category_texts"] .MuiChip-root,
                .MuiDataGrid-root .MuiDataGrid-cell[data-field="category_texts"] .MuiChip-root {
                  height: auto !important;
                  min-height: 24px !important;
                  margin: 2px !important;
                  border-radius: 16px !important;
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
                .MuiDataGrid-columnHeaderTitleContainer button {
                  display: none !important;
                  opacity: 0 !important;
                  visibility: hidden !important;
                  width: 0 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                
                .MuiDataGrid-columnHeaderTitle {
                  font-weight: 500 !important;
                  color: #333 !important;
                }
                
                .MuiDataGrid-columnSeparator {
                  visibility: visible !important;
                  color: rgba(224, 224, 224, 1) !important;
                }

                .MuiDataGrid-root .MuiDataGrid-virtualScroller::-webkit-scrollbar-track {
                  background-color: rgba(0, 0, 0, 0.05);
                }
                
                /* Hide default sort icons - mirror CategoryTypeIndex */
                .MuiDataGrid-iconButtonContainer {
                  display: none !important;
                  visibility: hidden !important;
                  width: 0 !important;
                  opacity: 0 !important;
                }
                .MuiDataGrid-sortIcon {
                  display: none !important;
                  visibility: hidden !important;
                  opacity: 0 !important;
                }
                
                .css-1xs4aeo-MuiContainer-root {
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
              {/* Create Category button placed at the left side */}
              <PermissionGate permission="CREATE_CATEGORY">
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
                  New Category
                </Button>
              </PermissionGate>

              <CustomPagination 
                pagination={{
                  page: paginationModel.page,
                  pageSize: paginationModel.pageSize,
                  total: pagination.total || 0
                }}
                onPaginationChange={handlePaginationChange}
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
            }}>
              <DataGrid
                rows={categories || []}
                columns={columns}
                rowCount={pagination.total}
                loading={categoriesLoading}
                page={paginationModel.page}
                pageSize={paginationModel.pageSize}
                rowsPerPageOptions={[]}
                disableColumnMenu
                disableSelectionOnClick
                disableColumnFilter
                disableColumnSelector
                disableDensitySelector
                disableVirtualization
                autoHeight
                headerHeight={50}
                getRowHeight={() => 'auto'}
                sortingMode="server"
                sortModel={sortModel}
                onSortModelChange={handleSortModelChange}
                getRowId={(row) => row.id}
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
                  },
                  '& .MuiDataGrid-footerContainer': {
                    display: 'none', // Hide default pagination
                  }
                }}
                
                // Important! Set these to null/empty to prevent automatic pagination control
                paginationMode="server"
                componentsProps={{
                  pagination: {
                    component: () => null, // Disable default pagination component
                  },
                }}
              />
            </Box>
          </Box>
        </>
      )}
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
      <Container maxWidth={false} sx={{ py: 3 }}>
        <CategoryErrorBoundary>
          <CategoryIndexContent />
        </CategoryErrorBoundary>
      </Container>
    </ModuleGate>
  );
};

export default CategoryIndex;
