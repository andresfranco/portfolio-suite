import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { NodeSelection } from 'prosemirror-state';
import Editor from '@monaco-editor/react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-bash';
import {
  FaAlignCenter,
  FaAlignJustify,
  FaAlignLeft,
  FaAlignRight,
  FaBold,
  FaCode,
  FaFile,
  FaHeading,
  FaImage,
  FaItalic,
  FaLink,
  FaListOl,
  FaListUl,
  FaMinus,
  FaPlus,
  FaQuoteLeft,
  FaRedo,
  FaTable,
  FaTrash,
  FaUnderline,
  FaUndo,
  FaUnlink
} from 'react-icons/fa';
import portfolioApi from '../../services/portfolioApi';
import './RichTextSectionEditorV2.css';

const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');

const CODE_LANGUAGE_OPTIONS = [
  { value: 'javascript', label: 'JavaScript', prism: 'javascript' },
  { value: 'typescript', label: 'TypeScript', prism: 'typescript' },
  { value: 'python', label: 'Python', prism: 'python' },
  { value: 'java', label: 'Java', prism: 'java' },
  { value: 'sql', label: 'SQL', prism: 'sql' },
  { value: 'html', label: 'HTML', prism: 'markup' },
  { value: 'css', label: 'CSS', prism: 'css' },
  { value: 'scss', label: 'SCSS', prism: 'scss' },
  { value: 'json', label: 'JSON', prism: 'json' },
  { value: 'yaml', label: 'YAML', prism: 'yaml' },
  { value: 'bash', label: 'Bash', prism: 'bash' }
];

const CODE_LANGUAGE_MAP = CODE_LANGUAGE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option;
  return acc;
}, {});

const CODE_LANGUAGE_ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  yml: 'yaml',
  shell: 'bash',
  sh: 'bash',
  xml: 'html',
  markup: 'html'
};

const normalizeCodeLanguage = (value) => {
  const next = (value || '').trim().toLowerCase();
  if (!next) return 'javascript';
  const normalized = CODE_LANGUAGE_ALIASES[next] || next;
  return CODE_LANGUAGE_MAP[normalized] ? normalized : 'javascript';
};

const getPrismLanguage = (language) => {
  const normalized = normalizeCodeLanguage(language);
  const option = CODE_LANGUAGE_MAP[normalized];
  const prismKey = option?.prism || normalized;

  if (Prism.languages[prismKey]) return prismKey;
  if (Prism.languages[normalized]) return normalized;
  if (Prism.languages.javascript) return 'javascript';
  return 'markup';
};

const getCodeLanguageLabel = (language) => {
  const normalized = normalizeCodeLanguage(language);
  return CODE_LANGUAGE_MAP[normalized]?.label || 'JavaScript';
};

const getMonacoLanguage = (language) => {
  const normalized = normalizeCodeLanguage(language);
  if (normalized === 'html') return 'html';
  if (normalized === 'bash') return 'shell';
  return normalized;
};

const highlightCodeHtml = (language, code) => {
  const source = code || '';
  const prismKey = getPrismLanguage(language);
  const grammar = Prism.languages[prismKey] || Prism.languages.javascript || Prism.languages.markup;

  if (!grammar) {
    return escapeHtml(source);
  }

  try {
    return Prism.highlight(source, grammar, prismKey);
  } catch (error) {
    return escapeHtml(source);
  }
};

const parseCodeBlockAttrs = (element) => {
  const codeElement = element.querySelector('pre code');
  const hasCodeMarker = element.getAttribute('data-code-block') === 'cms';

  if (!hasCodeMarker && !codeElement) {
    return false;
  }

  const classLanguageMatch = codeElement?.className?.match(/language-([a-z0-9-]+)/i);
  const language =
    element.getAttribute('data-language') ||
    element.querySelector('pre')?.getAttribute('data-language') ||
    classLanguageMatch?.[1] ||
    'javascript';

  return {
    language: normalizeCodeLanguage(language),
    code: element.getAttribute('data-code') || codeElement?.textContent || ''
  };
};

