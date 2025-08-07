import React, { useEffect, useContext } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import ProjectDetails from '../components/ProjectDetails';
import { projectsData } from '../data/projects';
import { LanguageContext } from '../context/LanguageContext';
import { FaSpinner } from 'react-icons/fa6';

const ProjectDetailsPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);

  // Find project and validate data
  const currentProject = projectsData.find(p => p.id.toString() === projectId);
  const currentProjectIndex = projectsData.findIndex(p => p.id.toString() === projectId);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [projectId]);

  // Handle project not found
  if (!currentProject) {
    return <Navigate to={`/${language}/projects`} replace />;
  }

  // Validate required project data
  if (!currentProject?.title?.[language] || !currentProject?.description?.[language]) {
    console.error('Missing required project data:', currentProject);
    return <Navigate to={`/${language}/projects`} replace />;
  }

  const handleBackClick = () => {
    navigate(`/${language}/projects`);
  };

  const handlePrevious = () => {
    if (currentProjectIndex > 0) {
      const prevProject = projectsData[currentProjectIndex - 1];
      navigate(`/${language}/projects/${prevProject.id}`);
    }
  };

  const handleNext = () => {
    if (currentProjectIndex < projectsData.length - 1) {
      const nextProject = projectsData[currentProjectIndex + 1];
      navigate(`/${language}/projects/${nextProject.id}`);
    }
  };

  return (
    <div className="flex-grow">
      <ProjectDetails 
        project={currentProject}
        onBackClick={handleBackClick}
        onPreviousClick={currentProjectIndex > 0 ? handlePrevious : null}
        onNextClick={currentProjectIndex < projectsData.length - 1 ? handleNext : null}
        language={language}
      />
    </div>
  );
};

export default ProjectDetailsPage;
