import React, { useEffect, useRef } from 'react';
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
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ClearAll as ClearAllIcon,
  Add as AddIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useSkillType } from '../../contexts/SkillTypeContext';
import { logInfo, logError } from '../../utils/logger';

// Filter type definitions
const FILTER_TYPES = {
  code: {
    label: 'Code',
    type: 'text',
    placeholder: 'Filter by skill type code'
  },
  name: {
    label: 'Name',
    type: 'text',
    placeholder: 'Filter by skill type name'
  }
};

// Create a component instance ID to ensure we don't lose state
const COMPONENT_INSTANCE_ID = Math.random().toString(36).substring(2, 9);

// Create a persistent store that doesn't reset between re-renders
const persistentFormStore = {
  formValues: {},
  activeFilters: []
};

const SkillTypeFilters = () => {
  const { filters, updateFilters, clearFilters, fetchSkillTypes } = useSkillType();
  
  // Keep reference to instance ID for logging
  const instanceIdRef = React.useRef(COMPONENT_INSTANCE_ID);
  const prevFiltersRef = React.useRef(filters || {});
  const filtersRef = React.useRef(filters || {});
  
  // Track when filter type changes to force re-render
  const [filterTypeChangeCount, setFilterTypeChangeCount] = React.useState(0);
  const filterTypeRef = useRef({});
  
  // Initialize form with react-hook-form - MOVED UP before any effects that use setValue
  const { control, handleSubmit, reset, setValue, watch, formState: { isDirty } } = useForm({
    defaultValues: (() => {
      // If we have stored form values, use them
      if (persistentFormStore.formValues.values) {
        return persistentFormStore.formValues.values;
      }
      
      // Otherwise initialize from props
      return {
        code: filters?.code || '',
        name: filters?.name || ''
      };
    })(),
    mode: 'onChange'
  });
  
  // Debug log the incoming filters
  useEffect(() => {
    logInfo(`SkillTypeFilters (${instanceIdRef.current}) - Current filters:`, filters);
  }, [filters]);
  
  // Update filtersRef when filters prop changes
  useEffect(() => {
    filtersRef.current = filters || {};
    
    // When filters change externally, update the form
    if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)) {
      logInfo(`SkillTypeFilters (${instanceIdRef.current}) - External filters changed:`, filters);
      
      // Update form values based on new filters
      Object.keys(FILTER_TYPES).forEach(type => {
        setValue(type, filters?.[type] || '');
      });
      
      // Update active filters to match the new filters
      const updatedActiveFilters = [];
      let id = 1;
      
      // Add filters from the new filters prop
      Object.keys(filters || {}).forEach(type => {
        if (FILTER_TYPES[type] && filters[type]) {
          updatedActiveFilters.push({ id: id++, type });
        }
      });
      
      // If no active filters, add a default one
      if (updatedActiveFilters.length === 0) {
        updatedActiveFilters.push({ id: id, type: 'code' });
      }
      
      setActiveFilters(updatedActiveFilters);
      persistentFormStore.activeFilters = [...updatedActiveFilters];
      setNextFilterId(id + 1);
      
      // Update persistent store
      if (persistentFormStore.formValues.values) {
        Object.keys(FILTER_TYPES).forEach(type => {
          persistentFormStore.formValues.values[type] = filters?.[type] || '';
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

  // Initialize active filters state
  const [activeFilters, setActiveFilters] = React.useState(() => {
    // If we have saved state, use it
    if (persistentFormStore.activeFilters.length > 0) {
      return [...persistentFormStore.activeFilters];
    }
    
    // Otherwise initialize from props
    const initialFilters = [];
    let id = 1;
    
    Object.entries(filters || {}).forEach(([type, value]) => {
      if (FILTER_TYPES[type] && value) {
        initialFilters.push({ id: id++, type });
      }
    });
    
    if (initialFilters.length === 0) {
      initialFilters.push({ id: id, type: 'code' });
    }
    
    // Save to persistent store
    persistentFormStore.activeFilters = [...initialFilters];
    
    return initialFilters;
  });
  
  // Next filter ID for adding new filters
  const [nextFilterId, setNextFilterId] = React.useState(() => {
    return persistentFormStore.activeFilters.length + 1;
  });
  
  // Store the last submitted filters to preserve values between renders
  const [lastSubmittedFilters, setLastSubmittedFilters] = React.useState(() => {
    return persistentFormStore.formValues.lastSubmitted || filters || {};
  });

  // Handle filter submission - This is the key function for grid refresh
  const onSubmit = (data) => {
    logInfo(`SkillTypeFilters (${instanceIdRef.current}) - Submitting filters:`, data);
    
    // Create a clean copy of filters with only non-empty values
    const newFilters = {};
    
    // Only add non-empty values to filters
    Object.entries(data).forEach(([key, value]) => {
      if (value && typeof value === 'string' && value.trim() !== '') {
        newFilters[key] = value.trim();
        logInfo(`SkillTypeFilters - Adding filter ${key}: "${value.trim()}"`);
      }
    });
    
    logInfo(`SkillTypeFilters (${instanceIdRef.current}) - Applied filters:`, newFilters);
    
    // Save to persistent store for consistent state
    persistentFormStore.formValues.lastSubmitted = {...newFilters};
    setLastSubmittedFilters({...newFilters});
    prevFiltersRef.current = {...newFilters};
    filtersRef.current = {...newFilters};
    
    // Update context with new filters
    updateFilters(newFilters);
    
    // Explicitly fetch skill types with the new filters
    // This is the key addition that ensures the grid refreshes
    fetchSkillTypes(0, 10, newFilters);
  };

  // Clear all filters
  const handleClearFilters = () => {
    logInfo(`SkillTypeFilters (${instanceIdRef.current}) - Clearing all filters`);
    
    // Reset form values to empty
    reset({ code: '', name: '' });
    
    // Reset to default single filter
    const defaultFilter = { id: 1, type: 'code' };
    setActiveFilters([defaultFilter]);
    persistentFormStore.activeFilters = [defaultFilter];
    setNextFilterId(2);
    
    // Clear all filter references
    const emptyFilters = {};
    persistentFormStore.formValues.lastSubmitted = emptyFilters;
    persistentFormStore.formValues.values = { code: '', name: '' };
    
    setLastSubmittedFilters(emptyFilters);
    prevFiltersRef.current = emptyFilters;
    filtersRef.current = emptyFilters;
    
    // Call context clearFilters function
    clearFilters();
    
    // Explicitly fetch skill types with empty filters
    // This ensures the grid refreshes immediately
    fetchSkillTypes(0, 10, {});
  };

  // Add filter button handler
  const handleAddFilter = () => {
    const unusedFilterTypes = Object.keys(FILTER_TYPES).filter(type => 
      !activeFilters.some(f => f.type === type)
    );
    
    if (unusedFilterTypes.length > 0) {
      // Get the type of the new filter
      const newFilterType = unusedFilterTypes[0];
      
      // 1. Ensure the form value for this type is empty
      setValue(newFilterType, '');
      
      // 2. Ensure the persistent store has an empty value for this type
      if (persistentFormStore.formValues.values) {
        persistentFormStore.formValues.values[newFilterType] = '';
      }
      
      // 3. Update the UI with the new filter
      setActiveFilters(prev => {
        const newFilters = [...prev, { 
          id: nextFilterId, 
          type: newFilterType 
        }];
        persistentFormStore.activeFilters = newFilters;
        return newFilters;
      });
      
      // 4. Update the next filter ID
      setNextFilterId(prevId => prevId + 1);
    }
  };
  
  // Filter type change handler
  const handleFilterTypeChange = (filterId, newType) => {
    try {
      // Find the old filter type
      const oldFilter = activeFilters.find(f => f.id === filterId);
      if (!oldFilter) return;
      
      const oldType = oldFilter.type;
      logInfo(`SkillTypeFilters - Changing filter type from ${oldType} to ${newType}`);
      
      // Store the current filter type for this filter ID
      filterTypeRef.current[filterId] = newType;
      
      // Reset the old filter value in form and persistent store
      setValue(oldType, '');
      if (persistentFormStore.formValues.values) {
        persistentFormStore.formValues.values[oldType] = '';
      }
      
      // Update the filter type in the UI
      setActiveFilters(prevFilters => {
        const newFilters = prevFilters.map(f => 
          f.id === filterId ? { ...f, type: newType } : f
        );
        persistentFormStore.activeFilters = [...newFilters];
        return newFilters;
      });
      
      // Force a re-render of the entire component
      setFilterTypeChangeCount(prev => prev + 1);
      
      // Update parent component with active filters
      // Create updated filters with all active filters EXCEPT the changed one
      const updatedFilters = { ...filtersRef.current };
      delete updatedFilters[oldType]; // Remove the old filter type
      
      // Only include values that aren't empty
      Object.keys(updatedFilters).forEach(key => {
        if (!updatedFilters[key] || updatedFilters[key].toString().trim() === '') {
          delete updatedFilters[key];
        }
      });
      
      // Update all references
      filtersRef.current = updatedFilters;
      prevFiltersRef.current = updatedFilters;
      persistentFormStore.formValues.lastSubmitted = updatedFilters;
      setLastSubmittedFilters(updatedFilters);
      
      // Update context with new filters
      updateFilters(updatedFilters);
      
      // Explicitly fetch skill types to refresh the grid
      fetchSkillTypes(0, 10, updatedFilters);
    } catch (error) {
      logError("Error changing filter type:", error);
    }
  };
  
  // Remove filter button handler
  const handleRemoveFilter = (filterId) => {
    try {
      // Find the filter that's being removed
      const removedFilter = activeFilters.find(f => f.id === filterId);
      if (!removedFilter) {
        logError("Filter not found with ID:", filterId);
        return;
      }
      
      const removedType = removedFilter.type;
      logInfo(`Removing filter with ID ${filterId}, type ${removedType}`);
      
      // Create a new object directly from current filters
      const currentFilters = { ...filters };
      
      // Remove the specific filter type
      delete currentFilters[removedType];
      
      // Reset the form value
      setValue(removedType, '');
      
      // Update the UI state - remove filter from displayed filters
      const newActiveFilters = activeFilters.filter(f => f.id !== filterId);
      
      // If we've removed all filters, add a default one
      if (newActiveFilters.length === 0) {
        newActiveFilters.push({ id: nextFilterId, type: 'code' });
        setNextFilterId(prevId => prevId + 1);
      }
      
      // Update UI filter state
      setActiveFilters(newActiveFilters);
      persistentFormStore.activeFilters = [...newActiveFilters];
      
      // Update persistent state
      if (persistentFormStore.formValues.values) {
        persistentFormStore.formValues.values[removedType] = '';
      }
      persistentFormStore.formValues.lastSubmitted = currentFilters;
      
      // Update all references
      filtersRef.current = currentFilters;
      prevFiltersRef.current = currentFilters;
      setLastSubmittedFilters(currentFilters);
      
      // Update context with new filters and refresh grid
      updateFilters(currentFilters);
      fetchSkillTypes(0, 10, currentFilters);
    } catch (error) {
      logError("Error removing filter:", error);
    }
  };

  // Render filter inputs - completely rewritten to fix the issue
  const renderFilterInput = (filter) => {
    const { type, id } = filter;
    const filterConfig = FILTER_TYPES[type];
    
    if (!filterConfig) return null;
    
    // Create a unique key that changes when filter type changes
    // This forces React to completely unmount and remount the input
    const inputKey = `${type}-${id}-${filterTypeChangeCount}`;
    
    return (
      <Controller
        key={inputKey}
        name={type}
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            size="small"
            label={filterConfig.label}
            placeholder={filterConfig.placeholder}
            variant="outlined"
            value={field.value || ''}
            onChange={(e) => {
              // Call the original onChange
              field.onChange(e);
              
              // If user has cleared the field, auto-submit after a short delay
              if (e.target.value === '') {
                setTimeout(() => {
                  handleSubmit(onSubmit)();
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
      <form onSubmit={handleSubmit(onSubmit)}>
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
                {renderFilterInput(filter)}
              </Box>
              
              <Tooltip title="Remove Filter">
                <IconButton
                  onClick={() => handleRemoveFilter(filter.id)}
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
};

export default SkillTypeFilters; 