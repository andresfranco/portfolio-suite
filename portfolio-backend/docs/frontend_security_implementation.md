# Frontend Security Implementation Plan

## Executive Summary

This document outlines the comprehensive implementation plan for role-based access control (RBAC) in the frontend application. The plan ensures that users can only access modules and perform CRUD operations based on their assigned permissions, with seamless integration with the backend security system.

## Current Frontend Security State

### ✅ Current Strengths
- **JWT Authentication**: Login component handles JWT token management
- **Axios Interceptors**: Token injection in API requests
- **Route Protection**: Basic authentication-based route protection
- **Context Architecture**: Well-structured context pattern for state management
- **Error Handling**: Comprehensive error boundaries and error handling

### ❌ Security Gaps
- **No Permission-Based Authorization**: Components don't check user permissions
- **No Role-Based UI Control**: All authenticated users see all menu options
- **No CRUD Operation Restrictions**: All users can perform all operations
- **Missing Permission Context**: No centralized permission management
- **No Component-Level Security**: No fine-grained access control

## Frontend Security Architecture

### 1. Authorization Context System

Create a centralized authorization system using React Context:

#### 1.1 Create `src/contexts/AuthorizationContext.js`

```javascript
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuthContext } from './AuthContext';
import { getUserPermissions } from '../services/authService';

const AuthorizationContext = createContext();

export const useAuthorization = () => {
  const context = useContext(AuthorizationContext);
  if (!context) {
    throw new Error('useAuthorization must be used within an AuthorizationProvider');
  }
  return context;
};

export const AuthorizationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuthContext();
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // System admin users who bypass all permission checks
  const SYSTEM_ADMIN_USERS = ['systemadmin'];
  const SYSTEM_ADMIN_PERMISSION = 'SYSTEM_ADMIN';

  // Load user permissions when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserPermissions();
    } else {
      setPermissions([]);
      setRoles([]);
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const loadUserPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getUserPermissions(user.id);
      setPermissions(response.permissions || []);
      setRoles(response.roles || []);
    } catch (error) {
      console.error('Failed to load user permissions:', error);
      setError('Failed to load user permissions');
      setPermissions([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check if user is system admin
  const isSystemAdmin = useCallback(() => {
    if (!user) return false;
    
    // Check if user is systemadmin
    if (SYSTEM_ADMIN_USERS.includes(user.username)) {
      return true;
    }
    
    // Check if user has SYSTEM_ADMIN permission
    return permissions.includes(SYSTEM_ADMIN_PERMISSION);
  }, [user, permissions]);

  // Check if user has specific permission
  const hasPermission = useCallback((permission) => {
    if (!isAuthenticated || !user) return false;
    
    // System admin bypass
    if (isSystemAdmin()) return true;
    
    // Check specific permission
    return permissions.includes(permission);
  }, [isAuthenticated, user, permissions, isSystemAdmin]);

  // Check if user has any of the specified permissions
  const hasAnyPermission = useCallback((permissionList) => {
    if (!isAuthenticated || !user) return false;
    
    // System admin bypass
    if (isSystemAdmin()) return true;
    
    // Check if user has any of the permissions
    return permissionList.some(permission => permissions.includes(permission));
  }, [isAuthenticated, user, permissions, isSystemAdmin]);

  // Check if user has all specified permissions
  const hasAllPermissions = useCallback((permissionList) => {
    if (!isAuthenticated || !user) return false;
    
    // System admin bypass
    if (isSystemAdmin()) return true;
    
    // Check if user has all permissions
    return permissionList.every(permission => permissions.includes(permission));
  }, [isAuthenticated, user, permissions, isSystemAdmin]);

  // Check if user has specific role
  const hasRole = useCallback((roleName) => {
    if (!isAuthenticated || !user) return false;
    
    // System admin bypass
    if (isSystemAdmin()) return true;
    
    return roles.some(role => role.name === roleName);
  }, [isAuthenticated, user, roles, isSystemAdmin]);

  // Module-specific permission checks
  const canAccessModule = useCallback((moduleName) => {
    const modulePermissions = {
      'users': ['VIEW_USERS', 'CREATE_USER', 'EDIT_USER', 'DELETE_USER'],
      'roles': ['VIEW_ROLES', 'CREATE_ROLE', 'EDIT_ROLE', 'DELETE_ROLE'],
      'permissions': ['VIEW_PERMISSIONS', 'CREATE_PERMISSION', 'EDIT_PERMISSION', 'DELETE_PERMISSION'],
      'categories': ['VIEW_CATEGORIES', 'CREATE_CATEGORY', 'EDIT_CATEGORY', 'DELETE_CATEGORY'],
      'categorytypes': ['VIEW_CATEGORY_TYPES', 'CREATE_CATEGORY_TYPE', 'EDIT_CATEGORY_TYPE', 'DELETE_CATEGORY_TYPE'],
      'portfolios': ['VIEW_PORTFOLIOS', 'CREATE_PORTFOLIO', 'EDIT_PORTFOLIO', 'DELETE_PORTFOLIO'],
      'projects': ['VIEW_PROJECTS', 'CREATE_PROJECT', 'EDIT_PROJECT', 'DELETE_PROJECT'],
      'experiences': ['VIEW_EXPERIENCES', 'CREATE_EXPERIENCE', 'EDIT_EXPERIENCE', 'DELETE_EXPERIENCE'],
      'skills': ['VIEW_SKILLS', 'CREATE_SKILL', 'EDIT_SKILL', 'DELETE_SKILL'],
      'skilltypes': ['VIEW_SKILL_TYPES', 'CREATE_SKILL_TYPE', 'EDIT_SKILL_TYPE', 'DELETE_SKILL_TYPE'],
      'languages': ['VIEW_LANGUAGES', 'CREATE_LANGUAGE', 'EDIT_LANGUAGE', 'DELETE_LANGUAGE'],
      'sections': ['VIEW_SECTIONS', 'CREATE_SECTION', 'EDIT_SECTION', 'DELETE_SECTION'],
      'translations': ['VIEW_TRANSLATIONS', 'CREATE_TRANSLATION', 'EDIT_TRANSLATION', 'DELETE_TRANSLATION']
    };

    const requiredPermissions = modulePermissions[moduleName.toLowerCase()];
    if (!requiredPermissions) return false;

    // User needs at least one permission for the module (typically VIEW)
    return hasAnyPermission(requiredPermissions);
  }, [hasAnyPermission]);

  // CRUD operation permission checks
  const canPerformOperation = useCallback((operation, moduleName) => {
    const permission = `${operation.toUpperCase()}_${moduleName.toUpperCase()}`;
    return hasPermission(permission);
  }, [hasPermission]);

  const value = {
    permissions,
    roles,
    loading,
    error,
    isSystemAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canAccessModule,
    canPerformOperation,
    refreshPermissions: loadUserPermissions
  };

  return (
    <AuthorizationContext.Provider value={value}>
      {children}
    </AuthorizationContext.Provider>
  );
};
```

