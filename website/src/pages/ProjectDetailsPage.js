import React, { useEffect, useContext } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import ProjectDetails from '../components/ProjectDetails';
import { usePortfolio } from '../context/PortfolioContext';
import { LanguageContext } from '../context/LanguageContext';
import { FaSpinner } from 'react-icons/fa6';

const ProjectDetailsPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);
  const { getProjects, loading } = usePortfolio();

  // Get projects from portfolio context
  const projects = getProjects();
  
  // Find project and validate data
  const currentProject = projects.find(p => p.id.toString() === projectId);
  const currentProjectIndex = projects.findIndex(p => p.id.toString() === projectId);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [projectId]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-gray-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // Handle project not found
  if (!currentProject) {
    return <Navigate to={`/${language}/projects`} replace />;
  }

  // Validate required project data (with API structure)
  if (!currentProject?.project_texts || currentProject.project_texts.length === 0) {
    console.error('Missing required project data:', currentProject);
    return <Navigate to={`/${language}/projects`} replace />;
  }

  const handleBackClick = () => {
    navigate(`/${language}/projects`);
  };

  const handlePrevious = () => {
    if (currentProjectIndex > 0) {
      const prevProject = projects[currentProjectIndex - 1];
      navigate(`/${language}/projects/${prevProject.id}`);
    }
  };

  const handleNext = () => {
    if (currentProjectIndex < projects.length - 1) {
      const nextProject = projects[currentProjectIndex + 1];
      navigate(`/${language}/projects/${nextProject.id}`);
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
