import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, IconButton, Tooltip, Chip, Stack, Typography, Button } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, PhotoLibrary as PhotoLibraryIcon, AttachFile as AttachFileIcon, ArrowUpward, ArrowDownward, Add } from '@mui/icons-material';
import ProjectForm from './ProjectForm';
import ReusableDataGrid from '../common/ReusableDataGrid';
import ReusableFilters from '../common/ReusableFilters';
import ReusablePagination from '../common/ReusablePagination';
import ErrorBoundary from '../common/ErrorBoundary';
import { ProjectProvider, useProjects } from '../../contexts/ProjectContext';
import { categoriesApi, languagesApi, skillsApi } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import ModuleGate from '../common/ModuleGate';
import PermissionGate from '../common/PermissionGate';

function ProjectIndexContent() {
  const {
    projects,
    loading,
    error,
    pagination,
    filters,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    updateFilters,
    updatePagination
  } = useProjects();

  const { canPerformOperation, hasPermission, hasAnyPermission, loading: authLoading, permissions, isSystemAdminUser } = useAuthorization();

  const [sortModel, setSortModel] = useState([{ field: 'categories', sort: 'asc' }]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [languagesMap, setLanguagesMap] = useState({});
  const [categoriesMap, setCategoriesMap] = useState({});
  const [skillsMap, setSkillsMap] = useState({});
  const [defaultLanguage, setDefaultLanguage] = useState(null);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const navigate = useNavigate();

  // Permission helper functions
  const canViewProjectImages = () => hasAnyPermission(['VIEW_PROJECT_IMAGES', 'UPLOAD_PROJECT_IMAGES', 'EDIT_PROJECT_IMAGES', 'DELETE_PROJECT_IMAGES', 'MANAGE_PROJECT_IMAGES', 'MANAGE_PROJECTS']);
  const canViewProjectAttachments = () => hasAnyPermission(['VIEW_PROJECT_ATTACHMENTS', 'UPLOAD_PROJECT_ATTACHMENTS', 'DELETE_PROJECT_ATTACHMENTS', 'MANAGE_PROJECT_ATTACHMENTS', 'MANAGE_PROJECTS']);
  const canEditProject = () => hasAnyPermission(['EDIT_PROJECT', 'MANAGE_PROJECTS']);
  const canDeleteProject = () => hasAnyPermission(['DELETE_PROJECT', 'MANAGE_PROJECTS']);
  const canCreateProject = () => hasAnyPermission(['CREATE_PROJECT', 'MANAGE_PROJECTS']);

  // Add useEffect to log permission checks on component mount and permission changes
  useEffect(() => {
    console.log('[PROJECTS DEBUG] ProjectIndex permissions check:');
    console.log('  - Loading:', authLoading);
    console.log('  - Permissions array:', permissions);
    console.log('  - isSystemAdminUser:', isSystemAdminUser);
    console.log('  - hasPermission("CREATE_PROJECT"):', hasPermission('CREATE_PROJECT'));
    console.log('  - hasPermission("MANAGE_PROJECTS"):', hasPermission('MANAGE_PROJECTS'));
    console.log('  - hasPermission("VIEW_PROJECT_IMAGES"):', hasPermission('VIEW_PROJECT_IMAGES'));
    console.log('  - hasPermission("EDIT_PROJECT_IMAGES"):', hasPermission('EDIT_PROJECT_IMAGES'));
    console.log('  - hasPermission("VIEW_PROJECT_ATTACHMENTS"):', hasPermission('VIEW_PROJECT_ATTACHMENTS'));
    console.log('  - hasPermission("SYSTEM_ADMIN"):', hasPermission('SYSTEM_ADMIN'));
    console.log('  - hasAnyPermission(["CREATE_PROJECT", "MANAGE_PROJECTS"]):', hasAnyPermission(['CREATE_PROJECT', 'MANAGE_PROJECTS']));
    console.log('  - canCreateProject():', canCreateProject());
    console.log('  - canViewProjectImages():', canViewProjectImages());
    console.log('  - canViewProjectAttachments():', canViewProjectAttachments());
  }, [authLoading, permissions, isSystemAdminUser, hasPermission, hasAnyPermission, canCreateProject, canViewProjectImages, canViewProjectAttachments]);

  // Fetch metadata on component mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        // Fetch languages
        const languagesResponse = await languagesApi.getLanguages({ page: 1, page_size: 100 });
        const languages = languagesResponse.data.items || languagesResponse.data || [];
        
        // Create languages map and find default
        const langsMap = {};
        languages.forEach(lang => {
          langsMap[lang.id] = lang.name;
        });
        setLanguagesMap(langsMap);
        setAvailableLanguages(languages);
        
        const defaultLang = languages.find(lang => lang.is_default || lang.isDefault) || 
                         (languages.length > 0 ? languages[0] : null);
        setDefaultLanguage(defaultLang);

        // Fetch categories
        const categoriesResponse = await categoriesApi.getCategories({ page: 1, page_size: 100 });
        
        let categoriesList = [];
        if (categoriesResponse.data && categoriesResponse.data.items) {
          categoriesList = categoriesResponse.data.items;
        } else if (categoriesResponse.data && Array.isArray(categoriesResponse.data)) {
          categoriesList = categoriesResponse.data;
        } else if (Array.isArray(categoriesResponse)) {
          categoriesList = categoriesResponse;
        }
        
        // Filter for project categories (PROJ type)
        const projectCategories = categoriesList.filter(category => 
          category && category.type_code === "PROJ"
        );
        
        // Create categories map with proper names
        const catsMap = {};
        projectCategories.forEach(category => {
          if (!category || !category.id) return;
          
          let categoryName = category.name || 'Unnamed Category';
          
          // Try to get the name in the default language from category_texts
          if (defaultLang && category.category_texts && Array.isArray(category.category_texts)) {
            const defaultText = category.category_texts.find(text => text.language_id === defaultLang.id);
            if (defaultText && defaultText.name) {
              categoryName = defaultText.name;
            }
          }
          
          catsMap[category.id] = categoryName;
        });
        
        setCategoriesMap(catsMap);
        setAvailableCategories(projectCategories);
        
        // Fetch skills
        const skillsResponse = await skillsApi.getSkills({ page: 1, page_size: 100 });
        
        let skillsList = [];
        if (skillsResponse.data && skillsResponse.data.items) {
          skillsList = skillsResponse.data.items;
        } else if (skillsResponse.data && Array.isArray(skillsResponse.data)) {
          skillsList = skillsResponse.data;
        } else if (Array.isArray(skillsResponse)) {
          skillsList = skillsResponse;
        }
        
        // Create skills map with proper names
        const skillsMap = {};
        skillsList.forEach(skill => {
          if (!skill || !skill.id) return;
          
          let skillName = skill.name || 'Unnamed Skill';
          
          // Try to get the name in the default language from skill_texts
          if (defaultLang && skill.skill_texts && Array.isArray(skill.skill_texts)) {
            const defaultText = skill.skill_texts.find(text => text.language_id === defaultLang.id);
            if (defaultText && defaultText.name) {
              skillName = defaultText.name;
            }
          }
          
          skillsMap[skill.id] = skillName;
        });
        
        setSkillsMap(skillsMap);
        setAvailableSkills(skillsList);
      } catch (error) {
        console.error('ProjectIndex - Error fetching metadata:', error);
      }
    };

    fetchMetadata();
  }, []);

  // Helper functions (defined before they are used in filterTypes)
  const getLanguageInfo = useCallback((languageId) => {
    const language = availableLanguages.find(lang => lang.id === languageId);
    if (language) {
      return { name: language.name, code: language.code };
    }
    const languageName = languagesMap[languageId];
    return languageName 
      ? { name: languageName, code: languageId.toString() }
      : { name: `Language ID: ${languageId}`, code: 'Unknown' };
  }, [languagesMap, availableLanguages]);
  
  const getCategoryName = useCallback((categoryId) => {
    const categoryName = categoriesMap[categoryId];
    return categoryName || `Category ID: ${categoryId}`;
  }, [categoriesMap]);
  
  const getSkillName = useCallback((skill) => {
    // If skill is an object with a name property (from backend response)
    if (typeof skill === 'object' && skill.name) {
      return skill.name;
    }
    
    // If skill is an ID, look it up in the skillsMap
    const skillId = typeof skill === 'object' ? skill.id : skill;
    const skillName = skillsMap[skillId];
    return skillName || `Skill ID: ${skillId}`;
  }, [skillsMap]);

  // Define filter types with dynamic options - memoized to prevent recreation
  const FILTER_TYPES = useMemo(() => ({
    name: {
      label: 'Names',
      type: 'text',
      placeholder: 'Filter by project name'
    },
    category_id: {
      type: 'multiselect',
      label: 'Categories',
      options: availableCategories.map(cat => ({
        value: cat.id,
        label: getCategoryName(cat.id)
      })),
      disabled: availableCategories.length === 0
    },
    skill_id: {
      type: 'multiselect',
      label: 'Skills',
      options: availableSkills.map(skill => ({
        value: skill.id,
        label: getSkillName(skill)
      })),
      disabled: availableSkills.length === 0
    },
    language_id: {
      type: 'multiselect',
      label: 'Languages',
      options: availableLanguages.map(lang => ({
        value: lang.id,
        label: lang.name
      })),
      disabled: availableLanguages.length === 0
    }
  }), [availableCategories, availableSkills, availableLanguages, getCategoryName, getSkillName]);

  const FiltersWrapper = useCallback(({ filters: currentFilters, onFiltersChange, onSearch }) => {
    return (
      <ReusableFilters
        filterTypes={FILTER_TYPES}
        filters={currentFilters}
        onFiltersChange={onFiltersChange}
        onSearch={onSearch}
      />
    );
  }, [FILTER_TYPES]);

  // Initial fetch of projects
  useEffect(() => {
    const initialFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchProjects({
      page: pagination.page || 1,
      pageSize: pagination.pageSize || 10,
      include_full_details: true,
      ...initialFilters
    });
  }, []);

  const handlePaginationChange = (model) => {
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    // Convert 0-indexed page from DataGrid to 1-indexed page for backend
    fetchProjects({
      page: model.page + 1,
      pageSize: model.pageSize,
      include_full_details: true,
      ...currentFilters
    });
  };

  const handleSortModelChange = (newModel) => {
    const updated = newModel.length > 0 ? [newModel[0]] : [{ field: 'categories', sort: 'asc' }];
    setSortModel(updated);
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchProjects({
      page: pagination.page || 1,
      pageSize: pagination.pageSize || 10,
      include_full_details: true,
      ...currentFilters,
      sort_field: updated[0].field,
      sort_order: updated[0].sort
    });
  };

  const handleFiltersChange = (newFilters) => {
    let processedFilters = { ...newFilters };
    
    // Remove empty arrays
    Object.keys(processedFilters).forEach(key => {
      if (Array.isArray(processedFilters[key]) && processedFilters[key].length === 0) {
        delete processedFilters[key];
      }
    });
    
    updateFilters(processedFilters);
  };

  const handleSearch = (searchFilters) => {
    console.log('ProjectIndex - handleSearch called with:', searchFilters);
    
    let processedFilters = { ...searchFilters };
    
    // Remove empty arrays
    Object.keys(processedFilters).forEach(key => {
      if (Array.isArray(processedFilters[key]) && processedFilters[key].length === 0) {
        console.log(`ProjectIndex - Removing empty array for key: ${key}`);
        delete processedFilters[key];
      }
    });
    
    console.log('ProjectIndex - Processed filters after cleanup:', processedFilters);
    
    updateFilters(processedFilters);
    
    const fetchParams = {
      page: 1,
      pageSize: pagination.pageSize || 10,
      include_full_details: true,
      ...processedFilters
    };
    
    console.log('ProjectIndex - Calling fetchProjects with params:', fetchParams);
    
    // Call fetchProjects with the processed filters - let the backend handle the filtering logic
    fetchProjects(fetchParams);
  };

  // Handle navigation to project images
  const handleImagesClick = (project) => {
    navigate(`/projects/${project.id}/images`);
  };

  // Handle navigation to project attachments
  const handleAttachmentsClick = (project) => {
    navigate(`/projects/${project.id}/attachments`);
  };

  // Define columns for the grid
  const columns = useMemo(() => [
    { 
      field: 'project_texts', 
      headerName: 'Names', 
      flex: 1.5,
      sortable: false,
      disableColumnMenu: true,
      valueGetter: (params) => {
        if (!params || !params.row) return '-';
        if (!params.row.project_texts) return '-';
        const texts = Array.isArray(params.row.project_texts) ? params.row.project_texts : [];
        if (texts.length === 0) return '-';
        
        return texts.map(text => {
          if (!text || !text.name) return '';
          const langInfo = getLanguageInfo(text.language_id);
          return `${text.name} (${langInfo.code})`;
        }).filter(Boolean).join(', ');
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
      renderCell: (params) => {
        if (!params || !params.row) return <div>-</div>;
        if (!params.row.project_texts) return <div>-</div>;
        const texts = Array.isArray(params.row.project_texts) ? params.row.project_texts : [];
        if (texts.length === 0) return <div>-</div>;
        
        const namesList = texts.map((text) => {
          if (!text || !text.name) return null;
          const langInfo = getLanguageInfo(text.language_id);
          return `${text.name} (${langInfo.code})`;
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
      }
    },
    {
      field: 'categories',
      headerName: 'Categories',
      flex: 1,
      sortable: false,
      disableColumnMenu: true,
      valueGetter: (params) => {
        if (!params || !params.row) return '-';
        if (!params.row.categories) return '-';
        const categories = Array.isArray(params.row.categories) ? params.row.categories : [];
        if (categories.length === 0) return '-';
        return categories.map(category => 
          category && category.id ? getCategoryName(category.id) : 'Unknown'
        ).join(', ');
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
      renderCell: (params) => {
        if (!params || !params.row) return <div>-</div>;
        if (!params.row.categories) return <div>-</div>;
        const categories = Array.isArray(params.row.categories) ? params.row.categories : [];
        if (categories.length === 0) return <div>-</div>;
        
        const categoryNames = categories.map(category => 
          category && category.id ? getCategoryName(category.id) : 'Unknown'
        ).filter(Boolean);
        
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
      field: 'skills',
      headerName: 'Skills',
      flex: 1,
      sortable: false,
      disableColumnMenu: true,
      valueGetter: (params) => {
        if (!params || !params.row) return '-';
        if (!params.row.skills) return '-';
        const skills = Array.isArray(params.row.skills) ? params.row.skills : [];
        if (skills.length === 0) return '-';
        return skills.map(skill => 
          skill && skill.id ? getSkillName(skill) : 'Unknown'
        ).join(', ');
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
      renderCell: (params) => {
        if (!params || !params.row) return <div>-</div>;
        if (!params.row.skills) return <div>-</div>;
        const skills = Array.isArray(params.row.skills) ? params.row.skills : [];
        if (skills.length === 0) return <div>-</div>;
        
        const skillNames = skills.map(skill => 
          skill && skill.id ? getSkillName(skill) : 'Unknown'
        ).filter(Boolean);
        
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
              {skillNames.join(', ')}
            </Typography>
          </Box>
        );
      }
    },
    {
      field: 'urls',
      headerName: 'URLs',
      flex: 1,
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
      renderCell: (params) => {
        if (!params || !params.row) return <div>-</div>;
        
        const urls = [];
        if (params.row.repository_url) {
          urls.push(`Repo: ${params.row.repository_url}`);
        }
        if (params.row.website_url) {
          urls.push(`Web: ${params.row.website_url}`);
        }
        
        if (urls.length === 0) return <div>-</div>;
        
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
              {urls.join(', ')}
            </Typography>
          </Box>
        );
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Project Images">
            <PermissionGate 
              permissions={["VIEW_PROJECT_IMAGES", "UPLOAD_PROJECT_IMAGES", "EDIT_PROJECT_IMAGES", "DELETE_PROJECT_IMAGES", "MANAGE_PROJECT_IMAGES", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]} 
              requireAll={false}
            >
              <IconButton 
                onClick={() => handleImagesClick(params.row)} 
                size="small" 
                sx={{ color: '#1976d2', p: 0.5, mr: 0.5 }}
              >
                <PhotoLibraryIcon fontSize="small" />
              </IconButton>
            </PermissionGate>
          </Tooltip>
          <Tooltip title="Project Attachments">
            <PermissionGate 
              permissions={["VIEW_PROJECT_ATTACHMENTS", "UPLOAD_PROJECT_ATTACHMENTS", "DELETE_PROJECT_ATTACHMENTS", "MANAGE_PROJECT_ATTACHMENTS", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]} 
              requireAll={false}
            >
              <IconButton 
                onClick={() => handleAttachmentsClick(params.row)} 
                size="small" 
                sx={{ color: '#1976d2', p: 0.5, mr: 0.5 }}
              >
                <AttachFileIcon fontSize="small" />
              </IconButton>
            </PermissionGate>
          </Tooltip>
          <Tooltip title="Edit Project">
            <PermissionGate 
              permissions={["EDIT_PROJECT", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]} 
              requireAll={false}
            >
              <IconButton 
                onClick={() => handleEditClick(params.row)} 
                size="small"
                sx={{ color: '#1976d2', p: 0.5, mr: 0.5 }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </PermissionGate>
          </Tooltip>
          <Tooltip title="Delete Project">
            <PermissionGate 
              permissions={["DELETE_PROJECT", "MANAGE_PROJECTS", "SYSTEM_ADMIN"]} 
              requireAll={false}
            >
              <IconButton 
                onClick={() => handleDeleteClick(params.row)} 
                size="small" 
                sx={{ color: '#e53935', p: 0.5 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </PermissionGate>
          </Tooltip>
        </Box>
      )
    }
  ], [sortModel, getLanguageInfo, getCategoryName, getSkillName]);

  // Event handlers
  const handleCreateClick = () => {
    setSelectedProject(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  const handleEditClick = (project) => {
    setSelectedProject(project);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleDeleteClick = (project) => {
    setSelectedProject(project);
    setFormMode('delete');
    setIsFormOpen(true);
  };

  const handleFormClose = (refreshData) => {
    setIsFormOpen(false);
    if (refreshData) {
      const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
      fetchProjects({
        page: pagination.page || 1,
        pageSize: pagination.pageSize || 10,
        include_full_details: true,
        ...currentFilters
      });
    }
  };

  if (error) {
    return (
      <Box mt={3} p={3} bgcolor="#ffebee" borderRadius={1}>
        <Typography color="error" variant="h6">Error loading projects</Typography>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%', p: 2 }}>
      <ReusableDataGrid
        title="Projects Management"
        columns={columns}
        rows={projects}
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
        {...(canCreateProject() ? {
          createButtonText: "Project",
          onCreateClick: handleCreateClick
        } : {})}
        PaginationComponent={({ pagination: paginationData, onPaginationChange }) => {
          const adjustedPaginationData = {
            // Convert 1-indexed page from context to 0-indexed for ReusablePagination
            page: Math.max(0, (paginationData.page || pagination.page || 1) - 1),
            pageSize: paginationData.pageSize || pagination.pageSize || 10,
            total: paginationData.total || pagination.total || 0
          };
          
          return (
            <ReusablePagination
              pagination={adjustedPaginationData}
              onPaginationChange={(newPaginationModel) => {
                // Convert 0-indexed page from ReusablePagination to 1-indexed for backend
                const backendPaginationModel = {
                  ...newPaginationModel,
                  page: newPaginationModel.page + 1
                };
                
                // Call fetchProjects directly with the new pagination
                const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
                fetchProjects({
                  page: backendPaginationModel.page,
                  pageSize: backendPaginationModel.pageSize,
                  include_full_details: true,
                  ...currentFilters
                });
              }}
            />
          );
        }}
        defaultPageSize={pagination.pageSize}
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
        <ProjectForm
          open={isFormOpen}
          onClose={handleFormClose}
          project={selectedProject}
          mode={formMode}
        />
      )}
    </Box>
  );
}

// Main component with provider, error boundary, and security
function ProjectIndex() {
  return (
    <ModuleGate moduleName="projects" showError={true}>
      <ErrorBoundary>
        <ProjectProvider>
          <ProjectIndexContent />
        </ProjectProvider>
      </ErrorBoundary>
    </ModuleGate>
  );
}

export default ProjectIndex;
