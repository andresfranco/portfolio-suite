import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Tooltip,
  OutlinedInput,
  Chip
} from '@mui/material';
import {
  Search as SearchIcon,
  AddCircleOutline as AddFilterIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import SERVER_URL from '../common/BackendServerData';

const FILTER_TYPES = {
  identifier: {
    label: 'Identifier',
    type: 'text'
  },
  text: {
    label: 'Text',
    type: 'text'
  },
  language_id: {
    label: 'Languages',
    type: 'multiselect'
  }
};

function TranslationFilters({ filters, onFiltersChange, onSearch }) {
  const [activeFilters, setActiveFilters] = useState(() => {
    const initialFilters = [];
    let id = 1;
    
    Object.keys(FILTER_TYPES).forEach(field => {
      if (filters?.[field]) {
        initialFilters.push({ id: id++, type: field });
      }
    });
    
    if (initialFilters.length === 0) {
      initialFilters.push({ id: id, type: 'identifier' });
    }
    
    return initialFilters;
  });

  const [nextFilterId, setNextFilterId] = useState(() => activeFilters.length + 1);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [tempFilters, setTempFilters] = useState(() => ({ ...filters }));

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/api/languages/full`);
        if (response.ok) {
          const data = await response.json();
          setAvailableLanguages(data.items || []);
        }
      } catch (error) {
        console.error('Error fetching languages:', error);
      }
    };

    fetchLanguages();
  }, []);

  useEffect(() => {
    setTempFilters({ ...filters });
  }, [filters]);

  const handleAddFilter = () => {
    const unusedFilterTypes = Object.keys(FILTER_TYPES).filter(type => 
      !activeFilters.some(f => f.type === type)
    );

    if (unusedFilterTypes.length > 0) {
      setActiveFilters([...activeFilters, { id: nextFilterId, type: unusedFilterTypes[0] }]);
      setNextFilterId(nextFilterId + 1);
    }
  };

  const handleRemoveFilter = (filterId) => {
    const removedFilter = activeFilters.find(f => f.id === filterId);
    if (removedFilter) {
      const updatedFilterValues = { ...tempFilters };
      delete updatedFilterValues[removedFilter.type];
      setTempFilters(updatedFilterValues);
    }
    setActiveFilters(activeFilters.filter(f => f.id !== filterId));
  };

  const handleFilterChange = (filterId, value) => {
    const filter = activeFilters.find(f => f.id === filterId);
    if (filter) {
      const updatedTempFilters = {
        ...tempFilters,
        [filter.type]: value
      };
      setTempFilters(updatedTempFilters);
    }
  };

  const handleFilterTypeChange = (filterId, newType) => {
    const oldFilter = activeFilters.find(f => f.id === filterId);
    if (oldFilter) {
      const updatedFilterValues = { ...tempFilters };
      delete updatedFilterValues[oldFilter.type];
      setTempFilters(updatedFilterValues);
    }
    
    setActiveFilters(activeFilters.map(f => 
      f.id === filterId ? { ...f, type: newType } : f
    ));
  };

  const handleSearch = () => {
    const cleanFilters = {};
    Object.entries(tempFilters).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          if (value.length > 0) cleanFilters[key] = value;
        } else if (value.toString().trim() !== '') {
          cleanFilters[key] = value.toString().trim();
        }
      }
    });
    
    console.log('Searching with filters:', cleanFilters);
    if (onFiltersChange) {
      onFiltersChange(cleanFilters);
    }
    
    if (onSearch) {
      onSearch(cleanFilters);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Filters
        </Typography>
        <Tooltip title="Add another filter">
          <Button
            variant="outlined"
            startIcon={<AddFilterIcon />}
            onClick={handleAddFilter}
            disabled={activeFilters.length >= Object.keys(FILTER_TYPES).length}
            sx={{ ml: 1 }}
          >
            Add Filter
          </Button>
        </Tooltip>
      </Box>

      <Stack spacing={2}>
        {activeFilters.map((filter) => (
          <Box key={filter.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl sx={{ width: 150 }}>
              <InputLabel>Filter Type</InputLabel>
              <Select
                value={filter.type}
                onChange={(e) => handleFilterTypeChange(filter.id, e.target.value)}
                label="Filter Type"
              >
                {Object.entries(FILTER_TYPES).map(([key, value]) => (
                  <MenuItem
                    key={key}
                    value={key}
                    disabled={activeFilters.some(f => f.id !== filter.id && f.type === key)}
                  >
                    {value.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {FILTER_TYPES[filter.type].type === 'multiselect' ? (
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Select Languages</InputLabel>
                <Select
                  multiple
                  value={tempFilters[filter.type] || []}
                  onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                  input={<OutlinedInput label="Select Languages" />}
                  renderValue={(selected) => (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {selected.map((value) => {
                        const language = availableLanguages.find(lang => lang.id === value);
                        return (
                          <Chip
                            key={value}
                            label={language ? `${language.name} (${language.code})` : value}
                            size="small"
                            sx={{ m: 0.5 }}
                          />
                        );
                      })}
                    </Stack>
                  )}
                >
                  {availableLanguages.map((language) => (
                    <MenuItem key={language.id} value={language.id}>
                      {`${language.name} (${language.code})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <TextField
                sx={{ flex: 1 }}
                label={FILTER_TYPES[filter.type].label}
                value={tempFilters[filter.type] || ''}
                onChange={(e) => handleFilterChange(filter.id, e.target.value)}
              />
            )}

            <Tooltip title="Remove Filter">
              <IconButton 
                onClick={() => handleRemoveFilter(filter.id)}
                disabled={activeFilters.length <= 1}
                color="error"
                sx={{ flexShrink: 0 }}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Tooltip title="Search with current filters">
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            sx={{ minWidth: '100px' }}
          >
            Search
          </Button>
        </Tooltip>
      </Box>
    </Paper>
  );
}

export default TranslationFilters;
