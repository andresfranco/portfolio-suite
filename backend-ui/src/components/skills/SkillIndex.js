import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, IconButton, Tooltip, Chip, Stack, CircularProgress, Button, Typography, Container, Paper } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add, KeyboardArrowLeft, KeyboardArrowRight, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import SkillForm from './SkillForm';
import SkillFilters from './SkillFilters';
import SkillErrorBoundary from './SkillErrorBoundary';
import { useSkill, SkillProvider } from '../../contexts/SkillContext';
import { useCategoryType } from '../../contexts/CategoryTypeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import ModuleGate from '../common/ModuleGate';
import PermissionGate from '../common/PermissionGate';
import { logInfo, logError } from '../../utils/logger';

// Custom pagination component (exact copy from CategoryIndex)
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

function SkillIndexContent() {
  const { 
    skills,
    loading: skillsLoading, 
    error: skillError,
    filters, 
    updateFilters,
    pagination,
    fetchSkills,
    updatePagination,
    updateSortModel,
    sortModel
  } = useSkill();
  
  const { categoryTypes, loading: categoryTypesLoading } = useCategoryType();
  const { languages, loading: languagesLoading } = useLanguage();
  const { canPerformOperation } = useAuthorization();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [gridKey, setGridKey] = useState(0);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10
  });

  // Add ref to track if initial load is done
  const initialLoadDone = useRef(false);

  // Force component to re-render when sort model changes (exact copy from CategoryIndex)
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);

  // Function to get language name and code from ID (exact copy from CategoryIndex)
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

  // Helper functions for displaying related data
  const getSkillTypeName = useCallback((skill) => {
    // First, try to get the name from the skill_type object if it exists
    if (skill && skill.skill_type && skill.skill_type.name) {
      return skill.skill_type.name;
    }
    
    // Fallback to finding the skill type in categoryTypes using type_code
    const typeCode = skill?.type_code;
    if (!typeCode) return 'Unknown';
    
    const skillType = categoryTypes.find(type => type.code === typeCode);
    return skillType ? skillType.name : typeCode;
  }, [categoryTypes]);

  const getCategoryNamesInDefaultLanguage = useCallback((categories) => {
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return [];
    }
    
    const result = categories.map((category, index) => {
      // Try to get category name from category_texts
      if (category.category_texts && Array.isArray(category.category_texts) && category.category_texts.length > 0) {
        // First, look for text with language.is_default = true
        const defaultText = category.category_texts.find(text => 
          text.language && text.language.is_default === true
        );
        
        if (defaultText && defaultText.name) {
          return defaultText.name;
        }
        
        // If no default language text found, use the first available text
        const firstText = category.category_texts[0];
        
        if (firstText && firstText.name) {
          return firstText.name;
        }
      }
      
      // Fallback to direct name property or code
      return category.name || category.code || `Category ${category.id}`;
    });
    
    return result;
  }, []); // Remove dependency on languages since we're using embedded data

  // Define columns for the grid (mirroring CategoryIndex structure exactly, removing ID column)
  const columns = [
    { 
      field: 'type_code', 
      headerName: 'Type', 
      flex: 0.5, 
      disableColumnMenu: true,
      sortable: true,
      valueGetter: (params) => {
        if (!params || !params.row) return '-';
        return getSkillTypeName(params.row);
      },
      renderCell: (params) => {
        if (!params || !params.row) return <div>-</div>;
        const skillTypeName = getSkillTypeName(params.row);
        return <div>{skillTypeName}</div>;
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
      field: 'categories',
      headerName: 'Categories',
      flex: 0.8,
      sortable: false,
      disableColumnMenu: true,
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
      valueGetter: (params) => {
        // Use params.row.categories instead of params.value
        const categories = params.row?.categories || [];
        const categoryNames = getCategoryNamesInDefaultLanguage(categories);
        return categoryNames.length > 0 ? categoryNames.join(', ') : '-';
      },
      renderCell: (params) => {
        // Use params.row.categories instead of params.value
        const categories = params.row?.categories || [];
        
        const categoryNames = getCategoryNamesInDefaultLanguage(categories);
        
        if (categoryNames.length === 0) {
          return (
            <Typography sx={{ fontSize: '13px', color: '#999', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' }}>
              -
            </Typography>
          );
        }
        
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
              {categoryNames.join(', ')}
            </Typography>
          </Box>
        );
      }
    },
    { 
      field: 'skill_names', 
      headerName: 'Names', 
      flex: 1,
      sortable: false,
      disableColumnMenu: true,
      valueGetter: (params) => {
        if (!params?.row?.skill_texts) return '-';
        const texts = Array.isArray(params.row.skill_texts) ? params.row.skill_texts : [];
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
        if (!params?.row?.skill_texts) return <div>-</div>;
        const texts = Array.isArray(params.row.skill_texts) ? params.row.skill_texts : [];
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
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      disableColumnMenu: true,
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
      renderCell: (params) => {
        if (!params || !params.row) return null;
        return (
          <Box>
            <PermissionGate permission="EDIT_SKILL">
              <Tooltip title="Edit Skill">
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
            <PermissionGate permission="DELETE_SKILL">
              <Tooltip title="Delete Skill">
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
      }
    }
  ];

  const handleCreateClick = () => {
    setSelectedSkill(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  const handleEditClick = (skill) => {
    setSelectedSkill(skill);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleDeleteClick = (skill) => {
    setSelectedSkill(skill);
    setFormMode('delete');
    setIsFormOpen(true);
  };

  const handleFormClose = (refreshData = false) => {
    setIsFormOpen(false);
    setSelectedSkill(null);
    setFormMode(null);
    
    if (refreshData) {
      // Refresh the skills list after successful operation
      logInfo('SkillIndex', 'Refreshing skills data after form operation');
      
      // For delete operations, check if we need to go to previous page
      // (in case we deleted the last item on the current page)
      let targetPage = pagination.page;
      if (formMode === 'delete') {
        const currentItemsOnPage = skills.length;
        // If we're deleting the last item on a page that's not page 1, go to previous page
        if (currentItemsOnPage === 1 && pagination.page > 1) {
          targetPage = pagination.page - 1;
          // Update the pagination context to reflect the new page
          updatePagination({ ...pagination, page: targetPage });
          // Update local pagination model for DataGrid
          setPaginationModel({ page: targetPage - 1, pageSize: pagination.pageSize });
        }
      }
      
      // Use the target page for fetching
      fetchSkills(targetPage, pagination.pageSize, filters, sortModel);
      
      // Force re-render with new key to ensure fresh state
      setGridKey(prev => prev + 1);
    }
  };

  // Handle pagination change from DataGrid (matching CategoryIndex pattern)
  const handlePaginationChange = useCallback((params) => {
    logInfo('SkillIndex', 'Pagination changed', { params });
    setPaginationModel(params);
    updatePagination({
      page: params.page + 1, // Convert from 0-indexed to 1-indexed for backend
      pageSize: params.pageSize
    });
    fetchSkills(params.page + 1, params.pageSize, filters, sortModel); // Convert to 1-indexed
  }, [updatePagination, fetchSkills, filters, sortModel]);

  // Handle custom pagination change (matching CategoryIndex pattern)
  const handleCustomPaginationChange = (newPagination) => {
    logInfo('SkillIndex', 'Custom pagination changed', newPagination);
    
    const paginationUpdate = {
      page: newPagination.page + 1, // Convert from 0-indexed to 1-indexed
      pageSize: newPagination.pageSize
    };
    
    updatePagination(paginationUpdate);
    setPaginationModel(newPagination);
    
    // Fetch skills with new pagination
    fetchSkills(paginationUpdate.page, paginationUpdate.pageSize, filters, sortModel);
  };

  // Handle sort model change (matching CategoryIndex pattern)
  const handleSortModelChange = useCallback((newSortModel) => {
    logInfo('SkillIndex', 'Sort model changed', newSortModel);
    
    // Create a new model to apply
    let updatedSortModel = [];
    
    // If new model has data
    if (newSortModel.length > 0) {
      updatedSortModel = [newSortModel[0]];
    } else {
      // Empty model, default to type_code ascending
      updatedSortModel = [{ field: 'type_code', sort: 'asc' }];
    }
    
    // Update state with the new model
    updateSortModel(updatedSortModel);
    
    // Force a re-render to update sort icons
    setForceUpdateCounter(Date.now());
    
    // Get current filters from context
    const currentFilters = filters && Array.isArray(filters) ? filters : [];
    
    // Fetch data with new sort
    fetchSkills(pagination.page, pagination.pageSize, currentFilters, updatedSortModel);
  }, [updateSortModel, fetchSkills, pagination.page, pagination.pageSize, filters]);

  // Handle filters change (matching CategoryIndex pattern)
  const handleFiltersChange = useCallback((newFilters) => {
    logInfo('SkillIndex', 'Filters changed', newFilters);
    updateFilters(newFilters);
    
    // Reset to first page when filters change and trigger fetch
    const newPagination = { page: 1, pageSize: pagination.pageSize };
    updatePagination(newPagination);
    
    // Update local pagination model for DataGrid
    setPaginationModel({ page: 0, pageSize: pagination.pageSize });
    
    // Fetch with new filters
    fetchSkills(1, pagination.pageSize, newFilters, sortModel);
  }, [updateFilters, updatePagination, pagination.pageSize, fetchSkills, sortModel]);

  // Handle search (matching CategoryIndex pattern)
  const handleSearch = useCallback((searchFilters) => {
    logInfo('SkillIndex', 'Search triggered', searchFilters);
    updateFilters(searchFilters);
    
    // Reset to first page when searching and trigger fetch
    const newPagination = { page: 1, pageSize: pagination.pageSize };
    updatePagination(newPagination);
    
    // Update local pagination model for DataGrid
    setPaginationModel({ page: 0, pageSize: pagination.pageSize });
    
    // Fetch with search filters
    fetchSkills(1, pagination.pageSize, searchFilters, sortModel);
  }, [updateFilters, updatePagination, pagination.pageSize, fetchSkills, sortModel]);

  // Initial data load (matching CategoryIndex pattern)
  useEffect(() => {
    if (!initialLoadDone.current) {
      logInfo('SkillIndex', 'Performing initial data load');
      fetchSkills(1, 10); // Load first page with default page size
      initialLoadDone.current = true;
    }
  }, [fetchSkills]);

  // Sync pagination model with context state (matching CategoryIndex pattern)
  useEffect(() => {
    setPaginationModel({
      page: (pagination.page || 1) - 1, // Convert from 1-indexed to 0-indexed
      pageSize: pagination.pageSize || 10
    });
  }, [pagination.page, pagination.pageSize]);

  // Handle loading and error states (matching CategoryIndex pattern)
  if (skillError) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error" variant="h6" gutterBottom>
          Error loading skills
        </Typography>
        <Typography color="error" variant="body2">
          {skillError}
        </Typography>
        <Button 
          variant="outlined" 
          onClick={() => fetchSkills(1, 10)} 
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  const isLoading = skillsLoading || categoryTypesLoading || languagesLoading;

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
          Skills Management
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
            <SkillFilters 
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
                
                /* Skill names cells override */
                .MuiDataGrid-cell[data-field="skill_names"],
                .MuiDataGrid-root .MuiDataGrid-cell[data-field="skill_names"],
                div[class*="-MuiDataGrid-cell"][data-field="skill_names"],
                .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell[data-field="skill_names"] {
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
                
                /* Skill names cell inner container */
                .MuiDataGrid-cell[data-field="skill_names"] > div,
                .MuiDataGrid-root .MuiDataGrid-cell[data-field="skill_names"] > div,
                div[class*="-MuiDataGrid-cell"][data-field="skill_names"] > div,
                .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell[data-field="skill_names"] > div {
                  height: auto !important;
                  min-height: 100% !important;
                  max-height: none !important;
                  width: 100% !important;
                  overflow: visible !important;
                  white-space: normal !important;
                  word-wrap: break-word !important;
                  word-break: break-word !important;
                }
                
                /* Categories cells override */
                .MuiDataGrid-cell[data-field="categories"],
                .MuiDataGrid-root .MuiDataGrid-cell[data-field="categories"],
                div[class*="-MuiDataGrid-cell"][data-field="categories"],
                .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell[data-field="categories"] {
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
                
                /* Categories cell inner container */
                .MuiDataGrid-cell[data-field="categories"] > div,
                .MuiDataGrid-root .MuiDataGrid-cell[data-field="categories"] > div,
                div[class*="-MuiDataGrid-cell"][data-field="categories"] > div,
                .css-1jim79h-MuiDataGrid-root .MuiDataGrid-cell[data-field="categories"] > div {
                  height: auto !important;
                  min-height: 100% !important;
                  max-height: none !important;
                  width: 100% !important;
                  overflow: visible !important;
                  white-space: normal !important;
                  word-wrap: break-word !important;
                  word-break: break-word !important;
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

                /* Hide default sort icons - mirror CategoryIndex */
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
              {/* Create Skill button placed at the left side */}
              <PermissionGate permission="CREATE_SKILL">
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
                  New Skill
                </Button>
              </PermissionGate>

              <CustomPagination 
                pagination={{
                  page: paginationModel.page,
                  pageSize: paginationModel.pageSize,
                  total: pagination.total || 0
                }}
                onPaginationChange={handleCustomPaginationChange}
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
                rows={skills || []}
                columns={columns}
                rowCount={pagination.total}
                loading={skillsLoading}
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
        <SkillForm
          open={isFormOpen}
          onClose={handleFormClose}
          skill={selectedSkill}
          mode={formMode}
        />
      )}
    </Box>
  );
}

// Main component with error boundary and security
const SkillIndex = () => {
  return (
    <ModuleGate moduleName="skills" showError={true}>
      <SkillProvider>
        <Container maxWidth={false} sx={{ py: 3 }}>
          <SkillErrorBoundary>
            <SkillIndexContent />
          </SkillErrorBoundary>
        </Container>
      </SkillProvider>
    </ModuleGate>
  );
};

export default SkillIndex;