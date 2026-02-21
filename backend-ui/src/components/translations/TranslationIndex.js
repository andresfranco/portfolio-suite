import React, { useState, useCallback, useMemo } from 'react';
import { Box, IconButton, Tooltip, Chip, Stack, Typography } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import TranslationForm from './TranslationForm';
import ReusableDataGrid from '../common/ReusableDataGrid';
import TranslationFilters from './TranslationFilters';
import SERVER_URL from '../common/BackendServerData';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { evaluateGridColumnAccess } from '../../utils/accessControl';
import ReusablePagination from '../common/ReusablePagination';
import { InfoOutlined } from '@mui/icons-material';
import PermissionGate from '../common/PermissionGate';

function TranslationIndex() {
  const [filters, setFilters] = useState({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [selectedTranslation, setSelectedTranslation] = useState(null);
  const [gridKey, setGridKey] = useState(0);
  const { hasPermission, hasAnyPermission, isSystemAdmin } = useAuthorization();

  const baseColumns = [
    { field: 'id', headerName: 'ID', width: 70, disableColumnMenu: true },
    { field: 'identifier', headerName: 'Identifier', flex: 1, disableColumnMenu: true },
    { field: 'text', headerName: 'Text', flex: 2, disableColumnMenu: true },
    { 
      field: 'language', 
      headerName: 'Languages', 
      flex: 1,
      disableColumnMenu: true,
      valueGetter: (params) => {
        if (!params?.row?.language) return '-';
        const languages = Array.isArray(params.row.language) ? params.row.language : [];
        if (languages.length === 0) return '-';
        return languages.map(lang => `${lang.name} (${lang.code})`).join(', ');
      },
      renderCell: (params) => {
        if (!params?.row?.language) return <div>-</div>;
        const languages = Array.isArray(params.row.language) ? params.row.language : [];
        if (languages.length === 0) return <div>-</div>;
        
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
            {languages.map((lang) => (
              <Chip 
                key={lang.id}
                label={`${lang.name} (${lang.code})`}
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
            ))}
          </Stack>
        );
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box>
          <PermissionGate permissions={["EDIT_TRANSLATION", "MANAGE_TRANSLATIONS", "SYSTEM_ADMIN"]} requireAll={false}>
            <Tooltip title="Edit Translation">
              <IconButton onClick={() => handleEditClick(params.row)} size="small">
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </PermissionGate>
          <PermissionGate permissions={["DELETE_TRANSLATION", "MANAGE_TRANSLATIONS", "SYSTEM_ADMIN"]} requireAll={false}>
            <Tooltip title="Delete Translation">
              <IconButton onClick={() => handleDeleteClick(params.row)} size="small" color="error">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </PermissionGate>
        </Box>
      )
    }
  ];

  // Permission-based column filtering and friendly denied titles
  const COLUMN_ACCESS_MAP = useMemo(() => ({
    id: { required: 'VIEW_TRANSLATIONS', moduleKey: 'translations' },
    identifier: { required: 'VIEW_TRANSLATIONS', moduleKey: 'translations' },
    text: { required: 'VIEW_TRANSLATIONS', moduleKey: 'translations' },
    language: { required: 'VIEW_LANGUAGES', moduleKey: 'languages' },
    actions: { required: ['EDIT_TRANSLATION', 'DELETE_TRANSLATION', 'MANAGE_TRANSLATIONS'], moduleKey: 'translations' }
  }), []);

  const { allowedColumns, deniedColumns } = useMemo(() => {
    const authorization = { isSystemAdmin, hasPermission, hasAnyPermission };
    return evaluateGridColumnAccess(COLUMN_ACCESS_MAP, authorization);
  }, [isSystemAdmin, hasPermission, hasAnyPermission, COLUMN_ACCESS_MAP]);

  const columns = useMemo(() => {
    const hideActions = deniedColumns.length > 0;
    return baseColumns.filter(col => allowedColumns.has(col.field) && (!hideActions || col.field !== 'actions'));
  }, [baseColumns, allowedColumns, deniedColumns]);

  const deniedColumnTitles = useMemo(() => {
    const titleFor = (field) => baseColumns.find(c => c.field === field)?.headerName || field;
    return Array.from(new Set(deniedColumns.map(titleFor)));
  }, [deniedColumns, baseColumns]);

  const handleCreateClick = () => {
    setSelectedTranslation(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  const handleEditClick = (translation) => {
    setSelectedTranslation(translation);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleDeleteClick = (translation) => {
    setSelectedTranslation(translation);
    setFormMode('delete');
    setIsFormOpen(true);
  };

  const handleFormClose = (refreshData) => {
    setIsFormOpen(false);
    if (refreshData) {
      setGridKey(prevKey => prevKey + 1);
    }
  };

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleSearch = useCallback((searchFilters) => {
    setFilters(searchFilters);
    setGridKey(prevKey => prevKey + 1);
  }, []);

  return (
    <Box sx={{ height: '100%', width: '100%', p: 2 }}>
      <ReusableDataGrid
        key={gridKey}
        title="Translations Management"
        columnVisibilityModel={{ id: false }}
        disableRowSelectionOnClick={true}
        columns={columns}
        apiEndpoint="/api/translations/full"
        initialFilters={filters}
        FiltersComponent={TranslationFilters}
        onFiltersChange={handleFiltersChange}
        onSearch={handleSearch}
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
  PaginationComponent={ReusablePagination}
        createButtonText="Translation"
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      {isFormOpen && (
        <TranslationForm
          open={isFormOpen}
          onClose={handleFormClose}
          translation={selectedTranslation}
          mode={formMode}
        />
      )}
    </Box>
  );
}

export default TranslationIndex;
