import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import {
  Box,
  Tooltip,
  IconButton,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Typography,
} from '@mui/material';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatIndentDecreaseIcon from '@mui/icons-material/FormatIndentDecrease';
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import FormatClearIcon from '@mui/icons-material/FormatClear';
import CodeIcon from '@mui/icons-material/Code';
import HtmlIcon from '@mui/icons-material/Html';
import ImageIcon from '@mui/icons-material/Image';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Prism from 'prismjs';
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
  { value: 'bash', label: 'Bash', prism: 'bash' },
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
  sh: 'bash',
  shell: 'bash',
  xml: 'html',
  markup: 'html',
};

const sanitizeHtml = (value = '') =>
  DOMPurify.sanitize(value, {
    ADD_ATTR: [
      'class',
      'style',
      'target',
      'rel',
      'data-code-block',
      'data-language',
      'data-code',
      'width',
    ],
  });

const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

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

const highlightCodeHtml = (language, code) => {
  const source = code || '';
  const prismKey = getPrismLanguage(language);
  const grammar = Prism.languages[prismKey] || Prism.languages.javascript || Prism.languages.markup;

  if (!grammar) return escapeHtml(source);

  try {
    return Prism.highlight(source, grammar, prismKey);
  } catch (_) {
    return escapeHtml(source);
  }
};

const HighlightedCodeEditor = ({ value, onChange, language, minHeight = 260 }) => {
  const preRef = useRef(null);
  const textareaRef = useRef(null);
  const highlighted = useMemo(
    () => highlightCodeHtml(language, value || ''),
    [language, value],
  );

  const syncScroll = () => {
    if (!preRef.current || !textareaRef.current) return;
    preRef.current.scrollTop = textareaRef.current.scrollTop;
    preRef.current.scrollLeft = textareaRef.current.scrollLeft;
  };

  return (
    <Box
      sx={{
        position: 'relative',
        border: '1px solid rgba(148,163,184,0.35)',
        borderRadius: 1,
        bgcolor: '#0b1220',
        minHeight,
        overflow: 'hidden',
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        fontSize: '0.84rem',
        lineHeight: 1.55,
        '& pre': {
          m: 0,
          p: 1.5,
          minHeight,
          overflow: 'auto',
          whiteSpace: 'pre',
          pointerEvents: 'none',
        },
        '& code': {
          color: '#e5e7eb !important',
          textShadow: 'none !important',
        },
        '& textarea': {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          outline: 'none',
          resize: 'none',
          background: 'transparent',
          color: 'transparent',
          caretColor: '#e5e7eb',
          WebkitTextFillColor: 'transparent',
          p: 1.5,
          m: 0,
          overflow: 'auto',
          font: 'inherit',
          lineHeight: 'inherit',
          whiteSpace: 'pre',
          wordWrap: 'normal',
          tabSize: 2,
        },
        '& code .token.comment, & code .token.prolog, & code .token.doctype, & code .token.cdata': { color: '#6a9955 !important', fontStyle: 'italic' },
        '& code .token.punctuation': { color: '#ffd700 !important' },
        '& code .token.property, & code .token.tag, & code .token.boolean, & code .token.number, & code .token.constant, & code .token.symbol, & code .token.deleted': { color: '#b5cea8 !important' },
        '& code .token.selector, & code .token.attr-name, & code .token.string, & code .token.char, & code .token.builtin, & code .token.inserted': { color: '#ce9178 !important' },
        '& code .token.string': { color: '#ce9178 !important' },
        '& code .token.operator, & code .token.entity, & code .token.url, & code .token.variable': { color: '#d4d4d4 !important' },
        '& code .token.atrule, & code .token.attr-value, & code .token.keyword': { color: '#569cd6 !important' },
        '& code .token.function, & code .token.class-name': { color: '#dcdcaa !important' },
        '& code .token.regex, & code .token.important': { color: '#d16969 !important' },
      }}
    >
      <pre ref={preRef}>
        <code
          className={`language-${getPrismLanguage(language)}`}
          dangerouslySetInnerHTML={{ __html: highlighted || '&nbsp;' }}
        />
      </pre>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
      />
    </Box>
  );
};

