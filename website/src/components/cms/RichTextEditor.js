import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { portfolioApi } from '../../services/portfolioApi';
import { EditableTextWrapper } from './EditableWrapper';

/**
 * RichTextEditor Component
 * Large textarea editor for longer content - React 19 compatible
 * Note: Removed ReactQuill due to React 19 incompatibility (findDOMNode removed)
 * 
 * @param {string} value - Current text content
 * @param {string} entityType - Type of entity ('project', 'experience', 'section')
 * @param {number} entityId - ID of the entity
 * @param {string} fieldName - Name of the field being edited
 * @param {string} placeholder - Placeholder text
 * @param {string} className - CSS classes for display
 * @param {number} minHeight - Minimum editor height in pixels
 * @param {string} label - Label for the editor modal
 * @param {Function} onSaveSuccess - Callback after successful save
 */
export const RichTextEditor = ({
  value,
  entityType,
  entityId,
  fieldName,
  placeholder = 'Click to edit...',
  className = '',
  minHeight = 200,
  label,
  onSaveSuccess
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);
  
  const { authToken, isEditMode, showNotification, activeEditor, setActiveEditor } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  
  // Generate unique editor ID
  const editorId = useRef(`${entityType}-${entityId}-${fieldName}`).current;
  
  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);
  
  // Focus editor when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);
  
  /**
   * Save the edited content to backend
   */
  const handleSave = async () => {
    // Don't save if value hasn't changed
    if (localValue === value) {
      setIsEditing(false);
      setActiveEditor(null); // Clear active editor lock
      return;
    }
    
    // Check if content is effectively empty
    if (!localValue.trim() && value) {
      showNotification(
        'Validation Error',
        'Content cannot be empty',
        'error'
      );
      setLocalValue(value); // Reset to original
      setIsEditing(false);
      setActiveEditor(null); // Clear active editor lock
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
      
      // Refresh portfolio data - catch and log errors but don't fail the save
      try {
        await refreshPortfolio();
      } catch (refreshError) {
        console.warn('Content saved but refresh failed:', refreshError);
        // Don't throw - the save was successful
      }
      
      setIsEditing(false);
      setActiveEditor(null); // Clear active editor lock
      
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
    setActiveEditor(null); // Clear active editor lock
    setError(null);
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
      <div className={className}>
        {renderContent()}
      </div>
    );
  }
  
  // In edit mode: show editable wrapper that opens modal on click
  const isDisabled = activeEditor && activeEditor !== editorId;
  
  return (
    <>
      <EditableTextWrapper 
        onEdit={() => {
          // Check if another editor is already active
          if (activeEditor && activeEditor !== editorId) {
            showNotification(
              'Editor Active',
              'Please save or cancel the current editor before opening another one.',
              'warning'
            );
            return;
          }
          setIsEditing(true);
          setActiveEditor(editorId); // Lock this editor as active
        }}
        label="Edit text"
        className={className}
        disabled={isDisabled}
      >
        {renderContent()}
      </EditableTextWrapper>
      
      {/* Modal - Large textarea editor (React 19 compatible) - Rendered via Portal */}
      {isEditing && createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[55] p-4"
      onClick={handleCancel}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {label || `Edit ${fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
          </h3>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={placeholder}
            disabled={isSaving}
            className={`
              w-full p-4 
              border-2 rounded-lg 
              font-sans text-gray-900
              text-base leading-relaxed
              resize-none
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error ? 'border-red-500' : 'border-gray-300'}
            `}
            style={{ 
              minHeight: `${minHeight}px`,
              height: '400px'
            }}
          />
          
          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          
          {/* Helper text */}
          <div className="mt-4 text-sm text-gray-600 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>Enter your content in the text area above. All text is clearly visible for editing.</span>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button 
            onClick={handleCancel}
            disabled={isSaving}
            className="
              px-4 py-2
              bg-gray-200 hover:bg-gray-300 
              text-gray-800 text-sm font-medium
              rounded-md
              transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-1.5
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`
              px-4 py-2
              bg-green-600 hover:bg-green-700 
              text-white text-sm font-medium
              rounded-md
              transition-colors
              disabled:bg-gray-400 disabled:cursor-not-allowed
              flex items-center gap-1.5
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
    </div>, document.body
      )}
    </>
  );
};

export default RichTextEditor;
