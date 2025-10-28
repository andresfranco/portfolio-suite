import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { useSectionLabel } from '../hooks/useSectionLabel';
import { translations } from '../data/translations';
import { InlineTextEditor } from './cms';
import ProjectDetails from './ProjectDetails';

const ProjectModal = ({ project, onClose, onViewDetails, language, getProjectText }) => {
  const projectText = getProjectText(project);
  const { isEditMode } = useEditMode();
  
  // Get editable labels
  const closeLabel = useSectionLabel('BTN_CLOSE', 'close');
  const viewDetailsLabel = useSectionLabel('BTN_VIEW_FULL_DETAILS', 'view_full_details');
  
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 w-full max-w-4xl rounded-xl overflow-hidden max-h-[90vh]">
        <div className="border-b border-gray-800 p-4 flex justify-between items-center">
          <h3 className="text-white text-xl md:text-2xl font-bold">
            {/* Editable project name in edit mode */}
            {isEditMode && projectText.id ? (
              <InlineTextEditor
                value={projectText.name || 'Project'}
                entityType="project"
                entityId={projectText.id}
                fieldName="name"
                className="text-white text-xl md:text-2xl font-bold"
                placeholder="Enter project name..."
              />
            ) : (
              projectText.name || 'Project'
            )}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2"
            aria-label={closeLabel.value}
          >
            ✕
          </button>
        </div>
        <div className="p-4 md:p-6 overflow-y-auto">
          {project.images && project.images.length > 0 && (
            <img 
              src={`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${project.images[0].image_path}`}
              alt={projectText.name}
              className="w-full h-48 md:h-64 object-cover rounded-lg mb-4 md:mb-6"
            />
          )}
          <div className="text-gray-300 text-base md:text-lg mb-6">
            {/* Editable project description in edit mode */}
            {isEditMode && projectText.id ? (
              <InlineTextEditor
                value={projectText.description || ''}
                entityType="project"
                entityId={projectText.id}
                fieldName="description"
                className="text-gray-300 text-base md:text-lg"
                placeholder="Enter project description..."
                multiline={true}
              />
            ) : (
              <p>{projectText.description || ''}</p>
            )}
          </div>
          <button
            onClick={onViewDetails}
            className="inline-block bg-[#14C800] text-white px-6 py-3 rounded-lg
              transition-all duration-300 hover:bg-[#14C800]/90 
              hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)]
              transform hover:-translate-y-1 text-base md:text-lg"
          >
            {viewDetailsLabel.renderEditable('inline-block bg-[#14C800] text-white px-6 py-3 rounded-lg')}
          </button>
        </div>
      </div>
    </div>
  );
};

const Projects = () => {
  const [selectedProject, setSelectedProject] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);
  const { getProjects, getProjectText, loading } = usePortfolio();

  // Get editable section labels
  const projectsTitle = useSectionLabel('SECTION_PROJECTS', 'projects');
  const loadingText = useSectionLabel('MSG_LOADING_PROJECTS', 'loading_projects');

  // Get projects from portfolio context
  const projects = getProjects();

  const handleProjectClick = (project) => {
    setSelectedProject(project);
    setShowModal(true);
  };

  const handleViewDetails = (projectId) => {
    setShowModal(false);
    const route = language === 'en' ? `/projects/${projectId}` : `/${language}/projects/${projectId}`;
    navigate(route);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center bg-gray-800 min-h-screen">
        <div className="text-white text-2xl">
          {loadingText.renderEditable('text-white text-2xl')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow">
      <main className="pt-20">
        <section className="py-20 bg-gray-800">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold mb-8 text-white">
              {projectsTitle.renderEditable('text-4xl font-bold mb-8 text-white')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
              {projects.map((project) => {
                const projectText = getProjectText(project);
                const projectImage = project.images && project.images.length > 0
                  ? `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${project.images[0].image_path}`
                  : require('../assets/images/project1.jpg'); // fallback image
                
                return (
                  <div
                    key={project.id}
                    onClick={() => handleProjectClick(project)}
                    className="relative group cursor-pointer rounded-xl overflow-hidden
                      transition-all duration-300
                      hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)]
                      transform hover:-translate-y-1
                      aspect-[4/3]"
                  >
                    <img
                      src={projectImage}
                      alt={projectText.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/75 md:bg-black/40 
                      md:opacity-0 md:group-hover:opacity-100
                      md:group-hover:bg-black/85 transition-all duration-300 
                      flex items-center justify-center">
                      <h3 className="text-white text-xl md:text-2xl font-bold text-center px-4
                        md:opacity-0 md:group-hover:opacity-100 transform 
                        transition-all duration-300
                        md:translate-y-4 md:group-hover:translate-y-0">
                        {projectText.name}
                      </h3>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {showModal && selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setShowModal(false)}
          onViewDetails={() => handleViewDetails(selectedProject.id)}
          language={language}
          getProjectText={getProjectText}
        />
      )}
    </div>
  );
};

export default Projects;
