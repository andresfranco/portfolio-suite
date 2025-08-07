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
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  AddCircleOutline as AddFilterIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import SERVER_URL from '../common/BackendServerData';

// Filter type definitions
const FILTER_TYPES = {
  name: {
    label: 'Name',
    type: 'text'
  },
  category_id: {
    label: 'Categories',
    type: 'multiselect'
  },
  language_id: {
    label: 'Languages',
    type: 'multiselect'
  }
};

function ProjectFilters({ filters, onFiltersChange, onSearch }) {
  const [activeFilters, setActiveFilters] = useState(() => {
    const initialFilters = [];
    let id = 1;
    
    // Check for direct filter properties
    Object.keys(FILTER_TYPES).forEach(field => {
      if (filters?.[field]) {
        initialFilters.push({ id: id++, type: field });
      }
    });
    
    // Check for array-based filters in filterField
    if (filters?.filterField && Array.isArray(filters.filterField)) {
      // Get unique filter types from filterField
      const uniqueFilterTypes = [...new Set(filters.filterField)];
      
      // For each unique filter type found in filterField
      uniqueFilterTypes.forEach(fieldName => {
        // Only add if it's a known filter type and not already added
        if (
          FILTER_TYPES[fieldName] && 
          !initialFilters.some(f => f.type === fieldName)
        ) {
          initialFilters.push({ id: id++, type: fieldName });
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
    // Start with the provided filters
    const initialTempFilters = { ...filters };
    
    // Process filterField arrays to reconstruct category and language_id arrays
    if (filters?.filterField && Array.isArray(filters.filterField)) {
      // Process categories
      const categoryIndices = filters.filterField.reduce((indices, field, index) => {
        if (field === 'category_id') indices.push(index);
        return indices;
      }, []);
      
      if (categoryIndices.length > 0) {
        const categoryIds = categoryIndices.map(index => {
          const value = filters.filterValue[index];
          return typeof value === 'string' ? parseInt(value, 10) : value;
        });
        initialTempFilters.category_id = categoryIds;
      }
      
      // Process languages
      const languageIndices = filters.filterField.reduce((indices, field, index) => {
        if (field === 'language_id') indices.push(index);
        return indices;
      }, []);
      
      if (languageIndices.length > 0) {
        const languageIds = languageIndices.map(index => {
          const value = filters.filterValue[index];
          return typeof value === 'string' ? parseInt(value, 10) : value;
        });
        initialTempFilters.language_id = languageIds;
      }
    }
    
    return initialTempFilters;
  });
  
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch available languages and categories
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch languages
        const languagesResponse = await fetch(`${SERVER_URL}/api/languages/full`);
        if (!languagesResponse.ok) {
          throw new Error('Failed to fetch languages');
        }
        
        const languagesData = await languagesResponse.json();
        console.log('Languages data:', languagesData);
        const languages = languagesData.items || [];
        setAvailableLanguages(languages);
        
        // Find default language
        const defaultLanguage = languages.find(lang => lang.is_default || lang.isDefault) || 
                           (languages.length > 0 ? languages[0] : null);
        
        // Fetch categories with the /full endpoint
        const categoriesResponse = await fetch(`${SERVER_URL}/api/categories/full`);
        if (!categoriesResponse.ok) {
          throw new Error('Failed to fetch categories');
        }
        
        const categoriesData = await categoriesResponse.json();
        console.log('Categories data:', categoriesData);
        
        // Extract categories from response
        let categoriesList = [];
        
        if (categoriesData.items && Array.isArray(categoriesData.items)) {
          categoriesList = categoriesData.items;
        } else if (Array.isArray(categoriesData)) {
          categoriesList = categoriesData;
        } else if (typeof categoriesData === 'object') {
          // Try to extract categories if it's a different structure
          const possibleArrays = Object.values(categoriesData).filter(val => Array.isArray(val));
          if (possibleArrays.length > 0) {
            // Use the longest array assuming it's the categories list
            categoriesList = possibleArrays.reduce((a, b) => a.length > b.length ? a : b, []);
          }
        }
        
        // Filter categories that have 'PROJ' in their type_code
        const projectCategories = categoriesList.filter(category => 
          category && category.type_code === "PROJ"
        );
        
        console.log('Filtered PROJ categories:', projectCategories);
        
        // Process categories to get proper names from default language
        const processedCategories = projectCategories.map(category => {
          // Extract category texts
          const categoryTexts = category.category_texts || [];
          let defaultName = category.name || 'Unnamed Category';
          
          // Find text for default language if available
          if (defaultLanguage && categoryTexts.length > 0) {
            const defaultText = categoryTexts.find(text => 
              text.language_id === defaultLanguage.id
            );
            if (defaultText && defaultText.name) {
              defaultName = defaultText.name;
            }
          }
          
          return {
            ...category,
            displayName: defaultName // Add displayName property for rendering
          };
        });
        
        setAvailableCategories(processedCategories);
      } catch (error) {
        console.error('Error fetching filter data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Update tempFilters when filters prop changes
  useEffect(() => {
    if (filters) {
      console.log('ProjectFilters - filters prop changed:', filters);
      
      // Create a copy of the current filters
      const updatedTempFilters = { ...tempFilters };
      
      // Process filter arrays (filterField, filterValue, filterOperator)
      if (filters.filterField && Array.isArray(filters.filterField)) {
        console.log('ProjectFilters - Processing filter arrays from filters prop');
        
        // Process 'category_id' filters
        const categoryIndices = filters.filterField.reduce((indices, field, index) => {
          if (field === 'category_id') indices.push(index);
          return indices;
        }, []);
        
        if (categoryIndices.length > 0) {
          const categoryIds = categoryIndices.map(index => {
            const categoryValue = filters.filterValue[index];
            return typeof categoryValue === 'string' ? parseInt(categoryValue, 10) : categoryValue;
          });
          updatedTempFilters.category_id = categoryIds;
          console.log('ProjectFilters - Restored category filters:', categoryIds);
        }
        
        // Process 'language_id' filters
        const languageIndices = filters.filterField.reduce((indices, field, index) => {
          if (field === 'language_id') indices.push(index);
          return indices;
        }, []);
        
        if (languageIndices.length > 0) {
          const languageIds = languageIndices.map(index => {
            const languageValue = filters.filterValue[index];
            return typeof languageValue === 'string' ? parseInt(languageValue, 10) : languageValue;
          });
          updatedTempFilters.language_id = languageIds;
          console.log('ProjectFilters - Restored language_id filters:', languageIds);
        }
      }
      
      // Handle direct filters like name
      if (filters.name) {
        updatedTempFilters.name = filters.name;
      }
      
      setTempFilters(updatedTempFilters);
      
      // Ensure active filters match the current filter values
      const shouldHaveFilters = Object.keys(FILTER_TYPES).filter(key => 
        updatedTempFilters[key] !== undefined && 
        (
          (Array.isArray(updatedTempFilters[key]) && updatedTempFilters[key].length > 0) || 
          (!Array.isArray(updatedTempFilters[key]) && updatedTempFilters[key])
        )
      );
      
      // If we have filters that aren't in the activeFilters, add them
      if (shouldHaveFilters.length > 0) {
        let nextId = nextFilterId;
        const newActiveFilters = [...activeFilters];
        
        shouldHaveFilters.forEach(filterType => {
          // Check if this filter type is already active
          if (!activeFilters.some(f => f.type === filterType)) {
            newActiveFilters.push({ id: nextId++, type: filterType });
          }
        });
        
        if (newActiveFilters.length !== activeFilters.length) {
          setActiveFilters(newActiveFilters);
          setNextFilterId(nextId);
        }
      }
    }
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
    const updatedActiveFilters = activeFilters.filter(f => f.id !== filterId);
    setActiveFilters(updatedActiveFilters);
    
    const removedFilter = activeFilters.find(f => f.id === filterId);
    if (removedFilter) {
      const updatedFilterValues = { ...tempFilters };
      delete updatedFilterValues[removedFilter.type];
      setTempFilters(updatedFilterValues);
    }
  };
  
  const handleFilterChange = (filterType, value) => {
    // Update the filter value for the specified type
    const updatedTempFilters = {
      ...tempFilters,
      [filterType]: value
    };
    setTempFilters(updatedTempFilters);
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
    
    console.log('ProjectFilters - Processing filter values:', tempFilters);
    
    Object.entries(tempFilters).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            // For arrays, make sure we're using the correct field names to match backend expectations
            if (key === 'category_id') {
              cleanFilters['category_id'] = value.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
              console.log(`ProjectFilters - Set category filter with ${value.length} values:`, value);
            } else if (key === 'language_id') {
              // Make sure language_id values are numbers
              cleanFilters['language_id'] = value.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
              console.log(`ProjectFilters - Set language_id filter with ${value.length} values:`, cleanFilters['language_id']);
            } else {
              cleanFilters[key] = value;
              console.log(`ProjectFilters - Set ${key} filter with array values:`, value);
            }
          }
        } else if (value.toString().trim() !== '') {
          cleanFilters[key] = value.toString().trim();
          console.log(`ProjectFilters - Set ${key} filter with value:`, value.toString().trim());
        }
      }
    });
    
    console.log('ProjectFilters - Final filters for search:', cleanFilters);
    
    // Update parent component with new filters
    if (onFiltersChange) {
      console.log('ProjectFilters - Calling onFiltersChange with:', cleanFilters);
      onFiltersChange(cleanFilters);
    }
    
    // Trigger search
    if (onSearch) {
      console.log('ProjectFilters - Calling onSearch with:', cleanFilters);
      onSearch(cleanFilters);
    }
    
    // For debugging - log the structure that will be sent to the backend
    if (cleanFilters.category_id || cleanFilters.language_id || cleanFilters.name) {
      console.log('ProjectFilters - DEBUG - Expected backend query structure:');
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('pageSize', '10');
      
      // Add name filter if present
      if (cleanFilters.name) {
        params.append('name', cleanFilters.name);
        console.log(`Added name filter: name=${cleanFilters.name}`);
      }
      
      // Add categories
      if (Array.isArray(cleanFilters.category_id)) {
        cleanFilters.category_id.forEach(cat => {
          params.append('filterField', 'category_id');
          params.append('filterValue', cat.toString());
          params.append('filterOperator', 'equals');
        });
      }
      
      // Add languages
      if (Array.isArray(cleanFilters.language_id)) {
        cleanFilters.language_id.forEach(lang => {
          params.append('filterField', 'language_id');
          params.append('filterValue', lang.toString());
          params.append('filterOperator', 'equals');
        });
      }
      
      console.log(`Expected API request: /api/projects/full?${params.toString()}`);
    }
  };

  // Helper function to get category name by ID
  const getCategoryName = (categoryId) => {
    if (!categoryId) return 'Unknown Category';
    
    const category = availableCategories.find(cat => cat.id === categoryId);
    if (!category) return `Category ${categoryId}`;
    
    return category.displayName || category.name || `Category ${categoryId}`;
  };
  
  // Helper function to get language name by ID
  const getLanguageName = (languageId) => {
    if (!languageId) return 'Unknown Language';
    
    const language = availableLanguages.find(lang => lang.id === languageId);
    if (!language) return `Language ${languageId}`;
    
    return `${language.name} (${language.code})`;
  };

  // Render a specific filter component based on filter type
  const renderFilterComponent = (filter) => {
    const filterType = FILTER_TYPES[filter.type];
    
    if (!filterType) {
      return <Typography color="error">Unknown filter type: {filter.type}</Typography>;
    }
    
    // Get the current value for this filter
    const filterValue = tempFilters[filter.type];
    
    // Based on filter type, render appropriate input
    switch (filterType.type) {
      case 'text':
        return (
          <TextField
            fullWidth
            size="small"
            label={filterType.label}
            value={filterValue || ''}
            onChange={(e) => handleFilterChange(filter.type, e.target.value)}
            disabled={isLoading}
            placeholder={filter.type === 'name' ? "Search by project name..." : ""}
            // Add an Enter key handler to trigger immediate search
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
        );
      
      case 'multiselect':
        if (filter.type === 'category_id') {
          // Handle Categories Filter
          const selectedCategoryIds = Array.isArray(filterValue) ? filterValue : [];
          
          return (
            <FormControl fullWidth size="small">
              <InputLabel id={`filter-${filter.id}-label`}>{filterType.label}</InputLabel>
              <Select
                labelId={`filter-${filter.id}-label`}
                id={`filter-${filter.id}`}
                multiple
                value={selectedCategoryIds}
                onChange={(e) => handleFilterChange(filter.type, e.target.value)}
                input={<OutlinedInput label={filterType.label} />}
                disabled={isLoading}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip 
                        key={value} 
                        label={getCategoryName(value)} 
                        size="small" 
                      />
                    ))}
                  </Box>
                )}
              >
                {isLoading ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} />
                  </MenuItem>
                ) : availableCategories.length === 0 ? (
                  <MenuItem disabled>
                    <em>No categories available</em>
                  </MenuItem>
                ) : (
                  availableCategories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.displayName || category.name || `Category ${category.id}`}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          );
        } else if (filter.type === 'language_id') {
          // Handle Languages Filter
          const selectedLanguageIds = Array.isArray(filterValue) ? filterValue : [];
          
          return (
            <FormControl fullWidth size="small">
              <InputLabel id={`filter-${filter.id}-label`}>{filterType.label}</InputLabel>
              <Select
                labelId={`filter-${filter.id}-label`}
                id={`filter-${filter.id}`}
                multiple
                value={selectedLanguageIds}
                onChange={(e) => handleFilterChange(filter.type, e.target.value)}
                input={<OutlinedInput label={filterType.label} />}
                disabled={isLoading}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip 
                        key={value} 
                        label={getLanguageName(value)} 
                        size="small" 
                      />
                    ))}
                  </Box>
                )}
              >
                {isLoading ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} />
                  </MenuItem>
                ) : availableLanguages.length === 0 ? (
                  <MenuItem disabled>
                    <em>No languages available</em>
                  </MenuItem>
                ) : (
                  availableLanguages.map((language) => (
                    <MenuItem key={language.id} value={language.id}>
                      {language.name} ({language.code})
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          );
        }
        
        // Fallback for unknown multiselect type
        return (
          <Typography color="error">Unknown multiselect type: {filter.type}</Typography>
        );
      
      default:
        return (
          <Typography color="error">Unsupported filter type: {filterType.type}</Typography>
        );
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Filters
        </Typography>
        <Tooltip title="Add another filter">
          <Button
            variant="outlined"
            startIcon={<AddFilterIcon />}
            onClick={handleAddFilter}
            disabled={activeFilters.length >= Object.keys(FILTER_TYPES).length}
            sx={{ ml: 1 }}
          >
            Add Filter
          </Button>
        </Tooltip>
      </Box>
      
      <Stack spacing={2}>
        {activeFilters.map((filter) => (
          <Box key={filter.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl sx={{ width: 150 }} size="small">
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
            
            {/* Render the appropriate filter input based on filter type */}
            <Box sx={{ flex: 1 }}>
              {renderFilterComponent(filter)}
            </Box>
            
            <IconButton onClick={() => handleRemoveFilter(filter.id)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        ))}
      </Stack>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={handleSearch}
          disabled={isLoading}
        >
          Search
        </Button>
      </Box>
    </Paper>
  );
}

export default ProjectFilters;
