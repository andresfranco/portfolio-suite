import React, { useState, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';
import { translations } from '../data/translations';
import { useEditMode } from '../context/EditModeContext';
import { useSectionLabel, SECTION_CODES } from '../hooks/useSectionLabel';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, languages } = useContext(LanguageContext);
  const { isEditMode } = useEditMode();
  
  // Get editable section labels
  const homeLabel = useSectionLabel(SECTION_CODES.HOME, 'home');
  const projectsLabel = useSectionLabel(SECTION_CODES.PROJECTS, 'projects');
  const contactLabel = useSectionLabel(SECTION_CODES.CONTACT, 'contact');
  const brandName = useSectionLabel(SECTION_CODES.BRAND_NAME, 'brand_name');
  
  const menuItems = [
    { label: homeLabel, path: '/' },
    { label: projectsLabel, path: '/projects' },
    { label: contactLabel, path: '/contact' }
  ];

  const languageSwitcherLabel = translations[language]?.language_switcher || 'Language';

  const DEFAULT_LANGS = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
  ];

  const availableLanguages = (languages && languages.length > 0) ? languages : DEFAULT_LANGS;

  const getLanguageLabel = (code) => {
    const found = availableLanguages.find((lang) => lang.code === code);
    if (found) {
      return found.name || found.label || code.toUpperCase();
    }
    return (translations[language]?.language_names && translations[language].language_names[code]) || code.toUpperCase();
  };

  const handleNavigation = (path) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="fixed w-full z-[60] bg-black/70 backdrop-blur-sm">
      <nav className="container mx-auto px-6 py-4 relative">
        <div className="flex items-center justify-between">
          <Link 
            to="/" 
            className="group"
            onClick={(e) => {
              // In edit mode, prevent navigation unless Ctrl/Cmd+Click
              if (isEditMode && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            title={isEditMode ? "Click to edit • Ctrl/Cmd+Click to go home" : "Go to homepage"}
          >
            {isEditMode
              ? brandName.renderEditable('text-white text-2xl font-bold transition-colors duration-200 group-hover:text-[#14C800]')
              : (
                <span className="text-white text-2xl font-bold transition-colors duration-200 group-hover:text-[#14C800]">
                  {brandName.value}
                </span>
              )}
          </Link>
          
          {/* Desktop Menu */}
          <ul className="hidden md:flex space-x-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={(e) => {
                    // In edit mode, only navigate on Ctrl/Cmd+Click
                    if (isEditMode && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    handleNavigation(item.path);
                  }}
                  title={isEditMode ? `Click to edit • Ctrl/Cmd+Click to navigate to ${item.label.value}` : `Navigate to ${item.label.value}`}
                  className={`btn-flat ${location.pathname === item.path ? 'btn-flat-active' : ''}`}
                >
                  {item.label.renderEditable('text-white/90')}
                </button>
              </li>
            ))}
          </ul>

          {/* Language Selector (Right Corner) */}
          <div className="hidden md:flex items-center">
            <label htmlFor="desktop-language-select" className="sr-only">
              {languageSwitcherLabel}
            </label>
            <div className="relative">
              <select
                id="desktop-language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="select-flat"
              >
                {availableLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {getLanguageLabel(lang.code)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/60">
                ▾
              </span>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-white p-2"
            aria-label="Toggle menu"
          >
            <div className="w-6 h-5 relative flex flex-col justify-between">
              <span className={`w-full h-0.5 bg-white transform transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`w-full h-0.5 bg-white transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`w-full h-0.5 bg-white transform transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </div>
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <div 
          className={`md:hidden fixed inset-0 bg-gray-900 z-[50] transition-all duration-300 
            ${isMenuOpen 
              ? 'opacity-100 translate-x-0' 
              : 'opacity-0 translate-x-full pointer-events-none'
            }`}
          style={{ backgroundColor: '#111827' }}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsMenuOpen(false)}
          className="absolute top-6 right-6 btn-flat btn-flat-sm hover:text-white"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
            <ul className="space-y-8">
              {menuItems.map((item) => (
                <li key={item.path} className="text-center">
                  <button
                    onClick={(e) => {
                      // In edit mode, only navigate on Ctrl/Cmd+Click
                      if (isEditMode && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      handleNavigation(item.path);
                    }}
                    title={isEditMode ? `Click to edit • Ctrl/Cmd+Click to navigate to ${item.label.value}` : `Navigate to ${item.label.value}`}
                  className={`btn-flat px-10 py-3 text-2xl inline-block ${location.pathname === item.path ? 'btn-flat-active' : ''}`}
                  >
                    {item.label.renderEditable('text-white')}
                  </button>
                </li>
              ))}
            </ul>
            {/* Mobile Language Selector */}
            <div className="mt-8 w-48">
              <label htmlFor="mobile-language-select" className="sr-only">
                {languageSwitcherLabel}
              </label>
              <div className="relative">
                <select
                  id="mobile-language-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="select-flat w-full text-lg"
                >
                  {availableLanguages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {getLanguageLabel(lang.code)}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/60">
                  ▾
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
