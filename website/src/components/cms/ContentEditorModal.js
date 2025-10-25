import React, { useState, useEffect, useContext } from 'react';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { LanguageContext } from '../../context/LanguageContext';
import { portfolioApi } from '../../services/portfolioApi';
import { RichTextEditor } from './RichTextEditor';
import { InlineTextEditor } from './InlineTextEditor';

/**
 * ContentEditorModal Component
 * Full-featured modal for editing projects or experiences
 * Handles all fields including metadata, text content, and validation
 * 
 * @param {string} type - Content type ('project' or 'experience')
 * @param {Object} item - Item data to edit
 * @param {boolean} isOpen - Modal open state
 * @param {Function} onClose - Close callback
 * @param {Function} onSave - Save callback (optional, auto-saves to backend)
 */
export const ContentEditorModal = ({ 
  type, 
  item, 
  isOpen,
  onClose, 
  onSave 
}) => {
  const [formData, setFormData] = useState({});
  const [textData, setTextData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  const { authToken, showNotification } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  const { language: currentLanguage } = useContext(LanguageContext);
  
  // Initialize form data when item changes
  useEffect(() => {
    if (item && isOpen) {
      setFormData({
        id: item.id,
        repository_url: item.repository_url || '',
        website_url: item.website_url || '',
        company: item.company || '',
        start_date: item.start_date || '',
        end_date: item.end_date || '',
      });
      
      // Find text data for current language
      const textFieldName = type === 'project' ? 'project_texts' : 'experience_texts';
      const texts = item[textFieldName]?.find(
        t => t.language?.code === currentLanguage
      ) || {};
      
      setTextData({
        id: texts.id,
        name: texts.name || '',
        description: texts.description || '',
        short_description: texts.short_description || '',
      });
      
      setHasChanges(false);
      setError(null);
    }
  }, [item, isOpen, type, currentLanguage]);
  
  /**
   * Handle form field changes
   */
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };
  
  /**
   * Handle text field changes
   */
  const handleTextChange = (field, value) => {
    setTextData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };
  
  /**
   * Validate form data
   */
  const validateForm = () => {
    if (!textData.name || !textData.name.trim()) {
      return 'Name is required';
    }
    
    if (type === 'project') {
      // Validate URLs if provided
      if (formData.repository_url && !isValidUrl(formData.repository_url)) {
        return 'Invalid repository URL';
      }
      if (formData.website_url && !isValidUrl(formData.website_url)) {
        return 'Invalid website URL';
      }
    }
    
    if (type === 'experience') {
      if (!formData.company || !formData.company.trim()) {
        return 'Company is required';
      }
      if (!formData.start_date) {
        return 'Start date is required';
      }
    }
    
    return null;
  };
  
  /**
   * Check if URL is valid
   */
  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };
  
  /**
   * Save all changes
   */
  const handleSave = async () => {
    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      showNotification('Validation Error', validationError, 'error');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Update text content
      if (textData.id) {
        const updateMethod = type === 'project' 
          ? portfolioApi.updateProjectText 
          : portfolioApi.updateExperienceText;
        
        await updateMethod(
          textData.id,
          {
            name: textData.name,
            description: textData.description,
            short_description: textData.short_description,
          },
          authToken
        );
      }
      
      // Update metadata (project only)
      if (type === 'project' && formData.id) {
        await portfolioApi.updateProjectMetadata(
          formData.id,
          {
            repository_url: formData.repository_url,
            website_url: formData.website_url,
          },
          authToken
        );
      }
      
      // Refresh portfolio data - catch and log errors but don't fail the save
      try {
        await refreshPortfolio();
      } catch (refreshError) {
        console.warn('Changes saved but refresh failed:', refreshError);
        // Don't throw - the save was successful
      }
      
      // Show success notification
      showNotification(
        'Changes Saved',
        `${type === 'project' ? 'Project' : 'Experience'} updated successfully`,
        'success'
      );
      
      // Call save callback if provided
      if (onSave) {
        onSave();
      }
      
      // Close modal
      setHasChanges(false);
      onClose();
      
    } catch (err) {
      console.error('Failed to save:', err);
      const errorMessage = err.message || 'Failed to save changes';
      setError(errorMessage);
      
      showNotification(
        'Save Failed',
        errorMessage,
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Handle close with unsaved changes warning
   */
  const handleClose = () => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmed) return;
    }
    
    setHasChanges(false);
    setError(null);
    onClose();
  };
  
  // Don't render if not open
  if (!isOpen || !item) {
    return null;
  }
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[55] p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit {type === 'project' ? 'Project' : 'Experience'}
          </h2>
          
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* Language indicator */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              <span className="text-sm font-medium text-blue-900">
                Editing {currentLanguage.toUpperCase()} content
              </span>
            </div>
            
            {/* Name */}
            <div>
              <label className="block mb-2 font-semibold text-gray-900 text-sm uppercase tracking-wide">
                Name *
              </label>
              <input
                type="text"
                value={textData.name || ''}
                onChange={(e) => handleTextChange('name', e.target.value)}
                disabled={isSaving}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-gray-900 font-sans"
                placeholder="Enter name..."
                style={{ fontSize: '15px' }}
              />
            </div>
            
            {/* Short Description */}
            <div>
              <label className="block mb-2 font-semibold text-gray-900 text-sm uppercase tracking-wide">
                Short Description
              </label>
              <textarea
                value={textData.short_description || ''}
                onChange={(e) => handleTextChange('short_description', e.target.value)}
                disabled={isSaving}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y disabled:bg-gray-100 text-gray-900 font-sans"
                placeholder="Brief summary..."
                style={{ fontSize: '15px', lineHeight: '1.6' }}
              />
            </div>
            
            {/* Description */}
            <div>
              <label className="block mb-2 font-semibold text-gray-900 text-sm uppercase tracking-wide">
                Description
              </label>
              <textarea
                value={textData.description || ''}
                onChange={(e) => handleTextChange('description', e.target.value)}
                disabled={isSaving}
                rows={10}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y disabled:bg-gray-100 text-gray-900 font-sans"
                placeholder="Detailed description..."
                style={{ fontSize: '15px', lineHeight: '1.6', minHeight: '200px' }}
              />
            </div>
            
            {/* Project-specific fields */}
            {type === 'project' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 font-semibold text-gray-900 text-sm uppercase tracking-wide">
                      Repository URL
                    </label>
                    <input
                      type="url"
                      value={formData.repository_url || ''}
                      onChange={(e) => handleFieldChange('repository_url', e.target.value)}
                      disabled={isSaving}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-gray-900 font-sans"
                      placeholder="https://github.com/..."
                      style={{ fontSize: '15px' }}
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-2 font-semibold text-gray-900 text-sm uppercase tracking-wide">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={formData.website_url || ''}
                      onChange={(e) => handleFieldChange('website_url', e.target.value)}
                      disabled={isSaving}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-gray-900 font-sans"
                      placeholder="https://example.com"
                      style={{ fontSize: '15px' }}
                    />
                  </div>
                </div>
              </>
            )}
            
            {/* Experience-specific fields */}
            {type === 'experience' && (
              <>
                <div>
                  <label className="block mb-2 font-semibold text-gray-900 text-sm uppercase tracking-wide">
                    Company *
                  </label>
                  <input
                    type="text"
                    value={formData.company || ''}
                    onChange={(e) => handleFieldChange('company', e.target.value)}
                    disabled={isSaving}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-gray-900 font-sans"
                    placeholder="Company name..."
                    style={{ fontSize: '15px' }}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 font-semibold text-gray-900 text-sm uppercase tracking-wide">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={formData.start_date || ''}
                      onChange={(e) => handleFieldChange('start_date', e.target.value)}
                      disabled={isSaving}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-gray-900 font-sans"
                      style={{ fontSize: '15px' }}
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-2 font-semibold text-gray-900 text-sm uppercase tracking-wide">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.end_date || ''}
                      onChange={(e) => handleFieldChange('end_date', e.target.value)}
                      disabled={isSaving}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-gray-900 font-sans"
                      style={{ fontSize: '15px' }}
                    />
                    <p className="mt-1 text-xs text-gray-600">Leave empty for current position</p>
                  </div>
                </div>
              </>
            )}
            
            {/* Error message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="text-sm text-gray-600">
            {hasChanges && (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                Unsaved changes
              </span>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="
                px-6 py-2.5
                bg-gray-200 hover:bg-gray-300 
                text-gray-800 font-medium
                rounded-lg
                text-sm
                transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Cancel
            </button>
            
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="
                px-6 py-2.5
                bg-blue-600 hover:bg-blue-700 
                text-white font-medium
                rounded-lg
                text-sm
                transition-colors
                disabled:bg-gray-400 disabled:cursor-not-allowed
                flex items-center gap-2
                shadow-sm
              "
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentEditorModal;
