import React, { useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';
import { translations } from '../data/translations';

const Footer = () => {
  const { language } = useContext(LanguageContext);
  const currentYear = new Date().getFullYear();
  // Replace {year} placeholder with currentYear in the translated footer text.
  const footerText = translations[language].footer_text.replace('{year}', currentYear);

  return (
    <footer className="bg-gray-800 text-white text-center py-8">
      <p>{footerText}</p>
    </footer>
  );
};

export default Footer;