### 2. Permission-Based Component System

#### 2.1 Create `src/components/common/PermissionGate.js`

```javascript
import React from 'react';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { Alert, Box } from '@mui/material';

/**
 * Component that conditionally renders children based on user permissions
 */
const PermissionGate = ({ 
  permission, 
  permissions, 
  requireAll = false, 
  fallback = null, 
  showError = false,
  children 
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = useAuthorization();

  // Show loading state
  if (loading) {
    return fallback || null;
  }

  let hasAccess = false;

  if (permission) {
    // Single permission check
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    // Multiple permissions check
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  if (!hasAccess) {
    if (showError) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          You don't have permission to access this resource.
        </Alert>
      );
    }
    return fallback;
  }

  return children;
};

export default PermissionGate;
```

#### 2.2 Create `src/components/common/ModuleGate.js`

```javascript
import React from 'react';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { Alert, Box } from '@mui/material';

/**
 * Component that conditionally renders children based on module access
 */
const ModuleGate = ({ 
  moduleName, 
  operation = null, 
  fallback = null, 
  showError = false,
  children 
}) => {
  const { canAccessModule, canPerformOperation, loading } = useAuthorization();

  // Show loading state
  if (loading) {
    return fallback || null;
  }

  let hasAccess = false;

  if (operation) {
    // Check specific operation permission
    hasAccess = canPerformOperation(operation, moduleName);
  } else {
    // Check general module access
    hasAccess = canAccessModule(moduleName);
  }

  if (!hasAccess) {
    if (showError) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          You don't have permission to access this {moduleName} module.
        </Alert>
      );
    }
    return fallback;
  }

  return children;
};

export default ModuleGate;
```

