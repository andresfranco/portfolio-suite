import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tooltip,
  Typography,
  Chip,
  Stack,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, ArrowUpward, ArrowDownward, InfoOutlined } from '@mui/icons-material';
import ReusableDataGrid from '../common/ReusableDataGrid';
import ExperienceForm from './ExperienceForm';
import ReusableFilters from '../common/ReusableFilters';
import ReusablePagination from '../common/ReusablePagination';
import { useExperience } from '../../contexts/ExperienceContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { evaluateGridColumnAccess, evaluateFilterAccess } from '../../utils/accessControl';
import PermissionGate from '../common/PermissionGate';
import ModuleGate from '../common/ModuleGate';
import ExperienceErrorBoundary from './ExperienceErrorBoundary';
import { CONTAINER_PY, SECTION_PX, GRID_WRAPPER_PB } from '../common/layoutTokens';

const ExperienceIndexContent = () => {
  const {
    experiences,
    loading,
    error,
    pagination,
    fetchExperiences,
    filters,
    updateFilters,
    clearFilters,
  } = useExperience();

  const { languages: availableLanguages, loading: loadingLanguages, fetchLanguages } = useLanguage();
  const { hasAnyPermission, isSystemAdmin, hasPermission, hasAnyPermission: hasAny } = useAuthorization();

  const [sortModel, setSortModel] = useState([{ field: 'code', sort: 'asc' }]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selectedExperience, setSelectedExperience] = useState(null);

  // Define filter types with dynamic language options - memoized to prevent recreation
  const FILTER_TYPES = useMemo(() => ({
    code: {
      label: 'Code',
      type: 'text',
      placeholder: 'Filter by experience code',
    },
    name: {
      label: 'Name',
      type: 'text',
      placeholder: 'Filter by experience name',
    },
    language_id: {
      label: 'Languages',
      type: 'multiselect',
      options: availableLanguages
        ? availableLanguages.map((lang) => ({
            value: lang.id.toString(),
            label: `${lang.name} (${lang.code})`,
          }))
        : [],
    },
  }), [availableLanguages]);

  // Debug logging for language data
  console.log('ExperienceIndex - Language debug info:', {
    availableLanguages: availableLanguages?.length || 0,
    loadingLanguages,
    languageOptions: FILTER_TYPES.language_id.options,
    sampleLanguages: availableLanguages?.slice(0, 3),
  });

  // Build access notices for filters
  const { noticesByType } = useMemo(() => {
    const authorization = { isSystemAdmin, hasPermission, hasAnyPermission: hasAny };
    return evaluateFilterAccess(
      Object.keys(FILTER_TYPES),
      {
        code: { required: 'VIEW_EXPERIENCES', moduleKey: 'experiences' },
        name: { required: 'VIEW_EXPERIENCES', moduleKey: 'experiences' },
        language_id: { required: 'VIEW_LANGUAGES', moduleKey: 'languages' },
      },
      authorization
    );
  }, [isSystemAdmin, hasPermission, hasAny, FILTER_TYPES]);

  const FiltersWrapper = useCallback(({ filters: currentFilters, onFiltersChange, onSearch }) => {
    // Create filter types with current language loading state
    const filterTypesWithLoadingState = {
      ...FILTER_TYPES,
      language_id: {
        ...FILTER_TYPES.language_id,
        options: loadingLanguages ? [] : FILTER_TYPES.language_id.options,
        disabled: loadingLanguages,
      },
    };

    console.log('ExperienceIndex - FiltersWrapper render:', {
      currentFilters,
      filterTypesLanguages: filterTypesWithLoadingState.language_id,
      optionsCount: filterTypesWithLoadingState.language_id.options?.length || 0,
    });

    return (
      <ReusableFilters
        filterTypes={filterTypesWithLoadingState}
        filters={currentFilters}
        onFiltersChange={onFiltersChange}
        onSearch={onSearch}
        accessNotices={noticesByType}
      />
    );
  }, [FILTER_TYPES, loadingLanguages, noticesByType]);

  // Fetch languages when component mounts
  useEffect(() => {
    if (!availableLanguages || availableLanguages.length === 0) {
      fetchLanguages(1, 100, {}).catch((error) => {
        console.error('Error fetching languages for experience filters:', error);
      });
    }
  }, [fetchLanguages, availableLanguages]);

  useEffect(() => {
    const initialFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchExperiences(pagination.page, pagination.pageSize, initialFilters, sortModel);
  }, [fetchExperiences]);

  const handlePaginationChange = (model) => {
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    // Convert 0-indexed page from DataGrid to 1-indexed page for backend
    fetchExperiences(model.page + 1, model.pageSize, currentFilters, sortModel);
  };

  const handleSortModelChange = (newModel) => {
    const updated = newModel.length > 0 ? [newModel[0]] : [{ field: 'code', sort: 'asc' }];
    setSortModel(updated);
    const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
    fetchExperiences(pagination.page, pagination.pageSize, currentFilters, updated);
  };

  const handleFiltersChange = (newFilters) => {
    // Process language_id filter if present
    let processedFilters = { ...newFilters };

    if (newFilters.language_id && Array.isArray(newFilters.language_id) && newFilters.language_id.length === 0) {
      // Remove empty language_id array
      delete processedFilters.language_id;
    }

    updateFilters(processedFilters);
  };

  const handleSearch = (searchFilters) => {
    // Handle language_id filter formatting
    let processedFilters = { ...searchFilters };

    if (searchFilters.language_id && Array.isArray(searchFilters.language_id) && searchFilters.language_id.length > 0) {
      processedFilters.language_id = searchFilters.language_id;
    } else if (searchFilters.language_id) {
      delete processedFilters.language_id;
    }

    updateFilters(processedFilters);
    fetchExperiences(1, pagination.pageSize, processedFilters, sortModel);
  };

  const handleOpenCreateForm = () => {
    setFormMode('create');
    setSelectedExperience(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (experience) => {
    setFormMode('edit');
    setSelectedExperience(experience);
    setIsFormOpen(true);
  };

  const handleOpenDeleteForm = (experience) => {
    setFormMode('delete');
    setSelectedExperience(experience);
    setIsFormOpen(true);
  };

  const handleFormClose = (shouldRefresh = false) => {
    setIsFormOpen(false);
    if (shouldRefresh) {
      const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
      fetchExperiences(pagination.page, pagination.pageSize, currentFilters, sortModel);
    }
  };

  const baseColumns = [
    {
      field: 'code',
      headerName: 'Code',
      flex: 0.5,
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
      field: 'years',
      headerName: 'Years',
      flex: 0.3,
      minWidth: 100,
      disableColumnMenu: true,
      sortable: true,
      renderHeader: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '13px', color: '#505050', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', letterSpacing: '0.3px' }}>
          {params.colDef.headerName}
          {sortModel[0]?.field === 'years' && (
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
      field: 'experience_names',
      headerName: 'Names',
      flex: 1,
      sortable: false,
      disableColumnMenu: true,
      valueGetter: (params) => {
        if (!params?.row?.experience_texts) return '-';
        const texts = Array.isArray(params.row.experience_texts) ? params.row.experience_texts : [];
        if (texts.length === 0) return '-';

        return texts
          .map((text) => {
            if (!text || !text.name) return '';

            let languageDisplay = '';
            if (text.language) {
              if (typeof text.language === 'object' && text.language !== null) {
                const lang = text.language;
                languageDisplay = `${lang.code || ''}`;
              }
            }

            if (!languageDisplay && text.language_id) {
              languageDisplay = `ID:${text.language_id}`;
            }

            return `${text.name} (${languageDisplay})`;
          })
          .filter(Boolean)
          .join(', ');
      },
      renderCell: (params) => {
        if (!params?.row?.experience_texts) return <div>-</div>;
        const texts = Array.isArray(params.row.experience_texts) ? params.row.experience_texts : [];
        if (texts.length === 0) return <div>-</div>;

        const namesList = texts
          .map((text) => {
            if (!text || !text.name) return null;

            let languageDisplay = '';

            if (text.language) {
              if (typeof text.language === 'object' && text.language !== null) {
                const lang = text.language;
                languageDisplay = lang.code || `ID:${lang.id}`;
              }
            }

            if (!languageDisplay && text.language_id) {
              languageDisplay = `ID:${text.language_id}`;
            }

            if (!languageDisplay) return null;

            return `${text.name} (${languageDisplay})`;
          })
          .filter(Boolean);

        return (
          <Box sx={{ width: '100%', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: 1.4, py: 0.5 }}>
            <Typography variant="body2" sx={{ fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', color: '#424242', wordBreak: 'break-word', whiteSpace: 'normal' }}>
              {namesList.join(', ')}
            </Typography>
          </Box>
        );
      },
      renderHeader: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '13px', color: '#505050', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', letterSpacing: '0.3px' }}>
          {params.colDef.headerName}
        </Box>
      ),
    },
    {
      field: 'experience_texts',
      headerName: 'Languages',
      flex: 0.8,
      sortable: false,
      disableColumnMenu: true,
      valueGetter: (params) => {
        if (!params?.row?.experience_texts) return '-';
        const texts = Array.isArray(params.row.experience_texts) ? params.row.experience_texts : [];
        if (texts.length === 0) return '-';

        return texts
          .map((text) => {
            if (!text) return '';

            if (text.language) {
              if (typeof text.language === 'object' && text.language !== null) {
                const lang = text.language;
                return `${lang.name || ''} (${lang.code || ''})`;
              }
            }

            if (text.language_id) {
              return `Language ID: ${text.language_id}`;
            }

            return '';
          })
          .filter(Boolean)
          .join(', ');
      },
      renderCell: (params) => {
        if (!params?.row?.experience_texts) return <div>-</div>;
        const texts = Array.isArray(params.row.experience_texts) ? params.row.experience_texts : [];
        if (texts.length === 0) return <div>-</div>;

        return (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: '4px', maxWidth: '100%', overflow: 'hidden' }}>
            {texts
              .map((text, index) => {
                if (!text) return null;

                let languageDisplay = '';
                let languageId = '';

                if (text.language) {
                  if (typeof text.language === 'object' && text.language !== null) {
                    const lang = text.language;
                    languageDisplay = `${lang.name || ''} (${lang.code || ''})`;
                    languageId = lang.id;
                  }
                }

                if (!languageDisplay && text.language_id) {
                  languageDisplay = `Language ID: ${text.language_id}`;
                  languageId = text.language_id;
                }

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
                      '.MuiChip-label': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
                    }}
                  />
                );
              })
              .filter(Boolean)}
          </Stack>
        );
      },
      renderHeader: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '13px', color: '#505050', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', letterSpacing: '0.3px' }}>
          {params.colDef.headerName}
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
          <PermissionGate permissions={['EDIT_EXPERIENCE', 'MANAGE_EXPERIENCES']}>
            <Tooltip title="Edit">
              <IconButton aria-label="edit experience" onClick={() => handleOpenEditForm(params.row)} size="small" sx={{ color: '#1976d2', p: 0.5, mr: 0.5 }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </PermissionGate>
          <PermissionGate permissions={['DELETE_EXPERIENCE', 'MANAGE_EXPERIENCES']}>
            <Tooltip title="Delete">
              <IconButton aria-label="delete experience" onClick={() => handleOpenDeleteForm(params.row)} size="small" sx={{ color: '#e53935', p: 0.5 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </PermissionGate>
        </Box>
      ),
    },
  ];

  // Permission-aware column visibility
  const COLUMN_ACCESS_MAP = useMemo(() => ({
    code: { required: 'VIEW_EXPERIENCES', moduleKey: 'experiences' },
    years: { required: 'VIEW_EXPERIENCES', moduleKey: 'experiences' },
    experience_names: { required: 'VIEW_EXPERIENCES', moduleKey: 'experiences' },
    experience_texts: { required: 'VIEW_LANGUAGES', moduleKey: 'languages' },
    actions: { required: ['EDIT_EXPERIENCE', 'DELETE_EXPERIENCE', 'MANAGE_EXPERIENCES'], moduleKey: 'experiences' },
  }), []);

  const { allowedColumns, deniedColumns } = useMemo(() => {
    const authorization = { isSystemAdmin, hasPermission, hasAnyPermission: hasAny };
    return evaluateGridColumnAccess(COLUMN_ACCESS_MAP, authorization);
  }, [isSystemAdmin, hasPermission, hasAny, COLUMN_ACCESS_MAP]);

  const columns = useMemo(() => {
    const hideActions = deniedColumns.length > 0;
    return baseColumns.filter((c) => allowedColumns.has(c.field) && (!hideActions || c.field !== 'actions'));
  }, [baseColumns, allowedColumns, deniedColumns]);

  const deniedColumnTitles = useMemo(() => {
    const titleFor = (field) => baseColumns.find((c) => c.field === field)?.headerName || field;
    return Array.from(new Set(deniedColumns.map(titleFor)));
  }, [deniedColumns, baseColumns]);

  if (error) {
    return (
      <Box mt={3} p={3} bgcolor="#ffebee" borderRadius={1}>
        <Typography color="error" variant="h6">
          Error loading experiences
        </Typography>
        <Typography color="error">{error}</Typography>
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
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <Box sx={{ px: SECTION_PX, pb: GRID_WRAPPER_PB }}>
        <ReusableDataGrid
          title="Experiences Management"
          columns={columns}
          rows={experiences || []}
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
          topNotice={
            deniedColumnTitles.length > 0 ? (
              <Box sx={{ mt: 0.5, mb: 1, display: 'inline-flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                <InfoOutlined sx={{ fontSize: 16 }} />
                <Typography sx={{ fontSize: '12px', lineHeight: 1.4 }}>
                  {`You do not have permission to view the columns ${deniedColumnTitles.join(', ')}`}
                </Typography>
              </Box>
            ) : null
          }
          PaginationComponent={({ pagination: paginationData }) => {
            const adjustedPaginationData = {
              // Convert 1-indexed page from context to 0-indexed for ReusablePagination
              page: Math.max(0, (paginationData.page || pagination.page || 1) - 1),
              pageSize: paginationData.pageSize || pagination.pageSize || 10,
              total: paginationData.total || pagination.total || 0,
            };

            return (
              <ReusablePagination
                pagination={adjustedPaginationData}
                onPaginationChange={(newPaginationModel) => {
                  // Convert 0-indexed page from ReusablePagination to 1-indexed for backend
                  const backendPaginationModel = {
                    ...newPaginationModel,
                    page: newPaginationModel.page + 1,
                  };

                  const currentFilters = filters && Object.keys(filters).length > 0 ? filters : {};
                  fetchExperiences(
                    backendPaginationModel.page,
                    backendPaginationModel.pageSize,
                    currentFilters,
                    sortModel
                  );
                }}
              />
            );
          }}
          createButtonText="Experience"
          onCreateClick={hasAnyPermission(['CREATE_EXPERIENCE', 'MANAGE_EXPERIENCES']) ? handleOpenCreateForm : undefined}
          defaultPageSize={pagination.pageSize}
          uiVariant="categoryIndex"
          paginationPosition="top"
          gridSx={{
            '.MuiDataGrid-iconButtonContainer': { display: 'none', visibility: 'hidden', width: 0, opacity: 0 },
            '.MuiDataGrid-sortIcon': { display: 'none', visibility: 'hidden', opacity: 0 },
            '.MuiDataGrid-columnHeader': { display: 'flex', visibility: 'visible', opacity: 1 },
            '.MuiDataGrid-columnHeaderTitle': { display: 'block', visibility: 'visible', opacity: 1, fontWeight: 500, color: '#505050' },
            '& .MuiDataGrid-footerContainer': { display: 'none' },
          }}
        />
      </Box>

      {isFormOpen && (
        <Dialog
          open={isFormOpen}
          onClose={() => handleFormClose()}
          maxWidth="md"
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
              ? 'Create Experience'
              : formMode === 'edit'
              ? 'Edit Experience'
              : 'Delete Experience'}
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <ExperienceForm
              mode={formMode}
              open={isFormOpen}
              onClose={handleFormClose}
              experience={selectedExperience}
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

const ExperienceIndex = () => (
  <ModuleGate moduleName="experiences" showError={true}>
  <Container maxWidth={false} disableGutters sx={{ py: CONTAINER_PY }}>
      <ExperienceErrorBoundary>
        <ExperienceIndexContent />
      </ExperienceErrorBoundary>
    </Container>
  </ModuleGate>
);

export default ExperienceIndex;
