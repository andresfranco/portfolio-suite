import React, { useEffect, useRef, useMemo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { FaDownload } from 'react-icons/fa6';
import ResizableImage from './ResizableImage';
import './RichTextContent.css';
// Import editor CSS to ensure borderless table styles are available in display mode
import './cms/RichTextSectionEditor.css';

/**
 * DraggableSectionContent Component
 * Wraps individual content items within a project section with drag and drop support
 * 
 * Content types:
 * - 'text': Section text/description
 * - 'image': Section image
 * - 'file': Section attachment/file
 */
const DraggableSectionContent = ({
  contentType,
  contentItem,
  index,
  isEditMode,
  sectionId,
  isBordered = true,
  children,
}) => {
  // Generate a unique draggable ID
  const draggableId = `section-${sectionId}-${contentType}-${contentItem?.id || index}`;

  return (
    <Draggable
      draggableId={draggableId}
      index={index}
      isDragDisabled={!isEditMode}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`relative transition-all duration-200 group ${
            isEditMode ? 'cursor-move hover:ring-1 hover:ring-[#14C800]/40 hover:bg-gray-800/30 rounded-lg' : ''
          } ${
            snapshot.isDragging 
              ? 'shadow-[0_20px_40px_rgba(20,200,0,0.6)] ring-2 ring-[#14C800] scale-[1.02] opacity-95 z-50 bg-gray-800 rounded-lg' 
              : ''
          }`}
          style={{
            ...provided.draggableProps.style,
          }}
          title={isEditMode ? `Drag to reorder ${contentType}` : undefined}
        >
          {/* Drag Handle Indicator in Edit Mode */}
          {isEditMode && !snapshot.isDragging && (
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <svg className="w-5 h-5 text-[#14C800]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
              </svg>
            </div>
          )}
          
          {/* Content Type Indicator Badge in Edit Mode */}
          {isEditMode && !snapshot.isDragging && (
            <div className="absolute -top-2 -right-2 bg-[#14C800] text-black text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-lg">
              {contentType}
            </div>
          )}
          
          {children}
        </div>
      )}
    </Draggable>
  );
};

/**
 * Pre-built content renderers for common types
 */