### 3. Enhanced Navigation System

#### 3.1 Update `src/components/layout/Layout.js`

```javascript
import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Box,
  Divider,
  Collapse
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Security,
  Category,
  Work,
  Code,
  Language,
  Settings,
  ExpandLess,
  ExpandMore
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import PermissionGate from '../common/PermissionGate';
import ModuleGate from '../common/ModuleGate';

const Layout = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [contentManagementOpen, setContentManagementOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessModule, loading } = useAuthorization();

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Navigation menu items with permission requirements
  const navigationItems = [
    {
      label: 'Dashboard',
      icon: <Dashboard />,
      path: '/dashboard',
      permission: 'VIEW_DASHBOARD'
    },
    {
      label: 'User Management',
      icon: <People />,
      subItems: [
        {
          label: 'Users',
          path: '/users',
          moduleName: 'users'
        },
        {
          label: 'Roles',
          path: '/roles',
          moduleName: 'roles'
        },
        {
          label: 'Permissions',
          path: '/permissions',
          moduleName: 'permissions'
        }
      ]
    },
    {
      label: 'Content Management',
      icon: <Work />,
      subItems: [
        {
          label: 'Categories',
          path: '/categories',
          moduleName: 'categories'
        },
        {
          label: 'Category Types',
          path: '/category-types',
          moduleName: 'categorytypes'
        },
        {
          label: 'Portfolios',
          path: '/portfolios',
          moduleName: 'portfolios'
        },
        {
          label: 'Projects',
          path: '/projects',
          moduleName: 'projects'
        },
        {
          label: 'Experiences',
          path: '/experiences',
          moduleName: 'experiences'
        },
        {
          label: 'Skills',
          path: '/skills',
          moduleName: 'skills'
        },
        {
          label: 'Skill Types',
          path: '/skill-types',
          moduleName: 'skilltypes'
        },
        {
          label: 'Languages',
          path: '/languages',
          moduleName: 'languages'
        },
        {
          label: 'Sections',
          path: '/sections',
          moduleName: 'sections'
        },
        {
          label: 'Translations',
          path: '/translations',
          moduleName: 'translations'
        }
      ]
    }
  ];

  const renderNavigationItem = (item) => {
    // Handle items with subitems (expandable menu)
    if (item.subItems) {
      // Check if user has access to any subitem
      const hasAccessToAnySubitem = item.subItems.some(subItem => {
        if (subItem.moduleName) {
          return canAccessModule(subItem.moduleName);
        }
        return true;
      });

      if (!hasAccessToAnySubitem) {
        return null;
      }

      const isUserManagement = item.label === 'User Management';
      const isContentManagement = item.label === 'Content Management';
      const isOpen = isUserManagement ? userManagementOpen : contentManagementOpen;
      const toggleOpen = isUserManagement 
        ? () => setUserManagementOpen(!userManagementOpen)
        : () => setContentManagementOpen(!contentManagementOpen);

      return (
        <React.Fragment key={item.label}>
          <ListItem button onClick={toggleOpen}>
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
            {isOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItem>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.subItems.map((subItem) => (
                <ModuleGate
                  key={subItem.label}
                  moduleName={subItem.moduleName}
                  fallback={null}
                >
                  <ListItem 
                    button 
                    sx={{ pl: 4 }}
                    onClick={() => navigate(subItem.path)}
                    selected={location.pathname === subItem.path}
                  >
                    <ListItemText primary={subItem.label} />
                  </ListItem>
                </ModuleGate>
              ))}
            </List>
          </Collapse>
        </React.Fragment>
      );
    }

    // Handle regular navigation items
    return (
      <PermissionGate 
        key={item.label}
        permission={item.permission}
        fallback={null}
      >
        <ListItem 
          button 
          onClick={() => navigate(item.path)}
          selected={location.pathname === item.path}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItem>
      </PermissionGate>
    );
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={toggleDrawer}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Portfolio CMS
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={toggleDrawer}
        sx={{
          width: 240,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 240,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {navigationItems.map(renderNavigationItem)}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
```

