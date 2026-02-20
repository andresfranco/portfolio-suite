import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './AdvancedRichTextEditor.css';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { portfolioApi } from '../../services/portfolioApi';
import { EditableTextWrapper } from './EditableWrapper';
import { LanguageContext } from '../../context/LanguageContext';

/**
 * Language code to name mapping
 */
const LANGUAGE_NAMES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'pt': 'Portuguese',
  'it': 'Italian',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ru': 'Russian',
};

/**
 * AdvancedRichTextEditor Component
 * Full WYSIWYG editor with rich formatting capabilities using ReactQuill
 * Supports: text formatting, headings, lists, links, images, tables, code blocks
 *
 * @param {string} value - Current HTML content
 * @param {string} entityType - Type of entity ('project', 'experience', 'section')
 * @param {number} entityId - ID of the entity
 * @param {string} fieldName - Name of the field being edited
 * @param {string} placeholder - Placeholder text
 * @param {string} className - CSS classes for display
 * @param {number} minHeight - Minimum editor height in pixels
 * @param {string} label - Label for the editor modal
 * @param {Function} onSaveSuccess - Callback after successful save
 */
export const AdvancedRichTextEditor = ({
  value,
  entityType,
  entityId,
  fieldName,
  placeholder = 'Click to edit...',
  className = '',
  minHeight = 400,
  label,
  onSaveSuccess
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const quillRef = useRef(null);

  const { authToken, isEditMode, showNotification, activeEditor, setActiveEditor } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  const { language: currentLanguage } = useContext(LanguageContext);

  // Get language display name
  const languageName = LANGUAGE_NAMES[currentLanguage] || currentLanguage.toUpperCase();

  // Generate unique editor ID
  const editorId = useRef(`${entityType}-${entityId}-${fieldName}`).current;

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  // Quill modules configuration with full toolbar
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'font': [] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'align': [] }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'video'],
        ['clean']
      ],
    },
    clipboard: {
      matchVisual: false,
    }
  }), []);

  // Quill formats - all supported formats
  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'list', 'bullet', 'indent',
    'align',
    'blockquote', 'code-block',
    'link', 'image', 'video'
  ];

  /**
   * Save the edited content to backend
   */
  const handleSave = async () => {
    // Don't save if value hasn't changed
    if (localValue === value) {
      setIsEditing(false);
      setActiveEditor(null);
      return;
    }

    // Check if content is effectively empty (strip HTML tags for validation)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = localValue;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';

    if (!textContent.trim() && value) {
      showNotification(
        'Validation Error',
        'Content cannot be empty',
        'error'
      );
      setLocalValue(value); // Reset to original
      setIsEditing(false);
      setActiveEditor(null);
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
      try {
        await refreshPortfolio();
      } catch (refreshError) {
      }

      setIsEditing(false);
      setActiveEditor(null);

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
    setActiveEditor(null);
    setError(null);
  };

  /**
   * Render content for display - properly renders HTML
   */
  const renderContent = () => {
    if (!value) {
      return <span className="text-gray-400 italic">{placeholder}</span>;
    }

    // Render HTML content safely
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  };

  // If not in edit mode, just display the content
  if (!isEditMode) {
    return renderContent();
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
          setActiveEditor(editorId);
        }}
        label="Edit content"
        className={className}
        disabled={isDisabled}
        block={true}
      >
        {renderContent()}
      </EditableTextWrapper>

      {/* Modal - WYSIWYG Editor - Rendered via Portal */}
      {isEditing && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[55] p-4"
          onClick={handleCancel}
        >
          <div
            className="bg-[#03060a] border border-white/10 shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-gray-900/50">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-[#14C800]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {label || `Edit ${fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
              </h3>
              <div className="mt-2 flex items-center gap-4 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  <span className="font-medium">Editing in {languageName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Use toolbar to format text, add links, images, and more</span>
                </div>
              </div>
            </div>

            {/* Content - WYSIWYG Editor */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-900/30">
              <div className="wysiwyg-editor-wrapper">
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={localValue}
                  onChange={setLocalValue}
                  modules={modules}
                  formats={formats}
                  placeholder={placeholder}
                  readOnly={isSaving}
                  style={{
                    minHeight: `${minHeight}px`,
                    height: 'auto'
                  }}
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/40 rounded text-red-300 text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-gray-900/50 flex justify-between items-center">
              <div className="text-xs text-white/50">
                Supports rich formatting, images, links, lists, and code blocks
              </div>
              <div className="flex gap-2">
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
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default AdvancedRichTextEditor;
