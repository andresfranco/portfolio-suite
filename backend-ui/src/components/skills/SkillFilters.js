import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
  IconButton,
  Select,
  MenuItem,
  TextField,
  Autocomplete,
  Chip,
  Stack,
  Divider,
  FormControl,
  InputLabel,
  Tooltip,
  OutlinedInput,
  CircularProgress,
  FormHelperText
} from '@mui/material';
import { FILTERS_PANEL_MB } from '../common/layoutTokens';
import {
  Add as AddIcon,
  ClearAll as ClearAllIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useSkill } from '../../contexts/SkillContext';
import { useSkillType } from '../../contexts/SkillTypeContext';
import { useCategory } from '../../contexts/CategoryContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { logInfo, logError } from '../../utils/logger';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { evaluateFilterAccess } from '../../utils/accessControl';
import { MODULE_DISPLAY_NAMES } from '../../utils/permissionMessages';

// Helper function to get category display name from default language
const getCategoryDisplayName = (category) => {
  if (!category.category_texts || category.category_texts.length === 0) {
    return category.code || `Category ${category.id}`;
  }
  
  // Find text in default language first
  const defaultText = category.category_texts.find(text => 
    text.language && text.language.is_default
  );
  
  if (defaultText && defaultText.name) {
    return defaultText.name;
  }
  
  // Fallback to first available text
  const firstText = category.category_texts[0];
  return firstText?.name || category.code || `Category ${category.id}`;
};

// Define available filter types
const FILTER_TYPES = {
  type_code: { 
    label: 'Skill Type', 
    type: 'select',
    getOptions: (skillTypes) => {
      return skillTypes.map(type => ({ value: type.code, label: type.name || type.code }));
    }
  },
  category: { 
    label: 'Category', 
    type: 'select',
    getOptions: (categories) => {
      // Only include categories whose type equals 'Skill'
      const allowedTypeCodes = ['SKILL', 'SKL'];
      const filtered = (categories || []).filter(cat => {
        if (!cat) return false;
        const typeName = cat.category_type?.name || cat.category_type?.Name || '';
        if (typeName && typeof typeName === 'string' && typeName.toLowerCase() === 'skill') {
          return true;
        }
        if (cat.type_code && allowedTypeCodes.includes(String(cat.type_code).toUpperCase())) {
          return true;
        }
        return false;
      });
      return filtered.map(cat => ({ 
        value: cat.id, 
        label: getCategoryDisplayName(cat)
      }));
    }
  },
  language_id: { 
    label: 'Language', 
    type: 'autocomplete',
    getOptions: (languages) => {
      return languages.map(lang => ({ value: lang.id, label: lang.name }));
    }
  },
  name: { label: 'Skill Name', type: 'text' }
};

