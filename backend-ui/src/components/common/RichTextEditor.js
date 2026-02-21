import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { 
  Box, 
  Typography, 
  Divider,
  Tooltip,
  IconButton,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease';
import FormatIndentDecreaseIcon from '@mui/icons-material/FormatIndentDecrease';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import LinkIcon from '@mui/icons-material/Link';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import FormatClearIcon from '@mui/icons-material/FormatClear';
import HtmlIcon from '@mui/icons-material/Html';

/**
 * A rich text editor component that's compatible with React 19
 * Includes a formatting toolbar similar to popular WYSIWYG editors
 * Supports HTML code editing mode
 */
function RichTextEditor({ value, onChange, readOnly, placeholder, style }) {
  const [content, setContent] = useState(value || '');
  const [htmlDialogOpen, setHtmlDialogOpen] = useState(false);
  const [htmlCode, setHtmlCode] = useState('');
  const editorRef = useRef(null);
  
  useEffect(() => {
    if (value !== content) {
      setContent(value || '');
    }
  }, [value]);

  // Initialize the editor with content when component mounts
  useEffect(() => {
    if (editorRef.current && content) {
      editorRef.current.innerHTML = DOMPurify.sanitize(content);
    }
  }, []);

  const handleChange = (e) => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      setContent(newContent);
      if (onChange) {
        onChange(newContent);
      }
    }
  };

  const execCommand = (command, value = null) => {
    if (readOnly) return;
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      setContent(newContent);
      if (onChange) {
        onChange(newContent);
      }
    }
    editorRef.current.focus();
  };

  const formatText = (command) => {
    execCommand(command);
  };

  const formatBlock = (blockType) => {
    execCommand('formatBlock', blockType);
  };

  const insertList = (listType) => {
    execCommand(listType);
  };

  const alignText = (alignment) => {
    execCommand(`justify${alignment}`);
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const openHtmlEditor = () => {
    setHtmlCode(content);
    setHtmlDialogOpen(true);
  };

  const closeHtmlEditor = () => {
    setHtmlDialogOpen(false);
  };

  const applyHtmlChanges = () => {
    setContent(htmlCode);
    if (onChange) {
      onChange(htmlCode);
    }
    setHtmlDialogOpen(false);
    
    // Update the editor content after applying HTML changes
    if (editorRef.current) {
      editorRef.current.innerHTML = DOMPurify.sanitize(htmlCode);
    }
  };

  return (
    <Box sx={{ 
      ...style,
      border: '1px solid #ccc',
      borderRadius: '4px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {!readOnly && (
        <>
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            padding: '4px', 
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #ddd',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
              {/* Text formatting */}
              <Tooltip title="Bold">
                <IconButton size="small" onClick={() => formatText('bold')}>
                  <FormatBoldIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Italic">
                <IconButton size="small" onClick={() => formatText('italic')}>
                  <FormatItalicIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Underline">
                <IconButton size="small" onClick={() => formatText('underline')}>
                  <FormatUnderlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Strikethrough">
                <IconButton size="small" onClick={() => formatText('strikeThrough')}>
                  <StrikethroughSIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              
              {/* Text style */}
              <Select
                size="small"
                defaultValue="p"
                sx={{ height: '30px', minWidth: '100px', fontSize: '0.875rem' }}
                onChange={(e) => formatBlock(e.target.value)}
              >
                <MenuItem value="p">Normal</MenuItem>
                <MenuItem value="h1">Heading 1</MenuItem>
                <MenuItem value="h2">Heading 2</MenuItem>
                <MenuItem value="h3">Heading 3</MenuItem>
                <MenuItem value="h4">Heading 4</MenuItem>
                <MenuItem value="h5">Heading 5</MenuItem>
                <MenuItem value="h6">Heading 6</MenuItem>
                <MenuItem value="blockquote">Quote</MenuItem>
              </Select>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              
              {/* Lists */}
              <Tooltip title="Bullet List">
                <IconButton size="small" onClick={() => insertList('insertUnorderedList')}>
                  <FormatListBulletedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Numbered List">
                <IconButton size="small" onClick={() => insertList('insertOrderedList')}>
                  <FormatListNumberedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              
              {/* Indentation */}
              <Tooltip title="Decrease Indent">
                <IconButton size="small" onClick={() => execCommand('outdent')}>
                  <FormatIndentDecreaseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Increase Indent">
                <IconButton size="small" onClick={() => execCommand('indent')}>
                  <FormatIndentIncreaseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              
              {/* Alignment */}
              <Tooltip title="Align Left">
                <IconButton size="small" onClick={() => alignText('Left')}>
                  <FormatAlignLeftIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Align Center">
                <IconButton size="small" onClick={() => alignText('Center')}>
                  <FormatAlignCenterIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Align Right">
                <IconButton size="small" onClick={() => alignText('Right')}>
                  <FormatAlignRightIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Justify">
                <IconButton size="small" onClick={() => alignText('Full')}>
                  <FormatAlignJustifyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              
              {/* Insert Link */}
              <Tooltip title="Insert Link">
                <IconButton size="small" onClick={insertLink}>
                  <LinkIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            
            <Box sx={{ display: 'flex' }}>
              {/* HTML Edit Button */}
              <Tooltip title="Edit HTML">
                <IconButton size="small" onClick={openHtmlEditor}>
                  <HtmlIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              
              {/* Undo/Redo */}
              <Tooltip title="Undo">
                <IconButton size="small" onClick={() => execCommand('undo')}>
                  <UndoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Redo">
                <IconButton size="small" onClick={() => execCommand('redo')}>
                  <RedoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Clear Formatting">
                <IconButton size="small" onClick={() => execCommand('removeFormat')}>
                  <FormatClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </>
      )}
      
      <Box sx={{ padding: '10px', flex: 1, minHeight: '250px', maxHeight: '500px', overflow: 'auto' }}>
        {!content && placeholder && (
          <Typography 
            sx={{ 
              color: 'text.disabled',
              position: 'absolute',
              pointerEvents: 'none',
              padding: '0 10px'
            }}
          >
            {placeholder}
          </Typography>
        )}
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          onInput={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              document.execCommand('insertLineBreak');
              e.preventDefault();
            }
          }}
          style={{
            minHeight: '230px',
            outline: 'none',
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            direction: 'ltr', // Ensure left-to-right text direction
            unicodeBidi: 'embed'
          }}
        />
      </Box>
      
      {/* HTML Editor Dialog */}
      <Dialog
        open={htmlDialogOpen}
        onClose={closeHtmlEditor}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Edit HTML</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="HTML Code"
            fullWidth
            multiline
            rows={15}
            value={htmlCode}
            onChange={(e) => setHtmlCode(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeHtmlEditor}>Cancel</Button>
          <Button onClick={applyHtmlChanges} variant="contained" color="primary">
            Apply Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RichTextEditor;
