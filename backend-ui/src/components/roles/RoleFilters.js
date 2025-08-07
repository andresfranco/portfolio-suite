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
import roleApi from '../../services/roleApi'; // Import API service
import { logInfo, logError } from '../../utils/logger';
import permissionApi from '../../services/permissionApi';
import { useForm, Controller } from 'react-hook-form';
import { alpha } from '@mui/material/styles';
import PermissionAutocomplete from './PermissionAutocomplete';

// Filter type definitions - should match backend filterable fields
const FILTER_TYPES = {
  name: {
    label: 'Role Name',
    type: 'text',
    placeholder: 'Search by role name'
  },
  description: {
    label: 'Description',
    type: 'text',
    placeholder: 'Search by description'
  },
  permissions: {
    label: 'Permissions',
    type: 'autocomplete',
    placeholder: 'Search by permission'
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
function renderFilterInput(type, control, handleSubmit, onSubmitFilters) {
  const filterConfig = FILTER_TYPES[type];
  if (!filterConfig) return null;
  
  if (filterConfig.type === 'autocomplete' && type === 'permissions') {
    return (
      <Controller
        name={type}
        control={control}
        render={({ field }) => (
          <PermissionAutocomplete
            field={field}
            name={type}
            label={filterConfig.label}
            placeholder={filterConfig.placeholder}
            handleSubmit={handleSubmit}
            onSubmitFilters={onSubmitFilters}
          />
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
}

// Function to render the permission chips in a more compact way
const renderPermissionChips = (value) => {
  if (!value || !Array.isArray(value)) return null;
  
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, maxWidth: '100%', overflow: 'hidden' }}>
      {value.map((permission) => (
        <Chip 
          key={permission} 
          label={permission} 
          size="small"
          sx={{ 
            height: '20px', 
            fontSize: '10px',
            '& .MuiChip-label': {
              padding: '0 6px',
            }
          }} 
        />
      ))}
    </Stack>
  );
};

function RoleFilters({ onFilterChange, onSearch, filters: initialFilters }) {
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
            initialActiveFilters.push({ id: id, type: 'name' });
        }
        
        // Save to persistent store
        persistentFormStore.activeFilters = [...initialActiveFilters];
        
        return initialActiveFilters;
    });
    
    const [nextFilterId, setNextFilterId] = useState(() => {
        return persistentFormStore.activeFilters.length + 1;
    });
    
    // Store the last submitted filters to preserve values between renders
    const [lastSubmittedFilters, setLastSubmittedFilters] = useState(() => {
        return persistentFormStore.formValues.lastSubmitted || initialFilters || {};
    });
    
    // Use a form with persistence via our store
    const { control, handleSubmit, setValue, watch, reset } = useForm({
        defaultValues: (() => {
            // If we have stored form values, use them
            if (persistentFormStore.formValues.values) {
                return persistentFormStore.formValues.values;
            }
            
            // Otherwise initialize from props
            return {
                name: initialFilters?.name || '',
                description: initialFilters?.description || '',
                permissions: initialFilters?.permissions || []
            };
        })()
    });
    
    // Update filtersRef when filters prop changes - MOVED THIS AFTER useForm to fix reference error
    useEffect(() => {
        // Important: Track filter changes but don't overwrite values
        const oldFiltersJSON = JSON.stringify(prevFiltersRef.current || {});
        
        // Convert array initialFilters to object structure if needed
        const filtersObj = Array.isArray(initialFilters) 
            ? initialFilters.reduce((obj, filter) => {
                if (filter && filter.field && filter.value) {
                    obj[filter.field] = filter.value;
                }
                return obj;
              }, {})
            : initialFilters || {};
            
        const newFiltersJSON = JSON.stringify(filtersObj);
        
        if (oldFiltersJSON !== newFiltersJSON) {
            logInfo(`RoleFilters (${instanceIdRef.current}) - External filters changed:`, filtersObj);
            
            // Only update form values if we're not in the middle of submitting
            // This prevents filter values from being cleared during submission
            if (!isManualSubmitRef.current) {
                // Update form values for each filter type
                Object.keys(FILTER_TYPES).forEach(type => {
                    // Only update if the incoming filter has a value
                    if (filtersObj && filtersObj[type]) {
                        setValue(type, filtersObj[type]);
                    }
                });
                
                // Update active filters to match the new filters
                const updatedActiveFilters = [];
                let id = 1;
                
                // Add filters from the new filters prop
                if (filtersObj && typeof filtersObj === 'object') {
                    Object.entries(filtersObj).forEach(([field, value]) => {
                        if (FILTER_TYPES[field] && (
                            (typeof value === 'string' && value.trim() !== '') ||
                            (Array.isArray(value) && value.length > 0)
                        )) {
                            updatedActiveFilters.push({ id: id++, type: field });
                        }
                    });
                }
                
                // If no active filters, add a default one
                if (updatedActiveFilters.length === 0) {
                    updatedActiveFilters.push({ id: id, type: 'name' });
                }
                
                setActiveFilters(updatedActiveFilters);
                persistentFormStore.activeFilters = [...updatedActiveFilters];
                setNextFilterId(id + 1);
                
                // Update persistent store without overwriting existing values
                if (persistentFormStore.formValues.values) {
                    // Add/update new filter values from filtersObj
                    if (filtersObj && typeof filtersObj === 'object') {
                        Object.entries(filtersObj).forEach(([key, value]) => {
                            if (FILTER_TYPES[key] && value !== undefined && value !== null) {
                                persistentFormStore.formValues.values[key] = value;
                            }
                        });
                    }
                }
            }
            
            // Reset the manual submit flag after handling filter changes
            isManualSubmitRef.current = false;
            
            // Update previous filters reference
            prevFiltersRef.current = { ...(filtersObj || {}) };
        }
    }, [initialFilters, setValue]);
    
    // Synchronize persistent form store with current form values
    const formValues = watch();
    useEffect(() => {
        persistentFormStore.formValues.values = formValues;
    }, [formValues]);
    
    // Update active filters in persistent store whenever they change
    useEffect(() => {
        persistentFormStore.activeFilters = [...activeFilters];
    }, [activeFilters]);
    
    // Log relevant state for debugging
    useEffect(() => {
        logInfo(`RoleFilters (${instanceIdRef.current}) - Current filters:`, initialFilters);
        logInfo(`RoleFilters (${instanceIdRef.current}) - Form values:`, formValues);
        logInfo(`RoleFilters (${instanceIdRef.current}) - Active filters:`, activeFilters);
    }, [initialFilters, formValues, activeFilters]);
    
    // Add filter button handler
    const handleAddFilter = useCallback(() => {
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
        
        // Skip if the type hasn't changed
        if (oldType === newType) return;
        
        // 1. Update the filter type in the UI first - this ensures the UI doesn't flicker
        setActiveFilters(prevFilters => {
            const newFilters = prevFilters.map(f => 
                f.id === filterId ? { ...f, type: newType } : f
            );
            persistentFormStore.activeFilters = newFilters;
            return newFilters;
        });
        
        // 2. Reset the old filter value both in form and persistent store
        setValue(oldType, '');
        if (persistentFormStore.formValues.values) {
            persistentFormStore.formValues.values[oldType] = '';
        }
        
        // 3. Ensure the new filter type starts with empty value - but don't refresh yet
        setValue(newType, '');
        if (persistentFormStore.formValues.values) {
            persistentFormStore.formValues.values[newType] = '';
        }
        
        // 4. When there's only one filter active, just update the UI but don't trigger a search
        // This prevents the unwanted refresh when changing types with a single filter
        if (activeFilters.length === 1) {
            console.log('Only one filter active, updating UI without triggering search');
            
            // Just update the form references without triggering a search
            const updatedFilters = {};
            filtersRef.current = updatedFilters;
            prevFiltersRef.current = updatedFilters;
            persistentFormStore.formValues.lastSubmitted = updatedFilters;
            setLastSubmittedFilters(updatedFilters);
            
            return; // Exit early to avoid triggering a search
        }
        
        // 5. Create an updated filters object with all active filters EXCEPT the changed one
        const updatedFilters = {};
        
        // Keep only non-empty filters from the current form values
        activeFilters.forEach(f => {
            if (f.id !== filterId) {
                const filterType = f.type;
                const filterValue = formValues[filterType];
                
                if (filterValue && (
                    (typeof filterValue === 'string' && filterValue.toString().trim() !== '') ||
                    (Array.isArray(filterValue) && filterValue.length > 0)
                )) {
                    updatedFilters[filterType] = filterValue;
                }
            }
        });
        
        console.log('Filter type changed, updated filters object:', updatedFilters);
        
        // 6. Update all references
        filtersRef.current = updatedFilters;
        prevFiltersRef.current = updatedFilters;
        persistentFormStore.formValues.lastSubmitted = updatedFilters;
        setLastSubmittedFilters(updatedFilters);
        
        // 7. Trigger grid refresh with updated filters - only if we have active filters
        if (onFilterChange) {
            console.log('Applying filters in parent component:', updatedFilters);
            onFilterChange(updatedFilters);
        }
    }, [activeFilters, setValue, onFilterChange, formValues]);
    
    // Clear all filters handler
    const handleClearFilters = useCallback(() => {
        logInfo('Clearing all role filters');
        
        // Reset form values to empty
        reset({
            name: '',
            description: '',
            permissions: []
        });
        
        // Reset to default single filter
        const defaultFilter = { id: 1, type: 'name' };
        setActiveFilters([defaultFilter]);
        persistentFormStore.activeFilters = [defaultFilter];
        setNextFilterId(2);
        
        // Clear all filter references using empty object for form values
        const emptyFilters = {};
        persistentFormStore.formValues.lastSubmitted = emptyFilters;
        persistentFormStore.formValues.values = { name: '', description: '', permissions: [] };
        setLastSubmittedFilters(emptyFilters);
        prevFiltersRef.current = emptyFilters;
        filtersRef.current = emptyFilters;
        
        // Update parent component to immediately refresh the grid with empty filters object
        if (onFilterChange) {
            logInfo('Cleared all filters. Refreshing grid with empty filters object.');
            onFilterChange(emptyFilters);
        }
        
        // Call the search callback directly with empty filters to ensure refresh
        if (onSearch && onSearch !== onFilterChange) {
            logInfo('Calling search callback with empty filters object');
            onSearch(emptyFilters);
        }
    }, [onFilterChange, onSearch, reset]);
    
    // Submit form handler 
    const onSubmitFilters = useCallback((data) => {
        // Mark this as a manual submission to prevent filter resets
        isManualSubmitRef.current = true;
        
        // Create a clean copy of filters with only active filter types
        const activeFilterTypes = activeFilters.map(f => f.type);
        const cleanFilters = {};
        
        // Track which filters have values and which are empty
        const emptyFilters = [];
        
        // First identify which filters have values and which are empty
        activeFilterTypes.forEach(type => {
            const value = data[type];
            const isEmpty = 
                !value || 
                (typeof value === 'string' && value.trim() === '') || 
                (Array.isArray(value) && value.length === 0);
            
            if (!isEmpty) {
                // Special handling for permissions
                if (type === 'permissions' && Array.isArray(value)) {
                    // Make sure we have clean string values for permissions
                    const processedPermissions = value.map(perm => {
                        if (typeof perm === 'string') return perm;
                        if (typeof perm === 'object' && perm !== null) {
                            return perm.name || perm.id || String(perm);
                        }
                        return String(perm);
                    });
                    
                    // Only add if we have permissions
                    if (processedPermissions.length > 0) {
                        cleanFilters[type] = processedPermissions;
                        logInfo(`Processed ${processedPermissions.length} permissions for filter`, processedPermissions);
                    } else {
                        emptyFilters.push(type);
                    }
                } else {
                    cleanFilters[type] = value;
                }
            } else {
                emptyFilters.push(type);
            }
        });
        
        logInfo(`RoleFilters (${instanceIdRef.current}) - Submitting filters:`, cleanFilters);
        if (emptyFilters.length > 0) {
            logInfo(`Empty filters not included:`, emptyFilters);
        }
        
        // Save to persistent store for consistent state
        persistentFormStore.formValues.lastSubmitted = {...cleanFilters};
        setLastSubmittedFilters({...cleanFilters});
        prevFiltersRef.current = {...cleanFilters};
        filtersRef.current = {...cleanFilters};
        
        // Set empty values in the persistent store for fields that don't have values
        emptyFilters.forEach(type => {
            if (persistentFormStore.formValues.values) {
                persistentFormStore.formValues.values[type] = type === 'permissions' ? [] : '';
            }
        });
        
        // Update parent component with new filters - only pass the non-empty ones
        if (onFilterChange) {
            logInfo('Applying filters in parent component:', cleanFilters);
            onFilterChange({...cleanFilters});
        }
        
        // Call the search callback if provided
        if (onSearch && onSearch !== onFilterChange) {
            logInfo('Calling additional search callback');
            onSearch({...cleanFilters});
        }
    }, [activeFilters, onFilterChange, onSearch]);
    
    // Remove filter button handler
    const handleRemoveFilter = useCallback((filterId) => {
        console.log("Removing filter with ID:", filterId);
        
        // Find the filter to remove
        const filterToRemove = activeFilters.find(f => f.id === filterId);
        if (!filterToRemove) {
            console.warn("Filter not found with ID:", filterId);
            return;
        }
        
        const typeToRemove = filterToRemove.type;
        logInfo(`Removing filter: ${typeToRemove} (ID: ${filterId})`);
        
        // 1. First update UI state - remove the filter from active filters
        const newActiveFilters = activeFilters.filter(f => f.id !== filterId);
        logInfo(`Active filters after removal: ${JSON.stringify(newActiveFilters.map(f => ({ id: f.id, type: f.type })))}`);
        
        // Add default filter if needed
        if (newActiveFilters.length === 0) {
            const defaultFilter = { id: nextFilterId, type: 'name' };
            newActiveFilters.push(defaultFilter);
            setNextFilterId(nextFilterId + 1);
            logInfo(`Added default filter: ${JSON.stringify(defaultFilter)}`);
        }
        
        // Important: Update UI state immediately
        setActiveFilters(newActiveFilters);
        persistentFormStore.activeFilters = [...newActiveFilters];
        
        // 2. Clear the removed filter's value in form state
        const defaultValue = typeToRemove === 'permissions' ? [] : '';
        setValue(typeToRemove, defaultValue);
        
        // Also clear in persistent store
        if (persistentFormStore.formValues.values) {
            persistentFormStore.formValues.values[typeToRemove] = defaultValue;
        }
        
        logInfo(`Cleared form value for: ${typeToRemove}`);
        
        // 3. Create an updated filters object with current values (excluding the removed filter)
        const updatedFilters = {};
        
        // Get current form values
        const currentFormValues = watch();
        logInfo(`Current form values: ${JSON.stringify(currentFormValues)}`);
        
        // Only include filters from the remaining active filters
        newActiveFilters.forEach(filter => {
            const type = filter.type;
            const value = currentFormValues[type];
            
            // Only include non-empty values
            if (value !== undefined && value !== null && (
                (typeof value === 'string' && value.trim() !== '') ||
                (Array.isArray(value) && value.length > 0) ||
                (typeof value === 'number')
            )) {
                updatedFilters[type] = value;
                logInfo(`Keeping filter ${type} with value: ${Array.isArray(value) ? JSON.stringify(value) : value}`);
            }
        });
        
        logInfo(`Final updated filters object: ${JSON.stringify(updatedFilters)}`);
        
        // 4. Update all references with deep copies to avoid reference issues
        filtersRef.current = {...updatedFilters};
        prevFiltersRef.current = {...updatedFilters};
        persistentFormStore.formValues.lastSubmitted = {...updatedFilters};
        setLastSubmittedFilters({...updatedFilters});
        
        // 5. Apply the updated filters to the grid
        if (onFilterChange) {
            logInfo(`Sending updated filters to parent: ${JSON.stringify(updatedFilters)}`);
            onFilterChange({...updatedFilters});
        }
        
        if (onSearch && onSearch !== onFilterChange) {
            logInfo(`Calling additional search callback`);
            onSearch({...updatedFilters});
        }
        
    }, [activeFilters, setValue, onFilterChange, onSearch, nextFilterId, watch]);
    
    // Always use unique, explicit keys based on filters to force re-rendering
    const filterKey = activeFilters.map(f => `${f.id}-${f.type}`).join('_');
    const containerKey = `role-filters-container-${filterKey}`;
    const formKey = `role-filters-form-${filterKey}`;
    
    // Function to render active filters
    const renderActiveFilters = () => {
        // Get the types from activeFilters array
        const activeFilterTypes = activeFilters.map(filter => filter.type);
        
        if (activeFilterTypes.length === 0) {
            return null;
        }

        return (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ 
                    fontSize: '12px', 
                    fontWeight: 500,
                    mb: 0.5
                }}>
                    Active Filters:
                </Typography>
                {activeFilterTypes.map((filterType) => {
                    const filterConfig = FILTER_TYPES[filterType];
                    if (!filterConfig) return null;
                    
                    const value = formValues[filterType];
                    if (!value || (Array.isArray(value) && value.length === 0)) return null;
                    
                    return (
                        <Box key={filterType} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Box sx={{ 
                                minWidth: '100px', 
                                fontSize: '12px', 
                                fontWeight: 400, 
                                color: 'text.secondary',
                                pt: 0.25
                            }}>
                                {filterConfig.label}:
                            </Box>
                            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                                {filterType === 'permissions' ? (
                                    renderPermissionChips(value)
                                ) : (
                                    <Typography variant="body2" sx={{ wordBreak: 'break-word', fontSize: '12px' }}>
                                        {value}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
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
                                {renderFilterInput(filter.type, control, handleSubmit, onSubmitFilters)}
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
}

// Default export at the end of the file
export default RoleFilters;