import React, { useContext } from 'react';
import { FaCalendar, FaArrowLeft, FaArrowRight, FaCode, FaDatabase, FaCloud } from 'react-icons/fa6';
import { translations } from '../data/translations';
import { LanguageContext } from '../context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { InlineTextEditor, EditableWrapper, EditableSectionWrapper, ContentEditableWYSIWYG } from './cms';

const ExperienceDetails = ({ experience, onBackClick, onPreviousClick, onNextClick }) => {
  const { language } = useContext(LanguageContext);
  const { getExperienceText, refreshPortfolio } = usePortfolio();
  const { isEditMode, authToken, showNotification } = useEditMode();
  const [isEditingYears, setIsEditingYears] = React.useState(false);
  const [yearsValue, setYearsValue] = React.useState('');
  const [yearsLabelValue, setYearsLabelValue] = React.useState('');
  const [isSavingYears, setIsSavingYears] = React.useState(false);

  // Handle successful save - refresh portfolio data
  const handleSaveSuccess = () => {
    refreshPortfolio();
  };

  // Handle years edit open
  const handleOpenYearsEdit = () => {
    setYearsValue(experience.years_experience || experience.years || '');
    setYearsLabelValue(translations[language].years_experience || 'Years of Experience');
    setIsEditingYears(true);
  };

  // Handle years save
  const handleSaveYears = async () => {
    const currentYears = experience.years_experience || experience.years;
    const newYearsNum = parseInt(yearsValue);

    if (!yearsValue || isNaN(newYearsNum)) {
      showNotification('Validation Error', 'Please enter a valid number', 'error');
      return;
    }

    if (newYearsNum === currentYears) {
      setIsEditingYears(false);
      return;
    }

    setIsSavingYears(true);
    try {
      const portfolioApi = await import('../services/portfolioApi');
      await portfolioApi.default.updateExperienceMetadata(
        experience.id,
        { years_experience: newYearsNum },
        authToken
      );
      await refreshPortfolio();
      showNotification('Success', 'Years of experience updated successfully', 'success');
      setIsEditingYears(false);
    } catch (err) {
      console.error('Failed to update years:', err);
      showNotification('Error', 'Failed to update years of experience. Please try again.', 'error');
    } finally {
      setIsSavingYears(false);
    }
  };

  // Handle years cancel
  const handleCancelYears = () => {
    setIsEditingYears(false);
    setYearsValue('');
  };

  // Early validation of required props
  if (!experience || !language) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">{translations[language].loading_experience}</p>
      </div>
    );
  }

  // Get experience text in current language
  const experienceText = getExperienceText(experience);

  // Get icon component based on icon name
  const getIconComponent = (iconName) => {
    switch (iconName) {
      case 'code':
        return FaCode;
      case 'database':
        return FaDatabase;
      case 'cloud':
        return FaCloud;
      default:
        return FaCode;
    }
  };

  const Icon = getIconComponent(experience.icon);

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
              <span>{translations[language].back_to_home}</span>
            </button>

            <div className="flex gap-4">
              {onPreviousClick && (
                <button
                  onClick={onPreviousClick}
                  className="btn-flat btn-flat-sm flex items-center gap-2"
                >
                  <FaArrowLeft />
                  <span>{translations[language].previous}</span>
                </button>
              )}
              {onNextClick && (
                <button
                  onClick={onNextClick}
                  className="btn-flat btn-flat-sm flex items-center gap-2"
                >
                  <span>{translations[language].next}</span>
                  <FaArrowRight />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Adjusted spacing */}
      <article className="max-w-7xl mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Experience Header - Moved down and added padding */}
          <header className="pt-32 pb-12">
            <div className="mt-16 flex items-start gap-6"> {/* Changed to items-start for better alignment */}
              <div className="text-[#14C800] text-5xl flex-shrink-0">
                <Icon />
              </div>
              <div className="flex-1 space-y-6"> {/* Added space-y-6 for vertical spacing */}
                {/* Experience Name */}
                <div>
                  {isEditMode ? (
                    <InlineTextEditor
                      value={experienceText.name}
                      entityType="experience"
                      entityId={experience.experience_texts?.find(t => t.language_id === (language === 'en' ? 1 : 2))?.id}
                      fieldName="name"
                      multiline={false}
                      className="text-4xl md:text-5xl font-bold text-white"
                      onSaveSuccess={handleSaveSuccess}
                    />
                  ) : (
                    <h1 className="text-4xl md:text-5xl font-bold text-white">
                      {experienceText.name}
                    </h1>
                  )}
                </div>

                {/* Years of Experience - Now in separate section with clear spacing */}
                <div>
                  {isEditMode ? (
                    <div
                      className="flex items-baseline gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={handleOpenYearsEdit}
                      title="Click to edit"
                    >
                      <span className="text-2xl font-bold text-[#14C800]">{experience.years_experience || experience.years}+</span>
                      <span className="text-white/80">{translations[language].years_experience}</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-[#14C800]">{experience.years_experience || experience.years}+</span>
                      <span className="text-white/80">{translations[language].years_experience}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Experience Content */}
          <div className="prose prose-lg prose-invert max-w-none">
            <div className="bg-gray-800 rounded-xl p-8 shadow-lg space-y-8">
              <EditableSectionWrapper
                label="Experience Overview"
                isVisible={isEditMode}
              >
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">
                    {translations[language].experience_overview}
                  </h2>
                  <ContentEditableWYSIWYG
                    value={experienceText.description}
                    entityType="experience"
                    entityId={experience.experience_texts?.find(t => t.language_id === (language === 'en' ? 1 : 2))?.id}
                    fieldName="description"
                    className="text-gray-300 text-lg leading-relaxed prose prose-invert max-w-none"
                    minHeight={400}
                    label="Experience Overview"
                    placeholder="Enter experience overview with rich formatting..."
                    onSaveSuccess={handleSaveSuccess}
                  />
                </div>
              </EditableSectionWrapper>

              {/* Skills Section */}
              {experience.skills && experience.skills.length > 0 && (
                <EditableSectionWrapper
                  label="Skills & Technologies"
                  isVisible={isEditMode}
                >
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-6">
                      {translations[language].skills_technologies}
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {experience.skills.map((skill, index) => {
                        // Get skill name - handle both old and new API structure
                        const skillName = skill.skill_texts && skill.skill_texts.length > 0
                          ? skill.skill_texts[0].name
                          : skill.name?.[language] || skill.name || 'Skill';

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
                    {isEditMode && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-400 italic">
                          Note: Skills are managed through the Skills section. This view shows skills associated with this experience.
                        </p>
                      </div>
                    )}
                  </div>
                </EditableSectionWrapper>
              )}
            </div>
          </div>
        </div>
      </article>

      {/* Years of Experience Edit Modal */}
      {isEditingYears && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div
            className="bg-[#03060a] border border-white/10 shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">
                Edit Years of Experience
              </h3>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {/* Years Number Field */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Number of Years
                  </label>
                  <input
                    type="number"
                    value={yearsValue}
                    onChange={(e) => setYearsValue(e.target.value)}
                    disabled={isSavingYears}
                    min="0"
                    max="99"
                    className={`
                      w-full p-2
                      border
                      bg-transparent
                      text-white
                      focus:outline-none focus:ring-2 focus:ring-[#14C800]
                      ${isSavingYears ? 'opacity-50 cursor-wait' : ''}
                      border-white/10
                    `}
                    placeholder="Enter years (e.g., 5)"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSavingYears) {
                        handleSaveYears();
                      } else if (e.key === 'Escape' && !isSavingYears) {
                        handleCancelYears();
                      }
                    }}
                  />
                </div>

                {/* Years Label Field (Display Only - From Translations) */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Label Text
                  </label>
                  <input
                    type="text"
                    value={yearsLabelValue}
                    readOnly
                    disabled
                    className={`
                      w-full p-2
                      border
                      bg-gray-800/50
                      text-white/60
                      cursor-not-allowed
                      border-white/10
                    `}
                    placeholder="Years of Experience"
                  />
                  <p className="mt-1 text-xs text-white/50 italic">
                    Label text comes from language translations and cannot be edited here.
                  </p>
                </div>

                <div className="text-xs text-white/60 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Enter the number of years. Press Enter to save or Escape to cancel.</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/10 bg-transparent flex justify-end gap-2">
              <button
                onClick={handleCancelYears}
                disabled={isSavingYears}
                className="btn-flat btn-flat-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>

              <button
                onClick={handleSaveYears}
                disabled={isSavingYears}
                className="btn-flat btn-flat-sm btn-flat-active flex items-center gap-1.5"
              >
                {isSavingYears ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExperienceDetails;
