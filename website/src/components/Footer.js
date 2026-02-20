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
    <footer className="bg-[#03060a] border-t border-white/10 text-white/70 text-center py-10 px-6">
      {isEditMode ? (
        <p>{footerLabel.renderEditable('text-white/80')}</p>
      ) : (
        <p>{footerText}</p>
      )}
    </footer>
  );
};

export default Footer;
