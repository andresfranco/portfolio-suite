import React, { useContext, useState, useEffect, useRef, Suspense } from 'react';
import { FaGithub, FaGlobe, FaCalendar, FaFolder, FaArrowLeft, FaArrowRight, FaPencil, FaDownload, FaPlus } from 'react-icons/fa6';
import { translations } from '../data/translations';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { useSectionLabel } from '../hooks/useSectionLabel';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import DraggableProjectSection from './DraggableProjectSection';
import DraggableProjectSectionWrapper from './DraggableProjectSectionWrapper';
import EditableProjectSection from './EditableProjectSection';
import './DragAndDrop.css';
import { InlineTextEditor } from './cms/InlineTextEditor';
import { ProjectImageSelector } from './cms/ProjectImageSelector';
import { ProjectMetadataEditor } from './cms/ProjectMetadataEditor';
// SectionEditorDialog contains Tiptap + Monaco — lazy-load so it never lands in the main bundle
const SectionEditorDialog = React.lazy(() =>
  import('./cms/ProjectSectionManager').then(m => ({ default: m.SectionEditorDialog }))
);
import portfolioApi from '../services/portfolioApi';

const ProjectDetails = ({ project, onBackClick, onPreviousClick, onNextClick }) => {
  const { language } = useContext(LanguageContext);
  const { getProjectText, refreshPortfolio } = usePortfolio();
  const { isEditMode, authToken, showNotification } = useEditMode();
  const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [confirmDeleteSection, setConfirmDeleteSection] = useState(null);
  const [showSkillsManager, setShowSkillsManager] = useState(false);
  const [selectedSkillsToRemove, setSelectedSkillsToRemove] = useState(new Set());

  // State for main section ordering (UI layout)
  const defaultSectionOrder = ['title', 'image', 'description', 'skills', 'sections'];
  const [sectionOrder, setSectionOrder] = useState(defaultSectionOrder);
  const isReorderingRef = useRef(false);
  
  // Ref to scroll to skills section
  const skillsSectionRef = useRef(null);

  // State for project sections ordering (actual database sections)
  const [projectSections, setProjectSections] = useState([]);
  const isReorderingSectionsRef = useRef(false);

  // Update project sections when project data changes
  useEffect(() => {
    if (project?.sections) {
      
      // Sort sections directly without cleanup (cleanup already done in backend script)
      const sortedSections = [...project.sections].sort(
        (a, b) => (a.display_order || 0) - (b.display_order || 0)
      );
      
      setProjectSections(sortedSections);
    }
  }, [project]);

  /**
   * Handle drag end event for main sections
   */
  const handleMainSectionDragEnd = (result) => {
    
    if (!result.destination) {
      return;
    }
    
    if (result.destination.index === result.source.index) {
      return;
    }


    // Reorder the sections array
    const reorderedSections = Array.from(sectionOrder);
    const [movedSection] = reorderedSections.splice(result.source.index, 1);
    reorderedSections.splice(result.destination.index, 0, movedSection);
    
    
    // Update local state immediately for instant feedback
    setSectionOrder(reorderedSections);
    
    // Save UI layout preference to localStorage
    // (Note: Main sections are UI layout, not database entities)
    try {
      localStorage.setItem(`project-${project.id}-section-order`, JSON.stringify(reorderedSections));
    } catch (error) {
      console.error('Failed to save section order:', error);
    }
  };

  // Load saved section order from localStorage on mount
  useEffect(() => {
    if (project?.id) {
      try {
        const saved = localStorage.getItem(`project-${project.id}-section-order`);
        if (saved) {
          setSectionOrder(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load section order:', error);
      }
    }
  }, [project?.id]);

  /**
   * Handle drag end event for project sections (database entities)
   */
  const handleProjectSectionsDragEnd = async (result) => {
    
    if (!result.destination) {
      return;
    }
    
    if (result.destination.index === result.source.index) {
      return;
    }

    // Prevent concurrent reordering operations
    if (isReorderingSectionsRef.current) {
      return;
    }

    isReorderingSectionsRef.current = true;


    // Reorder the sections array
    const reorderedSections = Array.from(projectSections);
    const [movedSection] = reorderedSections.splice(result.source.index, 1);
    reorderedSections.splice(result.destination.index, 0, movedSection);
    
    
    // Update local state immediately for instant feedback
    setProjectSections(reorderedSections);
    
    // Check conditions for backend save
    
    // Persist to backend API
    if (isEditMode && authToken && project?.id) {
      try {
        const sectionIds = reorderedSections.map(section => section.id);
        
        const response = await portfolioApi.reorderProjectSections(project.id, sectionIds, authToken);
        
        // Show success notification
        if (showNotification) {
          showNotification(
            'Section Order Updated',
            'The section order has been saved successfully.',
            'success'
          );
        }
        
        // Refresh portfolio data to sync with backend
        await refreshPortfolio();
      } catch (error) {
        console.error('[REORDER] Failed to save project sections order:', error);
        console.error('[REORDER] Error details:', {
          message: error.message,
          stack: error.stack
        });
        
        // Show error notification
        if (showNotification) {
          showNotification(
            'Save Failed',
            `Failed to save section order: ${error.message || 'Unknown error'}`,
            'error'
          );
        }
        
        // Revert to original order on error
        if (project?.sections) {
          const originalSections = [...project.sections].sort(
            (a, b) => (a.display_order || 0) - (b.display_order || 0)
          );
          setProjectSections(originalSections);
        }
      }
    } else {
      
      // Show warning notification
      if (showNotification) {
        const reasons = [];
        if (!isEditMode) reasons.push('Not in edit mode');
        if (!authToken) reasons.push('No auth token');
        if (!project?.id) reasons.push('No project loaded');
        
        showNotification(
          'Cannot Save Order',
          `Changes not saved to backend: ${reasons.join(', ')}. ${!isEditMode ? 'Activate Edit Mode first.' : ''}`,
          'warning'
        );
      }
    }

    // Small delay before allowing next reorder
    setTimeout(() => {
      isReorderingSectionsRef.current = false;
    }, 500);
  };

  /**
   * Handle skill removal
   */
  const handleRemoveSkill = async (skillId) => {
    if (!authToken || !project?.id) return;

    try {
      await portfolioApi.removeSkillFromProject(project.id, skillId, authToken);
      await refreshPortfolio();
      showNotification('Skill Removed', 'The skill has been removed from this project.', 'success');
      
      // Scroll to skills section to keep focus
      setTimeout(() => {
        skillsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (error) {
      console.error('Failed to remove skill:', error);
      showNotification('Remove Failed', error.message || 'Failed to remove skill', 'error');
    }
  };

  /**
   * Handle multiple skills removal
   */
  const handleRemoveSelectedSkills = async () => {
    if (!authToken || !project?.id || selectedSkillsToRemove.size === 0) return;

    try {
      let successCount = 0;
      let failCount = 0;

      // Remove skills in parallel
      const promises = Array.from(selectedSkillsToRemove).map(async (skillId) => {
        try {
          await portfolioApi.removeSkillFromProject(project.id, skillId, authToken);
          successCount++;
        } catch (error) {
          console.error(`Failed to remove skill ${skillId}:`, error);
          failCount++;
        }
      });

      await Promise.all(promises);

      if (successCount > 0) {
        await refreshPortfolio();
        setSelectedSkillsToRemove(new Set());
        showNotification(
          'Skills Removed', 
          `Successfully removed ${successCount} skill${successCount > 1 ? 's' : ''} from this project.`, 
          'success'
        );
        
        // Scroll to skills section to keep focus
        setTimeout(() => {
          skillsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }

      if (failCount > 0) {
        showNotification('Partial Failure', `Failed to remove ${failCount} skill(s)`, 'error');
      }
    } catch (error) {
      console.error('Failed to remove skills:', error);
      showNotification('Remove Failed', error.message || 'Failed to remove skills', 'error');
    }
  };

  /**
   * Toggle skill selection for removal
   */
  const toggleSkillSelection = (skillId) => {
    const newSelection = new Set(selectedSkillsToRemove);
    if (newSelection.has(skillId)) {
      newSelection.delete(skillId);
    } else {
      newSelection.add(skillId);
    }
    setSelectedSkillsToRemove(newSelection);
  };

  /**
   * Select all skills for removal
   */
  const selectAllSkills = () => {
    if (project.skills && project.skills.length > 0) {
      const allSkillIds = new Set(project.skills.map(s => s.id));
      setSelectedSkillsToRemove(allSkillIds);
    }
  };

  /**
   * Clear skill selection
   */
  const clearSkillSelection = () => {
    setSelectedSkillsToRemove(new Set());
  };

  /**
   * Handle metadata update - refresh portfolio data
   */
  const handleMetadataUpdate = async () => {
    await refreshPortfolio();
  };

  /**
   * Handle section edit
   */
  const handleEditSection = (section) => {
    // Simply set the section - cleanup already happened in useEffect
    setEditingSection(section);
  };

  /**
   * Handle section delete
   */
  const handleDeleteSection = (sectionId) => {
    setConfirmDeleteSection(sectionId);
  };

  /**
   * Confirm section deletion
   */
  const confirmSectionDeletion = async () => {
    if (!confirmDeleteSection) return;

    try {
      await portfolioApi.removeSectionFromProject(project.id, confirmDeleteSection, authToken);
      await refreshPortfolio();
      setConfirmDeleteSection(null);
    } catch (error) {
      console.error('Failed to delete section:', error);
    }
  };

  // Get editable section labels
  const backToProjectsLabel = useSectionLabel('BTN_BACK_TO_PROJECTS', 'back_to_projects');
  const previousLabel = useSectionLabel('BTN_PREVIOUS', 'previous');
  const nextLabel = useSectionLabel('BTN_NEXT', 'next');
  const projectOverviewLabel = useSectionLabel('LABEL_PROJECT_OVERVIEW', 'project_overview');
  const skillsTechLabel = useSectionLabel('LABEL_SKILLS_TECHNOLOGIES', 'skills_technologies');
  const projectDetailsLabel = useSectionLabel('LABEL_PROJECT_DETAILS', 'project_details');
  const dateLabel = useSectionLabel('LABEL_DATE', 'date_label');
  const categoryLabel = useSectionLabel('LABEL_CATEGORY', 'category_label');
  const viewLiveSiteLabel = useSectionLabel('BTN_VIEW_LIVE_SITE', 'view_live_site');
  const viewRepoLabel = useSectionLabel('BTN_VIEW_REPOSITORY', 'view_repository');
  const loadingLabel = useSectionLabel('MSG_LOADING_PROJECT', 'loading_project');
  const unavailableLabel = useSectionLabel('MSG_PROJECT_UNAVAILABLE', 'project_unavailable');

  // Early validation of required props
  if (!project || !language) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">{loadingLabel.renderEditable('text-white text-xl')}</p>
      </div>
    );
  }

  // Get project text in current language
  const projectText = getProjectText(project);

  // Safe access to nested properties
  const title = projectText.name;
  const description = projectText.description;
  const brief = projectText.brief || projectText.description; // Use description as fallback

  // Format date without timezone conversion to avoid off-by-one day issues
  const formatDateWithoutTimezone = (dateStr) => {
    if (!dateStr) return '';

    // Extract date part if it contains time component
    let datePart = dateStr;
    if (dateStr.includes('T')) {
      datePart = dateStr.split('T')[0];
    }

    // Parse date parts directly (YYYY-MM-DD format)
    const [year, month, day] = datePart.split('-').map(Number);

    // Create date in local timezone (months are 0-indexed in JavaScript)
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString();
  };

  const date = project.project_date
    ? formatDateWithoutTimezone(project.project_date)
    : project.created_at
    ? formatDateWithoutTimezone(project.created_at)
    : '';
  
  // Get project image
  const projectImage = project.images && project.images.length > 0
    ? `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${project.images[0].image_path}`
    : require('../assets/images/project1.jpg'); // fallback image
  
  // Helper function to get category name from category_texts
  const getCategoryName = (category) => {
    if (!category) return '';
    
    
    // Try to get name from category_texts array
    if (category.category_texts && category.category_texts.length > 0) {
      // Try to find text for current language
      const categoryText = category.category_texts.find(text => {
        // Match language by code if available
        return text.language_code === language || text.language_id === (language === 'en' ? 1 : 2);
      });
      if (categoryText && categoryText.name) {
        return categoryText.name;
      }
      // Fallback to first available text
      if (category.category_texts[0].name) {
        return category.category_texts[0].name;
      }
    }
    
    // Try direct name property
    if (category.name) {
      return category.name;
    }
    
    // Fallback to code or empty string
    const fallback = category.code || '';
    return fallback;
  };
  
  // Helper function to get skill name from skill_texts
  const getSkillName = (skill) => {
    if (!skill) return '';
    
    // Log skill data for debugging
    
    // Try to get name from skill_texts array
    if (skill.skill_texts && skill.skill_texts.length > 0) {
      // Try to find text for current language
      const skillText = skill.skill_texts.find(text => {
        // Match language by code if available
        return text.language_code === language || text.language_id === (language === 'en' ? 1 : 2);
      });
      if (skillText && skillText.name) {
        return skillText.name;
      }
      // Fallback to first available text
      if (skill.skill_texts[0].name) {
        return skill.skill_texts[0].name;
      }
    }
    
    // Try direct name property (from old API structure)
    if (skill.name) {
      return skill.name;
    }
    
    // Fallback to type or empty string
    const fallback = skill.type || '';
    return fallback;
  };

  // Log project data for debugging

  // Validate required data
  if (!title || !description) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">{unavailableLabel.renderEditable('text-white text-xl')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation Bar - Fixed at top */}
      <div className="fixed top-24 left-0 right-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <button
              onClick={onBackClick}
              className="btn-flat btn-flat-sm flex items-center gap-2"
            >
              <FaArrowLeft />
              <span>{backToProjectsLabel.renderEditable()}</span>
            </button>

            <div className="flex gap-4">
              {onPreviousClick && (
                <button
                  onClick={onPreviousClick}
                  className="btn-flat btn-flat-sm flex items-center gap-2"
                >
                  <FaArrowLeft />
                  <span>{previousLabel.renderEditable()}</span>
                </button>
              )}
              {onNextClick && (
                <button
                  onClick={onNextClick}
                  className="btn-flat btn-flat-sm flex items-center gap-2"
                >
                  <span>{nextLabel.renderEditable()}</span>
                  <FaArrowRight />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Adjusted spacing for better header visibility */}
      <article className="max-w-7xl mx-auto px-4 pt-40 md:pt-48">

        {/* Project Content Grid - Reordered for mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12 mb-20"> {/* Reduced gap on mobile */}
          
          {/* Main Content Column with Drag and Drop */}
          <DragDropContext onDragEnd={handleMainSectionDragEnd}>
            <Droppable droppableId="project-main-sections" isDropDisabled={!isEditMode}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`lg:col-span-2 space-y-6 md:space-y-8 order-2 lg:order-1 transition-all duration-300 ${
                    snapshot.isDraggingOver && isEditMode 
                      ? 'droppable-container is-dragging-over' 
                      : ''
                  }`}
                  style={{
                    minHeight: snapshot.isDraggingOver ? '500px' : 'auto',
                    padding: snapshot.isDraggingOver ? '1rem' : '0',
                  }}
                >
                  {sectionOrder.map((sectionType, index) => {
                    // Render section based on type
                    switch (sectionType) {
                      case 'title':
                        return (
                          <DraggableProjectSection
                            key="title"
                            sectionType="title"
                            index={index}
                            isEditMode={isEditMode}
                          >
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                              {isEditMode && projectText.id ? (
                                <InlineTextEditor
                                  value={title}
                                  entityType="project"
                                  entityId={projectText.id}
                                  fieldName="name"
                                  className="text-3xl md:text-4xl font-bold text-white"
                                  placeholder="Enter project name..."
                                />
                              ) : (
                                title
                              )}
                            </h1>
                          </DraggableProjectSection>
                        );
                      
                      case 'image':
                        return (
                          <DraggableProjectSection
                            key="image"
                            sectionType="image"
                            index={index}
                            isEditMode={isEditMode}
                            className="rounded-xl overflow-hidden bg-gray-800 shadow-lg"
                          >
                            <ProjectImageSelector
                              project={project}
                              category="logo"
                              currentImagePath={projectImage}
                              alt={title}
                              className="w-full h-auto"
                            />
                          </DraggableProjectSection>
                        );
                      
                      case 'description':
                        return (
                          <DraggableProjectSection
                            key="description"
                            sectionType="description"
                            index={index}
                            isEditMode={isEditMode}
                            className="prose prose-lg prose-invert max-w-none"
                          >
                            <div className="text-gray-300 text-lg leading-relaxed">
                              {isEditMode && projectText.id ? (
                                <InlineTextEditor
                                  value={description}
                                  entityType="project"
                                  entityId={projectText.id}
                                  fieldName="description"
                                  className="text-gray-300 text-lg leading-relaxed"
                                  placeholder="Enter project description..."
                                  multiline={true}
                                />
                              ) : (
                                <p>{description}</p>
                              )}
                            </div>
                          </DraggableProjectSection>
                        );
                      
                      case 'skills':
                        // Show skills section if there are skills OR if in edit mode
                        return (project.skills && project.skills.length > 0) || isEditMode ? (
                          <DraggableProjectSection
                            key="skills"
                            sectionType="skills"
                            index={index}
                            isEditMode={isEditMode}
                            className="mt-8 mb-12"
                          >
                            <div ref={skillsSectionRef} className="scroll-mt-32">
                              <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white">
                                  {skillsTechLabel.renderEditable('text-2xl font-bold text-white')}
                                </h2>
                                {isEditMode && (
                                  <div className="flex gap-2">
                                    {project.skills && project.skills.length > 0 && (
                                      <>
                                        {selectedSkillsToRemove.size > 0 ? (
                                          <>
                                            <button
                                              onClick={clearSkillSelection}
                                              className="btn-flat btn-flat-sm flex items-center gap-2 bg-gray-700 hover:bg-gray-600"
                                            >
                                              Clear ({selectedSkillsToRemove.size})
                                            </button>
                                            <button
                                              onClick={handleRemoveSelectedSkills}
                                              className="btn-flat btn-flat-sm flex items-center gap-2 bg-red-500/20 border-red-500 hover:bg-red-500/30 text-red-400"
                                            >
                                              <FaPlus size={14} className="rotate-45" />
                                              <span>Remove {selectedSkillsToRemove.size}</span>
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            onClick={selectAllSkills}
                                            className="btn-flat btn-flat-sm flex items-center gap-2"
                                          >
                                            Select All
                                          </button>
                                        )}
                                      </>
                                    )}
                                    <button
                                      onClick={() => {
                                        setShowSkillsManager(true);
                                        clearSkillSelection();
                                      }}
                                      className="btn-flat btn-flat-sm flex items-center gap-2"
                                    >
                                      <FaPlus size={14} />
                                      <span>Add Skills</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                              {project.skills && project.skills.length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                  {project.skills.map((skill, skillIndex) => {
                                    const skillName = getSkillName(skill);
                                    if (!skillName) return null;
                                    const isSelected = selectedSkillsToRemove.has(skill.id);
                                    return (
                                      <div key={skill.id || skillIndex} className="relative group">
                                        <button
                                          onClick={() => isEditMode && toggleSkillSelection(skill.id)}
                                          disabled={!isEditMode}
                                          className={`
                                            chip chip-lg transition-all duration-200 cursor-pointer
                                            ${isEditMode ? 'hover:scale-105' : ''}
                                            ${isSelected 
                                              ? 'bg-red-500/20 border-red-500 text-red-400 ring-2 ring-red-500/50' 
                                              : ''
                                            }
                                          `}
                                        >
                                          {skillName}
                                          {isEditMode && isSelected && (
                                            <span className="ml-1 text-red-400">✓</span>
                                          )}
                                        </button>
                                        {isEditMode && !isSelected && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveSkill(skill.id);
                                            }}
                                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs z-10"
                                            title="Remove skill"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : isEditMode ? (
                                <p className="text-gray-400">No skills added yet. Click "Add Skills" to add some.</p>
                              ) : null}
                            </div>
                          </DraggableProjectSection>
                        ) : null;
                      
                      case 'sections':
                        return project.sections && project.sections.length > 0 ? (
                          <DraggableProjectSection
                            key="sections"
                            sectionType="sections"
                            index={index}
                            isEditMode={isEditMode}
                          >
                            {/* Project Sections with Individual Drag and Drop */}
                            <div className="mt-8 scroll-mt-40">
                              <DragDropContext onDragEnd={handleProjectSectionsDragEnd}>
                                <Droppable droppableId="project-sections-list" isDropDisabled={!isEditMode}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      className={`space-y-8 transition-all duration-300 scroll-mt-40 ${
                                        snapshot.isDraggingOver && isEditMode 
                                          ? 'droppable-container is-dragging-over bg-[#14C800]/5 ring-1 ring-[#14C800]/30 ring-inset p-4 rounded-lg' 
                                          : ''
                                      }`}
                                      style={{
                                        minHeight: snapshot.isDraggingOver ? '200px' : 'auto',
                                      }}
                                    >
                                      {projectSections.map((section, sectionIndex) => (
                                        <DraggableProjectSectionWrapper
                                          key={section.id}
                                          section={section}
                                          index={sectionIndex}
                                          language={language}
                                          isEditMode={isEditMode}
                                          onContentReorder={(sectionId, reorderedItems) => {
                                            // Content reordering is handled by EditableProjectSection via API
                                          }}
                                          onEdit={handleEditSection}
                                          onDelete={handleDeleteSection}
                                        />
                                      ))}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              </DragDropContext>

                              {/* Add Section Button - Edit Mode Only */}
                              {isEditMode && (
                                <div className="mt-6 flex justify-center">
                                  <button
                                    onClick={() => setShowAddSectionDialog(true)}
                                    className="btn-flat flex items-center gap-2 px-6 py-3 text-lg"
                                  >
                                    <FaPlus />
                                    <span>Add New Section</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </DraggableProjectSection>
                        ) : isEditMode ? (
                          <DraggableProjectSection
                            key="sections"
                            sectionType="sections"
                            index={index}
                            isEditMode={isEditMode}
                          >
                            {/* No sections yet - Show add button */}
                            <div className="mt-8 text-center">
                              <p className="text-gray-400 mb-4">No sections yet. Add your first section!</p>
                              <button
                                onClick={() => setShowAddSectionDialog(true)}
                                className="btn-flat flex items-center gap-2 px-6 py-3 mx-auto"
                              >
                                <FaPlus />
                                <span>Add First Section</span>
                              </button>
                            </div>
                          </DraggableProjectSection>
                        ) : null;
                      
                      default:
                        return null;
                    }
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Project Info Sidebar - Moved to top on mobile */}
          <aside className="lg:col-span-1 order-1 lg:order-2">
            <div className="bg-gray-800 rounded-xl p-6 lg:sticky lg:top-24">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-white">
                  {projectDetailsLabel.renderEditable('text-xl font-semibold text-white')}
                </h3>
                {isEditMode && (
                  <button
                    onClick={() => setIsMetadataEditorOpen(true)}
                    className="btn-flat btn-flat-sm text-white/70 hover:text-white"
                    title="Edit project metadata"
                  >
                    <FaPencil size={18} />
                  </button>
                )}
              </div>
              <dl className="space-y-4">
                <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 items-start">
                  <div className="inline-flex items-center justify-center w-8 h-8 border border-[#14C800] rounded-md text-[#14C800]">
                    <FaCalendar className="w-3.5 h-3.5" />
                  </div>
                  <dt className="text-gray-400 text-sm leading-tight mt-1">{dateLabel.renderEditable('text-gray-400 text-sm')}</dt>
                  <span />
                  <dd className="text-white text-sm sm:text-base leading-tight">{date}</dd>
                </div>
                {project.categories && project.categories.length > 0 && (
                  <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 items-start">
                    <div className="inline-flex items-center justify-center w-8 h-8 border border-[#14C800] rounded-md text-[#14C800]">
                      <FaFolder className="w-3.5 h-3.5" />
                    </div>
                    <dt className="text-gray-400 text-sm leading-tight mt-1">{categoryLabel.renderEditable('text-gray-400 text-sm')}</dt>
                    <span />
                    <dd className="text-white text-sm sm:text-base leading-tight">
                      {project.categories.map((cat, index) => {
                        const categoryName = getCategoryName(cat);
                        return (
                          <span key={cat.id || index}>
                            {categoryName}
                            {index < project.categories.length - 1 ? ', ' : ''}
                          </span>
                        );
                      })}
                    </dd>
                  </div>
                )}
                <div className="pt-6 space-y-4">
                  {project.website_url && (
                    <a href={project.website_url} target="_blank" rel="noopener noreferrer" className="btn-flat btn-flat-sm flex items-center gap-2 w-full justify-center sm:justify-start">
                      <FaGlobe />
                      <span>{viewLiveSiteLabel.renderEditable()}</span>
                    </a>
                  )}
                  {project.repository_url && (
                    <a href={project.repository_url} target="_blank" rel="noopener noreferrer" className="btn-flat btn-flat-sm flex items-center gap-2 w-full justify-center sm:justify-start">
                      <FaGithub />
                      <span>{viewRepoLabel.renderEditable()}</span>
                    </a>
                  )}
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </article>

      {/* Project Metadata Editor Modal */}
      <ProjectMetadataEditor
        isOpen={isMetadataEditorOpen}
        onClose={() => setIsMetadataEditorOpen(false)}
        project={project}
        onUpdate={handleMetadataUpdate}
      />

      {/* Section Management Dialogs — loaded on-demand (contains Tiptap + Monaco) */}
      <Suspense fallback={null}>
        {showAddSectionDialog && (
          <SectionEditorDialog
            projectId={project.id}
            authToken={authToken}
            onClose={() => setShowAddSectionDialog(false)}
            onSuccess={async () => {
              setShowAddSectionDialog(false);
              await refreshPortfolio();
            }}
          />
        )}

        {editingSection && (
          <SectionEditorDialog
            projectId={project.id}
            section={editingSection}
            authToken={authToken}
            onClose={() => setEditingSection(null)}
            onSuccess={async () => {
              setEditingSection(null);
              await refreshPortfolio();
            }}
          />
        )}
      </Suspense>

      {/* Delete Confirmation Dialog */}
      {confirmDeleteSection && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Delete</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to remove this section from the project? This will not delete the section itself, only remove it from this project.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteSection(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSectionDeletion}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skills Manager Dialog */}
      {showSkillsManager && (
        <SkillsManagerDialog
          projectId={project.id}
          currentSkills={project.skills || []}
          authToken={authToken}
          language={language}
          onClose={() => setShowSkillsManager(false)}
          onUpdate={async () => {
            await refreshPortfolio();
            showNotification('Skills Updated', 'Project skills have been updated successfully.', 'success');
            
            // Scroll to skills section after a brief delay
            setTimeout(() => {
              skillsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
          }}
        />
      )}
    </div>
  );
};

// Skills Manager Dialog Component
const SkillsManagerDialog = ({ projectId, currentSkills, authToken, language, onClose, onUpdate }) => {
  const [availableSkills, setAvailableSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkills, setSelectedSkills] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    fetchAvailableSkills();
  }, []);

  const fetchAvailableSkills = async () => {
    try {
      setLoading(true);
      const response = await portfolioApi.getAllSkills(authToken);
      // Backend returns paginated response with items array
      setAvailableSkills(response?.items || []);
    } catch (error) {
      console.error('Failed to fetch skills:', error);
      setAvailableSkills([]);
    } finally {
      setLoading(false);
    }
  };

  const getSkillName = (skill) => {
    if (!skill) return '';
    if (skill.skill_texts && skill.skill_texts.length > 0) {
      const skillText = skill.skill_texts.find(text => 
        text.language_code === language || text.language_id === (language === 'en' ? 1 : 2)
      );
      if (skillText?.name) return skillText.name;
      if (skill.skill_texts[0]?.name) return skill.skill_texts[0].name;
    }
    return skill.name || skill.type || '';
  };

  const currentSkillIds = new Set(currentSkills.map(s => s.id));
  
  const filteredSkills = availableSkills.filter(skill => {
    if (currentSkillIds.has(skill.id)) return false;
    const skillName = getSkillName(skill).toLowerCase();
    return skillName.includes(searchTerm.toLowerCase());
  });

  const toggleSkillSelection = (skillId) => {
    const newSelection = new Set(selectedSkills);
    if (newSelection.has(skillId)) {
      newSelection.delete(skillId);
    } else {
      newSelection.add(skillId);
    }
    setSelectedSkills(newSelection);
  };

  const selectAll = () => {
    const allFilteredIds = new Set(filteredSkills.map(s => s.id));
    setSelectedSkills(allFilteredIds);
  };

  const clearSelection = () => {
    setSelectedSkills(new Set());
  };

  const handleAddSelectedSkills = async () => {
    if (selectedSkills.size === 0) return;
    
    try {
      setAdding(true);
      let successCount = 0;
      let failCount = 0;

      // Add skills in parallel for better performance
      const promises = Array.from(selectedSkills).map(async (skillId) => {
        try {
          await portfolioApi.addSkillToProject(projectId, skillId, authToken);
          successCount++;
        } catch (error) {
          console.error(`Failed to add skill ${skillId}:`, error);
          failCount++;
        }
      });

      await Promise.all(promises);

      if (successCount > 0) {
        setAddedCount(successCount);
        await onUpdate();
        setSelectedSkills(new Set());
        await fetchAvailableSkills();
        
        // Show success message
        setTimeout(() => setAddedCount(0), 3000);
      }

      if (failCount > 0) {
        console.error(`Failed to add ${failCount} skill(s)`);
      }
    } catch (error) {
      console.error('Failed to add skills:', error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-800 rounded-xl p-6 max-w-3xl w-full border border-gray-700 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">Manage Skills</h3>
            <p className="text-sm text-gray-400">
              Select multiple skills to add them to your project
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Search and Actions Bar */}
        <div className="space-y-3 mb-4">
          <input
            type="text"
            placeholder="Search skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-[#14C800] focus:outline-none transition-colors"
          />
          
          {/* Selection Actions */}
          {filteredSkills.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  disabled={adding}
                  className="text-sm text-[#14C800] hover:text-[#12b000] transition-colors disabled:opacity-50"
                >
                  Select All ({filteredSkills.length})
                </button>
                {selectedSkills.size > 0 && (
                  <>
                    <span className="text-gray-600">|</span>
                    <button
                      onClick={clearSelection}
                      disabled={adding}
                      className="text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      Clear Selection
                    </button>
                  </>
                )}
              </div>
              
              {selectedSkills.size > 0 && (
                <span className="text-sm text-gray-400">
                  {selectedSkills.size} selected
                </span>
              )}
            </div>
          )}
        </div>

        {/* Skills Grid */}
        <div className="flex-1 overflow-y-auto mb-4 pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-gray-600 border-t-[#14C800] rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-400">Loading skills...</p>
              </div>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg mb-2">
                {searchTerm ? '🔍 No skills found' : '✨ All skills added!'}
              </p>
              <p className="text-gray-500 text-sm">
                {searchTerm 
                  ? 'Try adjusting your search term' 
                  : 'All available skills are already in this project'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredSkills.map(skill => {
                const isSelected = selectedSkills.has(skill.id);
                return (
                  <button
                    key={skill.id}
                    onClick={() => toggleSkillSelection(skill.id)}
                    disabled={adding}
                    className={`
                      flex items-center justify-between p-3 rounded-lg transition-all duration-200
                      ${isSelected 
                        ? 'bg-[#14C800]/20 border-2 border-[#14C800] shadow-lg shadow-[#14C800]/20' 
                        : 'bg-gray-700/50 border-2 border-transparent hover:bg-gray-700 hover:border-gray-600'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                      group
                    `}
                  >
                    <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {getSkillName(skill)}
                    </span>
                    <div className={`
                      w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                      ${isSelected 
                        ? 'bg-[#14C800] border-[#14C800]' 
                        : 'border-gray-600 group-hover:border-gray-500'
                      }
                    `}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Current Skills Summary */}
        {currentSkills.length > 0 && (
          <div className="border-t border-gray-700 pt-4 mb-4">
            <p className="text-sm text-gray-400 mb-3">
              Current skills ({currentSkills.length}):
            </p>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar pr-2">
              {currentSkills.map(skill => (
                <span 
                  key={skill.id} 
                  className="chip chip-sm bg-gray-700 text-gray-300 border border-gray-600"
                >
                  {getSkillName(skill)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Success Message */}
        {addedCount > 0 && (
          <div className="mb-4 p-3 bg-[#14C800]/20 border border-[#14C800] rounded-lg">
            <p className="text-[#14C800] text-sm font-medium text-center">
              ✓ Successfully added {addedCount} skill{addedCount > 1 ? 's' : ''}!
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={adding}
            className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>
          {selectedSkills.size > 0 && (
            <button
              onClick={handleAddSelectedSkills}
              disabled={adding}
              className="px-6 py-2.5 bg-[#14C800] hover:bg-[#12b000] text-white rounded-lg transition-all flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#14C800]/30"
            >
              {adding ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <FaPlus size={14} />
                  <span>Add {selectedSkills.size} Skill{selectedSkills.size > 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