### 4. Enhanced Module Components

#### 4.1 Update Category Index Component

Update `src/components/categories/CategoryIndex.js` to include permission checks:

```javascript
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  Snackbar
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useCategoryContext } from '../../contexts/CategoryContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import GenericDataGrid from '../common/GenericDataGrid';
import CategoryForm from './CategoryForm';
import CategoryFilters from './CategoryFilters';
import CategoryErrorBoundary from './CategoryErrorBoundary';
import ModuleGate from '../common/ModuleGate';
import PermissionGate from '../common/PermissionGate';

const CategoryIndexContent = () => {
  const {
    categories,
    loading,
    error,
    pagination,
    filters,
    fetchCategories,
    deleteCategory,
    updateFilters,
    clearFilters
  } = useCategoryContext();

  const { canPerformOperation } = useAuthorization();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formMode, setFormMode] = useState('create');
  const [formOpen, setFormOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Define columns for the data grid
  const columns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
    { field: 'description', headerName: 'Description', flex: 2, minWidth: 300 },
    { field: 'created_at', headerName: 'Created', width: 160, type: 'dateTime' },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <PermissionGate permission="EDIT_CATEGORY">
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => handleEdit(params.row)}
            >
              Edit
            </Button>
          </PermissionGate>
          <PermissionGate permission="DELETE_CATEGORY">
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => handleDelete(params.row)}
            >
              Delete
            </Button>
          </PermissionGate>
        </Box>
      ),
    },
  ];

  const handleCreate = () => {
    setSelectedCategory(null);
    setFormMode('create');
    setFormOpen(true);
  };

  const handleEdit = (category) => {
    setSelectedCategory(category);
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleDelete = (category) => {
    setSelectedCategory(category);
    setFormMode('delete');
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedCategory(null);
  };

  const handleFormSuccess = (message) => {
    setSnackbar({ open: true, message, severity: 'success' });
    setFormOpen(false);
    setSelectedCategory(null);
    fetchCategories();
  };

  const handleFormError = (message) => {
    setSnackbar({ open: true, message, severity: 'error' });
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error loading categories: {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Categories
        </Typography>
        <PermissionGate permission="CREATE_CATEGORY">
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            Add Category
          </Button>
        </PermissionGate>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <CategoryFilters
          filters={filters}
          onFiltersChange={updateFilters}
          onClearFilters={clearFilters}
        />
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <GenericDataGrid
          rows={categories}
          columns={columns}
          loading={loading}
          pagination={pagination}
          onPageChange={(page) => fetchCategories(page + 1)}
          onPageSizeChange={(pageSize) => fetchCategories(1, pageSize)}
          checkboxSelection={false}
          disableSelectionOnClick
        />
      </Paper>

      {/* Form Dialog */}
      {formOpen && (
        <CategoryForm
          open={formOpen}
          mode={formMode}
          category={selectedCategory}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          onError={handleFormError}
        />
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

const CategoryIndex = () => {
  return (
    <ModuleGate moduleName="categories" showError={true}>
      <CategoryErrorBoundary>
        <CategoryIndexContent />
      </CategoryErrorBoundary>
    </ModuleGate>
  );
};

export default CategoryIndex;
```

