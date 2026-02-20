import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  OutlinedInput,
  FormHelperText
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ClearAll as ClearAllIcon,
  Add as AddIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { FILTERS_PANEL_MB } from './layoutTokens';

/**
 * Generic filter component following the CategoryTypeFilters design.
 *
 * @param {Object} props
 * @param {Object} props.filterTypes - Map of filter type definitions
 * @param {Object} props.filters - Current filter values
 * @param {Function} props.onFiltersChange - Called when filters are updated
 * @param {Function} props.onSearch - Called when search is submitted
 * @param {Function} props.onClearFilters - Called when filters are cleared
 * @param {Object}   props.accessNotices - Optional map of filterType -> { isDenied: boolean, message: string }
 * @param {boolean}  props.searchDisabled - Optional flag to force disable Search button
 */
function ReusableFilters({
  filterTypes = {},
  filters = {},
  onFiltersChange,
  onSearch,
  onClearFilters,
  accessNotices,
  searchDisabled
}) {
  const defaultValues = {};
  Object.keys(filterTypes).forEach((key) => {
    // Handle different field types for default values
    if (filterTypes[key].type === 'multiselect') {
      defaultValues[key] = filters[key] && Array.isArray(filters[key]) ? filters[key] : [];
    } else {
      defaultValues[key] = filters[key] || '';
    }
  });

  const { control, handleSubmit, reset, setValue, getValues } = useForm({
    defaultValues,
    mode: 'onChange'
  });


  const [activeFilters, setActiveFilters] = useState(() => {
    const arr = [];
    let id = 1;
    Object.keys(filters || {}).forEach((k) => {
      if (filterTypes[k] && filters[k]) {
        arr.push({ id: id++, type: k });
      }
    });
    if (arr.length === 0 && Object.keys(filterTypes).length > 0) {
      arr.push({ id: 1, type: Object.keys(filterTypes)[0] });
    }
    return arr;
  });

  const [nextFilterId, setNextFilterId] = useState(activeFilters.length + 1);

  // Synchronize activeFilters state with filters prop
  useEffect(() => {
    
    const newActiveFilters = [];
    let id = 1;
    
    // Add active filters based on current filters prop
    Object.keys(filters || {}).forEach((key) => {
      if (filterTypes[key] && filters[key]) {
        // Check if the filter has a meaningful value
        const filterValue = filters[key];
        const isValidFilter = filterTypes[key].type === 'multiselect' 
          ? Array.isArray(filterValue) && filterValue.length > 0
          : filterValue && filterValue.toString().trim() !== '';
          
        if (isValidFilter) {
          newActiveFilters.push({ id: id++, type: key });
        }
      }
    });
    
    // Ensure at least one filter is always present if filterTypes exist
    if (newActiveFilters.length === 0 && Object.keys(filterTypes).length > 0) {
      newActiveFilters.push({ id: 1, type: Object.keys(filterTypes)[0] });
    }
    
    setActiveFilters(newActiveFilters);
    setNextFilterId(newActiveFilters.length + 1);
  }, [filters, filterTypes]);

  useEffect(() => {
    
    Object.keys(filterTypes).forEach((key) => {
      // Handle different field types when setting values
      if (filterTypes[key].type === 'multiselect') {
        const newValue = filters[key] && Array.isArray(filters[key]) ? filters[key] : [];
        setValue(key, newValue);
      } else {
        const newValue = filters[key] || '';
        setValue(key, newValue);
      }
    });
    
    // Verify values were set
    setTimeout(() => {
      const currentValues = getValues();
    }, 10);
  }, [filters, filterTypes, setValue, getValues]);

  const handleAddFilter = () => {
    const unused = Object.keys(filterTypes).filter(
      (t) => !activeFilters.some((f) => f.type === t)
    );
    if (unused.length > 0) {
      setActiveFilters((prev) => [...prev, { id: nextFilterId, type: unused[0] }]);
      setNextFilterId((id) => id + 1);
    }
  };

  const handleRemoveFilter = (id) => {
    // Find the filter being removed to get its type
    const filterToRemove = activeFilters.find((f) => f.id === id);
    
    // Update active filters
    const newActiveFilters = activeFilters.filter((f) => f.id !== id);
    setActiveFilters(newActiveFilters);
    
    // Get current form values
    const currentValues = getValues();
    
    // Build cleaned filters object with only remaining active filters
    const cleaned = {};
    newActiveFilters.forEach(({ type }) => {
      const val = currentValues[type];
      
      if (filterTypes[type].type === 'multiselect') {
        // For multiselect, only include if it's an array with items
        if (Array.isArray(val) && val.length > 0) {
          cleaned[type] = val;
        }
      } else {
        // For text fields, include if not empty
        if (val && val.toString().trim() !== '') {
          cleaned[type] = val.toString().trim();
        }
      }
    });
    
    // Clear the removed filter's value in the form
    if (filterToRemove) {
      if (filterTypes[filterToRemove.type].type === 'multiselect') {
        setValue(filterToRemove.type, []);
      } else {
        setValue(filterToRemove.type, '');
      }
    }
    
    
    // Trigger search with remaining filters
    if (onFiltersChange) onFiltersChange(cleaned);
    if (onSearch) onSearch(cleaned);
  };

  const handleFilterTypeChange = (filterId, newType) => {
    setActiveFilters((prev) => prev.map((f) => (f.id === filterId ? { ...f, type: newType } : f)));
  };

  const onSubmit = (data) => {
    
    const cleaned = {};
    activeFilters.forEach(({ type }) => {
      const val = data[type];
      
      if (filterTypes[type].type === 'multiselect') {
        // For multiselect, only include if it's an array with items
        if (Array.isArray(val) && val.length > 0) {
          cleaned[type] = val;
        }
      } else {
        // For text fields, include if not empty
        if (val && val.toString().trim() !== '') {
          cleaned[type] = val.toString().trim();
        }
      }
    });
    
    
    if (onFiltersChange) onFiltersChange(cleaned);
    if (onSearch) onSearch(cleaned);
  };

  const handleClear = () => {
    // Reset form with proper default values for each field type
    const resetValues = {};
    Object.keys(filterTypes).forEach((key) => {
      if (filterTypes[key].type === 'multiselect') {
        resetValues[key] = [];
      } else {
        resetValues[key] = '';
      }
    });
    
    reset(resetValues);
    setActiveFilters([{ id: 1, type: Object.keys(filterTypes)[0] }]);
    setNextFilterId(2);
    
    
    if (onFiltersChange) onFiltersChange({});
    if (onClearFilters) onClearFilters();
    if (onSearch) onSearch({});
  };

  const renderFilterInput = (filter) => {
    const config = filterTypes[filter.type];
    if (!config) return null;
    const notice = accessNotices?.[filter.type];
    const isDenied = !!notice?.isDenied;
    const helper = isDenied ? notice?.message : undefined;
    
    if (config.type === 'text') {
      return (
        <Controller
          key={`${filter.type}-${filter.id}`}
          name={filter.type}
          control={control}
          render={({ field, fieldState }) => {
            
            return (
              <TextField
                {...field}
                label={config.label}
                variant="outlined"
                size="small"
                placeholder={config.placeholder}
                fullWidth
                disabled={config.disabled || isDenied}
                error={isDenied}
                helperText={helper}
                sx={{
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
                  '& .MuiOutlinedInput-input': {
                    fontSize: '13px',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    color: '#505050'
                  }
                }}
              />
            );
          }}
        />
      );
    } else if (config.type === 'multiselect' && config.options) {
      return (
        <Controller
          key={`${filter.type}-${filter.id}`}
          name={filter.type}
          control={control}
          render={({ field, fieldState }) => {
            
            return (
              <FormControl fullWidth error={isDenied} sx={{
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
                  alignItems: 'flex-start',
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
                  color: '#505050',
                  minHeight: 'auto',
                  padding: '8.5px 14px'
                }
              }}>
                <InputLabel>{config.label}</InputLabel>
                <Select
                  multiple
                  disabled={config.disabled || isDenied || config.options.length === 0}
                  value={Array.isArray(field.value) ? field.value : []}
                  onChange={(e) => {
                    
                    // Ensure we're setting an array value
                    const newValue = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                    
                    field.onChange(newValue);
                    
                    // Trigger immediate validation to see if value is being set
                    setTimeout(() => {
                    }, 10);
                  }}
                  input={<OutlinedInput label={config.label} />}
                  displayEmpty={config.options.length === 0}
                  renderValue={(selected) => {
                    
                    if (config.options.length === 0) {
                      return <em style={{ color: '#999', fontSize: '13px' }}>Loading options...</em>;
                    }
                    
                    if (!Array.isArray(selected) || selected.length === 0) {
                      return <em style={{ color: '#999', fontSize: '13px' }}>Select {config.label.toLowerCase()}...</em>;
                    }
                    
                    return (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{
                        maxHeight: '20px',
                        overflow: 'hidden',
                        alignItems: 'center'
                      }}>
                        {selected.slice(0, 2).map((value) => {
                          const option = config.options.find(opt => opt.value === value);
                          return (
                            <Chip
                              key={value}
                              label={option ? option.label : value}
                              size="small"
                              sx={{ 
                                m: 0.25,
                                fontSize: '12px',
                                height: '20px',
                                maxWidth: '120px',
                                '& .MuiChip-label': {
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }
                              }}
                            />
                          );
                        })}
                        {selected.length > 2 && (
                          <Chip
                            label={`+${selected.length - 2} more`}
                            size="small"
                            variant="outlined"
                            sx={{
                              m: 0.25,
                              fontSize: '11px',
                              height: '20px',
                              color: '#666'
                            }}
                          />
                        )}
                      </Stack>
                    );
                  }}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 300,
                      },
                    },
                  }}
                >
                  {config.options.length === 0 ? (
                    <MenuItem disabled sx={{ fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' }}>
                      <em>Loading options...</em>
                    </MenuItem>
                  ) : (
                    config.options.map((option) => {
                      return (
                        <MenuItem 
                          key={option.value} 
                          value={option.value}
                          sx={{ fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' }}
                        >
                          {option.label}
                        </MenuItem>
                      );
                    })
                  )}
                </Select>
                {isDenied && helper && (
                  <FormHelperText sx={{ m: 0, mt: 0.5, fontSize: '12px' }}>{helper}</FormHelperText>
                )}
              </FormControl>
            );
          }}
        />
      );
    }
    
    return null;
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 2.5 }, backgroundColor: 'white', border: '1px solid #f0f0f0', borderRadius: 0, mb: FILTERS_PANEL_MB, boxShadow: 'none' }}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FilterIcon sx={{ mr: 1.5, color: '#1976d2', opacity: 0.8, fontSize: '1rem' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 500, color: '#505050', fontSize: '14px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' }}>
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
                  disabled={Object.keys(filterTypes).length <= activeFilters.length}
                  sx={{ borderRadius: '4px', textTransform: 'none', fontWeight: 400, boxShadow: 'none', border: '1px solid #757575', color: '#757575', p: 0.25, minWidth: '24px', width: '24px', height: '24px', fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', '&:hover': { backgroundColor: 'rgba(117, 117, 117, 0.04)', borderColor: '#757575' } }}
                >
                  <AddIcon sx={{ fontSize: '0.875rem' }} />
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Clear Filters">
              <Button
                variant="outlined"
                size="small"
                onClick={handleClear}
                sx={{ borderRadius: '4px', textTransform: 'none', fontWeight: 400, boxShadow: 'none', border: '1px solid #757575', color: '#757575', p: 0.25, minWidth: '24px', width: '24px', height: '24px', fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', '&:hover': { backgroundColor: 'rgba(117, 117, 117, 0.04)', borderColor: '#757575' } }}
              >
                <ClearAllIcon sx={{ fontSize: '0.875rem' }} />
              </Button>
            </Tooltip>
          </Box>
        </Box>
        <Stack spacing={2.5}>
          {activeFilters.map((filter) => (
            <Box key={`filter-${filter.id}`} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <FormControl sx={{ minWidth: 180, '& .MuiInputLabel-root': { fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', color: '#505050', transform: 'translate(14px, 11px) scale(1)', '&.MuiInputLabel-shrink': { transform: 'translate(14px, -6px) scale(0.75)' } }, '& .MuiOutlinedInput-root': { borderRadius: '4px', height: '40px', '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2', borderWidth: 1 } }, '& .MuiSelect-select': { fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', color: '#505050' } }}>
                <InputLabel id={`filter-type-label-${filter.id}`}>Filter Type</InputLabel>
                <Select
                  labelId={`filter-type-label-${filter.id}`}
                  id={`filter-type-${filter.id}`}
                  value={filter.type}
                  label="Filter Type"
                  size="small"
                  onChange={(e) => handleFilterTypeChange(filter.id, e.target.value)}
                >
                  {Object.entries(filterTypes).map(([type, config]) => (
                    <MenuItem key={type} value={type} disabled={activeFilters.some((f) => f.id !== filter.id && f.type === type)} sx={{ fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' }}>
                      {config.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ flex: 1 }}>{renderFilterInput(filter)}</Box>
              <Tooltip title="Remove Filter">
                <IconButton onClick={() => handleRemoveFilter(filter.id)} size="small" sx={{ color: '#757575', marginTop: '8px', padding: '4px', '&:hover': { backgroundColor: 'rgba(117, 117, 117, 0.04)' } }}>
                  <CloseIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Stack>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button 
            type="submit" 
            variant="outlined" 
            size="small" 
            startIcon={<SearchIcon fontSize="small" />} 
            disabled={
              // Disable when explicitly requested or when any active filter is denied
              !!searchDisabled || activeFilters.some((f) => accessNotices?.[f.type]?.isDenied)
            }
            sx={{ borderRadius: '4px', textTransform: 'none', fontWeight: 400, boxShadow: 'none', border: '1px solid #1976d2', color: '#1976d2', py: 0.5, height: '32px', fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.04)', borderColor: '#1976d2' } }}
          >
            Search
          </Button>
        </Box>
      </form>
    </Box>
  );
}

export default ReusableFilters;
