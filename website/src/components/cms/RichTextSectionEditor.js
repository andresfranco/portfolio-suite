import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Node, mergeAttributes, Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
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
  FaExclamationTriangle,
  FaTable,
  FaPlus,
  FaMinus,
  FaTrash,
  FaGripVertical,
  FaPalette,
  FaExpandAlt
} from 'react-icons/fa';
import portfolioApi from '../../services/portfolioApi';

// Resizable Image Extension with Custom NodeView and Drag Support
// This uses TipTap's NodeView API for proper integration
const SimpleImage = Node.create({
  name: 'simpleImage',
  
  group: 'block',
  
  inline: false,
  
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
      class: {
        default: 'tiptap-image',
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
      style: {
        default: 'max-width: 100%; height: auto;',
      },
      'data-component-id': {
        default: null,
        parseHTML: element => element.getAttribute('data-component-id') || `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        renderHTML: attributes => {
          return { 'data-component-id': attributes['data-component-id'] || `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }
        },
      },
      'data-component-type': {
        default: 'image',
        parseHTML: element => 'image',
        renderHTML: attributes => {
          return { 'data-component-type': 'image' }
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
          class: dom.getAttribute('class') || 'tiptap-image',
          width: dom.getAttribute('width') || dom.style.width,
          height: dom.getAttribute('height') || dom.style.height,
          style: dom.getAttribute('style') || 'max-width: 100%; height: auto;',
        }),
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },
  
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'image-resize-wrapper';
      wrapper.contentEditable = 'false';
      wrapper.draggable = true;
      wrapper.setAttribute('data-drag-handle', 'true');
      
      const img = document.createElement('img');
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || '';
      img.title = node.attrs.title || '';
      img.className = 'tiptap-image';
      
      if (node.attrs.width) {
        img.style.width = node.attrs.width;
      }
      if (node.attrs.style) {
        img.setAttribute('style', node.attrs.style);
      }
      
      wrapper.appendChild(img);
      
      // Add resize handles
      const positions = ['se', 'sw', 'ne', 'nw'];
      const handles = [];
      
      positions.forEach(position => {
        const handle = document.createElement('div');
        handle.className = `resize-handle resize-handle-${position}`;
        handle.contentEditable = 'false';
        handle.dataset.position = position;
        wrapper.appendChild(handle);
        handles.push(handle);
        
        // Handle resize
        handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // CRITICAL: Store position at resize start to avoid stale positions
          let imagePos = null;
          if (typeof getPos === 'function') {
            try {
              imagePos = getPos();
              // Validate initial position
              if (imagePos !== undefined && imagePos !== null) {
                const { state } = editor.view;
                const docSize = state.doc.content.size;
                if (imagePos < 0 || imagePos >= docSize) {
                  imagePos = null; // Invalid, will search for it later
                } else {
                  // Verify it's actually an image
                  const nodeAtPos = state.doc.nodeAt(imagePos);
                  if (!nodeAtPos || nodeAtPos.type.name !== 'simpleImage') {
                    imagePos = null; // Not an image, will search for it later
                  }
                }
              }
            } catch (err) {
              console.warn('[IMAGE RESIZE] Error getting initial position:', err);
              imagePos = null;
            }
          }
          
          // Store image identifier for fallback search
          const imageSrc = node.attrs.src;
          const imageId = node.attrs['data-component-id'];
          
          const startX = e.clientX;
          const startY = e.clientY;
          const startWidth = img.offsetWidth;
          const startHeight = img.offsetHeight;
          const aspectRatio = startWidth / startHeight;
          
          const onMouseMove = (moveEvent) => {
            let newWidth = startWidth;
            
            if (position.includes('e')) {
              newWidth = startWidth + (moveEvent.clientX - startX);
            } else if (position.includes('w')) {
              newWidth = startWidth - (moveEvent.clientX - startX);
            }
            
            newWidth = Math.max(50, newWidth);
            const newHeight = newWidth / aspectRatio;
            
            img.style.width = `${newWidth}px`;
            img.style.height = 'auto';
          };
          
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            // Update node attributes
            const newWidth = parseInt(img.style.width);
            if (!newWidth || isNaN(newWidth)) {
              console.warn('[IMAGE RESIZE] Invalid width:', img.style.width);
              return;
            }
            
            try {
              const { state } = editor.view;
              let posToUse = imagePos;
              
              // If we don't have a valid position, search for the image
              if (posToUse === null || posToUse === undefined) {
                let foundPos = null;
                state.doc.descendants((n, p) => {
                  if (n.type.name === 'simpleImage') {
                    // Match by src or data-component-id
                    const matches = (imageSrc && n.attrs.src === imageSrc) ||
                                   (imageId && n.attrs['data-component-id'] === imageId);
                    if (matches && foundPos === null) {
                      foundPos = p;
                      return false; // Stop searching
                    }
                  }
                });
                
                if (foundPos !== null && foundPos >= 0 && foundPos < state.doc.content.size) {
                  posToUse = foundPos;
                } else {
                  console.warn('[IMAGE RESIZE] Could not find image node in document');
                  return;
                }
              }
              
              // Validate position one more time before using
              const docSize = state.doc.content.size;
              if (posToUse < 0 || posToUse >= docSize) {
                console.warn('[IMAGE RESIZE] Position out of range:', posToUse, 'docSize:', docSize);
                return;
              }
              
              // Verify the node at this position is actually an image
              const nodeAtPos = state.doc.nodeAt(posToUse);
              if (!nodeAtPos || nodeAtPos.type.name !== 'simpleImage') {
                console.warn('[IMAGE RESIZE] Node at position is not an image:', nodeAtPos?.type?.name);
                return;
              }
              
              // Position is valid, update the node
              editor.view.dispatch(
                state.tr.setNodeMarkup(posToUse, null, {
                  ...node.attrs,
                  width: `${newWidth}px`,
                  style: `width: ${newWidth}px; height: auto;`,
                })
              );
            } catch (error) {
              console.error('[IMAGE RESIZE] Error updating image attributes:', error);
              // Don't throw - just log the error
            }
          };
          
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });
      });
      
      // Click to select
      wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.image-resize-wrapper').forEach(w => {
          w.classList.remove('selected');
        });
        wrapper.classList.add('selected');
      });
      
      return {
        dom: wrapper,
        contentDOM: null,
        ignoreMutation: () => true,
      };
    };
  },
  
  addCommands() {
    return {
      setImage: options => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },
});

// Enhanced TableCell with drag-and-drop support and custom styling
const DraggableTableCell = TableCell.extend({
  name: 'tableCell',  // Keep the same name to maintain compatibility with TableRow
  
  addOptions() {
    return {
      ...this.parent?.(),
      // Don't set border: none in default HTMLAttributes - let CSS handle it
      // This allows borderless tables to show dashed borders in edit mode
      HTMLAttributes: {
        style: 'background: transparent; background-color: transparent;',
      },
    }
  },
  
  addAttributes() {
    return {
      ...this.parent?.(),
      colspan: {
        default: 1,
      },
      rowspan: {
        default: 1,
      },
      colwidth: {
        default: null,
        parseHTML: element => {
          const colwidth = element.getAttribute('colwidth')
          const value = colwidth ? colwidth.split(',').map(width => parseInt(width, 10)) : null
          return value
        },
        renderHTML: attributes => {
          return {
            colwidth: attributes.colwidth ? attributes.colwidth.join(',') : null,
          }
        },
      },
      'data-cell-width': {
        default: null,
        parseHTML: element => element.getAttribute('data-cell-width'),
        renderHTML: attributes => {
          if (!attributes['data-cell-width']) return {}
          return { 'data-cell-width': attributes['data-cell-width'] }
        },
      },
      'data-background': {
        default: null,
        parseHTML: element => element.getAttribute('data-background'),
        renderHTML: attributes => {
          if (!attributes['data-background']) return {}
          return { 'data-background': attributes['data-background'] }
        },
      },
      'data-padding': {
        default: 'medium',
        parseHTML: element => element.getAttribute('data-padding') || 'medium',
        renderHTML: attributes => {
          return { 'data-padding': attributes['data-padding'] || 'medium' }
        },
      },
      'data-valign': {
        default: 'top',
        parseHTML: element => element.getAttribute('data-valign') || 'top',
        renderHTML: attributes => {
          return { 'data-valign': attributes['data-valign'] || 'top' }
        },
      },
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes.style) return {}
          return { style: attributes.style }
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'td' },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    // Start with style from node attributes if it exists (for borderless cells)
    let style = HTMLAttributes.style || '';
    
    // If this is a borderless cell (has data-borderless-cell attribute), ensure dashed borders in edit mode
    const isBorderlessCell = HTMLAttributes['data-borderless-cell'] === 'true' || 
                             node.attrs['data-borderless-cell'] === 'true';
    
    // Check if we're in edit mode by checking if editor exists and is editable
    const isEditMode = typeof window !== 'undefined' && 
                       window._tiptapEditorInstance && 
                       window._tiptapEditorInstance.isEditable;
    
    // CRITICAL: In display mode, remove border styles from the style attribute
    if (isBorderlessCell && !isEditMode) {
      // Remove border and background styles from the style string
      style = style
        .replace(/border[^;]*!important[^;]*;?/gi, '')
        .replace(/border-width[^;]*!important[^;]*;?/gi, '')
        .replace(/border-style[^;]*!important[^;]*;?/gi, '')
        .replace(/border-color[^;]*!important[^;]*;?/gi, '')
        .replace(/background-color[^;]*!important[^;]*;?/gi, '')
        .replace(/;;+/g, ';')
        .replace(/^;|;$/g, '')
        .trim();
    } else if (isBorderlessCell && isEditMode) {
      // In edit mode, add dashed border styles directly to the rendered HTML
      // This ensures borders persist through TipTap re-renders
      if (!style.includes('border') || !style.includes('dashed')) {
        style = style ? `${style}; ` : '';
        style += 'border: 1px dashed rgba(148, 163, 184, 0.5) !important; ';
        style += 'border-width: 1px !important; ';
        style += 'border-style: dashed !important; ';
        style += 'border-color: rgba(148, 163, 184, 0.5) !important; ';
        style += 'background-color: rgba(30, 41, 59, 0.1) !important;';
      }
    }
    
    // Add other cell-specific styles
    if (HTMLAttributes['data-cell-width']) {
      style += style ? ` width: ${HTMLAttributes['data-cell-width']};` : `width: ${HTMLAttributes['data-cell-width']};`;
    }
    
    // Only apply background if explicitly set (and not already in style)
    if (HTMLAttributes['data-background'] && !style.includes('background-color')) {
      style += style ? ` background-color: ${HTMLAttributes['data-background']};` : `background-color: ${HTMLAttributes['data-background']};`;
    }
    
    // Apply padding
    const padding = HTMLAttributes['data-padding'] || 'medium';
    const paddingMap = {
      none: '0',
      small: '0.375rem',
      medium: '0.75rem',
      large: '1.5rem',
    };
    if (paddingMap[padding] && !style.includes('padding')) {
      style += style ? ` padding: ${paddingMap[padding]};` : `padding: ${paddingMap[padding]};`;
    }
    
    // Apply vertical alignment
    const valign = HTMLAttributes['data-valign'] || 'top';
    if (!style.includes('vertical-align')) {
      style += style ? ` vertical-align: ${valign};` : `vertical-align: ${valign};`;
    }
    
    // Add class for borderless cells in edit mode
    const classes = [];
    if (isBorderlessCell && isEditMode) {
      classes.push('table-cell-droppable');
    }
    
    return ['td', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 
      style: style.trim() || undefined,
      class: classes.length > 0 ? classes.join(' ') : undefined,
    }), 0]
  },
  
  // Don't override the default NodeView - it interferes with drag-and-drop
  // The default rendering with renderHTML is sufficient
  
  // Add custom drag-and-drop handling for cells
  addProseMirrorPlugins() {
    return [
      // Plugin to ensure cells are editable on click
      new Plugin({
        key: new PluginKey('cellClickHandler'),
        props: {
          // CRITICAL: Use handleDOMEvents to intercept clicks BEFORE handleClick
          // This ensures we can prevent ProseMirror from processing delete button clicks
          handleDOMEvents: {
            click(view, event) {
              const target = event.target;

              // DEBUG: Log all clicks to see what's happening
              const isDeleteBtn = target && (
                  target.classList.contains('file-delete-btn') ||
                  target.closest('.file-delete-btn') !== null ||
                  target.closest('button.file-delete-btn') !== null ||
                  (target.tagName === 'svg' && target.closest('.file-delete-btn') !== null) ||
                  (target.tagName === 'path' && target.closest('.file-delete-btn') !== null)
                );

              if (isDeleteBtn) {
                console.log('[CELL CLICK] handleDOMEvents: Delete button click detected!', {
                  targetTag: target.tagName,
                  targetClass: target.className,
                  isInCell: target.closest('td, th') !== null
                });
              }

              // CRITICAL: Check if click is on a delete button or its children
              if (isDeleteBtn) {
                console.log('[CELL CLICK] handleDOMEvents: Allowing event to propagate to window handler');
                // CRITICAL: Return FALSE to allow event to propagate to window handler
                // The window-level capture handler will process the delete
                // Returning true would block the event from reaching our handler
                return false;
              }

              // For other clicks, let handleClick process them
              return false;
            }
          },
          handleClick(view, pos, event) {
            const target = event.target;

            console.log('[HANDLE CLICK] pos:', pos, 'target:', target, 'target.tagName:', target?.tagName);

            // CRITICAL: Ignore clicks on interactive elements that have their own handlers
            // This includes delete buttons, resize handles, links, etc.
            if (target) {
              // Check if click is on a delete button or its children
              if (target.classList.contains('file-delete-btn') ||
                  target.closest('.file-delete-btn') !== null ||
                  target.closest('button.file-delete-btn') !== null) {
                console.log('[CELL CLICK] handleClick: Delete button clicked - calling handler directly');

                // CRITICAL: Since event propagation doesn't work reliably from inside cells,
                // call the handler directly from our global reference
                if (window._fileDeleteDelegatedHandler) {
                  console.log('[CELL CLICK] Invoking window._fileDeleteDelegatedHandler directly');
                  window._fileDeleteDelegatedHandler(event);
                } else {
                  console.error('[CELL CLICK] ❌ window._fileDeleteDelegatedHandler not found!');
                }

                // Return true to tell ProseMirror we handled it
                return true;
              }

              // Check if click is on a code block delete button
              if (target.classList.contains('code-block-delete-btn') ||
                  target.closest('.code-block-delete-btn') !== null) {
                console.log('[CELL CLICK] handleClick: Code block delete button clicked - handling directly');

                // Find the code block wrapper
                const wrapper = target.closest('.code-block-wrapper');
                if (wrapper) {
                  console.log('[CODE BLOCK DELETE] Found wrapper, deleting code block');

                  // Find and delete the customCodeBlock node in ProseMirror
                  const { state } = view;
                  const codeBlockId = wrapper.getAttribute('data-component-id');

                  console.log('[CODE BLOCK DELETE] Looking for code block with ID:', codeBlockId);

                  // Search for the customCodeBlock node
                  let nodePos = null;
                  state.doc.descendants((node, pos) => {
                    if (node.type.name === 'customCodeBlock') {
                      const nodeId = node.attrs['data-component-id'];
                      console.log('[CODE BLOCK DELETE] Found customCodeBlock at pos', pos, 'with ID:', nodeId);

                      if (codeBlockId && nodeId === codeBlockId) {
                        nodePos = pos;
                        console.log('[CODE BLOCK DELETE] Match found at position:', pos);
                        return false; // Stop searching
                      }
                    }
                  });

                  if (nodePos !== null) {
                    console.log('[CODE BLOCK DELETE] Deleting node at position:', nodePos);
                    const tr = state.tr.delete(nodePos, nodePos + 1);
                    view.dispatch(tr);
                    console.log('[CODE BLOCK DELETE] ✅ Code block deleted successfully');
                  } else {
                    console.error('[CODE BLOCK DELETE] ❌ Could not find code block node');
                  }
                }

                // Return true to tell ProseMirror we handled it
                return true;
              }

              // Check if click is on a code block wrapper (for editing) but NOT on delete button
              const codeBlockWrapper = target.closest('.code-block-wrapper');
              if (codeBlockWrapper && !target.closest('.code-block-delete-btn')) {
                console.log('[CELL CLICK] handleClick: Code block clicked - calling handler directly for editing');

                // CRITICAL: Since event propagation doesn't work reliably from inside cells,
                // call the handler directly from our global reference
                if (window._codeBlockClickHandler) {
                  console.log('[CELL CLICK] Invoking window._codeBlockClickHandler directly');
                  window._codeBlockClickHandler(event);
                } else {
                  console.error('[CELL CLICK] ❌ window._codeBlockClickHandler not found!');
                }

                // Return true to tell ProseMirror we handled it
                return true;
              }

              // Check if click is on a link
              if (target.tagName === 'A' || target.closest('a') !== null) {
                // Only ignore if it's not the file link (file links should work)
                const link = target.closest('a');
                if (link && link.classList.contains('file-link')) {
                  // File link - let it handle normally
                  return false;
                }
              }
              
              // Ignore clicks on resize handles
              if (target.classList.contains('resize-handle-cell') || 
                  target.closest('.resize-handle-cell') !== null ||
                  target.closest('.table-resize-handles-overlay') !== null) {
                return false; // Let resize handle handle it
              }
              
              // Ignore clicks on image resize handles
              if (target.closest('.image-resize-wrapper .resize-handle') !== null) {
                return false;
              }
              
              // Ignore clicks on code block buttons
              if (target.closest('.code-block-actions') !== null ||
                  target.closest('button[data-code-action]') !== null) {
                return false;
              }
            }
            
            const { state, dispatch } = view;
            const $pos = state.doc.resolve(pos);

            console.log('[HANDLE CLICK] $pos.depth:', $pos.depth);

            // Check if click is on a table cell
            for (let depth = $pos.depth; depth > 0; depth--) {
              const node = $pos.node(depth);
              console.log('[HANDLE CLICK] depth:', depth, 'node.type.name:', node.type.name);
              if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                console.log('[HANDLE CLICK] Found table cell at depth:', depth);
                const cellPos = $pos.before(depth);
                const cellNode = state.doc.nodeAt(cellPos);
                
                if (cellNode) {
                  // Ensure cell has content (paragraph)
                  const cellContent = cellNode.content;
                  
                  // If cell is completely empty, insert a paragraph and position cursor
                  if (cellContent.childCount === 0) {
                    const cellStart = cellPos + 1;
                    const paragraph = state.schema.nodes.paragraph.create();
                    const tr = state.tr.insert(cellStart, paragraph);
                    const paragraphStart = cellStart + 1; // Position inside the paragraph
                    const newSelection = TextSelection.create(tr.doc, paragraphStart);
                    tr.setSelection(newSelection);
                    dispatch(tr);
                    // Small delay to ensure DOM is updated
                    setTimeout(() => {
                      view.focus();
                    }, 0);
                    return true; // Handled
                  }
                  
                  // If cell only has empty paragraph, position cursor inside it
                  if (cellContent.childCount === 1 && 
                      cellContent.firstChild.type.name === 'paragraph' && 
                      cellContent.firstChild.content.size === 0) {
                    const cellStart = cellPos + 1;
                    const paragraphStart = cellStart + 1; // After the paragraph opening tag
                    const tr = state.tr.setSelection(TextSelection.create(state.doc, paragraphStart));
                    dispatch(tr);
                    // Small delay to ensure DOM is updated
                    setTimeout(() => {
                      view.focus();
                    }, 0);
                    return true; // Handled
                  }

                  // Cell has content - let ProseMirror handle focus and selection normally
                  // Don't interfere with default behavior
                  console.log('[HANDLE CLICK] Cell has content - returning false to let ProseMirror handle selection');
                  return false;
                }
                break;
              }
            }

            // Not in table cell - let ProseMirror handle it naturally
            console.log('[HANDLE CLICK] Not in table cell - letting ProseMirror handle naturally');
            return false;
          },
        },
      }),
      // High-priority plugin to handle drag events
      new Plugin({
        key: new PluginKey('cellDragDrop'),
        // Use view.dom to attach native event listeners directly
        view(editorView) {
          console.log('[DRAG-NATIVE] 🚀 Plugin view() called - installing listeners on:', editorView.dom.className);
          
          let dragOverCount = 0;
          
          const handleDragOver = (event) => {
            dragOverCount++;
            const cell = event.target.closest('td, th');
            const table = event.target.closest('table');
            
            // Always prevent default on tables
            if (table) {
              event.preventDefault();
              event.stopPropagation();
              
              if (dragOverCount === 1 || dragOverCount % 50 === 0) {
                console.log('[DRAG-NATIVE] ✅ dragover #' + dragOverCount, {
                  hasCell: !!cell,
                  hasTable: !!table,
                  target: event.target.tagName,
                  cellTag: cell ? cell.tagName : 'none'
                });
              }
            } else {
              // Even if not over table, prevent default to allow drops
              event.preventDefault();
            }
          };

          const handleDrop = (event) => {
            console.log('[DRAG-NATIVE] ✅✅✅ DROP EVENT FIRED!', {
              target: event.target.tagName,
              targetClass: event.target.className
            });
            
            const cell = event.target.closest('td, th');
            if (cell) {
              console.log('[DRAG-NATIVE] Drop in cell, letting TipTap handle it');
              
              // Re-enable onChange after drop completes
              setTimeout(() => {
                window._tiptapDragging = false;
                console.log('[DRAG-NATIVE] onChange RE-ENABLED after drop');
                
                // Ensure transparency after drop
                const table = cell.closest('table');
                if (table && table.classList.contains('borderless')) {
                  table.style.background = 'transparent';
                  table.style.backgroundColor = 'transparent';
                  const cells = table.querySelectorAll('td, th');
                  cells.forEach(c => {
                    c.style.background = 'transparent';
                    c.style.backgroundColor = 'transparent';
                  });
                  console.log('[DRAG-NATIVE] Applied transparency');
                }
              }, 200);
            } else {
              // Drop outside cell, re-enable immediately
              window._tiptapDragging = false;
            }
          };

          const handleDragStart = (event) => {
            dragOverCount = 0;
            const target = event.target;
            
            // Set global flag to prevent editor onChange during drag
            window._tiptapDragging = true;
            
            console.log('[DRAG-NATIVE] 🎯 Drag started, onChange will be BLOCKED');
            console.log('[DRAG-NATIVE] From:', {
              tag: target.tagName,
              class: target.className
            });
          };

          const handleDragEnd = (event) => {
            // Always re-enable onChange when drag ends (safety fallback)
            window._tiptapDragging = false;
            console.log('[DRAG-NATIVE] Drag ended, onChange RE-ENABLED');
          };

          // Test that event listeners work
          const testListener = () => {
            console.log('[DRAG-NATIVE] Test: DOM listeners ARE working!');
          };
          editorView.dom.addEventListener('click', testListener, { once: true });

          // Attach native listeners at capture phase (before TipTap)
          editorView.dom.addEventListener('dragstart', handleDragStart, true);
          editorView.dom.addEventListener('dragover', handleDragOver, true);
          editorView.dom.addEventListener('drop', handleDrop, true);
          editorView.dom.addEventListener('dragend', handleDragEnd, true);

          console.log('[DRAG-NATIVE] ✅ Native drag handlers installed on', editorView.dom);

          return {
            destroy() {
              editorView.dom.removeEventListener('click', testListener);
              editorView.dom.removeEventListener('dragstart', handleDragStart, true);
              editorView.dom.removeEventListener('dragover', handleDragOver, true);
              editorView.dom.removeEventListener('drop', handleDrop, true);
              editorView.dom.removeEventListener('dragend', handleDragEnd, true);
              console.log('[DRAG-NATIVE] ❌ Native drag handlers removed');
            }
          };
        },
        props: {
          handleDOMEvents: {
            // Log drag start for debugging and store what's being dragged
            dragstart: (view, event) => {
              const target = event.target;
              // Reset logging flags for this drag operation
              window._dragOverLogged = false;
              window._dragOverNoCell = false;
              
              // Store the dragged element for manual drop handling
              const draggedElement = target.closest('[data-component-type], img, .code-block-wrapper');
              if (draggedElement) {
                // Get the HTML of what's being dragged
                window._draggedContent = draggedElement.outerHTML;
                window._draggedElement = draggedElement;
                console.log('[DRAG] Starting drag from:', target.tagName, target.className, 'Content stored:', window._draggedContent.substring(0, 100));
              } else {
                window._draggedContent = null;
                window._draggedElement = null;
                console.log('[DRAG] Starting drag from:', target.tagName, target.className, '(no content to store)');
              }
              
              // Set the global flag to block onChange
              window._tiptapDragging = true;
              return false; // Don't interfere
            },
            
            // When entering a cell while dragging, highlight it
            dragenter: (view, event) => {
              const cell = event.target.closest('td, th');
              if (cell && cell.classList.contains('table-cell-droppable')) {
                cell.classList.add('drag-over');
                console.log('[DRAG] Entered cell');
              }
              return false; // Don't block the event
            },
            
            // When leaving a cell while dragging, remove highlight
            dragleave: (view, event) => {
              const cell = event.target.closest('td, th');
              if (cell && cell.classList.contains('table-cell-droppable')) {
                const relatedTarget = event.relatedTarget;
                if (!relatedTarget || !cell.contains(relatedTarget)) {
                  cell.classList.remove('drag-over');
                  console.log('[DRAG] Left cell');
                }
              }
              return false; // Don't block the event
            },
            
            // CRITICAL: Allow drops by preventing default
            dragover: (view, event) => {
              // Check if we're over a table cell (any table cell) - check parent chain
              const cell = event.target.closest('td, th');
              const table = event.target.closest('table');
              
              // CRITICAL: ALWAYS preventDefault if we have stored content - this is REQUIRED for drop to fire
              if (window._draggedContent) {
                event.preventDefault();
                event.stopPropagation(); // Stop propagation to ensure our handler processes it
                event.dataTransfer.dropEffect = 'move'; // Set drop effect
                
                // Add visual feedback for drag-over
                if (cell) {
                  // Remove drag-over from all cells first
                  document.querySelectorAll('.ProseMirror td.drag-over, .ProseMirror th.drag-over').forEach(c => {
                    c.classList.remove('drag-over');
                  });
                  // Add to current cell
                  cell.classList.add('drag-over');
                }
                
                // Only log once per drag operation to avoid spam
                if (!window._dragOverLogged && cell) {
                  window._dragOverLogged = true;
                  const hasDroppableClass = cell.classList.contains('table-cell-droppable');
                  const isBorderless = table && table.classList.contains('borderless');
                  
                  console.log('[DRAG] ✅ dragover working! Cell details:', {
                    hasDroppableClass,
                    isBorderless,
                    cellClasses: cell.className,
                    targetTag: event.target.tagName,
                    cellTag: cell.tagName,
                    hasStoredContent: !!window._draggedContent
                  });
                }
                
                return true; // Handled - prevent other handlers
              } else if (cell || table) {
                // Also preventDefault for any table/cell to allow normal TipTap drops
                event.preventDefault();
                return false; // Let TipTap handle it
              } else {
                // Remove drag-over class when not over a cell
                document.querySelectorAll('.ProseMirror td.drag-over, .ProseMirror th.drag-over').forEach(c => {
                  c.classList.remove('drag-over');
                });
                return false;
              }
            },
            
            // Manual drop handler - use TipTap commands to move content
            drop: (view, event) => {
              console.log('[DRAG-PLUGIN] 🔵🔵🔵 DROP event in ProseMirror plugin!');
              const cell = event.target.closest('td, th');
              console.log('[DRAG-PLUGIN] Cell:', cell ? 'found (' + cell.tagName + ')' : 'not found', 'hasContent:', !!window._draggedContent);
              
              // Check if we have stored content to move
              if (window._draggedContent && cell) {
                event.preventDefault();
                event.stopPropagation();
                console.log('[DRAG-PLUGIN] 🎯 Processing manual drop with stored content');
                
                // Get the editor instance from global storage
                const editorInstance = window._tiptapEditorInstance;
                if (!editorInstance || editorInstance.isDestroyed) {
                  console.error('[DRAG] Editor instance not available or destroyed');
                  window._tiptapDragging = false;
                  window._draggedContent = null;
                  window._draggedElement = null;
                  return true; // Handled
                }
                
                // Find the position in the target cell
                // First, try to find the cell position in the document
                const { state } = view;
                if (!state || !state.doc) {
                  console.error('[DRAG] View state or doc not available');
                  window._tiptapDragging = false;
                  window._draggedContent = null;
                  window._draggedElement = null;
                  return true; // Handled
                }
                
                const docSize = state.doc.content.size;
                let targetCellPos = null;
                let insertPos = null;
                
                // Find the cell node that matches the DOM cell
                try {
                  state.doc.descendants((node, pos) => {
                    // Guard: ensure position is valid
                    if (pos < 0 || pos >= docSize) {
                      return false;
                    }
                    
                    if (node.type.name === 'tableCell' && targetCellPos === null) {
                      try {
                        const domNode = view.nodeDOM(pos);
                        if (domNode && (domNode === cell || cell.contains(domNode))) {
                          targetCellPos = pos;
                          // Find the first paragraph in the cell to insert after
                          node.descendants((pNode, pPos) => {
                            if (pNode.type.name === 'paragraph' && insertPos === null) {
                              const calculatedPos = pos + pPos + 1;
                              if (calculatedPos >= 0 && calculatedPos < docSize) {
                                insertPos = calculatedPos;
                              }
                              return false; // Stop searching
                            }
                          });
                          // If no paragraph found, insert at cell start
                          if (insertPos === null) {
                            const calculatedPos = pos + 1;
                            if (calculatedPos >= 0 && calculatedPos < docSize) {
                              insertPos = calculatedPos;
                            }
                          }
                          return false; // Stop searching
                        }
                      } catch (err) {
                        console.warn('[DRAG] Error accessing node DOM:', err);
                        return false;
                      }
                    }
                  });
                } catch (err) {
                  console.error('[DRAG] Error finding cell position:', err);
                  window._tiptapDragging = false;
                  window._draggedContent = null;
                  window._draggedElement = null;
                  cell.classList.remove('drag-over');
                  return true; // Handled
                }
                
                console.log('[DRAG] Target cell position:', targetCellPos, 'Insert position:', insertPos);
                
                if (insertPos === null) {
                  console.warn('[DRAG] Could not find cell position, using DOM fallback');
                  // Fallback: Use DOM manipulation
                  const cellContent = cell.querySelector('p') || cell;
                  if (cellContent) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = window._draggedContent;
                    while (tempDiv.firstChild) {
                      cellContent.appendChild(tempDiv.firstChild);
                    }
                    if (window._draggedElement && window._draggedElement.parentNode) {
                      window._draggedElement.remove();
                    }
                    console.log('[DRAG] ✅ Content moved via DOM fallback');
                  }
                  window._tiptapDragging = false;
                  return true;
                }
                
                try {
                  // Guard: ensure insert position is valid
                  if (insertPos === null || insertPos < 0 || insertPos >= docSize) {
                    console.warn('[DRAG] Invalid insert position:', insertPos, 'docSize:', docSize);
                    window._tiptapDragging = false;
                    window._draggedContent = null;
                    window._draggedElement = null;
                    cell.classList.remove('drag-over');
                    return true; // Handled
                  }
                  
                  // Find and remove the original content FIRST (before insertion to avoid position shifts)
                  let originalNodePos = null;
                  if (window._draggedElement && editorInstance.view && editorInstance.view.state) {
                    try {
                      const { state: currentState } = editorInstance.view.state;
                      if (currentState && currentState.doc) {
                        currentState.doc.descendants((node, pos) => {
                          // Guard: ensure position is valid
                          if (pos < 0 || pos >= currentState.doc.content.size) {
                            return false;
                          }
                          
                          if (node.type.name === 'image' || node.type.name === 'customCodeBlock') {
                            try {
                              const domNode = editorInstance.view.nodeDOM(pos);
                              if (domNode === window._draggedElement || domNode?.contains(window._draggedElement)) {
                                originalNodePos = pos;
                                return false;
                              }
                            } catch (err) {
                              console.warn('[DRAG] Error accessing node DOM for original:', err);
                              return false;
                            }
                          }
                        });
                      }
                    } catch (err) {
                      console.warn('[DRAG] Error finding original node:', err);
                    }
                  }
                  
                  console.log('[DRAG] Original node position:', originalNodePos, 'Insert at:', insertPos);
                  
                  // Get original node size BEFORE removal (for position adjustment)
                  let originalNodeSize = 0;
                  let adjustedInsertPos = insertPos;
                  if (originalNodePos !== null && originalNodePos >= 0 && originalNodePos < docSize) {
                    try {
                      const { state: currentState } = editorInstance.view.state;
                      if (currentState && currentState.doc) {
                        const originalNode = currentState.doc.nodeAt(originalNodePos);
                        if (originalNode) {
                          originalNodeSize = originalNode.nodeSize;
                          // Adjust insert position if original is before target
                          if (originalNodePos < insertPos) {
                            adjustedInsertPos = Math.max(0, insertPos - originalNodeSize);
                            console.log('[DRAG] Adjusted insert position from', insertPos, 'to', adjustedInsertPos, '(original node size:', originalNodeSize + ')');
                          }
                        }
                      }
                    } catch (err) {
                      console.warn('[DRAG] Error getting original node size:', err);
                    }
                  }
                  
                  // Guard: ensure adjusted insert position is valid
                  if (adjustedInsertPos < 0 || adjustedInsertPos >= docSize) {
                    console.warn('[DRAG] Invalid adjusted insert position:', adjustedInsertPos, 'docSize:', docSize);
                    adjustedInsertPos = Math.max(0, Math.min(adjustedInsertPos, docSize - 1));
                  }
                  
                  // Remove original content first if it exists
                  if (originalNodePos !== null && originalNodePos >= 0 && originalNodePos < docSize) {
                    try {
                      editorInstance.chain()
                        .focus()
                        .setTextSelection(originalNodePos)
                        .deleteSelection()
                        .run();
                      console.log('[DRAG] ✅ Original content removed via TipTap at position', originalNodePos);
                    } catch (err) {
                      console.warn('[DRAG] Failed to remove via TipTap, will use DOM fallback:', err);
                    }
                  }
                  
                  // Insert the content at the target position
                  try {
                    editorInstance.chain()
                      .focus()
                      .setTextSelection(adjustedInsertPos)
                      .insertContent(window._draggedContent)
                      .run();
                    
                    console.log('[DRAG] ✅ Content inserted at position', adjustedInsertPos);
                  } catch (err) {
                    console.error('[DRAG] Error inserting content:', err);
                    throw err;
                  }
                  
                  // Fallback: Remove via DOM if TipTap removal didn't work
                  if (window._draggedElement && window._draggedElement.parentNode) {
                    setTimeout(() => {
                      window._draggedElement.remove();
                      console.log('[DRAG] ✅ Original content removed via DOM (cleanup)');
                    }, 50);
                  }
                  
                } catch (error) {
                  console.error('[DRAG] Error moving content:', error);
                  // Fallback: Direct DOM manipulation
                  const cellContent = cell.querySelector('p') || cell;
                  if (cellContent) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = window._draggedContent;
                    while (tempDiv.firstChild) {
                      cellContent.appendChild(tempDiv.firstChild);
                    }
                    if (window._draggedElement && window._draggedElement.parentNode) {
                      window._draggedElement.remove();
                    }
                    console.log('[DRAG] ✅ Content moved via DOM fallback (error recovery)');
                  }
                }
                
                // Cleanup
                window._draggedContent = null;
                window._draggedElement = null;
                cell.classList.remove('drag-over');
                
                // Reset flag
                setTimeout(() => {
                  window._tiptapDragging = false;
                  console.log('[DRAG] Flag reset after manual drop');
                }, 100);
                
                // Ensure table stays transparent
                setTimeout(() => {
                  const table = cell.closest('table');
                  if (table && table.classList.contains('borderless')) {
                    table.style.background = 'transparent';
                    table.style.backgroundColor = 'transparent';
                    table.style.border = 'none';
                    
                    const cells = table.querySelectorAll('td, th');
                    cells.forEach(c => {
                      c.style.background = 'transparent';
                      c.style.backgroundColor = 'transparent';
                      c.style.border = 'none';
                    });
                    console.log('[DRAG] Re-applied transparent styles');
                  }
                }, 200);
                
                return true; // Handled
              } else {
                // No stored content or not dropping in cell - let TipTap handle it
                console.log('[DRAG] No stored content or not in cell, letting TipTap handle');
                
                setTimeout(() => {
                  window._tiptapDragging = false;
                  console.log('[DRAG] Flag reset after drop (ProseMirror handler)');
                }, 100);
                
                if (cell) {
                  cell.classList.remove('drag-over');
                }
                
                return false; // Let TipTap handle
              }
            },
            
            // Cleanup on drag end
            dragend: (view, event) => {
              console.log('[DRAG] ⚫ Drag ended (ProseMirror handler)');
              
              // Reset the drag flag
              window._tiptapDragging = false;
              
              // Reset logging flags
              window._dragOverLogged = false;
              window._dragOverNoCell = false;
              
              const cells = document.querySelectorAll('.drag-over');
              cells.forEach(cell => cell.classList.remove('drag-over'));
              
              // Final transparency check
              setTimeout(() => {
                const tables = document.querySelectorAll('table.borderless');
                tables.forEach(table => {
                  table.style.background = 'transparent';
                  table.style.backgroundColor = 'transparent';
                  table.style.border = 'none';
                  
                  const cells = table.querySelectorAll('td, th');
                  cells.forEach(c => {
                    c.style.background = 'transparent';
                    c.style.backgroundColor = 'transparent';
                    c.style.border = 'none';
                  });
                });
                console.log('[DRAG] Final transparency check complete');
              }, 300);
              
              return false; // Don't block the event
            },
          },
        },
      }),
    ];
  },
});

