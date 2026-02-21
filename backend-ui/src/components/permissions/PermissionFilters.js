import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Chip,
  Autocomplete,
  CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  ClearAll as ClearAllIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { logInfo, logError, logWarn } from '../../utils/logger';
import { alpha } from '@mui/material/styles';
import roleApi from '../../services/roleApi';

// Filter type definitions
const FILTER_TYPES = {
  name: {
    label: 'Permission Name',
    type: 'text',
    placeholder: 'Search by permission name (e.g., CREATE_USER)'
  },
  description: {
    label: 'Description',
    type: 'text',
    placeholder: 'Search by description'
  },
  roles: {
    label: 'Assigned Roles',
    type: 'autocomplete',
    placeholder: 'Search by assigned role'
  }
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
  
  if (filterConfig.type === 'autocomplete' && type === 'roles') {
    return (
      <RoleAutocomplete 
        control={control} 
        name={type} 
        label={filterConfig.label} 
        placeholder={filterConfig.placeholder} 
        handleSubmit={handleSubmit} 
        onSubmitFilters={onSubmitFilters} 
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

// Role autocomplete component for the roles filter
function RoleAutocomplete({ control, name, label, placeholder, handleSubmit, onSubmitFilters }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Fetch roles on component mount
  useEffect(() => {
    const fetchRoles = async () => {
      setLoading(true);
      setError(null);
      try {
        logInfo('Fetching roles for role filter');
        const response = await roleApi.getAllRoleNames();
        
        if (!response || !response.data) {
          throw new Error('Invalid response from role API');
        }
        
        // Check for errors returned from the API
        if (response.error) {
          logError('API returned error when fetching roles:', response.error);
          throw new Error(response.error);
        }
        
        // Check if we received an empty array, which could indicate a problem
        if (Array.isArray(response.data) && response.data.length === 0) {
          logWarn('API returned empty roles array');
          setRoles([]);
          setError('No roles found. The system may not have any roles configured.');
          setLoading(false);
          return;
        }
        
        // Process the response to get an array of role objects
        let rolesList = [];
        
        // Check if data is an array directly
        if (Array.isArray(response.data)) {
          rolesList = response.data;
        } 
        // Check if data contains items or results property
        else if (response.data.items && Array.isArray(response.data.items)) {
          rolesList = response.data.items;
        } 
        else if (response.data.results && Array.isArray(response.data.results)) {
          rolesList = response.data.results;
        }
        
        // Check if we have any roles after processing
        if (rolesList.length === 0) {
          logWarn('No roles found after processing API response');
          setError('No roles found in the system.');
          setRoles([]);
          setLoading(false);
          return;
        }
        
        // Make sure we have consistent role objects
        const processedRoles = rolesList.map(role => {
          // If role is already a string, use it directly
          if (typeof role === 'string') {
            return role;
          }
          
          // If role is an object, extract the name property
          if (typeof role === 'object' && role !== null) {
            // Preferred fields in order: name, code, id (converted to string)
            return role.name || role.code || String(role.id);
          }
          
          // Fallback for any other type
          return String(role);
        });
        
        setRoles(processedRoles);
        logInfo(`Successfully loaded ${processedRoles.length} roles for filter`, processedRoles);
      } catch (error) {
        logError('Failed to fetch roles for filter:', error);
        setError(`Failed to load roles: ${error.message || 'Unknown error'}`);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRoles();
  }, []);
  
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        // Ensure field value is always an array
        const selectedRoles = Array.isArray(field.value) 
          ? field.value 
          : field.value && typeof field.value === 'string' 
            ? [field.value] 
            : [];
        
        return (
          <>
            <Autocomplete
              multiple
              options={roles}
              getOptionLabel={(option) => {
                // Handle different option formats
                if (typeof option === 'string') return option;
                if (typeof option === 'object' && option !== null) {
                  return option.name || option.code || String(option.id || '');
                }
                return String(option || '');
              }}
              isOptionEqualToValue={(option, value) => {
                // Handle different comparison scenarios
                if (option === value) return true;
                
                // Handle object comparison
                if (typeof option === 'object' && typeof value === 'object') {
                  return (option.id && value.id && option.id === value.id) || 
                         (option.name && value.name && option.name === value.name);
                }
                
                // Handle string to object comparison
                if (typeof option === 'string' && typeof value === 'object') {
                  return option === value.name || option === value.code || option === String(value.id);
                }
                
                // Handle object to string comparison
                if (typeof option === 'object' && typeof value === 'string') {
                  return option.name === value || option.code === value || String(option.id) === value;
                }
                
                return false;
              }}
              loading={loading}
              value={selectedRoles}
              onChange={(event, newValue) => {
                try {
                  logInfo('Role selection changed:', newValue);
                  // Update the form field with selected roles
                  // Process roles to ensure we have consistent string values
                  const roleValues = newValue.map(role => {
                    if (typeof role === 'string') return role;
                    return role.name || role.code || String(role.id || '');
                  });
                  
                  field.onChange(roleValues);
                  logInfo('Updated role filter value:', roleValues);
                  
                  // Auto-submit after a short delay
                  setTimeout(() => {
                    handleSubmit(onSubmitFilters)();
                  }, 100);
                } catch (error) {
                  logError('Error updating role selection:', error);
                  setError('Failed to update role selection. Please try again.');
                }
              }}
              noOptionsText={error ? "Error loading roles" : "No roles found"}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={typeof option === 'string' ? option : option.name || String(option)}
                    size="small"
                    {...getTagProps({ index })}
                    sx={{ margin: '2px' }}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={label}
                  placeholder={placeholder}
                  fullWidth
                  size="small"
                  error={!!error}
                  helperText={error}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '4px',
                      minHeight: '40px',
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: error ? '#d32f2f' : '#1976d2',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: error ? '#d32f2f' : '#1976d2',
                        borderWidth: 1,
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '13px',
                      color: error ? '#d32f2f' : '#505050',
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                      transform: 'translate(14px, 11px) scale(1)',
                      '&.MuiInputLabel-shrink': {
                        transform: 'translate(14px, -6px) scale(0.75)',
                      },
                    },
                    '& .MuiChip-root': {
                      height: '24px',
                    },
                    '& .MuiFormHelperText-root': {
                      color: '#d32f2f',
                      marginLeft: 0,
                      marginTop: '4px',
                      fontSize: '11px',
                    }
                  }}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            {error && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                <Button 
                  size="small" 
                  onClick={() => {
                    setError(null);
                    const fetchRoles = async () => {
                      setLoading(true);
                      try {
                        logInfo('Retrying role fetch for filter');
                        const response = await roleApi.getAllRoleNames();
                        
                        if (!response || !response.data) {
                          throw new Error('Invalid response from role API');
                        }
                        
                        // Check for errors returned from the API
                        if (response.error) {
                          logError('API returned error when retrying roles fetch:', response.error);
                          throw new Error(response.error);
                        }
                        
                        // Check if we received an empty array, which could indicate a problem
                        if (Array.isArray(response.data) && response.data.length === 0) {
                          logWarn('API returned empty roles array on retry');
                          setRoles([]);
                          setError('No roles found. The system may not have any roles configured.');
                          return;
                        }
                        
                        // Process the response to get an array of role objects
                        let rolesList = [];
                        
                        // Check if data is an array directly
                        if (Array.isArray(response.data)) {
                          rolesList = response.data;
                        } 
                        // Check if data contains items or results property
                        else if (response.data.items && Array.isArray(response.data.items)) {
                          rolesList = response.data.items;
                        } 
                        else if (response.data.results && Array.isArray(response.data.results)) {
                          rolesList = response.data.results;
                        }
                        
                        // Check if we have any roles after processing
                        if (rolesList.length === 0) {
                          logWarn('No roles found after processing API response on retry');
                          setError('No roles found in the system.');
                          setRoles([]);
                          return;
                        }
                        
                        // Make sure we have consistent role objects
                        const processedRoles = rolesList.map(role => {
                          // If role is already a string, use it directly
                          if (typeof role === 'string') {
                            return role;
                          }
                          
                          // If role is an object, extract the name property
                          if (typeof role === 'object' && role !== null) {
                            // Preferred fields in order: name, code, id (converted to string)
                            return role.name || role.code || String(role.id);
                          }
                          
                          // Fallback for any other type
                          return String(role);
                        });
                        
                        setRoles(processedRoles);
                        logInfo(`Successfully loaded ${processedRoles.length} roles for filter on retry`, processedRoles);
                      } catch (error) {
                        logError('Failed to retry fetching roles:', error);
                        setError(`Failed to load roles: ${error.message || 'Unknown error'}`);
                        setRoles([]);
                      } finally {
                        setLoading(false);
                      }
                    };
                    fetchRoles();
                  }}
                  sx={{
                    fontSize: '11px',
                    textTransform: 'none',
                    p: 0,
                    minWidth: 'auto',
                    color: '#1976d2',
                  }}
                >
                  Retry
                </Button>
              </Box>
            )}
          </>
        );
      }}
    />
  );
}

