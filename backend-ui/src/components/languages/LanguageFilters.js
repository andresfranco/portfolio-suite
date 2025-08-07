import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
  FormControlLabel,
  Checkbox,
  Grid
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ClearAll as ClearAllIcon
} from '@mui/icons-material';
import { useLanguage } from '../../contexts/LanguageContext';
import { logInfo } from '../../utils/logger';

// Filter type definitions
const FILTER_TYPES = {
  name: {
    label: 'Name',
    type: 'text',
    placeholder: 'Search by language name'
  },
  code: {
    label: 'Code',
    type: 'text',
    placeholder: 'Search by language code'
  },
  is_default: {
    label: 'Default Language',
    type: 'boolean',
  }
};

// Create a component instance ID to ensure we don't lose state
const COMPONENT_INSTANCE_ID = Math.random().toString(36).substring(2, 9);

// Create a persistent store that doesn't reset between re-renders
const persistentFormStore = {
  formValues: {},
  activeFilters: []
};

// Helper function to render different filter input types
function renderFilterInput(type, control, handleSubmit, onSubmitFilters) {
  const filterConfig = FILTER_TYPES[type];
  if (!filterConfig) return null;

  switch (filterConfig.type) {
    case 'text':
      return (
        <Controller
          name={type}
          control={control}
          defaultValue=""
          render={({ field }) => (
            <TextField
              {...field}
              placeholder={filterConfig.placeholder}
              fullWidth
              variant="outlined"
              size="small"
              label={filterConfig.label}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit(onSubmitFilters)();
                }
              }}
              onChange={(e) => {
                // Call the original onChange
                field.onChange(e);
                
                // If user has cleared the field, auto-submit after a short delay
                if (e.target.value === '') {
                  // For better UX, we delay slightly to allow the user to see the field clearing
                  setTimeout(() => {
                    handleSubmit(onSubmitFilters)();
                  }, 100);
                }
              }}
              sx={{
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
                  '& .MuiOutlinedInput-input': {
                    fontSize: '13px',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    color: '#505050',
                  },
                },
                '& .MuiInputLabel-root': {
                  fontSize: '13px',
                  color: '#505050',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  transform: 'translate(14px, 11px) scale(1)',
                  '&.MuiInputLabel-shrink': {
                    transform: 'translate(14px, -6px) scale(0.75)',
                  },
                },
              }}
            />
          )}
        />
      );
    case 'boolean':
      return (
        <Controller
          name={type}
          control={control}
          defaultValue={null}
          render={({ field: { onChange, value, ...rest } }) => (
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel 
                sx={{
                  fontSize: '13px',
                  color: '#505050',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  transform: 'translate(14px, 11px) scale(1)',
                  '&.MuiInputLabel-shrink': {
                    transform: 'translate(14px, -6px) scale(0.75)',
                  },
                }}
              >
                {filterConfig.label}
              </InputLabel>
              <Select
                {...rest}
                value={value === null ? '' : value}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : e.target.value === 'true';
                  onChange(val);
                  
                  // Auto-submit after a short delay
                  setTimeout(() => {
                    handleSubmit(onSubmitFilters)();
                  }, 100);
                }}
                label={filterConfig.label}
                sx={{
                  borderRadius: '4px',
                  height: '40px',
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1976d2',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1976d2',
                    borderWidth: 1,
                  },
                  '& .MuiSelect-select': {
                    fontSize: '13px',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    color: '#505050',
                  }
                }}
              >
                <MenuItem value="" sx={{ fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' }}>
                  <em>Any</em>
                </MenuItem>
                <MenuItem value="true" sx={{ fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' }}>Yes</MenuItem>
                <MenuItem value="false" sx={{ fontSize: '13px', fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' }}>No</MenuItem>
              </Select>
            </FormControl>
          )}
        />
      );
    default:
      return null;
  }
}

function LanguageFilters({ 
  filters, // Current filter state from context
  onFiltersChange, // Function to update filter state in context
  onSearch // Search callback function
}) {
  const { updateFilters } = useLanguage();
  const instanceIdRef = useRef(COMPONENT_INSTANCE_ID);
  const prevFiltersRef = useRef(filters || {});
  const isManualSubmitRef = useRef(false);
  const filtersRef = useRef(filters || {});
  
  // Initialize active filters from persistent store or filters prop
  const [activeFilters, setActiveFilters] = useState(() => {
    // If we have saved state, use it
    if (persistentFormStore.activeFilters.length > 0) {
      return [...persistentFormStore.activeFilters];
    }
    
    // Otherwise initialize from props
    const initialFilters = [];
    let id = 1;
    
    Object.entries(filters || {}).forEach(([type, value]) => {
      if (FILTER_TYPES[type] && value !== undefined) {
        initialFilters.push({ id: id++, type });
      }
    });
    
    if (initialFilters.length === 0) {
      initialFilters.push({ id: id, type: 'name' });
    }
    
    // Save to persistent store
    persistentFormStore.activeFilters = [...initialFilters];
    
    return initialFilters;
  });
  
  const [nextFilterId, setNextFilterId] = useState(() => {
    return persistentFormStore.activeFilters.length + 1;
  });
  
  // Store the last submitted filters to preserve values between renders
  const [lastSubmittedFilters, setLastSubmittedFilters] = useState(() => {
    return persistentFormStore.formValues.lastSubmitted || filters || {};
  });
  
  // Set up react-hook-form
  const { control, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: (() => {
      // If we have stored form values, use them
      if (persistentFormStore.formValues.values) {
        return persistentFormStore.formValues.values;
      }
      
      // Otherwise initialize from props
      return {
        name: filters?.name || '',
        code: filters?.code || '',
        is_default: filters?.is_default === undefined ? null : filters?.is_default
      };
    })(),
    mode: 'onChange'
  });

  // Update form values when filters prop changes
  useEffect(() => {
    filtersRef.current = filters || {};
    
    // When filters prop changes externally, update the form
    if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)) {
      logInfo(`LanguageFilters (${instanceIdRef.current}) - External filters changed:`, filters);
      
      // Update form values based on new filters
      Object.keys(FILTER_TYPES).forEach(type => {
        setValue(type, filters?.[type] !== undefined ? filters[type] : type === 'is_default' ? null : '');
      });
      
      // Update active filters to match the new filters
      const updatedActiveFilters = [];
      let id = 1;
      
      // Add filters from the new filters prop
      Object.keys(filters || {}).forEach(type => {
        if (FILTER_TYPES[type] && filters[type] !== undefined) {
          updatedActiveFilters.push({ id: id++, type });
        }
      });
      
      // If no active filters, add a default one
      if (updatedActiveFilters.length === 0) {
        updatedActiveFilters.push({ id: id, type: 'name' });
      }
      
      setActiveFilters(updatedActiveFilters);
      persistentFormStore.activeFilters = [...updatedActiveFilters];
      setNextFilterId(id + 1);
      
      // Update persistent store
      if (persistentFormStore.formValues.values) {
        Object.keys(FILTER_TYPES).forEach(type => {
          persistentFormStore.formValues.values[type] = filters?.[type] !== undefined ? filters[type] : type === 'is_default' ? null : '';
        });
      }
      
      prevFiltersRef.current = { ...(filters || {}) };
    }
  }, [filters, setValue]);

  // Synchronize persistent form store with current form values
  const formValues = watch();
  useEffect(() => {
    persistentFormStore.formValues.values = formValues;
  }, [formValues]);
  
  // Update active filters in persistent store whenever they change
  useEffect(() => {
    persistentFormStore.activeFilters = [...activeFilters];
  }, [activeFilters]);

  // Add filter button handler
  const handleAddFilter = useCallback(() => {
    const unusedFilterTypes = Object.keys(FILTER_TYPES).filter(type => 
      !activeFilters.some(f => f.type === type)
    );
    
    if (unusedFilterTypes.length > 0) {
      // Get the type of the new filter
      const newFilterType = unusedFilterTypes[0];
      
      // 1. Ensure the form value for this type is empty
      setValue(newFilterType, newFilterType === 'is_default' ? null : '');
      
      // 2. Ensure the persistent store has an empty value for this type
      if (persistentFormStore.formValues.values) {
        persistentFormStore.formValues.values[newFilterType] = newFilterType === 'is_default' ? null : '';
      }
      
      // 3. Update the UI with the new filter
      setActiveFilters(prevFilters => {
        const newFilters = [...prevFilters, { 
          id: nextFilterId, 
          type: newFilterType 
        }];
        persistentFormStore.activeFilters = newFilters;
        return newFilters;
      });
      
      // 4. Update the next filter ID
      setNextFilterId(prevId => prevId + 1);
    }
  }, [activeFilters, nextFilterId, setValue]);

  // Filter type change handler
  const handleFilterTypeChange = useCallback((filterId, newType) => {
    // Find the old filter type
    const oldFilter = activeFilters.find(f => f.id === filterId);
    if (!oldFilter) return;
    
    const oldType = oldFilter.type;
    
    // 1. Reset the old filter value both in form and persistent store
    setValue(oldType, oldType === 'is_default' ? null : '');
    if (persistentFormStore.formValues.values) {
      persistentFormStore.formValues.values[oldType] = oldType === 'is_default' ? null : '';
    }
    
    // 2. Ensure the new filter type starts with empty value
    setValue(newType, newType === 'is_default' ? null : '');
    if (persistentFormStore.formValues.values) {
      persistentFormStore.formValues.values[newType] = newType === 'is_default' ? null : '';
    }
    
    // 3. Update the filter type in the UI
    setActiveFilters(prevFilters => {
      const newFilters = prevFilters.map(f => 
        f.id === filterId ? { ...f, type: newType } : f
      );
      persistentFormStore.activeFilters = newFilters;
      return newFilters;
    });
    
    // 4. Update parent component with active filters
    // Create updated filters with all active filters EXCEPT the changed one
    const updatedFilters = { ...filtersRef.current };
    delete updatedFilters[oldType]; // Remove the old filter type
    
    // Only include values that aren't empty
    Object.keys(updatedFilters).forEach(key => {
      if (updatedFilters[key] === undefined || 
          (typeof updatedFilters[key] === 'string' && updatedFilters[key].trim() === '')) {
        delete updatedFilters[key];
      }
    });
    
    // Update all references
    filtersRef.current = updatedFilters;
    prevFiltersRef.current = updatedFilters;
    persistentFormStore.formValues.lastSubmitted = updatedFilters;
    setLastSubmittedFilters(updatedFilters);
    
    // Trigger grid refresh with updated filters
    if (onFiltersChange) {
      onFiltersChange(updatedFilters);
    }
  }, [activeFilters, setValue, onFiltersChange]);

  // Handle form submission for filters
  const onSubmitFilters = useCallback((data) => {
    // Mark this as a manual submission
    isManualSubmitRef.current = true;
    
    // Create a clean copy of filters with only active filter types
    const activeFilterTypes = activeFilters.map(f => f.type);
    const cleanFilters = {};
    
    activeFilterTypes.forEach(type => {
      const value = data[type];
      
      // Handle boolean values (for is_default)
      if (typeof value === 'boolean') {
        cleanFilters[type] = value;
      }
      // Handle null values for is_default
      else if (type === 'is_default' && value === null) {
        // Don't include null is_default in filters
      }
      // Handle string values
      else if (typeof value === 'string' && value.trim() !== '') {
        cleanFilters[type] = value.trim();
      }
    });
    
    logInfo(`LanguageFilters (${instanceIdRef.current}) - Submitting filters:`, cleanFilters);
    
    // Save to persistent store for consistent state
    persistentFormStore.formValues.lastSubmitted = {...cleanFilters};
    setLastSubmittedFilters({...cleanFilters});
    prevFiltersRef.current = {...cleanFilters};
    filtersRef.current = {...cleanFilters};
    
    // Update context filters
    updateFilters(cleanFilters);
    
    // Call callback functions if provided
    if (onFiltersChange) {
      onFiltersChange(cleanFilters);
    }
    
    if (onSearch) {
      onSearch(cleanFilters);
    }
  }, [activeFilters, onFiltersChange, onSearch, updateFilters]);

  // Remove filter button handler
  const handleRemoveFilter = useCallback((filterId) => {
    try {
      // Find the filter that's being removed
      const removedFilter = activeFilters.find(f => f.id === filterId);
      if (!removedFilter) {
        logInfo("Filter not found with ID:", filterId);
        return;
      }
      
      const removedType = removedFilter.type;
      logInfo(`Removing filter with ID ${filterId}, type ${removedType}`);
      
      // Create a new object directly from current filters prop
      const currentFilters = { ...filters };
      
      // Remove the specific filter type
      delete currentFilters[removedType];
      
      // Reset the form value
      if (removedType === 'is_default') {
        setValue(removedType, null);
      } else {
        setValue(removedType, '');
      }
      
      // Update the UI state - remove filter from displayed filters
      const newActiveFilters = activeFilters.filter(f => f.id !== filterId);
      
      // If we've removed all filters, add a default one
      if (newActiveFilters.length === 0) {
        newActiveFilters.push({ id: nextFilterId, type: 'name' });
        setNextFilterId(prevId => prevId + 1);
      }
      
      // Update UI filter state
      setActiveFilters(newActiveFilters);
      persistentFormStore.activeFilters = [...newActiveFilters];
      
      // Update persistent state
      if (persistentFormStore.formValues.values) {
        persistentFormStore.formValues.values[removedType] = 
          removedType === 'is_default' ? null : '';
      }
      persistentFormStore.formValues.lastSubmitted = currentFilters;
      
      // Update all references
      filtersRef.current = currentFilters;
      prevFiltersRef.current = currentFilters;
      setLastSubmittedFilters(currentFilters);
      
      // Immediately notify parent to update grid with new filters
      if (onFiltersChange) {
        logInfo('Filter removed. Applying updated filters:', currentFilters);
        onFiltersChange(currentFilters);
      }
      
      // Also call search callback if provided and different from onChange
      if (onSearch && onSearch !== onFiltersChange) {
        onSearch(currentFilters);
      }
    } catch (error) {
      logInfo("Error removing filter:", error);
    }
  }, [activeFilters, filters, nextFilterId, onFiltersChange, onSearch, setValue]);

  // Clear all filters handler
  const handleClearFilters = useCallback(() => {
    logInfo('Clearing all language filters');
    
    // Reset form values to empty
    reset({
      name: '',
      code: '',
      is_default: null
    });
    
    // Reset to default single filter
    const defaultFilter = { id: 1, type: 'name' };
    setActiveFilters([defaultFilter]);
    persistentFormStore.activeFilters = [defaultFilter];
    setNextFilterId(2);
    
    // Clear all filter references
    const emptyFilters = {};
    persistentFormStore.formValues.lastSubmitted = emptyFilters;
    
    // Ensure values object has the correct empty types for each filter type
    persistentFormStore.formValues.values = { 
      name: '', 
      code: '', 
      is_default: null
    };
    
    setLastSubmittedFilters(emptyFilters);
    prevFiltersRef.current = emptyFilters;
    filtersRef.current = emptyFilters;
    
    // Update context with empty filters
    updateFilters({});
    
    // Call callback functions if provided
    if (onFiltersChange) {
      logInfo('Cleared all filters. Refreshing grid with no filters.');
      onFiltersChange({});
    }
    
    if (onSearch && onSearch !== onFiltersChange) {
      logInfo('Calling search callback with empty filters');
      onSearch({});
    }
  }, [onFiltersChange, onSearch, reset, updateFilters]);

  // Check if any filter has a value
  const hasActiveFilters = Object.values(formValues).some(value => {
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string') return value.trim() !== '';
    return value !== null && value !== undefined && value !== '';
  });

  // Generate unique keys for consistent rendering
  const filterKey = activeFilters.map(f => `${f.id}-${f.type}`).join('_');
  const formKey = `language-filters-form-${filterKey}`;

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
      
      <form key={formKey} onSubmit={handleSubmit(onSubmitFilters)}>
        <Stack spacing={2.5}>
          {activeFilters.map((filter) => (
            <Box key={`filter-${filter.id}`} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <FormControl 
                sx={{ 
                  minWidth: 180,
                  '& .MuiInputLabel-root': {
                    fontSize: '13px',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    color: '#505050',
                    transform: 'translate(14px, 11px) scale(1)',
                    '&.MuiInputLabel-shrink': {
                      transform: 'translate(14px, -6px) scale(0.75)',
                    },
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
                  '& .MuiSelect-select': {
                    fontSize: '13px',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    color: '#505050',
                  }
                }}
              >
                <InputLabel id={`filter-type-label-${filter.id}`}>Filter Type</InputLabel>
                <Select
                  labelId={`filter-type-label-${filter.id}`}
                  id={`filter-type-${filter.id}`}
                  value={filter.type}
                  label="Filter Type"
                  size="small"
                  onChange={(e) => handleFilterTypeChange(filter.id, e.target.value)}
                >
                  {Object.entries(FILTER_TYPES).map(([type, config]) => (
                    <MenuItem 
                      key={type} 
                      value={type}
                      disabled={activeFilters.some(f => f.id !== filter.id && f.type === type)}
                      sx={{
                        fontSize: '13px',
                        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                      }}
                    >
                      {config.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Box sx={{ flex: 1 }}>
                {renderFilterInput(filter.type, control, handleSubmit, onSubmitFilters)}
              </Box>
              
              <Tooltip title="Remove Filter">
                <IconButton
                  onClick={() => handleRemoveFilter(filter.id)}
                  size="small"
                  disabled={activeFilters.length <= 1}
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
            type="submit"
            variant="outlined"
            size="small"
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
      </form>
    </Box>
  );
}

export default LanguageFilters;