const parseCodeBlockAttrs = (element) => {
  const codeElement =
    element.tagName?.toLowerCase() === 'pre'
      ? element.querySelector('code')
      : element.querySelector('pre code');

  const hasMarker = element.getAttribute('data-code-block') === 'cms';
  if (!hasMarker && !codeElement && element.tagName?.toLowerCase() !== 'pre') {
    return false;
  }

  if (element.tagName?.toLowerCase() === 'pre' && element.closest('div[data-code-block="cms"]')) {
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
    code: element.getAttribute('data-code') || codeElement?.textContent || element.textContent || '',
  };
};

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
        startWidth: currentWidth,
      };

      const onMove = (moveEvent) => {
        if (!resizeStateRef.current.active) return;
        const delta = moveEvent.clientX - resizeStateRef.current.startX;
        const nextWidth = Math.max(90, resizeStateRef.current.startWidth + delta);
        updateAttributes({ width: `${nextWidth}px` });
      };

      const onUp = () => {
        resizeStateRef.current.active = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [node.attrs.width, updateAttributes],
  );

  const width = node.attrs.width || '320px';

  return (
    <NodeViewWrapper
      className={`prose-image-node ${selected ? 'is-selected' : ''}`}
      contentEditable={false}
      data-drag-handle
    >
      <img
        src={node.attrs.src}
        alt={node.attrs.alt || ''}
        title={node.attrs.title || ''}
        className="prose-image"
        style={{ width, maxWidth: '100%', height: 'auto' }}
        draggable={false}
      />
      <button
        type="button"
        className="prose-image-remove"
        title="Remove image"
        onClick={deleteNode}
      >
        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
      </button>
      <button
        type="button"
        className="prose-image-resize"
        title="Resize image"
        aria-label="Resize image"
        onMouseDown={onResizeStart}
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
      class: { default: 'prose-image' },
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
            attrs,
          }),
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CmsImageView);
  },
});

const CmsCodeBlockView = ({ node, updateAttributes, deleteNode, selected }) => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [draftLanguage, setDraftLanguage] = useState(normalizeCodeLanguage(node.attrs.language));
  const [draftCode, setDraftCode] = useState(node.attrs.code || '');

  useEffect(() => {
    if (!showEditDialog) {
      setDraftLanguage(normalizeCodeLanguage(node.attrs.language));
      setDraftCode(node.attrs.code || '');
    }
  }, [node.attrs.code, node.attrs.language, showEditDialog]);

  const normalizedLanguage = useMemo(
    () => normalizeCodeLanguage(node.attrs.language),
    [node.attrs.language],
  );
  const codeLanguageLabel = useMemo(
    () => getCodeLanguageLabel(normalizedLanguage),
    [normalizedLanguage],
  );
  const prismLanguage = useMemo(
    () => getPrismLanguage(normalizedLanguage),
    [normalizedLanguage],
  );

  const highlightedCode = useMemo(
    () => highlightCodeHtml(normalizedLanguage, node.attrs.code || ''),
    [node.attrs.code, normalizedLanguage],
  );
  const applyChanges = () => {
    updateAttributes({
      language: normalizeCodeLanguage(draftLanguage),
      code: draftCode || '',
    });
    setShowEditDialog(false);
  };

  return (
    <NodeViewWrapper
      className={`prose-code-block ${selected ? 'is-selected' : ''}`}
      contentEditable={false}
      data-drag-handle
    >
      <div className="prose-code-header">
        <span className="prose-code-lang">{codeLanguageLabel}</span>
        <div className="prose-code-actions">
          <button type="button" title="Edit code block" onClick={() => setShowEditDialog(true)}>
            Edit
          </button>
          <button type="button" title="Delete code block" onClick={deleteNode}>
            Delete
          </button>
        </div>
      </div>
      <pre className="prose-code-pre" data-language={normalizedLanguage}>
        <code
          className={`language-${prismLanguage}`}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>

      <Dialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>Edit code block</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Language"
              value={draftLanguage}
              onChange={(event) => setDraftLanguage(event.target.value)}
            >
              {CODE_LANGUAGE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>
                Code
              </Typography>
              <HighlightedCodeEditor
                value={draftCode}
                onChange={setDraftCode}
                language={draftLanguage}
                minHeight={280}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setShowEditDialog(false)}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={applyChanges}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
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
      code: { default: '' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div.prose-code-block[data-code-block="cms"]',
        getAttrs: parseCodeBlockAttrs,
      },
      {
        tag: 'div[data-code-block="cms"]',
        getAttrs: parseCodeBlockAttrs,
      },
      {
        tag: 'pre',
        getAttrs: parseCodeBlockAttrs,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const language = normalizeCodeLanguage(HTMLAttributes.language);
    const prismLanguage = getPrismLanguage(language);
    const code = HTMLAttributes.code || '';

    return [
      'div',
      {
        class: 'prose-code-block',
        'data-code-block': 'cms',
        'data-language': language,
        'data-code': code,
      },
      ['pre', { class: 'prose-code-pre', 'data-language': language }, ['code', { class: `language-${prismLanguage}` }, code]],
    ];
  },
  addCommands() {
    return {
      setCmsCodeBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CmsCodeBlockView);
  },
});