// Enhanced Table with resizable columns and borderless mode
const ResizableTable = Table.extend({
  name: 'table',  // Keep the same name to maintain compatibility
  
  addOptions() {
    return {
      ...this.parent?.(),
      // Override default table HTML attributes to remove backgrounds
      HTMLAttributes: {
        class: 'tiptap-table',
        style: 'border: none; background: transparent; background-color: transparent;',
      },
    }
  },
  
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-columns': {
        default: null,
        parseHTML: element => element.getAttribute('data-columns'),
        renderHTML: attributes => {
          if (!attributes['data-columns']) return {}
          return { 'data-columns': attributes['data-columns'] }
        },
      },
      class: {
        default: 'tiptap-table',
        parseHTML: element => element.getAttribute('class'),
        renderHTML: attributes => {
          return { class: attributes.class || 'tiptap-table' }
        },
      },
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          // For borderless tables, force transparent style
          const hasClass = attributes.class || '';
          if (hasClass.includes('borderless')) {
            return { 
              style: 'border: none; background: transparent; background-color: transparent;'
            }
          }
          return attributes.style ? { style: attributes.style } : {}
        },
      },
    }
  },
  
  renderHTML({ HTMLAttributes }) {
    // Force inline transparent styles for borderless tables
    const attrs = { ...HTMLAttributes };
    if (attrs.class && attrs.class.includes('borderless')) {
      attrs.style = 'border: none; background: transparent; background-color: transparent;';
    }
    return ['table', mergeAttributes(this.options.HTMLAttributes, attrs), ['tbody', 0]]
  },
  
  // Override commands to prevent table deletion
  addCommands() {
    return {
      ...this.parent?.(),
      // CRITICAL: Override deleteTable command to prevent accidental deletion from Enter key
      deleteTable: () => ({ state, dispatch }) => {
        // Allow deletion - the Enter key handler will prevent it at the keyboard level
        // This allows the delete button to work while Enter key is blocked
        return this.parent?.()?.deleteTable?.() || false;
      },
    };
  },
  
  // Override keyboard shortcuts to prevent table deletion on Enter
  addKeyboardShortcuts() {
    return {
      // CRITICAL: Override Enter key to prevent table deletion
      // Must return true to prevent default behavior
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        
        // Check if we're in a table cell
        let inTableCell = false;
        let cellPos = null;
        
        for (let depth = selection.$anchor.depth; depth > 0; depth--) {
          const node = selection.$anchor.node(depth);
          if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
            inTableCell = true;
            cellPos = selection.$anchor.before(depth);
            break;
          } else if (node.type.name === 'table') {
            inTableCell = true;
            break;
          }
        }
        
        if (inTableCell) {
          // CRITICAL: In a table cell - ALWAYS prevent default Enter behavior
          // TipTap's default behavior can delete tables, so we must override it
          if (cellPos !== null) {
            const cellNode = state.doc.nodeAt(cellPos);
            if (cellNode) {
              // Get the current selection position within the cell
              const selectionPos = selection.$anchor.pos;
              const cellStart = cellPos + 1;
              
              // Check if we're at the end of the cell or in an empty paragraph
              const cellContent = cellNode.content;
              const isAtEnd = selectionPos >= cellPos + cellNode.nodeSize - 3;
              const isEmptyParagraph = cellContent.childCount === 1 && 
                                       cellContent.firstChild.type.name === 'paragraph' && 
                                       cellContent.firstChild.content.size === 0;
              
              if (isAtEnd || isEmptyParagraph) {
                // At end or in empty paragraph - create new paragraph
                editor.chain()
                  .focus()
                  .insertContent('<p></p>')
                  .run();
              } else {
                // In middle of content - insert hard break
                editor.chain()
                  .focus()
                  .insertContent('<br>')
                  .run();
              }
              return true; // CRITICAL: Always return true to prevent default behavior
            }
          }
          // Fallback: prevent default to avoid table deletion
          return true;
        }
        
        return false; // Not in table, let default handler
      },
    };
  },
  
});

