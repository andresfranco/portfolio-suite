import React, { useEffect, useContext } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import ProjectDetails from '../components/ProjectDetails';
import { usePortfolio } from '../context/PortfolioContext';
import { LanguageContext } from '../context/LanguageContext';

const ProjectDetailsPage = () => {
  const { projectId, lang } = useParams();
  const navigate = useNavigate();
  const { language, setLanguage } = useContext(LanguageContext);
  const { getProjects, loading } = usePortfolio();

  // Get projects from portfolio context
  const projects = getProjects();

  // Find project and validate data
  const currentProject = projects.find(p => p.id.toString() === projectId);
  const currentProjectIndex = projects.findIndex(p => p.id.toString() === projectId);

  // Sync language from URL prefix when present
  useEffect(() => {
    if (!lang) {
      return;
    }

    const supportedLanguages = ['en', 'es'];
    const normalizedLang = supportedLanguages.includes(lang) ? lang : 'en';

    if (normalizedLang !== language) {
      setLanguage(normalizedLang);
    }
  }, [lang, language, setLanguage]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [projectId]);

  // Show loading state during data fetch
  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-gray-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // If project is not found, show loading (don't redirect immediately)
  // This handles the case where portfolio data is being reloaded
  if (!currentProject) {
    return (
      <div className="flex-grow flex items-center justify-center bg-gray-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // Validate required project data (with API structure)
  // Only redirect if we have a project but it's missing required data
  if (!currentProject?.project_texts || currentProject.project_texts.length === 0) {
    console.error('Missing required project data:', currentProject);
    return <Navigate to="/projects" replace />;
  }

  const handleBackClick = () => {
    navigate('/projects');
  };

  const handlePrevious = () => {
    if (currentProjectIndex > 0) {
      const prevProject = projects[currentProjectIndex - 1];
      navigate(`/projects/${prevProject.id}`);
    }
  };

  const handleNext = () => {
    if (currentProjectIndex < projects.length - 1) {
      const nextProject = projects[currentProjectIndex + 1];
      navigate(`/projects/${nextProject.id}`);
    }
  };

  return (
    <div className="flex-grow">
      <ProjectDetails 
        project={currentProject}
        onBackClick={handleBackClick}
        onPreviousClick={currentProjectIndex > 0 ? handlePrevious : null}
        onNextClick={currentProjectIndex < projects.length - 1 ? handleNext : null}
        language={language}
      />
    </div>
  );
};

export default ProjectDetailsPage;