const RTE2_MONACO_THEME = 'rte2-vs-dark';

const configureMonacoTheme = (monaco) => {
  monaco.editor.defineTheme(RTE2_MONACO_THEME, {
    base: 'vs-dark',
    inherit: true,
    semanticHighlighting: false,
    rules: [
      { token: 'delimiter', foreground: 'D4D4D4' },
      { token: 'delimiter.parenthesis', foreground: 'D4D4D4' },
      { token: 'delimiter.bracket', foreground: 'D4D4D4' },
      { token: 'delimiter.curly', foreground: 'D4D4D4' }
    ],
    colors: {}
  });
};

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle']
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            }
          }
        }
      }
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain, commands }) => {
          if (!fontSize) {
            return commands.unsetFontSize();
          }
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
        }
    };
  }
});

const CmsImageView = ({ node, updateAttributes, deleteNode, selected }) => {
  const resizeStateRef = useRef({ active: false, startX: 0, startWidth: 0 });

  const onResizeStart = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      const currentWidth = parseInt((node.attrs.width || '').replace('px', ''), 10) || 320;
      resizeStateRef.current = {
        active: true,
        startX: event.clientX,
        startWidth: currentWidth
      };

      const onMove = (moveEvent) => {
        if (!resizeStateRef.current.active) return;
        const delta = moveEvent.clientX - resizeStateRef.current.startX;
        const width = Math.max(80, resizeStateRef.current.startWidth + delta);
        updateAttributes({ width: `${width}px` });
      };

      const onUp = () => {
        resizeStateRef.current.active = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [node.attrs.width, updateAttributes]
  );

  const width = node.attrs.width || '320px';

  return (
    <NodeViewWrapper className={`rte2-image-node ${selected ? 'is-selected' : ''}`} data-drag-handle>
      <img
        src={node.attrs.src}
        alt={node.attrs.alt || ''}
        title={node.attrs.title || ''}
        className="tiptap-image"
        style={{ width, maxWidth: '100%', height: 'auto' }}
        draggable={false}
      />
      <button type="button" className="rte2-image-remove" onClick={deleteNode} title="Remove image">
        <FaTrash size={10} />
      </button>
      <button
        type="button"
        className="rte2-image-resize"
        onMouseDown={onResizeStart}
        title="Resize image"
        aria-label="Resize image"
      />
    </NodeViewWrapper>
  );
};

const CmsImage = Node.create({
  name: 'cmsImage',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: '320px' },
      class: { default: 'tiptap-image' }
    };
  },
  parseHTML() {
    return [{ tag: 'img[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },
  addCommands() {
    return {
      setCmsImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs
          })
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CmsImageView);
  }
});

const FileAttachmentView = ({ node, deleteNode }) => {
  const fileUrl = node.attrs.fileurl || '#';
  const fileName = node.attrs.filename || 'Attachment';
  const fileExt = node.attrs.fileext || fileName.split('.').pop()?.toUpperCase() || 'FILE';
  const fileSize = node.attrs.filesize || '';

  return (
    <NodeViewWrapper className="file-attachment-card rte2-file-node" contentEditable={false} data-drag-handle>
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="file-link">
        <span className="file-icon">
          <FaFile />
        </span>
        <span className="file-info">
          <span className="file-name">{fileName}</span>
          <span className="file-meta">
            {fileExt}
            {fileSize ? ` • ${fileSize} KB` : ''}
          </span>
        </span>
      </a>
      <button type="button" className="file-delete-btn" onClick={deleteNode} title="Remove file">
        <FaTrash size={10} />
      </button>
    </NodeViewWrapper>
  );
};