// Custom Code Block extension that preserves Prism highlighting
// Custom File Attachment Extension - Makes file cards isolated nodes
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
      filesize: { default: '' },
      'data-component-id': {
        default: null,
        parseHTML: element => element.getAttribute('data-component-id') || `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        renderHTML: attributes => {
          return { 'data-component-id': attributes['data-component-id'] || `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }
        },
      },
      'data-component-type': {
        default: 'file',
        parseHTML: element => 'file',
        renderHTML: attributes => {
          return { 'data-component-type': 'file' }
        },
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'span.file-attachment-card',
        getAttrs: dom => ({
          filename: dom.getAttribute('data-filename') || '',
          fileurl: dom.getAttribute('data-fileurl') || '',
          fileext: dom.getAttribute('data-fileext') || '',
          filesize: dom.getAttribute('data-filesize') || '',
        }),
      },
    ];
  },
  
  renderHTML({ node }) {
    const { filename, fileurl, fileext, filesize } = node.attrs;
    const componentId = node.attrs['data-component-id'] || `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Use DOM manipulation instead of nested arrays for complex HTML
    const span = document.createElement('span');
    span.className = 'file-attachment-card';
    span.contentEditable = 'false';
    span.draggable = true;
    span.setAttribute('data-drag-handle', 'true');
    span.setAttribute('data-component-id', componentId); // CRITICAL: Set component ID for deletion
    span.setAttribute('data-filename', filename);
    span.setAttribute('data-fileurl', fileurl);
    span.setAttribute('data-fileext', fileext);
    span.setAttribute('data-filesize', filesize);
    
    // Build the inner HTML - CRITICAL: Delete button must be OUTSIDE the <a> tag
    span.innerHTML = `
      <a href="${fileurl}" download="${filename}" target="_blank" class="file-link">
        <span class="file-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </span>
        <span class="file-info">
          <span class="file-name">${filename}</span>
          <span class="file-ext">${fileext}</span>
          <span class="file-size">${filesize} KB</span>
        </span>
      </a>
      <button class="file-delete-btn" type="button" title="Remove file">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      </button>
    `;
    
    // NOTE: Handler attachment is done by MutationObserver and addDeleteButtonsToExistingFiles
    // We don't attach handlers here because renderHTML is called on every re-render,
    // which would cause infinite loops
    
    // Return as DOM element spec
    return {
      dom: span,
      contentDOM: null,
    };
  },
});

const CustomCodeBlock = Node.create({
  name: 'customCodeBlock',
  group: 'block',
  atom: true,
  draggable: true,
  
  addAttributes() {
    return {
      language: {
        default: 'javascript',
      },
      code: {
        default: '',
      },
      'data-component-id': {
        default: null,
        parseHTML: element => element.getAttribute('data-component-id') || `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        renderHTML: attributes => {
          return { 'data-component-id': attributes['data-component-id'] || `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }
        },
      },
      'data-component-type': {
        default: 'code',
        parseHTML: element => 'code',
        renderHTML: attributes => {
          return { 'data-component-type': 'code' }
        },
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
    wrapper.setAttribute('data-component-id', node.attrs['data-component-id'] || `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    wrapper.draggable = true;
    wrapper.setAttribute('data-drag-handle', 'true');
    
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
  onPendingFilesChange,
  disabled = false
}) => {
  // CRITICAL: Initialize the global drag flag to ensure clean state
  if (typeof window._tiptapDragging === 'undefined') {
    window._tiptapDragging = false;
  }
  
  // Reduced logging to prevent performance issues
  // console.log('[RichTextEditor] ===== COMPONENT RENDER START =====');
  // console.log('[RichTextEditor] Props:', { 
  //   contentLength: initialContent?.length || 0, 
  //   sectionId, 
  //   disabled 
  // });
  // console.log('[RichTextEditor] window._tiptapDragging =', window._tiptapDragging);
  
  // Use ref to avoid recreating editor when onChange changes
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  
  // Wrap onChange to prevent calls during drag
  const safeOnChange = useCallback((html) => {
    if (window._tiptapDragging) {
      console.log('[SAFE-ON-CHANGE] 🛑 BLOCKED call to parent onChange (drag active)');
      return;
    }
    console.log('[SAFE-ON-CHANGE] ✅ Calling parent onChange');
    if (onChangeRef.current) {
      onChangeRef.current(html);
    }
  }, []); // Empty deps - uses ref instead
  
  // CRITICAL: Store the original content but NEVER pass it to TipTap's parser
  const originalContentRef = useRef(initialContent);
  
  // Ref to track layout insertion timeout for proper cleanup
  const layoutTimeoutRef = useRef(null);
  
  // Cleanup layout timeout on unmount to ensure flag is reset
  useEffect(() => {
    return () => {
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current);
        // Force reset the flag on cleanup
        window._tiptapDragging = false;
        console.log('[LAYOUT] Cleanup: Reset drag flag on unmount');
      }
    };
  }, []);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  
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

  // Cell styling state
  const [showCellStyleDialog, setShowCellStyleDialog] = useState(false);
  const [cellBackground, setCellBackground] = useState('');
  const [cellPadding, setCellPadding] = useState('medium');
  const [cellValign, setCellValign] = useState('top');

  // Memoize extensions to prevent duplicate registration warnings
  // Note: In development with React StrictMode, you may see duplicate extension warnings
  // due to intentional double-mounting. This is harmless and won't occur in production.
  const extensions = useMemo(() => {
    console.log('[RichTextEditor] Initializing extensions');
    return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4]
      },
      // Disable default code block to allow custom HTML code blocks with Prism highlighting
      codeBlock: false,
      code: false
    }),
    CustomCodeBlock,  // Add our custom code block extension
    FileAttachment,   // Add our custom file attachment extension
    SimpleImage,  // Use simple image extension with resize support
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
    Color,
    // Enhanced table extensions with drag-drop and resizing
    ResizableTable.configure({
      resizable: true,
      HTMLAttributes: {
        class: 'tiptap-table',
      },
    }),
    TableRow,
    TableHeader,
    DraggableTableCell,  // This replaces the standard TableCell
    // Plugin to prevent Enter key from deleting tables and ensure cells are editable
    Extension.create({
      name: 'preventTableDeletionOnEnter',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            key: new PluginKey('preventTableDeletionOnEnter'),
            props: {
              handleKeyDown(view, event) {
                const { state, dispatch } = view;
                const { selection } = state;

                // Handle arrow keys manually since ProseMirror isn't updating selection outside tables
                if (event.key.startsWith('Arrow')) {
                  console.log('[KEY DOWN] Arrow key pressed:', event.key, 'Selection:', selection.from, '-', selection.to);

                  // Check if we're in a table cell
                  let inTableCell = false;
                  for (let depth = selection.$anchor.depth; depth > 0; depth--) {
                    const node = selection.$anchor.node(depth);
                    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                      inTableCell = true;
                      break;
                    }
                  }

                  // If NOT in table cell, let ProseMirror handle arrow keys naturally
                  if (!inTableCell) {
                    console.log('[KEY DOWN] Outside table cell - letting ProseMirror handle naturally');
                    return false;
                  }
                }

                // Prevent Enter key from deleting tables
                if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                  
                  // Check if we're in a table cell
                  let inTableCell = false;
                  let tablePos = null;
                  
                  for (let depth = selection.$anchor.depth; depth > 0; depth--) {
                    const node = selection.$anchor.node(depth);
                    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                      inTableCell = true;
                      // Find the table
                      for (let tableDepth = depth - 1; tableDepth > 0; tableDepth--) {
                        const tableNode = selection.$anchor.node(tableDepth);
                        if (tableNode.type.name === 'table') {
                          tablePos = selection.$anchor.before(tableDepth);
                          break;
                        }
                      }
                      break;
                    } else if (node.type.name === 'table') {
                      inTableCell = true;
                      tablePos = selection.$anchor.before(depth);
                      break;
                    }
                  }
                  
                  if (inTableCell && tablePos !== null) {
                    // CRITICAL: Prevent TipTap's default Enter behavior that might delete table
                    // Instead, explicitly create a new paragraph
                    const tableNode = state.doc.nodeAt(tablePos);
                    if (tableNode && tableNode.type.name === 'table') {
                      // Get current cell position
                      const cellNode = selection.$anchor.node(selection.$anchor.depth);
                      if (cellNode && (cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader')) {
                        // Check if we're at the end of an empty paragraph
                        const cellPos = selection.$anchor.before(selection.$anchor.depth);
                        const cellContent = cellNode.content;
                        
                        // If cell only has empty paragraph, create a new one
                        if (cellContent.childCount === 1 && 
                            cellContent.firstChild.type.name === 'paragraph' && 
                            cellContent.firstChild.content.size === 0 &&
                            selection.$anchor.parentOffset === 0) {
                          // At start of empty paragraph - allow normal behavior
                          return false;
                        }
                        
                        // Otherwise, let TipTap handle it normally (should create new paragraph)
                        // But prevent any table deletion
                        return false;
                      }
                    }
                  }
                  
                  return false; // Let other handlers process the key
                }
                return false;
              },
            },
          }),
        ];
      },
    }),
    // Plugin to enforce border styles on borderless table cells
    Extension.create({
      name: 'enforceBorderlessBorders',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            key: new PluginKey('enforceBorderlessBorders'),
            appendTransaction(transactions, oldState, newState) {
              // Only run if document changed
              if (!transactions.some(tr => tr.docChanged)) return null;
              
              // CRITICAL: Detect new cells in borderless tables and add data-borderless-cell attribute
              const tr = newState.tr;
              let hasChanges = false;
              
              // Find all borderless tables and check for cells without data-borderless-cell
              newState.doc.descendants((node, pos) => {
                if (node.type.name === 'table') {
                  const tableClass = node.attrs.class || '';
                  if (tableClass.includes('borderless')) {
                    // This is a borderless table - check all its cells
                    const tableEnd = pos + node.nodeSize;
                    newState.doc.nodesBetween(pos, tableEnd, (cellNode, cellPos) => {
                      if (cellNode.type.name === 'tableCell') {
                        // Check if cell doesn't have data-borderless-cell attribute
                        if (!cellNode.attrs['data-borderless-cell']) {
                          // Add the attribute to new cells
                          tr.setNodeMarkup(cellPos, null, {
                            ...cellNode.attrs,
                            'data-borderless-cell': 'true',
                            // Add inline style for dashed border
                            style: cellNode.attrs.style ? 
                              `${cellNode.attrs.style}; border: 1px dashed rgba(148, 163, 184, 0.5) !important; background-color: rgba(30, 41, 59, 0.1) !important;` :
                              'border: 1px dashed rgba(148, 163, 184, 0.5) !important; background-color: rgba(30, 41, 59, 0.1) !important;',
                          });
                          hasChanges = true;
                        }
                      }
                    });
                  }
                }
              });
              
              // Run immediately, then also schedule for DOM update
              const editorElement = document.querySelector('.ProseMirror');
              if (editorElement) {
                const isEditable = editorElement.getAttribute('contenteditable') === 'true';
                
                if (isEditable) {
                  // Edit mode: add class immediately AND apply inline styles as fallback
                  // CRITICAL: Also detect tables inside .tableWrapper (layout tables)
                  const borderlessTables = editorElement.querySelectorAll(
                    'table.borderless, ' +
                    'table[class*="borderless"], ' +
                    '.tableWrapper table, ' +
                    '.tableWrapper table.tiptap-table'
                  );
                  borderlessTables.forEach(table => {
                    // Ensure the table has the borderless class
                    if (!table.classList.contains('borderless')) {
                      table.classList.add('borderless');
                    }
                    const cells = table.querySelectorAll('td, th');
                    cells.forEach(cell => {
                      // Add class - CSS will handle the dashed border styling
                      if (!cell.classList.contains('table-cell-droppable')) {
                        cell.classList.add('table-cell-droppable');
                      }
                      // FALLBACK: Apply inline styles directly if CSS isn't working
                      cell.style.setProperty('border', '1px dashed rgba(148, 163, 184, 0.5)', 'important');
                      cell.style.setProperty('border-width', '1px', 'important');
                      cell.style.setProperty('border-style', 'dashed', 'important');
                      cell.style.setProperty('border-color', 'rgba(148, 163, 184, 0.5)', 'important');
                      cell.style.setProperty('background-color', 'rgba(30, 41, 59, 0.1)', 'important');
                    });
                  });
                } else {
                  // Display mode: remove class and inline styles
                  // Also detect tables inside .tableWrapper (layout tables)
                  const borderlessTables = editorElement.querySelectorAll(
                    'table.borderless, ' +
                    'table[class*="borderless"], ' +
                    '.tableWrapper table, ' +
                    '.tableWrapper table.tiptap-table'
                  );
                  borderlessTables.forEach(table => {
                    const cells = table.querySelectorAll('td, th');
                    cells.forEach(cell => {
                      cell.classList.remove('table-cell-droppable');
                      cell.style.border = '';
                      cell.style.borderWidth = '';
                      cell.style.borderStyle = '';
                      cell.style.borderColor = '';
                      cell.style.backgroundColor = '';
                      cell.style.background = '';
                      cell.style.removeProperty('border');
                      cell.style.removeProperty('border-width');
                      cell.style.removeProperty('border-style');
                      cell.style.removeProperty('border-color');
                      cell.style.removeProperty('background-color');
                      cell.style.removeProperty('background');
                    });
                  });
                }
              }
              
              // Also schedule for DOM update (in case DOM isn't ready yet)
              setTimeout(() => {
                const editorElement = document.querySelector('.ProseMirror');
                if (!editorElement) return;
                
                const isEditable = editorElement.getAttribute('contenteditable') === 'true';
                
                if (isEditable) {
                  const borderlessTables = editorElement.querySelectorAll('table.borderless, table[class*="borderless"]');
                  borderlessTables.forEach(table => {
                    const cells = table.querySelectorAll('td, th');
                    cells.forEach(cell => {
                      if (!cell.classList.contains('table-cell-droppable')) {
                        cell.classList.add('table-cell-droppable');
                      }
                      // FALLBACK: Apply inline styles directly
                      cell.style.setProperty('border', '1px dashed rgba(148, 163, 184, 0.5)', 'important');
                      cell.style.setProperty('border-width', '1px', 'important');
                      cell.style.setProperty('border-style', 'dashed', 'important');
                      cell.style.setProperty('border-color', 'rgba(148, 163, 184, 0.5)', 'important');
                      cell.style.setProperty('background-color', 'rgba(30, 41, 59, 0.1)', 'important');
                    });
                  });
                } else {
                  const borderlessTables = editorElement.querySelectorAll('table.borderless, table[class*="borderless"]');
                  borderlessTables.forEach(table => {
                    const cells = table.querySelectorAll('td, th');
                    cells.forEach(cell => {
                      cell.classList.remove('table-cell-droppable');
                      cell.style.border = '';
                      cell.style.borderWidth = '';
                      cell.style.borderStyle = '';
                      cell.style.borderColor = '';
                      cell.style.backgroundColor = '';
                      cell.style.background = '';
                    });
                  });
                }
              }, 0);
              
              // Return transaction if we made changes to cell attributes
              return hasChanges ? tr : null;
            },
            view(editorView) {
              // Function to enforce border styles based on edit mode
              let isEnforcing = false; // Prevent infinite loops
              const enforceStyles = () => {
                if (isEnforcing) return; // Skip if already enforcing
                isEnforcing = true;
                
                requestAnimationFrame(() => {
                  const editorElement = editorView.dom.closest('.ProseMirror') || editorView.dom;
                  if (!editorElement) {
                    isEnforcing = false;
                    return;
                  }
                  
                  const isEditable = editorElement.getAttribute('contenteditable') === 'true';
                  const borderlessTables = editorElement.querySelectorAll('table.borderless, table[class*="borderless"]');
                  
                  borderlessTables.forEach(table => {
                    const cells = table.querySelectorAll('td, th');
                    cells.forEach(cell => {
                      if (isEditable) {
                        // Edit mode: add class and apply inline styles with !important
                        if (!cell.classList.contains('table-cell-droppable')) {
                          cell.classList.add('table-cell-droppable');
                        }
                        // CRITICAL: Use setProperty with 'important' to override any other styles
                        // This ensures borders are ALWAYS visible in edit mode, even if TipTap re-renders
                        // Only set if not already set to prevent triggering observer
                        const currentBorder = cell.style.getPropertyValue('border');
                        if (!currentBorder || !currentBorder.includes('dashed')) {
                          cell.style.setProperty('border', '1px dashed rgba(148, 163, 184, 0.5)', 'important');
                          cell.style.setProperty('border-width', '1px', 'important');
                          cell.style.setProperty('border-style', 'dashed', 'important');
                          cell.style.setProperty('border-color', 'rgba(148, 163, 184, 0.5)', 'important');
                          cell.style.setProperty('background-color', 'rgba(30, 41, 59, 0.1)', 'important');
                        }
                      } else {
                        // Display mode: remove class and inline styles
                        cell.classList.remove('table-cell-droppable');
                        cell.style.removeProperty('border');
                        cell.style.removeProperty('border-width');
                        cell.style.removeProperty('border-style');
                        cell.style.removeProperty('border-color');
                        cell.style.removeProperty('background-color');
                        cell.style.removeProperty('background');
                      }
                    });
                  });
                  
                  isEnforcing = false;
                });
              };
              
              // Run immediately
              setTimeout(enforceStyles, 0);
              
              // Use MutationObserver to continuously enforce styles when DOM changes
              // This is critical because TipTap re-renders the DOM and removes our inline styles
              const observer = new MutationObserver(() => {
                enforceStyles();
              });
              
              // Observe the editor DOM for changes
              observer.observe(editorView.dom, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'contenteditable'],
              });
              
              // Also observe on every update
              const updateHandler = () => {
                enforceStyles();
              };
              
              // Return cleanup function
              return {
                destroy: () => {
                  observer.disconnect();
                },
                update: updateHandler,
              };
            },
          }),
        ];
      },
    }),
  ];
  }, []); // Empty deps - extensions are static

  // Initialize TipTap editor
  // Reduced logging
  // console.log('[RichTextEditor] About to initialize editor');
  // console.log('[RichTextEditor] Original content length:', originalContentRef.current?.length || 0);
  // console.log('[RichTextEditor] Has images:', originalContentRef.current?.includes('<img') || false);
  
  // Track if we've loaded content yet
  const hasSetInitialContentRef = useRef(false);
  // Track if we're currently loading content to block onUpdate
  const isLoadingContentRef = useRef(false);
  
  const editor = useEditor(
    {
      extensions,
      content: '<p></p>', // Start with minimal content to prevent freeze
      editable: !disabled,
      onSelectionUpdate: ({ editor }) => {
        const { from, to } = editor.state.selection;
        console.log('[SELECTION UPDATE] Selection changed to:', from, '-', to);
      },
      onUpdate: ({ editor }) => {
        // Block onUpdate during content loading to prevent infinite loops
        if (isLoadingContentRef.current) {
          console.log('[RichTextEditor] onUpdate BLOCKED (content loading)');
          return;
        }
        
        // Get HTML directly - resize handles are in overlay container outside table structure
        // So they won't be included in TipTap's serialization (getHTML reads from document model, not DOM)
        let html = editor.getHTML();
        
        // Clean inline border styles from borderless table cells before saving
        // This ensures borders don't persist in display mode
        // Check for borderless in multiple ways - the class might not be present but border styles are
        const hasBorderless = html.includes('borderless') || 
                             html.includes('data-borderless-cell') ||
                             html.includes('border: 1px dashed') ||
                             html.includes('rgba(148, 163, 184, 0.5)');
        
        if (hasBorderless) {
          // Use regex to clean the HTML string directly - more reliable than DOM manipulation
          // Remove data-borderless-cell attribute
          html = html.replace(/\s+data-borderless-cell="[^"]*"/gi, '');
          html = html.replace(/\s+data-borderless-cell='[^']*'/gi, '');
          
          // Remove table-cell-droppable class
          html = html.replace(/\s+class="[^"]*table-cell-droppable[^"]*"/gi, (match) => {
            const cleaned = match.replace(/\s*table-cell-droppable\s*/gi, ' ').trim();
            return cleaned === 'class=""' ? '' : cleaned;
          });
          html = html.replace(/\s+class='[^']*table-cell-droppable[^']*'/gi, (match) => {
            const cleaned = match.replace(/\s*table-cell-droppable\s*/gi, ' ').trim();
            return cleaned === "class=''" ? '' : cleaned;
          });
          
          // Remove border and background styles from style attributes using regex
          // This function cleans a style string by removing all border and background properties
          // Clone to avoid modifying the original
          let htmlToClean = currentHtml;
          
          // Remove resize handles (they're UI-only and shouldn't be saved)
          // Use multiple patterns to catch all variations
          htmlToClean = htmlToClean.replace(/<div[^>]*class="[^"]*resize-handle[^"]*"[^>]*>.*?<\/div>/gi, '');
          htmlToClean = htmlToClean.replace(/<div[^>]*class="[^"]*resize-handle-cell[^"]*"[^>]*>.*?<\/div>/gi, '');
          htmlToClean = htmlToClean.replace(/<div[^>]*class="[^"]*resize-handle-column[^"]*"[^>]*>.*?<\/div>/gi, '');
          htmlToClean = htmlToClean.replace(/<div[^>]*class="[^"]*resize-handle-row[^"]*"[^>]*>.*?<\/div>/gi, '');
          htmlToClean = htmlToClean.replace(/<div[^>]*data-resize-handle[^>]*>.*?<\/div>/gi, '');
          // Also remove the ⋮ character if it appears as text
          htmlToClean = htmlToClean.replace(/⋮/g, '');
          
          const cleanStyleString = (styleContent) => {
            if (!styleContent) return '';
            
            // Split by semicolon and filter out border/background properties
            const properties = styleContent.split(';').filter(prop => {
              const trimmed = prop.trim().toLowerCase();
              // Keep only properties that are NOT border or background related
              return !trimmed.match(/^(border|background)/) && 
                     !trimmed.includes('border') && 
                     !trimmed.includes('background');
            });
            
            // Join back and clean up
            let cleaned = properties.join(';')
              .replace(/;;+/g, ';')
              .replace(/^\s*;\s*|\s*;\s*$/g, '')
              .trim();
            
            return cleaned;
          };
          
          // Clean double-quoted style attributes
          htmlToClean = htmlToClean.replace(/style="([^"]*)"/gi, (match, styleContent) => {
            const cleaned = cleanStyleString(styleContent);
            return cleaned ? `style="${cleaned}"` : '';
          });
          
          // Clean single-quoted style attributes
          htmlToClean = htmlToClean.replace(/style='([^']*)'/gi, (match, styleContent) => {
            const cleaned = cleanStyleString(styleContent);
            return cleaned ? `style='${cleaned}'` : '';
          });
          
          // Clean up empty style attributes
          htmlToClean = htmlToClean.replace(/\s+style="\s*"/gi, '');
          htmlToClean = htmlToClean.replace(/\s+style='\s*'/gi, '');
          
          // Use cleaned HTML
          html = htmlToClean;
        }
        
        console.log('[RichTextEditor] onUpdate - HTML length:', html.length);
        safeOnChange(html); // Use safe wrapper that checks drag flag
      },
      onCreate: ({ editor }) => {
        console.log('[RichTextEditor] onCreate - editor initialized successfully');
        // Content will be loaded via direct DOM manipulation in useEffect
      },
      editorProps: {
        attributes: {
          class: 'prose prose-invert max-w-none focus:outline-none min-h-[300px] p-4 bg-gray-800/30 rounded border border-gray-700/50'
        }
      }
    },
    [extensions] // safeOnChange is stable (empty deps), no need to include it
  );
  
  // Reduced logging
  // console.log('[RichTextEditor] Editor object created:', editor ? 'SUCCESS' : 'NULL');
  
  // Store editor instance globally for drop handler access
  useEffect(() => {
    if (editor) {
      window._tiptapEditorInstance = editor;
      console.log('[DRAG] Editor instance stored globally');
    }
    return () => {
      if (window._tiptapEditorInstance === editor) {
        window._tiptapEditorInstance = null;
        console.log('[DRAG] Editor instance cleared');
      }
    };
  }, [editor]);

  // CRITICAL: Attach drag handlers directly to editor DOM (bypass plugin issues)
  // Use ref to track if handlers are already attached to prevent re-attachment on every render
  const dragHandlersAttachedRef = useRef(false);
  
  useEffect(() => {
    if (!editor) {
      console.log('[DRAG-DIRECT] Editor not ready');
      return;
    }

    // Wait for view to be fully mounted
    if (!editor.view || !editor.view.dom || editor.isDestroyed) {
      console.log('[DRAG-DIRECT] Editor view not ready or destroyed');
      return;
    }

    // Skip if handlers are already attached
    if (dragHandlersAttachedRef.current) {
      console.log('[DRAG-DIRECT] Handlers already attached, skipping');
      return;
    }

    const editorDom = editor.view.dom;
    console.log('[DRAG-DIRECT] 🚀 Attaching drag handlers directly to DOM');
    dragHandlersAttachedRef.current = true;

    let dragOverCount = 0;

    const handleDragStart = (event) => {
      // Only handle drags from editor content
      if (!event.target.closest('.ProseMirror')) {
        return;
      }
      dragOverCount = 0;
      window._tiptapDragging = true;
      console.log('[DRAG-DIRECT] 🎯 Drag started,onChange BLOCKED');
    };

    const handleDragOver = (event) => {
      // Log EVERY dragover to see if handler is being called
      dragOverCount++;
      
      // CRITICAL: If we have stored content, ALWAYS preventDefault to allow drop
      // This must happen on EVERY dragover event, not just when over editor
      if (window._draggedContent) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move'; // Set drop effect to allow drop
        
        // Check if we're over editor
        const isOverEditor = event.target.closest('.ProseMirror');
        const cell = event.target.closest('td, th');
        const table = event.target.closest('table');
        
        // Log first 10, then every 20th
        if (dragOverCount <= 10 || dragOverCount % 20 === 0) {
          console.log('[DRAG-DIRECT] ✅ dragover #' + dragOverCount + ' (hasContent) on', event.target.tagName, isOverEditor ? 'in editor' : 'outside editor', cell ? '(in cell ' + cell.tagName + ')' : '(no cell)');
        }
        return; // Handled
      }
      
      // Check if we're over editor (for normal drops without stored content)
      const isOverEditor = event.target.closest('.ProseMirror');
      if (isOverEditor) {
        // Also preventDefault for any editor content to allow normal drops
        event.preventDefault();
        if (dragOverCount <= 3) {
          console.log('[DRAG-DIRECT] dragover #' + dragOverCount + ' over editor but no stored content');
        }
      } else {
        // Log when NOT over editor (first few times only)
        if (dragOverCount <= 3) {
          console.log('[DRAG-DIRECT] ⚠️ dragover #' + dragOverCount + ' NOT over editor, target:', event.target.tagName, event.target.className);
        }
      }
    };

    const handleDrop = (event) => {
      console.log('[DRAG-DIRECT] 🔵 DROP event fired, target:', event.target.tagName, 'hasContent:', !!window._draggedContent);
      
      // Only handle drops in editor content
      const isOverEditor = event.target.closest('.ProseMirror');
      if (!isOverEditor) {
        console.log('[DRAG-DIRECT] ⚠️ Drop not over editor, ignoring');
        return;
      }
      
      // Check if we have stored content to move
      if (!window._draggedContent) {
        console.log('[DRAG-DIRECT] ⚠️ No stored content, letting TipTap handle');
        // No stored content, let TipTap handle it normally
        return;
      }
      
      const cell = event.target.closest('td, th');
      if (!cell) {
        console.log('[DRAG-DIRECT] ⚠️ Not dropping in a cell, letting TipTap handle');
        // Not dropping in a cell, let TipTap handle it
        return;
      }
      
      console.log('[DRAG-DIRECT] ✅✅✅ DROP on cell, processing manually');
      event.preventDefault();
      event.stopPropagation();
      
      // Get editor instance
      const editorInstance = window._tiptapEditorInstance;
      if (!editorInstance || !editorInstance.view || editorInstance.isDestroyed) {
        console.error('[DRAG-DIRECT] Editor instance not available or destroyed');
        window._tiptapDragging = false;
        window._draggedContent = null;
        window._draggedElement = null;
        return;
      }
      
      // Use the same logic as the ProseMirror plugin
      const { view } = editorInstance;
      if (!view || !view.state || !view.state.doc) {
        console.error('[DRAG-DIRECT] Editor view or state not available');
        window._tiptapDragging = false;
        window._draggedContent = null;
        window._draggedElement = null;
        return;
      }
      
      const { state } = view;
      const docSize = state.doc.content.size;
      let targetCellPos = null;
      let insertPos = null;
      
      // Find the cell node that matches the DOM cell
      try {
        state.doc.descendants((node, pos) => {
          // Guard: ensure position is valid
          if (pos < 0 || pos >= docSize) {
            return false;
          }
          
          if (node.type.name === 'tableCell' && targetCellPos === null) {
            try {
              const domNode = view.nodeDOM(pos);
              if (domNode && (domNode === cell || cell.contains(domNode))) {
                targetCellPos = pos;
                // Find the first paragraph in the cell to insert after
                node.descendants((pNode, pPos) => {
                  if (pNode.type.name === 'paragraph' && insertPos === null) {
                    const calculatedPos = pos + pPos + 1;
                    if (calculatedPos >= 0 && calculatedPos < docSize) {
                      insertPos = calculatedPos;
                    }
                    return false; // Stop searching
                  }
                });
                // If no paragraph found, insert at cell start
                if (insertPos === null) {
                  const calculatedPos = pos + 1;
                  if (calculatedPos >= 0 && calculatedPos < docSize) {
                    insertPos = calculatedPos;
                  }
                }
                return false; // Stop searching
              }
            } catch (err) {
              console.warn('[DRAG-DIRECT] Error accessing node DOM:', err);
              return false;
            }
          }
        });
      } catch (err) {
        console.error('[DRAG-DIRECT] Error finding cell position:', err);
        window._tiptapDragging = false;
        window._draggedContent = null;
        window._draggedElement = null;
        cell.classList.remove('drag-over');
        return;
      }
      
      console.log('[DRAG-DIRECT] Target cell position:', targetCellPos, 'Insert position:', insertPos);
      
      if (insertPos === null) {
        console.warn('[DRAG-DIRECT] Could not find cell position, using DOM fallback');
        // Fallback: Use DOM manipulation
        const cellContent = cell.querySelector('p') || cell;
        if (cellContent) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = window._draggedContent;
          while (tempDiv.firstChild) {
            cellContent.appendChild(tempDiv.firstChild);
          }
          if (window._draggedElement && window._draggedElement.parentNode) {
            window._draggedElement.remove();
          }
          console.log('[DRAG-DIRECT] ✅ Content moved via DOM fallback');
        }
        window._tiptapDragging = false;
        window._draggedContent = null;
        window._draggedElement = null;
        cell.classList.remove('drag-over');
        return;
      }
      
      try {
        // Guard: ensure insert position is valid
        if (insertPos === null || insertPos < 0 || insertPos >= docSize) {
          console.warn('[DRAG-DIRECT] Invalid insert position:', insertPos, 'docSize:', docSize);
          window._tiptapDragging = false;
          window._draggedContent = null;
          window._draggedElement = null;
          cell.classList.remove('drag-over');
          return;
        }
        
        // Find and remove the original content FIRST
        let originalNodePos = null;
        if (window._draggedElement && editorInstance.view && editorInstance.view.state) {
          try {
            const { state: currentState } = editorInstance.view.state;
            if (currentState && currentState.doc) {
              currentState.doc.descendants((node, pos) => {
                // Guard: ensure position is valid
                if (pos < 0 || pos >= currentState.doc.content.size) {
                  return false;
                }
                
                if (node.type.name === 'image' || node.type.name === 'customCodeBlock') {
                  try {
                    const domNode = editorInstance.view.nodeDOM(pos);
                    if (domNode === window._draggedElement || domNode?.contains(window._draggedElement)) {
                      originalNodePos = pos;
                      return false;
                    }
                  } catch (err) {
                    console.warn('[DRAG-DIRECT] Error accessing node DOM for original:', err);
                    return false;
                  }
                }
              });
            }
          } catch (err) {
            console.warn('[DRAG-DIRECT] Error finding original node:', err);
          }
        }
        
        console.log('[DRAG-DIRECT] Original node position:', originalNodePos, 'Insert at:', insertPos);
        
        // Get original node size BEFORE removal
        let originalNodeSize = 0;
        let adjustedInsertPos = insertPos;
        if (originalNodePos !== null && originalNodePos >= 0 && originalNodePos < docSize) {
          try {
            const { state: currentState } = editorInstance.view.state;
            if (currentState && currentState.doc) {
              const originalNode = currentState.doc.nodeAt(originalNodePos);
              if (originalNode) {
                originalNodeSize = originalNode.nodeSize;
                // Adjust insert position if original is before target
                if (originalNodePos < insertPos) {
                  adjustedInsertPos = Math.max(0, insertPos - originalNodeSize);
                  console.log('[DRAG-DIRECT] Adjusted insert position from', insertPos, 'to', adjustedInsertPos);
                }
              }
            }
          } catch (err) {
            console.warn('[DRAG-DIRECT] Error getting original node size:', err);
          }
        }
        
        // Guard: ensure adjusted insert position is valid
        if (adjustedInsertPos < 0 || adjustedInsertPos >= docSize) {
          console.warn('[DRAG-DIRECT] Invalid adjusted insert position:', adjustedInsertPos, 'docSize:', docSize);
          adjustedInsertPos = Math.max(0, Math.min(adjustedInsertPos, docSize - 1));
        }
        
        // Remove original content first if it exists
        if (originalNodePos !== null && originalNodePos >= 0 && originalNodePos < docSize) {
          try {
            editorInstance.chain()
              .focus()
              .setTextSelection(originalNodePos)
              .deleteSelection()
              .run();
            console.log('[DRAG-DIRECT] ✅ Original content removed via TipTap');
          } catch (err) {
            console.warn('[DRAG-DIRECT] Failed to remove via TipTap:', err);
          }
        }
        
        // Insert the content at the target position
        try {
          editorInstance.chain()
            .focus()
            .setTextSelection(adjustedInsertPos)
            .insertContent(window._draggedContent)
            .run();
          
          console.log('[DRAG-DIRECT] ✅ Content inserted at position', adjustedInsertPos);
        } catch (err) {
          console.error('[DRAG-DIRECT] Error inserting content:', err);
          throw err;
        }
        
        // Fallback: Remove via DOM if TipTap removal didn't work
        if (window._draggedElement && window._draggedElement.parentNode) {
          setTimeout(() => {
            window._draggedElement.remove();
            console.log('[DRAG-DIRECT] ✅ Original content removed via DOM (cleanup)');
          }, 50);
        }
        
        // Cleanup
        window._draggedContent = null;
        window._draggedElement = null;
        cell.classList.remove('drag-over');
        
        // Reset flag
        setTimeout(() => {
          window._tiptapDragging = false;
          console.log('[DRAG-DIRECT] Flag reset after drop');
        }, 100);
        
      } catch (error) {
        console.error('[DRAG-DIRECT] Error moving content:', error);
        // Fallback: Direct DOM manipulation
        const cellContent = cell.querySelector('p') || cell;
        if (cellContent) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = window._draggedContent;
          while (tempDiv.firstChild) {
            cellContent.appendChild(tempDiv.firstChild);
          }
          if (window._draggedElement && window._draggedElement.parentNode) {
            window._draggedElement.remove();
          }
          console.log('[DRAG-DIRECT] ✅ Content moved via DOM fallback (error recovery)');
        }
        window._tiptapDragging = false;
        window._draggedContent = null;
        window._draggedElement = null;
        cell.classList.remove('drag-over');
      }
    };

    const handleDragEnd = (event) => {
      window._tiptapDragging = false;
      console.log('[DRAG-DIRECT] ⚫ Drag ended (flag reset)');
    };

    // Attach to document to ensure we catch all events (capture phase)
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('dragover', handleDragOver, true);
    document.addEventListener('drop', handleDrop, true);
    document.addEventListener('dragend', handleDragEnd, true);

    console.log('[DRAG-DIRECT] ✅ Drag handlers attached successfully to document (capture phase)');
    console.log('[DRAG-DIRECT] Editor DOM element:', editorDom.tagName, editorDom.className);
    
    // Verify handlers are actually attached by checking the event listener count
    console.log('[DRAG-DIRECT] Test: Checking if dragover handler is callable...');
    
    // Create a test to verify the handler function exists
    const testHandler = () => {
      console.log('[DRAG-DIRECT] TEST: Handler function is callable');
    };
    // This is just to verify the function can be called - we'll remove it
    const testEl = document.createElement('div');
    testEl.addEventListener('dragover', testHandler, true);
    testEl.removeEventListener('dragover', testHandler, true);
    console.log('[DRAG-DIRECT] Test: Event listener API is working');

    return () => {
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('dragover', handleDragOver, true);
      document.removeEventListener('drop', handleDrop, true);
      document.removeEventListener('dragend', handleDragEnd, true);
      dragHandlersAttachedRef.current = false; // Reset so handlers can be re-attached if editor is recreated
      console.log('[DRAG-DIRECT] ❌ Drag handlers removed from document');
    };
  }, [editor]);

  /**
   * Handle code block click - for editing or deleting
   */
  const handleCodeBlockClick = useCallback((event) => {
    if (!editor) {
      return;
    }

    // Early exit: Only process if click is related to a code block
    // Check if target is inside a code block wrapper or is a pre element
    const wrapper = event.target.closest('.code-block-wrapper');
    const preElement = event.target.closest('pre');

    if (!wrapper && !preElement) {
      // Not a code block click, exit silently
      return;
    }

    console.log('[CODE BLOCK EDIT] handleCodeBlockClick called, target:', event.target);

    // Check if delete button was clicked
    if (event.target.closest('.code-block-delete-btn')) {
      console.log('[CODE BLOCK EDIT] Delete button clicked, ignoring for edit');
      event.preventDefault();
      event.stopPropagation();

      if (wrapper) {
        // Remove the code block wrapper
        wrapper.remove();

        // Trigger content update
        safeOnChange(editor.getHTML());
        showNotification('Success', 'Code block deleted', 'success');
      }
      return;
    }

    // Look for code block wrapper or pre element
    const codeBlock = wrapper ? wrapper.querySelector('pre') : preElement;

    console.log('[CODE BLOCK EDIT] Found wrapper:', wrapper);
    console.log('[CODE BLOCK EDIT] Found codeBlock:', codeBlock);

    if (codeBlock) {
      console.log('[CODE BLOCK EDIT] Code block found, processing...');

      // Only handle pre elements that contain code elements (actual code blocks)
      const codeElement = codeBlock.querySelector('code');
      if (!codeElement) {
        console.log('[CODE BLOCK EDIT] No code element found inside pre');
        return;
      }

      console.log('[CODE BLOCK EDIT] Code element found, preventing default and opening dialog');
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

      console.log('[CODE BLOCK EDIT] Opening dialog with code:', existingCode, 'language:', language);

      // Store reference to the code block wrapper being edited
      savedSelectionRef.current = { editingCodeBlock: wrapper || codeBlock };

      // Open dialog with existing content
      setCodeContent(existingCode);
      setCodeLanguage(language);
      setShowCodeDialog(true);
    }
  }, [editor, showNotification]); // safeOnChange is stable, onChange not used directly

  // Load content by temporarily destroying and recreating TipTap
  useEffect(() => {
    if (!editor) {
      console.log('[RichTextEditor] Content loading effect: No editor yet');
      return;
    }
    
    // Guard: Don't run if editor is destroyed
    if (editor.isDestroyed) {
      console.log('[RichTextEditor] Editor destroyed, skipping content load');
      return;
    }
    
    // Guard: Don't run if editor view isn't ready
    if (!editor.view || !editor.view.dom) {
      console.log('[RichTextEditor] Editor view not ready, skipping content load');
      return;
    }
    
    // Guard: Don't run if content already loaded
    if (hasSetInitialContentRef.current) {
      console.log('[RichTextEditor] Content already loaded, skipping');
      return;
    }
    
      hasSetInitialContentRef.current = true;
      console.log('[RichTextEditor] Starting content load with editor disabled');
    
    // Set loading flag to block onUpdate
    isLoadingContentRef.current = true;
      
      requestAnimationFrame(() => {
        try {
          const editorElement = document.querySelector('.ProseMirror');
          if (!editorElement) {
            console.error('[RichTextEditor] Could not find editor element');
          isLoadingContentRef.current = false;
            return;
          }
          
          console.log('[RichTextEditor] Disabling editor to prevent MutationObserver interference');
          
          // CRITICAL: Destroy the editor temporarily to stop it from observing DOM changes
          editor.setEditable(false);
          
          // Wait for editor to fully disable
          setTimeout(() => {
            try {
              console.log('[RichTextEditor] Injecting content into disabled editor');
              const content = originalContentRef.current || '<p></p>';
              
            // CRITICAL: Clean any existing ⋮ characters from loaded content
            // These might have been saved previously when handles were added to cells
            let cleanedContent = content;
            
            // Remove ⋮ characters that might be in the content
            cleanedContent = cleanedContent.replace(/⋮/g, '');
            
            // Also remove any resize handle divs that might be in the HTML
            cleanedContent = cleanedContent.replace(/<div[^>]*class="[^"]*resize-handle[^"]*"[^>]*>.*?<\/div>/gi, '');
            cleanedContent = cleanedContent.replace(/<div[^>]*class="[^"]*resize-handle-cell[^"]*"[^>]*>.*?<\/div>/gi, '');
            cleanedContent = cleanedContent.replace(/<div[^>]*data-resize-handle[^>]*>.*?<\/div>/gi, '');
            
            // Only update if content is different from current
            const currentContent = editor.getHTML();
            if (cleanedContent === currentContent || (cleanedContent === '<p></p>' && currentContent === '<p></p>')) {
              console.log('[RichTextEditor] Content unchanged, skipping update');
              editor.setEditable(true);
              setIsLoadingContent(false);
              isLoadingContentRef.current = false;
              return;
            }

              // CRITICAL: Use editor.commands.setContent() instead of innerHTML
              // This ensures ProseMirror parses the HTML and converts it to proper nodes
              // (e.g., fileAttachment nodes, customCodeBlock nodes, etc.)
              editor.commands.setContent(cleanedContent, false);
              console.log('[RichTextEditor] Content set via ProseMirror (cleaned),', cleanedContent.length, 'characters (original:', content.length, ')');

              // CRITICAL: Apply borderless styles to any tables in the loaded content
              // This ensures layout tables show dashed borders in edit mode
              setTimeout(() => {
                const editorElement = document.querySelector('.ProseMirror');
                if (editorElement) {
                  const borderlessTables = editorElement.querySelectorAll(
                    '.tableWrapper table, ' +
                    '.tableWrapper table.tiptap-table, ' +
                    'table.borderless, ' +
                    'table[class*="borderless"]'
                  );
                  borderlessTables.forEach(table => {
                    // Add borderless class if missing
                    if (!table.classList.contains('borderless')) {
                      table.classList.add('borderless');
                    }
                    // Apply dashed borders to cells and ensure they're editable
                    const cells = table.querySelectorAll('td, th');
                    cells.forEach(cell => {
                      cell.classList.add('table-cell-droppable');
                      cell.style.setProperty('border', '1px dashed rgba(148, 163, 184, 0.5)', 'important');
                      cell.style.setProperty('border-width', '1px', 'important');
                      cell.style.setProperty('border-style', 'dashed', 'important');
                      cell.style.setProperty('border-color', 'rgba(148, 163, 184, 0.5)', 'important');
                      cell.style.setProperty('background-color', 'rgba(30, 41, 59, 0.1)', 'important');
                      
                      // Ensure cell is editable
                      cell.setAttribute('contenteditable', 'true');
                      
                      // Ensure cell has a paragraph for content
                      if (!cell.querySelector('p')) {
                        const p = document.createElement('p');
                        cell.appendChild(p);
                      }
                      // Ensure paragraph is editable
                      const p = cell.querySelector('p');
                      if (p) {
                        p.setAttribute('contenteditable', 'true');
                      }
                    });
                  });
                }
              }, 100);
              
              // Re-enable editor after content is set
              setTimeout(() => {
                console.log('[RichTextEditor] Re-enabling editor');
                editor.setEditable(true);
                setIsLoadingContent(false);
                
                // Setup resize functionality for any images in loaded content
                console.log('[RESIZE] Triggering resize setup for loaded content');
                setTimeout(() => {
                  // Use the editorElement from outer scope (line 2635)
                  const editorDomForImages = document.querySelector('.ProseMirror');
                  if (editorDomForImages) {
                    const images = editorDomForImages.querySelectorAll('img');
                    console.log('[RESIZE] Found', images.length, 'images after content load');
                    if (images.length > 0) {
                      // Trigger a fake update to activate makeImagesResizable
                      editor.commands.focus();
                    }
                  }
                
                // Clear loading flag after everything is set up
                isLoadingContentRef.current = false;
                
                // CRITICAL: Attach handlers to file delete buttons immediately after content is loaded
                // This ensures buttons created by renderHTML have handlers before user clicks
                const editorDomForFiles = document.querySelector('.ProseMirror');
                if (editorDomForFiles) {
                  const fileCards = editorDomForFiles.querySelectorAll('.file-attachment-card');
                  fileCards.forEach(card => {
                    const deleteBtn = card.querySelector('.file-delete-btn');
                    if (deleteBtn && 
                        !deleteBtn.hasAttribute('data-handler-attached') && 
                        !deleteBtn.hasAttribute('data-handler-attached-mutation') &&
                        !deleteBtn.hasAttribute('data-handler-attached-render')) {
                      // Call addDeleteButtonsToExistingFiles logic directly
                      // This is the same logic from addDeleteButtonsToExistingFiles for existing buttons
                      console.log('[FILE DELETE] 🔧 Attaching handler to button after content load');
                      deleteBtn.setAttribute('data-handler-attached', 'true');
                      
                      // Create a shared handler function to avoid duplication
                      const contentLoadHandler = (e) => {
                        console.log('[FILE DELETE] 🎯 CONTENT-LOAD BUTTON CLICK!');
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        
                        const fileCard = deleteBtn.closest('.file-attachment-card');
                        if (fileCard && editor) {
                          try {
                            const { state, view } = editor.view;
                            let filePos = null;
                            const fileId = fileCard.getAttribute('data-component-id');
                            const fileUrl = fileCard.getAttribute('data-fileurl');
                            const cell = fileCard.closest('td, th');
                            const isInTableCell = cell !== null;
                            
                            if (isInTableCell) {
                              let cellPos = null;
                              state.doc.descendants((node, pos) => {
                                if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                                  try {
                                    const domNode = view.nodeDOM(pos);
                                    if (domNode && (domNode === cell || cell.contains(domNode))) {
                                      cellPos = pos;
                                      return false;
                                    }
                                  } catch (err) {
                                    return false;
                                  }
                                }
                              });
                              
                              if (cellPos !== null) {
                                const cellNode = state.doc.nodeAt(cellPos);
                                if (cellNode) {
                                  const cellStart = cellPos + 1;
                                  const cellEnd = cellPos + cellNode.nodeSize - 1;
                                  state.doc.nodesBetween(cellStart, cellEnd, (node, pos) => {
                                    if (node.type.name === 'fileAttachment') {
                                      const matches = (fileId && node.attrs['data-component-id'] === fileId) ||
                                                   (fileUrl && node.attrs.fileurl === fileUrl);
                                      if (matches && filePos === null) {
                                        filePos = pos;
                                        return false;
                                      }
                                    }
                                  });
                                }
                              }
                            } else {
                              state.doc.descendants((node, pos) => {
                                if (node.type.name === 'fileAttachment') {
                                  const matches = (fileId && node.attrs['data-component-id'] === fileId) ||
                                               (fileUrl && node.attrs.fileurl === fileUrl);
                                  if (matches && filePos === null) {
                                    filePos = pos;
                                    return false;
                                  }
                                }
                              });
                            }
                            
                            if (filePos !== null && filePos >= 0 && filePos < state.doc.content.size) {
                              const nodeAtPos = state.doc.nodeAt(filePos);
                              if (nodeAtPos && nodeAtPos.type.name === 'fileAttachment') {
                                const matches = (fileId && nodeAtPos.attrs['data-component-id'] === fileId) ||
                                             (fileUrl && nodeAtPos.attrs.fileurl === fileUrl);
                                if (matches) {
                                  const tr = state.tr.delete(filePos, filePos + nodeAtPos.nodeSize);
                                  editor.view.dispatch(tr);
                                  showNotification('File Removed', 'File attachment removed from content', 'success');
                                }
                              }
                            }
                          } catch (error) {
                            console.error('[FILE DELETE] Error:', error);
                          }
                        }
                      };
                      
                      // Attach in both capture and bubble phases
                      deleteBtn.addEventListener('click', contentLoadHandler, true);
                      deleteBtn.addEventListener('click', contentLoadHandler, false);
                    }
                  });
                }
                
                // Only notify parent if content actually changed
                const finalContent = editor.getHTML();
                if (finalContent !== currentContent) {
                  safeOnChange(finalContent);
                  console.log('[RichTextEditor] Content load complete, parent notified');
                } else {
                  console.log('[RichTextEditor] Content load complete, no change to notify');
                }
              }, 200);
              }, 100);
            } catch (err) {
              console.error('[RichTextEditor] Failed during content injection:', err);
              editor.setEditable(true);
              setIsLoadingContent(false);
            isLoadingContentRef.current = false;
            }
          }, 50);
        } catch (err) {
          console.error('[RichTextEditor] Failed to load content:', err);
          setIsLoadingContent(false);
        isLoadingContentRef.current = false;
      }
    });
  }, [editor]); // safeOnChange is stable
  
  // Continuously enforce borderless styling on all borderless tables
  // Only add/remove classes - let CSS handle the styling
  useEffect(() => {
    if (!editor) return;
    
    // CRITICAL: Flag to prevent infinite loops
    let isApplyingStyles = false;
    let styleTimeout = null;
    
    const enforceBorderlessStyle = () => {
      // Prevent re-entrancy
      if (isApplyingStyles) {
        return;
      }
      
      // Set flag immediately to prevent re-entrancy
      isApplyingStyles = true;
      
      try {
        const editorElement = document.querySelector('.ProseMirror');
        if (!editorElement) {
          isApplyingStyles = false;
          return;
        }
        
        const isEditable = editorElement.getAttribute('contenteditable') === 'true';
      
      // Only run in edit mode - in display mode, CSS will handle hiding borders
      if (!isEditable) {
        // In display mode, just ensure classes are removed and let CSS handle it
        // Also detect tables inside .tableWrapper (layout tables)
        const borderlessTables = editorElement.querySelectorAll(
          'table.borderless, ' +
          'table[class*="borderless"], ' +
          '.tableWrapper table, ' +
          '.tableWrapper table.tiptap-table'
        );
        borderlessTables.forEach(table => {
          const cells = table.querySelectorAll('td, th');
          cells.forEach(cell => {
            // Remove the class so CSS can hide borders
            cell.classList.remove('table-cell-droppable');
            // Remove any inline border styles that might have been added
            cell.style.removeProperty('border');
            cell.style.removeProperty('border-width');
            cell.style.removeProperty('border-style');
            cell.style.removeProperty('border-color');
            cell.style.removeProperty('background-color');
            cell.style.removeProperty('background');
          });
        });
        return;
      }
      
      // Edit mode: add classes and ensure table/cell transparency
      // CRITICAL: Also detect tables inside .tableWrapper (layout tables) even if they don't have the borderless class
      const borderlessTables = editorElement.querySelectorAll(
        'table.borderless, ' +
        'table[class*="borderless"], ' +
        '.tableWrapper table, ' +
        '.tableWrapper table.tiptap-table'
      );
      borderlessTables.forEach(table => {
        // Ensure the table has the borderless class for consistency
        if (!table.classList.contains('borderless')) {
          table.classList.add('borderless');
        }
        // Ensure table is transparent
        table.style.border = 'none';
        table.style.background = 'transparent';
        table.style.backgroundColor = 'transparent';
        table.style.borderCollapse = 'collapse';
        table.style.borderSpacing = '0';
        
        // Enforce on tbody
        const tbody = table.querySelector('tbody');
        if (tbody) {
          tbody.style.border = 'none';
          tbody.style.background = 'transparent';
          tbody.style.backgroundColor = 'transparent';
        }
        
        // Enforce on all rows
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          row.style.background = 'transparent';
          row.style.backgroundColor = 'transparent';
        });
        
        // Enforce on all cells - add class AND inline styles as fallback
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
          // Check if styles are already applied to avoid unnecessary DOM changes
          const currentBorder = cell.style.getPropertyValue('border');
          const hasDashedBorder = currentBorder.includes('dashed') && currentBorder.includes('rgba(148, 163, 184');
          const hasCorrectBackground = cell.style.getPropertyValue('background-color') === 'rgba(30, 41, 59, 0.1)';
          
          // Only apply if not already applied
          if (!hasDashedBorder || !hasCorrectBackground || !cell.classList.contains('table-cell-droppable')) {
            // Add class - CSS will handle the dashed border styling
            if (!cell.classList.contains('table-cell-droppable')) {
              cell.classList.add('table-cell-droppable');
            }
            
            // FALLBACK: Apply inline styles directly if CSS isn't working
            // This ensures borders are visible even if CSS rules don't match
            if (!hasDashedBorder) {
              cell.style.setProperty('border', '1px dashed rgba(148, 163, 184, 0.5)', 'important');
              cell.style.setProperty('border-width', '1px', 'important');
              cell.style.setProperty('border-style', 'dashed', 'important');
              cell.style.setProperty('border-color', 'rgba(148, 163, 184, 0.5)', 'important');
            }
            if (!hasCorrectBackground) {
              cell.style.setProperty('background-color', 'rgba(30, 41, 59, 0.1)', 'important');
            }
          }
          
          // Ensure cell has a paragraph for content (needed for editing)
          if (!cell.querySelector('p')) {
            const p = document.createElement('p');
            cell.appendChild(p);
          }
          
          // Also check paragraphs inside cells
          const paragraphs = cell.querySelectorAll('p');
          paragraphs.forEach(p => {
            p.style.background = 'transparent';
            p.style.backgroundColor = 'transparent';
          });
        });
      });
      } catch (error) {
        console.error('[enforceBorderlessStyle] Error:', error);
      } finally {
        // Always clear the flag, even if there was an error
        isApplyingStyles = false;
      }
    };
    
    // Debounced version to prevent rapid calls
    const debouncedEnforce = () => {
      if (styleTimeout) {
        clearTimeout(styleTimeout);
      }
      styleTimeout = setTimeout(() => {
        isApplyingStyles = true;
        enforceBorderlessStyle();
      }, 50); // 50ms debounce
    };
    
    // Run immediately (only once on mount)
    isApplyingStyles = true;
    enforceBorderlessStyle();
    
    // Run after any editor update (debounced)
    // CRITICAL: This ensures new rows/columns get styled immediately
    const updateHandler = editor.on('update', ({ transaction }) => {
      // Check if new cells were added (rows/columns added)
      if (transaction && transaction.docChanged) {
        // Use a shorter debounce for document changes to ensure new cells are styled quickly
        if (styleTimeout) {
          clearTimeout(styleTimeout);
        }
        styleTimeout = setTimeout(() => {
          isApplyingStyles = true;
          enforceBorderlessStyle();
        }, 10); // Shorter debounce for document changes
      } else {
        // For non-document changes, use normal debounce
        debouncedEnforce();
      }
    });
    
    // Also watch for DOM mutations (in case styles are being added directly)
    // CRITICAL: Only observe changes that are NOT from our own style application
    const editorElement = document.querySelector('.ProseMirror');
    if (editorElement) {
      const observer = new MutationObserver((mutations) => {
        // Skip if we're already applying styles
        if (isApplyingStyles) return;
        
        // Process mutations:
        // 1. childList changes (new rows/columns added) - always process
        // 2. attribute changes that are NOT style/class (to avoid loops)
        const shouldProcess = mutations.some(mutation => {
          if (mutation.type === 'childList') {
            // New cells/rows added - always process
            return true;
          }
          if (mutation.type === 'attributes') {
            // Only process if it's NOT a style/class change (to avoid loops)
            return mutation.attributeName !== 'style' && mutation.attributeName !== 'class';
          }
          return false;
        });
        
        if (shouldProcess) {
          debouncedEnforce();
        }
      });
      
      observer.observe(editorElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
      
      return () => {
        if (styleTimeout) {
          clearTimeout(styleTimeout);
        }
        observer.disconnect();
        if (updateHandler && typeof updateHandler.off === 'function') {
          updateHandler.off('update');
        }
      };
    }
    
    return () => {
      if (styleTimeout) {
        clearTimeout(styleTimeout);
      }
      if (updateHandler && typeof updateHandler.off === 'function') {
        updateHandler.off('update');
      }
    };
  }, [editor]);

  // Setup column and cell resize handles
  useEffect(() => {
    if (!editor) return;
    
    let isSettingUpHandles = false; // Prevent infinite loop
    
    const setupResizeHandles = () => {
      if (isSettingUpHandles) return; // Guard against re-entry
      isSettingUpHandles = true;
      
      try {
        const editorElement = document.querySelector('.ProseMirror');
        if (!editorElement) return;
        
        // Setup column resize handles
        const tables = editorElement.querySelectorAll('table');
        tables.forEach(table => {
          // Skip if table already has handles
          if (table.dataset.handlesSetup === 'true') return;
          table.dataset.handlesSetup = 'true';
          
          // Column and row resize handles are now set up in the overlay container (see below)
          // This ensures they work regardless of edit mode and are never part of content
          // NOTE: The overlay container is created later in the code, so all handles are set up there
          
          // Setup cell resize handles
          // CRITICAL: Append handles to a container OUTSIDE the table, not to cells
          // This ensures they're never part of the cell content and won't be serialized
          const editorElement = document.querySelector('.ProseMirror');
          if (!editorElement) return;
          
          // CRITICAL: First, remove any existing ⋮ characters from cells
          // These might have been saved as text content previously
          table.querySelectorAll('td, th').forEach(cell => {
            // Remove any ⋮ characters that might be in the cell's text content
            const walker = document.createTreeWalker(
              cell,
              NodeFilter.SHOW_TEXT,
              null
            );
            
            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
              if (node.textContent.includes('⋮')) {
                textNodes.push(node);
              }
            }
            
            // Remove or clean text nodes containing ⋮
            textNodes.forEach(textNode => {
              const cleaned = textNode.textContent.replace(/⋮/g, '');
              if (cleaned.trim() === '') {
                // If only ⋮ was in the node, remove it
                textNode.remove();
              } else {
                // Otherwise, just remove the ⋮ character
                textNode.textContent = cleaned;
              }
            });
            
            // Also remove any resize handle divs that might be direct children of cells
            cell.querySelectorAll('.resize-handle-cell, [data-resize-handle]').forEach(handle => {
              handle.remove();
            });
          });
          
          // CRITICAL: Create overlay OUTSIDE of .ProseMirror to prevent TipTap from reading it
          // Find the editor's parent container
          const editorParent = editorElement.parentElement;
          if (!editorParent) return;
          
          // Find or create a container for resize handles OUTSIDE .ProseMirror
          let handlesContainer = editorParent.querySelector('.table-resize-handles-overlay');
          if (!handlesContainer) {
            handlesContainer = document.createElement('div');
            handlesContainer.className = 'table-resize-handles-overlay';
            handlesContainer.style.position = 'absolute';
            handlesContainer.style.top = '0';
            handlesContainer.style.left = '0';
            handlesContainer.style.right = '0';
            handlesContainer.style.bottom = '0';
            // CRITICAL: pointer-events: none on container allows clicks through to content
            // Individual handles have pointer-events: auto to be clickable
            handlesContainer.style.pointerEvents = 'none';
            handlesContainer.style.zIndex = '5'; // Lower z-index so content is above it
            editorParent.style.position = 'relative';
            editorParent.appendChild(handlesContainer);
          }
          
          // Setup column resize handles FIRST (before cell handles)
          // Setup column resize handles in overlay (not in cells)
          const columnHandles = [];
          table.querySelectorAll('td, th').forEach((cell, index) => {
            // Skip if this is not the first row (only add handles once per column)
            const row = cell.parentElement;
            if (row && row !== table.querySelector('tr')) return;
            
            // Check if handle already exists in overlay
            const existingHandle = handlesContainer.querySelector(`.resize-handle-column[data-column-index="${index}"]`);
            if (existingHandle) return;
            
            const handle = document.createElement('div');
            handle.className = 'resize-handle-column';
            handle.setAttribute('contenteditable', 'false');
            handle.setAttribute('data-column-index', index);
            
            // Position at the right edge of the column
            const updateColumnHandlePosition = () => {
              if (!cell || !handlesContainer || !editorParent) return;
              const cellRect = cell.getBoundingClientRect();
              const parentRect = editorParent.getBoundingClientRect();
              
              handle.style.position = 'absolute';
              handle.style.left = `${cellRect.right - parentRect.left - 2}px`;
              handle.style.top = `${cellRect.top - parentRect.top}px`;
              handle.style.width = '4px';
              handle.style.height = `${cellRect.height}px`;
              handle.style.cursor = 'col-resize';
              handle.style.zIndex = '6'; // Lower than content (files/images are z-index: 10)
              handle.style.pointerEvents = 'auto';
              handle.style.userSelect = 'none';
              handle.style.opacity = '0';
              handle.style.transition = 'opacity 0.2s';
              handle.style.background = 'rgba(20, 200, 0, 0.3)';
            };
            
            // Show on hover
            const showHandle = () => {
              handle.style.opacity = '1';
            };
            const hideHandle = () => {
              if (document.activeElement !== handle) {
                handle.style.opacity = '0';
              }
            };
            
            cell.addEventListener('mouseenter', showHandle);
            cell.addEventListener('mouseleave', hideHandle);
            handle.addEventListener('mouseenter', showHandle);
            handle.addEventListener('mouseleave', hideHandle);
            
            handle.addEventListener('mousedown', (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              const startX = e.clientX;
              const currentCell = cell;
              const nextCell = cell.nextElementSibling;
              const startWidth1 = currentCell.offsetWidth;
              const startWidth2 = nextCell ? nextCell.offsetWidth : 0;
              
              const onMouseMove = (moveEvent) => {
                const diff = moveEvent.clientX - startX;
                const newWidth1 = Math.max(50, startWidth1 + diff);
                const newWidth2 = nextCell ? Math.max(50, startWidth2 - diff) : 0;
                
                currentCell.style.width = `${newWidth1}px`;
                if (nextCell) {
                  nextCell.style.width = `${newWidth2}px`;
                  
                  // Apply to all cells in these columns
                  const rows = table.querySelectorAll('tr');
                  rows.forEach(row => {
                    if (row.children[index]) {
                      row.children[index].style.width = `${newWidth1}px`;
                    }
                    if (row.children[index + 1]) {
                      row.children[index + 1].style.width = `${newWidth2}px`;
                    }
                  });
                }
                updateColumnHandlePosition();
              };
              
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                // Trigger content update only after resize completes
                safeOnChange(editor.getHTML());
              };
              
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            });
            
            // Append to overlay, not to cell
            handlesContainer.appendChild(handle);
            updateColumnHandlePosition();
            columnHandles.push({ handle, cell, updatePosition: updateColumnHandlePosition });
          });
          
          // Setup row resize handles in overlay (not in rows)
          const rowHandles = [];
          const rows = Array.from(table.querySelectorAll('tr'));
          rows.forEach((row, rowIndex) => {
            if (rowIndex < rows.length - 1) { // Don't add handle after last row
              // Check if handle already exists in overlay
              const existingHandle = handlesContainer.querySelector(`.resize-handle-row[data-row-index="${rowIndex}"]`);
              if (existingHandle) return;
              
              const handle = document.createElement('div');
              handle.className = 'resize-handle-row';
              handle.setAttribute('contenteditable', 'false');
              handle.setAttribute('data-row-index', rowIndex);
              
              // Position at the bottom edge of the row
              const updateRowHandlePosition = () => {
                if (!row || !handlesContainer || !editorParent) return;
                const rowRect = row.getBoundingClientRect();
                const parentRect = editorParent.getBoundingClientRect();
                
                handle.style.position = 'absolute';
                handle.style.left = `${rowRect.left - parentRect.left}px`;
                handle.style.top = `${rowRect.bottom - parentRect.top - 2}px`;
                handle.style.width = `${rowRect.width}px`;
                handle.style.height = '4px';
                handle.style.cursor = 'row-resize';
                handle.style.zIndex = '6'; // Lower than content (files/images are z-index: 10)
                handle.style.pointerEvents = 'auto';
                handle.style.userSelect = 'none';
                handle.style.opacity = '0';
                handle.style.transition = 'opacity 0.2s';
                handle.style.background = 'rgba(20, 200, 0, 0.3)';
              };
              
              // Show on hover
              const showHandle = () => {
                handle.style.opacity = '1';
              };
              const hideHandle = () => {
                if (document.activeElement !== handle) {
                  handle.style.opacity = '0';
                }
              };
              
              row.addEventListener('mouseenter', showHandle);
              row.addEventListener('mouseleave', hideHandle);
              handle.addEventListener('mouseenter', showHandle);
              handle.addEventListener('mouseleave', hideHandle);
              
              handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const startY = e.clientY;
                const currentRow = rows[rowIndex];
                const nextRow = rows[rowIndex + 1];
                const startHeight1 = currentRow.offsetHeight;
                const startHeight2 = nextRow.offsetHeight;
                
                const onMouseMove = (moveEvent) => {
                  const diff = moveEvent.clientY - startY;
                  const newHeight1 = Math.max(30, startHeight1 + diff);
                  const newHeight2 = Math.max(30, startHeight2 - diff);
                  
                  currentRow.style.height = `${newHeight1}px`;
                  nextRow.style.height = `${newHeight2}px`;
                  
                  // Apply height to all cells in these rows
                  Array.from(currentRow.children).forEach(cell => {
                    cell.style.height = `${newHeight1}px`;
                  });
                  Array.from(nextRow.children).forEach(cell => {
                    cell.style.height = `${newHeight2}px`;
                  });
                  
                  updateRowHandlePosition();
                };
                
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                  
                  safeOnChange(editor.getHTML());
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              });
              
              // Append to overlay, not to row
              handlesContainer.appendChild(handle);
              updateRowHandlePosition();
              rowHandles.push({ handle, row, updatePosition: updateRowHandlePosition });
            }
          });
          
          table.querySelectorAll('td, th').forEach((cell, cellIndex) => {
            // Use a unique identifier for this cell
            const cellId = `cell-${cellIndex}-${Date.now()}`;
            cell.setAttribute('data-cell-id', cellId);
            
            // Check if handle already exists in the overlay
            const existingHandle = handlesContainer.querySelector(`.resize-handle-cell[data-cell-id="${cellId}"]`);
            if (existingHandle) return;
            
            const handle = document.createElement('div');
            handle.className = 'resize-handle-cell';
            handle.setAttribute('data-cell-id', cellId);
            handle.setAttribute('contenteditable', 'false');
            // CRITICAL: Never use innerHTML with ⋮ character - it can be read by TipTap
            // Instead, use CSS ::before pseudo-element to display the character
            // The handle itself has NO text content
            
            // Position absolutely relative to the cell
            // CRITICAL: Calculate position relative to editor parent (where overlay is)
            const updateHandlePosition = () => {
              if (!cell || !handlesContainer || !editorParent) return;
              const cellRect = cell.getBoundingClientRect();
              const parentRect = editorParent.getBoundingClientRect();
              
              handle.style.position = 'absolute';
              handle.style.left = `${cellRect.right - parentRect.left - 16}px`;
              handle.style.top = `${cellRect.top - parentRect.top}px`;
              // All other styles are handled by CSS
            };
            
            // Show on hover
            const showHandle = () => {
              handle.style.opacity = '1';
            };
            const hideHandle = () => {
              if (document.activeElement !== handle) {
                handle.style.opacity = '0';
              }
            };
            
            cell.addEventListener('mouseenter', showHandle);
            cell.addEventListener('mouseleave', hideHandle);
            handle.addEventListener('mouseenter', showHandle);
            handle.addEventListener('mouseleave', hideHandle);
            
            handle.addEventListener('mousedown', (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              const startX = e.clientX;
              const startWidth = cell.offsetWidth;
              
              const onMouseMove = (moveEvent) => {
                const diff = moveEvent.clientX - startX;
                const newWidth = Math.max(50, startWidth + diff);
                cell.style.width = `${newWidth}px`;
                updateHandlePosition();
              };
              
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                // Trigger content update only after resize completes
                safeOnChange(editor.getHTML());
              };
              
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            });
            
            // Append to overlay container, NOT to cell
            handlesContainer.appendChild(handle);
            updateHandlePosition();
            
            // Update position when cell resizes or editor scrolls
            const resizeObserver = new ResizeObserver(() => {
              updateHandlePosition();
            });
            resizeObserver.observe(cell);
            handle._resizeObserver = resizeObserver;
            
            // Also update on scroll
            const updateOnScroll = () => updateHandlePosition();
            editorElement.addEventListener('scroll', updateOnScroll);
            handle._scrollHandler = updateOnScroll;
          });
        });
      } finally {
        isSettingUpHandles = false;
      }
    };
    
    // Setup on mount
    setTimeout(setupResizeHandles, 100);
    
    // Setup on content changes, but with debouncing
    let setupTimeout;
    const updateHandler = editor.on('update', ({ transaction }) => {
      // Only setup handles if there was an actual content change, not just a selection change
      if (transaction.docChanged) {
        clearTimeout(setupTimeout);
        setupTimeout = setTimeout(setupResizeHandles, 300);
      }
    });
    
    return () => {
      clearTimeout(setupTimeout);
      if (updateHandler && typeof updateHandler.off === 'function') {
        updateHandler.off('update');
      }
    };
  }, [editor]); // safeOnChange is stable
  
  // Apply Prism syntax highlighting when content changes and attach event handlers
  useEffect(() => {
    if (!editor) return;

    // Store editor and showNotification in window for access by one-time file delete handler
    window._richTextEditor = editor;
    window._showNotification = showNotification;

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
      // Store reference globally so it can be called from ProseMirror's handleClick
      window._codeBlockClickHandler = handleCodeBlockClick;
      editorElement.addEventListener('click', handleCodeBlockClick);

      // NOTE: File delete handler is now set up in separate one-time useEffect
      // This prevents the handler from being cleaned up and re-attached on every re-render

      // Add delete buttons to existing file attachments that don't have them
      const addDeleteButtonsToExistingFiles = () => {
        const fileCards = editorElement.querySelectorAll('.file-attachment-card');

        // Only log if there are file cards and we're actually doing something
        let buttonsAdded = 0;

        fileCards.forEach(card => {
          // Check if delete button already exists
          let deleteBtn = card.querySelector('.file-delete-btn');
          if (!deleteBtn) {
            buttonsAdded++;

            // Create delete button (no event handler needed - using event delegation)
            deleteBtn = document.createElement('button');
            deleteBtn.className = 'file-delete-btn';
            deleteBtn.type = 'button';
            deleteBtn.title = 'Remove file';
            deleteBtn.innerHTML = `
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            `;

            // Append to card (event handler is attached via delegation on parent)
            card.appendChild(deleteBtn);
          }
          // Button already exists (created by renderHTML) - no action needed
          // Event delegation on parent handles all clicks
        });

        // Only log when we actually added buttons
        if (buttonsAdded > 0) {
          console.log('[FILE DELETE] Added delete buttons to', buttonsAdded, 'file card(s)');
        }
      };

      // Run immediately to ensure buttons exist
      addDeleteButtonsToExistingFiles();

      // Run after editor updates to add buttons to new file attachments
      if (editor) {
        editor.on('update', () => {
          addDeleteButtonsToExistingFiles();
        });
      }
    }

    // Old code below - to be removed in cleanup
    if (false) {
      const documentClickHandler = (e) => {
        // Log ALL clicks to see what's happening (but only for debugging)
        const target = e.target;
        
        // Check if click is on a delete button or its children (SVG, path, etc.)
        // CRITICAL: Check multiple ways to ensure we catch it
        const deleteBtn = target.closest('.file-delete-btn') || 
                         (target.classList && target.classList.contains('file-delete-btn') ? target : null) ||
                         (target.parentElement && target.parentElement.classList && target.parentElement.classList.contains('file-delete-btn') ? target.parentElement : null);
        
        if (!deleteBtn) {
          // Not a delete button - return early (but log occasionally for debugging)
          return;
        }
        
        // CRITICAL: Process immediately - don't check for existing handlers
        // This ensures the click is handled even if button handlers aren't attached yet
        console.log('[FILE DELETE] 🎯🎯🎯 DOCUMENT HANDLER FIRED! Delete button click detected!', {
          target: target.tagName,
          targetClass: target.className,
          button: deleteBtn,
          buttonClass: deleteBtn.className,
          hasHandler: deleteBtn.hasAttribute('data-handler-attached') ||
                     deleteBtn.hasAttribute('data-handler-attached-mutation') ||
                     deleteBtn.hasAttribute('data-handler-attached-render'),
          eventPhase: e.eventPhase,
          isInTableCell: deleteBtn.closest('td, th') !== null,
          buttonOnclick: deleteBtn.getAttribute('onclick')
        });
        
        // CRITICAL: Stop all propagation immediately to prevent other handlers from interfering
        // This must happen BEFORE any other processing
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        console.log('[FILE DELETE] 🎯 DOCUMENT HANDLER: Processing delete button click (after stopPropagation)');
        
        const fileCard = deleteBtn.closest('.file-attachment-card');
        if (fileCard && editor) {
          try {
            const { state, view } = editor.view;
            let filePos = null;
            const fileId = fileCard.getAttribute('data-component-id');
            const fileUrl = fileCard.getAttribute('data-fileurl');
            const cell = fileCard.closest('td, th');
            const isInTableCell = cell !== null;
            
            if (isInTableCell) {
              let cellPos = null;
              state.doc.descendants((node, pos) => {
                if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                  try {
                    const domNode = view.nodeDOM(pos);
                    if (domNode && (domNode === cell || cell.contains(domNode))) {
                      cellPos = pos;
                      return false;
                    }
                  } catch (err) {
                    return false;
                  }
                }
              });
              
              if (cellPos !== null) {
                const cellNode = state.doc.nodeAt(cellPos);
                if (cellNode) {
                  const cellStart = cellPos + 1;
                  const cellEnd = cellPos + cellNode.nodeSize - 1;
                  state.doc.nodesBetween(cellStart, cellEnd, (node, pos) => {
                    if (node.type.name === 'fileAttachment') {
                      const matches = (fileId && node.attrs['data-component-id'] === fileId) ||
                                   (fileUrl && node.attrs.fileurl === fileUrl);
                      if (matches && filePos === null) {
                        filePos = pos;
                        return false;
                      }
                    }
                  });
                }
              }
            } else {
              state.doc.descendants((node, pos) => {
                if (node.type.name === 'fileAttachment') {
                  const matches = (fileId && node.attrs['data-component-id'] === fileId) ||
                               (fileUrl && node.attrs.fileurl === fileUrl);
                  if (matches && filePos === null) {
                    filePos = pos;
                    return false;
                  }
                }
              });
            }
            
            if (filePos !== null && filePos >= 0 && filePos < state.doc.content.size) {
              const nodeAtPos = state.doc.nodeAt(filePos);
              if (nodeAtPos && nodeAtPos.type.name === 'fileAttachment') {
                const matches = (fileId && nodeAtPos.attrs['data-component-id'] === fileId) ||
                             (fileUrl && nodeAtPos.attrs.fileurl === fileUrl);
                if (matches) {
                  const tr = state.tr.delete(filePos, filePos + nodeAtPos.nodeSize);
                  editor.view.dispatch(tr);
                  console.log('[FILE DELETE] ✅ File deleted via document handler');
                  showNotification('File Removed', 'File attachment removed from content', 'success');
                }
              }
            }
          } catch (error) {
            console.error('[FILE DELETE] Error in document handler:', error);
          }
        }
      };
      
      // Attach document-level handler in capture phase (runs before all other handlers)
      // CRITICAL: This must run BEFORE the cell click handler and ProseMirror handlers
      // Use capture phase with high priority by attaching early
      // CRITICAL: Attach to window FIRST (highest priority in capture phase)
      window.addEventListener('click', documentClickHandler, true);
      console.log('[FILE DELETE] ✅ Window-level click handler attached in capture phase');
      
      // Then attach to document (still capture phase, but window runs first)
      document.addEventListener('click', documentClickHandler, true);
      console.log('[FILE DELETE] ✅ Document-level click handler attached in capture phase');
      
      // CRITICAL: Also attach directly to the editor element in capture phase
      // This ensures we catch clicks even if document/window handlers are blocked
      if (editorElement) {
        editorElement.addEventListener('click', documentClickHandler, true);
        console.log('[FILE DELETE] ✅ Editor-level click handler attached in capture phase');
      }
      
      // Handle file attachment card delete button clicks
      // CRITICAL: Use capture phase on document to catch clicks before other handlers
      const handleFileDelete = (e) => {
        const target = e.target;
        
        // DEBUG: Log ALL clicks to see what's happening
        const isDeleteBtn = target.classList.contains('file-delete-btn') || 
                           target.closest('.file-delete-btn') !== null ||
                           (target.tagName === 'svg' && target.closest('.file-delete-btn') !== null) ||
                           (target.tagName === 'path' && target.closest('.file-delete-btn') !== null);
        
        // Log delete button clicks immediately (even if we return early)
        if (isDeleteBtn) {
          console.log('[FILE DELETE] 🎯 HANDLER CALLED - Delete button click!', {
            target: target.tagName,
            targetClass: target.className,
            isInTableCell: target.closest('td, th') !== null,
            eventPhase: e.eventPhase,
            currentTarget: e.currentTarget?.tagName || 'unknown'
          });
        }
        
        // Only process if it's actually a delete button click
        if (!isDeleteBtn) {
          return; // Not a delete button click, ignore silently
        }
        
        // Get delete button element
        const deleteBtn = target.closest('.file-delete-btn');
        
        // Get the actual button element (deleteBtn already found above)
        if (!deleteBtn && !target.classList.contains('file-delete-btn')) {
          console.log('[FILE DELETE] ⚠️ Could not find delete button element');
          return;
        }
        
        // Get the actual button element
        const actualDeleteBtn = deleteBtn || (target.classList.contains('file-delete-btn') ? target : null);
        if (!actualDeleteBtn) {
          console.log('[FILE DELETE] ⚠️ actualDeleteBtn is null');
          return;
        }
        
        console.log('[FILE DELETE] ✅ Processing delete for button:', actualDeleteBtn);
        
          e.preventDefault();
          e.stopPropagation();
        e.stopImmediatePropagation(); // CRITICAL: Stop all other handlers
        
        const fileCard = actualDeleteBtn.closest('.file-attachment-card');
        if (fileCard && editor) {
          console.log('[FILE DELETE] Delete button clicked, removing file attachment card');
          
          try {
            // CRITICAL: Use TipTap commands to delete the node, not DOM manipulation
            // This ensures the document model is properly updated, especially in table cells
            const { state, view } = editor.view;
            
            // Find the file node position in the document
            let filePos = null;
            const fileId = fileCard.getAttribute('data-component-id');
            const fileUrl = fileCard.getAttribute('data-fileurl');
            
            // CRITICAL: Check if file is inside a table cell
            const cell = fileCard.closest('td, th');
            const isInTableCell = cell !== null;
            
            console.log('[FILE DELETE] File in table cell:', isInTableCell, 'fileId:', fileId, 'fileUrl:', fileUrl);
            
            if (isInTableCell) {
              // File is in a table cell - need to find the cell position first
              let cellPos = null;
              
              // Find the table cell node position
              state.doc.descendants((node, pos) => {
                if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                  try {
                    const domNode = view.nodeDOM(pos);
                    if (domNode && (domNode === cell || cell.contains(domNode))) {
                      cellPos = pos;
                      console.log('[FILE DELETE] Found cell at position:', cellPos);
                      return false; // Stop searching
                    }
                  } catch (err) {
                    console.warn('[FILE DELETE] Error accessing cell DOM:', err);
                    return false;
                  }
                }
              });
              
              if (cellPos !== null) {
                // Search for the file node within this cell using nodesBetween for absolute positions
                const cellNode = state.doc.nodeAt(cellPos);
                if (cellNode) {
                  const cellStart = cellPos + 1; // Content starts after node opening
                  const cellEnd = cellPos + cellNode.nodeSize - 1; // Content ends before node closing
                  
                  console.log('[FILE DELETE] Searching in cell from', cellStart, 'to', cellEnd);
                  
                  // Use nodesBetween to get absolute positions within the cell
                  state.doc.nodesBetween(cellStart, cellEnd, (node, pos) => {
                    if (node.type.name === 'fileAttachment') {
                      const matches = (fileId && node.attrs['data-component-id'] === fileId) ||
                                     (fileUrl && node.attrs.fileurl === fileUrl);
                      if (matches && filePos === null) {
                        filePos = pos;
                        console.log('[FILE DELETE] Found file in cell at absolute position:', filePos);
                        return false; // Stop searching
                      }
                    }
                  });
                }
              }
            } else {
              // File is not in a table cell - use standard search
              console.log('[FILE DELETE] File not in table cell, searching document...');
              state.doc.descendants((node, pos) => {
                if (node.type.name === 'fileAttachment') {
                  // Match by data-component-id or fileurl
                  const matches = (fileId && node.attrs['data-component-id'] === fileId) ||
                                 (fileUrl && node.attrs.fileurl === fileUrl);
                  if (matches && filePos === null) {
                    filePos = pos;
                    console.log('[FILE DELETE] Found file at document position:', filePos);
                    return false; // Stop searching
                  }
                }
              });
            }
            
            if (filePos !== null && filePos >= 0 && filePos < state.doc.content.size) {
              // Verify the node at this position is actually a file attachment
              const nodeAtPos = state.doc.nodeAt(filePos);
              if (nodeAtPos && nodeAtPos.type.name === 'fileAttachment') {
                // Verify it's the right file
                const matches = (fileId && nodeAtPos.attrs['data-component-id'] === fileId) ||
                               (fileUrl && nodeAtPos.attrs.fileurl === fileUrl);
                if (matches) {
                  // Delete the node using TipTap transaction
                  const tr = state.tr.delete(filePos, filePos + nodeAtPos.nodeSize);
                  editor.view.dispatch(tr);
                  
                  console.log('[FILE DELETE] File node deleted at position:', filePos);
                  showNotification('File Removed', 'File attachment removed from content', 'success');
                } else {
                  console.warn('[FILE DELETE] Node at position does not match file attributes');
                  // Fallback: try DOM removal
                  fileCard.remove();
                  const updatedHtml = editor.getHTML();
                  safeOnChange(updatedHtml);
            showNotification('File Removed', 'File attachment removed from content', 'success');
                }
              } else {
                console.warn('[FILE DELETE] Node at position is not a file attachment:', nodeAtPos?.type?.name);
                // Fallback: try DOM removal
                fileCard.remove();
                const updatedHtml = editor.getHTML();
                safeOnChange(updatedHtml);
                showNotification('File Removed', 'File attachment removed from content', 'success');
              }
            } else {
              console.warn('[FILE DELETE] Could not find file node in document (pos:', filePos, 'docSize:', state.doc.content.size, '), using DOM removal');
              // Fallback: use DOM removal if we can't find the node
              fileCard.remove();
              const updatedHtml = editor.getHTML();
              safeOnChange(updatedHtml);
              showNotification('File Removed', 'File attachment removed from content', 'success');
            }
          } catch (error) {
            console.error('[FILE DELETE] Error deleting file:', error);
            // Fallback: use DOM removal on error
            try {
              fileCard.remove();
              const updatedHtml = editor.getHTML();
              safeOnChange(updatedHtml);
              showNotification('File Removed', 'File attachment removed from content', 'success');
            } catch (fallbackError) {
              console.error('[FILE DELETE] Fallback deletion also failed:', fallbackError);
              showNotification('Error', 'Failed to remove file attachment', 'error');
            }
          }
        }
      };
      
      // CRITICAL: Attach to document with capture phase to catch clicks before table handlers
      // This ensures delete button clicks work even inside table cells
      console.log('[FILE DELETE] 📌 Attaching event listeners for file delete');
      
      // DEBUG: Add a test handler to see if ANY clicks are being registered
      const testClickHandler = (e) => {
        const target = e.target;
        const isDeleteBtn = target.classList.contains('file-delete-btn') || 
                           target.closest('.file-delete-btn') !== null;
        if (isDeleteBtn) {
          console.log('[FILE DELETE] 🔍 TEST HANDLER: Delete button click detected!', {
            target: target.tagName,
            targetClass: target.className,
            eventPhase: e.eventPhase,
            bubbles: e.bubbles,
            cancelable: e.cancelable,
            defaultPrevented: e.defaultPrevented
          });
        }
      };
      
      // Attach test handler first (before our main handler)
      document.addEventListener('click', testClickHandler, true);
      
      // Now attach our main handler
      document.addEventListener('click', handleFileDelete, true); // true = capture phase
      
      // Also attach to editorElement as fallback (but capture phase should catch it first)
      editorElement.addEventListener('click', handleFileDelete);
      
      // Store test handler for cleanup
      window._fileDeleteTestHandler = testClickHandler;
      
      // CRITICAL: Use MutationObserver to ensure handlers are attached to ALL delete buttons
      // This catches buttons that are added after initial render
      const attachHandlerToButton = (btn) => {
        if (!btn) return;
        
        // Check if handler is already attached (check all possible flags)
        if (btn.hasAttribute('data-handler-attached-mutation') ||
            btn.hasAttribute('data-handler-attached-render') ||
            btn.hasAttribute('data-handler-attached')) {
          return; // Already has handler, skip
        }
        
        console.log('[FILE DELETE] 🔧 MutationObserver: Attaching handler to button');
        
        // Set flag IMMEDIATELY to prevent re-attachment
        btn.setAttribute('data-handler-attached-mutation', 'true');
        
        const mutationHandler = (e) => {
          console.log('[FILE DELETE] 🎯 MUTATION HANDLER CLICK! Event received!', {
            button: btn,
            isInTableCell: btn.closest('td, th') !== null,
            eventPhase: e.eventPhase,
            target: e.target.tagName,
            currentTarget: e.currentTarget?.tagName
          });
          
          // CRITICAL: Stop everything immediately
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          const fileCard = btn.closest('.file-attachment-card');
          if (fileCard && editor) {
            console.log('[FILE DELETE] Processing delete via mutation handler');
            // Use the same deletion logic as directButtonHandler
            try {
              const { state, view } = editor.view;
              let filePos = null;
              const fileId = fileCard.getAttribute('data-component-id');
              const fileUrl = fileCard.getAttribute('data-fileurl');
              const cell = fileCard.closest('td, th');
              const isInTableCell = cell !== null;
              
              if (isInTableCell) {
                let cellPos = null;
                state.doc.descendants((node, pos) => {
                  if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                    try {
                      const domNode = view.nodeDOM(pos);
                      if (domNode && (domNode === cell || cell.contains(domNode))) {
                        cellPos = pos;
                        return false;
                      }
                    } catch (err) {
                      return false;
                    }
                  }
                });
                
                if (cellPos !== null) {
                  const cellNode = state.doc.nodeAt(cellPos);
                  if (cellNode) {
                    const cellStart = cellPos + 1;
                    const cellEnd = cellPos + cellNode.nodeSize - 1;
                    state.doc.nodesBetween(cellStart, cellEnd, (node, pos) => {
                      if (node.type.name === 'fileAttachment') {
                        const matches = (fileId && node.attrs['data-component-id'] === fileId) ||
                                     (fileUrl && node.attrs.fileurl === fileUrl);
                        if (matches && filePos === null) {
                          filePos = pos;
                          return false;
                        }
                      }
                    });
                  }
                }
              } else {
                state.doc.descendants((node, pos) => {
                  if (node.type.name === 'fileAttachment') {
                    const matches = (fileId && node.attrs['data-component-id'] === fileId) ||
                                 (fileUrl && node.attrs.fileurl === fileUrl);
                    if (matches && filePos === null) {
                      filePos = pos;
                      return false;
                    }
                  }
                });
              }
              
              if (filePos !== null && filePos >= 0 && filePos < state.doc.content.size) {
                const nodeAtPos = state.doc.nodeAt(filePos);
                if (nodeAtPos && nodeAtPos.type.name === 'fileAttachment') {
                  const matches = (fileId && nodeAtPos.attrs['data-component-id'] === fileId) ||
                               (fileUrl && nodeAtPos.attrs.fileurl === fileUrl);
                  if (matches) {
                    const tr = state.tr.delete(filePos, filePos + nodeAtPos.nodeSize);
                    editor.view.dispatch(tr);
                    console.log('[FILE DELETE] ✅ File deleted via mutation handler');
                    showNotification('File Removed', 'File attachment removed from content', 'success');
                  }
                }
              }
            } catch (error) {
              console.error('[FILE DELETE] Error in mutation handler:', error);
            }
          }
        };
        
        // Attach in both phases
        btn.addEventListener('click', mutationHandler, true);
        btn.addEventListener('click', mutationHandler, false);
        btn.addEventListener('mousedown', (e) => {
          console.log('[FILE DELETE] 🖱️ MUTATION MOUSEDOWN!');
          e.preventDefault();
          e.stopPropagation();
          setTimeout(() => btn.click(), 0);
        }, true);
      };
      
      // CRITICAL: Attach handlers to existing buttons IMMEDIATELY
      // This ensures buttons that are already in the DOM have handlers before user clicks
      const existingButtons = editorElement.querySelectorAll('.file-delete-btn');
      console.log('[FILE DELETE] Found', existingButtons.length, 'existing delete buttons');
      existingButtons.forEach((btn, index) => {
        console.log(`[FILE DELETE] Processing button ${index + 1}/${existingButtons.length}`, {
          hasHandler: btn.hasAttribute('data-handler-attached') || 
                     btn.hasAttribute('data-handler-attached-mutation') ||
                     btn.hasAttribute('data-handler-attached-render')
        });
        attachHandlerToButton(btn);
      });
      
      // Watch for new buttons (with debouncing to prevent loops)
      let observerTimeout;
      const observer = new MutationObserver((mutations) => {
        // Debounce to prevent rapid-fire re-attachments
        clearTimeout(observerTimeout);
        observerTimeout = setTimeout(() => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) { // Element node
                // Only process if it's actually a button or contains buttons
                if (node.classList && node.classList.contains('file-delete-btn')) {
                  attachHandlerToButton(node);
                } else {
                  // Check children, but only if the node itself isn't being modified by our handlers
                  // Skip if node was just modified (to prevent loops)
                  if (!node.hasAttribute('data-handler-attached-render') &&
                      !node.hasAttribute('data-handler-attached-mutation')) {
                    const buttons = node.querySelectorAll && node.querySelectorAll('.file-delete-btn');
                    if (buttons) {
                      buttons.forEach(attachHandlerToButton);
                    }
                  }
                }
              }
            });
          });
        }, 50); // 50ms debounce
      });
      
      observer.observe(editorElement, { 
        childList: true, 
        subtree: true,
        // Don't observe attribute changes to prevent loops from our own attribute setting
        attributes: false
      });
      
      // DEBUG: Test if handler is working
      console.log('[FILE DELETE] ✅ Event listeners attached. Testing handler...');
      setTimeout(() => {
        const testBtn = editorElement.querySelector('.file-delete-btn');
        if (testBtn) {
          console.log('[FILE DELETE] 🧪 Found delete button in DOM:', testBtn);
          console.log('[FILE DELETE] 🧪 Button computed styles:', {
            pointerEvents: window.getComputedStyle(testBtn).pointerEvents,
            zIndex: window.getComputedStyle(testBtn).zIndex,
            position: window.getComputedStyle(testBtn).position,
            display: window.getComputedStyle(testBtn).display,
            visibility: window.getComputedStyle(testBtn).visibility
          });
          console.log('[FILE DELETE] 🧪 Button has mutation handler:', testBtn.hasAttribute('data-handler-attached-mutation'));
        } else {
          console.log('[FILE DELETE] ⚠️ No delete button found in DOM');
        }
      }, 500);
      
      // Store observer for cleanup
      window._fileDeleteObserver = observer;
      
      // Store cleanup function to be called by parent useEffect
      window._fileDeleteCleanup = () => {
        console.log('[FILE DELETE] 🧹 Cleaning up event listeners');
        document.removeEventListener('click', documentClickHandler, true);
        window.removeEventListener('click', documentClickHandler, true);
        document.removeEventListener('click', handleFileDelete, true);
        document.removeEventListener('click', window._fileDeleteTestHandler, true);
        editorElement.removeEventListener('click', handleFileDelete);
        if (window._fileDeleteObserver) {
          window._fileDeleteObserver.disconnect();
          delete window._fileDeleteObserver;
        }
        delete window._fileDeleteCleanup;
        delete window._fileDeleteTestHandler;
      };
    } // End of if (false) block - old code disabled

    // Click outside to deselect images
    const editorElForImages = document.querySelector('.ProseMirror');
    if (editorElForImages) {
      const handleImageDeselect = (e) => {
        if (!e.target.closest('.image-resize-wrapper')) {
          document.querySelectorAll('.image-resize-wrapper').forEach(w => {
            w.classList.remove('selected');
          });
        }
      };
      editorElForImages.addEventListener('click', handleImageDeselect);
      
      // Store cleanup for image deselect handler
      if (!window._imageDeselectCleanup) {
        window._imageDeselectCleanup = () => {
          if (editorElForImages) {
            editorElForImages.removeEventListener('click', handleImageDeselect);
          }
          delete window._imageDeselectCleanup;
        };
      }
    }

    // Re-attach handlers on content updates
    const updateHandler = editor.on('update', () => {
      highlightCodeBlocks();
    });

    return () => {
      // Clean up event listener
      if (editorElement) {
        editorElement.removeEventListener('click', handleCodeBlockClick);
      }
      
      if (updateHandler && typeof updateHandler.off === 'function') {
        updateHandler.off('update');
      }

      // NOTE: File delete handler cleanup is now handled by separate useEffect (one-time setup)
      // No need to clean it up here as it should persist across re-renders

      // Clean up image deselect handlers (if they were set up)
      if (window._imageDeselectCleanup) {
        window._imageDeselectCleanup();
      }
    };
  }, [editor, showNotification, handleCodeBlockClick]); // safeOnChange is stable, onChange not used directly

  // ONE-TIME SETUP: File delete event delegation handler
  // This runs ONCE on mount and never gets cleaned up until component unmount
  // This prevents the handler from being removed/re-attached when editor/props change
  useEffect(() => {
    console.log('[FILE DELETE] 🚀 Setting up one-time event delegation handler');

    // CRITICAL: Use event delegation for file delete buttons
    // This ensures handlers work even when ProseMirror re-renders and replaces DOM elements
    const handleFileDeleteClick = (e) => {
      // DEBUG: Log EVERY click to window to verify handler is attached and running
      const inCell = e.target.closest && e.target.closest('td, th');
      if (inCell) {
        console.log('[FILE DELETE WINDOW] Click in cell detected:', {
          target: e.target.tagName,
          targetClass: e.target.className,
          hasClosest: !!e.target.closest,
          phase: e.eventPhase
        });
      }

      // DEBUG: Log every delete button click to see if handler is being called
      if (e.target.classList && e.target.classList.contains('file-delete-btn') || e.target.closest && e.target.closest('.file-delete-btn')) {
        console.log('[FILE DELETE] 🔍 Handler invoked! Event phase:', e.eventPhase, 'defaultPrevented:', e.defaultPrevented, 'propagationStopped:', e.cancelBubble);
      }

      // Check if click is on or inside a delete button
      const deleteBtn = e.target.closest ? e.target.closest('.file-delete-btn') : null;
      if (!deleteBtn) return; // Not a delete button click

      console.log('[FILE DELETE] 🎯 DELETE BUTTON CLICKED (event delegation)!', {
        target: e.target.tagName,
        button: deleteBtn,
        isInTableCell: deleteBtn.closest('td, th') !== null
      });

      // CRITICAL: Prevent default and stop all propagation
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Find the file attachment card
      const fileCard = deleteBtn.closest('.file-attachment-card');
      if (!fileCard) {
        console.error('[FILE DELETE] ❌ Could not find file-attachment-card');
        return;
      }

      // Get file info
      const fileUrl = fileCard.getAttribute('data-fileurl');
      const fileName = fileCard.getAttribute('data-filename');
      const fileId = fileCard.getAttribute('data-component-id');

      console.log('[FILE DELETE] 📋 File info:', { fileUrl, fileName, fileId });

      if (!fileUrl && !fileId) {
        console.error('[FILE DELETE] ❌ No fileUrl or fileId found');
        return;
      }

      // Get current editor instance
      const currentEditor = window._richTextEditor;
      if (!currentEditor) {
        console.error('[FILE DELETE] ❌ No editor instance found');
        return;
      }

      console.log('[FILE DELETE] 🔍 Searching for file node in ProseMirror document...');

      // Check if this is inside a table cell
      const isInTableCell = deleteBtn.closest('td, th') !== null;

      // Find and delete the file attachment node
      const { state } = currentEditor;
      let filePos = null;

      // SIMPLIFIED: Search all fileAttachment nodes regardless of table location
      // The fileId/fileUrl matching ensures we delete the correct one
      console.log('[FILE DELETE] 🔍 Searching for matching node (isInTableCell:', isInTableCell, ')...');
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'fileAttachment') {
          const matches = (fileId && node.attrs['data-component-id'] === fileId) ||
                       (fileUrl && node.attrs.fileurl === fileUrl);
          console.log('[FILE DELETE] 🔍 Checking node at pos', pos, ':', {
            nodeId: node.attrs['data-component-id'],
            nodeUrl: node.attrs.fileurl,
            searchId: fileId,
            searchUrl: fileUrl,
            matches
          });
          if (matches && filePos === null) {
            filePos = pos;
            console.log('[FILE DELETE] 🔍 ✅ Match found at position:', filePos);
            return false; // Stop searching
          }
        }
      });

      if (filePos !== null) {
        console.log('[FILE DELETE] 🗑️ Deleting node at position:', filePos);
        const tr = state.tr.delete(filePos, filePos + 1);
        currentEditor.view.dispatch(tr);
        console.log('[FILE DELETE] ✅ File deleted successfully');

        // Show success notification if available
        if (window._showNotification) {
          window._showNotification('File Removed', 'File attachment removed from content', 'success');
        }
      } else {
        console.error('[FILE DELETE] ❌ Could not find matching fileAttachment node in document');
        console.log('[FILE DELETE] 📊 Document structure:');
        state.doc.descendants((node, pos) => {
          if (node.type.name === 'fileAttachment') {
            console.log('[FILE DELETE]   - fileAttachment at pos', pos, ':', {
              id: node.attrs['data-component-id'],
              url: node.attrs.fileurl,
              filename: node.attrs.filename
            });
          }
        });
      }
    };

    // CRITICAL: Attach to WINDOW in capture phase for highest priority
    // Window capture phase runs before document, before editor, before everything
    // Only attach once (this useEffect runs once due to empty dependency array)
    window.addEventListener('click', handleFileDeleteClick, true);
    console.log('[FILE DELETE] ✅ Event delegation handler attached to WINDOW (capture phase)');

    // ALSO attach to ProseMirror element as fallback for clicks inside contenteditable=false elements in cells
    // These might not bubble to window due to contenteditable boundary issues
    setTimeout(() => {
      const proseMirrorEl = document.querySelector('.ProseMirror');
      if (proseMirrorEl) {
        proseMirrorEl.addEventListener('click', handleFileDeleteClick, true);
        console.log('[FILE DELETE] ✅ FALLBACK handler attached to .ProseMirror element (capture phase)');
      }
    }, 100);

    // Store references for debugging
    window._fileDeleteDelegatedHandler = handleFileDeleteClick;
    window._fileDeleteDelegatedHandlerElement = window;

    // Cleanup ONLY on component unmount (not on re-renders)
    return () => {
      console.log('[FILE DELETE] 🧹 Component unmounting - cleaning up delegated event handler');
      window.removeEventListener('click', handleFileDeleteClick, true);

      // Also remove fallback handler from ProseMirror element
      const proseMirrorEl = document.querySelector('.ProseMirror');
      if (proseMirrorEl) {
        proseMirrorEl.removeEventListener('click', handleFileDeleteClick, true);
      }

      delete window._fileDeleteDelegatedHandler;
      delete window._fileDeleteDelegatedHandlerElement;
    };
  }, []); // Empty dependency array - runs ONCE on mount, cleanup on unmount only

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
          console.log('[IMAGE] Inserting base64 image for new section, size:', base64.length);
          editor.chain().focus().setImage({ src: base64 }).run();
          
          // Trigger onChange to update parent component
            setTimeout(() => {
              const html = editor.getHTML();
              console.log('[IMAGE] Triggering onChange after image insertion, HTML length:', html.length);
            safeOnChange(html);
            }, 100);
          
          showNotification('Image Added', 'Image will be embedded in section content', 'success');
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

    // If no sectionId, store as pending file
    if (!sectionId) {
      const pendingFile = {
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        id: `pending-${Date.now()}`
      };

      const updatedPendingFiles = [...pendingFiles, pendingFile];
      setPendingFiles(updatedPendingFiles);

      // Notify parent component
      if (onPendingFilesChange) {
        onPendingFilesChange(updatedPendingFiles);
      }

      showNotification('File Added', `${file.name} will be uploaded when section is saved`, 'success');

      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

      // Build file URL
      const cleanPath = (response.file_path || response.path).startsWith('/') 
        ? (response.file_path || response.path).substring(1) 
        : (response.file_path || response.path);
      const fileUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${cleanPath}`;
      
      // Get file extension
      const fileExt = file.name.split('.').pop().toUpperCase();
      const fileSize = (file.size / 1024).toFixed(1);

      // Insert a compact button-style file attachment using the custom extension
      editor.chain().focus().insertContent({
        type: 'fileAttachment',
        attrs: {
          filename: file.name,
          fileurl: fileUrl,
          fileext: fileExt,
          filesize: fileSize,
        },
      }).run();
      
      console.log('[FILE UPLOAD] Inserted file attachment node');

      showNotification('File Uploaded', `${file.name} uploaded successfully`, 'success');

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
   * Remove a pending file
   */
  const removePendingFile = (fileId) => {
    const updatedPendingFiles = pendingFiles.filter(f => f.id !== fileId);
    setPendingFiles(updatedPendingFiles);
    
    if (onPendingFilesChange) {
      onPendingFilesChange(updatedPendingFiles);
    }
    
    showNotification('File Removed', 'Pending file removed', 'success');
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
    // Note: Selection is captured in onMouseDown handler on the toolbar button
    // This happens BEFORE the editor loses focus, ensuring we get the correct position
    console.log('[CODE BLOCK] Opening dialog - using selection from onMouseDown:', savedSelectionRef.current);

    setCodeContent('');
    setCodeLanguage('javascript');
    setShowCodeDialog(true);
  }, []);

  /**
   * Helper function to update code block DOM (fallback for blocks without component ID)
   */
  const updateCodeBlockDOM = useCallback((existingBlock) => {
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
      safeOnChange(editor.getHTML());

      showNotification('Success', 'Code block updated', 'success');
    }
  }, [editor, codeContent, codeLanguage, showNotification]);

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

      console.log('[CODE BLOCK UPDATE] Editing existing block:', existingBlock);

      // Try to find the code block in ProseMirror document by data-component-id
      const wrapper = existingBlock.classList?.contains('code-block-wrapper')
        ? existingBlock
        : existingBlock.closest('.code-block-wrapper');

      if (wrapper) {
        const codeBlockId = wrapper.getAttribute('data-component-id');
        console.log('[CODE BLOCK UPDATE] Looking for code block with ID:', codeBlockId);

        if (codeBlockId && editor) {
          const { state } = editor;
          let nodePos = null;

          // Search for the customCodeBlock node
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'customCodeBlock') {
              const nodeId = node.attrs['data-component-id'];
              console.log('[CODE BLOCK UPDATE] Found customCodeBlock at pos', pos, 'with ID:', nodeId);

              if (nodeId === codeBlockId) {
                nodePos = pos;
                console.log('[CODE BLOCK UPDATE] Match found at position:', pos);
                return false; // Stop searching
              }
            }
          });

          if (nodePos !== null) {
            console.log('[CODE BLOCK UPDATE] Updating node at position:', nodePos, 'with new content');

            // Update the node's attributes using ProseMirror transaction
            const tr = state.tr.setNodeMarkup(nodePos, null, {
              language: codeLanguage,
              code: codeContent,
              'data-component-id': codeBlockId
            });

            editor.view.dispatch(tr);
            console.log('[CODE BLOCK UPDATE] ✅ Code block updated via ProseMirror transaction');
            showNotification('Success', 'Code block updated', 'success');
          } else {
            console.error('[CODE BLOCK UPDATE] ❌ Could not find code block node in document');
            // Fallback to DOM manipulation
            updateCodeBlockDOM(existingBlock);
          }
        } else {
          console.log('[CODE BLOCK UPDATE] No component ID found, using DOM manipulation');
          updateCodeBlockDOM(existingBlock);
        }
      } else {
        console.log('[CODE BLOCK UPDATE] No wrapper found, using DOM manipulation on block directly');
        updateCodeBlockDOM(existingBlock);
      }

      // Clear the reference
      savedSelectionRef.current = null;
    } else {
      // CRITICAL: Restore cursor position before inserting
      // This ensures the code block is inserted at the correct location (e.g., inside table cells)
      const savedSelection = savedSelectionRef.current;

      if (savedSelection && savedSelection.from !== undefined && savedSelection.to !== undefined) {
        console.log('[CODE BLOCK] Restoring saved selection:', savedSelection);

        // Use the pre-calculated cell position if we were in a table cell when dialog opened
        let insertPos = savedSelection.from;

        if (savedSelection.inTableCell && savedSelection.cellPos !== null) {
          insertPos = savedSelection.cellPos;
          console.log('[CODE BLOCK] Was in table cell - using saved cell position:', insertPos);
        } else {
          console.log('[CODE BLOCK] Was NOT in table cell - using saved cursor position:', insertPos);
        }

        console.log('[CODE BLOCK] Final insert position:', insertPos);

        // Insert at the calculated position
        editor
          .chain()
          .focus()
          .insertContentAt(insertPos, {
            type: 'customCodeBlock',
            attrs: {
              language: codeLanguage,
              code: codeContent,
              'data-component-id': `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            },
          })
          .run();

        // Clear the saved selection
        savedSelectionRef.current = null;
      } else {
        // No saved selection - insert at current cursor position
        console.log('[CODE BLOCK] No saved position, inserting at current cursor');
        editor.chain().focus().insertContent({
          type: 'customCodeBlock',
          attrs: {
            language: codeLanguage,
            code: codeContent,
          },
        }).run();
      }

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
      
      // Trigger onChange to ensure parent component gets updated content
        setTimeout(() => {
        safeOnChange(editor.getHTML());
        }, 150);
    }

    setShowCodeDialog(false);
    setCodeContent('');
  }, [editor, codeContent, codeLanguage, showNotification, updateCodeBlockDOM]); // safeOnChange is stable

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

  /**
   * Insert layout grid - pre-configured table layouts
   */
  const insertLayoutGrid = useCallback((type) => {
    if (!editor) return;
    
    // Guard: Ensure editor view is ready
    if (!editor.view || editor.isDestroyed) {
      console.log('[LAYOUT] Editor view not ready, cannot insert layout');
      return;
    }
    
    // CRITICAL: Block onChange during layout insertion to prevent re-render
    window._tiptapDragging = true;
    console.log('[LAYOUT] 🛑 Blocking onChange during layout insertion');
    
    let rows = 1;  // Default to 1 row for side-by-side layouts
    let cols = 2;  // Default to 2 columns
    let colWidths = null;
    
    switch(type) {
      case '2-col-equal':
        rows = 1;  // Single row with 2 columns side-by-side
        cols = 2;
        colWidths = '[50%, 50%]';
        break;
      case '3-col-equal':
        rows = 1;  // Single row with 3 columns side-by-side
        cols = 3;
        colWidths = '[33.33%, 33.33%, 33.33%]';
        break;
      case 'sidebar-left':
        rows = 1;  // Single row with narrow left column
        cols = 2;
        colWidths = '[30%, 70%]';
        break;
      case 'sidebar-right':
        rows = 1;  // Single row with narrow right column
        cols = 2;
        colWidths = '[70%, 30%]';
        break;
      default:
        rows = 1;
        cols = 2;
    }
    
    console.log('[LAYOUT] Inserting table:', { rows, cols, type });
    
    // Build table HTML manually to ensure exact structure
    let tableHTML = '<table class="borderless" style="border: none; background: transparent; border-collapse: collapse;">';
    tableHTML += '<tbody>';
    
    for (let r = 0; r < rows; r++) {
      tableHTML += '<tr>';
      for (let c = 0; c < cols; c++) {
        // Don't set border: none in inline style - let CSS handle it for visible borders in edit mode
        tableHTML += '<td style="background: transparent; min-width: 100px; min-height: 60px; padding: 0.75rem; vertical-align: top;"><p></p></td>';
      }
      tableHTML += '</tr>';
    }
    
    tableHTML += '</tbody></table>';
    
    console.log('[LAYOUT] Generated table HTML:', tableHTML);
    
    // Insert the HTML directly
    editor.chain().focus().insertContent(tableHTML).run();
    
    // Wait for insertion and apply additional styling
    setTimeout(() => {
      const editorElement = document.querySelector('.ProseMirror');
      if (editorElement) {
        const tables = editorElement.querySelectorAll('table');
        if (tables.length > 0) {
          const newTable = tables[tables.length - 1];
          
          // Verify column count
          const firstRow = newTable.querySelector('tr');
          if (firstRow) {
            const domCols = firstRow.children.length;
            console.log('[LAYOUT] ✅ DOM columns:', domCols, 'Expected:', cols, 'Match:', domCols === cols);
            
            // If there are extra columns, remove them
            if (domCols > cols) {
              console.warn('[LAYOUT] ⚠️ Removing extra columns!');
              const allRows = newTable.querySelectorAll('tr');
              allRows.forEach(row => {
                while (row.children.length > cols) {
                  row.removeChild(row.lastChild);
                }
              });
              console.log('[LAYOUT] ✅ Extra columns removed');
            }
          }
          
          // Ensure borderless class and transparent styles
          newTable.classList.add('borderless');
          newTable.style.border = 'none';
          newTable.style.background = 'transparent';
          newTable.style.backgroundColor = 'transparent';
          newTable.style.borderCollapse = 'collapse';
          
          // Apply styling to all cells - use class only, let CSS handle styling
          const cells = newTable.querySelectorAll('td, th');
          console.log('[LAYOUT] Styling', cells.length, 'cells');
          cells.forEach(cell => {
            // CRITICAL: Add class immediately - CSS will handle the dashed border styling
            cell.classList.add('table-cell-droppable');
            
            // CRITICAL: Apply inline styles directly as fallback if CSS doesn't work
            // This ensures borders are ALWAYS visible in edit mode
            cell.style.setProperty('border', '1px dashed rgba(148, 163, 184, 0.5)', 'important');
            cell.style.setProperty('border-width', '1px', 'important');
            cell.style.setProperty('border-style', 'dashed', 'important');
            cell.style.setProperty('border-color', 'rgba(148, 163, 184, 0.5)', 'important');
            cell.style.setProperty('background-color', 'rgba(30, 41, 59, 0.1)', 'important');
            
            // Ensure cells have a paragraph for content and are editable
            if (!cell.querySelector('p')) {
              const p = document.createElement('p');
              cell.appendChild(p);
            }
            // Ensure cell is editable
            cell.setAttribute('contenteditable', 'true');
            // Ensure the paragraph inside is also editable
            const p = cell.querySelector('p');
            if (p) {
              p.setAttribute('contenteditable', 'true');
            }
          });
          
          console.log('[LAYOUT] ✅ Layout insertion complete with', cols, 'columns');
          
          // Force a re-check by the plugin/enforceBorderlessStyle
          // Trigger editor update to ensure plugin runs
          setTimeout(() => {
            if (editor && !editor.isDestroyed) {
              editor.view.dispatch(editor.view.state.tr);
            }
          }, 50);
        }
      }
      
      // Guard: Check if editor is still valid before accessing view
      if (!editor || !editor.view || editor.isDestroyed) {
        console.log('[LAYOUT] Editor destroyed during insertion, skipping attribute update');
        return;
      }
      
      // Update the table node attributes in TipTap's model
      const { state, view } = editor;
      const { selection } = state;
      
      let tableNode = null;
      let tablePos = null;
      
      for (let depth = selection.$anchor.depth; depth > 0; depth--) {
        const node = selection.$anchor.node(depth);
        if (node.type.name === 'table') {
          tableNode = node;
          tablePos = selection.$anchor.before(depth);
          break;
        }
      }
      
      if (tableNode && tablePos !== null) {
        const tr = view.state.tr;
        tr.setNodeMarkup(tablePos, null, {
          ...tableNode.attrs,
          'data-columns': colWidths,
          class: 'borderless',
        });
        
        // CRITICAL: Update all cell nodes in the table to include borderless styling
        // This ensures styles persist through TipTap re-renders
        // Use nodesBetween to find cells with absolute positions
        const tableEnd = tablePos + tableNode.nodeSize;
        const cellPositions = [];
        
        state.doc.nodesBetween(tablePos, tableEnd, (node, pos) => {
          if (node.type.name === 'tableCell') {
            cellPositions.push(pos);
          }
        });
        
        // Update each cell node with borderless styling
        cellPositions.forEach(cellPos => {
          try {
            const cellNode = state.doc.nodeAt(cellPos);
            if (cellNode) {
              tr.setNodeMarkup(cellPos, null, {
                ...cellNode.attrs,
                'data-borderless-cell': 'true',
                // Add inline style for dashed border - this will be rendered by renderHTML
                style: cellNode.attrs.style ? 
                  `${cellNode.attrs.style}; border: 1px dashed rgba(148, 163, 184, 0.5) !important; background-color: rgba(30, 41, 59, 0.1) !important;` :
                  'border: 1px dashed rgba(148, 163, 184, 0.5) !important; background-color: rgba(30, 41, 59, 0.1) !important;',
              });
            }
          } catch (err) {
            console.warn('[LAYOUT] Error updating cell at position', cellPos, err);
          }
        });
        
        if (cellPositions.length > 0) {
          view.dispatch(tr);
          console.log('[LAYOUT] ✅ Updated table and', cellPositions.length, 'cell attributes in TipTap model');
        } else {
          // Fallback: just update the table
          view.dispatch(tr);
          console.log('[LAYOUT] ✅ Updated table attributes (no cells found to update)');
        }
      }
      
      // Focus the first cell to make it immediately editable and droppable
      setTimeout(() => {
        // Guard: Ensure editor is still mounted
        if (!editor || !editor.view || editor.isDestroyed) {
          console.log('[LAYOUT] Editor not ready for focus, skipping');
          return;
        }
        
        // Find the first cell in the new table
        const { state } = editor;
        const { tr: focusTr } = state;
        
        // Navigate to the first cell
        let firstCellPos = null;
        state.doc.descendants((node, pos) => {
          if (node.type.name === 'tableCell' && firstCellPos === null) {
            // Found the first cell, get its first child (the paragraph)
            if (node.firstChild) {
              firstCellPos = pos + 1; // Position inside the cell
            }
          }
        });
        
        if (firstCellPos !== null) {
          // Set selection to the first cell
          const selection = state.selection.constructor.near(state.doc.resolve(firstCellPos));
          editor.view.dispatch(focusTr.setSelection(selection));
          console.log('[LAYOUT] Focused first cell at position:', firstCellPos);
          
          // Blur and refocus to ensure the cell is fully activated
          setTimeout(() => {
            if (editor && editor.view && !editor.isDestroyed) {
              editor.view.focus();
            }
          }, 50);
        }
      }, 150);
    }, 100);
    
    // CRITICAL: Re-enable onChange after all layout setup completes
    // Clear any existing timeout first
    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current);
    }
    
    layoutTimeoutRef.current = setTimeout(() => {
      window._tiptapDragging = false;
      layoutTimeoutRef.current = null; // Clear ref after execution
      console.log('[LAYOUT] ✅ Re-enabling onChange after layout setup');
      
      // Manually trigger onChange to notify parent
      if (editor && !editor.isDestroyed) {
        const html = editor.getHTML();
        console.log('[LAYOUT] Manually triggering onChange with HTML length:', html.length);
        safeOnChange(html);
      }
    }, 300); // Wait for all nested timeouts to complete (100 + 150 + 50 = 300)
    
    showNotification('Layout Inserted', `${type} layout grid created`, 'success');
  }, [editor, showNotification]); // safeOnChange and layoutTimeoutRef are stable

  /**
   * Apply cell styling
   */
  const applyCellStyle = useCallback(() => {
    if (!editor) return;
    
    const { state } = editor;
    const { selection } = state;
    
    // Find the cell node
    let cellNode = null;
    let cellPos = null;
    
    for (let depth = selection.$anchor.depth; depth > 0; depth--) {
      const node = selection.$anchor.node(depth);
      if (node.type.name === 'tableCell') {
        cellNode = node;
        cellPos = selection.$anchor.before(depth);
        break;
      }
    }
    
    if (cellNode && cellPos !== null) {
      editor.view.dispatch(
        editor.view.state.tr.setNodeMarkup(cellPos, null, {
          ...cellNode.attrs,
          'data-background': cellBackground || null,
          'data-padding': cellPadding,
          'data-valign': cellValign,
        })
      );
      
      setShowCellStyleDialog(false);
      showNotification('Cell Styled', 'Cell styling applied', 'success');
    } else {
      setError('Please place cursor in a table cell first');
    }
  }, [editor, cellBackground, cellPadding, cellValign, showNotification]);

  /**
   * Open cell style dialog
   */
  const openCellStyleDialog = useCallback(() => {
    if (!editor) return;
    
    // Check if cursor is in a cell
    const { state } = editor;
    const { selection } = state;
    
    let inCell = false;
    for (let depth = selection.$anchor.depth; depth > 0; depth--) {
      const node = selection.$anchor.node(depth);
      if (node.type.name === 'tableCell') {
        inCell = true;
        // Load current cell styles
        setCellBackground(node.attrs['data-background'] || '');
        setCellPadding(node.attrs['data-padding'] || 'medium');
        setCellValign(node.attrs['data-valign'] || 'top');
        break;
      }
    }
    
    if (!inCell) {
      setError('Please place cursor in a table cell first');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    setShowCellStyleDialog(true);
  }, [editor]);

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
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
            onClick={() => {
              console.log('[TOOLBAR] Bold clicked, selection:', editor.state.selection.from, '-', editor.state.selection.to);
              const result = editor.chain().toggleBold().run();
              console.log('[TOOLBAR] Bold result:', result);
            }}
            active={editor.isActive('bold')}
            disabled={disabled}
            title="Bold"
          >
            <FaBold />
          </ToolbarButton>
          <ToolbarButton
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().toggleItalic().run()}
            active={editor.isActive('italic')}
            disabled={disabled}
            title="Italic"
          >
            <FaItalic />
          </ToolbarButton>
          <ToolbarButton
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().toggleUnderline().run()}
            active={editor.isActive('underline')}
            disabled={disabled}
            title="Underline"
          >
            <FaUnderline />
          </ToolbarButton>
          <ToolbarButton
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().toggleStrike().run()}
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
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            disabled={disabled}
            title="Heading 2"
          >
            <FaHeading className="text-lg" />
          </ToolbarButton>
          <ToolbarButton
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().toggleHeading({ level: 3 }).run()}
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
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            disabled={disabled}
            title="Bullet List"
          >
            <FaListUl />
          </ToolbarButton>
          <ToolbarButton
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().toggleOrderedList().run()}
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
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })}
            disabled={disabled}
            title="Align Left"
          >
            <FaAlignLeft />
          </ToolbarButton>
          <ToolbarButton
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })}
            disabled={disabled}
            title="Align Center"
          >
            <FaAlignCenter />
          </ToolbarButton>
          <ToolbarButton
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().setTextAlign('right').run()}
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
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            disabled={disabled}
            title="Quote"
          >
            <FaQuoteLeft />
          </ToolbarButton>
          <ToolbarButton
            onMouseDown={(e) => {
              // CRITICAL: Capture selection BEFORE onClick fires and editor loses focus
              // This ensures we save the correct cursor position (e.g., inside table cells)
              if (editor) {
                const { from, to } = editor.state.selection;
                const $pos = editor.state.doc.resolve(from);

                console.log('[CODE BLOCK] onMouseDown - capturing selection:', { from, to });
                console.log('[CODE BLOCK] onMouseDown - $pos.depth:', $pos.depth);

                // Walk up tree to find if we're in a table cell
                let inTableCell = false;
                let cellPos = null;

                for (let depth = $pos.depth; depth > 0; depth--) {
                  const node = $pos.node(depth);
                  console.log('[CODE BLOCK] onMouseDown - depth', depth, 'node type:', node.type.name);

                  if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                    inTableCell = true;
                    cellPos = $pos.before(depth);
                    console.log('[CODE BLOCK] onMouseDown - found table cell at depth', depth, 'cellPos:', cellPos);
                    break;
                  }
                }

                // Save both the selection position and whether we're in a cell
                savedSelectionRef.current = {
                  from,
                  to,
                  inTableCell,
                  cellPos: inTableCell ? cellPos + 1 : null  // Position after cell opening tag
                };

                console.log('[CODE BLOCK] onMouseDown - saved selection data:', savedSelectionRef.current);
              }
            }}
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
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
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
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
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
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
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
              disabled={disabled || uploadingFile}
              title="Attach File"
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
              disabled={disabled || uploadingFile}
            />
          </label>
        </div>

        {/* Layout & Table Controls */}
        <div className="flex gap-1 pr-2 border-r border-gray-700">
          {/* Layout Grid Dropdown */}
          <div className="relative inline-block">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  insertLayoutGrid(e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={disabled}
              className="p-2 bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white rounded transition-colors text-xs cursor-pointer border-0"
              title="Insert Layout Grid"
            >
              <option value="">Layout</option>
              <option value="2-col-equal">2 Columns (50/50)</option>
              <option value="3-col-equal">3 Columns (33/33/33)</option>
              <option value="sidebar-left">Sidebar Left (30/70)</option>
              <option value="sidebar-right">Sidebar Right (70/30)</option>
            </select>
          </div>
          
          <ToolbarButton
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            disabled={disabled}
            title="Insert Table (3x3)"
          >
            <FaTable />
          </ToolbarButton>

          <ToolbarButton
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
            onClick={openCellStyleDialog}
            disabled={disabled}
            title="Cell Styling (Background, Padding)"
          >
            <FaPalette />
          </ToolbarButton>

          <ToolbarButton
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
            onClick={() => {
              // Toggle borderless class on current table
              const { state } = editor;
              const { selection } = state;
              const tableNode = selection.$anchor.node(-1);

              if (tableNode && tableNode.type.name === 'table') {
                const tablePos = selection.$anchor.before(-1);
                const currentAttrs = tableNode.attrs;
                const currentClass = currentAttrs.class || 'tiptap-table';
                const newClass = currentClass.includes('borderless')
                  ? currentClass.replace(' borderless', '').replace('borderless', 'tiptap-table')
                  : `${currentClass} borderless`;

                editor.view.dispatch(
                  editor.view.state.tr.setNodeMarkup(tablePos, null, {
                    ...currentAttrs,
                    class: newClass.trim(),
                  })
                );
              }
            }}
            disabled={disabled || !editor.can().addRowAfter()}
            title="Toggle Table Borders"
            style={{ fontSize: '11px', fontWeight: 'bold' }}
          >
            ⊞
          </ToolbarButton>
          
          <ToolbarButton
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
            onClick={() => {
              console.log('[TABLE] Adding row after');
              console.log('[TABLE] Can add row:', editor.can().addRowAfter());
              console.log('[TABLE] Current selection:', editor.state.selection);
              console.log('[TABLE] Is in table:', editor.can().addRowAfter() || editor.can().addRowBefore());
              
              // Check if we're in a table by checking the selection
              const { $anchor } = editor.state.selection;
              let inTable = false;
              let cellPos = null;
              let tablePos = null;
              
              // Walk up the node tree to find a table cell or table
              for (let depth = $anchor.depth; depth > 0; depth--) {
                const node = $anchor.node(depth);
                if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                  inTable = true;
                  cellPos = $anchor.before(depth);
                  console.log('[TABLE] Found table cell at depth', depth, 'position', cellPos);
                  // Continue to find the table
                  for (let tableDepth = depth - 1; tableDepth > 0; tableDepth--) {
                    const tableNode = $anchor.node(tableDepth);
                    if (tableNode.type.name === 'table') {
                      tablePos = $anchor.before(tableDepth);
                      console.log('[TABLE] Found table at depth', tableDepth, 'position', tablePos);
                      break;
                    }
                  }
                  break;
                } else if (node.type.name === 'table') {
                  inTable = true;
                  tablePos = $anchor.before(depth);
                  console.log('[TABLE] Found table at depth', depth, 'position', tablePos);
                  // Try to find a cell within this table
                  const tableEnd = tablePos + node.nodeSize;
                  editor.state.doc.nodesBetween(tablePos, tableEnd, (cellNode, pos) => {
                    if ((cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') && !cellPos) {
                      cellPos = pos + 1; // Position after the opening tag
                    }
                  });
                  break;
                }
              }
              
              if (!inTable) {
                console.warn('[TABLE] Not in a table! Trying to find a table in the document...');
                // Try to find any table in the document
                let foundTable = false;
                editor.state.doc.descendants((node, pos) => {
                  if (node.type.name === 'table' && !foundTable) {
                    foundTable = true;
                    tablePos = pos;
                    // Find first cell in this table
                    const tableEnd = pos + node.nodeSize;
                    editor.state.doc.nodesBetween(pos, tableEnd, (cellNode, cellPosInTable) => {
                      if ((cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') && !cellPos) {
                        cellPos = cellPosInTable + 1;
                        // Move cursor to this cell
                        editor.chain().setTextSelection(cellPos).focus().run();
                        console.log('[TABLE] Moved cursor to table cell at position', cellPos);
                      }
                    });
                    return false; // Stop searching
                  }
                });
                
                if (!foundTable) {
                  console.error('[TABLE] No table found in document!');
                  return;
                }
              } else if (cellPos) {
                // Move cursor to the cell if we found one
                editor.chain().setTextSelection(cellPos).focus().run();
              }
              
              try {
                // Try to add row using TipTap command
                const result = editor.chain().addRowAfter().run();
                console.log('[TABLE] Row added, result:', result);
                
                if (!result) {
                  console.warn('[TABLE] addRowAfter returned false even after positioning cursor');
                }
                
                // Force style enforcement after row is added
                setTimeout(() => {
                  const editorElement = document.querySelector('.ProseMirror');
                  if (editorElement) {
                    const borderlessTables = editorElement.querySelectorAll(
                      '.tableWrapper table, .tableWrapper table.tiptap-table, table.borderless, table[class*="borderless"]'
                    );
                    borderlessTables.forEach(table => {
                      const newCells = table.querySelectorAll('td:not(.table-cell-droppable), th:not(.table-cell-droppable)');
                      newCells.forEach(cell => {
                        cell.classList.add('table-cell-droppable');
                        cell.style.setProperty('border', '1px dashed rgba(148, 163, 184, 0.5)', 'important');
                        cell.style.setProperty('background-color', 'rgba(30, 41, 59, 0.1)', 'important');
                      });
                    });
                  }
                }, 50);
              } catch (error) {
                console.error('[TABLE] Error adding row:', error);
              }
            }}
            disabled={disabled}
            title="Add Row Below (click inside a table cell first)"
          >
            <FaPlus style={{ fontSize: '10px' }} />
            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>+</span>
          </ToolbarButton>
          
          <ToolbarButton
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
            onClick={() => {
              console.log('[TABLE] Deleting row');
              console.log('[TABLE] Can delete row:', editor.can().deleteRow());
              
              // Check if we're in a table by checking the selection
              const { $anchor } = editor.state.selection;
              let inTable = false;
              let cellPos = null;
              
              // Walk up the node tree to find a table cell or table
              for (let depth = $anchor.depth; depth > 0; depth--) {
                const node = $anchor.node(depth);
                if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                  inTable = true;
                  cellPos = $anchor.before(depth);
                  console.log('[TABLE] Found table cell at depth', depth, 'position', cellPos);
                  break;
                } else if (node.type.name === 'table') {
                  inTable = true;
                  const tablePos = $anchor.before(depth);
                  const tableEnd = tablePos + node.nodeSize;
                  editor.state.doc.nodesBetween(tablePos, tableEnd, (cellNode, pos) => {
                    if ((cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') && !cellPos) {
                      cellPos = pos + 1;
                    }
                  });
                  break;
                }
              }
              
              if (!inTable) {
                console.warn('[TABLE] Not in a table! Trying to find a table in the document...');
                let foundTable = false;
                editor.state.doc.descendants((node, pos) => {
                  if (node.type.name === 'table' && !foundTable) {
                    foundTable = true;
                    const tableEnd = pos + node.nodeSize;
                    editor.state.doc.nodesBetween(pos, tableEnd, (cellNode, cellPosInTable) => {
                      if ((cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') && !cellPos) {
                        cellPos = cellPosInTable + 1;
                        editor.chain().setTextSelection(cellPos).focus().run();
                        console.log('[TABLE] Moved cursor to table cell at position', cellPos);
                      }
                    });
                    return false;
                  }
                });
                
                if (!foundTable) {
                  console.error('[TABLE] No table found in document!');
                  return;
                }
              } else if (cellPos) {
                editor.chain().setTextSelection(cellPos).focus().run();
              }
              
              try {
                const result = editor.chain().deleteRow().run();
                console.log('[TABLE] Row deleted, result:', result);
                if (!result) {
                  console.warn('[TABLE] deleteRow returned false');
                }
              } catch (error) {
                console.error('[TABLE] Error deleting row:', error);
              }
            }}
            disabled={disabled}
            title="Delete Row"
          >
            <FaMinus style={{ fontSize: '10px' }} />
          </ToolbarButton>
          
          <ToolbarButton
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
            onClick={() => {
              console.log('[TABLE] Adding column after');
              console.log('[TABLE] Can add column:', editor.can().addColumnAfter());
              console.log('[TABLE] Current selection:', editor.state.selection);
              
              // Check if we're in a table by checking the selection
              const { $anchor } = editor.state.selection;
              let inTable = false;
              let cellPos = null;
              let tablePos = null;
              
              // Walk up the node tree to find a table cell or table
              for (let depth = $anchor.depth; depth > 0; depth--) {
                const node = $anchor.node(depth);
                if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                  inTable = true;
                  cellPos = $anchor.before(depth);
                  console.log('[TABLE] Found table cell at depth', depth, 'position', cellPos);
                  // Continue to find the table
                  for (let tableDepth = depth - 1; tableDepth > 0; tableDepth--) {
                    const tableNode = $anchor.node(tableDepth);
                    if (tableNode.type.name === 'table') {
                      tablePos = $anchor.before(tableDepth);
                      console.log('[TABLE] Found table at depth', tableDepth, 'position', tablePos);
                      break;
                    }
                  }
                  break;
                } else if (node.type.name === 'table') {
                  inTable = true;
                  tablePos = $anchor.before(depth);
                  console.log('[TABLE] Found table at depth', depth, 'position', tablePos);
                  // Try to find a cell within this table
                  const tableEnd = tablePos + node.nodeSize;
                  editor.state.doc.nodesBetween(tablePos, tableEnd, (cellNode, pos) => {
                    if ((cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') && !cellPos) {
                      cellPos = pos + 1; // Position after the opening tag
                    }
                  });
                  break;
                }
              }
              
              if (!inTable) {
                console.warn('[TABLE] Not in a table! Trying to find a table in the document...');
                // Try to find any table in the document
                let foundTable = false;
                editor.state.doc.descendants((node, pos) => {
                  if (node.type.name === 'table' && !foundTable) {
                    foundTable = true;
                    tablePos = pos;
                    // Find first cell in this table
                    const tableEnd = pos + node.nodeSize;
                    editor.state.doc.nodesBetween(pos, tableEnd, (cellNode, cellPosInTable) => {
                      if ((cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') && !cellPos) {
                        cellPos = cellPosInTable + 1;
                        // Move cursor to this cell
                        editor.chain().setTextSelection(cellPos).focus().run();
                        console.log('[TABLE] Moved cursor to table cell at position', cellPos);
                      }
                    });
                    return false; // Stop searching
                  }
                });
                
                if (!foundTable) {
                  console.error('[TABLE] No table found in document!');
                  return;
                }
              } else if (cellPos) {
                // Move cursor to the cell if we found one
                editor.chain().setTextSelection(cellPos).focus().run();
              }
              
              try {
                // Try to add column using TipTap command
                const result = editor.chain().addColumnAfter().run();
                console.log('[TABLE] Column added, result:', result);
                
                if (!result) {
                  console.warn('[TABLE] addColumnAfter returned false even after positioning cursor');
                }
                
                // Force style enforcement after column is added
                setTimeout(() => {
                  const editorElement = document.querySelector('.ProseMirror');
                  if (editorElement) {
                    const borderlessTables = editorElement.querySelectorAll(
                      '.tableWrapper table, .tableWrapper table.tiptap-table, table.borderless, table[class*="borderless"]'
                    );
                    borderlessTables.forEach(table => {
                      const newCells = table.querySelectorAll('td:not(.table-cell-droppable), th:not(.table-cell-droppable)');
                      newCells.forEach(cell => {
                        cell.classList.add('table-cell-droppable');
                        cell.style.setProperty('border', '1px dashed rgba(148, 163, 184, 0.5)', 'important');
                        cell.style.setProperty('background-color', 'rgba(30, 41, 59, 0.1)', 'important');
                      });
                    });
                  }
                }, 50);
              } catch (error) {
                console.error('[TABLE] Error adding column:', error);
              }
            }}
            disabled={disabled}
            title="Add Column Right (click inside a table cell first)"
          >
            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Col+</span>
          </ToolbarButton>
          
          <ToolbarButton
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
            onClick={() => {
              console.log('[TABLE] Deleting column');
              console.log('[TABLE] Can delete column:', editor.can().deleteColumn());
              
              // Check if we're in a table by checking the selection
              const { $anchor } = editor.state.selection;
              let inTable = false;
              let cellPos = null;
              
              // Walk up the node tree to find a table cell or table
              for (let depth = $anchor.depth; depth > 0; depth--) {
                const node = $anchor.node(depth);
                if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                  inTable = true;
                  cellPos = $anchor.before(depth);
                  console.log('[TABLE] Found table cell at depth', depth, 'position', cellPos);
                  break;
                } else if (node.type.name === 'table') {
                  inTable = true;
                  const tablePos = $anchor.before(depth);
                  const tableEnd = tablePos + node.nodeSize;
                  editor.state.doc.nodesBetween(tablePos, tableEnd, (cellNode, pos) => {
                    if ((cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') && !cellPos) {
                      cellPos = pos + 1;
                    }
                  });
                  break;
                }
              }
              
              if (!inTable) {
                console.warn('[TABLE] Not in a table! Trying to find a table in the document...');
                let foundTable = false;
                editor.state.doc.descendants((node, pos) => {
                  if (node.type.name === 'table' && !foundTable) {
                    foundTable = true;
                    const tableEnd = pos + node.nodeSize;
                    editor.state.doc.nodesBetween(pos, tableEnd, (cellNode, cellPosInTable) => {
                      if ((cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') && !cellPos) {
                        cellPos = cellPosInTable + 1;
                        editor.chain().setTextSelection(cellPos).focus().run();
                        console.log('[TABLE] Moved cursor to table cell at position', cellPos);
                      }
                    });
                    return false;
                  }
                });
                
                if (!foundTable) {
                  console.error('[TABLE] No table found in document!');
                  return;
                }
              } else if (cellPos) {
                editor.chain().setTextSelection(cellPos).focus().run();
              }
              
              try {
                const result = editor.chain().deleteColumn().run();
                console.log('[TABLE] Column deleted, result:', result);
                if (!result) {
                  console.warn('[TABLE] deleteColumn returned false');
                }
              } catch (error) {
                console.error('[TABLE] Error deleting column:', error);
              }
            }}
            disabled={disabled}
            title="Delete Column"
          >
            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Col-</span>
          </ToolbarButton>
          
          <ToolbarButton
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
            onClick={() => {
              console.log('[TABLE] Deleting table');
              console.log('[TABLE] Can delete table:', editor.can().deleteTable());
              
              // Check if we're in a table by checking the selection
              const { $anchor } = editor.state.selection;
              let inTable = false;
              let cellPos = null;
              let tablePos = null;
              
              // Walk up the node tree to find a table cell or table
              for (let depth = $anchor.depth; depth > 0; depth--) {
                const node = $anchor.node(depth);
                if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                  inTable = true;
                  cellPos = $anchor.before(depth);
                  // Find the table
                  for (let tableDepth = depth - 1; tableDepth > 0; tableDepth--) {
                    const tableNode = $anchor.node(tableDepth);
                    if (tableNode.type.name === 'table') {
                      tablePos = $anchor.before(tableDepth);
                      break;
                    }
                  }
                  break;
                } else if (node.type.name === 'table') {
                  inTable = true;
                  tablePos = $anchor.before(depth);
                  const tableEnd = tablePos + node.nodeSize;
                  editor.state.doc.nodesBetween(tablePos, tableEnd, (cellNode, pos) => {
                    if ((cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') && !cellPos) {
                      cellPos = pos + 1;
                    }
                  });
                  break;
                }
              }
              
              if (!inTable) {
                console.warn('[TABLE] Not in a table! Trying to find a table in the document...');
                // Try to find any table in the document using nodesBetween (more thorough)
                let foundTable = false;
                const docSize = editor.state.doc.content.size;
                console.log('[TABLE] Document size:', docSize);
                
                // Search the entire document
                editor.state.doc.nodesBetween(0, docSize, (node, pos) => {
                  if (node.type.name === 'table' && !foundTable) {
                    foundTable = true;
                    tablePos = pos;
                    console.log('[TABLE] Found table at position', pos, 'nodeSize:', node.nodeSize);
                    // Find first cell in this table
                    const tableEnd = pos + node.nodeSize;
                    editor.state.doc.nodesBetween(pos, tableEnd, (cellNode, cellPosInTable) => {
                      if ((cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') && !cellPos) {
                        cellPos = cellPosInTable + 1;
                        console.log('[TABLE] Found first cell at position', cellPos);
                        editor.chain().setTextSelection(cellPos).focus().run();
                        console.log('[TABLE] Moved cursor to table cell at position', cellPos);
                        return false; // Stop searching for cells
                      }
                    });
                    return false; // Stop searching for tables
                  }
                });
                
                if (!foundTable) {
                  console.error('[TABLE] No table found in document!');
                  // Debug: log all node types in document
                  const nodeTypes = new Set();
                  editor.state.doc.nodesBetween(0, docSize, (node) => {
                    nodeTypes.add(node.type.name);
                  });
                  console.log('[TABLE] Available node types in document:', Array.from(nodeTypes));
                  return;
                }
              } else if (cellPos) {
                editor.chain().setTextSelection(cellPos).focus().run();
              }
              
              try {
                // Clear any drag state before deleting
                window._tiptapDragging = false;
                window._draggedContent = null;
                window._draggedElement = null;
                
                // Delete the table
                const result = editor.chain().deleteTable().run();
                console.log('[TABLE] Table deleted, result:', result);
                if (!result) {
                  console.warn('[TABLE] deleteTable returned false');
                }
              } catch (error) {
                console.error('[RichTextEditor] Error deleting table:', error);
                // Try to recover by clearing selection
                try {
                  editor.chain().focus().clearNodes().run();
                } catch (recoverError) {
                  console.error('[RichTextEditor] Error recovering from delete:', recoverError);
                }
              }
            }}
            disabled={disabled}
            title="Delete Table"
          >
            <FaTrash style={{ fontSize: '10px' }} />
          </ToolbarButton>
        </div>

        {/* Undo/Redo */}
        <div className="flex gap-1 pr-2 border-r border-gray-700">
          <ToolbarButton
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
            onClick={() => editor.chain().undo().run()}
            disabled={disabled || !editor.can().undo()}
            title="Undo"
          >
            <FaUndo />
          </ToolbarButton>
          <ToolbarButton
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
            onClick={() => editor.chain().redo().run()}
            disabled={disabled || !editor.can().redo()}
            title="Redo"
          >
            <FaRedo />
          </ToolbarButton>
        </div>

        {/* HTML Source */}
        <div className="flex gap-1">
          <ToolbarButton
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent focus loss
            }}
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

      {/* Pending Files Display (files to be uploaded after section creation) */}
      {pendingFiles && pendingFiles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <span>Pending Files:</span>
            <span className="text-xs text-orange-400 bg-orange-400/20 px-2 py-1 rounded">
              Will upload when section is saved
            </span>
          </h4>
          <div className="space-y-2">
            {pendingFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 bg-orange-500/10 rounded border border-orange-500/30"
              >
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <FaFile className="text-orange-400" />
                  <span>{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => removePendingFile(file.id)}
                  className="text-red-400 hover:text-red-300 text-xs"
                  disabled={disabled}
                >
                  Remove
                </button>
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

      {/* Cell Style Dialog */}
      {showCellStyleDialog && createPortal(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-gray-900 border border-gray-700/50 rounded-xl max-w-md w-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-700/50 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <FaPalette className="text-[#14C800]" />
                Cell Styling
              </h3>
              <button
                onClick={() => setShowCellStyleDialog(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Background Color
                </label>
                <input
                  type="color"
                  value={cellBackground}
                  onChange={(e) => setCellBackground(e.target.value)}
                  className="w-full h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={cellBackground}
                  onChange={(e) => setCellBackground(e.target.value)}
                  placeholder="e.g., #1f2937 or transparent"
                  className="w-full mt-2 p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-[#14C800]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Padding
                </label>
                <select
                  value={cellPadding}
                  onChange={(e) => setCellPadding(e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-[#14C800]"
                >
                  <option value="none">None</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Vertical Alignment
                </label>
                <select
                  value={cellValign}
                  onChange={(e) => setCellValign(e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-[#14C800]"
                >
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700/50 flex justify-end gap-3">
              <button
                onClick={() => setShowCellStyleDialog(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyCellStyle}
                className="px-4 py-2 bg-[#14C800] hover:bg-[#12b000] text-white rounded font-medium transition-colors flex items-center gap-2"
              >
                <FaCheck />
                Apply Styling
              </button>
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
  onMouseDown,
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
      onMouseDown={onMouseDown}
      disabled={disabled}
      className={className}
      title={title}
    >
      {children}
    </button>
  );
};

export default RichTextSectionEditor;
