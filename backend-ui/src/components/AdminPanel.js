import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Container,
  Divider,
  Collapse
} from '@mui/material';
import {
  People as PeopleIcon,
  VpnKey as VpnKeyIcon,
  LockPerson as PermissionIcon,
  Language as LanguageIcon,
  Translate as TranslateIcon,
  CollectionsBookmark as PortfolioIcon,
  ViewModule as SectionIcon,
  Business as ExperienceIcon,
  Code as ProjectIcon,
  Category as CategoryIcon,
  Class as CategoryTypeIcon,
  Psychology as SkillIcon,
  BrokenImage as SkillTypeIcon,
  ExpandLess,
  ExpandMore
} from '@mui/icons-material';
import UserIndex from './users/UserIndex';
import RoleIndex from './roles/RoleIndex';
import PermissionIndex from './permissions/PermissionIndex';
import LanguageIndex from './languages/LanguageIndex';
import TranslationIndex from './translations/TranslationIndex';
import PortfolioIndex from './portfolios/PortfolioIndex';
import SectionIndex from './sections/SectionIndex';
import ExperienceIndex from './experiences/ExperienceIndex';
import ProjectIndex from './projects/ProjectIndex';
import ProjectImages from './projects/ProjectImages';
import CategoryIndex from './categories/CategoryIndex';
import CategoryTypeIndex from './categorytypes/CategoryTypeIndex';
import SkillIndex from './skills/SkillIndex';
import SkillTypeIndex from './skilltypes/SkillTypeIndex';
import { UserProvider } from '../contexts/UserContext';
import ErrorBoundary from './common/ErrorBoundary';
import { LanguageProvider } from '../contexts/LanguageContext';
import { CategoryTypeProvider } from '../contexts/CategoryTypeContext';

const drawerWidth = 240;

