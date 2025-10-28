import React, { useContext } from 'react';
import { FaGithub, FaGlobe, FaCalendar, FaFolder, FaArrowLeft, FaArrowRight } from 'react-icons/fa6';
import { translations } from '../data/translations';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { useSectionLabel } from '../hooks/useSectionLabel';
import { InlineTextEditor } from './cms';

const ProjectDetails = ({ project, onBackClick, onPreviousClick, onNextClick }) => {
  const { language } = useContext(LanguageContext);
  const { getProjectText } = usePortfolio();
  const { isEditMode } = useEditMode();

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
  const category = project.category || '';
  const date = project.created_at ? new Date(project.created_at).toLocaleDateString() : '';
  
  // Get project image
  const projectImage = project.images && project.images.length > 0
    ? `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${project.images[0].image_path}`
    : require('../assets/images/project1.jpg'); // fallback image

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
              className="flex items-center gap-2 text-white/90 px-4 py-2 rounded-lg transition-all duration-300 hover:bg-[#14C800] hover:text-white hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1"
            >
              <FaArrowLeft />
              <span>{backToProjectsLabel.renderEditable()}</span>
            </button>

            <div className="flex gap-4">
              {onPreviousClick && (
                <button
                  onClick={onPreviousClick}
                  className="flex items-center gap-2 text-white/90 px-4 py-2 rounded-lg transition-all duration-300 hover:bg-[#14C800] hover:text-white hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1"
                >
                  <FaArrowLeft />
                  <span>{previousLabel.renderEditable()}</span>
                </button>
              )}
              {onNextClick && (
                <button
                  onClick={onNextClick}
                  className="flex items-center gap-2 text-white/90 px-4 py-2 rounded-lg transition-all duration-300 hover:bg-[#14C800] hover:text-white hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1"
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
      <article className="max-w-7xl mx-auto px-4">
        {/* Project Header - Increased top margin for better spacing */}
        <header className="pt-32 pb-6 md:pb-12 max-w-4xl mx-auto">
          <div className="mt-24 mb-8 md:mb-12"> {/* Changed from mt-16 to mt-24 for more spacing */}
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 md:mb-6">
              {isEditMode && projectText.id ? (
                <InlineTextEditor
                  value={title}
                  entityType="project"
                  entityId={projectText.id}
                  fieldName="name"
                  className="text-4xl md:text-5xl font-bold text-white mb-4 md:mb-6"
                  placeholder="Enter project name..."
                />
              ) : (
                title
              )}
            </h1>
            {brief && (
              <div className="text-xl text-gray-300 leading-relaxed">
                {isEditMode && projectText.id ? (
                  <InlineTextEditor
                    value={brief}
                    entityType="project"
                    entityId={projectText.id}
                    fieldName="description"
                    className="text-xl text-gray-300 leading-relaxed"
                    placeholder="Enter project brief..."
                    multiline={true}
                  />
                ) : (
                  <p>{brief}</p>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Project Content Grid - Reordered for mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12 mb-20"> {/* Reduced gap on mobile */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8 order-2 lg:order-1"> {/* Reduced spacing on mobile */}
            <div className="rounded-xl overflow-hidden bg-gray-800 shadow-lg">
              <img 
                src={projectImage}
                alt={title} 
                className="w-full h-auto" 
              />
            </div>
            <div className="prose prose-lg prose-invert max-w-none">
              <h2 className="text-2xl font-bold text-white mb-4">
                {projectOverviewLabel.renderEditable('text-2xl font-bold text-white mb-4')}
              </h2>
              <div className="text-gray-300">
                {isEditMode && projectText.id ? (
                  <InlineTextEditor
                    value={description}
                    entityType="project"
                    entityId={projectText.id}
                    fieldName="description"
                    className="text-gray-300"
                    placeholder="Enter project description..."
                    multiline={true}
                  />
                ) : (
                  <p>{description}</p>
                )}
              </div>
            </div>

            {/* Skills Section - Added extra bottom margin */}
            <div className="mt-8 mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">
                {skillsTechLabel.renderEditable('text-2xl font-bold text-white mb-6')}
              </h2>
              <div className="flex flex-wrap gap-3">
                {project.skills?.map((skill, index) => {
                  // Get skill name - handle both old and new API structure
                  const skillName = skill.skill_texts && skill.skill_texts.length > 0
                    ? skill.skill_texts[0].name
                    : skill.name?.[language] || skill.name || 'Skill';
                  
                  return (
                    <span
                      key={skill.id || index}
                      className="px-4 py-2 bg-gray-800 text-white rounded-full border border-[#14C800]/30 transition-all duration-300 hover:bg-[#14C800] hover:border-transparent hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1"
                    >
                      {skillName}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Project Info Sidebar - Moved to top on mobile */}
          <aside className="lg:col-span-1 order-1 lg:order-2">
            <div className="bg-gray-800 rounded-xl p-6 lg:sticky lg:top-24">
              <h3 className="text-xl font-semibold text-white mb-6">
                {projectDetailsLabel.renderEditable('text-xl font-semibold text-white mb-6')}
              </h3>
              <dl className="space-y-4">
                <div className="flex items-center gap-3">
                  <FaCalendar className="text-[#14C800] text-xl" />
                  <div>
                    <dt className="text-gray-400 text-sm">{dateLabel.renderEditable('text-gray-400 text-sm')}</dt>
                    <dd className="text-white">{date}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FaFolder className="text-[#14C800] text-xl" />
                  <div>
                    <dt className="text-gray-400 text-sm">{categoryLabel.renderEditable('text-gray-400 text-sm')}</dt>
                    <dd className="text-white">{category}</dd>
                  </div>
                </div>
                <div className="pt-6 space-y-4">
                  {project.website_url && (
                    <a href={project.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full bg-[#14C800] text-white px-4 py-2 rounded-lg transition-all duration-300 hover:bg-[#14C800]/90 hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1">
                      <FaGlobe />
                      <span>{viewLiveSiteLabel.renderEditable()}</span>
                    </a>
                  )}
                  {project.repository_url && (
                    <a href={project.repository_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full bg-gray-700 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:bg-gray-600 transform hover:-translate-y-1">
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
    </div>
  );
};

export default ProjectDetails;
