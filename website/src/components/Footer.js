import React, { useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';
import { useEditMode } from '../context/EditModeContext';
import { useSectionLabel } from '../hooks/useSectionLabel';
import { translations } from '../data/translations';

const Footer = () => {
  const { language } = useContext(LanguageContext);
  const { isEditMode } = useEditMode();
  const currentYear = new Date().getFullYear();
  
  // Get editable footer text label
  const footerLabel = useSectionLabel('FOOTER_COPYRIGHT', 'footer_text');
  
  // Replace {year} placeholder with currentYear in the footer text
  const footerText = footerLabel.value.replace('{year}', currentYear);

  return (
    <footer className="bg-gray-800 text-white text-center py-8">
      {isEditMode ? (
        // In edit mode, show the editable version with {year} placeholder
        <p>{footerLabel.renderEditable('text-white')}</p>
      ) : (
        // In normal mode, show the text with year replaced
        <p>{footerText}</p>
      )}
    </footer>
  );
};

export default Footer;
