import React, { useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
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
  FaTextHeight
} from 'react-icons/fa';
import portfolioApi from '../../services/portfolioApi';

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
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [fontSize, setFontSize] = useState('16px');
  const [showFontSizeInput, setShowFontSizeInput] = useState(false);

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4]
        }
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
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
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            disabled={disabled}
            title="Code Block"
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
        <div className="flex gap-1">
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

      {/* Help Text */}
      <div className="text-xs text-gray-500">
        <p>💡 Tips:</p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>Use the toolbar to format text, add headings, lists, and more</li>
          <li>Select text and click the <strong>A</strong> icon to change font size</li>
          <li>Click the image icon to upload and insert images inline</li>
          <li>Select text and click the link icon to add hyperlinks</li>
          <li>Attach downloadable files using the file icon</li>
        </ul>
      </div>
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