function SkillFilters({ onFiltersChange, onSearch }) {
  const { filters } = useSkill();
  const { skillTypes, loading: skillTypesLoading, error: skillTypesError } = useSkillType();
  const { categories, loading: categoriesLoading, error: categoriesError } = useCategory();
  const { languages, loading: languagesLoading, error: languagesError, fetchLanguages } = useLanguage();
  const { isSystemAdmin, hasPermission, hasAnyPermission } = useAuthorization();
  
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
      initialFilters.push({ id: id, type: 'name' });
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

  // Add state to track when user explicitly removes a filter
  const [removingFilter, setRemovingFilter] = useState(null);

  // Reusable filter access mapping for this module
  const FILTER_ACCESS_MAP = useMemo(() => ({
    type_code: { required: 'VIEW_SKILL_TYPES', moduleKey: 'skilltypes' },
    category: { required: 'VIEW_CATEGORIES', moduleKey: 'categories' },
    language_id: { required: 'VIEW_LANGUAGES', moduleKey: 'languages' },
    name: { required: null, moduleKey: 'skills' }
  }), []);

  // Compute access notices per filter type and whether any active filter is denied
  const { noticesByType, hasDeniedActive } = useMemo(() => {
    const activeTypes = (activeFilters || []).map(f => f.type);
    const authorization = { isSystemAdmin, hasPermission, hasAnyPermission };
    const contextErrors = {
      type_code: skillTypesError,
      category: categoriesError,
      language_id: languagesError,
      name: null
    };
    return evaluateFilterAccess(activeTypes, FILTER_ACCESS_MAP, authorization, contextErrors);
  }, [activeFilters, isSystemAdmin, hasPermission, hasAnyPermission, skillTypesError, categoriesError, languagesError]);

  // Fetch languages when component mounts (only if not already loaded)
  useEffect(() => {
    // Only fetch if languages array is empty/undefined and not currently loading
    if (!languagesLoading && (!languages || languages.length === 0)) {
      logInfo('SkillFilters', 'Languages not available, fetching for filters');
      fetchLanguages(1, 100, {}).then(() => {
        logInfo('SkillFilters', 'Languages fetched successfully for filters');
      }).catch(error => {
        logError('SkillFilters', 'Error fetching languages for filters:', error);
      });
    } else if (languages && languages.length > 0) {
      logInfo('SkillFilters', `Languages already available (${languages.length} languages), skipping fetch`);
    } else if (languagesLoading) {
      logInfo('SkillFilters', 'Languages are currently loading, skipping fetch');
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
          logInfo('SkillFilters', 'Preserving language filter UI state from name filters:', languageIds);
        } else if (removingFilter === 'language_id') {
          logInfo('SkillFilters', 'User is removing language filter - not preserving UI state');
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
      updatedActiveFilters.push({ id: id, type: 'name' });
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
      logInfo('SkillFilters', `User explicitly removing filter: ${removedFilter.type}`);
    }
    
    const updatedActiveFilters = activeFilters.filter(f => f.id !== filterId);
    
    setActiveFilters(updatedActiveFilters);
    
    if (removedFilter) {
      const updatedFilterValues = { ...tempFilters };
      delete updatedFilterValues[removedFilter.type];
      setTempFilters(updatedFilterValues);
      
      // Automatically trigger search with remaining filters
      const filterArray = [];
      
      Object.entries(updatedFilterValues).forEach(([field, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (field === 'language_id' && Array.isArray(value)) {
            // For language_id, create multiple filter objects
            value.forEach(langId => {
              if (langId && langId.toString().trim() !== '') {
                filterArray.push({
                  field: field,
                  value: parseInt(langId),
                  operator: 'equals'
                });
              }
            });
          } else if (field === 'category' && typeof value === 'number') {
            // For category, ensure it's a number
            filterArray.push({
              field: field,
              value: value,
              operator: 'equals'
            });
          } else if (typeof value === 'string' && value.trim() !== '') {
            // For text fields
            filterArray.push({
              field: field,
              value: value.trim(),
              operator: 'contains'
            });
          }
        }
      });
      
      logInfo('SkillFilters', 'Auto-triggering search after filter removal with remaining filters:', filterArray);
      if (onSearch) {
        onSearch(filterArray);
      }
    }
  };

  const handleFilterChange = (filterId, value) => {
    const filter = activeFilters.find(f => f.id === filterId);
    if (filter) {
      const updatedFilterValues = {
        ...tempFilters,
        [filter.type]: value
      };
      setTempFilters(updatedFilterValues);
      logInfo('SkillFilters', `Filter ${filter.type} changed to:`, value);
    }
  };

  const handleFilterTypeChange = (filterId, newType) => {
    const updatedActiveFilters = activeFilters.map(f => 
      f.id === filterId ? { ...f, type: newType } : f
    );
    setActiveFilters(updatedActiveFilters);
    
    // Clear the value for the old type and initialize for the new type
    const filter = activeFilters.find(f => f.id === filterId);
    if (filter) {
      const updatedFilterValues = { ...tempFilters };
      delete updatedFilterValues[filter.type];
      
      // Initialize the new filter type with appropriate default value
      if (newType === 'language_id') {
        updatedFilterValues[newType] = [];
      } else {
        updatedFilterValues[newType] = '';
      }
      
      setTempFilters(updatedFilterValues);
    }
  };

  const handleSearch = () => {
    // Create filter array format expected by backend
    const filterArray = [];
    
    Object.entries(tempFilters).forEach(([field, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (field === 'language_id' && Array.isArray(value)) {
          // For language_id, create multiple filter objects
          value.forEach(langId => {
            if (langId && langId.toString().trim() !== '') {
              filterArray.push({
                field: field,
                value: parseInt(langId),
                operator: 'equals'
              });
            }
          });
        } else if (field === 'category' && typeof value === 'number') {
          // For category, ensure it's a number
          filterArray.push({
            field: field,
            value: value,
            operator: 'equals'
          });
        } else if (typeof value === 'string' && value.trim() !== '') {
          // For text fields
          filterArray.push({
            field: field,
            value: value.trim(),
            operator: 'contains'
          });
        }
      }
    });
    
    logInfo('SkillFilters', 'Search triggered with filters:', filterArray);
    
    if (onSearch) {
      onSearch(filterArray);
    }
  };

  const handleClearFilters = () => {
    logInfo('SkillFilters', 'Clearing all filters');
    
    // Reset to a single default filter
    setActiveFilters([{ id: 1, type: 'name' }]);
    setNextFilterId(2);
    setTempFilters({});
    
    // Trigger search with empty filters
    if (onSearch) {
      onSearch([]);
    }
  };

  const renderFilterInput = (filter) => {
    const filterConfig = FILTER_TYPES[filter.type];
    const currentValue = tempFilters[filter.type] || '';

    if (!filterConfig) {
      return (
        <TextField
          value=""
          disabled
          sx={{ flex: 1 }}
        />
      );
    }

    const notice = noticesByType[filter.type] || { isDenied: false, message: '' };

    switch (filterConfig.type) {
      case 'select':
        let options = [];
        if (filter.type === 'type_code') {
          options = filterConfig.getOptions(skillTypes || []);
        } else if (filter.type === 'category') {
          options = filterConfig.getOptions(categories || []);
        }

        return (
          <FormControl sx={{ flex: 1 }} error={notice.isDenied} disabled={notice.isDenied}>
            <InputLabel sx={{
              fontSize: '13px',
              color: '#505050',
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            }}>
              Select {filterConfig.label}
            </InputLabel>
            <Select
              value={currentValue}
              onChange={(e) => handleFilterChange(filter.id, e.target.value)}
              label={`Select ${filterConfig.label}`}
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
              <MenuItem value="" sx={{ fontSize: '13px' }}>
                <em>Any</em>
              </MenuItem>
              {options.map((option) => (
                <MenuItem key={option.value} value={option.value} sx={{ fontSize: '13px' }}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {notice.isDenied && (
              <FormHelperText>{notice.message}</FormHelperText>
            )}
          </FormControl>
        );

      case 'autocomplete':
        if (filter.type === 'language_id') {
          const options = filterConfig.getOptions(languages || []);
          const selectedValues = Array.isArray(currentValue) ? currentValue.map(v => parseInt(v)) : [];
          
          return (
            <FormControl sx={{ flex: 1 }} error={notice.isDenied} disabled={notice.isDenied}>
              <InputLabel sx={{
                fontSize: '13px',
                color: '#505050',
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              }}>
                Select Languages
              </InputLabel>
              <Select
                multiple
                value={Array.isArray(currentValue) ? currentValue : []}
                onChange={(event, newValue) => {
                  handleFilterChange(filter.id, event.target.value);
                }}
                input={<OutlinedInput label="Select Languages" />}
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
                disabled={languagesLoading}
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
                  height: '40px',
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
                {languagesLoading ? (
                  <MenuItem disabled>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      Loading languages...
                    </Box>
                  </MenuItem>
                ) : options.length > 0 ? (
                  options.map((language) => (
                    <MenuItem key={language.value} value={language.value.toString()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Typography variant="body2">
                          {language.label}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    No languages available
                  </MenuItem>
                )}
              </Select>
              {notice.isDenied && (
                <FormHelperText>{notice.message}</FormHelperText>
              )}
            </FormControl>
          );
        }
        break;

      case 'text':
      default:
        return (
          <TextField
            fullWidth
            label={filterConfig.label}
            value={currentValue}
            onChange={(e) => handleFilterChange(filter.id, e.target.value)}
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
      disabled={hasDeniedActive}
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

export default SkillFilters;