const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      filename: { default: '' },
      fileurl: { default: '' },
      fileext: { default: '' },
      filesize: { default: '' }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span.file-attachment-card',
        getAttrs: (element) => ({
          filename: element.getAttribute('data-filename') || '',
          fileurl: element.getAttribute('data-fileurl') || '',
          fileext: element.getAttribute('data-fileext') || '',
          filesize: element.getAttribute('data-filesize') || ''
        })
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const fileName = HTMLAttributes.filename || 'Attachment';
    const fileUrl = HTMLAttributes.fileurl || '#';
    const fileExt = HTMLAttributes.fileext || fileName.split('.').pop()?.toUpperCase() || 'FILE';
    const fileSize = HTMLAttributes.filesize || '';

    return [
      'span',
      {
        class: 'file-attachment-card',
        'data-filename': fileName,
        'data-fileurl': fileUrl,
        'data-fileext': fileExt,
        'data-filesize': fileSize,
        contenteditable: 'false'
      },
      [
        'a',
        { href: fileUrl, target: '_blank', rel: 'noopener noreferrer', class: 'file-link' },
        ['span', { class: 'file-icon' }, '📄'],
        ['span', { class: 'file-info' }, `${fileName}${fileSize ? ` (${fileSize} KB)` : ''}`]
      ]
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentView);
  }
});

const CmsCodeBlockView = ({ node, updateAttributes, deleteNode, selected }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [draftLanguage, setDraftLanguage] = useState(normalizeCodeLanguage(node.attrs.language));
  const [draftCode, setDraftCode] = useState(node.attrs.code || '');

  useEffect(() => {
    if (!showEditModal) {
      setDraftLanguage(normalizeCodeLanguage(node.attrs.language));
      setDraftCode(node.attrs.code || '');
    }
  }, [node.attrs.code, node.attrs.language, showEditModal]);

  const normalizedLanguage = useMemo(() => normalizeCodeLanguage(node.attrs.language), [node.attrs.language]);
  const codeLanguageLabel = useMemo(() => getCodeLanguageLabel(normalizedLanguage), [normalizedLanguage]);
  const prismLanguage = useMemo(() => getPrismLanguage(normalizedLanguage), [normalizedLanguage]);

  const highlightedCode = useMemo(() => highlightCodeHtml(normalizedLanguage, node.attrs.code || ''), [node.attrs.code, normalizedLanguage]);

  const applyChanges = () => {
    const nextLanguage = normalizeCodeLanguage(draftLanguage);
    updateAttributes({
      language: nextLanguage,
      code: draftCode || ''
    });
    setShowEditModal(false);
  };

  return (
    <NodeViewWrapper className={`rte2-code-block-wrapper rte2-code-node ${selected ? 'is-selected' : ''}`} data-drag-handle>
      <div className="rte2-code-header">
        <span className="rte2-code-lang">{codeLanguageLabel}</span>
        <div className="rte2-code-actions">
          <button type="button" onClick={() => setShowEditModal(true)} title="Edit code">
            Edit
          </button>
          <button type="button" onClick={deleteNode} title="Delete code block">
            Delete
          </button>
        </div>
      </div>
      <pre className="rte2-code-pre" data-language={normalizedLanguage}>
        <code className={`language-${prismLanguage}`} dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      </pre>
      {showEditModal ? (
        <div className="rte2-code-modal-backdrop" onClick={() => setShowEditModal(false)} role="dialog" aria-modal="true">
          <div className="rte2-code-modal" onClick={(event) => event.stopPropagation()}>
            <h4>Code Block Editor</h4>
            <div className="rte2-code-modal-row">
              <label htmlFor="rte2-code-language">Language</label>
              <select
                id="rte2-code-language"
                value={draftLanguage}
                onChange={(event) => setDraftLanguage(event.target.value)}
              >
                {CODE_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rte2-code-modal-editor">
              <label>Code</label>
              <div className="rte2-code-monaco">
                <Editor
                  height="320px"
                  language={getMonacoLanguage(draftLanguage)}
                  value={draftCode}
                  onChange={(value) => setDraftCode(value || '')}
                  beforeMount={configureMonacoTheme}
                  theme={RTE2_MONACO_THEME}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineHeight: 21,
                    tabSize: 2,
                    wordWrap: 'off',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    bracketPairColorization: { enabled: false },
                    guides: { bracketPairs: false },
                    matchBrackets: 'never',
                    'semanticHighlighting.enabled': false
                  }}
                />
              </div>
            </div>
            <div className="rte2-code-modal-actions">
              <button type="button" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button type="button" onClick={applyChanges}>
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </NodeViewWrapper>
  );
};

const CmsCodeBlock = Node.create({
  name: 'cmsCodeBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      language: { default: 'javascript' },
      code: { default: '' }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div.rte2-code-block-wrapper[data-code-block="cms"]',
        getAttrs: parseCodeBlockAttrs
      },
      {
        tag: 'div.rte2-code-block-wrapper',
        getAttrs: parseCodeBlockAttrs
      },
      {
        tag: 'div.code-block-wrapper[data-code-block="cms"]',
        getAttrs: parseCodeBlockAttrs
      },
      {
        tag: 'div.code-block-wrapper',
        getAttrs: parseCodeBlockAttrs
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const language = normalizeCodeLanguage(HTMLAttributes.language);
    const prismLanguage = getPrismLanguage(language);
    const code = HTMLAttributes.code || '';
    return [
      'div',
      {
        class: 'rte2-code-block-wrapper',
        'data-code-block': 'cms',
        'data-language': language,
        'data-code': code
      },
      ['pre', { class: 'rte2-code-pre', 'data-language': language }, ['code', { class: `language-${prismLanguage}` }, code]]
    ];
  },
  addCommands() {
    return {
      setCmsCodeBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs
          })
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CmsCodeBlockView);
  }
});