function ProseEditor({ value = '', onChange, placeholder = 'Start writing...', readOnly = false }) {
  const [isFocused, setIsFocused] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [htmlSource, setHtmlSource] = useState('');
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState(CODE_LANGUAGE_OPTIONS[0].value);
  const [codeContent, setCodeContent] = useState('');
  const [imageUrlOpen, setImageUrlOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef(null);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      CmsImage,
      CmsCodeBlock,
    ],
    [],
  );

  const editor = useEditor(
    {
      extensions,
      content: sanitizeHtml(value || '<p></p>'),
      editable: !readOnly,
      onUpdate: ({ editor: nextEditor }) => {
        onChange?.(nextEditor.getHTML());
      },
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false),
      editorProps: {
        attributes: {
          class: 'prose-editor-content',
        },
      },
    },
    [extensions],
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    const nextHtml = sanitizeHtml(value || '<p></p>');
    if (nextHtml !== editor.getHTML()) {
      editor.commands.setContent(nextHtml, false);
    }
  }, [editor, value]);

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes('link')?.href || '';
    setLinkUrl(previous);
    setLinkOpen(true);
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkOpen(false);
  }, [editor, linkUrl]);

  const openHtmlDialog = useCallback(() => {
    if (!editor) return;
    setHtmlSource(editor.getHTML());
    setHtmlOpen(true);
  }, [editor]);

  const applyHtml = useCallback(() => {
    if (!editor) return;
    editor.commands.setContent(sanitizeHtml(htmlSource || '<p></p>'), true);
    setHtmlOpen(false);
  }, [editor, htmlSource]);

  const openCodeDialog = useCallback(() => {
    if (!editor) return;
    const selection = editor.state.selection;
    if (selection instanceof NodeSelection && selection.node.type.name === 'cmsCodeBlock') {
      setCodeLanguage(normalizeCodeLanguage(selection.node.attrs.language));
      setCodeContent(selection.node.attrs.code || '');
    } else {
      setCodeLanguage(CODE_LANGUAGE_OPTIONS[0].value);
      setCodeContent('');
    }
    setCodeDialogOpen(true);
  }, [editor]);

  const applyCodeBlock = useCallback(() => {
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
        code: content,
      });
      editor.view.dispatch(transaction);
    } else {
      editor.chain().focus().setCmsCodeBlock({ language, code: content }).run();
    }
    setCodeDialogOpen(false);
  }, [editor, codeContent, codeLanguage]);

  const deleteSelectedCodeBlock = useCallback(() => {
    if (!editor) return;
    const selection = editor.state.selection;
    if (selection instanceof NodeSelection && selection.node.type.name === 'cmsCodeBlock') {
      editor.commands.deleteSelection();
    }
  }, [editor]);

  const applyImageUrl = useCallback(() => {
    if (!editor || !imageUrl.trim()) return;
    editor.chain().focus().setCmsImage({ src: imageUrl.trim(), width: '320px' }).run();
    setImageUrl('');
    setImageUrlOpen(false);
  }, [editor, imageUrl]);

  const handleImageFileChange = useCallback(
    async (event) => {
      if (!editor) return;
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        event.target.value = '';
        return;
      }

      try {
        const src = await readFileAsDataUrl(file);
        editor.chain().focus().setCmsImage({ src, alt: file.name, width: '320px' }).run();
      } catch (_) {
      } finally {
        event.target.value = '';
      }
    },
    [editor],
  );

  const ToolBtn = ({ title, onClick, children, active = false, disabled = false }) => (
    <Tooltip title={title} enterDelay={600} arrow>
      <span>
        <IconButton
          size="small"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
          sx={{
            width: 30,
            height: 30,
            borderRadius: '6px',
            border: '1px solid',
            borderColor: active ? 'primary.main' : 'transparent',
            color: active ? 'primary.main' : 'text.secondary',
            bgcolor: active ? 'action.selected' : 'transparent',
            '&:hover': {
              bgcolor: 'action.hover',
              color: 'primary.main',
            },
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );

  const Sep = () => <Divider orientation="vertical" flexItem sx={{ mx: 0.3, my: 0.55 }} />;

  if (!editor) {
    return (
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 2,
          color: 'text.secondary',
          fontSize: '0.875rem',
        }}
      >
        Loading editor...
      </Box>
    );
  }

  return (
    <Box
      className="prose-editor-root"
      sx={{
        border: '1px solid',
        borderColor: isFocused ? 'primary.main' : 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        transition: 'border-color 0.15s ease',
        boxShadow: isFocused ? '0 0 0 2px rgba(25,118,210,0.12)' : 'none',
        overflow: 'hidden',
        '& .prose-editor-toolbar': {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0.2,
          px: 1,
          py: 0.6,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'),
        },
        '& .prose-editor-surface': {
          position: 'relative',
          px: 2.5,
          py: 2,
        },
        '& .prose-editor-content': {
          minHeight: '230px',
          outline: 'none',
          lineHeight: 1.75,
          fontSize: '0.9375rem',
          color: 'text.primary',
          wordBreak: 'break-word',
        },
        '& .prose-editor-content p': { margin: '0 0 0.75em', '&:last-child': { marginBottom: 0 } },
        '& .prose-editor-content h1': { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3, margin: '0.75em 0 0.4em' },
        '& .prose-editor-content h2': { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.35, margin: '0.75em 0 0.4em' },
        '& .prose-editor-content h3': { fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.4, margin: '0.6em 0 0.35em' },
        '& .prose-editor-content ul': { paddingLeft: '1.5rem', marginBottom: '0.75em', listStyleType: 'disc' },
        '& .prose-editor-content ol': { paddingLeft: '1.5rem', marginBottom: '0.75em', listStyleType: 'decimal' },
        '& .prose-editor-content li': { marginBottom: '0.3em', lineHeight: 1.6 },
        '& .prose-editor-content blockquote': {
          borderLeft: '3px solid',
          borderColor: 'primary.light',
          paddingLeft: '1rem',
          marginLeft: 0,
          marginRight: 0,
          marginTop: '0.75em',
          marginBottom: '0.75em',
          color: 'text.secondary',
          fontStyle: 'italic',
        },
        '& .prose-editor-content a': {
          color: 'primary.main',
          textDecoration: 'underline',
          cursor: 'pointer',
        },
        '& .prose-editor-content code': {
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
          fontSize: '0.85em',
          backgroundColor: 'rgba(0,0,0,0.06)',
          padding: '1px 5px',
          borderRadius: '3px',
          border: '1px solid rgba(0,0,0,0.08)',
        },
        '& .prose-editor-content .prose-image-node': {
          position: 'relative',
          display: 'inline-flex',
          margin: '0.75rem 0',
          border: '1px solid transparent',
          borderRadius: '0.5rem',
          maxWidth: '100%',
          cursor: 'grab',
        },
        '& .prose-editor-content .prose-image-node.is-selected': {
          borderColor: 'primary.main',
          boxShadow: '0 0 0 1px rgba(25,118,210,0.3)',
        },
        '& .prose-editor-content .prose-image': {
          display: 'block',
          margin: 0,
          borderRadius: '0.45rem',
          maxWidth: '100%',
        },
        '& .prose-editor-content .prose-image-remove': {
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          width: '1.65rem',
          height: '1.65rem',
          border: '1px solid rgba(248,113,113,0.9)',
          borderRadius: '999px',
          background: 'rgba(220,38,38,0.95)',
          color: '#f8fafc',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        '& .prose-editor-content .prose-image-resize': {
          position: 'absolute',
          right: '-0.35rem',
          bottom: '-0.35rem',
          width: '0.85rem',
          height: '0.85rem',
          border: 0,
          borderRadius: '0.22rem',
          background: '#1976d2',
          cursor: 'nwse-resize',
        },
        '& .prose-editor-content .prose-code-block': {
          margin: '0.75rem 0',
          border: '1px solid rgba(148,163,184,0.45)',
          borderRadius: '0.5rem',
          overflow: 'hidden',
        },
        '& .prose-editor-content .prose-code-block.is-selected': {
          borderColor: 'primary.main',
          boxShadow: '0 0 0 1px rgba(25,118,210,0.3)',
        },
        '& .prose-editor-content .prose-code-header': {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          background: '#111827',
          borderBottom: '1px solid rgba(148,163,184,0.35)',
          padding: '0.35rem 0.55rem',
        },
        '& .prose-editor-content .prose-code-lang': {
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: '#e5e7eb',
        },
        '& .prose-editor-content .prose-code-actions': {
          display: 'flex',
          gap: '0.45rem',
        },
        '& .prose-editor-content .prose-code-actions button': {
          border: '1px solid rgba(148,163,184,0.35)',
          borderRadius: '0.3rem',
          background: '#1f2937',
          color: '#e5e7eb',
          cursor: 'pointer',
          padding: '0.15rem 0.4rem',
          fontSize: '0.75rem',
        },
        '& .prose-editor-content .prose-code-pre': {
          margin: 0,
          padding: '0.8rem',
          background: '#020617',
          overflow: 'auto',
        },
        '& .prose-editor-content .prose-code-pre code': {
          color: '#e5e7eb',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: '0.84rem',
          lineHeight: 1.6,
          whiteSpace: 'pre',
          background: 'transparent',
          border: 'none',
          padding: 0,
        },
        '& .prose-editor-content .prose-code-pre code .token.comment, & .prose-editor-content .prose-code-pre code .token.prolog, & .prose-editor-content .prose-code-pre code .token.doctype, & .prose-editor-content .prose-code-pre code .token.cdata': {
          color: '#6a9955',
          fontStyle: 'italic',
        },
        '& .prose-editor-content .prose-code-pre code .token.punctuation': { color: '#ffd700' },
        '& .prose-editor-content .prose-code-pre code .token.property, & .prose-editor-content .prose-code-pre code .token.tag, & .prose-editor-content .prose-code-pre code .token.boolean, & .prose-editor-content .prose-code-pre code .token.number, & .prose-editor-content .prose-code-pre code .token.constant, & .prose-editor-content .prose-code-pre code .token.symbol, & .prose-editor-content .prose-code-pre code .token.deleted': {
          color: '#b5cea8',
        },
        '& .prose-editor-content .prose-code-pre code .token.selector, & .prose-editor-content .prose-code-pre code .token.attr-name, & .prose-editor-content .prose-code-pre code .token.string, & .prose-editor-content .prose-code-pre code .token.char, & .prose-editor-content .prose-code-pre code .token.builtin, & .prose-editor-content .prose-code-pre code .token.inserted': {
          color: '#ce9178',
        },
        '& .prose-editor-content .prose-code-pre code .token.operator, & .prose-editor-content .prose-code-pre code .token.entity, & .prose-editor-content .prose-code-pre code .token.url, & .prose-editor-content .prose-code-pre code .token.variable': {
          color: '#d4d4d4',
        },
        '& .prose-editor-content .prose-code-pre code .token.atrule, & .prose-editor-content .prose-code-pre code .token.attr-value, & .prose-editor-content .prose-code-pre code .token.keyword': {
          color: '#569cd6',
        },
        '& .prose-editor-content .prose-code-pre code .token.function, & .prose-editor-content .prose-code-pre code .token.class-name': {
          color: '#dcdcaa',
        },
        '& .prose-editor-content .prose-code-pre code .token.regex, & .prose-editor-content .prose-code-pre code .token.important': {
          color: '#d16969',
        },
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleImageFileChange}
      />

      <Box className="prose-editor-toolbar">
        <Select
          size="small"
          defaultValue="paragraph"
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            const value = event.target.value;
            if (value === 'paragraph') {
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().toggleHeading({ level: Number(value) }).run();
            }
          }}
          sx={{
            height: 30,
            minWidth: 120,
            fontSize: '0.8125rem',
            mr: 0.5,
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          }}
        >
          <MenuItem value="paragraph">Normal</MenuItem>
          <MenuItem value={1}>Heading 1</MenuItem>
          <MenuItem value={2}>Heading 2</MenuItem>
          <MenuItem value={3}>Heading 3</MenuItem>
        </Select>

        <Sep />

        <ToolBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <FormatBoldIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <FormatItalicIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <FormatUnderlinedIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Strike" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <StrikethroughSIcon sx={{ fontSize: 17 }} />
        </ToolBtn>

        <Sep />

        <ToolBtn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <FormatListBulletedIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <FormatListNumberedIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Decrease indent" onClick={() => editor.chain().focus().liftListItem('listItem').run()}>
          <FormatIndentDecreaseIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Increase indent" onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>
          <FormatIndentIncreaseIcon sx={{ fontSize: 17 }} />
        </ToolBtn>

        <Sep />

        <ToolBtn title="Insert/edit link" active={editor.isActive('link')} onClick={openLinkDialog}>
          <LinkIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}>
          <LinkOffIcon sx={{ fontSize: 17 }} />
        </ToolBtn>

        <Sep />

        <ToolBtn title="Insert image from file" onClick={() => fileInputRef.current?.click()} disabled={readOnly}>
          <ImageIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Insert image by URL" onClick={() => setImageUrlOpen(true)} disabled={readOnly}>
          <ImageIcon sx={{ fontSize: 17, opacity: 0.72 }} />
        </ToolBtn>
        <ToolBtn title="Insert/edit code block" onClick={openCodeDialog} disabled={readOnly}>
          <CodeIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Delete selected code block" onClick={deleteSelectedCodeBlock} disabled={readOnly}>
          <DeleteOutlineIcon sx={{ fontSize: 17 }} />
        </ToolBtn>

        <Sep />

        <ToolBtn title="Edit HTML source" onClick={openHtmlDialog} disabled={readOnly}>
          <HtmlIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={readOnly || !editor.can().undo()}>
          <UndoIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={readOnly || !editor.can().redo()}>
          <RedoIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
        <ToolBtn title="Clear marks" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} disabled={readOnly}>
          <FormatClearIcon sx={{ fontSize: 17 }} />
        </ToolBtn>
      </Box>

      <Box className="prose-editor-surface">
        {editor.isEmpty && !isFocused && (
          <Typography
            variant="body2"
            sx={{
              position: 'absolute',
              top: '2rem',
              left: '2.5rem',
              color: 'text.disabled',
              pointerEvents: 'none',
              userSelect: 'none',
              fontSize: '0.9375rem',
            }}
          >
            {placeholder}
          </Typography>
        )}
        <EditorContent editor={editor} />
      </Box>

      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>Insert link</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="URL"
            placeholder="https://"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && applyLink()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setLinkOpen(false)}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={applyLink}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={imageUrlOpen} onClose={() => setImageUrlOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>Insert image URL</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Image URL"
            placeholder="https://example.com/image.png"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && applyImageUrl()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setImageUrlOpen(false)}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={applyImageUrl} disabled={!imageUrl.trim()}>
            Insert
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={codeDialogOpen} onClose={() => setCodeDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>Code Block</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Language"
              value={codeLanguage}
              onChange={(event) => setCodeLanguage(event.target.value)}
            >
              {CODE_LANGUAGE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>
                Code
              </Typography>
              <HighlightedCodeEditor
                value={codeContent}
                onChange={setCodeContent}
                language={codeLanguage}
                minHeight={300}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setCodeDialogOpen(false)}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={applyCodeBlock}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={htmlOpen} onClose={() => setHtmlOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>Edit HTML source</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={18}
            size="small"
            label="HTML"
            value={htmlSource}
            onChange={(event) => setHtmlSource(event.target.value)}
            sx={{
              mt: 1,
              '& textarea': {
                fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                fontSize: '0.8125rem',
                lineHeight: 1.6,
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setHtmlOpen(false)}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={applyHtml}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProseEditor;
