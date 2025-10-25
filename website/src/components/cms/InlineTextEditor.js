import React, { useState, useRef, useEffect } from 'react';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { portfolioApi } from '../../services/portfolioApi';
import { EditableTextWrapper } from './EditableWrapper';

/**
 * InlineTextEditor - Edit text content directly in place
 * Supports single-line and multi-line text editing with auto-save on blur
 * 
 * @param {string} value - Current text value
 * @param {string} entityType - Type of entity ('project', 'experience', 'section')
 * @param {number} entityId - ID of the entity
 * @param {string} fieldName - Name of the field being edited
 * @param {boolean} multiline - Whether to use textarea or input
 * @param {string} placeholder - Placeholder text
 * @param {string} className - CSS classes for the display element
 * @param {Function} onSaveSuccess - Callback after successful save
 */
export const InlineTextEditor = ({ 
  value, 
  entityType,
  entityId,
  fieldName, 
  multiline = false,
  placeholder = 'Click to edit...',
  className = '',
  onSaveSuccess
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  
  const { authToken, isEditMode, showNotification } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  
  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);
  
  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (!multiline) {
        inputRef.current.select();
      }
    }
  }, [isEditing, multiline]);
  
  /**
   * Save the edited content to backend
   */
  const handleSave = async () => {
    // Don't save if value hasn't changed
    if (localValue === value) {
      setIsEditing(false);
      return;
    }
    
    // Don't save if empty and required
    if (!localValue.trim() && value) {
      showNotification(
        'Validation Error',
        'Content cannot be empty',
        'error'
      );
      setLocalValue(value); // Reset to original
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      let response;
      
      // Call appropriate API based on entity type
      switch (entityType) {
        case 'project':
          response = await portfolioApi.updateProjectText(
            entityId,
            { [fieldName]: localValue },
            authToken
          );
          break;
        case 'experience':
          response = await portfolioApi.updateExperienceText(
            entityId,
            { [fieldName]: localValue },
            authToken
          );
          break;
        case 'section':
          response = await portfolioApi.updateSectionText(
            entityId,
            { [fieldName]: localValue },
            authToken
          );
          break;
        default:
          throw new Error(`Unknown entity type: ${entityType}`);
      }
      
      // Refresh portfolio data
      await refreshPortfolio();
      setIsEditing(false);
      
      // Show success notification
      showNotification(
        'Content Saved',
        'Your changes have been saved successfully',
        'success'
      );
      
      // Call success callback if provided
      if (onSaveSuccess) {
        onSaveSuccess(response);
      }
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
      
      // Keep editing mode open on error so user can retry
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Cancel editing and revert to original value
   */
  const handleCancel = () => {
    setLocalValue(value || ''); // Reset to original value
    setIsEditing(false);
    setError(null);
  };
  
  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e) => {
    // Save on Ctrl+Enter (or Cmd+Enter on Mac) for multiline
    if (multiline && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    // Save on Enter for single-line
    else if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    // Cancel on Escape
    else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };
  
  // If not in edit mode, just display the value
  if (!isEditMode) {
    return (
      <span className={className}>
        {value || <span className="text-gray-400 italic">{placeholder}</span>}
      </span>
    );
  }
  
  // If in edit mode but not editing this field
  if (!isEditing) {
    return (
      <EditableTextWrapper 
        onEdit={() => setIsEditing(true)}
        className={className}
      >
        {value || <span className="text-gray-400 italic">{placeholder}</span>}
      </EditableTextWrapper>
    );
  }
  
  // Editing mode - Show modal for better visibility
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </h3>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {multiline ? (
            <textarea
              ref={inputRef}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              className={`
                w-full p-3 
                border-2 
                rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                resize-y
                text-gray-900 font-sans
                bg-white
                ${isSaving ? 'opacity-50 cursor-wait' : ''}
                ${error ? 'border-red-500' : 'border-gray-300 focus:border-blue-500'}
              `}
              rows={12}
              placeholder={placeholder}
              style={{ minHeight: '300px', fontSize: '15px', lineHeight: '1.6' }}
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              className={`
                w-full p-3 
                border-2 
                rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                text-gray-900 font-sans
                bg-white
                ${isSaving ? 'opacity-50 cursor-wait' : ''}
                ${error ? 'border-red-500' : 'border-gray-300 focus:border-blue-500'}
              `}
              placeholder={placeholder}
              style={{ fontSize: '15px' }}
            />
          )}
          
          {/* Error message */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          
          {/* Helper text */}
          <div className="mt-3 text-xs text-gray-600 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>
              {multiline ? (
                'Press Ctrl+Enter to save, Escape to cancel'
              ) : (
                'Press Enter to save, Escape to cancel'
              )}
            </span>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={handleCancel}
            disabled={isSaving}
            className="
              px-5 py-2.5
              bg-gray-200 hover:bg-gray-300 
              text-gray-800 font-medium
              rounded-lg
              transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`
              px-5 py-2.5
              bg-green-600 hover:bg-green-700 
              text-white font-medium
              rounded-lg
              transition-colors
              disabled:bg-gray-400 disabled:cursor-not-allowed
              flex items-center gap-2
              shadow-sm
            `}
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
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InlineTextEditor;
