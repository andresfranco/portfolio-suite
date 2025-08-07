import React, { useContext } from 'react';
import { FaGithub, FaGlobe, FaCalendar, FaFolder, FaArrowLeft, FaArrowRight } from 'react-icons/fa6';
import { translations } from '../data/translations';
import { LanguageContext } from '../context/LanguageContext';

const ProjectDetails = ({ project, onBackClick, onPreviousClick, onNextClick }) => {
  const { language } = useContext(LanguageContext);

  // Early validation of required props
  if (!project || !language) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">{translations[language].loading_project}</p>
      </div>
    );
  }

  // Safe access to nested properties
  const title = project?.title?.[language];
  const description = project?.description?.[language];
  const brief = project?.brief?.[language];
  const category = project?.category?.[language];
  const date = project?.date?.[language];

  // Validate required data
  if (!title || !description) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">{translations[language].project_unavailable}</p>
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
              <span>{translations[language].back_to_projects}</span>
            </button>

            <div className="flex gap-4">
              {onPreviousClick && (
                <button
                  onClick={onPreviousClick}
                  className="flex items-center gap-2 text-white/90 px-4 py-2 rounded-lg transition-all duration-300 hover:bg-[#14C800] hover:text-white hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1"
                >
                  <FaArrowLeft />
                  <span>{translations[language].previous}</span>
                </button>
              )}
              {onNextClick && (
                <button
                  onClick={onNextClick}
                  className="flex items-center gap-2 text-white/90 px-4 py-2 rounded-lg transition-all duration-300 hover:bg-[#14C800] hover:text-white hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1"
                >
                  <span>{translations[language].next}</span>
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
              {title}
            </h1>
            {brief && (
              <p className="text-xl text-gray-300 leading-relaxed">
                {brief}
              </p>
            )}
          </div>
        </header>

        {/* Project Content Grid - Reordered for mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12 mb-20"> {/* Reduced gap on mobile */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8 order-2 lg:order-1"> {/* Reduced spacing on mobile */}
            <div className="rounded-xl overflow-hidden bg-gray-800 shadow-lg">
              <img 
                src={project.image}  // Use the imported image directly
                alt={title} 
                className="w-full h-auto" 
              />
            </div>
            <div className="prose prose-lg prose-invert max-w-none">
              <h2 className="text-2xl font-bold text-white mb-4">
                {translations[language].project_overview}
              </h2>
              <p className="text-gray-300">{description}</p>
            </div>

            {/* Skills Section - Added extra bottom margin */}
            <div className="mt-8 mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">
                {translations[language].skills_technologies}
              </h2>
              <div className="flex flex-wrap gap-3">
                {project.skills?.map((skill, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-gray-800 text-white rounded-full border border-[#14C800]/30 transition-all duration-300 hover:bg-[#14C800] hover:border-transparent hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1"
                  >
                    {skill.name[language]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Project Info Sidebar - Moved to top on mobile */}
          <aside className="lg:col-span-1 order-1 lg:order-2">
            <div className="bg-gray-800 rounded-xl p-6 lg:sticky lg:top-24">
              <h3 className="text-xl font-semibold text-white mb-6">
                {translations[language].project_details}
              </h3>
              <dl className="space-y-4">
                <div className="flex items-center gap-3">
                  <FaCalendar className="text-[#14C800] text-xl" />
                  <div>
                    <dt className="text-gray-400 text-sm">{translations[language].date_label}</dt>
                    <dd className="text-white">{date}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FaFolder className="text-[#14C800] text-xl" />
                  <div>
                    <dt className="text-gray-400 text-sm">{translations[language].category_label}</dt>
                    <dd className="text-white">{category}</dd>
                  </div>
                </div>
                <div className="pt-6 space-y-4">
                  {project.liveUrl && (
                    <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full bg-[#14C800] text-white px-4 py-2 rounded-lg transition-all duration-300 hover:bg-[#14C800]/90 hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1">
                      <FaGlobe />
                      <span>{translations[language].view_live_site}</span>
                    </a>
                  )}
                  {project.repoUrl && (
                    <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full bg-gray-700 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:bg-gray-600 transform hover:-translate-y-1">
                      <FaGithub />
                      <span>{translations[language].view_repository}</span>
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
