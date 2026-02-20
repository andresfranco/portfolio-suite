import React, { useState, useRef, useEffect } from 'react';

const LanguageSelector = ({
  language,
  setLanguage,
  availableLanguages,
  getLanguageLabel,
  className = '',
  id = 'language-selector'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event, langCode) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (langCode) {
        setLanguage(langCode);
        setIsOpen(false);
      } else {
        setIsOpen(!isOpen);
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (langCode) => {
    setLanguage(langCode);
    setIsOpen(false);
  };

  const currentLanguageLabel = getLanguageLabel(language);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => handleKeyDown(e, null)}
        className="w-full bg-white/5 text-white/80 border border-[#14C800]/50 rounded-none pl-4 pr-10 py-2 text-left focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 hover:bg-white/10 hover:text-white hover:border-[#14C800] transition-colors duration-200"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {currentLanguageLabel}
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/60">
          ▾
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <ul
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#14C800]/50 rounded-none shadow-lg max-h-60 overflow-auto"
        >
          {availableLanguages.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <li
                key={lang.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(lang.code)}
                onKeyDown={(e) => handleKeyDown(e, lang.code)}
                tabIndex={0}
                className={`px-4 py-2 cursor-pointer transition-colors duration-150 ${
                  isSelected
                    ? 'bg-[#333333] text-white'
                    : 'bg-[#1a1a1a] text-white/80 hover:bg-[#2a2a2a] hover:text-white'
                }`}
              >
                {getLanguageLabel(lang.code)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LanguageSelector;
