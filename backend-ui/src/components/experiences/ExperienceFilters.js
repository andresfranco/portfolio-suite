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
  FilterList as FilterIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  ClearAll as ClearAllIcon
} from '@mui/icons-material';
import SERVER_URL from '../common/BackendServerData';

// Filter type definitions
const FILTER_TYPES = {
  code: {
    label: 'Code',
    type: 'text'
  },
  name: {
    label: 'Name',
    type: 'text'
  },
  description: {
    label: 'Description',
    type: 'text'
  },
  language_id: {
    label: 'Languages',
    type: 'multiselect'
  }
};

function ExperienceFilters({ onFiltersChange, onSearch }) {
  const [activeFilters, setActiveFilters] = useState(() => {
    const initialFilters = [];
    let id = 1;
    
    // Create a default filter
    initialFilters.push({ id: id, type: 'code' });
    
    return initialFilters;
  });
  
  const [nextFilterId, setNextFilterId] = useState(() => {
    return activeFilters.length + 1;
  });
  
  const [tempFilters, setTempFilters] = useState({});
  const [availableLanguages, setAvailableLanguages] = useState([]);

  // Fetch available languages
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
    const updatedActiveFilters = activeFilters.filter(f => f.id !== filterId);
    setActiveFilters(updatedActiveFilters);
    
    const removedFilter = activeFilters.find(f => f.id === filterId);
    if (removedFilter) {
      const updatedFilterValues = { ...tempFilters };
      delete updatedFilterValues[removedFilter.type];
      setTempFilters(updatedFilterValues);
    }
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
    // Find the old filter type
    const oldFilter = activeFilters.find(f => f.id === filterId);
    const oldType = oldFilter ? oldFilter.type : null;
    
    // Update the filter type
    setActiveFilters(activeFilters.map(f => 
      f.id === filterId ? { ...f, type: newType } : f
    ));
    
    // Clear the old filter value
    if (oldType) {
      const updatedFilterValues = { ...tempFilters };
      delete updatedFilterValues[oldType];
      setTempFilters(updatedFilterValues);
    }
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
    
    console.log('Searching with filters:', cleanFilters);
    
    // Update parent component with new filters
    if (onFiltersChange) {
      onFiltersChange(cleanFilters);
    }
    
    // Trigger search
    if (onSearch) {
      onSearch(cleanFilters);
    }
  };

  const handleClearFilters = () => {
    // Reset to one default filter
    setActiveFilters([{ id: 1, type: 'code' }]);
    setNextFilterId(2);
    setTempFilters({});
    
    // Update parent component
    if (onFiltersChange) {
      onFiltersChange({});
    }
    
    // Trigger search with empty filters
    if (onSearch) {
      onSearch({});
    }
  };

  const renderFilterInput = (filter) => {
    const filterType = FILTER_TYPES[filter.type];
    
    if (filterType.type === 'multiselect') {
      return (
        <FormControl sx={{ 
          flex: 1,
          '& .MuiInputLabel-root': {
            fontSize: '13px',
            color: '#505050',
            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            transform: 'translate(14px, 11px) scale(1)',
            '&.MuiInputLabel-shrink': {
              transform: 'translate(14px, -6px) scale(0.75)'
            }
          },
          '& .MuiOutlinedInput-root': {
            borderRadius: '4px',
            minHeight: '40px',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#1976d2'
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#1976d2',
              borderWidth: 1
            }
          },
          '& .MuiSelect-select': {
            fontSize: '13px',
            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            color: '#505050'
          }
        }}>
          <InputLabel>Select Languages</InputLabel>
          <Select
            multiple
            value={tempFilters[filter.type] || []}
            onChange={(e) => handleFilterChange(filter.id, e.target.value)}
            input={<OutlinedInput label="Select Languages" />}
            renderValue={(selected) => (
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {selected.map((value) => {
                  const language = availableLanguages.find(lang => lang.id === parseInt(value));
                  return (
                    <Chip
                      key={value}
                      label={language ? `${language.name} (${language.code})` : value}
                      size="small"
                      sx={{ 
                        m: 0.25,
                        fontSize: '12px',
                        height: '20px'
                      }}
                    />
                  );
                })}
              </Stack>
            )}
            MenuProps={{
              PaperProps: {
                style: {
                  maxHeight: 300,
                },
              },
            }}
          >
            {availableLanguages.map((language) => (
              <MenuItem 
                key={language.id} 
                value={language.id.toString()}
                sx={{ 
                  fontSize: '13px',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif'
                }}
              >
                {`${language.name} (${language.code})`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    } else {
      return (
        <TextField
          sx={{ 
            flex: 1,
            '& .MuiInputLabel-root': {
              fontSize: '13px',
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              color: '#505050',
              transform: 'translate(14px, 11px) scale(1)',
              '&.MuiInputLabel-shrink': {
                transform: 'translate(14px, -6px) scale(0.75)'
              }
            },
            '& .MuiOutlinedInput-root': {
              borderRadius: '4px',
              height: '40px',
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#1976d2',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#1976d2',
                borderWidth: 1,
              },
            },
            '& .MuiOutlinedInput-input': {
              fontSize: '13px',
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              color: '#505050'
            }
          }}
          label={filterType.label}
          value={tempFilters[filter.type] || ''}
          onChange={(e) => handleFilterChange(filter.id, e.target.value)}
        />
      );
    }
  };

  return (
    <Box 
      sx={{ 
        p: { xs: 2, sm: 2.5 },
        backgroundColor: 'white',
        border: '1px solid #f0f0f0',
        borderRadius: '5px',
        mb: 2.5,
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}
    >
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <FilterIcon 
            sx={{ 
              mr: 1.5, 
              color: '#1976d2',
              opacity: 0.8,
              fontSize: '1rem'
            }} 
          />
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontWeight: 500,
              color: '#505050',
              fontSize: '14px',
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            }}
          >
            Filters
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Add Filter">
            <span>
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddFilter}
                disabled={Object.keys(FILTER_TYPES).length <= activeFilters.length}
                sx={{
                  borderRadius: '4px',
                  textTransform: 'none',
                  fontWeight: 400,
                  boxShadow: 'none',
                  border: '1px solid #757575',
                  color: '#757575',
                  p: 0.25,
                  minWidth: '24px',
                  width: '24px',
                  height: '24px',
                  fontSize: '13px',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  '&:hover': {
                    backgroundColor: 'rgba(117, 117, 117, 0.04)',
                    borderColor: '#757575'
                  },
                }}
              >
                <AddIcon sx={{ fontSize: '0.875rem' }} />
              </Button>
            </span>
          </Tooltip>
          
          <Tooltip title="Clear Filters">
            <Button
              variant="outlined"
              size="small"
              onClick={handleClearFilters}
              sx={{
                borderRadius: '4px',
                textTransform: 'none',
                fontWeight: 400,
                boxShadow: 'none',
                border: '1px solid #757575',
                color: '#757575',
                p: 0.25,
                minWidth: '24px',
                width: '24px',
                height: '24px',
                fontSize: '13px',
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                '&:hover': {
                  backgroundColor: 'rgba(117, 117, 117, 0.04)',
                  borderColor: '#757575'
                }
              }}
            >
              <ClearAllIcon sx={{ fontSize: '0.875rem' }} />
            </Button>
          </Tooltip>
        </Box>
      </Box>
      
      <Stack spacing={2.5}>
        {activeFilters.map((filter) => (
          <Box key={filter.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <FormControl sx={{ 
              minWidth: 180,
              '& .MuiInputLabel-root': {
                fontSize: '13px',
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                color: '#505050',
                transform: 'translate(14px, 11px) scale(1)',
                '&.MuiInputLabel-shrink': {
                  transform: 'translate(14px, -6px) scale(0.75)'
                }
              },
              '& .MuiOutlinedInput-root': {
                borderRadius: '4px',
                height: '40px',
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2',
                  borderWidth: 1
                }
              },
              '& .MuiSelect-select': {
                fontSize: '13px',
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                color: '#505050'
              }
            }}>
              <InputLabel id={`filter-type-label-${filter.id}`}>Filter Type</InputLabel>
              <Select
                labelId={`filter-type-label-${filter.id}`}
                id={`filter-type-${filter.id}`}
                value={filter.type}
                label="Filter Type"
                size="small"
                onChange={(e) => handleFilterTypeChange(filter.id, e.target.value)}
              >
                {Object.entries(FILTER_TYPES).map(([key, value]) => (
                  <MenuItem
                    key={key}
                    value={key}
                    disabled={activeFilters.some(f => f.id !== filter.id && f.type === key)}
                    sx={{ 
                      fontSize: '13px',
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif'
                    }}
                  >
                    {value.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {renderFilterInput(filter)}
            
            <Tooltip title="Remove Filter">
              <IconButton 
                onClick={() => handleRemoveFilter(filter.id)}
                disabled={activeFilters.length <= 1}
                size="small"
                sx={{ 
                  color: '#757575',
                  marginTop: '8px',
                  padding: '4px',
                  '&:hover': {
                    backgroundColor: 'rgba(117, 117, 117, 0.04)'
                  }
                }}
              >
                <CloseIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Stack>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={handleSearch}
          startIcon={<SearchIcon fontSize="small" />}
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
          Search
        </Button>
      </Box>
    </Box>
  );
}

export default ExperienceFilters;
