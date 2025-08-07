import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Box, Paper, Typography, IconButton, TextField, Stack, 
  Select, MenuItem, FormControl, InputLabel, Button, Tooltip, 
  Chip, OutlinedInput, Checkbox, ListItemText, Autocomplete, CircularProgress, Grid
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  ClearAll as ClearAllIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { alpha } from '@mui/material/styles';
import { useUsers } from '../../contexts/UserContext';
import { logInfo, logError } from '../../utils/logger';

// Filter type definitions - should match backend filterable fields
const FILTER_TYPES = {
  username: {
    label: 'Username',
    type: 'text',
    placeholder: 'Search by username'
  },
  email: {
    label: 'Email',
    type: 'text',
    placeholder: 'Search by email'
  },
  is_active: {
    label: 'Status',
    type: 'select',
    placeholder: 'Filter by status',
    options: [
      { value: '', label: 'All' },
      { value: 'true', label: 'Active' },
      { value: 'false', label: 'Inactive' }
    ]
  },
  roles: {
    label: 'Roles',
    type: 'multiselect',
    placeholder: 'Filter by roles'
  }
};

// Map of operators for display and selection
const OPERATORS = {
  contains: 'Contains',
  eq: 'Equals',
  gt: 'Greater Than',
  lt: 'Less Than',
  gte: 'Greater Than or Equal',
  lte: 'Less Than or Equal'
};

// Create a component instance ID to ensure we don't lose state
const COMPONENT_INSTANCE_ID = Math.random().toString(36).substring(2, 9);

// Create a persistent store that doesn't reset between re-renders
const persistentFormStore = {
  formValues: {},
  activeFilters: []
};

// Helper function to render the appropriate input field for each filter type
function renderFilterInput(type, control, handleSubmit, onSubmitFilters, roles) {
  const filterConfig = FILTER_TYPES[type];
  if (!filterConfig) return null;
  
  if (filterConfig.type === 'select') {
    return (
      <Controller
        name={type}
        control={control}
        render={({ field }) => (
          <FormControl 
            fullWidth 
            size="small"
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
          >
            <InputLabel id={`${type}-label`}>{filterConfig.label}</InputLabel>
            <Select
              {...field}
              labelId={`${type}-label`}
              label={filterConfig.label}
              onChange={(e) => {
                field.onChange(e);
                // Auto-submit on change
                setTimeout(() => {
                  console.log(`Status filter changed to ${e.target.value}, auto-submitting form`);
                  handleSubmit(onSubmitFilters)();
                }, 100);
              }}
            >
              {filterConfig.options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      />
    );
  }
  
  if (filterConfig.type === 'multiselect' && type === 'roles') {
    return (
      <Controller
        name={type}
        control={control}
        render={({ field }) => (
          <FormControl 
            fullWidth 
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '4px',
                minHeight: '40px',
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2',
                  borderWidth: 1,
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
          >
            <InputLabel id={`${type}-label`}>{filterConfig.label}</InputLabel>
            <Select
              {...field}
              labelId={`${type}-label`}
              multiple
              label={filterConfig.label}
              input={<OutlinedInput id={`select-${type}`} label={filterConfig.label} />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((roleId) => {
                    const role = roles.find(r => r.id === roleId || r.id === Number(roleId));
                    return (
                      <Chip 
                        key={roleId} 
                        label={role ? role.name : roleId} 
                        size="small"
                        sx={{ 
                          height: '20px', 
                          fontSize: '10px',
                          '& .MuiChip-label': {
                            padding: '0 6px',
                          }
                        }}
                      />
                    );
                  })}
                </Box>
              )}
              onChange={(e) => {
                // Ensure we're always working with an array of role IDs (numbers)
                const roleIds = e.target.value.map(id => 
                  typeof id === 'string' ? parseInt(id, 10) : id
                );
                
                console.log(`Roles filter changed to: ${JSON.stringify(roleIds)}`);
                
                // Update the form field with the processed array
                field.onChange(roleIds);
                
                // Auto-submit after short delay
                setTimeout(() => {
                  console.log(`Auto-submitting form after roles change: ${JSON.stringify(roleIds)}`);
                  handleSubmit(onSubmitFilters)();
                }, 100);
              }}
            >
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  <Checkbox checked={field.value?.some(id => id === role.id || id === Number(role.id))} />
                  <ListItemText primary={role.name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      />
    );
  }
  
  return (
    <Controller
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
                handleSubmit(onSubmitFilters)();
              }, 100);
            }
          }}
          // Add onKeyDown event handler to submit on Enter key
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault(); // Prevent default form submission
              handleSubmit(onSubmitFilters)();
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
}