#### 4.2 Update Category Form Component

Update `src/components/categories/CategoryForm.js` to include permission checks:

```javascript
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  Stack,
  Typography
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { useCategoryContext } from '../../contexts/CategoryContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import PermissionGate from '../common/PermissionGate';

const CategoryForm = ({ open, mode, category, onClose, onSuccess, onError }) => {
  const { createCategory, updateCategory, deleteCategory } = useCategoryContext();
  const { canPerformOperation } = useAuthorization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    reset,
    watch
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: ''
    }
  });

  // Update form when category changes
  useEffect(() => {
    if (mode === 'edit' && category) {
      reset({
        name: category.name || '',
        description: category.description || ''
      });
    } else {
      reset({
        name: '',
        description: ''
      });
    }
  }, [mode, category, reset]);

  const formData = watch();

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      setError('');

      if (mode === 'create') {
        if (!canPerformOperation('create', 'categories')) {
          throw new Error('You do not have permission to create categories');
        }
        await createCategory(data);
        onSuccess('Category created successfully');
      } else if (mode === 'edit') {
        if (!canPerformOperation('edit', 'categories')) {
          throw new Error('You do not have permission to edit categories');
        }
        await updateCategory(category.id, data);
        onSuccess('Category updated successfully');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'An error occurred';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      setError('');

      if (!canPerformOperation('delete', 'categories')) {
        throw new Error('You do not have permission to delete categories');
      }

      await deleteCategory(category.id);
      onSuccess('Category deleted successfully');
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'An error occurred';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'create':
        return 'Create Category';
      case 'edit':
        return 'Edit Category';
      case 'delete':
        return 'Delete Category';
      default:
        return 'Category';
    }
  };

  const getSubmitButtonText = () => {
    switch (mode) {
      case 'create':
        return 'Create';
      case 'edit':
        return 'Update';
      case 'delete':
        return 'Delete';
      default:
        return 'Submit';
    }
  };

  const getSubmitButtonColor = () => {
    return mode === 'delete' ? 'error' : 'primary';
  };

  const isSubmitDisabled = () => {
    if (loading) return true;
    if (mode === 'delete') return false;
    return !isValid || !isDirty;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        component: 'form',
        onSubmit: mode === 'delete' ? (e) => {
          e.preventDefault();
          handleDelete();
        } : handleSubmit(onSubmit)
      }}
    >
      <DialogTitle>{getDialogTitle()}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {mode === 'delete' ? (
          <Box sx={{ py: 2 }}>
            <Typography variant="body1" gutterBottom>
              Are you sure you want to delete this category?
            </Typography>
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Name:</strong> {category?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Description:</strong> {category?.description}
              </Typography>
            </Box>
            <Alert severity="warning" sx={{ mt: 2 }}>
              This action cannot be undone. The category will be permanently deleted.
            </Alert>
          </Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              {...register('name', {
                required: 'Category name is required',
                minLength: {
                  value: 2,
                  message: 'Name must be at least 2 characters long'
                }
              })}
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
              size="small"
              disabled={loading}
            />

            <TextField
              label="Description"
              {...register('description')}
              error={!!errors.description}
              helperText={errors.description?.message}
              fullWidth
              multiline
              rows={3}
              size="small"
              disabled={loading}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          variant="outlined"
        >
          Cancel
        </Button>
        <PermissionGate 
          permission={mode === 'create' ? 'CREATE_CATEGORY' : 
                     mode === 'edit' ? 'EDIT_CATEGORY' : 'DELETE_CATEGORY'}
        >
          <Button
            type="submit"
            variant="contained"
            color={getSubmitButtonColor()}
            disabled={isSubmitDisabled()}
          >
            {loading ? 'Processing...' : getSubmitButtonText()}
          </Button>
        </PermissionGate>
      </DialogActions>
    </Dialog>
  );
};

export default CategoryForm;
```

