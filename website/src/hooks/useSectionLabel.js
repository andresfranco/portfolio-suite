import { useContext } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useEditMode } from '../context/EditModeContext';
import { LanguageContext } from '../context/LanguageContext';
import { translations } from '../data/translations';
import { InlineTextEditor } from '../components/cms/InlineTextEditor';

/**
 * Hook to get section labels with edit mode support
 * Returns the section text with optional inline editor wrapper
 * 
 * @param {string} sectionCode - The section code (e.g., 'HOME', 'PROJECTS', 'CONTACT')
 * @param {string} fallbackKey - The key in translations object (e.g., 'home', 'projects')
 * @param {Object} editorProps - Additional props for InlineTextEditor
 * @returns {Object} - { value, renderEditable }
 */
export const useSectionLabel = (sectionCode, fallbackKey, editorProps = {}) => {
  const { getSections, getSectionText } = usePortfolio();
  const { isEditMode } = useEditMode();
  const { language } = useContext(LanguageContext);
  
  // Get sections from portfolio
  const sections = getSections();
  const section = sections.find(s => {
    const trimmedCode = s.code?.trim();
    return trimmedCode === sectionCode || 
           trimmedCode === sectionCode.toLowerCase() ||
           trimmedCode === sectionCode.toUpperCase();
  });
  
  const sectionText = section ? getSectionText(section) : null;
  
  // Debug logging in development
  if (isEditMode) {
  }
  
  // Get the value (section text or fallback)
  const value = sectionText?.text || translations[language][fallbackKey] || fallbackKey;
  
  /**
   * Render the label with edit mode support
   * @param {string} className - CSS classes to apply
   * @param {string} placeholder - Placeholder text for editor
   * @returns {JSX.Element}
   */
  const renderEditable = (className = '', placeholder = 'Enter text...') => {
    // Not in edit mode - just return the text
    if (!isEditMode) {
      return value;
    }
    
    // Debug check - log the issue
    if (!section) {
    } else if (!sectionText?.id) {
    }
    
    // Edit mode but no section or section text found - show warning
    if (!section || !sectionText?.id) {
      return (
        <span 
          className="inline-flex items-center gap-1" 
          title={`${!section ? 'Section not found' : 'Section text not found'}: '${sectionCode}'`}
        >
          {value}
          <svg className="w-3 h-3 text-yellow-500 inline" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </span>
      );
    }
    
    // Edit mode with section - render inline editor
    return (
      <InlineTextEditor
        value={value}
        entityType="section"
        entityId={sectionText.id}
        fieldName="text"
        className={className}
        placeholder={placeholder}
        {...editorProps}
      />
    );
  };
  
  return {
    value,
    renderEditable,
    hasSection: !!sectionText?.id,
    sectionCode,
  };
};

/**
 * Mapping of common label keys to section codes
 * Makes it easier to use consistent naming
 */
export const SECTION_CODES = {
  // Navigation
  HOME: 'NAV_HOME',
  PROJECTS: 'NAV_PROJECTS',
  CONTACT: 'NAV_CONTACT',
  BRAND_NAME: 'BRAND_NAME',
  
  // Hero section
  HERO_TAGLINE: 'HERO_TAGLINE',
  CHAT_WITH_AI: 'CHAT_WITH_AI',
  DOWNLOAD_CV: 'DOWNLOAD_CV',
  YEARS_LABEL: 'YEARS_LABEL',
  
  // Common buttons
  GET_IN_TOUCH: 'BTN_GET_IN_TOUCH',
  BACK_TO_PROJECTS: 'BTN_BACK_TO_PROJECTS',
  BACK_TO_HOME: 'BTN_BACK_TO_HOME',
  VIEW_LIVE_SITE: 'BTN_VIEW_LIVE_SITE',
  VIEW_REPOSITORY: 'BTN_VIEW_REPOSITORY',
  VIEW_FULL_DETAILS: 'BTN_VIEW_FULL_DETAILS',
  SEND_MESSAGE: 'BTN_SEND_MESSAGE',
  SENDING: 'BTN_SENDING',
  PREVIOUS: 'BTN_PREVIOUS',
  NEXT: 'BTN_NEXT',
  CLOSE: 'BTN_CLOSE',
  
  // Project page
  PROJECT_OVERVIEW: 'LABEL_PROJECT_OVERVIEW',
  SKILLS_TECHNOLOGIES: 'LABEL_SKILLS_TECHNOLOGIES',
  PROJECT_DETAILS: 'LABEL_PROJECT_DETAILS',
  DATE_LABEL: 'LABEL_DATE',
  CATEGORY_LABEL: 'LABEL_CATEGORY',
  PROJECT_NOT_FOUND: 'MSG_PROJECT_NOT_FOUND',
  LOADING_PROJECT: 'MSG_LOADING_PROJECT',
  PROJECT_UNAVAILABLE: 'MSG_PROJECT_UNAVAILABLE',
  
  // Experience page
  YEARS_EXPERIENCE: 'LABEL_YEARS_EXPERIENCE',
  EXPERIENCE_OVERVIEW: 'LABEL_EXPERIENCE_OVERVIEW',
  LOADING_EXPERIENCE: 'MSG_LOADING_EXPERIENCE',
  SKILL_LEVEL: 'LABEL_SKILL_LEVEL',
  
  // Contact page
  GITHUB: 'SOCIAL_GITHUB',
  LINKEDIN: 'SOCIAL_LINKEDIN',
  TWITTER: 'SOCIAL_TWITTER',
  CONTACT_FORM: 'LABEL_CONTACT_FORM',
  CONTACT_PAGE_DESCRIPTION: 'LABEL_CONTACT_DESCRIPTION',
  NAME_LABEL: 'FORM_NAME',
  EMAIL_LABEL: 'FORM_EMAIL',
  SUBJECT_LABEL: 'FORM_SUBJECT',
  MESSAGE_LABEL: 'FORM_MESSAGE',
  CONNECT_WITH_ME: 'LABEL_CONNECT_WITH_ME',
  
  // Footer
  FOOTER_TEXT: 'FOOTER_COPYRIGHT',
};
