import React, { useState, useCallback } from 'react';
import { Box, IconButton, Tooltip, Chip, Stack } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import TranslationForm from './TranslationForm';
import ReusableDataGrid from '../common/ReusableDataGrid';
import TranslationFilters from './TranslationFilters';
import SERVER_URL from '../common/BackendServerData';

function TranslationIndex() {
  const [filters, setFilters] = useState({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [selectedTranslation, setSelectedTranslation] = useState(null);
  const [gridKey, setGridKey] = useState(0);

  const columns = [
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
          <Tooltip title="Edit Translation">
            <IconButton onClick={() => handleEditClick(params.row)} size="small">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Translation">
            <IconButton onClick={() => handleDeleteClick(params.row)} size="small" color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

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
    console.log('TranslationIndex - Filters changed:', newFilters);
    setFilters(newFilters);
  }, []);

  const handleSearch = useCallback((searchFilters) => {
    console.log('TranslationIndex - Search triggered with filters:', searchFilters);
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
