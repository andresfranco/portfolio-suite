import React, { createContext, useState, useEffect } from 'react';
import portfolioApi from '../services/portfolioApi';

const DEFAULT_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
];

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');
  const [languages, setLanguages] = useState(DEFAULT_LANGUAGES);

  useEffect(() => {
    let isMounted = true;

    const fetchLanguages = async () => {
      try {
        const response = await portfolioApi.getLanguages();
        const items = response?.items || response?.data?.items || [];

        if (isMounted && Array.isArray(items) && items.length > 0) {
          const filtered = items.filter((item) => item.enabled !== false);
          const source = filtered.length > 0 ? filtered : items;

          const normalized = source
            .map((item) => ({
              code: item.code || item.language_code || item.id || 'en',
              name: item.name || item.display_name || item.code || 'English',
            }))
            .filter((item) => item.code);

          if (normalized.length > 0) {
            setLanguages(normalized);
            setLanguage((prev) => {
              if (normalized.some((item) => item.code === prev)) {
                return prev;
              }
              return normalized[0].code;
            });
            return;
          }
        }

        // Fallback to defaults when API returns empty or only disabled entries
        if (isMounted) {
          setLanguages(DEFAULT_LANGUAGES);
          setLanguage((prev) =>
            DEFAULT_LANGUAGES.some((item) => item.code === prev) ? prev : DEFAULT_LANGUAGES[0].code
          );
        }
      } catch (error) {
        console.error('Failed to load languages:', error);
        if (isMounted) {
          setLanguages(DEFAULT_LANGUAGES);
          setLanguage((prev) =>
            DEFAULT_LANGUAGES.some((item) => item.code === prev) ? prev : DEFAULT_LANGUAGES[0].code
          );
        }
      }
    };

    fetchLanguages();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, languages }}>
      {children}
    </LanguageContext.Provider>
  );
};