### 5. Enhanced Context Integration

#### 5.1 Update Category Context

Update `src/contexts/CategoryContext.js` to include permission-aware error handling:

```javascript
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { categoryApi } from '../services/categoryApi';
import { useAuthorization } from './AuthorizationContext';

const CategoryContext = createContext();

export const useCategoryContext = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategoryContext must be used within a CategoryProvider');
  }
  return context;
};

export const CategoryProvider = ({ children }) => {
  const { hasPermission } = useAuthorization();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState([]);

  // Fetch categories with permission check
  const fetchCategories = useCallback(async (page = 1, pageSize = 10) => {
    if (!hasPermission('VIEW_CATEGORIES')) {
      setError('You do not have permission to view categories');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await categoryApi.getCategories({
        page,
        pageSize,
        filters
      });
      
      setCategories(response.data.items);
      setPagination({
        page: response.data.page,
        pageSize: response.data.pageSize,
        total: response.data.total
      });
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You do not have permission to view categories');
      } else {
        setError(err.response?.data?.detail || 'Failed to fetch categories');
      }
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [hasPermission, filters]);

  // Create category with permission check
  const createCategory = useCallback(async (categoryData) => {
    if (!hasPermission('CREATE_CATEGORY')) {
      throw new Error('You do not have permission to create categories');
    }

    try {
      const response = await categoryApi.createCategory(categoryData);
      return response.data;
    } catch (err) {
      if (err.response?.status === 403) {
        throw new Error('You do not have permission to create categories');
      }
      throw err;
    }
  }, [hasPermission]);

  // Update category with permission check
  const updateCategory = useCallback(async (categoryId, categoryData) => {
    if (!hasPermission('EDIT_CATEGORY')) {
      throw new Error('You do not have permission to edit categories');
    }

    try {
      const response = await categoryApi.updateCategory(categoryId, categoryData);
      return response.data;
    } catch (err) {
      if (err.response?.status === 403) {
        throw new Error('You do not have permission to edit categories');
      }
      throw err;
    }
  }, [hasPermission]);

  // Delete category with permission check
  const deleteCategory = useCallback(async (categoryId) => {
    if (!hasPermission('DELETE_CATEGORY')) {
      throw new Error('You do not have permission to delete categories');
    }

    try {
      await categoryApi.deleteCategory(categoryId);
    } catch (err) {
      if (err.response?.status === 403) {
        throw new Error('You do not have permission to delete categories');
      }
      throw err;
    }
  }, [hasPermission]);

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  // Auto-fetch on mount and filter changes
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const value = {
    categories,
    loading,
    error,
    pagination,
    filters,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    updateFilters,
    clearFilters
  };

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
};
```

### 6. Error Handling and User Feedback

#### 6.1 Update Auth Service

Update `src/services/authService.js` to include permission fetching:

```javascript
import api from './api';

export const authService = {
  // Existing methods...
  
  // Get user permissions
  async getUserPermissions(userId) {
    try {
      const response = await api.get(`/users/${userId}/permissions`);
      return {
        permissions: response.data.permissions || [],
        roles: response.data.roles || []
      };
    } catch (error) {
      console.error('Failed to fetch user permissions:', error);
      throw error;
    }
  },

  // Get current user permissions
  async getCurrentUserPermissions() {
    try {
      const response = await api.get('/auth/me/permissions');
      return {
        permissions: response.data.permissions || [],
        roles: response.data.roles || []
      };
    } catch (error) {
      console.error('Failed to fetch current user permissions:', error);
      throw error;
    }
  }
};

export const { getUserPermissions, getCurrentUserPermissions } = authService;
```

### 7. Route Protection

#### 7.1 Create Protected Route Component

Create `src/components/common/ProtectedRoute.js`:

