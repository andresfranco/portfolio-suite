import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css'; // GitHub-like dark theme
// Import language support - order matters! Dependencies must be loaded first
import 'prismjs/components/prism-markup'; // HTML/XML base
import 'prismjs/components/prism-clike'; // Required for C++, Java, C#, etc.
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-c'; // Required for C++
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-markup-templating'; // Required for PHP
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-sass'; // Required for SCSS
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
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
  const [selectedImage, setSelectedImage] = useState(null);

  // Dialog states
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [showHtmlSourceDialog, setShowHtmlSourceDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [existingImages, setExistingImages] = useState([]);
  const [loadingExistingImages, setLoadingExistingImages] = useState(false);
  const [existingImagesError, setExistingImagesError] = useState(null);
  const [codeContent, setCodeContent] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [htmlSource, setHtmlSource] = useState('');
  const fileInputRef = useRef(null);
  const savedSelectionRef = useRef(null);
  const resizeDataRef = useRef(null);
  const displayContentRef = useRef(null);

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

  // Highlight code blocks when editor first opens
  useEffect(() => {
    if (isEditing && editorRef.current) {
      setTimeout(() => {
        const codeBlocks = editorRef.current.querySelectorAll('pre code[class*="language-"]');
        codeBlocks.forEach((block) => {
          try {
            // Only highlight if not already highlighted
            if (!block.querySelector('.token')) {
              const plainText = block.textContent;
              block.textContent = plainText;
              Prism.highlightElement(block);
            }
          } catch (e) {
          }
        });
      }, 100);
    }
  }, [isEditing]); // Only run when isEditing changes

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

  // Ensure all code blocks are non-editable and have delete buttons
  useEffect(() => {
    if (!isEditing || !editorRef.current) return;

    const makeCodeBlocksNonEditable = () => {
      const codeBlocks = editorRef.current.querySelectorAll('pre');
      codeBlocks.forEach(block => {
        // Only set contenteditable="false" if it contains a code element
        if (block.querySelector('code')) {
          block.setAttribute('contenteditable', 'false');
          
          // Add delete button if not already present
          if (!block.querySelector('.code-block-delete-btn')) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'code-block-delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.setAttribute('type', 'button');
            deleteBtn.setAttribute('title', 'Delete code block');
            deleteBtn.setAttribute('aria-label', 'Delete code block');
            block.appendChild(deleteBtn);
          }
        }
      });
    };

    // Set initially
    makeCodeBlocksNonEditable();

    // Create a MutationObserver to handle dynamically added code blocks
    // But disconnect temporarily when we're making changes to avoid infinite loops
    let isProcessing = false;
    const observer = new MutationObserver(() => {
      if (!isProcessing) {
        isProcessing = true;
        makeCodeBlocksNonEditable();
        // Use setTimeout to reset the flag after processing
        setTimeout(() => {
          isProcessing = false;
        }, 100);
      }
    });
    observer.observe(editorRef.current, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [isEditing, localValue]);

  // Make images resizable
  useEffect(() => {
    if (!isEditing || !editorRef.current) return;

    const handleImageClick = (e) => {
      const img = e.target;
      if (img.tagName === 'IMG' && !img.classList.contains('image-resizing')) {
        // Remove selection from other images
        editorRef.current.querySelectorAll('img').forEach(i => {
          i.classList.remove('image-selected');
        });
        
        img.classList.add('image-selected');
        setSelectedImage(img);
      }
    };

    const handleClickOutside = (e) => {
      if (e.target.tagName !== 'IMG') {
        editorRef.current.querySelectorAll('img').forEach(i => {
          i.classList.remove('image-selected');
        });
        setSelectedImage(null);
      }
    };

    const handleMouseDown = (e) => {
      const resizeHandle = e.target.closest('.image-resize-handle');
      if (!resizeHandle) return;

      e.preventDefault();
      e.stopPropagation();

      const img = resizeHandle.parentElement;
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = img.offsetWidth;
      const startHeight = img.offsetHeight;
      const aspectRatio = startWidth / startHeight;
      const handleType = resizeHandle.dataset.handle;

      img.classList.add('image-resizing');

      resizeDataRef.current = {
        img,
        startX,
        startY,
        startWidth,
        startHeight,
        aspectRatio,
        handleType
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
      if (!resizeDataRef.current) return;

      const { img, startX, startY, startWidth, startHeight, aspectRatio, handleType } = resizeDataRef.current;
      
      let newWidth, newHeight;

      if (handleType === 'se' || handleType === 'sw') {
        // Corner handles - maintain aspect ratio
        const deltaX = handleType === 'se' ? (e.clientX - startX) : (startX - e.clientX);
        newWidth = Math.max(50, startWidth + deltaX);
        newHeight = newWidth / aspectRatio;
      } else if (handleType === 'e' || handleType === 'w') {
        // Side handles - maintain aspect ratio
        const deltaX = handleType === 'e' ? (e.clientX - startX) : (startX - e.clientX);
        newWidth = Math.max(50, startWidth + deltaX);
        newHeight = newWidth / aspectRatio;
      }

      img.style.width = `${newWidth}px`;
      img.style.height = `${newHeight}px`;
    };

    const handleMouseUp = () => {
      if (resizeDataRef.current) {
        resizeDataRef.current.img.classList.remove('image-resizing');
        resizeDataRef.current = null;
        handleContentChange();
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Add click handler to images
    editorRef.current.addEventListener('click', handleImageClick);
    editorRef.current.addEventListener('click', handleClickOutside);
    editorRef.current.addEventListener('mousedown', handleMouseDown);

    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener('click', handleImageClick);
        editorRef.current.removeEventListener('click', handleClickOutside);
        editorRef.current.removeEventListener('mousedown', handleMouseDown);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isEditing]);

  // Add resize handles to selected image
  useEffect(() => {
    if (!selectedImage || !editorRef.current) return;

    // Remove existing handles
    editorRef.current.querySelectorAll('.image-resize-handle').forEach(h => h.remove());

    // Add resize handles
    const handles = ['se', 'sw', 'e', 'w'];
    handles.forEach(position => {
      const handle = document.createElement('div');
      handle.className = `image-resize-handle image-resize-handle-${position}`;
      handle.dataset.handle = position;
      selectedImage.parentElement.appendChild(handle);
    });

    return () => {
      editorRef.current?.querySelectorAll('.image-resize-handle').forEach(h => h.remove());
    };
  }, [selectedImage]);

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
   * Highlight code blocks with Prism.js after rendering
   */
  useEffect(() => {
    if (!isEditing) {
      // Highlight all code blocks in display mode
      try {
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => {
          // First try to highlight within the display content ref
          if (displayContentRef.current) {
            const codeBlocks = displayContentRef.current.querySelectorAll('pre code[class*="language-"]');
            codeBlocks.forEach((block) => {
              try {
                // Only re-highlight if not already highlighted
                if (!block.querySelector('.token')) {
                  const plainText = block.textContent;
                  block.textContent = plainText;
                  Prism.highlightElement(block);
                }
              } catch (e) {
              }
            });
          } else {
          }
        }, 100);
      } catch (error) {
      }
    }
  }, [value, isEditing]);

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

        // Insert image into editor wrapped in a container for resize handles
        restoreEditorSelection();
        editorRef.current?.focus();
        const imageHtml = `<div class="image-container" style="display: inline-block; position: relative;"><img src="${imageUrlToInsert}" style="max-width: 100%; height: auto; display: block;" /></div>`;
        document.execCommand('insertHTML', false, imageHtml);
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
      // Insert image from URL wrapped in container
      restoreEditorSelection();
      editorRef.current?.focus();
      const imageHtml = `<div class="image-container" style="display: inline-block; position: relative;"><img src="${imageUrl}" style="max-width: 100%; height: auto; display: block;" /></div>`;
      document.execCommand('insertHTML', false, imageHtml);
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

      const imageHtml = `<div class="image-container" style="display: inline-block; position: relative;"><img src="${imageUrlToInsert}" style="max-width: 100%; height: auto; display: block;" /></div>`;
      document.execCommand('insertHTML', false, imageHtml);
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
   * Insert blockquote - Wrap selected text
   */
  const insertBlockquote = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString();

    if (selectedText) {
      // Wrap selected text in blockquote
      const blockquoteHtml = `<blockquote>${selectedText}</blockquote>`;
      document.execCommand('insertHTML', false, blockquoteHtml);
      handleContentChange();
    } else {
      // Insert empty blockquote
      document.execCommand('formatBlock', false, '<blockquote>');
    }
    editorRef.current?.focus();
  };

  /**
   * Insert code block - Show dialog
   */
  const insertCodeBlock = () => {
    const selection = window.getSelection();
    let selectedText = '';

    if (selection && selection.rangeCount > 0) {
      selectedText = selection.toString();
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }

    // Pre-fill with selected text if any
    setCodeContent(selectedText || '');
    setCodeLanguage('javascript');
    setShowCodeDialog(true);
  };

  /**
   * Handle code block insert/update from dialog
   */
  const handleInsertCodeBlock = () => {
    if (codeContent.trim()) {
      // Check if we're editing an existing code block
      if (savedSelectionRef.current?.editingCodeBlock) {
        const existingBlock = savedSelectionRef.current.editingCodeBlock;

        // Update the existing code block
        existingBlock.className = `code-block language-${codeLanguage} editable-code-block`;
        existingBlock.dataset.language = codeLanguage;

        const codeElement = existingBlock.querySelector('code');
        codeElement.className = `language-${codeLanguage}`;
        codeElement.textContent = codeContent;

        // Apply syntax highlighting
        setTimeout(() => {
          Prism.highlightElement(codeElement);
        }, 50);

        handleContentChange();
        showNotification('Success', 'Code block updated', 'success');
      } else {
        // Insert new code block
        restoreEditorSelection();
        editorRef.current?.focus();

        // Create a code block with syntax highlighting classes and data attributes for editing
        const codeHtml = `<br><pre class="code-block language-${codeLanguage} editable-code-block" data-language="${codeLanguage}" contenteditable="false"><code class="language-${codeLanguage}">${escapeHtml(codeContent)}</code></pre><br>`;
        document.execCommand('insertHTML', false, codeHtml);
        handleContentChange();

        // Apply syntax highlighting immediately in edit mode
        setTimeout(() => {
          if (editorRef.current) {
            const codeBlocks = editorRef.current.querySelectorAll('pre code[class*="language-"]');
            codeBlocks.forEach(block => {
              Prism.highlightElement(block);
            });
          }
        }, 50);

        showNotification('Success', 'Code block inserted', 'success');
      }
    }

    setShowCodeDialog(false);
    setCodeContent('');
    savedSelectionRef.current = null;
  };

  /**
   * Handle click on code block to edit it
   */
  const handleCodeBlockClick = useCallback((event) => {
    if (!isEditing) return;

    // Check if delete button was clicked
    if (event.target.closest('.code-block-delete-btn')) {
      const codeBlock = event.target.closest('pre');
      if (codeBlock) {
        event.preventDefault();
        event.stopPropagation();
        
        // Remove the code block
        codeBlock.remove();
        handleContentChange();
        showNotification('Success', 'Code block deleted', 'success');
      }
      return;
    }

    // Look for ANY pre element (not just those with .code-block class)
    // This ensures we can edit code blocks even after they've been saved and reloaded
    const codeBlock = event.target.closest('pre');
    if (codeBlock) {
      // Only handle pre elements that contain code elements (actual code blocks)
      const codeElement = codeBlock.querySelector('code');
      if (!codeElement) return;

      event.preventDefault();
      event.stopPropagation();

      // Get existing code and language
      const existingCode = codeElement.textContent;

      // Try multiple methods to get the language:
      // 1. From data-language attribute on pre
      // 2. From class on pre (language-*)
      // 3. From class on code element (language-*)
      // 4. Default to javascript
      let language = codeBlock.dataset.language;

      if (!language) {
        const preClassMatch = codeBlock.className.match(/language-(\w+)/);
        if (preClassMatch) {
          language = preClassMatch[1];
        }
      }

      if (!language) {
        const codeClassMatch = codeElement.className.match(/language-(\w+)/);
        if (codeClassMatch) {
          language = codeClassMatch[1];
        }
      }

      language = language || 'javascript';

      // Add necessary classes if not present (for consistent styling)
      if (!codeBlock.classList.contains('code-block')) {
        codeBlock.classList.add('code-block');
      }
      if (!codeBlock.classList.contains('editable-code-block')) {
        codeBlock.classList.add('editable-code-block');
      }
      if (!codeBlock.classList.contains(`language-${language}`)) {
        codeBlock.classList.add(`language-${language}`);
      }

      // Ensure contenteditable is false to prevent direct editing
      codeBlock.setAttribute('contenteditable', 'false');

      // Store reference to the code block being edited
      savedSelectionRef.current = { editingCodeBlock: codeBlock };

      // Open dialog with existing content
      setCodeContent(existingCode);
      setCodeLanguage(language);
      setShowCodeDialog(true);
    }
  }, [isEditing]);

  /**
   * Escape HTML for safe insertion
   */
  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  /**
   * Toggle HTML source view
   */
  const toggleHtmlSource = () => {
    if (!showHtmlSourceDialog) {
      // Opening HTML source - get current content
      setHtmlSource(editorRef.current?.innerHTML || localValue);
    }
    setShowHtmlSourceDialog(!showHtmlSourceDialog);
  };

  /**
   * Apply HTML source changes
   */
  const applyHtmlSource = () => {
    try {
      // Update the editor content
      if (editorRef.current) {
        editorRef.current.innerHTML = htmlSource;
        setLocalValue(htmlSource);
      }
      setShowHtmlSourceDialog(false);
      showNotification('Success', 'HTML source updated', 'success');
    } catch (err) {
      showNotification('Error', 'Invalid HTML content', 'error');
    }
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
        ref={displayContentRef}
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
                  onClick={insertCodeBlock}
                  className="wysiwyg-toolbar-btn"
                  title="Insert Code Block"
                >
                  &lt;/&gt;
                </button>
                <button
                  type="button"
                  onClick={insertBlockquote}
                  className="wysiwyg-toolbar-btn"
                  title="Insert Blockquote"
                >
                  ❝❞
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
              <div className="flex gap-1 border-r border-white/10 pr-2">
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

              {/* HTML Source */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={toggleHtmlSource}
                  className="wysiwyg-toolbar-btn"
                  title="View/Edit HTML Source"
                >
                  &lt;HTML&gt;
                </button>
              </div>
            </div>

            {/* Content Editor */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-900/30">
              <div
                ref={editorRef}
                contentEditable={!isSaving}
                onInput={handleContentChange}
                onClick={handleCodeBlockClick}
                onKeyDown={(e) => {
                  // Prevent typing inside code blocks
                  const selection = window.getSelection();
                  if (selection && selection.anchorNode) {
                    const codeBlock = selection.anchorNode.nodeType === Node.ELEMENT_NODE
                      ? selection.anchorNode.closest('pre')
                      : selection.anchorNode.parentElement?.closest('pre');
                    
                    if (codeBlock && codeBlock.querySelector('code')) {
                      // Allow navigation keys but prevent typing
                      const allowedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];
                      if (!allowedKeys.includes(e.key)) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }
                  }
                }}
                onPaste={(e) => {
                  // Prevent pasting inside code blocks
                  const selection = window.getSelection();
                  if (selection && selection.anchorNode) {
                    const codeBlock = selection.anchorNode.nodeType === Node.ELEMENT_NODE
                      ? selection.anchorNode.closest('pre')
                      : selection.anchorNode.parentElement?.closest('pre');
                    
                    if (codeBlock && codeBlock.querySelector('code')) {
                      e.preventDefault();
                      return;
                    }
                  }

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

      {/* Code Block Dialog */}
      {showCodeDialog && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-[#03060a] border border-white/10 shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#14C800]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Insert Code Block
              </h3>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Programming Language
                </label>
                <select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  className="w-full p-2 border bg-[#0f1117] text-white focus:outline-none focus:ring-2 focus:ring-[#14C800] border-white/10 rounded"
                  style={{
                    color: '#ffffff',
                    backgroundColor: '#0f1117'
                  }}
                >
                  <option value="javascript" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>JavaScript</option>
                  <option value="typescript" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>TypeScript</option>
                  <option value="python" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>Python</option>
                  <option value="java" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>Java</option>
                  <option value="csharp" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>C#</option>
                  <option value="cpp" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>C++</option>
                  <option value="php" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>PHP</option>
                  <option value="ruby" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>Ruby</option>
                  <option value="go" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>Go</option>
                  <option value="rust" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>Rust</option>
                  <option value="swift" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>Swift</option>
                  <option value="kotlin" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>Kotlin</option>
                  <option value="sql" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>SQL</option>
                  <option value="html" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>HTML</option>
                  <option value="css" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>CSS</option>
                  <option value="scss" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>SCSS</option>
                  <option value="json" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>JSON</option>
                  <option value="yaml" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>YAML</option>
                  <option value="markdown" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>Markdown</option>
                  <option value="bash" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>Bash</option>
                  <option value="shell" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>Shell</option>
                  <option value="plaintext" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>Plain Text</option>
                </select>
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Code Content
                </label>
                <div className="flex-1 border border-white/10 rounded overflow-hidden" style={{ minHeight: '450px' }}>
                  <Editor
                    height="450px"
                    language={codeLanguage === 'plaintext' ? 'plaintext' : codeLanguage}
                    value={codeContent}
                    onChange={(value) => setCodeContent(value || '')}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineHeight: 22,
                      tabSize: 2,
                      wordWrap: 'off',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      formatOnPaste: true,
                      formatOnType: true,
                      scrollbar: {
                        vertical: 'auto',
                        horizontal: 'auto'
                      }
                    }}
                    onMount={(editor) => {
                      editor.focus();
                    }}
                  />
                </div>
              </div>

              <div className="text-xs text-white/60 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Select the language and paste your code. Press Tab to indent, Escape to cancel.</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/10 bg-transparent flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCodeDialog(false);
                  setCodeContent('');
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
                onClick={handleInsertCodeBlock}
                disabled={!codeContent.trim()}
                className="btn-flat btn-flat-sm btn-flat-active flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Insert Code Block
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* HTML Source Dialog */}
      {showHtmlSourceDialog && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-[#03060a] border border-white/10 shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#14C800]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                HTML Source Code Editor
              </h3>
              <p className="text-xs text-white/60 mt-1">
                Edit the HTML source code directly. Changes will be applied when you click "Apply Changes".
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-4">
              <div className="h-full border border-white/10 rounded overflow-hidden">
                <Editor
                  height="600px"
                  defaultLanguage="html"
                  value={htmlSource}
                  onChange={(value) => setHtmlSource(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineHeight: 22,
                    tabSize: 2,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    formatOnPaste: true,
                    formatOnType: true,
                    bracketPairColorization: { enabled: true },
                    autoClosingBrackets: 'always',
                    autoClosingQuotes: 'always',
                    autoIndent: 'full',
                    folding: true,
                    lineNumbers: 'on',
                    matchBrackets: 'always',
                    suggest: {
                      showKeywords: true,
                      showSnippets: true,
                      snippetsPreventQuickSuggestions: false
                    },
                    quickSuggestions: {
                      other: true,
                      comments: false,
                      strings: true
                    }
                  }}
                  onMount={(editor) => {
                    editor.focus();
                    // Format the document on mount
                    editor.getAction('editor.action.formatDocument').run();
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/10 bg-transparent flex justify-between items-center">
              <div className="text-xs text-white/60 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Be careful when editing HTML directly. Invalid HTML may cause display issues.</span>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowHtmlSourceDialog(false);
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
                  onClick={applyHtmlSource}
                  className="btn-flat btn-flat-sm btn-flat-active flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Apply Changes
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

export default ContentEditableWYSIWYG;
