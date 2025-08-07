import React, { useState, useEffect } from 'react';
import { 
  Autocomplete, 
  TextField, 
  Chip, 
  Box, 
  Button, 
  CircularProgress 
} from '@mui/material';
import permissionApi from '../../services/permissionApi';
import { logInfo, logError } from '../../utils/logger';

/**
 * Permission autocomplete component for the permissions filter
 * Allows selecting multiple permissions for filtering roles
 */
function PermissionAutocomplete({ control, name, label, placeholder, handleSubmit, onSubmitFilters, field }) {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Fetch permissions on component mount
  useEffect(() => {
    const fetchPermissions = async () => {
      setLoading(true);
      setError(null);
      try {
        // Use getAllPermissionNames which is designed to return all permissions
        const permissionNames = await permissionApi.getAllPermissionNames();
        
        // Convert permission names to objects with id (using the name as both id and name)
        const permissionsList = permissionNames.map((name) => ({
          id: name,
          name: name
        }));
        
        setPermissions(permissionsList);
        logInfo('Loaded permissions for filter:', permissionsList.length);
      } catch (error) {
        logError('Failed to fetch permissions for filter:', error);
        setError('Failed to load permissions. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPermissions();
  }, []);
  
  // Convert the field value to an array of selected permission objects
  const selectedPermissions = Array.isArray(field.value) 
    ? field.value.map(value => {
        // If value is already an object with id, return it
        if (value && typeof value === 'object' && value.id) {
          return value;
        }
        
        // If value is a string or number, try to find matching permission
        if (typeof value === 'string' || typeof value === 'number') {
          const matchingPermission = permissions.find(p => 
            p.id === value || p.id === Number(value) || p.name === value
          );
          return matchingPermission || value;
        }
        
        return value;
      })
    : field.value && typeof field.value === 'string'
      ? [field.value]
      : [];
  
  const fetchPermissions = async () => {
    setLoading(true);
    try {
      // Use getAllPermissionNames which is designed to return all permissions
      const permissionNames = await permissionApi.getAllPermissionNames();
      
      // Convert permission names to objects with id (using the name as both id and name)
      const permissionsList = permissionNames.map((name) => ({
        id: name,
        name: name
      }));
      
      setPermissions(permissionsList);
    } catch (error) {
      logError('Failed to retry fetching permissions:', error);
      setError('Failed to load permissions. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      <Autocomplete
        multiple
        options={permissions}
        getOptionLabel={(option) => {
          if (typeof option === 'string') return option;
          return option.name || option.toString();
        }}
        isOptionEqualToValue={(option, value) => {
          // Handle different types of values that might be passed
          if (option === value) return true;
          
          const optionId = option.id || option;
          const valueId = value.id || value;
          
          if (typeof optionId === 'number' && typeof valueId === 'number') {
            return optionId === valueId;
          }
          
          const optionName = option.name || option;
          const valueName = value.name || value;
          
          if (typeof optionName === 'string' && typeof valueName === 'string') {
            return optionName === valueName;
          }
          
          return false;
        }}
        loading={loading}
        value={selectedPermissions}
        onChange={(event, newValue) => {
          try {
            // Create clean permission values for filtering
            const processedPermissions = newValue.map(permission => {
              // Handle different types of permission values 
              if (typeof permission === 'string') {
                return permission;
              } else if (typeof permission === 'object' && permission !== null) {
                // Prefer name for objects, fall back to id if name isn't available
                return permission.name || permission.id || String(permission);
              } else {
                return String(permission);
              }
            });
            
            // Save just the permission names/ids for API filtering
            field.onChange(processedPermissions);
            
            // Add detailed log to debug permissions filter
            logInfo('Selected permissions:', processedPermissions);
            
            // Auto-submit after a short delay
            setTimeout(() => {
              handleSubmit(onSubmitFilters)();
            }, 100);
          } catch (error) {
            logError('Error updating permission selection:', error);
            setError('Failed to update permission selection. Please try again.');
          }
        }}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              variant="outlined"
              label={typeof option === 'string' ? option : option.name || ''}
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
            onClick={fetchPermissions}
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
}

export default PermissionAutocomplete; 