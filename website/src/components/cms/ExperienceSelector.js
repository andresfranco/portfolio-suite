import React, { useState, useEffect, useContext } from 'react';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { LanguageContext } from '../../context/LanguageContext';
import { portfolioApi } from '../../services/portfolioApi';

/**
 * ExperienceSelector Component
 * Modal for selecting existing experiences to add to the portfolio
 * 
 * @param {boolean} isOpen - Modal open state
 * @param {Function} onClose - Close callback
 * @param {Function} onSelect - Select experience callback
 */
export const ExperienceSelector = ({ isOpen, onClose, onSelect }) => {
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { authToken, showNotification } = useEditMode();
  const { portfolio, getExperiences: getPortfolioExperiences } = usePortfolio();
  const { language } = useContext(LanguageContext);
  
  // Get experiences already in the portfolio
  const portfolioExperiences = getPortfolioExperiences();
  const portfolioExperienceIds = new Set(portfolioExperiences.map(exp => exp.id));
  
  /**
   * Load all experiences from the API
   */
  useEffect(() => {
    if (isOpen) {
      loadExperiences();
    }
  }, [isOpen]);
  
  const loadExperiences = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await portfolioApi.getAllExperiences(1, 100, authToken);
      setExperiences(response.items || []);
    } catch (err) {
      console.error('Failed to load experiences:', err);
      setError(err.message || 'Failed to load experiences');
      showNotification('Error', 'Failed to load experiences', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Get experience text for current language
   */
  const getExperienceText = (experience) => {
    if (!experience.experience_texts || experience.experience_texts.length === 0) {
      return { name: 'Unnamed', description: '' };
    }
    
    // Find text for current language
    const text = experience.experience_texts.find(
      t => t.language?.code === language
    );
    
    // Fallback to first available language
    return text || experience.experience_texts[0];
  };
  
  /**
   * Get icon component
   */
  const getIconComponent = (iconName) => {
    switch (iconName) {
      case 'code':
        return require('react-icons/fa6').FaCode;
      case 'database':
        return require('react-icons/fa6').FaDatabase;
      case 'cloud':
        return require('react-icons/fa6').FaCloud;
      default:
        return require('react-icons/fa6').FaCode;
    }
  };
  
  /**
   * Filter experiences based on search query
   */
  const filteredExperiences = experiences.filter(exp => {
    if (!searchQuery) return true;
    
    const text = getExperienceText(exp);
    const searchLower = searchQuery.toLowerCase();
    
    return (
      text.name?.toLowerCase().includes(searchLower) ||
      text.description?.toLowerCase().includes(searchLower) ||
      exp.code?.toLowerCase().includes(searchLower)
    );
  });
  
  /**
   * Available experiences (not already in portfolio)
   */
  const availableExperiences = filteredExperiences.filter(
    exp => !portfolioExperienceIds.has(exp.id)
  );
  
  /**
   * Handle selecting an experience
   */
  const handleSelect = (experience) => {
    if (onSelect) {
      onSelect(experience);
    }
    onClose();
  };
  
  if (!isOpen) {
    return null;
  }
  
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[55] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#03060a] border border-white/10 rounded-none shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <svg className="w-7 h-7 text-[#14C800]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Add Existing Experience
            </h2>

            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search experiences..."
              className="w-full px-4 py-2 pl-10 bg-white/5 border border-[#14C800]/50 rounded-none focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 text-white placeholder-white/50"
            />
            <svg
              className="w-5 h-5 text-white/60 absolute left-3 top-1/2 transform -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#03060a]">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-10 w-10 text-[#14C800]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-white/80">Loading experiences...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center text-red-400 py-8">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium">{error}</p>
            </div>
          ) : availableExperiences.length === 0 ? (
            <div className="text-center text-white/60 py-8">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="font-medium mb-2 text-white">
                {searchQuery ? 'No experiences found matching your search' : 'No experiences available to add'}
              </p>
              <p className="text-sm">
                {searchQuery ? 'Try a different search term' : 'All experiences are already in this portfolio'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableExperiences.map((exp) => {
                const Icon = getIconComponent(exp.icon);
                const text = getExperienceText(exp);

                return (
                  <button
                    key={exp.id}
                    onClick={() => handleSelect(exp)}
                    className="flex items-start gap-4 p-4 bg-white/5 border border-[#14C800]/50 rounded-none hover:border-[#14C800] hover:bg-white/10 transition-all duration-200 text-left group"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-12 h-12 rounded-none bg-white/5 flex items-center justify-center text-[#14C800] group-hover:bg-[#14C800] group-hover:text-black transition-colors border border-[#14C800]/30 group-hover:border-[#14C800]">
                        <Icon className="text-2xl" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white mb-1 truncate">
                        {text.name}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-[#14C800]">
                          {exp.years || exp.years_experience || 0}+ years
                        </span>
                        <span className="text-xs text-white/40">•</span>
                        <span className="text-xs text-white/60 font-mono">
                          {exp.code}
                        </span>
                      </div>
                      {text.description && (
                        <p className="text-sm text-white/70 line-clamp-2">
                          {text.description}
                        </p>
                      )}
                    </div>

                    <div className="flex-shrink-0 text-white/40 group-hover:text-[#14C800] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#03060a]">
          <div className="flex justify-between items-center text-sm text-white/70">
            <span>
              {availableExperiences.length} experience{availableExperiences.length !== 1 ? 's' : ''} available
            </span>
            <button
              onClick={onClose}
              className="btn-flat btn-flat-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExperienceSelector;
