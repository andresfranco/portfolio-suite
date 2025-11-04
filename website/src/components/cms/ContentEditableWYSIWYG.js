import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { portfolioApi } from '../../services/portfolioApi';
import { EditableTextWrapper } from './EditableWrapper';
import { LanguageContext } from '../../context/LanguageContext';
import './ContentEditableWYSIWYG.css';

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
 * ContentEditableWYSIWYG Component
 * React 19 compatible WYSIWYG editor using contentEditable
 * Supports: text formatting, headings, lists, links, images, alignment
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
export const ContentEditableWYSIWYG = ({
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
  const editorRef = useRef(null);
  const [currentFormat, setCurrentFormat] = useState({});

  // Dialog states
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [existingImages, setExistingImages] = useState([]);
  const [loadingExistingImages, setLoadingExistingImages] = useState(false);
  const [existingImagesError, setExistingImagesError] = useState(null);
  const fileInputRef = useRef(null);
  const savedSelectionRef = useRef(null);

  const restoreEditorSelection = () => {
    if (savedSelectionRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
      }
    }
  };

  const resetImageDialogState = () => {
    setShowImageDialog(false);
    setImageUrl('');
    setImageFile(null);
    setImagePreview('');
    setExistingImages([]);
    setExistingImagesError(null);
    savedSelectionRef.current = null;
    editorRef.current?.focus();
  };

  const { authToken, isEditMode, showNotification, activeEditor, setActiveEditor } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  const { language: currentLanguage } = useContext(LanguageContext);
  const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Get language display name
  const languageName = LANGUAGE_NAMES[currentLanguage] || currentLanguage.toUpperCase();

  // Generate unique editor ID
  const editorId = useRef(`${entityType}-${entityId}-${fieldName}`).current;

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  // Update editor content when local value changes
  useEffect(() => {
    if (editorRef.current && isEditing) {
      if (editorRef.current.innerHTML !== localValue) {
        editorRef.current.innerHTML = localValue;
      }
    }
  }, [localValue, isEditing]);

  // Update format state on selection change
  useEffect(() => {
    if (!isEditing) return;

    const updateFormatState = () => {
      setCurrentFormat({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
      });
    };

    document.addEventListener('selectionchange', updateFormatState);
    return () => document.removeEventListener('selectionchange', updateFormatState);
  }, [isEditing]);

  /**
   * Fetch existing images that belong to the current entity (experience, project, etc.)
   */
  const fetchExistingImages = useCallback(async () => {
    if (entityType !== 'experience' || !entityId) {
      setExistingImages([]);
      setExistingImagesError(null);
      return;
    }

    setLoadingExistingImages(true);
    setExistingImagesError(null);

    try {
      const response = await portfolioApi.getContentImages(
        entityType,
        entityId,
        {
          category: 'content',
          languageCode: currentLanguage,
        },
        authToken
      );

      const items = Array.isArray(response)
        ? response
        : response?.items || [];

      setExistingImages(items);
    } catch (err) {
      console.error('Failed to load existing images:', err);
      const message = err?.message || 'Failed to load images';
      setExistingImagesError(message);
      showNotification('Error', message, 'error');
    } finally {
      setLoadingExistingImages(false);
    }
  }, [entityType, entityId, currentLanguage, authToken, showNotification]);

  useEffect(() => {
    if (showImageDialog && entityType === 'experience') {
      fetchExistingImages();
    }

    if (!showImageDialog) {
      setExistingImages([]);
      setExistingImagesError(null);
    }
  }, [showImageDialog, entityType, fetchExistingImages]);

  /**
   * Execute formatting command
   */
  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();

    // Update format state immediately
    setCurrentFormat(prev => ({
      ...prev,
      [command]: document.queryCommandState(command)
    }));
  };

  /**
   * Insert link - Show dialog
   */
  const insertLink = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString();

    // Save the current selection range
    if (selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }

    setLinkText(selectedText || '');
    setLinkUrl('https://');
    setShowLinkDialog(true);
  };

  /**
   * Handle link insert from dialog
   */
  const handleInsertLink = () => {
    if (linkUrl && linkUrl.trim() && linkUrl !== 'https://') {
      // Restore the saved selection
      if (savedSelectionRef.current) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
      }

      // Focus editor first
      editorRef.current?.focus();

      if (linkText) {
        // Insert link with text
        const linkHtml = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
        document.execCommand('insertHTML', false, linkHtml);
      } else {
        // Create link from selection
        document.execCommand('createLink', false, linkUrl);
        // Add target and rel attributes to the created link
        const selection = window.getSelection();
        if (selection.anchorNode) {
          let node = selection.anchorNode;
          // Find the anchor element
          while (node && node !== editorRef.current) {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'A') {
              node.setAttribute('target', '_blank');
              node.setAttribute('rel', 'noopener noreferrer');
              break;
            }
            node = node.parentElement;
          }
        }
      }

      // Update content
      handleContentChange();
    }

    setShowLinkDialog(false);
    setLinkUrl('');
    setLinkText('');
    savedSelectionRef.current = null;
  };

  /**
   * Insert image - Show dialog
   */
  const insertImage = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    } else {
      savedSelectionRef.current = null;
    }
    setImageUrl('https://');
    setImageFile(null);
    setImagePreview('');
    setShowImageDialog(true);
  };

  /**
   * Handle image file selection
   */
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showNotification('Error', 'Please select an image file', 'error');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showNotification('Error', 'Image size must be less than 5MB', 'error');
        return;
      }

      setImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Handle image insert from dialog
   */
  const handleInsertImage = async () => {
    restoreEditorSelection();

    if (imageFile) {
      // Upload image
      setUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append('file', imageFile);

        // Use query parameters for the CMS content image upload endpoint
        const params = new URLSearchParams({
          entity_type: entityType,
          entity_id: entityId.toString(),
          category: 'content'
        });

        const uploadUrl = `${apiBaseUrl}/api/cms/content/images?${params}`;
        console.log('Uploading image to:', uploadUrl);
        console.log('Entity type:', entityType, 'Entity ID:', entityId);
        console.log('API URL from env:', process.env.REACT_APP_API_URL);

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData,
          credentials: 'include' // Include cookies for CSRF token
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Upload failed');
        }

        const data = await response.json();
        const uploadedUrl = data.file_path || data.url || data.image_url;

        if (!uploadedUrl) {
          throw new Error('No image URL returned from server');
        }

        // Ensure URL is absolute
        const imageUrlToInsert = uploadedUrl.startsWith('http')
          ? uploadedUrl
          : `${apiBaseUrl}${uploadedUrl}`;

        // Insert image into editor
        restoreEditorSelection();
        editorRef.current?.focus();
        document.execCommand('insertImage', false, imageUrlToInsert);
        handleContentChange();

        showNotification('Success', 'Image uploaded successfully', 'success');
        resetImageDialogState();
        return;
      } catch (err) {
        console.error('Image upload error:', err);
        showNotification('Error', err.message || 'Failed to upload image', 'error');
      } finally {
        setUploadingImage(false);
      }
    }

    if (imageUrl && imageUrl.trim() && imageUrl !== 'https://') {
      // Insert image from URL
      restoreEditorSelection();
      editorRef.current?.focus();
      document.execCommand('insertImage', false, imageUrl);
      handleContentChange();
      resetImageDialogState();
      return;
    }
    savedSelectionRef.current = null;
  };

  /**
   * Insert an existing image selected from the library
   */
  const handleInsertExistingImage = async (image) => {
    if (!image || uploadingImage) {
      return;
    }

    const sourcePath = image.image_url || image.file_path || image.image_path;

    if (!sourcePath) {
      showNotification('Error', 'Selected image does not have a valid path', 'error');
      return;
    }

    try {
      setUploadingImage(true);
      restoreEditorSelection();
      editorRef.current?.focus();

      const imageUrlToInsert = sourcePath.startsWith('http')
        ? sourcePath
        : `${apiBaseUrl}${sourcePath}`;

      document.execCommand('insertImage', false, imageUrlToInsert);
      handleContentChange();
      showNotification('Success', 'Image inserted from library', 'success');
      resetImageDialogState();
    } catch (err) {
      console.error('Failed to insert existing image:', err);
      showNotification('Error', err?.message || 'Failed to insert image', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  /**
   * Apply heading format
   */
  const applyHeading = (level) => {
    execCommand('formatBlock', `<h${level}>`);
  };

  /**
   * Handle content change
   */
  const handleContentChange = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      setLocalValue(newContent);
    }
  };

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

    // Check if content is effectively empty
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = localValue;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';

    if (!textContent.trim() && value) {
      showNotification(
        'Validation Error',
        'Content cannot be empty',
        'error'
      );
      setLocalValue(value);
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
        console.warn('Content saved but refresh failed:', refreshError);
      }

      setIsEditing(false);
      setActiveEditor(null);

      showNotification(
        'Content Saved',
        'Your changes have been saved successfully',
        'success'
      );

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
   * Render content for display
   */
  const renderContent = () => {
    if (!value) {
      return <span className="text-gray-400 italic">{placeholder}</span>;
    }

    return (
      <div
        className={`wysiwyg-display-content ${className}`}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  };

  // If not in edit mode, just display the content
  if (!isEditMode) {
    return renderContent();
  }

  // In edit mode: show editable wrapper
  const isDisabled = activeEditor && activeEditor !== editorId;

  return (
    <>
      <EditableTextWrapper
        onEdit={() => {
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

      {/* Modal - WYSIWYG Editor */}
      {isEditing && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[55] p-4"
        >
          <div
            className="bg-[#03060a] border border-white/10 shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col"
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
              </div>
            </div>

            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-white/10 bg-gray-900/30 flex flex-wrap gap-1">
              {/* Text Formatting */}
              <div className="flex gap-1 border-r border-white/10 pr-2">
                <button
                  type="button"
                  onClick={() => execCommand('bold')}
                  className={`wysiwyg-toolbar-btn ${currentFormat.bold ? 'active' : ''}`}
                  title="Bold (Ctrl+B)"
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('italic')}
                  className={`wysiwyg-toolbar-btn ${currentFormat.italic ? 'active' : ''}`}
                  title="Italic (Ctrl+I)"
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('underline')}
                  className={`wysiwyg-toolbar-btn ${currentFormat.underline ? 'active' : ''}`}
                  title="Underline (Ctrl+U)"
                >
                  <u>U</u>
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('strikeThrough')}
                  className={`wysiwyg-toolbar-btn ${currentFormat.strikeThrough ? 'active' : ''}`}
                  title="Strikethrough"
                >
                  <s>S</s>
                </button>
              </div>

              {/* Headings */}
              <div className="flex gap-1 border-r border-white/10 pr-2">
                <button
                  type="button"
                  onClick={() => applyHeading(1)}
                  className="wysiwyg-toolbar-btn"
                  title="Heading 1"
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => applyHeading(2)}
                  className="wysiwyg-toolbar-btn"
                  title="Heading 2"
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={() => applyHeading(3)}
                  className="wysiwyg-toolbar-btn"
                  title="Heading 3"
                >
                  H3
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('formatBlock', '<p>')}
                  className="wysiwyg-toolbar-btn"
                  title="Paragraph"
                >
                  P
                </button>
              </div>

              {/* Lists */}
              <div className="flex gap-1 border-r border-white/10 pr-2">
                <button
                  type="button"
                  onClick={() => execCommand('insertUnorderedList')}
                  className={`wysiwyg-toolbar-btn ${currentFormat.insertUnorderedList ? 'active' : ''}`}
                  title="Bullet List"
                >
                  •••
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('insertOrderedList')}
                  className={`wysiwyg-toolbar-btn ${currentFormat.insertOrderedList ? 'active' : ''}`}
                  title="Numbered List"
                >
                  123
                </button>
              </div>

              {/* Alignment */}
              <div className="flex gap-1 border-r border-white/10 pr-2">
                <button
                  type="button"
                  onClick={() => execCommand('justifyLeft')}
                  className={`wysiwyg-toolbar-btn ${currentFormat.justifyLeft ? 'active' : ''}`}
                  title="Align Left"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('justifyCenter')}
                  className={`wysiwyg-toolbar-btn ${currentFormat.justifyCenter ? 'active' : ''}`}
                  title="Align Center"
                >
                  ↔
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('justifyRight')}
                  className={`wysiwyg-toolbar-btn ${currentFormat.justifyRight ? 'active' : ''}`}
                  title="Align Right"
                >
                  →
                </button>
              </div>

              {/* Insert */}
              <div className="flex gap-1 border-r border-white/10 pr-2">
                <button
                  type="button"
                  onClick={insertLink}
                  className="wysiwyg-toolbar-btn"
                  title="Insert Link"
                >
                  🔗
                </button>
                <button
                  type="button"
                  onClick={insertImage}
                  className="wysiwyg-toolbar-btn"
                  title="Insert Image"
                >
                  🖼️
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('insertHorizontalRule')}
                  className="wysiwyg-toolbar-btn"
                  title="Horizontal Line"
                >
                  ─
                </button>
              </div>

              {/* Clear Formatting */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => execCommand('removeFormat')}
                  className="wysiwyg-toolbar-btn"
                  title="Clear Formatting"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('undo')}
                  className="wysiwyg-toolbar-btn"
                  title="Undo"
                >
                  ↶
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('redo')}
                  className="wysiwyg-toolbar-btn"
                  title="Redo"
                >
                  ↷
                </button>
              </div>
            </div>

            {/* Content Editor */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-900/30">
              <div
                ref={editorRef}
                contentEditable={!isSaving}
                onInput={handleContentChange}
                onPaste={(e) => {
                  // Allow pasting but strip some problematic formatting
                  e.preventDefault();
                  const text = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
                  document.execCommand('insertHTML', false, text);
                }}
                className="wysiwyg-content-editor"
                style={{ minHeight: `${minHeight}px` }}
                data-placeholder={placeholder}
                suppressContentEditableWarning
              />

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
                Rich text formatting, images, links, and lists supported
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

      {/* Link Dialog */}
      {showLinkDialog && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-[#03060a] border border-white/10 shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-md w-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#14C800]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Insert Link
              </h3>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Link URL
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full p-2 border bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-[#14C800] border-white/10"
                  placeholder="https://example.com"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleInsertLink();
                    } else if (e.key === 'Escape') {
                      setShowLinkDialog(false);
                      setLinkUrl('');
                      setLinkText('');
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Link Text (optional)
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full p-2 border bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-[#14C800] border-white/10"
                  placeholder="Leave empty to use selected text"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleInsertLink();
                    } else if (e.key === 'Escape') {
                      setShowLinkDialog(false);
                      setLinkUrl('');
                      setLinkText('');
                    }
                  }}
                />
              </div>

              <div className="text-xs text-white/60 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Links will open in a new tab. Press Enter to insert or Escape to cancel.</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/10 bg-transparent flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowLinkDialog(false);
                  setLinkUrl('');
                  setLinkText('');
                  editorRef.current?.focus();
                }}
                className="btn-flat btn-flat-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>

              <button
                onClick={handleInsertLink}
                disabled={!linkUrl || linkUrl === 'https://'}
                className="btn-flat btn-flat-sm btn-flat-active flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Insert Link
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Image Dialog */}
      {showImageDialog && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-[#03060a] border border-white/10 shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-lg w-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#14C800]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Insert Image
              </h3>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Upload Image Tab */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Upload Image
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="w-full p-3 border-2 border-dashed border-white/20 hover:border-[#14C800] bg-transparent text-white/70 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {imageFile ? imageFile.name : 'Click to select image'}
                </button>

                {/* Image Preview */}
                {imagePreview && (
                  <div className="mt-3 border border-white/10 p-2 bg-gray-900/50">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-full max-h-48 mx-auto object-contain"
                    />
                  </div>
                )}

                <p className="mt-2 text-xs text-white/60">
                  Maximum file size: 5MB. Supported formats: JPG, PNG, GIF, WebP
                </p>
              </div>

              {/* Existing Images */}
              {entityType === 'experience' && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-white/80">
                      Use Existing Image
                    </label>
                    <button
                      type="button"
                      onClick={fetchExistingImages}
                      disabled={loadingExistingImages || uploadingImage}
                      className="text-xs px-2 py-1 border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Refresh
                    </button>
                  </div>

                  {loadingExistingImages ? (
                    <div className="text-sm text-white/60 py-4 text-center">
                      Loading images...
                    </div>
                  ) : existingImages.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                      {existingImages.map((img) => {
                        const relativePath = img.image_url || img.file_path || img.image_path || '';
                        const displaySrc = relativePath.startsWith('http')
                          ? relativePath
                          : `${apiBaseUrl}${relativePath}`;
                        const displayName = img.file_name || relativePath.split('/').pop() || 'Image';

                        return (
                          <button
                            type="button"
                            key={img.id}
                            onClick={() => handleInsertExistingImage(img)}
                            className="group border border-white/10 hover:border-[#14C800] rounded-md overflow-hidden bg-gray-900/50 hover:bg-gray-900/80 transition-all"
                            disabled={uploadingImage}
                          >
                            <div className="aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
                              <img
                                src={displaySrc}
                                alt={displayName}
                                className="object-contain max-h-36 w-full group-hover:scale-105 transition-transform"
                              />
                            </div>
                            <div className="px-2 py-1 text-left">
                              <p className="text-xs text-white/80 truncate">{displayName}</p>
                              {img.language_id && (
                                <p className="text-[10px] text-white/50 uppercase mt-0.5">
                                  Lang ID: {img.language_id}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-white/60">
                      No existing images found for this experience yet. Upload a new image to get started.
                    </p>
                  )}

                  {existingImagesError && (
                    <p className="mt-2 text-xs text-red-400">
                      {existingImagesError}
                    </p>
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-white/10"></div>
                <span className="text-xs text-white/50 uppercase">Or</span>
                <div className="flex-1 border-t border-white/10"></div>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={!!imageFile}
                  className={`w-full p-2 border bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-[#14C800] border-white/10 ${imageFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                  placeholder="https://example.com/image.jpg"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !imageFile) {
                      handleInsertImage();
                    } else if (e.key === 'Escape') {
                      resetImageDialogState();
                    }
                  }}
                />
                <p className="mt-1 text-xs text-white/60">
                  Paste a direct link to an image
                </p>
              </div>

              <div className="text-xs text-white/60 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Upload a file or provide an image URL. Press Enter to insert or Escape to cancel.</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/10 bg-transparent flex justify-end gap-2">
              <button
                onClick={resetImageDialogState}
                disabled={uploadingImage}
                className="btn-flat btn-flat-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>

              <button
                onClick={handleInsertImage}
                disabled={uploadingImage || (!imageFile && (!imageUrl || imageUrl === 'https://'))}
                className="btn-flat btn-flat-sm btn-flat-active flex items-center gap-1.5"
              >
                {uploadingImage ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Insert Image
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ContentEditableWYSIWYG;
