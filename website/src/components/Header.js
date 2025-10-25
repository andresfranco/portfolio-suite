import React, { useState, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';
import { translations } from '../data/translations';
import { useEditMode } from '../context/EditModeContext';
import { useSectionLabel, SECTION_CODES } from '../hooks/useSectionLabel';
import usFlag from '../assets/images/us.svg';
import esFlag from '../assets/images/es.svg';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage } = useContext(LanguageContext);
  const { isEditMode } = useEditMode();
  
  // Get editable section labels
  const homeLabel = useSectionLabel(SECTION_CODES.HOME, 'home');
  const projectsLabel = useSectionLabel(SECTION_CODES.PROJECTS, 'projects');
  const contactLabel = useSectionLabel(SECTION_CODES.CONTACT, 'contact');
  
  const menuItems = [
    { label: homeLabel, path: '/' },
    { label: projectsLabel, path: '/projects' },
    { label: contactLabel, path: '/contact' }
  ];

  const availableLanguages = [
    { code: 'en', label: 'English', flag: usFlag },
    { code: 'es', label: 'Español', flag: esFlag }
  ];

  const handleNavigation = (path) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="fixed w-full z-[60] bg-black/70 backdrop-blur-sm">
      <nav className="container mx-auto px-6 py-4 relative">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-white text-2xl font-bold">AMFAPPS</Link>
          
          {/* Desktop Menu */}
          <ul className="hidden md:flex space-x-4">
            {menuItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => handleNavigation(item.path)}
                  className={`text-white/90 px-4 py-2 rounded-lg text-lg
                    transition-all duration-300 hover:bg-[#14C800] hover:text-white
                    hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)]
                    transform hover:-translate-y-1
                    ${location.pathname === item.path ? 'bg-[#14C800] text-white' : ''}`}
                >
                  {item.label.renderEditable('text-white/90')}
                </button>
              </li>
            ))}
          </ul>

          {/* Language Selector (Right Corner) */}
          <div className="hidden md:flex space-x-2">
            {availableLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className="focus:outline-none"
              >
                <img
                  src={lang.flag}
                  alt={lang.label}
                  className={`w-6 h-6 rounded-full ${language === lang.code ? 'ring-2 ring-[#14C800]' : ''}`}
                />
              </button>
            ))}
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
            className="absolute top-6 right-6 text-white/90 hover:text-white p-2
              transition-all duration-300 hover:bg-[#14C800] rounded-lg
              hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)]"
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
                    onClick={() => handleNavigation(item.path)}
                    className={`text-white px-8 py-3 rounded-lg text-2xl
                      transition-all duration-300 hover:bg-[#14C800] hover:text-white
                      hover:shadow-[0_4px_20px_rgba(20,200,0,0.4)]
                      transform hover:-translate-y-1 inline-block
                      ${location.pathname === item.path ? 'bg-[#14C800] text-white' : ''}`}
                  >
                    {item.label.renderEditable('text-white')}
                  </button>
                </li>
              ))}
            </ul>
            {/* Mobile Language Selector */}
            <div className="mt-8 flex space-x-2">
              {availableLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className="focus:outline-none"
                >
                  <img
                    src={lang.flag}
                    alt={lang.label}
                    className={`w-6 h-6 rounded-full ${language === lang.code ? 'ring-2 ring-[#14C800]' : ''}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
