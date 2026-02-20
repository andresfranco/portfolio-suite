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
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  AddCircleOutline as AddFilterIcon,
  Close as CloseIcon
} from '@mui/icons-material';

// Filter type definitions
const FILTER_TYPES = {
  name: {
    label: 'Portfolio Name',
    type: 'text'
  },
  description: {
    label: 'Description',
    type: 'text'
  }
};

function PortfolioFilters({ filters, onFiltersChange, onSearch }) {
  const [activeFilters, setActiveFilters] = useState(() => {
    const initialFilters = [];
    let id = 1;
    
    // Create active filters for each non-empty filter in the filters prop
    Object.keys(FILTER_TYPES).forEach(field => {
      if (filters?.[field]) {
        initialFilters.push({ id: id++, type: field });
      }
    });
    
    // If no filters were created, add a default one
    if (initialFilters.length === 0) {
      initialFilters.push({ id: id, type: 'name' });
    }
    
    return initialFilters;
  });
  
  const [nextFilterId, setNextFilterId] = useState(() => activeFilters.length + 1);
  const [tempFilters, setTempFilters] = useState(() => ({ ...filters }));

  // Update tempFilters when filters prop changes
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
    // Create a clean copy of filters with only non-empty values
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
    
    
    // Update parent component with new filters
    if (onFiltersChange) {
      onFiltersChange(cleanFilters);
    }
    
    // Trigger search
    if (onSearch) {
      onSearch(cleanFilters);
    }
  };

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 2, 
        mb: 2,
        borderRadius: '4px',
        border: '1px solid #e0e0e0'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            flexGrow: 1,
            fontSize: '1rem',
            fontWeight: 600,
            color: '#424242'
          }}
        >
          Filters
        </Typography>
        <Tooltip title="Add another filter">
          <Button
            variant="outlined"
            startIcon={<AddFilterIcon />}
            onClick={handleAddFilter}
            disabled={activeFilters.length >= Object.keys(FILTER_TYPES).length}
            size="small"
            sx={{
              borderColor: '#e0e0e0',
              color: '#1976d2',
              '&:hover': {
                borderColor: '#1976d2',
                backgroundColor: 'rgba(25, 118, 210, 0.04)'
              }
            }}
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
                size="small"
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

            <TextField
              fullWidth
              label={FILTER_TYPES[filter.type].label}
              value={tempFilters[filter.type] || ''}
              onChange={(e) => handleFilterChange(filter.id, e.target.value)}
              size="small"
              sx={{ 
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': {
                    borderColor: '#1976d2'
                  }
                }
              }}
            />

            <IconButton 
              onClick={() => handleRemoveFilter(filter.id)}
              disabled={activeFilters.length <= 1}
              color="error"
              size="small"
              sx={{
                color: activeFilters.length <= 1 ? '#bdbdbd' : '#e53935',
                '&:hover': {
                  backgroundColor: activeFilters.length <= 1 ? 'transparent' : 'rgba(229, 57, 53, 0.04)'
                }
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            sx={{
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(25,118,210,0.2)',
              '&:hover': {
                boxShadow: '0 4px 8px rgba(25,118,210,0.3)'
              }
            }}
          >
            Search
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

export default PortfolioFilters;