const CmsTable = Table.extend({
  name: 'table',
  draggable: true
});

const ToolbarButton = ({ title, active = false, onClick, disabled = false, children }) => {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={`rte2-toolbar-btn ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  );
};

const RichTextSectionEditorV2 = ({
  initialContent = '',
  initialImages = [],
  initialAttachments = [],
  sectionId = null,
  authToken,
  onChange,
  onImagesChange,
  onAttachmentsChange,
  onPendingFilesChange,
  disabled = false
}) => {
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const initialContentRef = useRef(initialContent || '<p></p>');

  const [error, setError] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showHtmlDialog, setShowHtmlDialog] = useState(false);
  const [htmlSource, setHtmlSource] = useState('');
  const [codeLanguage, setCodeLanguage] = useState(CODE_LANGUAGE_OPTIONS[0].value);
  const [codeContent, setCodeContent] = useState('');
  const [showCodeDialog, setShowCodeDialog] = useState(false);

  useEffect(() => {
    if (onImagesChange) {
      onImagesChange(initialImages || []);
    }
    if (onAttachmentsChange) {
      onAttachmentsChange(initialAttachments || []);
    }
  }, [initialAttachments, initialImages, onAttachmentsChange, onImagesChange]);

  useEffect(() => {
    setPendingFiles([]);
  }, [sectionId]);

  useEffect(() => {
    if (onPendingFilesChange) {
      onPendingFilesChange(pendingFiles);
    }
  }, [pendingFiles, onPendingFilesChange]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'rte2-link',
          target: '_blank',
          rel: 'noopener noreferrer'
        }
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      CmsTable.configure({
        resizable: true,
        allowTableNodeSelection: true,
        HTMLAttributes: {
          class: 'tiptap-table'
        }
      }),
      TableRow,
      TableHeader,
      TableCell,
      CmsImage,
      FileAttachment,
      CmsCodeBlock
    ],
    []
  );

  const emitMetadata = useCallback(
    (html) => {
      if (onChange) {
        onChange(html);
      }

      if (onImagesChange || onAttachmentsChange) {
        const container = document.createElement('div');
        container.innerHTML = html;

        if (onImagesChange) {
          const images = Array.from(container.querySelectorAll('img')).map((img, index) => ({
            id: `inline-image-${index}`,
            image_path: img.getAttribute('src') || '',
            alt_text: img.getAttribute('alt') || ''
          }));
          onImagesChange(images);
        }

        if (onAttachmentsChange) {
          const attachments = Array.from(container.querySelectorAll('.file-attachment-card')).map((node, index) => ({
            id: `inline-file-${index}`,
            file_path: node.getAttribute('data-fileurl') || '',
            filename: node.getAttribute('data-filename') || ''
          }));
          onAttachmentsChange(attachments);
        }
      }
    },
    [onAttachmentsChange, onChange, onImagesChange]
  );

  const editor = useEditor(
    {
      extensions,
      content: initialContentRef.current,
      editable: !disabled,
      onUpdate: ({ editor: nextEditor }) => {
        emitMetadata(nextEditor.getHTML());
      },
      editorProps: {
        attributes: {
          class: 'rte2-prosemirror'
        }
      }
    },
    [extensions]
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;

    const nextContent = initialContent || '<p></p>';
    if (nextContent === initialContentRef.current) return;

    initialContentRef.current = nextContent;
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, false);
    }
  }, [editor, initialContent]);

  const openHtmlEditor = () => {
    if (!editor) return;
    setHtmlSource(editor.getHTML());
    setShowHtmlDialog(true);
  };

  const applyHtmlSource = () => {
    if (!editor) return;
    try {
      editor.commands.setContent(htmlSource, true);
      setShowHtmlDialog(false);
      setError(null);
    } catch (err) {
      setError('Invalid HTML source');
    }
  };

  const openCodeDialog = () => {
    if (!editor) return;

    const selection = editor.state.selection;
    if (selection instanceof NodeSelection && selection.node.type.name === 'cmsCodeBlock') {
      setCodeLanguage(normalizeCodeLanguage(selection.node.attrs.language));
      setCodeContent(selection.node.attrs.code || '');
    } else {
      setCodeLanguage(CODE_LANGUAGE_OPTIONS[0].value);
      setCodeContent('');
    }

    setShowCodeDialog(true);
  };

  const applyCodeBlock = () => {
    if (!editor) return;

    const language = normalizeCodeLanguage(codeLanguage);
    const content = codeContent || '';
    const selection = editor.state.selection;

    if (selection instanceof NodeSelection && selection.node.type.name === 'cmsCodeBlock') {
      const position = selection.from;
      const node = selection.node;
      const transaction = editor.state.tr.setNodeMarkup(position, node.type, {
        ...node.attrs,
        language,
        code: content
      });
      editor.view.dispatch(transaction);
    } else {
      editor.chain().focus().setCmsCodeBlock({ language, code: content }).run();
    }

    setShowCodeDialog(false);
  };

  const deleteSelectedCodeBlock = () => {
    if (!editor) return;
    const selection = editor.state.selection;
    if (selection instanceof NodeSelection && selection.node.type.name === 'cmsCodeBlock') {
      editor.commands.deleteSelection();
    }
  };

  const setLink = () => {
    if (!editor) return;

    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const url = window.prompt('Enter URL');
    if (!url) return;

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertLayout = (cols) => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 1, cols, withHeaderRow: false }).run();
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size exceeds 5MB.');
      return;
    }

    try {
      setUploadingImage(true);
      setError(null);

      let src;
      if (sectionId) {
        const response = await portfolioApi.uploadImage(file, 'section', sectionId, 'section', authToken);
        const path = (response.image_path || response.path || '').replace(/^\//, '');
        src = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${path}`;
      } else {
        src = await readFileAsDataUrl(file);
      }

      editor.chain().focus().setCmsImage({ src, alt: file.name, width: '320px' }).run();
    } catch (err) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB.');
      return;
    }

    if (!sectionId) {
      setPendingFiles((prev) => [
        ...prev,
        {
          id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'pending'
        }
      ]);

      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setUploadingFile(true);
      setError(null);

      const response = await portfolioApi.uploadAttachment(file, 'section', sectionId, authToken);
      const path = (response.file_path || response.path || '').replace(/^\//, '');
      const fileUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${path}`;
      const fileExt = file.name.split('.').pop()?.toUpperCase() || 'FILE';
      const fileSize = (file.size / 1024).toFixed(1);

      editor.chain().focus().insertContent({
        type: 'fileAttachment',
        attrs: {
          filename: file.name,
          fileurl: fileUrl,
          fileext: fileExt,
          filesize: fileSize
        }
      }).run();
    } catch (err) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePendingFile = (id) => {
    setPendingFiles((prev) => prev.filter((file) => file.id !== id));
  };

  if (!editor) {
    return <div className="rte2-loading">Loading editor...</div>;
  }

  return (
    <div className="rte2-editor">
      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
      <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload} />

      <div className="rte2-toolbar">
        <div className="rte2-toolbar-group">
          <ToolbarButton title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} disabled={disabled}>
            <FaBold />
          </ToolbarButton>
          <ToolbarButton title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} disabled={disabled}>
            <FaItalic />
          </ToolbarButton>
          <ToolbarButton title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} disabled={disabled}>
            <FaUnderline />
          </ToolbarButton>
          <ToolbarButton title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} disabled={disabled}>
            <FaQuoteLeft />
          </ToolbarButton>
        </div>

        <div className="rte2-toolbar-group">
          <select
            className="rte2-select"
            value={editor.getAttributes('textStyle').fontSize || '16px'}
            onChange={(event) => editor.chain().focus().setFontSize(event.target.value).run()}
            disabled={disabled}
          >
            <option value="12px">12px</option>
            <option value="14px">14px</option>
            <option value="16px">16px</option>
            <option value="18px">18px</option>
            <option value="20px">20px</option>
            <option value="24px">24px</option>
            <option value="32px">32px</option>
          </select>

          <select
            className="rte2-select"
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                editor.chain().focus().unsetFontFamily().run();
              } else {
                editor.chain().focus().setFontFamily(value).run();
              }
            }}
            disabled={disabled}
          >
            <option value="">Default Font</option>
            <option value="'Georgia', serif">Georgia</option>
            <option value="'Times New Roman', serif">Times</option>
            <option value="'Courier New', monospace">Courier</option>
            <option value="'Arial', sans-serif">Arial</option>
          </select>

          <label className="rte2-color-input" title="Text color">
            <input
              type="color"
              value={editor.getAttributes('textStyle').color || '#ffffff'}
              onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
              disabled={disabled}
            />
          </label>

          <ToolbarButton
            title="Heading"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            disabled={disabled}
          >
            <FaHeading />
          </ToolbarButton>
        </div>

        <div className="rte2-toolbar-group">
          <ToolbarButton title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} disabled={disabled}>
            <FaAlignLeft />
          </ToolbarButton>
          <ToolbarButton title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} disabled={disabled}>
            <FaAlignCenter />
          </ToolbarButton>
          <ToolbarButton title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} disabled={disabled}>
            <FaAlignRight />
          </ToolbarButton>
          <ToolbarButton title="Justify" onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} disabled={disabled}>
            <FaAlignJustify />
          </ToolbarButton>
        </div>

        <div className="rte2-toolbar-group">
          <ToolbarButton title="Bulleted list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} disabled={disabled}>
            <FaListUl />
          </ToolbarButton>
          <ToolbarButton title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} disabled={disabled}>
            <FaListOl />
          </ToolbarButton>
          <ToolbarButton title="Set/Unset link" onClick={setLink} active={editor.isActive('link')} disabled={disabled}>
            {editor.isActive('link') ? <FaUnlink /> : <FaLink />}
          </ToolbarButton>
        </div>

        <div className="rte2-toolbar-group">
          <ToolbarButton title="Upload image" onClick={() => imageInputRef.current?.click()} disabled={disabled || uploadingImage}>
            <FaImage />
          </ToolbarButton>
          <ToolbarButton title="Upload file" onClick={() => fileInputRef.current?.click()} disabled={disabled || uploadingFile}>
            <FaFile />
          </ToolbarButton>
          <ToolbarButton title="Insert code block" onClick={openCodeDialog} disabled={disabled}>
            <FaCode />
          </ToolbarButton>
          <ToolbarButton title="Delete selected code block" onClick={deleteSelectedCodeBlock} disabled={disabled}>
            <FaTrash />
          </ToolbarButton>
        </div>

        <div className="rte2-toolbar-group">
          <ToolbarButton title="Insert 2-column layout" onClick={() => insertLayout(2)} disabled={disabled}>
            <FaTable />
            <span className="rte2-btn-label">2</span>
          </ToolbarButton>
          <ToolbarButton title="Insert 3-column layout" onClick={() => insertLayout(3)} disabled={disabled}>
            <FaTable />
            <span className="rte2-btn-label">3</span>
          </ToolbarButton>
          <ToolbarButton title="Add row" onClick={() => editor.chain().focus().addRowAfter().run()} disabled={disabled || !editor.can().addRowAfter()}>
            <FaPlus />
          </ToolbarButton>
          <ToolbarButton title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()} disabled={disabled || !editor.can().deleteRow()}>
            <FaMinus />
          </ToolbarButton>
          <ToolbarButton title="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={disabled || !editor.can().addColumnAfter()}>
            <FaPlus />
          </ToolbarButton>
          <ToolbarButton title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()} disabled={disabled || !editor.can().deleteColumn()}>
            <FaMinus />
          </ToolbarButton>
        </div>

        <div className="rte2-toolbar-group">
          <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={disabled || !editor.can().undo()}>
            <FaUndo />
          </ToolbarButton>
          <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={disabled || !editor.can().redo()}>
            <FaRedo />
          </ToolbarButton>
          <ToolbarButton title="Edit HTML" onClick={openHtmlEditor} disabled={disabled}>
            {'</>'}
          </ToolbarButton>
        </div>
      </div>

      {error ? <div className="rte2-error">{error}</div> : null}

      <div className="rte2-editor-surface">
        <EditorContent editor={editor} />
      </div>

      {pendingFiles.length > 0 ? (
        <div className="rte2-pending-files">
          <h4>Pending files (will upload on section save)</h4>
          <ul>
            {pendingFiles.map((pendingFile) => (
              <li key={pendingFile.id}>
                <span>{pendingFile.name}</span>
                <button type="button" onClick={() => removePendingFile(pendingFile.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showCodeDialog ? (
        <div className="rte2-modal-backdrop" role="dialog" aria-modal="true">
          <div className="rte2-modal rte2-modal-code">
            <h3>Code Block</h3>
            <div className="rte2-modal-grid">
              <label>
                Language
                <select value={codeLanguage} onChange={(event) => setCodeLanguage(event.target.value)}>
                  {CODE_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Code
                <div className="rte2-modal-code-editor">
                  <Editor
                    height="360px"
                    language={getMonacoLanguage(codeLanguage)}
                    value={codeContent}
                    onChange={(value) => setCodeContent(value || '')}
                    beforeMount={configureMonacoTheme}
                    theme={RTE2_MONACO_THEME}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineHeight: 22,
                      tabSize: 2,
                      wordWrap: 'off',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      bracketPairColorization: { enabled: false },
                      guides: { bracketPairs: false },
                      matchBrackets: 'never',
                      'semanticHighlighting.enabled': false
                    }}
                  />
                </div>
              </label>
            </div>
            <div className="rte2-modal-actions">
              <button type="button" onClick={() => setShowCodeDialog(false)}>
                Cancel
              </button>
              <button type="button" onClick={applyCodeBlock}>
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showHtmlDialog ? (
        <div className="rte2-modal-backdrop" role="dialog" aria-modal="true">
          <div className="rte2-modal rte2-modal-wide">
            <h3>HTML Source</h3>
            <textarea value={htmlSource} onChange={(event) => setHtmlSource(event.target.value)} rows={18} />
            <div className="rte2-modal-actions">
              <button type="button" onClick={() => setShowHtmlDialog(false)}>
                Cancel
              </button>
              <button type="button" onClick={applyHtmlSource}>
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default RichTextSectionEditorV2;