function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [cmsOpen, setCmsOpen] = React.useState(true);

  const handleCmsClick = () => {
    setCmsOpen(!cmsOpen);
  };

  const adminMenuItems = [
    { text: 'Users', icon: <PeopleIcon />, path: '/users' },
    { text: 'Roles', icon: <VpnKeyIcon />, path: '/roles' },
    { text: 'Permissions', icon: <PermissionIcon />, path: '/permissions' }
  ];

  const cmsMenuItems = [
    { text: 'Languages', icon: <LanguageIcon />, path: '/languages' },
    { text: 'Translations', icon: <TranslateIcon />, path: '/translations' },
    { text: 'Portfolios', icon: <PortfolioIcon />, path: '/portfolios' },
    { text: 'Sections', icon: <SectionIcon />, path: '/sections' },
    { text: 'Experiences', icon: <ExperienceIcon />, path: '/experiences' },
    { text: 'Projects', icon: <ProjectIcon />, path: '/projects' },
    { text: 'Categories', icon: <CategoryIcon />, path: '/categories' },
    { text: 'Category Types', icon: <CategoryTypeIcon />, path: '/category-types' },
    { text: 'Skills', icon: <SkillIcon />, path: '/skills' },
    { text: 'Skill Types', icon: <SkillTypeIcon />, path: '/skill-types' }
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: '#fafafa',
            color: '#757575',
            borderRight: '1px solid #e0e0e0'
          },
        }}
      >
        <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0' }}>
          <Typography variant="h6" component="h2" sx={{ 
            color: '#424242', 
            mb: 2,
            fontWeight: 500,
            fontSize: '1.1rem',
            letterSpacing: '0.5px'
          }}>
            Admin Panel
          </Typography>
        </Box>
        <List>
          {adminMenuItems.map((item) => (
            <ListItem
              button
              key={item.text}
              onClick={() => navigate(item.path)}
              selected={location.pathname.includes(item.path)}
              sx={{
                height: '44px',
                '&.Mui-selected': {
                  backgroundColor: '#f0f0f0',
                  borderLeft: '3px solid #1976d2',
                  '&:hover': {
                    backgroundColor: '#e8e8e8',
                  },
                },
                '&:hover': {
                  backgroundColor: '#f5f5f5',
                },
              }}
            >
              <ListItemIcon sx={{ 
                minWidth: '40px',
                color: location.pathname.includes(item.path) ? '#1976d2' : '#9e9e9e'
              }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{
                  fontSize: '0.85rem',
                  fontWeight: location.pathname.includes(item.path) ? 500 : 400,
                  color: location.pathname.includes(item.path) ? '#1976d2' : '#757575'
                }}
              />
            </ListItem>
          ))}
          
          <Divider sx={{ my: 2, backgroundColor: '#f0f0f0' }} />
          
          <ListItem 
            button 
            onClick={handleCmsClick}
            sx={{
              height: '44px',
              '&:hover': {
                backgroundColor: '#f5f5f5',
              },
            }}
          >
            <ListItemText 
              primary="CMS Management" 
              primaryTypographyProps={{
                fontSize: '0.85rem',
                fontWeight: 500,
                color: '#616161'
              }}
            />
            {cmsOpen ? 
              <ExpandLess sx={{ color: '#9e9e9e' }} /> : 
              <ExpandMore sx={{ color: '#9e9e9e' }} />
            }
          </ListItem>
          
          <Collapse in={cmsOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {cmsMenuItems.map((item) => (
                <ListItem
                  button
                  key={item.text}
                  onClick={() => navigate(item.path)}
                  selected={location.pathname.includes(item.path)}
                  sx={{
                    pl: 4,
                    height: '44px',
                    '&.Mui-selected': {
                      backgroundColor: '#f0f0f0',
                      borderLeft: '3px solid #1976d2',
                      '&:hover': {
                        backgroundColor: '#e8e8e8',
                      },
                    },
                    '&:hover': {
                      backgroundColor: '#f5f5f5',
                    },
                  }}
                >
                  <ListItemIcon sx={{ 
                    minWidth: '40px',
                    color: location.pathname.includes(item.path) ? '#1976d2' : '#9e9e9e'
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text} 
                    primaryTypographyProps={{
                      fontSize: '0.85rem',
                      fontWeight: location.pathname.includes(item.path) ? 500 : 400,
                      color: location.pathname.includes(item.path) ? '#1976d2' : '#757575'
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: 3,
          pr: 0,
          pb: 3,
          pl: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: 'white',
          minHeight: '100vh'
        }}
      >
        <Box sx={{ width: '100%' }}>
          <Routes>
            <Route path="users" element={
              <ErrorBoundary>
                <UserProvider>
                  <UserIndex />
                </UserProvider>
              </ErrorBoundary>
            } />
            <Route path="roles" element={<RoleIndex />} />
            <Route path="permissions" element={<PermissionIndex />} />
            <Route path="languages" element={
              <ErrorBoundary>
                <LanguageProvider>
                  <LanguageIndex />
                </LanguageProvider>
              </ErrorBoundary>
            } />
            <Route path="translations" element={<TranslationIndex />} />
            <Route path="portfolios" element={<PortfolioIndex />} />
            <Route path="sections" element={<SectionIndex />} />
            <Route path="experiences" element={<ExperienceIndex />} />
            <Route path="projects" element={<ProjectIndex />} />
            <Route path="projects/:projectId/images" element={<ProjectImages />} />
            <Route path="categories" element={<CategoryIndex />} />
            <Route path="category-types" element={
              <ErrorBoundary>
                <CategoryTypeProvider>
                  <CategoryTypeIndex />
                </CategoryTypeProvider>
              </ErrorBoundary>
            } />
            <Route path="skills" element={<SkillIndex />} />
            <Route path="skill-types" element={<SkillTypeIndex />} />
            <Route path="/" element={
              <Typography variant="h4" component="h1" sx={{ mb: 4 }}>
                Welcome to the Dashboard
              </Typography>
            } />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}

export default AdminPanel;
