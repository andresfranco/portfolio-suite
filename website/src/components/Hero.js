import React, { useState, useContext, useMemo, useEffect, useRef } from 'react';
import defaultHeroImage from '../assets/images/hero.jpg';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { translations } from '../data/translations';
import { useNavigate } from 'react-router-dom';
import { InlineTextEditor } from './cms/InlineTextEditor';
import { ImageUploader } from './cms/ImageUploader';
import { ContentEditorModal } from './cms/ContentEditorModal';
import { RichTextEditor } from './cms/RichTextEditor';
import { ExperienceSelector } from './cms/ExperienceSelector';
import { useContentEditor } from '../hooks/useContentEditor';
import { useSectionLabel, SECTION_CODES } from '../hooks/useSectionLabel';
import { portfolioApi } from '../services/portfolioApi';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import DraggableExperienceCard from './DraggableExperienceCard';
import './DragAndDrop.css';

const Hero = () => {
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
      return defaultHeroImage;
    }
    
    // Sort by ID descending to get the most recent upload for this language
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
  }, [portfolio?.images, language]);
  
  // Content editor hook for experiences
  const { 
    editingItem, 
    isModalOpen, 
    startEditing, 
    stopEditing,
    reorderItems
  } = useContentEditor('experience');
  
  // State for create modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isExperienceSelectorOpen, setIsExperienceSelectorOpen] = useState(false);
  const [experienceToDelete, setExperienceToDelete] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Get experiences from API - memoize to prevent infinite loops
  const apiExperiences = useMemo(() => getExperiences(), [portfolio?.experiences]);
  
  // Local state for optimistic UI updates during drag and drop
  const [experiences, setExperiences] = useState([]);
  
  // Track if we're currently reordering to prevent sync conflicts
  const isReorderingRef = useRef(false);
  
  // Track previous API experiences to detect actual changes
  const prevApiExperiencesRef = useRef([]);
  
  // Sync local state with API data (but not during reordering)
  useEffect(() => {
    if (!isReorderingRef.current) {
      // Only update if the array contents actually changed
      const hasChanged = 
        apiExperiences.length !== prevApiExperiencesRef.current.length ||
        apiExperiences.some((exp, index) => {
          const prevExp = prevApiExperiencesRef.current[index];
          return !prevExp || exp.id !== prevExp.id;
        });
      
      if (hasChanged) {
        setExperiences(apiExperiences);
        prevApiExperiencesRef.current = apiExperiences;
      }
    }
  }, [apiExperiences]);
  
  // Get hero tagline section
  const sections = getSections();
  const heroTaglineSection = sections.find(s => {
    const code = s.code?.trim();
    return code === 'HERO_TAGLINE' || code === 'hero_tagline';
  });
  const heroTaglineText = heroTaglineSection ? getSectionText(heroTaglineSection) : null;
  const heroTaglineValue = heroTaglineText?.text || translations[language].hero_tagline;
  
  // Get button label sections
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

  // Function to handle resume download
  const handleResumeDownload = async (e) => {
    e.preventDefault();

    // In edit mode, prevent download unless Ctrl/Cmd+Click
    if (isEditMode && !e.ctrlKey && !e.metaKey) {
      e.stopPropagation();
      return;
    }

    const url = getResumeFile();
    if (!url) return;

    try {
      // Fetch the file as a blob
      const response = await fetch(url, {
        credentials: 'include',
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error('Failed to download resume');
      }

      const blob = await response.blob();

      // Create a temporary URL for the blob
      const blobUrl = window.URL.createObjectURL(blob);

      // Create a temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = getResumeFileName();
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading resume:', error);
      // Fallback: open in new tab if download fails
      window.open(url, '_blank');
    }
  };

  /**
   * Handle drag end event to reorder experiences
   */
  const handleDragEnd = async (result) => {
    
    // If dropped outside the list or no movement
    if (!result.destination) {
      return;
    }
    
    if (result.destination.index === result.source.index) {
      return;
    }


    // Set flag to prevent useEffect from resetting our optimistic update
    isReorderingRef.current = true;

    // Optimistically update the UI immediately
    const reorderedExperiences = Array.from(experiences);
    const [movedItem] = reorderedExperiences.splice(result.source.index, 1);
    reorderedExperiences.splice(result.destination.index, 0, movedItem);
    
    
    // Update local state immediately for instant feedback
    setExperiences(reorderedExperiences);

    // Get the new order of IDs
    const newOrderIds = reorderedExperiences.map(exp => exp.id);

    try {
      // Persist the new order to the backend
      await reorderItems(newOrderIds, portfolio.id);
      
      // Wait a bit for the backend to process before allowing sync
      setTimeout(() => {
        isReorderingRef.current = false;
      }, 500);
    } catch (error) {
      console.error('Failed to reorder experiences:', error);
      // Revert to original order on error
      setExperiences(apiExperiences);
      isReorderingRef.current = false;
      // The error notification is already shown by reorderItems
    }
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
        className="relative overflow-hidden bg-[#050b13] min-h-[70vh] md:min-h-[65vh] lg:min-h-[75vh] xl:min-h-[80vh] pt-28 md:pt-36 pb-20 w-full max-w-[100vw]"
      >
        <div
          className={`absolute top-0 bottom-0 right-0 w-full lg:w-[55%] overflow-hidden transition-opacity duration-300 z-0 ${isEditMode ? "" : "pointer-events-none"}`}
        >
          {/* Background image layer */}
          <div className="absolute inset-0">
            <img
              src={heroImage}
              alt="Hero visual"
              className="absolute inset-0 w-full h-full object-cover object-right opacity-80"
            />
          </div>
          
          {/* Overlay effects - only block pointer events when NOT in edit mode */}
          <div className={`absolute inset-0 z-[1] ${isEditMode ? 'pointer-events-none' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-l from-[#03060a]/10 via-[#03060a]/40 lg:via-[#03060a]/50 to-[#03060a]/80 lg:to-transparent mix-blend-soft-light" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/15 to-black/40" />
            <div className="absolute top-[-10%] right-[-5%] w-[70%] h-[60%] bg-[#03060a]/55 blur-3xl" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[85%] h-[70%] bg-[#03060a]/55 blur-[120px]" />
            <div className="absolute top-[-10%] left-[-20%] w-[50%] h-[55%] bg-[#03060a]/65 blur-[110px]" />
            <div className="absolute bottom-[-15%] left-[-15%] w-[60%] h-[65%] bg-[#03060a]/55 blur-[120px]" />
          </div>
          
          {/* Edit mode: Interactive image uploader overlay */}
          {isEditMode && portfolio?.id && (
            <div className="absolute inset-0 z-[2]">
              <ImageUploader
                currentImage={heroImage}
                entityType="portfolio"
                entityId={portfolio.id}
                category="main"
                alt="Hero visual"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-[5]" />
        <div className="absolute -left-24 top-1/3 w-72 h-72 rounded-full bg-[#14C800]/10 blur-3xl pointer-events-none z-[5]" />
        <div className="absolute -right-28 top-1/2 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none z-[5]" />

        <div className="relative z-20 w-full px-6 md:px-12 lg:px-[7vw] xl:px-[5vw] 2xl:px-[10vw] py-16">
          <div className="flex flex-col gap-8 max-w-full lg:max-w-[50%] xl:max-w-[55%] 2xl:max-w-[60%] items-start">
            {/* Editable person name in edit mode */}
            <h1 className="text-4xl md:text-6xl xl:text-7xl 2xl:text-8xl font-extrabold text-white drop-shadow-lg">
              {isEditMode && portfolio?.id ? (
                <InlineTextEditor
                  value={person.name}
                  entityType="portfolio"
                  entityId={portfolio.id}
                  fieldName="name"
                  className="text-4xl md:text-6xl xl:text-7xl 2xl:text-8xl font-extrabold text-white drop-shadow-lg"
                  placeholder="Enter name..."
                />
              ) : (
                person.name
              )}
            </h1>

            {/* Use hero tagline - editable in edit mode */}
            <div className="text-lg md:text-2xl xl:text-3xl 2xl:text-4xl text-white/90 max-w-full">
              {isEditMode ? (
                heroTaglineText?.id ? (
                  <RichTextEditor
                    value={heroTaglineValue}
                    entityType="section"
                    entityId={heroTaglineText.id}
                    fieldName="text"
                    label="Hero Tagline"
                    placeholder="Enter hero tagline..."
                    className="text-lg md:text-2xl xl:text-3xl 2xl:text-4xl text-white/90"
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
                <p className="text-lg md:text-2xl xl:text-3xl 2xl:text-4xl text-white/90">
                  {heroTaglineValue}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-6 w-full items-start">
              {/* Experience Section with Drag and Drop */}
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="experiences-list" isDropDisabled={!isEditMode}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 w-full max-w-full justify-items-stretch transition-all duration-300 droppable-container ${
                        snapshot.isDraggingOver && isEditMode 
                          ? 'gap-12 is-dragging-over' 
                          : 'gap-6'
                      }`}
                      style={{
                        minHeight: snapshot.isDraggingOver ? '500px' : 'auto',
                        padding: snapshot.isDraggingOver ? '1.5rem' : '0',
                      }}
                    >
                      {experiences.map((exp, index) => {
                        const experienceText = getExperienceText(exp);

                        return (
                          <DraggableExperienceCard
                            key={exp.id}
                            experience={exp}
                            index={index}
                            isEditMode={isEditMode}
                            experienceText={experienceText}
                            yearsLabel={yearsLabel}
                            onCardClick={handleExperienceClick}
                            onDelete={handleDeleteExperience}
                            getIconComponent={getIconComponent}
                          />
                        );
                      })}
                      {provided.placeholder}

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
                              className="absolute top-full left-0 right-0 mt-2 bg-[#03060a] border border-white/10 overflow-hidden z-10 shadow-[0_20px_45px_rgba(10,15,30,0.55)]"
                              onMouseLeave={() => setShowAddMenu(false)}
                            >
                              <button
                                onClick={handleCreateNewExperience}
                                className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-3 group"
                              >
                                <div className="w-10 h-10 bg-white/5 border border-[#14C800]/50 group-hover:bg-[#14C800] group-hover:border-[#14C800] flex items-center justify-center transition-colors">
                                  <svg className="w-5 h-5 text-[#14C800] group-hover:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-white">Create New</div>
                                  <div className="text-sm text-white/70">Create a brand new experience</div>
                                </div>
                              </button>

                              <div className="border-t border-white/10"></div>

                              <button
                                onClick={handleAddExistingExperience}
                                className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-3 group"
                              >
                                <div className="w-10 h-10 bg-white/5 border border-[#14C800]/50 group-hover:bg-[#14C800] group-hover:border-[#14C800] flex items-center justify-center transition-colors">
                                  <svg className="w-5 h-5 text-[#14C800] group-hover:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-white">Add Existing</div>
                                  <div className="text-sm text-white/70">Add from existing experiences</div>
                                </div>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center w-full flex-wrap">
                {/* Download CV button - editable label in edit mode */}
                  {resumeUrl ? (
                    <button
                      onClick={handleResumeDownload}
                      title={isEditMode ? "Click to edit • Ctrl/Cmd+Click to download" : "Download CV"}
                      className="btn-flat btn-flat-lg inline-flex items-center justify-center whitespace-nowrap text-base md:text-lg xl:text-xl"
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
                  </button>
                  ) : (
                    <button
                      disabled
                      title="No resume available for this language"
                      className="btn-flat btn-flat-lg inline-flex items-center justify-center whitespace-nowrap text-base md:text-lg xl:text-xl"
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
            className="bg-[#03060a] border border-white/10 rounded-none shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-none bg-red-500/10 border border-red-500/40 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Remove Experience
                </h3>
                <p className="text-white/70 mb-4">
                  Are you sure you want to remove <strong className="text-white">{getExperienceText(experienceToDelete).name}</strong> from your portfolio?
                  This will not delete the experience permanently, only remove it from this portfolio.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setExperienceToDelete(null)}
                    className="btn-flat btn-flat-sm"
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

    </>
  );
};

export default Hero;
