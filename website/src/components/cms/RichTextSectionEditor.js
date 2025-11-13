import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Node, mergeAttributes } from '@tiptap/core';
import Editor from '@monaco-editor/react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css'; // GitHub-like dark theme (same as ContentEditableWYSIWYG)
// Import language support - same as ContentEditableWYSIWYG
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-sass';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
import './RichTextSectionEditor.css';
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaListUl,
  FaListOl,
  FaQuoteLeft,
  FaCode,
  FaHeading,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaAlignJustify,
  FaImage,
  FaLink,
  FaUnlink,
  FaUndo,
  FaRedo,
  FaFile,
  FaTextHeight,
  FaTimes,
  FaCheck,
  FaExclamationTriangle
} from 'react-icons/fa';
import portfolioApi from '../../services/portfolioApi';

// Custom Resizable Image Extension for TipTap with manual resize handles
const ResizableImage = Node.create({
  name: 'resizableImage',
  
  group: 'block',
  
  atom: true,
  
  draggable: true,
  
  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
        parseHTML: element => {
          const width = element.getAttribute('width') || element.style.width;
          return width ? parseInt(width) : null;
        },
        renderHTML: attributes => {
          if (!attributes.width) return {};
          return { width: attributes.width, style: `width: ${attributes.width}px;` };
        },
      },
      height: {
        default: null,
        parseHTML: element => {
          const height = element.getAttribute('height') || element.style.height;
          return height ? parseInt(height) : null;
        },
        renderHTML: attributes => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: dom => ({
          src: dom.getAttribute('src'),
          alt: dom.getAttribute('alt'),
          title: dom.getAttribute('title'),
          width: dom.getAttribute('width') || dom.style.width,
          height: dom.getAttribute('height') || dom.style.height,
        }),
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      class: 'tiptap-image',
      style: HTMLAttributes.width ? `width: ${HTMLAttributes.width}px; height: auto;` : 'max-width: 100%; height: auto;'
    })];
  },
  
  addCommands() {
    return {
      setImage: options => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
      updateImageSize: (src, width, height) => ({ tr, state }) => {
        const { selection } = state;
        const node = selection.node;
        
        if (node && node.type.name === 'resizableImage') {
          tr.setNodeMarkup(selection.from, null, {
            ...node.attrs,
            width,
            height,
          });
          return true;
        }
        return false;
      },
    };
  },
});

// Custom Code Block extension that preserves Prism highlighting
const CustomCodeBlock = Node.create({
  name: 'customCodeBlock',
  group: 'block',
  atom: true,
  
  addAttributes() {
    return {
      language: {
        default: 'javascript',
      },
      code: {
        default: '',
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'div.code-block-wrapper',
        getAttrs: dom => ({
          language: dom.getAttribute('data-language') || 'javascript',
          code: dom.querySelector('code')?.textContent || '',
        }),
      },
    ];
  },
  
  renderHTML({ node, HTMLAttributes }) {
    const { language, code } = node.attrs;
    
    // Create elements
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    wrapper.setAttribute('contenteditable', 'false');
    wrapper.setAttribute('data-language', language);
    
    const pre = document.createElement('pre');
    pre.className = `code-block language-${language}`;
    pre.setAttribute('contenteditable', 'false');
    
    const codeEl = document.createElement('code');
    codeEl.className = `language-${language}`;
    codeEl.textContent = code;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'code-block-delete-btn';
    deleteBtn.setAttribute('contenteditable', 'false');
    deleteBtn.setAttribute('title', 'Delete code block');
    deleteBtn.textContent = '×';
    
    pre.appendChild(codeEl);
    wrapper.appendChild(pre);
    wrapper.appendChild(deleteBtn);
    
    // Apply Prism highlighting
    try {
      Prism.highlightElement(codeEl);
    } catch (e) {
      console.warn('Prism highlighting failed:', e);
    }
    
    return wrapper;
  },
});

// Custom FontSize extension
import { Extension } from '@tiptap/core';

const FontSize = Extension.create({
  name: 'fontSize',
  
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});

