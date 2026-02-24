import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Projects from './components/Projects';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ProjectDetailsPage from './pages/ProjectDetailsPage';
import ContactPage from './pages/ContactPage';
import ChatModal from './components/ChatModal';
import { LanguageProvider } from './context/LanguageContext';
import { PortfolioProvider, usePortfolio } from './context/PortfolioContext';
import { EditModeProvider } from './context/EditModeContext';
import { EditModeIndicator } from './components/cms/EditModeIndicator';
import ErrorBoundary from './components/ErrorBoundary';
import ExperienceDetailsPage from './pages/ExperienceDetailsPage';

function DocumentTitle() {
  const { portfolio } = usePortfolio();
  useEffect(() => {
    if (portfolio?.name) {
      document.title = portfolio.name;
    }
  }, [portfolio?.name]);
  return null;
}

function App() {
  return (
    <LanguageProvider>
      <PortfolioProvider>
        <DocumentTitle />
        <EditModeProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <div className="min-h-screen w-full flex flex-col bg-[#03060a] text-white">
                {/* Edit Mode Indicator - only visible when in edit mode via backend */}
                <EditModeIndicator />
                
                <Header />
                <div role="main" className="flex-grow w-full">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    {/* Base routes */}
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    {/* Language prefixed routes */}
                    <Route path="/:lang/projects" element={<Projects />} />
                    <Route path="/:lang/projects/:projectId" element={<ProjectDetailsPage />} />
                    <Route path="/:lang/contact" element={<ContactPage />} />
                    <Route path="/experience/:experienceId" element={<ExperienceDetailsPage />} />
                    <Route path="/:lang/experience/:experienceId" element={<ExperienceDetailsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </div>
                <Footer />
                <ChatModal />
              </div>
            </ErrorBoundary>
          </BrowserRouter>
        </EditModeProvider>
      </PortfolioProvider>
    </LanguageProvider>
  );
}

export default App;
