import React from 'react';
import { Box, Typography, Paper, Grid, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  People as PeopleIcon,
  VpnKey as VpnKeyIcon,
  Security as SecurityIcon,
  Code as CodeIcon,
  Category as CategoryIcon,
  Work as WorkIcon,
  Folder as ProjectIcon,
  Settings as SettingsIcon,
  Language as LanguageIcon,
  Chat as ChatIcon,
  List as ListIcon,
  FormatListBulleted as ListBulletedIcon,
  ViewModule as SectionIcon
} from '@mui/icons-material';
import { useAuthorization } from '../contexts/AuthorizationContext';

// Dashboard card component
const DashboardCard = ({ title, description, icon, link }) => (
  <Grid item xs={12} md={6} lg={4}>
    <Paper 
      sx={{ 
        p: 3, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box sx={{ color: 'primary.main', mr: 1 }}>
          {icon}
        </Box>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
        {description}
      </Typography>
      
      <Button 
        variant="outlined" 
        color="primary" 
        component={RouterLink} 
        to={link} 
        sx={{ alignSelf: 'flex-start' }}
      >
        Manage
      </Button>
    </Paper>
  </Grid>
);

const Dashboard = () => {
  // Authorization context for permission checking
  const { isSystemAdmin, hasPermission } = useAuthorization();

  // Dashboard cards data with required permissions
  const allCards = [
    {
      title: "User Management",
      description: "Manage users, assign roles, and control access to the application.",
      icon: <PeopleIcon />,
      link: "/users",
      requiredPermission: "VIEW_USERS"
    },
    {
      title: "Role Management",
      description: "Create and manage roles with specific permissions.",
      icon: <VpnKeyIcon />,
      link: "/roles",
      requiredPermission: "VIEW_ROLES"
    },
    {
      title: "Permission Management",
      description: "Define granular permissions for different actions within the application.",
      icon: <SecurityIcon />,
      link: "/permissions",
      requiredPermission: "VIEW_PERMISSIONS"
    },
    {
      title: "Section Management",
      description: "Manage website sections and organize multilingual content across different sections.",
      icon: <SectionIcon />,
      link: "/sections",
      requiredPermission: "VIEW_SECTIONS"
    },
    {
      title: "Skill Management",
      description: "Manage technical skills, soft skills, and other professional capabilities.",
      icon: <CodeIcon />,
      link: "/skills",
      requiredPermission: "VIEW_SKILLS"
    },
    {
      title: "Skill Types",
      description: "Define and manage different types of skills (e.g., programming languages, frameworks, soft skills).",
      icon: <ListIcon />,
      link: "/skill-types",
      requiredPermission: "VIEW_SKILL_TYPES"
    },
    {
      title: "Category Management",
      description: "Organize content using custom categories for better organization.",
      icon: <CategoryIcon />,
      link: "/categories",
      requiredPermission: "VIEW_CATEGORIES"
    },
    {
      title: "Category Types",
      description: "Define and manage different types of categories for organizing content.",
      icon: <ListBulletedIcon />,
      link: "/category-types",
      requiredPermission: "VIEW_CATEGORY_TYPES"
    },
    {
      title: "Experience Management",
      description: "Manage professional experiences, work history, and achievements.",
      icon: <WorkIcon />,
      link: "/experiences",
      requiredPermission: "VIEW_EXPERIENCES"
    },
    {
      title: "Project Management",
      description: "Showcase portfolio projects with descriptions, images, and links.",
      icon: <ProjectIcon />,
      link: "/projects",
      requiredPermission: "VIEW_PROJECTS"
    },
    {
      title: "Language Management",
      description: "Configure supported languages for multilingual content.",
      icon: <LanguageIcon />,
      link: "/languages",
      requiredPermission: "VIEW_LANGUAGES"
    },
    {
      title: "Chatbot Configuration",
      description: "Configure the AI chatbot that answers questions about your portfolio.",
      icon: <ChatIcon />,
      link: "/chatbot",
      requiredPermission: "SYSTEM_ADMIN" // Only system admin can access chatbot config
    },
    {
      title: "System Settings",
      description: "Configure global application settings and preferences.",
      icon: <SettingsIcon />,
      link: "/settings",
      requiredPermission: "SYSTEM_ADMIN" // Only system admin can access system settings
    }
  ];

  // Filter cards based on user permissions
  const filterCards = (cards) => {
    return cards.filter(card => {
      // System admin can see everything
      if (isSystemAdmin()) {
        return true;
      }
      
      // Check if user has the required permission for this dashboard card
      if (card.requiredPermission) {
        return hasPermission(card.requiredPermission);
      }
      
      // If no permission specified, show by default
      return true;
    });
  };

  // Get filtered cards
  const cards = filterCards(allCards);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        Portfolio Admin Dashboard
      </Typography>
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Welcome to your Portfolio Admin Panel
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This dashboard allows you to manage all aspects of your portfolio website. 
          Select a module below to get started.
        </Typography>
      </Box>
      
      {cards.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No modules available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You don't have permission to access any modules. Please contact your administrator.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {cards.map((card, index) => (
            <DashboardCard
              key={index}
              title={card.title}
              description={card.description}
              icon={card.icon}
              link={card.link}
            />
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default Dashboard; 