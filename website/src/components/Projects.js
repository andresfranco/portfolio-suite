import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { useSectionLabel } from '../hooks/useSectionLabel';
import { translations } from '../data/translations';
import { 
  InlineTextEditor, 
  ProjectImageSelector,
  ProjectManagement,
  ProjectActionButtons,
  ProjectFormDialog,
  ProjectDeleteDialog
} from './cms';
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
            className="btn-flat btn-flat-sm text-white/70 hover:text-white"
            aria-label={closeLabel.value}
          >
            ✕
          </button>
        </div>
        <div className="p-4 md:p-6 overflow-y-auto">
          {project.images && project.images.length > 0 && (() => {
            const thumbnailImage = project.images.find(img => img.category === 'PROI-THUMBNAIL') || project.images[0];
            const imageUrl = thumbnailImage.image_url 
              ? `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${thumbnailImage.image_url}`
              : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/uploads/${thumbnailImage.image_path}`;
            
            return (
              <img 
                src={imageUrl}
                alt={projectText.name}
                className="w-full h-48 md:h-64 object-contain bg-gray-800 rounded-lg mb-4 md:mb-6"
              />
            );
          })()}
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
            className="btn-flat btn-flat-lg w-full md:w-auto justify-center"
          >
            {viewDetailsLabel.renderEditable('font-semibold text-white')}
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
  const { lang } = useParams();
  const { language, setLanguage } = useContext(LanguageContext);
  const { getProjects, getProjectText, loading, refreshPortfolio } = usePortfolio();
  const { isEditMode, authToken, showNotification } = useEditMode();

  // Edit mode states
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);

  // Get editable section labels
  const projectsTitle = useSectionLabel('SECTION_PROJECTS', 'projects');
  const loadingText = useSectionLabel('MSG_LOADING_PROJECTS', 'loading_projects');
  const viewProjectLabel = useSectionLabel('BTN_VIEW_PROJECT', 'view_project');

  // Get projects from portfolio context
  const projects = getProjects();

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

  const handleProjectClick = (project, isCtrlClick = false) => {
    // Allow Ctrl/Cmd+click to open modal even in edit mode
    // Otherwise, don't open project modal in edit mode
    if (isEditMode && !isCtrlClick) return;
    
    setSelectedProject(project);
    setShowModal(true);
  };

  const handleViewDetails = (projectId) => {
    setShowModal(false);
    navigate(`/projects/${projectId}`);
  };

  // Edit mode handlers
  const handleEditProject = (project) => {
    setProjectToEdit(project);
    setShowEditDialog(true);
  };

  const handleDeleteProject = (project) => {
    setProjectToDelete(project);
    setShowDeleteDialog(true);
  };

  const handleEditSuccess = () => {
    setShowEditDialog(false);
    setProjectToEdit(null);
    refreshPortfolio();
    showNotification('Success', 'Project updated successfully', 'success');
  };

  const handleDeleteSuccess = () => {
    setShowDeleteDialog(false);
    setProjectToDelete(null);
    refreshPortfolio();
    showNotification('Success', 'Project deleted successfully', 'success');
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
    <div className="flex-grow bg-[#03060a]">
      <main>
        <section className="relative bg-[#03060a] pt-20 pb-24 border-t border-white/5">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
          <div className="relative w-full px-6 md:px-12 lg:px-[7vw] text-left">
            <div className="w-full max-w-[1200px]">
            <h2 className="text-4xl font-bold text-white mb-4">
              {projectsTitle.renderEditable('text-4xl font-bold text-white')}
            </h2>
            <p className="text-white/60 max-w-2xl">
              {translations[language]?.projects_intro ||
                'Showcasing selected engagements that blend strategy, data, and engineering craftsmanship.'}
            </p>

            {/* Project Management Controls (visible in edit mode) */}
            <div className="mt-10 text-left">
              <ProjectManagement />
            </div>

            <div className="space-y-10 mt-12">
              {projects.map((project) => {
                const projectText = getProjectText(project);
                const projectImageData = project.images && project.images.length > 0 ? project.images[0] : null;
                const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000';
                const projectImage = projectImageData
                  ? projectImageData.image_url
                    ? projectImageData.image_url.startsWith('http')
                      ? projectImageData.image_url
                      : `${apiBase}${projectImageData.image_url}`
                    : projectImageData.image_path?.startsWith('http')
                      ? projectImageData.image_path
                      : `${apiBase}/${projectImageData.image_path}`
                  : require('../assets/images/project1.jpg'); // fallback image

                const description =
                  projectText.brief ||
                  projectText.description ||
                  translations[language]?.project_description_fallback ||
                  'Project details will be available soon.';

                const getCategoryName = (category) => {
                  if (!category) return null;
                  if (category.category_texts && category.category_texts.length > 0) {
                    const byLanguage = category.category_texts.find(
                      (text) =>
                        text.language_code === language ||
                        text.language_id === (language === 'en' ? 1 : 2)
                    );
                    if (byLanguage?.name) {
                      return byLanguage.name;
                    }
                    return category.category_texts[0].name || null;
                  }
                  return category.name || category.code || null;
                };

                const getSkillName = (skill) => {
                  if (!skill) return null;
                  if (skill.skill_texts && skill.skill_texts.length > 0) {
                    const byLanguage = skill.skill_texts.find(
                      (text) =>
                        text.language_code === language ||
                        text.language_id === (language === 'en' ? 1 : 2)
                    );
                    if (byLanguage?.name) {
                      return byLanguage.name;
                    }
                    return skill.skill_texts[0].name || null;
                  }
                  return skill.name || skill.type || null;
                };

                const tags = Array.from(
                  new Set(
                    [
                      ...(project.categories || []).map(getCategoryName),
                      ...(project.skills || []).map(getSkillName),
                    ].filter(Boolean)
                  )
                ).slice(0, 6);
                
                return (
                  <div
                    key={project.id}
                    onClick={(e) => {
                      // Don't open modal if event was already handled (defaultPrevented)
                      if (e.defaultPrevented) return;
                      
                      // Check if Ctrl/Cmd key is pressed
                      const isCtrlClick = e.ctrlKey || e.metaKey;
                      
                      // Call handler with Ctrl/Cmd flag
                      handleProjectClick(project, isCtrlClick);
                    }}
                    className="relative group cursor-pointer overflow-hidden border border-white/10 bg-gradient-to-br from-black/80 via-[#0c1624]/70 to-[#050b12]/70 shadow-[0_25px_60px_rgba(8,12,20,0.4)] transition-transform duration-300 hover:scale-[1.01] hover:shadow-[0_30px_70px_rgba(20,200,0,0.18)]"
                  >
                    {/* Edit/Delete Action Buttons (visible in edit mode) */}
                    <ProjectActionButtons
                      project={project}
                      onEdit={handleEditProject}
                      onDelete={handleDeleteProject}
                    />

                    <div className="flex flex-col lg:flex-row">
                      <div className="relative lg:w-2/5 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#14C800]/15 via-transparent to-black/60 pointer-events-none mix-blend-screen" />
                        {/* Project Thumbnail with Edit Capability */}
                        <ProjectImageSelector
                          project={project}
                          category="thumbnail"
                          currentImagePath={projectImage}
                          alt={projectText.name}
                          className="w-full h-64 lg:h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>

                      <div className="flex-1 bg-black/40 backdrop-blur-sm p-6 lg:p-10 flex flex-col gap-6">
                        <div className="space-y-3">
                          <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                            {projectText.name}
                          </h3>
                          <p className="text-white/70 text-base md:text-lg leading-relaxed">
                            {description}
                          </p>
                        </div>

                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-3">
                            {tags.map((tag) => (
                              <span
                                key={`${project.id}-${tag}`}
                                className="chip chip-sm"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="text-white/60 text-sm uppercase tracking-[0.2em]">
                            {translations[language]?.project_cta_hint || 'Discover the details'}
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleViewDetails(project.id);
                            }}
                            className="btn-flat btn-flat-lg inline-flex items-center justify-center gap-2 font-semibold"
                          >
                            {viewProjectLabel.renderEditable('font-semibold text-white')}
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 7l5 5m0 0l-5 5m5-5H6"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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

      {/* Edit Project Dialog */}
      {showEditDialog && projectToEdit && (
        <ProjectFormDialog
          mode="edit"
          project={projectToEdit}
          onClose={() => {
            setShowEditDialog(false);
            setProjectToEdit(null);
          }}
          onSuccess={handleEditSuccess}
          authToken={authToken}
          language={language}
        />
      )}

      {/* Delete Project Dialog */}
      {showDeleteDialog && projectToDelete && (
        <ProjectDeleteDialog
          project={projectToDelete}
          onClose={() => {
            setShowDeleteDialog(false);
            setProjectToDelete(null);
          }}
          onSuccess={handleDeleteSuccess}
          authToken={authToken}
        />
      )}
    </div>
  );
};

export default Projects;