function PermissionFilters({ 
    filters, // Current filter state from context
    onFiltersChange, // Function to update filter state in context
    onSearch // Search callback function
}) {
    const instanceIdRef = useRef(COMPONENT_INSTANCE_ID);
    const prevFiltersRef = useRef(filters || {});
    const isManualSubmitRef = useRef(false);
    const filtersRef = useRef(filters || {}); // Add the missing filtersRef
    
    // Debug log the incoming filters
    useEffect(() => {
        logInfo('PermissionFilters - Current filters:', filters);
    }, [filters]);
    
    // Initialize persistent state that survives component remounts
    const [activeFilters, setActiveFilters] = useState(() => {
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
    
    // Use a form with persistence via our store
    const { control, handleSubmit, setValue, watch, reset } = useForm({
        defaultValues: (() => {
            // If we have stored form values, use them
            if (persistentFormStore.formValues.values) {
                return persistentFormStore.formValues.values;
            }
            
            // Otherwise initialize from props
            return {
                name: filters?.name || '',
                description: filters?.description || '',
                roles: filters?.roles || []
            };
        })()
    });
    
    // Update filtersRef when filters prop changes - MOVED THIS AFTER useForm to fix reference error
    useEffect(() => {
        filtersRef.current = filters || {};
        
        // When filters prop changes externally, update the form
        if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)) {
            logInfo(`PermissionFilters (${instanceIdRef.current}) - External filters changed:`, filters);
            
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
                updatedActiveFilters.push({ id: id, type: 'name' });
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
    
    // Update active filters in persistent store whenever they change
    useEffect(() => {
        persistentFormStore.activeFilters = [...activeFilters];
    }, [activeFilters]);
    
    // Log relevant state for debugging
    useEffect(() => {
        logInfo(`PermissionFilters (${instanceIdRef.current}) - Current filters:`, filters);
        logInfo(`PermissionFilters (${instanceIdRef.current}) - Form values:`, formValues);
        logInfo(`PermissionFilters (${instanceIdRef.current}) - Active filters:`, activeFilters);
    }, [filters, formValues, activeFilters]);
    
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
        
        // 1. Reset the old filter value both in form and persistent store
        setValue(oldType, '');
        if (persistentFormStore.formValues.values) {
            persistentFormStore.formValues.values[oldType] = '';
        }
        
        // 2. Ensure the new filter type starts with empty value
        setValue(newType, '');
        if (persistentFormStore.formValues.values) {
            persistentFormStore.formValues.values[newType] = '';
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
            if (!updatedFilters[key] || updatedFilters[key].toString().trim() === '') {
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
    
    // Clear all filters handler
    const handleClearFilters = useCallback(() => {
        logInfo('Clearing all permission filters');
        
        // Reset form values to empty, ensuring roles is an empty array
        reset({
            name: '',
            description: '',
            roles: []
        });
        
        // Reset to default single filter
        const defaultFilter = { id: 1, type: 'name' };
        setActiveFilters([defaultFilter]);
        persistentFormStore.activeFilters = [defaultFilter];
        setNextFilterId(2);
        
        // Clear all filter references
        const emptyFilters = {
            roles: [] // Initialize with empty array for roles
        };
        persistentFormStore.formValues.lastSubmitted = emptyFilters;
        
        // Ensure values object has the correct empty types for each filter type
        persistentFormStore.formValues.values = { 
            name: '', 
            description: '', 
            roles: [] // Roles is an array type, so use empty array
        };
        
        setLastSubmittedFilters(emptyFilters);
        prevFiltersRef.current = emptyFilters;
        filtersRef.current = emptyFilters;
        
        // Update parent component to immediately refresh the grid with no filters
        if (onFiltersChange) {
            logInfo('Cleared all filters. Refreshing grid with no filters.');
            onFiltersChange(emptyFilters);
        }
        
        // Call the search callback directly with empty filters to ensure refresh
        if (onSearch && onSearch !== onFiltersChange) {
            logInfo('Calling search callback with empty filters');
            onSearch(emptyFilters);
        }
    }, [onFiltersChange, onSearch, reset]);
    
    // Remove filter button handler
    const handleRemoveFilter = useCallback((filterId) => {
        try {
            // Find the filter that's being removed
            const removedFilter = activeFilters.find(f => f.id === filterId);
            if (!removedFilter) {
                logError("Filter not found with ID:", filterId);
                return;
            }
            
            const removedType = removedFilter.type;
            logInfo(`Removing filter with ID ${filterId}, type ${removedType}`);
            
            // Create a new object directly from current filters prop
            // This ensures we're working with the most up-to-date filter values
            const currentFilters = { ...filters };
            
            // Remove the specific filter type
            delete currentFilters[removedType];
            
            // Reset the form value
            if (removedType === 'roles') {
                setValue(removedType, []);
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
                    removedType === 'roles' ? [] : '';
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
            logError("Error removing filter:", error);
        }
    }, [activeFilters, filters, nextFilterId, onFiltersChange, onSearch, setValue]);
    
    // Submit form handler 
    const onSubmitFilters = useCallback((data) => {
        // Mark this as a manual submission
        isManualSubmitRef.current = true;
        
        // Create a clean copy of filters with only active filter types
        const activeFilterTypes = activeFilters.map(f => f.type);
        const cleanFilters = {};
        
        // Track which filters have values and which are empty
        const emptyFilters = [];
        
        // First identify which filters have values and which are empty
        activeFilterTypes.forEach(type => {
            const value = data[type];
            
            // Handle array values (like from roles autocomplete)
            if (Array.isArray(value)) {
                // Only include non-empty arrays
                if (value.length > 0) {
                    cleanFilters[type] = value;
                    logInfo(`Array filter ${type} has ${value.length} values:`, value);
                } else {
                    emptyFilters.push(type);
                }
            } 
            // Handle regular string values
            else if (value && value.toString().trim() !== '') {
                cleanFilters[type] = value;
            } else {
                emptyFilters.push(type);
            }
        });
        
        logInfo(`PermissionFilters (${instanceIdRef.current}) - Submitting filters:`, cleanFilters);
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
                // Use empty array for array types like roles
                if (type === 'roles') {
                    persistentFormStore.formValues.values[type] = [];
                } else {
                    persistentFormStore.formValues.values[type] = '';
                }
            }
        });
        
        // Update parent component with new filters - only pass the non-empty ones
        if (onFiltersChange) {
            logInfo('Applying filters in parent component:', cleanFilters);
            onFiltersChange({...cleanFilters});
        }
        
        // Call the search callback if provided (this ensures immediate search)
        if (onSearch) {
            logInfo('Calling search callback with active filters:', cleanFilters);
            onSearch({...cleanFilters});
        }
    }, [activeFilters, onFiltersChange, onSearch]);
    
    // Always use unique, explicit keys based on filters to force re-rendering
    const filterKey = activeFilters.map(f => `${f.id}-${f.type}`).join('_');
    const containerKey = `permission-filters-container-${filterKey}`;
    const formKey = `permission-filters-form-${filterKey}`;
    
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
            <form 
                key={formKey} 
                onSubmit={handleSubmit(onSubmitFilters)}
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

// Use React.memo with a proper implementation
export default React.memo(PermissionFilters);

// Note: By removing the custom comparison function, we're allowing React to use the default shallow comparison,
// which will properly trigger re-renders when props change. This is simpler and more reliable.