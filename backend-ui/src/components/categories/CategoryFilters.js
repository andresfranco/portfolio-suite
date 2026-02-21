import React, { useState, useEffect, useMemo } from 'react';
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
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  AddCircleOutline as AddFilterIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  ClearAll as ClearAllIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useCategoryType } from '../../contexts/CategoryTypeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCategory } from '../../contexts/CategoryContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { logInfo, logError } from '../../utils/logger';
import { alpha } from '@mui/material/styles';
import { FILTERS_PANEL_MB } from '../common/layoutTokens';
import { evaluateFilterAccess } from '../../utils/accessControl';

// Filter type definitions
const FILTER_TYPES = {
  code: {
    label: 'Code',
    type: 'text'
  },
  type_code: {
    label: 'Type',
    type: 'select'
  },
  language_id: {
    label: 'Languages',
    type: 'multiselect'
  },
  name: {
    label: 'Name',
    type: 'text'
  }
};

function CategoryFilters({ onFiltersChange, onSearch }) {
  const { filters } = useCategory();
  const { categoryTypes, loading: categoryTypesLoading } = useCategoryType();
  const { languages, loading: languagesLoading, fetchLanguages } = useLanguage();
  const { isSystemAdmin, hasPermission, hasAnyPermission } = useAuthorization();
  
  const [languageSearchText, setLanguageSearchText] = useState('');
  
  const [activeFilters, setActiveFilters] = useState(() => {
    const initialFilters = [];
    let id = 1;
    
    // Create active filters for each filter in the filters array
    if (filters && Array.isArray(filters)) {
      const uniqueFields = [...new Set(filters.map(f => f.field))];
      uniqueFields.forEach(field => {
        if (FILTER_TYPES[field]) {
          initialFilters.push({ id: id++, type: field });
        }
      });
    }
    
    // If no filters were created, add a default one
    if (initialFilters.length === 0) {
      initialFilters.push({ id: id, type: 'code' });
    }
    
    return initialFilters;
  });
  
  const [nextFilterId, setNextFilterId] = useState(() => {
    // Initialize nextFilterId based on the number of active filters
    return activeFilters.length + 1;
  });
  
  const [tempFilters, setTempFilters] = useState(() => {
    // Convert filter array back to object format for UI state
    const filterObj = {};
    if (filters && Array.isArray(filters)) {
      filters.forEach(filter => {
        if (filter.field && filter.value !== undefined) {
          if (filter.field === 'language_id') {
            // For language_id, collect all values into an array
            if (!filterObj[filter.field]) {
              filterObj[filter.field] = [];
            }
            filterObj[filter.field].push(filter.value.toString());
          } else {
            // For other fields, use the value directly
            filterObj[filter.field] = filter.value;
          }
        }
      });
    }
    return filterObj;
  });

  // Build access notices per filter type
  const FILTER_ACCESS_MAP = useMemo(() => ({
    code: { required: 'VIEW_CATEGORIES', moduleKey: 'categories' },
    type_code: { required: 'VIEW_CATEGORY_TYPES', moduleKey: 'categorytypes' },
    language_id: { required: 'VIEW_LANGUAGES', moduleKey: 'languages' },
    name: { required: 'VIEW_CATEGORIES', moduleKey: 'categories' }
  }), []);
  const { noticesByType } = useMemo(() => {
    const authorization = { isSystemAdmin, hasPermission, hasAnyPermission };
    return evaluateFilterAccess(Object.keys(FILTER_TYPES), FILTER_ACCESS_MAP, authorization);
  }, [isSystemAdmin, hasPermission, hasAnyPermission]);

  // Add state to track when user explicitly removes a filter
  const [removingFilter, setRemovingFilter] = useState(null);

  // Fetch languages when component mounts (only if not already loaded)
  useEffect(() => {
    // Only fetch if languages array is empty/undefined and not currently loading
    if (!languagesLoading && (!languages || languages.length === 0)) {
      logInfo('CategoryFilters', 'Languages not available, fetching for filters');
      fetchLanguages(1, 100, {}).then(() => {
        logInfo('CategoryFilters', 'Languages fetched successfully for filters');
      }).catch(error => {
        logError('CategoryFilters', 'Error fetching languages for filters:', error);
      });
    } else if (languages && languages.length > 0) {
      logInfo('CategoryFilters', `Languages already available (${languages.length} languages), skipping fetch`);
    } else if (languagesLoading) {
      logInfo('CategoryFilters', 'Languages are currently loading, skipping fetch');
    }
  }, []); // Empty dependency array - only run once on mount

  // Update tempFilters when filters prop changes
  useEffect(() => {
    // Convert filter array back to object format for UI state
    const filterObj = {};
    let hasNameWithLanguage = false;
    
    if (filters && Array.isArray(filters)) {
      // Check if we have name filters with language_id (indicating combined name+language filtering)
      const nameFiltersWithLanguage = filters.filter(f => f.field === 'name' && f.language_id);
      if (nameFiltersWithLanguage.length > 0) {
        hasNameWithLanguage = true;
        
        // Extract language IDs from name filters to preserve language filter UI
        // BUT only if we're not explicitly removing the language filter
        const languageIds = [...new Set(nameFiltersWithLanguage.map(f => f.language_id.toString()))];
        if (languageIds.length > 0 && removingFilter !== 'language_id') {
          filterObj['language_id'] = languageIds;
          logInfo('CategoryFilters', 'Preserving language filter UI state from name filters:', languageIds);
        } else if (removingFilter === 'language_id') {
          logInfo('CategoryFilters', 'User is removing language filter - not preserving UI state');
        }
        
        // Use the first name filter's value for the name field UI
        filterObj['name'] = nameFiltersWithLanguage[0].value;
      }
      
      // Process all other filters normally
      filters.forEach(filter => {
        if (filter.field && filter.value !== undefined) {
          // Skip name filters if we already processed them above
          if (filter.field === 'name' && hasNameWithLanguage) {
            return; // Already handled above
          }
          
          // Skip language_id if we're removing it
          if (filter.field === 'language_id' && removingFilter === 'language_id') {
            return; // Don't add back the filter being removed
          }
          
          if (filter.field === 'language_id') {
            // For language_id, collect all values into an array (if not already handled above)
            if (!hasNameWithLanguage) {
              if (!filterObj[filter.field]) {
                filterObj[filter.field] = [];
              }
              filterObj[filter.field].push(filter.value.toString());
            }
          } else {
            // For other fields, use the value directly
            filterObj[filter.field] = filter.value;
          }
        }
      });
    }
    
    setTempFilters(filterObj);
    
    // Also update activeFilters when filters change
    const updatedActiveFilters = [];
    let id = 1;
    
    if (filters && Array.isArray(filters)) {
      // Get unique fields from filters, but ensure we include language_id if it was preserved
      const uniqueFields = [...new Set(filters.map(f => f.field))];
      if (hasNameWithLanguage && !uniqueFields.includes('language_id') && removingFilter !== 'language_id') {
        uniqueFields.push('language_id');
      }
      
      // Filter out the field being removed
      const fieldsToShow = uniqueFields.filter(field => field !== removingFilter);
      
      fieldsToShow.forEach(field => {
        if (FILTER_TYPES[field]) {
          updatedActiveFilters.push({ id: id++, type: field });
        }
      });
    }
    
    // If no filters were created, add a default one
    if (updatedActiveFilters.length === 0) {
      updatedActiveFilters.push({ id: id, type: 'code' });
    }
    
    setActiveFilters(updatedActiveFilters);
    setNextFilterId(id + 1);
    
    // Clear the removing filter flag after processing
    if (removingFilter) {
      setRemovingFilter(null);
    }
  }, [filters, removingFilter]);

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
      // Set the flag to indicate we're removing this filter type
      setRemovingFilter(removedFilter.type);
      logInfo('CategoryFilters', `User explicitly removing filter: ${removedFilter.type}`);
    }
    
    const updatedActiveFilters = activeFilters.filter(f => f.id !== filterId);
    
    setActiveFilters(updatedActiveFilters);
    
    if (removedFilter) {
      const updatedFilterValues = { ...tempFilters };
      delete updatedFilterValues[removedFilter.type];
      setTempFilters(updatedFilterValues);
      
      // Automatically trigger search with remaining filters
      // Create filter array format expected by backend using the updated state
      const filterArray = [];
      
      // Track if we have language and name filters in remaining filters
      let selectedLanguageIds = [];
      let nameFilterValue = null;
      
      // First pass: collect language and name filter values from remaining filters
      updatedActiveFilters.forEach(filter => {
        const filterValue = updatedFilterValues[filter.type];
        
        if (filter.type === 'language_id' && Array.isArray(filterValue) && filterValue.length > 0) {
          selectedLanguageIds = filterValue.map(id => parseInt(id));
        } else if (filter.type === 'name' && filterValue && typeof filterValue === 'string' && filterValue.trim() !== '') {
          nameFilterValue = filterValue.trim();
        }
      });
      
      // Process each remaining active filter
      updatedActiveFilters.forEach(filter => {
        const filterValue = updatedFilterValues[filter.type];
        
        // Only add filters with non-empty values
        if (filterValue !== undefined && filterValue !== null) {
          if (filter.type === 'name' && nameFilterValue) {
            // Special handling for name filter when combined with languages
            if (selectedLanguageIds.length > 0) {
              // Name filter with selected languages - filter by name within those languages
              selectedLanguageIds.forEach(languageId => {
                filterArray.push({
                  field: 'name',
                  value: nameFilterValue,
                  operator: 'contains',
                  language_id: languageId
                });
              });
            } else {
              // Name filter without language selection - use default language
              const defaultLanguage = languages && languages.find(lang => lang.is_default);
              if (defaultLanguage) {
                filterArray.push({
                  field: 'name',
                  value: nameFilterValue,
                  operator: 'contains',
                  language_id: defaultLanguage.id
                });
              } else {
                // No default language found, use regular name filter
                filterArray.push({
                  field: 'name',
                  value: nameFilterValue,
                  operator: 'contains'
                });
              }
            }
          } else if (filter.type === 'language_id') {
            // Language filter - only add if we don't have a name filter (since name filter handles this)
            if (!nameFilterValue && Array.isArray(filterValue) && filterValue.length > 0) {
              filterValue.forEach(value => {
                filterArray.push({
                  field: filter.type,
                  value: parseInt(value),
                  operator: 'eq'
                });
              });
            }
          } else if (Array.isArray(filterValue)) {
            // Other multiselect filters
            if (filterValue.length > 0) {
              filterValue.forEach(value => {
                filterArray.push({
                  field: filter.type,
                  value: parseInt(value),
                  operator: 'eq'
                });
              });
            }
          } else if (typeof filterValue === 'string' && filterValue.trim() !== '') {
            // Text filters (excluding name which was handled above)
            if (filter.type !== 'name') {
              filterArray.push({
                field: filter.type,
                value: filterValue.trim(),
                operator: 'contains'
              });
            }
          } else if (filterValue !== '') {
            // Other non-string values
            filterArray.push({
              field: filter.type,
              value: filterValue,
              operator: filter.type === 'type_code' ? 'eq' : 'contains'
            });
          }
        }
      });
      
      logInfo('CategoryFilters', 'Auto-searching after filter removal', { 
        removedFilter: removedFilter.type, 
        remainingFilters: filterArray,
        selectedLanguageIds,
        nameFilterValue
      });
      
      // Update parent component with new filters
      if (onFiltersChange) {
        onFiltersChange(filterArray);
      }
      
      // Trigger search with remaining filters
      if (onSearch) {
        onSearch(filterArray);
      }
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
    
    // Clear the old filter value and initialize the new one with an empty value
    if (oldType) {
      const updatedFilterValues = { ...tempFilters };
      delete updatedFilterValues[oldType];
      
      // Initialize the new filter type with an appropriate empty value
      const filterConfig = FILTER_TYPES[newType];
      if (filterConfig) {
        if (filterConfig.type === 'multiselect') {
          updatedFilterValues[newType] = [];
        } else {
          updatedFilterValues[newType] = '';
        }
      }
      
      setTempFilters(updatedFilterValues);
    }
  };

  const handleSearch = () => {
    // Create filter array format expected by backend
    const filterArray = [];
    
    // Track if we have language and name filters
    let selectedLanguageIds = [];
    let nameFilterValue = null;
    
    // Log the current state for debugging
    logInfo('CategoryFilters', 'Starting search with current state', {
      activeFilters: activeFilters.map(f => ({ id: f.id, type: f.type })),
      tempFilters,
      languagesAvailable: languages?.length || 0,
      languagesLoading,
      defaultLanguage: languages?.find(lang => lang.is_default)
    });
    
    // First pass: collect language and name filter values
    activeFilters.forEach(filter => {
      const filterValue = tempFilters[filter.type];
      
      if (filter.type === 'language_id' && Array.isArray(filterValue) && filterValue.length > 0) {
        selectedLanguageIds = filterValue.map(id => parseInt(id));
      } else if (filter.type === 'name' && filterValue && typeof filterValue === 'string' && filterValue.trim() !== '') {
        nameFilterValue = filterValue.trim();
      }
    });
    
    logInfo('CategoryFilters', 'Collected filter values', {
      selectedLanguageIds,
      nameFilterValue
    });
    
    // Process each active filter
    activeFilters.forEach(filter => {
      const filterValue = tempFilters[filter.type];
      
      // Only add filters with non-empty values
      if (filterValue !== undefined && filterValue !== null) {
        if (filter.type === 'name' && nameFilterValue) {
          // Special handling for name filter when combined with languages
          if (selectedLanguageIds.length > 0) {
            // Name filter with selected languages - filter by name within those languages
            selectedLanguageIds.forEach(languageId => {
              filterArray.push({
                field: 'name',
                value: nameFilterValue,
                operator: 'contains',
                language_id: languageId // Add language context to the name filter
              });
              logInfo('CategoryFilters', `Added name filter for language ${languageId}:`, nameFilterValue);
            });
          } else {
            // Name filter without language selection - try to use default language
            const defaultLanguage = languages && languages.find(lang => lang.is_default);
            
            if (defaultLanguage) {
              filterArray.push({
                field: 'name',
                value: nameFilterValue,
                operator: 'contains',
                language_id: defaultLanguage.id // Filter by name in default language
              });
              logInfo('CategoryFilters', `Added name filter for default language ${defaultLanguage.id} (${defaultLanguage.name}):`, nameFilterValue);
            } else {
              // No default language found or no languages loaded
              if (!languages || languages.length === 0) {
                logError('CategoryFilters', 'No languages available for name filtering. Adding name filter without language_id');
              } else {
                logError('CategoryFilters', 'No default language found. Adding name filter without language_id');
              }
              
              // Use regular name filter without language constraint
              filterArray.push({
                field: 'name',
                value: nameFilterValue,
                operator: 'contains'
              });
              logInfo('CategoryFilters', 'Added name filter without language constraint:', nameFilterValue);
            }
          }
        } else if (filter.type === 'language_id') {
          // Language filter - only add if we don't have a name filter (since name filter handles this)
          if (!nameFilterValue && Array.isArray(filterValue) && filterValue.length > 0) {
            filterValue.forEach(value => {
              filterArray.push({
                field: filter.type,
                value: parseInt(value),
                operator: 'eq'
              });
            });
          }
        } else if (Array.isArray(filterValue)) {
          // Other multiselect filters
          if (filterValue.length > 0) {
            filterValue.forEach(value => {
              filterArray.push({
                field: filter.type,
                value: parseInt(value),
                operator: 'eq'
              });
            });
          }
        } else if (typeof filterValue === 'string' && filterValue.trim() !== '') {
          // Text filters (excluding name which was handled above)
          if (filter.type !== 'name') {
            filterArray.push({
              field: filter.type,
              value: filterValue.trim(),
              operator: 'contains'
            });
          }
        } else if (filterValue !== '') {
          // Other non-string values
          filterArray.push({
            field: filter.type,
            value: filterValue,
            operator: filter.type === 'type_code' ? 'eq' : 'contains'
          });
        }
      }
    });
    
    logInfo('CategoryFilters', 'Final filter array for search', { 
      filterArray,
      selectedLanguageIds,
      nameFilterValue,
      hasDefaultLanguage: languages && languages.some(lang => lang.is_default),
      totalFilters: filterArray.length
    });
    
    // Update parent component with new filters - pass the array directly
    if (onFiltersChange) {
      onFiltersChange(filterArray);
    }
    
    // Trigger search
    if (onSearch) {
      onSearch(filterArray);
    }
  };

  const handleClearFilters = () => {
    // Reset to a single default filter
    setActiveFilters([{ id: 1, type: 'code' }]);
    setTempFilters({});
    setNextFilterId(2);
    
    // Notify parent components with empty filter array
    if (onFiltersChange) {
      onFiltersChange([]);
    }
    
    if (onSearch) {
      onSearch([]);
    }
  };

  // Render filter input based on filter type
  const renderFilterInput = (filter) => {
    if (!filter || !filter.type) return null;
    
    const filterConfig = FILTER_TYPES[filter.type];
    if (!filterConfig) return null;
    
    const filterValue = tempFilters[filter.type] !== undefined ? tempFilters[filter.type] : '';
    const access = noticesByType?.[filter.type];
    const denied = !!access?.isDenied;
    const helper = access?.message;
    
    switch (filterConfig.type) {
      case 'select':
        return (
          <FormControl sx={{ flex: 1 }} error={denied}>
            <InputLabel>Select {filterConfig.label}</InputLabel>
            <Select
              value={filterValue}
              onChange={(e) => handleFilterChange(filter.id, e.target.value)}
              label={`Select ${filterConfig.label}`}
              disabled={denied || (filter.type === 'type_code' && categoryTypesLoading)}
              endAdornment={
                filter.type === 'type_code' && categoryTypesLoading ? (
                  <CircularProgress size={20} sx={{ mr: 2 }} />
                ) : null
              }
              sx={{
                height: '40px',
                '& .MuiOutlinedInput-input': {
                  fontSize: '13px',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  color: '#505050',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2',
                  borderWidth: 1,
                },
              }}
            >
              <MenuItem value="">
                <em>Any</em>
              </MenuItem>
              {filter.type === 'type_code' && categoryTypes && categoryTypes.length > 0 ? (
                categoryTypes.map((type) => (
                  <MenuItem key={type.code} value={type.code}>
                    {type.name}
                  </MenuItem>
                ))
              ) : (
                filter.type === 'type_code' && !categoryTypesLoading && (
                  <MenuItem disabled>No category types available</MenuItem>
                )
              )}
            </Select>
            {denied && helper && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {helper}
              </Typography>
            )}
          </FormControl>
        );
      
      case 'multiselect':
        // Filter languages based on search text
        const filteredLanguages = languages ? languages.filter(language => 
          language.name.toLowerCase().includes(languageSearchText.toLowerCase()) ||
          language.code.toLowerCase().includes(languageSearchText.toLowerCase())
        ) : [];
        
        return (
          <FormControl sx={{ flex: 1 }} error={denied}>
            <InputLabel sx={{
              fontSize: '13px',
              color: '#505050',
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            }}>
              Select Languages
            </InputLabel>
            <Select
              multiple
              value={Array.isArray(filterValue) ? filterValue : []}
              onChange={(e) => handleFilterChange(filter.id, e.target.value)}
              input={<OutlinedInput label="Select Languages" />}
              disabled={denied || languagesLoading}
              renderValue={(selected) => (
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {selected.map((value) => {
                    const language = languages && languages.find(lang => lang.id === parseInt(value));
                    return (
                      <Chip
                        key={value}
                        label={language ? `${language.name} (${language.code})` : value}
                        size="small"
                        sx={{ 
                          m: 0.25,
                          height: '20px',
                          fontSize: '11px',
                          '& .MuiChip-label': {
                            padding: '0 6px'
                          }
                        }}
                      />
                    );
                  })}
                </Stack>
              )}
              onOpen={() => setLanguageSearchText('')} // Reset search when opening
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 300,
                    '& .MuiMenuItem-root': {
                      fontSize: '13px',
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    }
                  }
                }
              }}
              sx={{
                height: '40px', // Match filter type select box height
                '& .MuiOutlinedInput-input': {
                  fontSize: '13px',
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  color: '#505050',
                  padding: '8px 14px !important'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2',
                  borderWidth: 1,
                },
                '& .MuiSelect-select': {
                  minHeight: 'unset !important',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center'
                }
              }}
            >
              {/* Search input inside the dropdown */}
              <MenuItem disabled sx={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                <TextField
                  placeholder="Search languages..."
                  value={languageSearchText}
                  onChange={(e) => {
                    e.stopPropagation();
                    setLanguageSearchText(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  size="small"
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: '32px',
                      fontSize: '12px'
                    }
                  }}
                />
              </MenuItem>
              
              {languagesLoading ? (
                <MenuItem disabled>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    Loading languages...
                  </Box>
                </MenuItem>
              ) : filteredLanguages.length > 0 ? (
                filteredLanguages.map((language) => (
                  <MenuItem key={language.id} value={language.id.toString()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Typography variant="body2">
                        {`${language.name} (${language.code})`}
                        {language.is_default && (
                          <Chip
                            label="Default"
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ ml: 1, height: '16px', fontSize: '9px' }}
                          />
                        )}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled>
                  {languageSearchText ? 'No languages found' : 'No languages available'}
                </MenuItem>
              )}
            </Select>
            {denied && helper && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {helper}
              </Typography>
            )}
          </FormControl>
        );
      
      case 'text':
      default:
        return (
          <TextField
            fullWidth
            label={filterConfig.label}
            value={filterValue}
            onChange={(e) => handleFilterChange(filter.id, e.target.value)}
            disabled={denied}
            error={denied}
            helperText={denied ? helper : undefined}
            sx={{ 
              flex: 1,
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
  mb: FILTERS_PANEL_MB,
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
            <FormControl sx={{ width: 150 }}>
              <InputLabel sx={{
                fontSize: '13px',
                color: '#505050',
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              }}>
                Filter Type
              </InputLabel>
              <Select
                value={filter.type}
                onChange={(e) => handleFilterTypeChange(filter.id, e.target.value)}
                label="Filter Type"
                sx={{
                  height: '40px',
                  '& .MuiOutlinedInput-input': {
                    fontSize: '13px',
                    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                    color: '#505050',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1976d2',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1976d2',
                    borderWidth: 1,
                  },
                }}
              >
                {Object.entries(FILTER_TYPES).map(([key, value]) => (
                  <MenuItem
                    key={key}
                    value={key}
                    disabled={activeFilters.some(f => f.id !== filter.id && f.type === key)}
                    sx={{ fontSize: '13px' }}
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
      disabled={activeFilters.some((f) => noticesByType?.[f.type]?.isDenied)}
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

export default CategoryFilters;