```javascript
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { Box, CircularProgress, Alert } from '@mui/material';

const ProtectedRoute = ({ 
  children, 
  permission = null, 
  permissions = null,
  requireAll = false,
  moduleName = null,
  operation = null,
  redirectTo = '/login'
}) => {
  const { isAuthenticated, loading: authLoading } = useAuthContext();
  const { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions, 
    canAccessModule,
    canPerformOperation,
    loading: authzLoading 
  } = useAuthorization();
  const location = useLocation();

  // Show loading while checking authentication and authorization
  if (authLoading || authzLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check authorization
  let hasAccess = true;

  if (moduleName) {
    if (operation) {
      hasAccess = canPerformOperation(operation, moduleName);
    } else {
      hasAccess = canAccessModule(moduleName);
    }
  } else if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          You do not have permission to access this page.
        </Alert>
      </Box>
    );
  }

  return children;
};

export default ProtectedRoute;
```

### 8. Implementation Checklist

#### 8.1 Backend Integration Requirements

- [ ] **Update Backend API Endpoints**
  - [ ] Add `/auth/me/permissions` endpoint to return current user's permissions
  - [ ] Add `/users/{id}/permissions` endpoint to return user's permissions
  - [ ] Ensure all endpoints return proper 403 Forbidden responses

- [ ] **Apply Backend Authorization**
  - [ ] Implement permission decorators on all API endpoints
  - [ ] Ensure systemadmin user has unrestricted access
  - [ ] Add comprehensive permission set for all modules

#### 8.2 Frontend Implementation Tasks

- [ ] **Core Authorization System**
  - [ ] Create `AuthorizationContext.js` with permission checking logic
  - [ ] Create `PermissionGate.js` for conditional rendering
  - [ ] Create `ModuleGate.js` for module-level access control
  - [ ] Create `ProtectedRoute.js` for route protection

- [ ] **Navigation Enhancement**
  - [ ] Update `Layout.js` with permission-based menu items
  - [ ] Hide menu items based on user permissions
  - [ ] Show/hide submenu items based on module access

- [ ] **Component Security**
  - [ ] Update all module index components with permission checks
  - [ ] Update all form components with CRUD permission checks
  - [ ] Add permission-based button visibility
  - [ ] Add permission error handling

- [ ] **Context Integration**
  - [ ] Update all context providers with permission checks
  - [ ] Add permission-aware error handling
  - [ ] Implement proper 403 error responses

#### 8.3 Testing Requirements

- [ ] **Unit Tests**
  - [ ] Test `AuthorizationContext` permission checking logic
  - [ ] Test `PermissionGate` and `ModuleGate` components
  - [ ] Test component permission integration
  - [ ] Test context permission checks

- [ ] **Integration Tests**
  - [ ] Test navigation menu with different user permissions
  - [ ] Test CRUD operations with different permissions
  - [ ] Test error handling for unauthorized access
  - [ ] Test systemadmin unrestricted access

## Implementation Timeline

### Week 1: Core Authorization System
1. Create `AuthorizationContext.js`
2. Create `PermissionGate.js` and `ModuleGate.js`
3. Update `Layout.js` with permission-based navigation
4. Test core authorization functionality

### Week 2: Component Integration
1. Update all module index components
2. Update all form components
3. Update all context providers
4. Test component-level permissions

### Week 3: Route Protection and Testing
1. Create `ProtectedRoute.js`
2. Update routing configuration
3. Implement comprehensive testing
4. Fix any issues and optimize performance

### Week 4: Documentation and Training
1. Update documentation
2. Create user guides
3. Conduct team training
4. Deploy to production

## Success Criteria

The frontend security implementation is complete when:
- ✅ Users only see menu items they have permission to access
- ✅ Components check permissions before rendering CRUD operations
- ✅ Unauthorized access attempts show appropriate error messages
- ✅ systemadmin user has unrestricted access to all modules
- ✅ Navigation dynamically adapts based on user permissions
- ✅ All routes are protected with appropriate permission checks
- ✅ Comprehensive testing validates security functionality

This implementation ensures a secure, user-friendly interface that seamlessly integrates with the backend security system while providing clear feedback to users about their access permissions. 