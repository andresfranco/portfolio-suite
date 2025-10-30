import React, { useState, useContext, useMemo, useEffect } from 'react';
import defaultHeroImage from '../assets/images/hero.jpg';
import ChatModal from './ChatModal';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { translations } from '../data/translations';
import { useNavigate } from 'react-router-dom';
import { InlineTextEditor, ImageUploader, ContentEditorModal, RichTextEditor, ExperienceSelector } from './cms';
import { useContentEditor } from '../hooks/useContentEditor';
import { useSectionLabel, SECTION_CODES } from '../hooks/useSectionLabel';
import { portfolioApi } from '../services/portfolioApi';

const Hero = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [resumeUrl, setResumeUrl] = useState(null);
  const [resumeFileName, setResumeFileName] = useState(null);
  const { portfolio, loading, getExperiences, getExperienceText, getSections, getSectionText, refreshPortfolio } = usePortfolio();
  const { language } = useContext(LanguageContext);
  const { isEditMode, authToken, showNotification } = useEditMode();
  const navigate = useNavigate();
  
  // Get editable section labels
  const yearsLabel = useSectionLabel(SECTION_CODES.YEARS_LABEL, 'years_label');
  
  // Language ID mapping
  const languageIdMap = {
    'en': 1,
    'es': 2
  };
  
  // Technical Resume category ID
  const TECHNICAL_RESUME_CATEGORY_ID = 63;
  
  // Fetch default resume based on language and category
  useEffect(() => {
    const fetchDefaultResume = async () => {
      if (!portfolio?.id) return;
      
      const languageId = languageIdMap[language] || 1; // Default to English
      
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        const response = await fetch(
          `${apiUrl}/api/portfolios/${portfolio.id}/attachments/default-resume?language_id=${languageId}&category_id=${TECHNICAL_RESUME_CATEGORY_ID}`,
          {
            credentials: 'include',
            mode: 'cors'
          }
        );
        
        if (response.ok) {
          const resumeData = await response.json();
          if (resumeData.file_url) {
            setResumeUrl(`${apiUrl}${resumeData.file_url}`);
            setResumeFileName(resumeData.file_name || `${language}_resume.pdf`);
          }
        } else {
          console.warn('No default resume found for language:', language);
          setResumeUrl(null);
          setResumeFileName(null);
        }
      } catch (error) {
        console.error('Error fetching default resume:', error);
        setResumeUrl(null);
        setResumeFileName(null);
      }
    };
    
    fetchDefaultResume();
  }, [portfolio?.id, language]);
  
  // Get hero image from portfolio or use default
  const heroImage = useMemo(() => {
    if (!portfolio?.images || portfolio.images.length === 0) {
      return defaultHeroImage;
    }
    
    const languageId = languageIdMap[language] || 1; // Default to English
    
    // Look for main category images filtered by current language
    const heroImages = portfolio.images.filter(img => 
      img.category === 'main' && 
      img.language_id === languageId
    );
    
    if (heroImages.length === 0) {
      console.warn(`No main image found for language ${language} (ID: ${languageId}), using default`);
      return defaultHeroImage;
    }
    
    // Sort by ID descending to get the most recent upload for this language
    heroImages.sort((a, b) => b.id - a.id);
    const heroImg = heroImages[0];
    
    console.log(`Using hero image for language ${language}:`, heroImg);
    
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
  }, [portfolio?.images, language]);
  
  // Content editor hook for experiences
  const { 
    editingItem, 
    isModalOpen, 
    startEditing, 
    stopEditing 
  } = useContentEditor('experience');
  
  // State for create modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isExperienceSelectorOpen, setIsExperienceSelectorOpen] = useState(false);
  const [experienceToDelete, setExperienceToDelete] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

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
    navigate(`/experience/${expId}`);
  };
  
  /**
   * Handle adding new experience
   */
  const handleAddExperience = () => {
    setShowAddMenu(!showAddMenu);
  };
  
  /**
   * Handle creating a new experience
   */
  const handleCreateNewExperience = () => {
    setShowAddMenu(false);
    setIsCreateModalOpen(true);
  };
  
  /**
   * Handle adding an existing experience
   */
  const handleAddExistingExperience = () => {
    setShowAddMenu(false);
    setIsExperienceSelectorOpen(true);
  };
  
  /**
   * Handle selecting an existing experience from the selector
   */
  const handleSelectExperience = async (experience) => {
    if (!portfolio?.id || !authToken) return;
    
    try {
      // Add the experience to the portfolio
      await portfolioApi.addExperienceToPortfolio(portfolio.id, experience.id, authToken);
      
      // Refresh portfolio data
      await refreshPortfolio();
      
      // Show success notification
      const text = getExperienceText(experience);
      showNotification(
        'Experience Added',
        `${text.name} has been added to the portfolio`,
        'success'
      );
    } catch (error) {
      console.error('Failed to add experience:', error);
      showNotification(
        'Add Failed',
        error.message || 'Failed to add experience to portfolio',
        'error'
      );
    }
  };
  
  /**
   * Handle deleting an experience
   */
  const handleDeleteExperience = async (expId, e) => {
    e.stopPropagation(); // Prevent click-through to the card
    
    const exp = experiences.find(e => e.id === expId);
    if (!exp) return;
    
    setExperienceToDelete(exp);
  };
  
  /**
   * Confirm delete experience
   */
  const confirmDeleteExperience = async () => {
    if (!experienceToDelete || !authToken) return;
    
    try {
      // Remove from portfolio first
      if (portfolio?.id) {
        await portfolioApi.removeExperienceFromPortfolio(portfolio.id, experienceToDelete.id, authToken);
      }
      
      // Optionally delete the experience itself
      // Uncomment if you want to actually delete the experience entity:
      // await portfolioApi.deleteExperience(experienceToDelete.id, authToken);
      
      // Refresh portfolio data
      await refreshPortfolio();
      
      // Show success notification
      showNotification(
        'Experience Removed',
        `${getExperienceText(experienceToDelete).name} has been removed from the portfolio`,
        'success'
      );
      
      setExperienceToDelete(null);
    } catch (error) {
      console.error('Failed to delete experience:', error);
      showNotification(
        'Delete Failed',
        error.message || 'Failed to remove experience',
        'error'
      );
    }
  };

  // Function to get the correct resume file based on language
  const getResumeFile = () => {
    // Return the dynamically fetched resume URL, or null if not available
    return resumeUrl;
  };

  // Function to get the correct filename for download
  const getResumeFileName = () => {
    return resumeFileName || `${language}_resume.pdf`;
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
      <section
        id="home"
        className="relative overflow-hidden bg-[#050b13] min-h-[70vh] md:min-h-[65vh] pt-28 md:pt-36 pb-20"
      >
        <div
          className={`absolute inset-y-0 right-0 w-full lg:w-1/2 overflow-hidden transition-opacity duration-300 ${isEditMode ? "" : "pointer-events-none"}`}
        >
          <div className="absolute inset-0">
            {isEditMode && portfolio?.id ? (
              <ImageUploader
                currentImage={heroImage}
                entityType="portfolio"
                entityId={portfolio.id}
                category="main"
                alt="Hero visual"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <img
                src={heroImage}
                alt="Hero visual"
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-l from-[#03060a]/20 via-[#03060a]/45 to-transparent mix-blend-soft-light" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/45" />
            <div className="absolute top-[-10%] right-[-5%] w-[70%] h-[60%] bg-[#03060a]/55 blur-3xl" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[85%] h-[70%] bg-[#03060a]/55 blur-[120px]" />
            <div className="absolute top-[-10%] left-[-20%] w-[50%] h-[55%] bg-[#03060a]/65 blur-[110px]" />
            <div className="absolute bottom-[-15%] left-[-15%] w-[60%] h-[65%] bg-[#03060a]/55 blur-[120px]" />
          </div>
        </div>

        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        <div className="absolute -left-24 top-1/3 w-72 h-72 rounded-full bg-[#14C800]/10 blur-3xl pointer-events-none" />
        <div className="absolute -right-28 top-1/2 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full px-6 md:px-12 lg:px-[7vw] py-16">
          <div className="flex flex-col gap-8 max-w-[720px] items-start">
            {/* Editable person name in edit mode */}
            <h1 className="text-4xl md:text-6xl font-extrabold text-white drop-shadow-lg">
              {isEditMode && portfolio?.id ? (
                <InlineTextEditor
                  value={person.name}
                  entityType="portfolio"
                  entityId={portfolio.id}
                  fieldName="name"
                  className="text-4xl md:text-6xl font-extrabold text-white drop-shadow-lg"
                  placeholder="Enter name..."
                />
              ) : (
                person.name
              )}
            </h1>

            {/* Use hero tagline - editable in edit mode */}
            <div className="text-lg md:text-2xl text-white/90 max-w-2xl">
              {isEditMode ? (
                heroTaglineText?.id ? (
                  <RichTextEditor
                    value={heroTaglineValue}
                    entityType="section"
                    entityId={heroTaglineText.id}
                    fieldName="text"
                    label="Hero Tagline"
                    placeholder="Enter hero tagline..."
                    className="text-lg md:text-2xl text-white/90"
                  />
                ) : (
                  <div className="bg-yellow-900/50 border-2 border-yellow-500 p-4 text-white">
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
                <p className="text-lg md:text-2xl text-white/90">
                  {heroTaglineValue}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-6 w-full items-start">
              {/* Experience Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-[720px] justify-items-stretch">
                {experiences.map((exp) => {
                  const Icon = getIconComponent(exp.icon);
                  const experienceText = getExperienceText(exp);

                  return (
                    <div
                      key={exp.id}
                      onClick={(e) => handleExperienceClick(exp.id, e)}
                      className="relative flex flex-col gap-3 items-start bg-white/10 p-5 min-h-[180px] backdrop-blur-sm shadow-[0_15px_35px_rgba(5,10,30,0.4)] transform hover:-translate-y-1 transition-all duration-300 hover:bg-white/20 group cursor-pointer"
                      title={isEditMode ? "Click to edit • Ctrl/Cmd+Click to view details" : "View experience details"}
                    >
                      <div className="flex items-center justify-center w-14 h-14 bg-[#14C800]/10 text-[#14C800] text-2xl group-hover:scale-105 group-hover:bg-[#14C800]/25 transition-all duration-300 self-start">
                        <Icon />
                      </div>
                      <div className="flex-1 flex flex-col items-start justify-center">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-white">{exp.years_experience || exp.years}+</span>
                          {/* Use editable years label */}
                          <span className="text-white/60 text-xs uppercase tracking-wide">
                            {yearsLabel.renderEditable('text-white/60 text-xs uppercase tracking-wide')}
                          </span>
                        </div>
                        <p className="mt-1 text-white font-semibold leading-relaxed">
                          {experienceText.name}
                        </p>
                      </div>

                      {/* Edit mode controls */}
                      {isEditMode && (
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleDeleteExperience(exp.id, e)}
                            className="p-1.5 bg-red-500/80 hover:bg-red-600 text-white transition-colors"
                            title="Remove experience"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}

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

                {/* Add new experience button in edit mode */}
                {isEditMode && (
                  <div className="relative">
                    <button
                      onClick={handleAddExperience}
                      className="flex flex-col items-start justify-center gap-3 bg-white/10 hover:bg-white/20 p-5 min-h-[180px] backdrop-blur-sm transition-all duration-300 text-white/70 hover:text-[#14C800] w-full text-left"
                      title="Add experience"
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="font-medium">Add Experience</span>
                    </button>

                    {/* Dropdown menu */}
                    {showAddMenu && (
                      <div
                        className="absolute top-full left-0 right-0 mt-2 bg-white shadow-xl border border-gray-200 overflow-hidden z-10"
                        onMouseLeave={() => setShowAddMenu(false)}
                      >
                        <button
                          onClick={handleCreateNewExperience}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 group"
                        >
                          <div className="w-10 h-10 bg-blue-100 group-hover:bg-blue-600 flex items-center justify-center transition-colors">
                            <svg className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">Create New</div>
                            <div className="text-sm text-gray-600">Create a brand new experience</div>
                          </div>
                        </button>

                        <div className="border-t border-gray-200"></div>

                        <button
                          onClick={handleAddExistingExperience}
                          className="w-full px-4 py-3 text-left hover:bg-green-50 transition-colors flex items-center gap-3 group"
                        >
                          <div className="w-10 h-10 bg-green-100 group-hover:bg-green-600 flex items-center justify-center transition-colors">
                            <svg className="w-5 h-5 text-green-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">Add Existing</div>
                            <div className="text-sm text-gray-600">Add from existing experiences</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center w-full">
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
                  className="btn-flat btn-flat-lg whitespace-nowrap"
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
                  {resumeUrl ? (
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
                      className="btn-flat btn-flat-lg inline-flex items-center justify-center whitespace-nowrap"
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
                  ) : (
                    <button
                      disabled
                      title="No resume available for this language"
                      className="btn-flat btn-flat-lg inline-flex items-center justify-center whitespace-nowrap"
                    >
                    {downloadCvValue} (Not Available)
                  </button>
                )}
              </div>
            </div>
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
          mode="edit"
        />
      )}
      
      {/* Create Experience Modal */}
      {isEditMode && isCreateModalOpen && (
        <ContentEditorModal
          type="experience"
          item={null}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          mode="create"
        />
      )}
      
      {/* Experience Selector Modal */}
      {isEditMode && isExperienceSelectorOpen && (
        <ExperienceSelector
          isOpen={isExperienceSelectorOpen}
          onClose={() => setIsExperienceSelectorOpen(false)}
          onSelect={handleSelectExperience}
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      {isEditMode && experienceToDelete && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onClick={() => setExperienceToDelete(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Remove Experience
                </h3>
                <p className="text-gray-600 mb-4">
                  Are you sure you want to remove <strong>{getExperienceText(experienceToDelete).name}</strong> from your portfolio? 
                  This will not delete the experience permanently, only remove it from this portfolio.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setExperienceToDelete(null)}
                    className="btn-flat btn-flat-sm text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteExperience}
                    className="btn-flat btn-flat-sm text-red-300 hover:text-red-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
};

export default Hero;