const UserFilters = ({ onFilterChange, onSearch, filters: initialFilters }) => {
  const { applyFilters, clearFilters, fetchRoles, roles } = useUsers();
  const instanceIdRef = useRef(COMPONENT_INSTANCE_ID);
  const prevFiltersRef = useRef(initialFilters || {});
  const isManualSubmitRef = useRef(false);
  const filtersRef = useRef(initialFilters || {});
  
  // Initialize persistent state that survives component remounts
  const [activeFilters, setActiveFilters] = useState(() => {
    // If we have saved state, use it
    if (persistentFormStore.activeFilters.length > 0) {
      return [...persistentFormStore.activeFilters];
    }
    
    // Otherwise initialize from props
    const initialActiveFilters = [];
    let id = 1;
    
    // Convert array initialFilters to object structure if needed
    const filtersObj = Array.isArray(initialFilters) 
        ? initialFilters.reduce((obj, filter) => {
            if (filter && filter.field && filter.value) {
                obj[filter.field] = filter.value;
            }
            return obj;
          }, {})
        : initialFilters || {};
    
    Object.entries(filtersObj).forEach(([type, value]) => {
        if (FILTER_TYPES[type] && value) {
            initialActiveFilters.push({ id: id++, type });
        }
    });
    
    if (initialActiveFilters.length === 0) {
        initialActiveFilters.push({ id: id, type: 'username' });
    }
    
    // Save to persistent store
    persistentFormStore.activeFilters = [...initialActiveFilters];
    
    return initialActiveFilters;
  });
  
  const [nextFilterId, setNextFilterId] = useState(() => {
    return persistentFormStore.activeFilters.length + 1;
  });
  
  // Fetch roles on component mount
  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);
  
  // Use a form with persistence via our store
  const { control, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: (() => {
      // If we have stored form values, use them
      if (persistentFormStore.formValues.values) {
        return persistentFormStore.formValues.values;
      }
      
      // Otherwise initialize from props
      return {
        username: initialFilters?.username || '',
        email: initialFilters?.email || '',
        is_active: initialFilters?.is_active || '',
        roles: initialFilters?.roles || []
      };
    })()
  });
  
  // Form values
  const formValues = watch();
  
  // Save form values to persistent store when they change
  useEffect(() => {
    persistentFormStore.formValues.values = { ...formValues };
  }, [formValues]);
  
  // Handle form submission (apply filters)
  const onSubmitFilters = useCallback((data) => {
    // Mark that this was a manual submission (use later for focus management)
    isManualSubmitRef.current = true;
    
    // Debug logging
    console.log('UserFilters onSubmitFilters - Form data received:', data);
    
    // Build the filter object
    const cleanFilters = {};
    const emptyFilters = [];
    
    // Process active filters
    activeFilters.forEach(({ type }) => {
      const value = data[type];
      const isEmpty = value === undefined || value === null || 
                      (typeof value === 'string' && value.trim() === '') ||
                      (Array.isArray(value) && value.length === 0);
      
      if (!isEmpty) {
        // Special handling for roles
        if (type === 'roles' && Array.isArray(value)) {
          // Only add if we have roles
          if (value.length > 0) {
            // Ensure role IDs are numbers
            const roleIds = value.map(id => 
              typeof id === 'string' ? parseInt(id, 10) : id
            );
            cleanFilters[type] = roleIds;
            console.log(`Processed ${roleIds.length} roles for filter:`, roleIds);
          } else {
            emptyFilters.push(type);
          }
        } else if (type === 'is_active') {
          // Convert to string 'true' or 'false' for API compatibility
          // But make sure it's not an empty string
          if (value !== '') {
            cleanFilters[type] = String(value);
            console.log(`Including boolean filter: ${type}=${cleanFilters[type]} (type: ${typeof cleanFilters[type]})`);
          } else {
            emptyFilters.push(type);
          }
        } else {
          cleanFilters[type] = value;
          console.log(`Including filter: ${type}=${JSON.stringify(value)}`);
        }
      } else {
        emptyFilters.push(type);
        console.log(`Skipping empty filter: ${type}`);
      }
    });
    
    // Log the final filter object
    console.log('UserFilters - Final filters object being submitted:', cleanFilters);
    console.log('UserFilters - Empty filters not included:', emptyFilters);
    
    // Save to ref and persistent store
    filtersRef.current = {...cleanFilters};
    persistentFormStore.formValues.lastSubmitted = {...cleanFilters};
    
    // Clear empty values in the persistent store
    emptyFilters.forEach(type => {
      if (persistentFormStore.formValues.values) {
        persistentFormStore.formValues.values[type] = type === 'roles' ? [] : '';
      }
    });
    
    // Apply filters directly to context
    console.log('UserFilters - Calling applyFilters with:', cleanFilters);
    applyFilters(cleanFilters);
    
    // Notify parent component
    if (onFilterChange) {
      console.log('UserFilters - Notifying parent via onFilterChange with:', cleanFilters);
      onFilterChange({...cleanFilters});
    }
    
    // If specific search callback provided, call it too
    if (onSearch && onSearch !== onFilterChange) {
      console.log('UserFilters - Notifying parent via onSearch with:', cleanFilters);
      onSearch({...cleanFilters});
    }
    
    return cleanFilters;
  }, [activeFilters, applyFilters, onFilterChange, onSearch]);
  
  // Handle adding a new filter
  const handleAddFilter = useCallback(() => {
    // Find a filter type that isn't already active
    const availableTypes = Object.keys(FILTER_TYPES).filter(
      type => !activeFilters.some(filter => filter.type === type)
    );
    
    if (availableTypes.length > 0) {
      const newFilter = { id: nextFilterId, type: availableTypes[0] };
      
      setActiveFilters(prev => {
        const updated = [...prev, newFilter];
        persistentFormStore.activeFilters = [...updated];
        return updated;
      });
      
      setNextFilterId(prev => prev + 1);
    }
  }, [activeFilters, nextFilterId]);
  
  // Handle removing a filter
  const handleRemoveFilter = useCallback((filterId) => {
    console.log("UserFilters - Removing filter with ID:", filterId);
    
    // Find the filter to be removed
    const filterToRemove = activeFilters.find(f => f.id === filterId);
    
    if (!filterToRemove) {
      console.warn("UserFilters - Filter not found with ID:", filterId);
      return;
    }
    
    const typeToRemove = filterToRemove.type;
    console.log(`UserFilters - Removing filter: ${typeToRemove} (ID: ${filterId})`);
    
    // Clear the form value for the removed filter FIRST
    const defaultValue = typeToRemove === 'roles' ? [] : '';
    setValue(typeToRemove, defaultValue);
    console.log(`UserFilters - Cleared form value for: ${typeToRemove}`);
    
    // Create a copy of the current form values with the removed filter cleared
    const currentFormValues = {...watch()};
    currentFormValues[typeToRemove] = defaultValue;
    
    // Update the activeFilters state (UI update)
    setActiveFilters(prev => {
      // Remove the filter from the array
      const updated = prev.filter(filter => filter.id !== filterId);
      
      // Don't allow all filters to be removed - always keep at least one
      if (updated.length === 0) {
        // Add a default filter
        const defaultType = Object.keys(FILTER_TYPES)[0];
        updated.push({ id: nextFilterId, type: defaultType });
        setNextFilterId(prev => prev + 1);
        console.log(`UserFilters - Added default filter: ${defaultType}`);
      }
      
      // Update persistent store
      persistentFormStore.activeFilters = [...updated];
      console.log(`UserFilters - Active filters after removal:`, updated);
      
      return updated;
    });
    
    // Get the updated active filters (excluding the one being removed)
    const remainingFilters = activeFilters.filter(f => f.id !== filterId);
    
    // Build a completely fresh clean filters object with ONLY remaining filters
    const cleanFilters = {};
    
    // Process ONLY the remaining active filters
    remainingFilters.forEach(({ type }) => {
      // Skip the type we just removed (extra safety check)
      if (type === typeToRemove) return;
      
      const value = currentFormValues[type];
      
      if (value !== undefined && value !== null && 
         !(typeof value === 'string' && value.trim() === '') &&
         !(Array.isArray(value) && value.length === 0)) {
        
        if (type === 'roles' && Array.isArray(value) && value.length > 0) {
          // Ensure role IDs are numbers
          cleanFilters[type] = value.map(id => 
            typeof id === 'string' ? parseInt(id, 10) : id
          );
          console.log(`UserFilters - Including roles after filter removal: ${JSON.stringify(cleanFilters[type])}`);
        } else if (type === 'is_active' && value !== '') {
          // Convert to string for API compatibility
          cleanFilters[type] = String(value);
          console.log(`UserFilters - Including is_active after filter removal: ${cleanFilters[type]}`);
        } else {
          cleanFilters[type] = value;
          console.log(`UserFilters - Including ${type} after filter removal: ${value}`);
        }
      }
    });
    
    console.log('UserFilters - Final clean filters after removal:', cleanFilters);
    console.log('UserFilters - Removed filter type should NOT be present:', typeToRemove);
    
    // Double-check to make sure the removed filter isn't somehow still in the cleanFilters
    if (typeToRemove in cleanFilters) {
      console.warn(`UserFilters - REMOVED FILTER TYPE ${typeToRemove} WAS STILL PRESENT! Removing it.`);
      delete cleanFilters[typeToRemove];
    }
    
    // Update references and persistent store with the clean filters
    filtersRef.current = {...cleanFilters};
    persistentFormStore.formValues.lastSubmitted = {...cleanFilters};
    
    // Also update the persistent store values to reflect removal
    if (persistentFormStore.formValues.values) {
      persistentFormStore.formValues.values[typeToRemove] = defaultValue;
    }
    
    // Notify parent component FIRST to refresh the grid IMMEDIATELY
    // This is critical for updating the grid with the correct filters
    if (onFilterChange) {
      console.log('UserFilters - Notifying parent via onFilterChange with:', cleanFilters);
      onFilterChange({...cleanFilters});
    }
    
    // If specific search callback provided, call it too
    if (onSearch && onSearch !== onFilterChange) {
      console.log('UserFilters - Notifying parent via onSearch with:', cleanFilters);
      onSearch({...cleanFilters});
    }
    
    // Apply filters to context AFTER parent notification
    applyFilters(cleanFilters);
    
  }, [activeFilters, watch, setValue, applyFilters, onFilterChange, onSearch, nextFilterId]);
  
  // Handle changing a filter type
  const handleFilterTypeChange = useCallback((filterId, newType) => {
    setActiveFilters(prev => {
      const updated = prev.map(filter => {
        if (filter.id === filterId) {
          // Find the old type
          const oldType = filter.type;
          
          // Clear the value for the old type
          setValue(oldType, 
            Array.isArray(formValues[oldType]) ? [] : '');
          
          // Return updated filter with new type
          return { ...filter, type: newType };
        }
        return filter;
      });
      
      // Update persistent store
      persistentFormStore.activeFilters = [...updated];
      
      return updated;
    });
  }, [formValues, setValue]);
  
  // Handle clearing all filters
  const handleClearFilters = useCallback(() => {
    console.log('UserFilters handleClearFilters - Clearing all filters');
    
    // Reset form
    reset({
      username: '',
      email: '',
      is_active: '',
      roles: []
    });
    
    // Reset to a single default filter
    setActiveFilters([{ id: 1, type: 'username' }]);
    setNextFilterId(2);
    
    // Update persistent store
    persistentFormStore.activeFilters = [{ id: 1, type: 'username' }];
    persistentFormStore.formValues = {
      values: {
        username: '',
        email: '',
        is_active: '',
        roles: []
      },
      lastSubmitted: {}
    };
    
    // Clear filters reference
    filtersRef.current = {};
    
    // Notify parent component explicitly with empty filters object FIRST
    // This ensures grid is refreshed immediately
    if (onFilterChange) {
      console.log('UserFilters - Triggering explicit filter change with empty filters on clear');
      onFilterChange({});
    }
    
    // If specific search callback provided, call it too to force refresh
    if (onSearch && onSearch !== onFilterChange) {
      console.log('UserFilters - Triggering explicit search with empty filters on clear');
      onSearch({});
    }
    
    // Call clear filters function from context AFTER notifying parent
    // This ensures the parent receives the empty filters before context operations
    clearFilters();
  }, [clearFilters, onFilterChange, onSearch, reset]);
  
  // Always use unique, explicit keys based on filters to force re-rendering
  const filterKey = activeFilters.map(f => `${f.id}-${f.type}`).join('_');
  const formKey = `user-filters-form-${filterKey}`;
  
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
        
      <form 
        key={formKey} 
        onSubmit={handleSubmit(onSubmitFilters)}
      >
        <Stack spacing={2.5}>
          {activeFilters.map((filter, index) => (
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
                      disabled={type !== filter.type && activeFilters.some(f => f.type === type)}
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
                {renderFilterInput(filter.type, control, handleSubmit, onSubmitFilters, roles)}
              </Box>
              
              {activeFilters.length > 1 && (
                <IconButton 
                  onClick={() => handleRemoveFilter(filter.id)}
                  size="small"
                  aria-label="Remove filter"
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
              )}
            </Box>
          ))}
        
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
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
        </Stack>
      </form>
      </Box>
  );
};

export default UserFilters;