import React, { useState, useContext } from 'react';
import heroImage from '../assets/images/hero.jpg';
import ChatModal from './ChatModal';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { translations } from '../data/translations';
import { useNavigate } from 'react-router-dom';
import enResume from '../assets/files/en_resume.pdf';
import esResume from '../assets/files/es_resume.pdf';
import { RichTextEditor, ImageUploader, ContentEditorModal } from './cms';
import { useContentEditor } from '../hooks/useContentEditor';

const Hero = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { portfolio, loading, getExperiences, getExperienceText } = usePortfolio();
  const { language } = useContext(LanguageContext);
  const { isEditMode } = useEditMode();
  const navigate = useNavigate();
  
  // Content editor hook for experiences
  const { 
    editingItem, 
    isModalOpen, 
    startEditing, 
    stopEditing 
  } = useContentEditor('experience');

  // Get experiences from API
  const experiences = getExperiences();
  
  // Placeholder person data (TODO: Add person/profile to backend API)
  const person = {
    name: portfolio?.name || "Loading...",
  };

  const getIconComponent = (iconName) => {
    switch (iconName) {
      case 'code':
        return require('react-icons/fa6').FaCode;
      case 'database':
        return require('react-icons/fa6').FaDatabase;
      case 'cloud':
        return require('react-icons/fa6').FaCloud;
      default:
        return require('react-icons/fa6').FaCode;
    }
  };

  const handleExperienceClick = (expId) => {
    // In edit mode, open the editor modal instead of navigating
    if (isEditMode) {
      const exp = experiences.find(e => e.id === expId);
      if (exp) {
        startEditing(exp);
      }
      return;
    }
    
    // Normal navigation in view mode
    const route = language === 'en' ? `/experience/${expId}` : `/${language}/experience/${expId}`;
    navigate(route);
  };

  // Function to get the correct resume file based on language
  const getResumeFile = () => {
    switch (language) {
      case 'es':
        return esResume;
      case 'en':
      default:
        return enResume;
    }
  };

  // Function to get the correct filename for download
  const getResumeFileName = () => {
    return `${language}_resume.pdf`;
  };

  // Show loading state
  if (loading) {
    return (
      <section id="home" className="relative min-h-screen w-full flex items-center justify-center bg-gray-900">
        <div className="text-white text-2xl">Loading...</div>
      </section>
    );
  }

  return (
    <>
      <section id="home" className="relative min-h-screen w-full">
        <div className="relative z-10 flex flex-col-reverse md:flex-row min-h-screen">
          <div className="flex-1 flex items-center justify-center px-4 py-12 md:py-0 bg-black/80 md:bg-black/50">
            <div className="text-left max-w-xl">
              <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 drop-shadow-lg">
                {person.name}
              </h1>
              {/* Use translated hero tagline - editable in edit mode */}
              <div className="text-xl md:text-3xl text-white/90 mb-8 max-w-2xl">
                {isEditMode ? (
                  <RichTextEditor
                    value={translations[language].hero_tagline}
                    entityType="section"
                    entityId={portfolio?.id || 1}
                    fieldName="hero_tagline"
                    label="Hero Tagline"
                    placeholder="Enter hero tagline..."
                  />
                ) : (
                  <p className="text-xl md:text-3xl text-white/90">
                    {translations[language].hero_tagline}
                  </p>
                )}
              </div>

              {/* Experience Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {experiences.map((exp) => {
                  const Icon = getIconComponent(exp.icon);
                  const experienceText = getExperienceText(exp);
                  
                  return (
                    <div 
                      key={exp.id} 
                      onClick={() => handleExperienceClick(exp.id)}
                      className="flex items-center gap-4 bg-black/30 p-4 rounded-lg backdrop-blur-sm border border-white/10 transform hover:-translate-y-1 transition-all duration-300 hover:border-[#14C800]/30 group cursor-pointer"
                    >
                      <div className="text-[#14C800] text-3xl group-hover:scale-110 transition-transform duration-300">
                        <Icon />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-white">{exp.years_experience || exp.years}+</span>
                          {/* Use translated years label */}
                          <span className="text-white/80 text-sm">{translations[language].years_label}</span>
                        </div>
                        <p className="text-white font-medium">{experienceText.name}</p>
                        <p className="text-white/60 text-sm">{experienceText.description}</p>
                      </div>
                      {/* Edit indicator in edit mode */}
                      {isEditMode && (
                        <div className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4 flex-wrap">
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="bg-[#14C800] text-white text-xl px-8 py-4 rounded-lg transition-all duration-300 hover:bg-[#14C800]/90 hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1"
                >
                  {translations[language].chat_with_ai}
                </button>
                <a
                  href={getResumeFile()}
                  download={getResumeFileName()}
                  className="bg-[#14C800] text-white text-xl px-8 py-4 rounded-lg transition-all duration-300 hover:bg-[#14C800]/90 hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1 inline-flex items-center"
                >
                  {translations[language].download_cv}
                </a>
              </div>
            </div>
          </div>

          {/* Right Image - with ImageUploader in edit mode */}
          <div className="flex-1 relative">
            {isEditMode && portfolio?.id ? (
              <ImageUploader
                currentImage={heroImage}
                entityType="portfolio"
                entityId={portfolio.id}
                category="hero"
                alt="Hero background"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <>
                <div
                  className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${heroImage})` }}
                />
                <div className="absolute inset-0 bg-black/30" />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Content Editor Modal */}
      {isEditMode && editingItem && (
        <ContentEditorModal
          type="experience"
          item={editingItem}
          isOpen={isModalOpen}
          onClose={stopEditing}
        />
      )}

      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
};

export default Hero;
