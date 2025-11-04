import React, { useContext, useState, useEffect, useRef } from 'react';
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
import { InlineTextEditor, ProjectImageSelector, ProjectMetadataEditor } from './cms';
import { SectionEditorDialog } from './cms/ProjectSectionManager';
import portfolioApi from '../services/portfolioApi';

const ProjectDetails = ({ project, onBackClick, onPreviousClick, onNextClick }) => {
  const { language } = useContext(LanguageContext);
  const { getProjectText, refreshPortfolio } = usePortfolio();
  const { isEditMode, authToken, showNotification } = useEditMode();
  const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [confirmDeleteSection, setConfirmDeleteSection] = useState(null);

  // State for main section ordering (UI layout)
  const defaultSectionOrder = ['title', 'image', 'description', 'skills', 'sections'];
  const [sectionOrder, setSectionOrder] = useState(defaultSectionOrder);
  const isReorderingRef = useRef(false);

  // State for project sections ordering (actual database sections)
  const [projectSections, setProjectSections] = useState([]);
  const isReorderingSectionsRef = useRef(false);

  // Update project sections when project data changes
  useEffect(() => {
    if (project?.sections) {
      console.log('[PROJECT SECTIONS] Project data updated, sorting sections by display_order');
      console.log('[PROJECT SECTIONS] Raw sections:', project.sections.map(s => ({ id: s.id, display_order: s.display_order })));
      
      const sortedSections = [...project.sections].sort(
        (a, b) => (a.display_order || 0) - (b.display_order || 0)
      );
      
      console.log('[PROJECT SECTIONS] Sorted sections:', sortedSections.map(s => ({ id: s.id, display_order: s.display_order })));
      setProjectSections(sortedSections);
    }
  }, [project]);

  /**
   * Handle drag end event for main sections
   */
  const handleMainSectionDragEnd = (result) => {
    console.log('Main section drag end:', result);
    
    if (!result.destination) {
      console.log('No destination - dropped outside');
      return;
    }
    
    if (result.destination.index === result.source.index) {
      console.log('No movement - same position');
      return;
    }

    console.log(`Moving section from index ${result.source.index} to ${result.destination.index}`);

    // Reorder the sections array
    const reorderedSections = Array.from(sectionOrder);
    const [movedSection] = reorderedSections.splice(result.source.index, 1);
    reorderedSections.splice(result.destination.index, 0, movedSection);
    
    console.log('New section order:', reorderedSections);
    
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
    console.log('🎯 === PROJECT SECTION DRAG END TRIGGERED ===');
    console.log('🔍 Context:', {
      isEditMode,
      hasToken: !!authToken,
      tokenPreview: authToken ? `${authToken.substring(0, 20)}...` : 'null',
      projectId: project?.id,
      projectName: project?.name,
      result
    });
    
    if (!result.destination) {
      console.log('❌ No destination - dropped outside');
      return;
    }
    
    if (result.destination.index === result.source.index) {
      console.log('❌ No movement - same position');
      return;
    }

    // Prevent concurrent reordering operations
    if (isReorderingSectionsRef.current) {
      console.log('⚠️ Reordering already in progress, skipping...');
      return;
    }

    isReorderingSectionsRef.current = true;

    console.log(`📍 Moving project section from index ${result.source.index} to ${result.destination.index}`);

    // Reorder the sections array
    const reorderedSections = Array.from(projectSections);
    const [movedSection] = reorderedSections.splice(result.source.index, 1);
    reorderedSections.splice(result.destination.index, 0, movedSection);
    
    console.log('📋 New project sections order:', reorderedSections.map(s => ({ id: s.id, code: s.code })));
    
    // Update local state immediately for instant feedback
    setProjectSections(reorderedSections);
    
    // Check conditions for backend save
    console.log('🔐 Checking save conditions:', {
      isEditMode,
      hasToken: !!authToken,
      hasProjectId: !!project?.id,
      willSave: isEditMode && !!authToken && !!project?.id
    });
    
    // Persist to backend API
    if (isEditMode && authToken && project?.id) {
      try {
        const sectionIds = reorderedSections.map(section => section.id);
        console.log('[REORDER] Sending request to backend:', {
          projectId: project.id,
          sectionIds,
          hasToken: !!authToken,
          apiUrl: `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/cms/content/project/${project.id}/sections/order`
        });
        
        const response = await portfolioApi.reorderProjectSections(project.id, sectionIds, authToken);
        console.log('[REORDER] Backend response:', response);
        console.log('Successfully saved project sections order to backend');
        
        // Show success notification
        if (showNotification) {
          showNotification(
            'Section Order Updated',
            'The section order has been saved successfully.',
            'success'
          );
        }
        
        // Refresh portfolio data to sync with backend
        console.log('[REORDER] Refreshing portfolio data...');
        await refreshPortfolio();
        console.log('[REORDER] Portfolio data refreshed after reorder');
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
      console.warn('⚠️ === BACKEND SAVE SKIPPED ===');
      console.warn('❌ One or more conditions failed:', {
        isEditMode: isEditMode ? '✅' : '❌ FALSE',
        hasToken: authToken ? '✅' : '❌ NULL/UNDEFINED',
        hasProjectId: project?.id ? '✅' : '❌ NULL/UNDEFINED',
      });
      console.warn('💡 To fix:');
      console.warn('  1. Make sure you are in Edit Mode (activate via backend admin)');
      console.warn('  2. Check localStorage for cms_auth_token');
      console.warn('  3. Verify project data is loaded');
      
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
   * Handle metadata update - refresh portfolio data
   */
  const handleMetadataUpdate = async () => {
    await refreshPortfolio();
  };

  /**
   * Handle section edit
   */
  const handleEditSection = (section) => {
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
    
    console.log('Processing category:', category);
    
    // Try to get name from category_texts array
    if (category.category_texts && category.category_texts.length > 0) {
      console.log('Category has category_texts:', category.category_texts);
      // Try to find text for current language
      const categoryText = category.category_texts.find(text => {
        // Match language by code if available
        return text.language_code === language || text.language_id === (language === 'en' ? 1 : 2);
      });
      if (categoryText && categoryText.name) {
        console.log('Found category name from category_texts:', categoryText.name);
        return categoryText.name;
      }
      // Fallback to first available text
      if (category.category_texts[0].name) {
        console.log('Using first category_text name:', category.category_texts[0].name);
        return category.category_texts[0].name;
      }
    }
    
    // Try direct name property
    if (category.name) {
      console.log('Using direct category name:', category.name);
      return category.name;
    }
    
    // Fallback to code or empty string
    const fallback = category.code || '';
    console.log('Using category code as fallback:', fallback);
    return fallback;
  };
  
  // Helper function to get skill name from skill_texts
  const getSkillName = (skill) => {
    if (!skill) return '';
    
    // Log skill data for debugging
    console.log('Processing skill:', skill);
    
    // Try to get name from skill_texts array
    if (skill.skill_texts && skill.skill_texts.length > 0) {
      console.log('Skill has skill_texts:', skill.skill_texts);
      // Try to find text for current language
      const skillText = skill.skill_texts.find(text => {
        // Match language by code if available
        return text.language_code === language || text.language_id === (language === 'en' ? 1 : 2);
      });
      if (skillText && skillText.name) {
        console.log('Found skill name from skill_texts:', skillText.name);
        return skillText.name;
      }
      // Fallback to first available text
      if (skill.skill_texts[0].name) {
        console.log('Using first skill_text name:', skill.skill_texts[0].name);
        return skill.skill_texts[0].name;
      }
    }
    
    // Try direct name property (from old API structure)
    if (skill.name) {
      console.log('Using direct skill name:', skill.name);
      return skill.name;
    }
    
    // Fallback to type or empty string
    const fallback = skill.type || '';
    console.log('Using skill type as fallback:', fallback);
    return fallback;
  };

  // Log project data for debugging
  console.log('Project data:', project);
  console.log('Project skills:', project.skills);
  console.log('Project categories:', project.categories);

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
                        return project.skills && project.skills.length > 0 ? (
                          <DraggableProjectSection
                            key="skills"
                            sectionType="skills"
                            index={index}
                            isEditMode={isEditMode}
                            className="mt-8 mb-12"
                          >
                            <h2 className="text-2xl font-bold text-white mb-6">
                              {skillsTechLabel.renderEditable('text-2xl font-bold text-white mb-6')}
                            </h2>
                            <div className="flex flex-wrap gap-3">
                              {project.skills.map((skill, skillIndex) => {
                                const skillName = getSkillName(skill);
                                if (!skillName) return null;
                                return (
                                  <span
                                    key={skill.id || skillIndex}
                                    className="chip chip-lg"
                                  >
                                    {skillName}
                                  </span>
                                );
                              })}
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
                            <div className="mt-8">
                              <DragDropContext onDragEnd={handleProjectSectionsDragEnd}>
                                <Droppable droppableId="project-sections-list" isDropDisabled={!isEditMode}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      className={`space-y-8 transition-all duration-300 ${
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
                                            console.log(`Section ${sectionId} content reordered:`, reorderedItems);
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

      {/* Section Management Dialogs */}
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
    </div>
  );
};

export default ProjectDetails;
