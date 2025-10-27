import React, { useState, useContext, useMemo } from 'react';
import defaultHeroImage from '../assets/images/hero.jpg';
import ChatModal from './ChatModal';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { translations } from '../data/translations';
import { useNavigate } from 'react-router-dom';
import enResume from '../assets/files/en_resume.pdf';
import esResume from '../assets/files/es_resume.pdf';
import { InlineTextEditor, ImageUploader, ContentEditorModal, RichTextEditor } from './cms';
import { useContentEditor } from '../hooks/useContentEditor';
import { useSectionLabel, SECTION_CODES } from '../hooks/useSectionLabel';

const Hero = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { portfolio, loading, getExperiences, getExperienceText, getSections, getSectionText } = usePortfolio();
  const { language } = useContext(LanguageContext);
  const { isEditMode } = useEditMode();
  const navigate = useNavigate();
  
  // Get editable section labels
  const yearsLabel = useSectionLabel(SECTION_CODES.YEARS_LABEL, 'years_label');
  
  // Get hero image from portfolio or use default
  const heroImage = useMemo(() => {
    if (!portfolio?.images || portfolio.images.length === 0) {
      return defaultHeroImage;
    }
    
    // Look for hero category images and get the most recent one
    // Filter all main images (hero background) and sort by ID (descending) to get the latest
    const heroImages = portfolio.images.filter(img => img.category === 'main');
    
    if (heroImages.length === 0) {
      return defaultHeroImage;
    }
    
    // Sort by ID descending to get the most recent upload
    heroImages.sort((a, b) => b.id - a.id);
    const heroImg = heroImages[0];
    
    if (heroImg?.image_path) {
      // If path starts with /uploads, construct full URL
      // Otherwise it's a full URL or needs to be relative to API
      if (heroImg.image_path.startsWith('/uploads/')) {
        return `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${heroImg.image_path}`;
      } else if (heroImg.image_path.startsWith('http://') || heroImg.image_path.startsWith('https://')) {
        return heroImg.image_path;
      } else {
        // Relative path - construct URL
        return `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/uploads/${heroImg.image_path}`;
      }
    }
    
    // Fallback to default
    return defaultHeroImage;
  }, [portfolio?.images]);
  
  // Content editor hook for experiences
  const { 
    editingItem, 
    isModalOpen, 
    startEditing, 
    stopEditing 
  } = useContentEditor('experience');

  // Get experiences from API
  const experiences = getExperiences();
  
  // Get hero tagline section
  const sections = getSections();
  const heroTaglineSection = sections.find(s => {
    const code = s.code?.trim();
    return code === 'HERO_TAGLINE' || code === 'hero_tagline';
  });
  const heroTaglineText = heroTaglineSection ? getSectionText(heroTaglineSection) : null;
  const heroTaglineValue = heroTaglineText?.text || translations[language].hero_tagline;
  
  // Get button label sections
  const chatButtonSection = sections.find(s => {
    const code = s.code?.trim();
    return code === 'CHAT_WITH_AI' || code === 'chat_with_ai';
  });
  const chatButtonText = chatButtonSection ? getSectionText(chatButtonSection) : null;
  const chatButtonValue = chatButtonText?.text || translations[language].chat_with_ai;
  
  const downloadCvSection = sections.find(s => {
    const code = s.code?.trim();
    return code === 'DOWNLOAD_CV' || code === 'download_cv';
  });
  const downloadCvText = downloadCvSection ? getSectionText(downloadCvSection) : null;
  const downloadCvValue = downloadCvText?.text || translations[language].download_cv;
  
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

  const handleExperienceClick = (expId, e) => {
    // Allow Ctrl+Click or Cmd+Click to navigate even in edit mode
    const isModifierClick = e?.ctrlKey || e?.metaKey;
    
    // In edit mode without modifier key, open the editor modal
    if (isEditMode && !isModifierClick) {
      const exp = experiences.find(e => e.id === expId);
      if (exp) {
        startEditing(exp);
      }
      return;
    }
    
    // Navigate to experience details (either normal mode or edit mode with modifier)
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
              {/* Editable person name in edit mode */}
              <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 drop-shadow-lg">
                {isEditMode && portfolio?.id ? (
                  <InlineTextEditor
                    value={person.name}
                    entityType="portfolio"
                    entityId={portfolio.id}
                    fieldName="name"
                    className="text-5xl md:text-7xl font-extrabold text-white drop-shadow-lg"
                    placeholder="Enter name..."
                  />
                ) : (
                  person.name
                )}
              </h1>
              
              {/* Use hero tagline - editable in edit mode */}
              <div className="text-xl md:text-3xl text-white/90 mb-8 max-w-2xl">
                {isEditMode ? (
                  heroTaglineText?.id ? (
                    <RichTextEditor
                      value={heroTaglineValue}
                      entityType="section"
                      entityId={heroTaglineText.id}
                      fieldName="text"
                      label="Hero Tagline"
                      placeholder="Enter hero tagline..."
                      className="text-xl md:text-3xl text-white/90"
                    />
                  ) : (
                    <div className="bg-yellow-900/50 border-2 border-yellow-500 rounded p-4 text-white">
                      <p className="text-sm mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="font-semibold">Hero Tagline Section Not Found</span>
                      </p>
                      <p className="text-sm mb-3">{heroTaglineValue}</p>
                      <p className="text-xs text-yellow-200">
                        Create a section with code '<strong>HERO_TAGLINE</strong>' or '<strong>hero_tagline</strong>' in the database to make this editable.
                        Currently showing fallback text from translations.
                      </p>
                    </div>
                  )
                ) : (
                  <p className="text-xl md:text-3xl text-white/90">
                    {heroTaglineValue}
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
                      onClick={(e) => handleExperienceClick(exp.id, e)}
                      className="flex items-center gap-4 bg-black/30 p-4 rounded-lg backdrop-blur-sm border border-white/10 transform hover:-translate-y-1 transition-all duration-300 hover:border-[#14C800]/30 group cursor-pointer"
                      title={isEditMode ? "Click to edit • Ctrl/Cmd+Click to view details" : "View experience details"}
                    >
                      <div className="text-[#14C800] text-3xl group-hover:scale-110 transition-transform duration-300">
                        <Icon />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-white">{exp.years_experience || exp.years}+</span>
                          {/* Use editable years label */}
                          <span className="text-white/80 text-sm">
                            {yearsLabel.renderEditable('text-white/80 text-sm')}
                          </span>
                        </div>
                        <p className="text-white font-medium">{experienceText.name}</p>
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

              <div className="flex gap-3 flex-col sm:flex-row">
                {/* Chat with AI button - editable label in edit mode */}
                <button
                  onClick={(e) => {
                    // In edit mode, only allow Ctrl/Cmd+Click to trigger the action
                    if (isEditMode && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    setIsChatOpen(true);
                  }}
                  title={isEditMode ? "Click to edit • Ctrl/Cmd+Click to open chat" : "Open chat"}
                  className="bg-[#14C800] text-white text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-4 rounded-lg transition-all duration-300 hover:bg-[#14C800]/90 hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1 whitespace-nowrap text-center"
                >
                  {isEditMode && !chatButtonText?.id ? (
                    <span className="text-sm italic opacity-75" title="Create 'chat_with_ai' section to edit">
                      {chatButtonValue} ⚠️
                    </span>
                  ) : isEditMode && chatButtonText?.id ? (
                    <InlineTextEditor
                      value={chatButtonValue}
                      entityType="section"
                      entityId={chatButtonText.id}
                      fieldName="text"
                      className="text-base sm:text-lg text-white"
                      placeholder="Chat button text..."
                    />
                  ) : (
                    chatButtonValue
                  )}
                </button>
                
                {/* Download CV button - editable label in edit mode */}
                <a
                  href={getResumeFile()}
                  download={getResumeFileName()}
                  onClick={(e) => {
                    // In edit mode, prevent download unless Ctrl/Cmd+Click
                    if (isEditMode && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  title={isEditMode ? "Click to edit • Ctrl/Cmd+Click to download" : "Download CV"}
                  className="bg-[#14C800] text-white text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-4 rounded-lg transition-all duration-300 hover:bg-[#14C800]/90 hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)] transform hover:-translate-y-1 inline-flex items-center justify-center whitespace-nowrap"
                >
                  {isEditMode && !downloadCvText?.id ? (
                    <span className="text-sm italic opacity-75" title="Create 'download_cv' section to edit">
                      {downloadCvValue} ⚠️
                    </span>
                  ) : isEditMode && downloadCvText?.id ? (
                    <InlineTextEditor
                      value={downloadCvValue}
                      entityType="section"
                      entityId={downloadCvText.id}
                      fieldName="text"
                      className="text-base sm:text-lg text-white"
                      placeholder="Download CV button text..."
                    />
                  ) : (
                    downloadCvValue
                  )}
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
                category="main"
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
