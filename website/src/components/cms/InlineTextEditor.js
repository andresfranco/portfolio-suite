import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  
  const { authToken, isEditMode, showNotification, activeEditor, setActiveEditor } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  
  // Generate unique editor ID
  const editorId = useRef(`${entityType}-${entityId}-${fieldName}`).current;
  
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
      setActiveEditor(null); // Clear active editor lock
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
      setActiveEditor(null); // Clear active editor lock
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    let saveSucceeded = false;
    
    try {
      let response;
      
      // Call appropriate API based on entity type
      switch (entityType) {
        case 'portfolio':
          response = await portfolioApi.updatePortfolio(
            entityId,
            { [fieldName]: localValue },
            authToken
          );
          break;
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
      
      // If we got here, the save succeeded
      saveSucceeded = true;
      console.log('Save succeeded, response:', response);
      
      // Refresh portfolio data - catch and log errors but don't fail the save
      try {
        await refreshPortfolio();
      } catch (refreshError) {
        console.warn('Portfolio saved but refresh failed:', refreshError);
        // Don't throw - the save was successful
      }
      
      setIsEditing(false);
      setActiveEditor(null); // Clear active editor lock
      
      // Show success notification
      showNotification(
        'Success',
        'Changes saved successfully',
        'success'
      );
      
      // Call success callback if provided
      if (onSaveSuccess) {
        onSaveSuccess(response);
      }
    } catch (err) {
      console.error('Failed to save:', err);
      console.error('Entity type:', entityType);
      console.error('Entity ID:', entityId);
      console.error('Field name:', fieldName);
      console.error('Auth token present:', !!authToken);
      console.error('Save succeeded before error:', saveSucceeded);
      
      // If save succeeded but something else failed, don't show error
      if (saveSucceeded) {
        console.warn('Save succeeded but post-save operation failed');
        setIsEditing(false);
        setActiveEditor(null);
        showNotification(
          'Success',
          'Changes saved successfully',
          'success'
        );
        return;
      }
      
      let errorMessage = err.message || 'Failed to save changes';
      
      // Provide more helpful error messages
      if (errorMessage === 'Failed to fetch') {
        errorMessage = 'Cannot connect to server. Please check if the backend is running and try again.';
      }
      
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
    setActiveEditor(null); // Clear active editor lock
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
    const isDisabled = activeEditor && activeEditor !== editorId;
    
    return (
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
        className={className}
        disabled={isDisabled}
      >
        {value || <span className="text-gray-400 italic">{placeholder}</span>}
      </EditableTextWrapper>
    );
  }
  
  // Editing mode - Show modal for better visibility using Portal
  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={handleCancel}
    >
      <div 
        className="bg-[#03060a] border border-white/10 shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-base font-semibold text-white">
            Edit {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </h3>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {multiline ? (
            <textarea
              ref={inputRef}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              className={`
                w-full p-2 
                border
                bg-transparent
                text-white
                focus:outline-none focus:ring-2 focus:ring-[#14C800]
                resize-y
                ${isSaving ? 'opacity-50 cursor-wait' : ''}
                ${error ? 'border-red-500' : 'border-white/10'}
              `}
              rows={12}
              placeholder={placeholder}
              style={{ minHeight: '200px', fontSize: '14px', lineHeight: '1.6' }}
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
                w-full p-2 
                border
                bg-transparent
                text-white
                focus:outline-none focus:ring-2 focus:ring-[#14C800]
                ${isSaving ? 'opacity-50 cursor-wait' : ''}
                ${error ? 'border-red-500' : 'border-white/10'}
              `}
              placeholder={placeholder}
              style={{ fontSize: '14px' }}
            />
          )}
          
          {/* Error message */}
          {error && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/40 rounded-none text-red-300 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          
          {/* Helper text */}
          <div className="mt-2 text-xs text-white/60 flex items-center gap-1">
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
        <div className="px-4 py-3 border-t border-white/10 bg-transparent flex justify-end gap-2">
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
            className="btn-flat btn-flat-sm btn-flat-active flex items-center gap-2"
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
  
  // Render modal using Portal to document.body
  return createPortal(modalContent, document.body);
};

export default InlineTextEditor;