/**
 * RichTextSectionEditor Component
 * A unified WYSIWYG editor for project sections that combines:
 * - Rich text formatting (bold, italic, lists, headings, etc.)
 * - Inline image upload and embedding
 * - File attachment management
 * 
 * This replaces the old separated text/image/file approach with a single,
 * integrated editing experience.
 */
const RichTextSectionEditor = ({ 
  initialContent = '', 
  initialImages = [],
  initialAttachments = [],
  sectionId = null,
  authToken,
  onChange,
  onImagesChange,
  onAttachmentsChange,
  disabled = false
}) => {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState(null);
  
  // Simple notification function (since we don't have access to the context)
  const showNotification = (title, message, type) => {
    console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    if (type === 'error') {
      setError(message);
      setTimeout(() => setError(null), 5000);
    }
  };
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const savedSelectionRef = useRef(null); // Track code block being edited
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [fontSize, setFontSize] = useState('16px');
  const [showFontSizeInput, setShowFontSizeInput] = useState(false);

  // Code block dialog state
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [codeContent, setCodeContent] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('javascript');

  // HTML source dialog state
  const [showHtmlDialog, setShowHtmlDialog] = useState(false);
  const [htmlSource, setHtmlSource] = useState('');

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4]
        },
        // Disable default code block to allow custom HTML code blocks with Prism highlighting
        codeBlock: false,
        code: false
      }),
      CustomCodeBlock,  // Add our custom code block extension
      ResizableImage.configure({
        inline: false,
        HTMLAttributes: {
          class: 'tiptap-image'
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#14C800] underline hover:text-[#12b000]',
          target: '_blank',
          rel: 'noopener noreferrer'
        }
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Underline,
      TextStyle,
      FontSize,
      Color
    ],
    content: initialContent || '<p>Start writing your section content here...</p>',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (onChange) {
        onChange(html);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[300px] p-4 bg-gray-800/30 rounded border border-gray-700/50'
      }
    }
  });

  /**
   * Handle code block click - for editing or deleting
   */
  const handleCodeBlockClick = useCallback((event) => {
    if (!editor) return;

    // Check if delete button was clicked
    if (event.target.closest('.code-block-delete-btn')) {
      event.preventDefault();
      event.stopPropagation();
      
      const wrapper = event.target.closest('.code-block-wrapper');
      if (wrapper) {
        // Remove the code block wrapper
        wrapper.remove();
        
        // Trigger content update
        if (onChange) {
          onChange(editor.getHTML());
        }
        showNotification('Success', 'Code block deleted', 'success');
      }
      return;
    }

    // Look for code block wrapper or pre element
    const wrapper = event.target.closest('.code-block-wrapper');
    const codeBlock = wrapper ? wrapper.querySelector('pre') : event.target.closest('pre');
    
    if (codeBlock) {
      // Only handle pre elements that contain code elements (actual code blocks)
      const codeElement = codeBlock.querySelector('code');
      if (!codeElement) return;

      event.preventDefault();
      event.stopPropagation();

      // Get existing code and language
      const existingCode = codeElement.textContent;

      // Try multiple methods to get the language:
      // 1. From data-language attribute on wrapper
      // 2. From data-language attribute on pre
      // 3. From class on pre (language-*)
      // 4. From class on code element (language-*)
      // 5. Default to javascript
      let language = wrapper?.dataset.language || codeBlock.dataset.language;

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

      // Store reference to the code block wrapper being edited
      savedSelectionRef.current = { editingCodeBlock: wrapper || codeBlock };

      // Open dialog with existing content
      setCodeContent(existingCode);
      setCodeLanguage(language);
      setShowCodeDialog(true);
    }
  }, [editor, onChange, showNotification]);

  // Apply Prism syntax highlighting when content changes and attach event handlers
  useEffect(() => {
    if (!editor) return;

    // Highlight code blocks whenever content changes
    const highlightCodeBlocks = () => {
      setTimeout(() => {
        try {
          const editorElement = document.querySelector('.ProseMirror');
          if (!editorElement) return;

          const codeBlocks = editorElement.querySelectorAll('pre code[class*="language-"]');
          codeBlocks.forEach(block => {
            // Always re-highlight to ensure proper styling
            // Get the current text content
            const text = block.textContent;
            
            // Clear and reset to ensure clean highlighting
            block.textContent = text;
            
            // Apply Prism highlighting
            try {
              Prism.highlightElement(block);
            } catch (e) {
              console.warn('Prism highlight failed for block:', e);
            }
          });

          // Make code block wrappers non-editable
          const wrappers = editorElement.querySelectorAll('.code-block-wrapper');
          wrappers.forEach(wrapper => {
            wrapper.setAttribute('contenteditable', 'false');
            const pre = wrapper.querySelector('pre');
            if (pre) {
              pre.setAttribute('contenteditable', 'false');
            }
          });
        } catch (error) {
          console.warn('Prism highlighting error:', error);
        }
      }, 100);
    };

    highlightCodeBlocks();

    // Attach click handler for code blocks (editing and deleting)
    const editorElement = document.querySelector('.ProseMirror');
    if (editorElement) {
      editorElement.addEventListener('click', handleCodeBlockClick);
    }

    // Handle image resizing
    const makeImagesResizable = () => {
      const editorElement = document.querySelector('.ProseMirror');
      if (!editorElement) return;

      const images = editorElement.querySelectorAll('img.tiptap-image');
      
      images.forEach(img => {
        // Skip if already has resize wrapper
        if (img.parentElement?.classList.contains('image-resize-wrapper')) return;

        // Wrap image in resize container
        const wrapper = document.createElement('div');
        wrapper.className = 'image-resize-wrapper';
        wrapper.contentEditable = 'false';
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);

        // Add resize handles
        const handles = ['se', 'sw', 'ne', 'nw'];
        handles.forEach(position => {
          const handle = document.createElement('div');
          handle.className = `resize-handle resize-handle-${position}`;
          handle.dataset.position = position;
          wrapper.appendChild(handle);
        });

        // Image click to select
        img.onclick = (e) => {
          e.stopPropagation();
          // Remove selection from other images
          document.querySelectorAll('.image-resize-wrapper').forEach(w => {
            w.classList.remove('selected');
          });
          wrapper.classList.add('selected');
        };

        // Handle resize
        wrapper.querySelectorAll('.resize-handle').forEach(handle => {
          handle.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = img.offsetWidth;
            const startHeight = img.offsetHeight;
            const aspectRatio = startWidth / startHeight;
            const position = handle.dataset.position;

            const onMouseMove = (e) => {
              let newWidth = startWidth;
              let newHeight = startHeight;

              if (position.includes('e')) {
                newWidth = startWidth + (e.clientX - startX);
              } else if (position.includes('w')) {
                newWidth = startWidth - (e.clientX - startX);
              }

              if (position.includes('s')) {
                newHeight = startHeight + (e.clientY - startY);
              } else if (position.includes('n')) {
                newHeight = startHeight - (e.clientY - startY);
              }

              // Maintain aspect ratio - use the larger dimension change
              const widthChange = Math.abs(newWidth - startWidth);
              const heightChange = Math.abs(newHeight - startHeight);
              
              if (widthChange > heightChange) {
                newHeight = newWidth / aspectRatio;
              } else {
                newWidth = newHeight * aspectRatio;
              }

              // Minimum size
              newWidth = Math.max(50, newWidth);
              newHeight = Math.max(50, newHeight);

              img.style.width = `${newWidth}px`;
              img.style.height = 'auto';

              // Update TipTap node attributes
              const pos = editor.view.posAtDOM(img, 0);
              if (pos !== null && pos !== undefined) {
                editor.commands.updateImageSize(img.src, Math.round(newWidth), Math.round(newHeight));
              }
            };

            const onMouseUp = () => {
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
              
              // Trigger content change
              if (onChange) {
                onChange(editor.getHTML());
              }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          };
        });
      });

      // Click outside to deselect
      editorElement.onclick = (e) => {
        if (!e.target.closest('img') && !e.target.closest('.resize-handle')) {
          document.querySelectorAll('.image-resize-wrapper').forEach(w => {
            w.classList.remove('selected');
          });
        }
      };
    };

    makeImagesResizable();

    // Re-attach on content updates
    const updateHandler = editor.on('update', () => {
      highlightCodeBlocks();
      makeImagesResizable();
    });

    return () => {
      // Clean up event listener
      if (editorElement) {
        editorElement.removeEventListener('click', handleCodeBlockClick);
      }
      
      if (updateHandler && typeof updateHandler.off === 'function') {
        updateHandler.off('update');
      }
    };
  }, [editor, onChange, showNotification, handleCodeBlockClick]);

  /**
   * Handle image upload and insert into editor
   */
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !editor) return;

    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      setError('Invalid image type. Please upload JPEG, PNG, GIF, or WebP images.');
      return;
    }

    if (file.size > maxSize) {
      setError('Image size too large. Maximum size is 5MB.');
      return;
    }

    try {
      setUploadingImage(true);
      setError(null);

      if (sectionId) {
        // Upload to backend and get URL
        const response = await portfolioApi.uploadImage(
          file,
          'section',
          sectionId,
          'section',
          authToken
        );

        const cleanPath = response.image_path?.startsWith('/') 
          ? response.image_path.substring(1) 
          : response.image_path;
        const imageUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${cleanPath}`;

        // Insert image into editor at cursor position
        editor.chain().focus().setImage({ src: imageUrl }).run();

        // Update parent component
        if (onImagesChange) {
          const newImage = {
            id: response.id || Date.now(),
            image_path: response.image_path,
            _uploadTimestamp: Date.now()
          };
          onImagesChange([...initialImages, newImage]);
        }
      } else {
        // For new sections, use base64 preview
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target.result;
          editor.chain().focus().setImage({ src: base64 }).run();
        };
        reader.readAsDataURL(file);
      }

      // Clear input
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  /**
   * Handle file attachment upload
   */
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (file.size > maxSize) {
      setError('File size too large. Maximum size is 10MB.');
      return;
    }

    if (!sectionId) {
      setError('Please save the section first before adding file attachments.');
      return;
    }

    try {
      setUploadingFile(true);
      setError(null);

      // Upload file
      const response = await portfolioApi.uploadAttachment(
        file,
        'section',
        sectionId,
        authToken
      );

      // Add attachment to list
      const newAttachment = {
        id: response.id || Date.now(),
        file_path: response.file_path || response.path,
        file_name: file.name,
        display_order: initialAttachments.length
      };

      if (onAttachmentsChange) {
        onAttachmentsChange([...initialAttachments, newAttachment]);
      }

      // Optionally insert a link to the file in the editor
      const fileUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${newAttachment.file_path}`;
      editor.chain().focus().insertContent(
        `<p><a href="${fileUrl}" target="_blank" class="inline-flex items-center gap-2 text-[#14C800] hover:text-[#12b000] underline">📎 ${file.name}</a></p>`
      ).run();

      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  /**
   * Set link on selected text
   */
  const setLink = useCallback(() => {
    if (!linkUrl || !editor) {
      return;
    }

    // Check if URL is valid
    let validUrl = linkUrl;
    if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
      validUrl = 'https://' + linkUrl;
    }

    editor.chain().focus().setLink({ href: validUrl }).run();
    setLinkUrl('');
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  /**
   * Remove link from selected text
   */
  const unsetLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  /**
   * Set font size on selected text
   */
  const setFontSizeValue = useCallback(() => {
    if (!fontSize || !editor) {
      return;
    }

    editor.chain().focus().setFontSize(fontSize).run();
    setShowFontSizeInput(false);
  }, [editor, fontSize]);

  /**
   * Open code block dialog
   */
  const openCodeDialog = useCallback(() => {
    setCodeContent('');
    setCodeLanguage('javascript');
    setShowCodeDialog(true);
  }, []);

  /**
   * Insert or update code block from dialog
   */
  const insertCodeBlockFromDialog = useCallback(() => {
    if (!editor || !codeContent.trim()) return;

    const escapedCode = codeContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Check if we're editing an existing code block
    if (savedSelectionRef.current?.editingCodeBlock) {
      const existingBlock = savedSelectionRef.current.editingCodeBlock;
      
      // Update the existing code block
      const codeElement = existingBlock.querySelector('code');
      const preElement = existingBlock.querySelector('pre');
      
      if (codeElement && preElement) {
        // Update language classes
        preElement.className = `code-block language-${codeLanguage}`;
        codeElement.className = `language-${codeLanguage}`;
        
        // Update content - use textContent to set raw text, then let Prism highlight it
        codeElement.textContent = codeContent;
        
        // Update data-language attribute on wrapper
        if (existingBlock.classList.contains('code-block-wrapper')) {
          existingBlock.setAttribute('data-language', codeLanguage);
        }
        
        // Re-apply syntax highlighting
        try {
          Prism.highlightElement(codeElement);
        } catch (e) {
          console.warn('Failed to highlight code block:', e);
        }
        
        // Trigger content update
        if (onChange) {
          onChange(editor.getHTML());
        }
        
        showNotification('Success', 'Code block updated', 'success');
      }
      
      // Clear the reference
      savedSelectionRef.current = null;
    } else {
      // Use the custom code block extension to insert
      editor.chain().focus().insertContent({
        type: 'customCodeBlock',
        attrs: {
          language: codeLanguage,
          code: codeContent,
        },
      }).run();

      // Apply highlighting after TipTap renders
      setTimeout(() => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
          const codeBlocks = editorElement.querySelectorAll('pre code[class*="language-"]');
          codeBlocks.forEach(block => {
            if (!block.querySelector('.token')) {
              try {
                Prism.highlightElement(block);
                console.log('Highlighted code block:', block.className);
              } catch (e) {
                console.warn('Prism highlighting failed:', e);
              }
            }
          });
        }
      }, 100);

      showNotification('Success', 'Code block inserted', 'success');
    }

    setShowCodeDialog(false);
    setCodeContent('');
  }, [editor, codeContent, codeLanguage, onChange, showNotification]);

  /**
   * Open HTML source editor
   */
  const openHtmlEditor = useCallback(() => {
    if (!editor) return;
    setHtmlSource(editor.getHTML());
    setShowHtmlDialog(true);
  }, [editor]);

  /**
   * Apply HTML source changes
   */
  const applyHtmlSource = useCallback(() => {
    if (!editor) return;
    try {
      editor.commands.setContent(htmlSource);
      setShowHtmlDialog(false);
      setError(null);
    } catch (err) {
      setError('Invalid HTML content. Please check your code.');
    }
  }, [editor, htmlSource]);

  if (!editor) {
    return <div className="text-gray-400 p-4">Loading editor...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded p-2 flex flex-wrap gap-1">
        {/* Text Formatting */}
        <div className="flex gap-1 pr-2 border-r border-gray-700">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            disabled={disabled}
            title="Bold"
          >
            <FaBold />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            disabled={disabled}
            title="Italic"
          >
            <FaItalic />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            disabled={disabled}
            title="Underline"
          >
            <FaUnderline />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            disabled={disabled}
            title="Strikethrough"
          >
            <FaStrikethrough />
          </ToolbarButton>
        </div>

        {/* Headings */}
        <div className="flex gap-1 pr-2 border-r border-gray-700">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            disabled={disabled}
            title="Heading 2"
          >
            <FaHeading className="text-lg" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            disabled={disabled}
            title="Heading 3"
          >
            <FaHeading className="text-sm" />
          </ToolbarButton>
        </div>

        {/* Lists */}
        <div className="flex gap-1 pr-2 border-r border-gray-700">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            disabled={disabled}
            title="Bullet List"
          >
            <FaListUl />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            disabled={disabled}
            title="Numbered List"
          >
            <FaListOl />
          </ToolbarButton>
        </div>

        {/* Alignment */}
        <div className="flex gap-1 pr-2 border-r border-gray-700">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })}
            disabled={disabled}
            title="Align Left"
          >
            <FaAlignLeft />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })}
            disabled={disabled}
            title="Align Center"
          >
            <FaAlignCenter />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })}
            disabled={disabled}
            title="Align Right"
          >
            <FaAlignRight />
          </ToolbarButton>
        </div>

        {/* Blocks */}
        <div className="flex gap-1 pr-2 border-r border-gray-700">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            disabled={disabled}
            title="Quote"
          >
            <FaQuoteLeft />
          </ToolbarButton>
          <ToolbarButton
            onClick={openCodeDialog}
            active={editor.isActive('codeBlock')}
            disabled={disabled}
            title="Code Block with Syntax Highlighting"
          >
            <FaCode />
          </ToolbarButton>
        </div>

        {/* Links */}
        <div className="flex gap-1 pr-2 border-r border-gray-700">
          <ToolbarButton
            onClick={() => {
              if (editor.state.selection.empty) {
                setError('Please select some text first to add a link');
                setTimeout(() => setError(null), 3000);
                return;
              }
              setShowLinkInput(!showLinkInput);
            }}
            active={editor.isActive('link')}
            disabled={disabled}
            title="Add Link"
          >
            <FaLink />
          </ToolbarButton>
          <ToolbarButton
            onClick={unsetLink}
            disabled={disabled || !editor.isActive('link')}
            title="Remove Link"
          >
            <FaUnlink />
          </ToolbarButton>
        </div>

        {/* Font Size */}
        <div className="flex gap-1 pr-2 border-r border-gray-700">
          <ToolbarButton
            onClick={() => {
              if (editor.state.selection.empty) {
                setError('Please select some text first to change font size');
                setTimeout(() => setError(null), 3000);
                return;
              }
              setShowFontSizeInput(!showFontSizeInput);
            }}
            active={showFontSizeInput}
            disabled={disabled}
            title="Font Size"
          >
            <FaTextHeight />
          </ToolbarButton>
        </div>

        {/* Media */}
        <div className="flex gap-1 pr-2 border-r border-gray-700">
          <label className="cursor-pointer">
            <ToolbarButton
              as="span"
              disabled={disabled || uploadingImage}
              title="Insert Image"
            >
              {uploadingImage ? (
                <div className="w-3 h-3 border-2 border-gray-400 border-t-[#14C800] rounded-full animate-spin" />
              ) : (
                <FaImage />
              )}
            </ToolbarButton>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={disabled || uploadingImage}
            />
          </label>
          
          <label className="cursor-pointer">
            <ToolbarButton
              as="span"
              disabled={disabled || uploadingFile || !sectionId}
              title={sectionId ? "Attach File" : "Save section first to attach files"}
            >
              {uploadingFile ? (
                <div className="w-3 h-3 border-2 border-gray-400 border-t-[#14C800] rounded-full animate-spin" />
              ) : (
                <FaFile />
              )}
            </ToolbarButton>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              disabled={disabled || uploadingFile || !sectionId}
            />
          </label>
        </div>

        {/* Undo/Redo */}
        <div className="flex gap-1 pr-2 border-r border-gray-700">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={disabled || !editor.can().undo()}
            title="Undo"
          >
            <FaUndo />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={disabled || !editor.can().redo()}
            title="Redo"
          >
            <FaRedo />
          </ToolbarButton>
        </div>

        {/* HTML Source */}
        <div className="flex gap-1">
          <ToolbarButton
            onClick={openHtmlEditor}
            disabled={disabled}
            title="Edit HTML Source"
          >
            &lt;HTML&gt;
          </ToolbarButton>
        </div>
      </div>

      {/* Link Input */}
      {showLinkInput && (
        <div className="flex gap-2 p-3 bg-gray-800/50 border border-gray-700/50 rounded">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Enter URL (e.g., https://example.com)"
            className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-[#14C800]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setLink();
              } else if (e.key === 'Escape') {
                setShowLinkInput(false);
                setLinkUrl('');
              }
            }}
          />
          <button
            onClick={setLink}
            className="px-4 py-2 bg-[#14C800] hover:bg-[#12b000] text-white rounded text-sm font-medium transition-colors"
          >
            Add Link
          </button>
          <button
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl('');
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Font Size Input */}
      {showFontSizeInput && (
        <div className="flex gap-2 p-3 bg-gray-800/50 border border-gray-700/50 rounded">
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-[#14C800]"
            autoFocus
          >
            <option value="12px">12px - Small</option>
            <option value="14px">14px - Normal</option>
            <option value="16px">16px - Medium</option>
            <option value="18px">18px - Large</option>
            <option value="20px">20px - X-Large</option>
            <option value="24px">24px - XX-Large</option>
            <option value="28px">28px - Huge</option>
            <option value="32px">32px - Giant</option>
          </select>
          <button
            onClick={setFontSizeValue}
            className="px-4 py-2 bg-[#14C800] hover:bg-[#12b000] text-white rounded text-sm font-medium transition-colors"
          >
            Apply Size
          </button>
          <button
            onClick={() => {
              setShowFontSizeInput(false);
              setFontSize('16px');
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* File Attachments Display (if any) */}
      {initialAttachments && initialAttachments.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <h4 className="text-sm font-semibold text-white mb-2">Attached Files:</h4>
          <div className="space-y-2">
            {initialAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-2 bg-gray-800/30 rounded border border-gray-700/50"
              >
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <FaFile className="text-gray-400" />
                  <span>{attachment.file_name}</span>
                </div>
                {onAttachmentsChange && (
                  <button
                    onClick={() => {
                      const updated = initialAttachments.filter(a => a.id !== attachment.id);
                      onAttachmentsChange(updated);
                    }}
                    className="text-red-400 hover:text-red-300 text-xs"
                    disabled={disabled}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code Block Dialog */}
      {showCodeDialog && createPortal(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-gray-900 border border-gray-700/50 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-700/50 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <FaCode className="text-[#14C800]" />
                Insert Code Block
              </h3>
              <button
                onClick={() => setShowCodeDialog(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Programming Language
                </label>
                <select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-[#14C800] transition-colors"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="csharp">C#</option>
                  <option value="cpp">C++</option>
                  <option value="php">PHP</option>
                  <option value="ruby">Ruby</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                  <option value="swift">Swift</option>
                  <option value="kotlin">Kotlin</option>
                  <option value="sql">SQL</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="scss">SCSS</option>
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                  <option value="markdown">Markdown</option>
                  <option value="bash">Bash</option>
                  <option value="shell">Shell</option>
                  <option value="plaintext">Plain Text</option>
                </select>
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-semibold text-white mb-2">
                  Code Content
                </label>
                <div className="flex-1 border border-gray-700 rounded overflow-hidden" style={{ minHeight: '450px' }}>
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
                      formatOnType: true
                    }}
                    onMount={(editor) => editor.focus()}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700/50 flex justify-end gap-3">
              <button
                onClick={() => setShowCodeDialog(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={insertCodeBlockFromDialog}
                disabled={!codeContent.trim()}
                className="px-4 py-2 bg-[#14C800] hover:bg-[#12b000] text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FaCode />
                Insert Code Block
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* HTML Source Dialog */}
      {showHtmlDialog && createPortal(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-gray-900 border border-gray-700/50 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-700/50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FaCode className="text-[#14C800]" />
                  HTML Source Code Editor
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Edit the HTML source code directly. Changes will be applied when you click "Apply Changes".
                </p>
              </div>
              <button
                onClick={() => setShowHtmlDialog(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-6">
              <div className="h-full border border-gray-700 rounded overflow-hidden">
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
                      showSnippets: true
                    }
                  }}
                  onMount={(editor) => {
                    editor.focus();
                    editor.getAction('editor.action.formatDocument').run();
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700/50 flex justify-between items-center">
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <FaExclamationTriangle className="text-yellow-500" />
                <span>Be careful when editing HTML directly. Invalid HTML may cause display issues.</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowHtmlDialog(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={applyHtmlSource}
                  className="px-4 py-2 bg-[#14C800] hover:bg-[#12b000] text-white rounded font-medium transition-colors flex items-center gap-2"
                >
                  <FaCheck />
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/**
 * Toolbar Button Component
 */
const ToolbarButton = ({ 
  onClick, 
  active = false, 
  disabled = false, 
  title = '', 
  children,
  as = 'button'
}) => {
  const Component = as;
  const baseClasses = "p-2 rounded transition-colors flex items-center justify-center";
  const activeClasses = active 
    ? "bg-[#14C800] text-white" 
    : "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white";
  const disabledClasses = disabled 
    ? "opacity-50 cursor-not-allowed" 
    : "cursor-pointer";

  const className = `${baseClasses} ${activeClasses} ${disabledClasses}`;

  if (as === 'span') {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      title={title}
    >
      {children}
    </button>
  );
};

export default RichTextSectionEditor;
