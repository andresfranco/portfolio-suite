import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SnackbarProvider } from 'notistack';
import './App.css';
import theme from './theme';
import { UserProvider } from './contexts/UserContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthorizationProvider, useAuthorization } from './contexts/AuthorizationContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import { UserIndex } from './components/users';
import Login from './components/Login';
import authService from './services/authService';
import LanguageIndex from './components/languages/LanguageIndex';
import useIdleSession from './hooks/useIdleSession';
import systemSettingsApi from './services/systemSettingsApi';
import SystemSettings from './components/settings/SystemSettings';
import RagAdmin from './components/rag/RagAdmin';
import AgentAdmin from './components/agents/AgentAdmin';
import AgentChat from './components/agents/AgentChat';
import { AgentAdminProvider } from './contexts/AgentAdminContext';

// Importing actual components for previously working modules
import { RoleIndex } from './components/roles';
import { PermissionIndex } from './components/permissions';
import { SkillTypeIndex } from './components/skill-types';
import { CategoryTypeProvider } from './contexts/CategoryTypeContext';
import CategoryTypeIndex from './components/categorytypes/CategoryTypeIndex';
import { CategoryProvider } from './contexts/CategoryContext';
import CategoryIndex from './components/categories/CategoryIndex';
import { SkillProvider } from './contexts/SkillContext';
import { SkillTypeProvider } from './contexts/SkillTypeContext';
import SkillIndex from './components/skills/SkillIndex';
import { ExperienceProvider } from './contexts/ExperienceContext';
import ExperienceIndex from './components/experiences/ExperienceIndex';
import { ProjectProvider } from './contexts/ProjectContext';
import ProjectIndex from './components/projects/ProjectIndex';
import ProjectImages from './components/projects/ProjectImages';
import ProjectAttachments from './components/projects/ProjectAttachments';
import PortfolioIndex from './components/portfolios/PortfolioIndex';
import PortfolioAttachments from './components/portfolios/PortfolioAttachments';
import SectionIndex from './components/sections/SectionIndex';

import NotFound from './pages/NotFound';

// Import other module pages
// In a real implementation, these would be actual imports
const ChatbotConfig = () => <div><h2>Chatbot Configuration</h2><p>This page is under development</p></div>;

// Wrapper component to access AuthorizationContext
function AppContent() {
  const [loading, setLoading] = useState(true);
  const { checkAuthState, isAuthenticated: authContextAuthenticated } = useAuthorization();
  const [idleMs, setIdleMs] = useState(30 * 60 * 1000);
  
  // Use the authentication state from AuthorizationContext instead of local state
  const isAuthenticated = authContextAuthenticated();
  
  useEffect(() => {
    // Check authentication status when the app loads
    const checkAuth = () => {
      // Clear the token if it's invalid
      if (!authService.isAuthenticated()) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refresh_token');
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Load idle timeout from system settings
  useEffect(() => {
    (async () => {
      try {
        const res = await systemSettingsApi.get('frontend.idle_timeout_minutes');
        const v = parseInt(res.data?.value || '30', 10);
        if (!Number.isNaN(v) && v > 0) setIdleMs(v * 60 * 1000);
      } catch (_) {
        // fallback stays 30m
      }
    })();
  }, []);

  // Inactivity logout handler
  const onIdle = useCallback(() => {
    if (authContextAuthenticated()) {
      authService.logout();
    }
  }, [authContextAuthenticated]);

  // Optional warn callback: could show a snackbar/modal later
  const onWarn = useCallback(() => {
    // no-op for now
  }, []);

  // Start idle session tracking only when authenticated
  useIdleSession({
    idleMs,
    warnMs: 60 * 1000,      // warn 1 minute before
    onIdle,
    onWarn,
  });

  const handleLogin = async (username, password) => {
    try {
      await authService.login(username, password);
      
      // Immediately trigger permission loading after successful login
      setTimeout(() => {
        checkAuthState();
      }, 100); // Small delay to ensure token is stored
      
      return true;
    } catch (error) {
      // Avoid extra logging for expected authentication errors
      if (!error.isAuthError && 
          error.response?.status !== 401 && 
          !error.message?.includes('Invalid')) {
        console.error('Login error:', error);
      }
      
      // Pass the error to the UI component to display
      throw error;
    }
  };
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return (
    <Router>
      <UserProvider>
        {/* Login route outside of Layout */}
        <Routes>
          <Route path="/login" element={
            isAuthenticated ? 
              <Navigate to="/" replace /> : 
              <Login onLogin={handleLogin} />
          } />
          
          {/* Protected routes within Layout - wrapped with shared CategoryTypeProvider */}
          <Route path="/" element={
            isAuthenticated ? (
              // Wrap the entire protected application with a single LanguageProvider
              // to avoid remounting it per-route (which caused repeated /api/languages fetches)
              <LanguageProvider>
                <CategoryTypeProvider>
                  <Layout />
                </CategoryTypeProvider>
              </LanguageProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          }>
            <Route index element={<Dashboard />} />
            
            {/* User Management */}
            <Route path="users" element={<UserIndex />} />
            <Route path="roles" element={<RoleIndex />} />
            <Route path="permissions" element={<PermissionIndex />} />
            
            {/* Content Management - Wrapped in shared providers */}
            <Route path="skills" element={
              <CategoryProvider>
                <SkillTypeProvider>
                  <SkillProvider>
                    <SkillIndex />
                  </SkillProvider>
                </SkillTypeProvider>
              </CategoryProvider>
            } />
            <Route path="skill-types" element={<SkillTypeIndex />} />
            <Route path="categories" element={
              <CategoryProvider>
                <CategoryIndex />
              </CategoryProvider>
            } />
            <Route path="category-types" element={<CategoryTypeIndex />} />
            <Route path="experiences" element={
              <ExperienceProvider>
                <ExperienceIndex />
              </ExperienceProvider>
            } />
            <Route path="projects" element={
              <CategoryProvider>
                <ProjectProvider>
                  <ProjectIndex />
                </ProjectProvider>
              </CategoryProvider>
            } />
            <Route path="projects/:projectId/images" element={<ProjectImages />} />
            <Route path="projects/:projectId/attachments" element={<ProjectAttachments />} />
            <Route path="portfolios" element={<PortfolioIndex />} />
            <Route path="portfolios/:portfolioId/attachments" element={<PortfolioAttachments />} />
            <Route path="sections" element={<SectionIndex />} />
            
            {/* System Settings */}
            <Route path="languages" element={
              <LanguageIndex />
            } />
            <Route path="agents" element={
              <AgentAdminProvider>
                <AgentAdmin />
              </AgentAdminProvider>
            } />
            <Route path="agent-chat" element={
              <AgentAdminProvider>
                <AgentChat />
              </AgentAdminProvider>
            } />
            <Route path="chatbot" element={<ChatbotConfig />} />
            <Route path="settings" element={<SystemSettings />} />
            <Route path="rag-admin" element={<RagAdmin />} />
            
            {/* 404 Not Found */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </UserProvider>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} autoHideDuration={3000}>
        <AuthorizationProvider>
          <AppContent />
        </AuthorizationProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
