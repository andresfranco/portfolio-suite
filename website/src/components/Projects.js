import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { useSectionLabel } from '../hooks/useSectionLabel';
import { useContentEditor } from '../hooks/useContentEditor';
import { translations } from '../data/translations';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import DraggableProjectCard from './DraggableProjectCard';
import './DragAndDrop.css';
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
  const { portfolio, getProjects, getProjectText, loading, refreshPortfolio } = usePortfolio();
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
  const apiProjects = getProjects();
  
  // Local state for optimistic UI updates during drag and drop
  const [projects, setProjects] = useState([]);
  
  // Track if we're currently reordering to prevent sync conflicts
  const isReorderingRef = useRef(false);
  
  // Content editor hook for projects reordering
  const { reorderItems } = useContentEditor('project');
  
  // Sync local state with API data (but not during reordering)
  useEffect(() => {
    if (!isReorderingRef.current) {
      console.log('Syncing projects from API:', apiProjects);
      setProjects(apiProjects);
    }
  }, [apiProjects]);

  /**
   * Handle drag end event to reorder projects
   */
  const handleDragEnd = async (result) => {
    console.log('Drag end result:', result);
    
    // If dropped outside the list or no movement
    if (!result.destination) {
      console.log('No destination - dropped outside');
      return;
    }
    
    if (result.destination.index === result.source.index) {
      console.log('No movement - same position');
      return;
    }

    console.log(`Moving from index ${result.source.index} to ${result.destination.index}`);
    console.log('Current projects:', projects);

    // Set flag to prevent useEffect from resetting our optimistic update
    isReorderingRef.current = true;

    // Optimistically update the UI immediately
    const reorderedProjects = Array.from(projects);
    const [movedItem] = reorderedProjects.splice(result.source.index, 1);
    reorderedProjects.splice(result.destination.index, 0, movedItem);
    
    console.log('Reordered projects:', reorderedProjects);
    
    // Update local state immediately for instant feedback
    setProjects(reorderedProjects);

    // Get the new order of IDs
    const newOrderIds = reorderedProjects.map(proj => proj.id);
    console.log('New order IDs:', newOrderIds);

    try {
      // Persist the new order to the backend
      await reorderItems(newOrderIds, portfolio.id);
      
      // Wait a bit for the backend to process before allowing sync
      setTimeout(() => {
        isReorderingRef.current = false;
      }, 500);
    } catch (error) {
      console.error('Failed to reorder projects:', error);
      // Revert to original order on error
      setProjects(apiProjects);
      isReorderingRef.current = false;
      // The error notification is already shown by reorderItems
    }
  };

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
          <div className="relative w-full px-6 md:px-12 lg:px-[7vw] xl:px-[5vw] 2xl:px-[10vw] text-left">
            <div className="w-full">
            <h2 className="text-4xl xl:text-5xl 2xl:text-6xl font-bold text-white mb-4">
              {projectsTitle.renderEditable('text-4xl xl:text-5xl 2xl:text-6xl font-bold text-white')}
            </h2>
            <p className="text-white/60 text-base xl:text-lg 2xl:text-xl max-w-3xl">
              {translations[language]?.projects_intro ||
                'Showcasing selected engagements that blend strategy, data, and engineering craftsmanship.'}
            </p>

            {/* Project Management Controls (visible in edit mode) */}
            <div className="mt-10 text-left">
              <ProjectManagement />
            </div>

            {/* Projects List with Drag and Drop */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="projects-list" isDropDisabled={!isEditMode}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 xl:gap-10 mt-12 transition-all duration-300 droppable-container ${
                      snapshot.isDraggingOver && isEditMode 
                        ? 'gap-12 is-dragging-over' 
                        : ''
                    }`}
                    style={{
                      minHeight: snapshot.isDraggingOver ? '500px' : 'auto',
                      padding: snapshot.isDraggingOver ? '1.5rem' : '0',
                    }}
                  >
                    {projects.map((project, index) => {
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
                  <DraggableProjectCard
                    key={project.id}
                    project={project}
                    index={index}
                    isEditMode={isEditMode}
                    projectText={projectText}
                    projectImage={projectImage}
                    description={description}
                    tags={tags}
                    language={language}
                    translations={translations}
                    viewProjectLabel={viewProjectLabel}
                    onProjectClick={handleProjectClick}
                    onViewDetails={handleViewDetails}
                    onEdit={handleEditProject}
                    onDelete={handleDeleteProject}
                  />
                );
              })}
              {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
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
