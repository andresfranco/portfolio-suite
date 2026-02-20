import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { portfolioApi } from '../services/portfolioApi';
import { LanguageContext } from './LanguageContext';

/**
 * Portfolio Context
 * Manages portfolio data and syncs with backend API
 */
export const PortfolioContext = createContext();

/**
 * Portfolio Provider Component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {number} props.portfolioId - Optional: specific portfolio ID to load (defaults to default portfolio)
 */
export const PortfolioProvider = ({ children, portfolioId = null }) => {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { language } = useContext(LanguageContext);

  /**
   * Load portfolio data from API
   */
  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      let data;
      
      // Load specific portfolio or default portfolio
      if (portfolioId) {
        data = await portfolioApi.getPortfolio(portfolioId, language);
      } else {
        data = await portfolioApi.getDefaultPortfolio(language);
      }
      
      setPortfolio(data);
    } catch (err) {
      console.error('Failed to load portfolio:', err);
      setError(err.message || 'Failed to load portfolio');
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, language]);

  /**
   * Refresh portfolio data (useful after CMS updates)
   */
  const refreshPortfolio = async () => {
    await loadPortfolio();
  };

  // Load portfolio on mount and when language changes
  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const value = {
    portfolio,
    loading,
    error,
    refreshPortfolio,
    
    // Helper getters for common data access patterns
    getProjects: () => portfolio?.projects || [],
    getExperiences: () => portfolio?.experiences || [],
    getSections: () => portfolio?.sections || [],
    getCategories: () => portfolio?.categories || [],
    
    // Get text data in current language
    getProjectText: (project) => {
      if (!project?.project_texts || project.project_texts.length === 0) {
        return { name: '', description: '' };
      }
      // Return the first text (should be filtered by language from API)
      return project.project_texts[0] || { name: '', description: '' };
    },
    
    getExperienceText: (experience) => {
      if (!experience?.experience_texts || experience.experience_texts.length === 0) {
        return { name: '', description: '' };
      }
      // Return the first text (should be filtered by language from API)
      return experience.experience_texts[0] || { name: '', description: '' };
    },
    
    getSectionText: (section) => {
      if (!section?.section_texts || section.section_texts.length === 0) {
        return { text: '' };
      }
      // Return the first text (should be filtered by language from API)
      return section.section_texts[0] || { text: '' };
    },
    
    getCategoryText: (category) => {
      if (!category?.category_texts || category.category_texts.length === 0) {
        return { name: '', description: '' };
      }
      // Return the first text (should be filtered by language from API)
      return category.category_texts[0] || { name: '', description: '' };
    },
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};

/**
 * Custom hook to use Portfolio Context
 * @returns {Object} Portfolio context value
 */
export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  
  return context;
};

export default PortfolioContext;
