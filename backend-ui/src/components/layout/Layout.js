import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Drawer, 
  AppBar, 
  Toolbar, 
  Typography, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  IconButton, 
  Divider, 
  Container,
  useMediaQuery, 
  useTheme,
  ListSubheader,
  Avatar,
  Menu,
  MenuItem,
  Tooltip
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  VpnKey as VpnKeyIcon,
  Security as SecurityIcon,
  Code as CodeIcon,
  Category as CategoryIcon,
  Work as WorkIcon,
  Folder as ProjectIcon,
  Folder,
  Settings as SettingsIcon,
  Language as LanguageIcon,
  Chat as ChatIcon,
  List as ListIcon,
  FormatListBulleted as ListBulletedIcon,
  ViewModule as SectionIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import { useAuthorization } from '../../contexts/AuthorizationContext';

const drawerWidth = 240;

const Layout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Authorization context for permission checking
  const { permissions, isSystemAdmin, hasPermission } = useAuthorization();
  
  // User menu state
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [username, setUsername] = useState('User');
  
  // Get username on component mount
  useEffect(() => {
    // You could fetch the user profile here or use a stored username
    // For now we'll use the username from the token or default to 'Admin'
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        // JWT tokens are in the format header.payload.signature
        // We're interested in the payload part
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        if (payload.sub) {
          setUsername(payload.sub);
        }
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }
  }, []);

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleLogout = () => {
    handleCloseUserMenu();
    authService.logout();
  };

  const handleSettings = () => {
    handleCloseUserMenu();
    navigate('/settings');
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Define menu items with their required permissions
  const allMenuItems = [
    { 
      text: 'Dashboard', 
      icon: <DashboardIcon />, 
      path: '/', 
      requiredPermission: 'VIEW_DASHBOARD' 
    },
    
    // User Management
    { 
      text: 'Users', 
      icon: <PeopleIcon />, 
      path: '/users', 
      requiredPermission: 'VIEW_USERS' 
    },
    { 
      text: 'Roles', 
      icon: <VpnKeyIcon />, 
      path: '/roles', 
      requiredPermission: 'VIEW_ROLES' 
    },
    { 
      text: 'Permissions', 
      icon: <SecurityIcon />, 
      path: '/permissions', 
      requiredPermission: 'VIEW_PERMISSIONS' 
    },
    
    // Content Management
    { 
      text: 'Skills', 
      icon: <CodeIcon />, 
      path: '/skills', 
      requiredPermission: 'VIEW_SKILLS' 
    },
    { 
      text: 'Skill Types', 
      icon: <ListIcon />, 
      path: '/skill-types', 
      requiredPermission: 'VIEW_SKILL_TYPES' 
    },
    { 
      text: 'Categories', 
      icon: <CategoryIcon />, 
      path: '/categories', 
      requiredPermission: 'VIEW_CATEGORIES' 
    },
    { 
      text: 'Category Types', 
      icon: <ListBulletedIcon />, 
      path: '/category-types', 
      requiredPermission: 'VIEW_CATEGORY_TYPES' 
    },
    { 
      text: 'Experiences', 
      icon: <WorkIcon />, 
      path: '/experiences', 
      requiredPermission: 'VIEW_EXPERIENCES' 
    },
    { 
      text: 'Projects', 
      icon: <ProjectIcon />, 
      path: '/projects', 
      requiredPermission: 'VIEW_PROJECTS' 
    },
    { 
      text: 'Portfolios', 
      icon: <Folder />, 
      path: '/portfolios', 
      requiredPermission: 'VIEW_PORTFOLIOS' 
    },
    { 
      text: 'Sections', 
      icon: <SectionIcon />, 
      path: '/sections', 
      requiredPermission: 'VIEW_SECTIONS' 
    },
    
    // System Settings
    { 
      text: 'Languages', 
      icon: <LanguageIcon />, 
      path: '/languages', 
      requiredPermission: 'VIEW_LANGUAGES' 
    },
    { 
      text: 'Chatbot Config', 
      icon: <ChatIcon />, 
      path: '/chatbot', 
      requiredPermission: 'SYSTEM_ADMIN' // Only system admin can access chatbot config
    },
    { 
      text: 'System Settings', 
      icon: <SettingsIcon />, 
      path: '/settings', 
      requiredPermission: 'SYSTEM_ADMIN' // Only system admin can access system settings
    }
  ];

  // Filter menu items based on user permissions
  const filterMenuItems = (items) => {
    return items.filter(item => {
      // System admin can see everything
      if (isSystemAdmin()) {
        return true;
      }
      
      // Check if user has the required permission for this menu item
      if (item.requiredPermission) {
        return hasPermission(item.requiredPermission);
      }
      
      // If no permission specified, show by default
      return true;
    });
  };

  // Get filtered menu items
  const menuItems = filterMenuItems(allMenuItems);
  
  // Group menu items (only include groups that have visible items)
  const createMenuGroups = (items) => {
    const groups = [
      {
        title: 'General',
        items: items.filter(item => item.text === 'Dashboard') // Specifically look for Dashboard
      },
      {
        title: 'User Management',
        items: items.filter(item => ['Users', 'Roles', 'Permissions'].includes(item.text))
      },
      {
        title: 'Content Management',
        items: items.filter(item => [
          'Skills', 'Skill Types', 'Categories', 'Category Types', 
          'Experiences', 'Projects', 'Portfolios', 'Sections'
        ].includes(item.text))
      },
      {
        title: 'System',
        items: items.filter(item => ['Languages', 'Chatbot Config', 'System Settings'].includes(item.text))
      }
    ];

    // Filter out empty groups
    return groups.filter(group => group.items.length > 0);
  };

  const menuGroups = createMenuGroups(menuItems);

  const drawer = (
    <div>
      <Toolbar sx={{ 
        justifyContent: 'center',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <Typography variant="h6" noWrap component="div" sx={{ 
          color: '#424242',
          fontWeight: 500,
          fontSize: '1.1rem',
          letterSpacing: '0.5px'
        }}>
          Admin Panel
        </Typography>
      </Toolbar>
      
      {menuGroups.map((group) => (
        <React.Fragment key={group.title}>
          <List
            subheader={
              <ListSubheader component="div" id={`${group.title}-subheader`} sx={{
                fontSize: '0.75rem',
                letterSpacing: '0.8px',
                color: '#757575',
                backgroundColor: '#fafafa',
                paddingLeft: 3
              }}>
                {group.title}
              </ListSubheader>
            }
          >
            {group.items.map((item) => (
              <ListItem 
                button 
                key={item.text} 
                component={Link} 
                to={item.path}
                selected={location.pathname === item.path}
                onClick={isMobile ? handleDrawerToggle : undefined}
                sx={{
                  pl: 3,
                  height: '44px',
                  '&.Mui-selected': {
                    backgroundColor: '#f0f0f0',
                    borderLeft: '3px solid #1976d2',
                    paddingLeft: '21px',
                    '&:hover': {
                      backgroundColor: '#e8e8e8'
                    }
                  },
                  '&:hover': {
                    backgroundColor: '#f5f5f5'
                  }
                }}
              >
                <ListItemIcon sx={{ 
                  minWidth: '40px',
                  color: location.pathname === item.path ? '#1976d2' : '#9e9e9e'
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{
                    fontSize: '0.85rem',
                    fontWeight: location.pathname === item.path ? 500 : 400,
                    color: location.pathname === item.path ? '#1976d2' : '#757575'
                  }}
                />
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 1, backgroundColor: '#f0f0f0' }} />
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar 
        position="fixed" 
        elevation={1}
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'white',
          color: '#424242'
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{
            fontWeight: 500,
            letterSpacing: '0.5px',
            flexGrow: 1
          }}>
            Portfolio Admin
          </Typography>
          
          {/* User menu */}
          <Box sx={{ flexGrow: 0, display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
              {username}
            </Typography>
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar 
                  alt={username} 
                  sx={{ 
                    width: 32, 
                    height: 32,
                    bgcolor: '#1976d2',
                    color: 'white',
                    fontSize: '0.875rem'
                  }}
                >
                  {username.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: '45px' }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              <MenuItem onClick={handleSettings}>
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Settings" />
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Logout" />
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          pt: 3, 
          pr: 3, 
          pb: 3, 
          pl: 0,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: '#fafafa',
          minHeight: '100vh'
        }}
      >
        <Toolbar />
        <Box sx={{ mt: 2, width: '100%' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default Layout; 