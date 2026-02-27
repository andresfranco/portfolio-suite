import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Projects from './components/Projects';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import { LanguageProvider } from './context/LanguageContext';
import { PortfolioProvider, usePortfolio } from './context/PortfolioContext';
import { EditModeProvider } from './context/EditModeContext';
import ErrorBoundary from './components/ErrorBoundary';

// Lazily loaded pages — only fetched when the user navigates to them
const ProjectDetailsPage = lazy(() => import('./pages/ProjectDetailsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ExperienceDetailsPage = lazy(() => import('./pages/ExperienceDetailsPage'));

// Lazily loaded CMS/utility components — not needed on first render
const ChatModal = lazy(() => import('./components/ChatModal'));
const EditModeIndicator = lazy(() =>
  import('./components/cms/EditModeIndicator').then(m => ({ default: m.EditModeIndicator }))
);

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
                <Suspense fallback={null}>
                  <EditModeIndicator />
                </Suspense>

                <Header />
                <div role="main" className="flex-grow w-full">
                  <Suspense fallback={<div className="flex-grow" />}>
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
                  </Suspense>
                </div>
                <Footer />
                <Suspense fallback={null}>
                  <ChatModal />
                </Suspense>
              </div>
            </ErrorBoundary>
          </BrowserRouter>
        </EditModeProvider>
      </PortfolioProvider>
    </LanguageProvider>
  );
}

export default App;
