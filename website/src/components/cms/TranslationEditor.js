import React, { useState, useEffect, useRef } from 'react';
import { useEditMode } from '../../context/EditModeContext';
import { portfolioApi } from '../../services/portfolioApi';
import { EditableWrapper } from './EditableWrapper';

/**
 * Map language code to language ID
 * @param {string} languageCode - Language code ('en', 'es')
 * @returns {number} - Language ID
 */
const getLanguageId = (languageCode) => {
  const languageMap = {
    'en': 1,
    'es': 2
  };
  return languageMap[languageCode] || 1;
};

/**
 * TranslationEditor Component
 * Edits UI text translations that are stored in the translations table
 * Handles multi-line text with textarea modal
 * 
 * @param {string} identifier - Translation identifier (e.g., 'hero_tagline', 'chat_with_ai')
 * @param {string} languageCode - Language code ('en', 'es')
 * @param {string} value - Current translation text
 * @param {string} placeholder - Placeholder text
 * @param {string} className - CSS classes for display
 * @param {boolean} multiline - Whether to use textarea (default: false)
 * @param {string} label - Label for the editor modal
 * @param {Function} onSaveSuccess - Callback after successful save
 */
export const TranslationEditor = ({
  identifier,
  languageCode = 'en',
  value,
  placeholder = 'Click to edit...',
  className = '',
  multiline = false,
  label,
  onSaveSuccess
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [translationId, setTranslationId] = useState(null);
  const inputRef = useRef(null);
  
  const { authToken, isEditMode, showNotification } = useEditMode();
  
  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);
  
  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);
  
  /**
   * Fetch translation ID from backend when starting to edit
   */
  const fetchTranslationId = async () => {
    try {
      const translation = await portfolioApi.getTranslationByIdentifier(identifier, languageCode);
      
      if (translation && translation.id) {
        setTranslationId(translation.id);
        return translation.id;
      } else {
        const errorMsg = `Translation not found for identifier: ${identifier} (language: ${languageCode})`;
        setError(errorMsg);
        showNotification(
          'Translation Not Found',
          `The translation "${identifier}" for language "${languageCode}" does not exist in the database. Please create it in the admin panel first.`,
          'error'
        );
        return null;
      }
    } catch (err) {
      console.error('Failed to fetch translation:', err);
      const errorMsg = err.message || 'Failed to fetch translation from database';
      setError(errorMsg);
      showNotification(
        'Translation Fetch Error',
        errorMsg,
        'error'
      );
      return null;
    }
  };
  
  /**
   * Save the edited content to backend
   */
  const handleSave = async () => {
    // Don't save if value hasn't changed
    if (localValue === value) {
      setIsEditing(false);
      return;
    }
    
    // Check if content is empty
    if (!localValue.trim() && value) {
      showNotification(
        'Validation Error',
        'Translation text cannot be empty',
        'error'
      );
      setLocalValue(value); // Reset to original
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Get translation ID if we don't have it yet
      let id = translationId;
      if (!id) {
        id = await fetchTranslationId();
        if (!id) {
          throw new Error('Could not find translation ID');
        }
      }
      
      // Update the translation
      const response = await portfolioApi.updateTranslation(
        id,
        {
          identifier: identifier,
          text: localValue,
          language_id: getLanguageId(languageCode)
        },
        authToken
      );
      
      setIsEditing(false);
      
      // Show success notification
      showNotification(
        'Translation Updated',
        'Your changes have been saved successfully',
        'success'
      );
      
      // Call success callback if provided
      if (onSaveSuccess) {
        onSaveSuccess(response);
      }
      
      // Reload the page to fetch updated translations
      window.location.reload();
    } catch (err) {
      console.error('Failed to save:', err);
      const errorMessage = err.message || 'Failed to save changes';
      setError(errorMessage);
      
      // Show error notification
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
   * Cancel editing and revert to original value
   */
  const handleCancel = () => {
    setLocalValue(value || '');
    setIsEditing(false);
    setError(null);
  };
  
  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };
  
  /**
   * Render content for display
   */
  const renderContent = () => {
    if (!value) {
      return <span className="text-gray-400 italic">{placeholder}</span>;
    }
    
    return <span className={className}>{value}</span>;
  };
  
  // If not in edit mode, just display the content
  if (!isEditMode) {
    return (
      <span className={className}>
        {value || placeholder}
      </span>
    );
  }
  
  // In edit mode: show editable wrapper that opens modal/inline editor on click
  return (
    <>
      <EditableWrapper 
        onEdit={() => setIsEditing(true)}
        label={`Edit ${label || identifier}`}
      >
        {renderContent()}
      </EditableWrapper>
      
      {/* Modal for multiline editing */}
      {isEditing && multiline && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#03060a] border border-white/10 shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-[#14C800]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {label || `Edit ${identifier.replace(/_/g, ' ')}`}
              </h3>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <textarea
                ref={inputRef}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isSaving}
                className={`
                  w-full p-4 
                  border
                  bg-transparent
                  text-white
                  text-base leading-relaxed
                  resize-none
                  focus:outline-none focus:ring-2 focus:ring-[#14C800]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${error ? 'border-red-500' : 'border-white/10'}
                `}
                style={{ 
                  minHeight: '300px',
                  height: '400px'
                }}
              />
              
              {/* Error message */}
              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/40 rounded-none text-red-300 text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
              
              {/* Helper text */}
              <div className="mt-4 text-sm text-white/60 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Press Escape to cancel. Changes will be saved to the translations database.</span>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/10 bg-transparent flex justify-end gap-2">
              <button 
                onClick={handleCancel}
                disabled={isSaving}
                className="btn-flat btn-flat-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
              
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-flat btn-flat-sm btn-flat-active flex items-center gap-1.5"
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
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Inline editor for single-line text */}
      {isEditing && !multiline && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#03060a] border border-white/10 shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-2xl w-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">
                {label || `Edit ${identifier.replace(/_/g, ' ')}`}
              </h3>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <input
                ref={inputRef}
                type="text"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isSaving}
                className={`
                  w-full px-4 py-3
                  border
                  bg-transparent
                  text-white
                  focus:outline-none focus:ring-2 focus:ring-[#14C800]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${error ? 'border-red-500' : 'border-white/10'}
                `}
              />
              
              {/* Error message */}
              {error && (
                <div className="mt-3 p-2 bg-red-500/10 border border-red-500/40 rounded-none text-red-300 text-sm">
                  {error}
                </div>
              )}
              
              {/* Helper text */}
              <div className="mt-3 text-sm text-white/60">
                Press Enter to save, Escape to cancel
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/10 bg-transparent flex justify-end gap-2">
              <button 
                onClick={handleCancel}
                disabled={isSaving}
                className="btn-flat btn-flat-sm"
              >
                Cancel
              </button>
              
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-flat btn-flat-sm btn-flat-active"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TranslationEditor;
