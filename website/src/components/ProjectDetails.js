import React, { useContext, useState } from 'react';
import { FaGithub, FaGlobe, FaCalendar, FaFolder, FaArrowLeft, FaArrowRight, FaPencil } from 'react-icons/fa6';
import { translations } from '../data/translations';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { useSectionLabel } from '../hooks/useSectionLabel';
import { InlineTextEditor, ProjectImageSelector, ProjectMetadataEditor } from './cms';

const ProjectDetails = ({ project, onBackClick, onPreviousClick, onNextClick }) => {
  const { language } = useContext(LanguageContext);
  const { getProjectText, refreshPortfolio } = usePortfolio();
  const { isEditMode } = useEditMode();
  const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false);

  /**
   * Handle metadata update - refresh portfolio data
   */
  const handleMetadataUpdate = async () => {
    await refreshPortfolio();
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
          <div className="lg:col-span-2 space-y-6 md:space-y-8 order-2 lg:order-1"> {/* Reduced spacing on mobile */}
            
            {/* 1. Project Name/Title - First */}
            <div>
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
            </div>
            
            {/* 2. Project Image/Logo - Second */}
            <div className="rounded-xl overflow-hidden bg-gray-800 shadow-lg relative">
              {/* Project Logo/Main Image with Edit Capability */}
              <ProjectImageSelector
                project={project}
                category="logo"
                currentImagePath={projectImage}
                alt={title}
                className="w-full h-auto"
              />
            </div>
            
            {/* 3. Project Description - Third */}
            <div className="prose prose-lg prose-invert max-w-none">
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
            </div>

            {/* Skills Section - Added extra bottom margin */}
            {project.skills && project.skills.length > 0 && (
              <div className="mt-8 mb-12">
                <h2 className="text-2xl font-bold text-white mb-6">
                  {skillsTechLabel.renderEditable('text-2xl font-bold text-white mb-6')}
                </h2>
                <div className="flex flex-wrap gap-3">
                  {project.skills.map((skill, index) => {
                    const skillName = getSkillName(skill);
                    
                    if (!skillName) return null;
                    
                    return (
                      <span
                        key={skill.id || index}
                        className="chip chip-lg"
                      >
                        {skillName}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

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
    </div>
  );
};

export default ProjectDetails;