// Text Content Renderer
export const DraggableTextContent = ({ text, index, isEditMode, sectionId, isBordered }) => {
  const contentRef = useRef(null);
  
  // Clean HTML string before rendering to remove border/background styles
  // This ensures clean HTML even if the database contains old data
  const cleanedHtml = useMemo(() => {
    if (!text || isEditMode) return text;
    
    // Check if HTML contains border styles
    const hasBorderStyles = text.includes('border: 1px dashed') || 
                           text.includes('rgba(148, 163, 184, 0.5)') ||
                           text.includes('background-color: rgba(30, 41, 59');
    
    if (!hasBorderStyles) return text;
    
    let cleaned = text;
    
    // Remove data-borderless-cell attribute
    cleaned = cleaned.replace(/\s+data-borderless-cell="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s+data-borderless-cell='[^']*'/gi, '');
    
    // Remove table-cell-droppable class
    cleaned = cleaned.replace(/\s+class="[^"]*table-cell-droppable[^"]*"/gi, (match) => {
      const cleaned = match.replace(/\s*table-cell-droppable\s*/gi, ' ').trim();
      return cleaned === 'class=""' ? '' : cleaned;
    });
    cleaned = cleaned.replace(/\s+class='[^']*table-cell-droppable[^']*'/gi, (match) => {
      const cleaned = match.replace(/\s*table-cell-droppable\s*/gi, ' ').trim();
      return cleaned === "class=''" ? '' : cleaned;
    });
    
    // Clean style attributes - remove border and background properties
    const cleanStyleString = (styleContent) => {
      if (!styleContent) return '';
      const properties = styleContent.split(';')
        .map(prop => prop.trim())
        .filter(prop => {
          if (!prop) return false;
          const lower = prop.toLowerCase();
          return !lower.includes('border') && !lower.includes('background');
        });
      let cleaned = properties.join(';')
        .replace(/;;+/g, ';')
        .replace(/^\s*;\s*|\s*;\s*$/g, '')
        .trim();
      return cleaned;
    };
    
    // Clean double-quoted style attributes
    cleaned = cleaned.replace(/style="([^"]*)"/gi, (match, styleContent) => {
      const cleanedStyle = cleanStyleString(styleContent);
      return cleanedStyle ? `style="${cleanedStyle}"` : '';
    });
    
    // Clean single-quoted style attributes
    cleaned = cleaned.replace(/style='([^']*)'/gi, (match, styleContent) => {
      const cleanedStyle = cleanStyleString(styleContent);
      return cleanedStyle ? `style='${cleanedStyle}'` : '';
    });
    
    // Remove empty style attributes
    cleaned = cleaned.replace(/\s+style="\s*"/gi, '');
    cleaned = cleaned.replace(/\s+style='\s*'/gi, '');
    
    return cleaned;
  }, [text, isEditMode]);
  
  // Remove inline border styles from borderless tables in display mode
  useEffect(() => {
    if (!isEditMode && contentRef.current) {
      const removeBorderStyles = () => {
        const borderlessTables = contentRef.current.querySelectorAll('table.borderless, table[class*="borderless"]');
        borderlessTables.forEach(table => {
          const cells = table.querySelectorAll('td, th');
          cells.forEach(cell => {
            // Remove inline border styles (including !important)
            const style = cell.getAttribute('style') || '';
            if (style.includes('border') || style.includes('background')) {
              let cleanedStyle = style
                .replace(/border[^;]*!important[^;]*;?/gi, '')  // Remove border with !important
                .replace(/border[^;]*;?/gi, '')  // Remove any remaining border
                .replace(/border-width[^;]*!important[^;]*;?/gi, '')
                .replace(/border-width[^;]*;?/gi, '')
                .replace(/border-style[^;]*!important[^;]*;?/gi, '')
                .replace(/border-style[^;]*;?/gi, '')
                .replace(/border-color[^;]*!important[^;]*;?/gi, '')
                .replace(/border-color[^;]*;?/gi, '')
                .replace(/background-color[^;]*!important[^;]*;?/gi, '')
                .replace(/background-color[^;]*;?/gi, '')
                .replace(/background[^;]*!important[^;]*;?/gi, '')
                .replace(/background[^;]*;?/gi, '')
                .replace(/;;+/g, ';')
                .replace(/^\s*;\s*|\s*;\s*$/g, '')
                .trim();
              
              if (!cleanedStyle || cleanedStyle === '') {
                cell.removeAttribute('style');
              } else {
                cell.setAttribute('style', cleanedStyle);
              }
              
              // Also try direct removal methods
              try {
                cell.style.removeProperty('border');
                cell.style.removeProperty('border-width');
                cell.style.removeProperty('border-style');
                cell.style.removeProperty('border-color');
                cell.style.removeProperty('background-color');
                cell.style.removeProperty('background');
              } catch (e) {
                cell.style.border = '';
                cell.style.borderWidth = '';
                cell.style.borderStyle = '';
                cell.style.borderColor = '';
                cell.style.backgroundColor = '';
                cell.style.background = '';
              }
            }
            
            // Also remove data-borderless-cell attribute and class
            cell.removeAttribute('data-borderless-cell');
            cell.classList.remove('table-cell-droppable');
          });
        });
      };
      
      // Run immediately
      removeBorderStyles();
      
      // Also watch for changes
      const observer = new MutationObserver(removeBorderStyles);
      observer.observe(contentRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
      
      return () => observer.disconnect();
    }
  }, [isEditMode, text]);
  
  return (
    <DraggableSectionContent
      contentType="text"
      contentItem={{ id: 'text' }}
      index={index}
      isEditMode={isEditMode}
      sectionId={sectionId}
      isBordered={isBordered}
    >
      <div 
        ref={contentRef}
        className="rich-text-content"
        dangerouslySetInnerHTML={{ __html: cleanedHtml }}
      />
    </DraggableSectionContent>
  );
};

// Image Content Renderer
export const DraggableImageContent = ({ image, index, isEditMode, sectionId, isBordered }) => {
  const cleanPath = image.image_path.startsWith('/') 
    ? image.image_path.substring(1) 
    : image.image_path;
  const imageUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${cleanPath}`;
  
  return (
    <DraggableSectionContent
      contentType="image"
      contentItem={image}
      index={index}
      isEditMode={isEditMode}
      sectionId={sectionId}
      isBordered={isBordered}
    >
      <ResizableImage
        src={imageUrl}
        alt="Section diagram"
        className={isBordered ? "w-full rounded-lg border border-gray-700/50" : "w-full"}
        isEditMode={isEditMode}
        onError={(e) => {
          console.error('Failed to load section image:', image.image_path, 'URL:', imageUrl);
        }}
      />
    </DraggableSectionContent>
  );
};

// File/Attachment Content Renderer
export const DraggableFileContent = ({ attachment, index, isEditMode, sectionId }) => {
  const cleanPath = attachment.file_path.startsWith('/') 
    ? attachment.file_path.substring(1) 
    : attachment.file_path;
  const fileUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${cleanPath}`;
  
  return (
    <DraggableSectionContent
      contentType="file"
      contentItem={attachment}
      index={index}
      isEditMode={isEditMode}
      sectionId={sectionId}
    >
      <a
        href={fileUrl}
        download={attachment.file_name}
        onClick={(e) => {
          // Prevent drag from triggering download
          if (isEditMode) {
            e.preventDefault();
            // Allow Ctrl+Click to download in edit mode
            if (e.ctrlKey || e.metaKey) {
              window.open(fileUrl, '_blank');
            }
          }
        }}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 border border-[#14C800]/30 hover:border-[#14C800]/60 rounded text-[#14C800] hover:text-white transition-all duration-200"
        title={isEditMode ? "Ctrl/Cmd+Click to download in edit mode" : "Download file"}
      >
        <FaDownload size={14} />
        <span className="text-sm">{attachment.file_name}</span>
      </a>
    </DraggableSectionContent>
  );
};

export default DraggableSectionContent;
