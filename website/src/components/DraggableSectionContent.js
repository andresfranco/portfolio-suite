import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { FaDownload } from 'react-icons/fa6';
import './RichTextContent.css';

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
export const DraggableTextContent = ({ text, index, isEditMode, sectionId, isBordered }) => (
  <DraggableSectionContent
    contentType="text"
    contentItem={{ id: 'text' }}
    index={index}
    isEditMode={isEditMode}
    sectionId={sectionId}
    isBordered={isBordered}
  >
    <div 
      className="rich-text-content"
      dangerouslySetInnerHTML={{ __html: text }}
    />
  </DraggableSectionContent>
);

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
      <img
        src={imageUrl}
        alt="Section diagram"
        className={isBordered ? "w-full rounded-lg border border-gray-700/50" : "w-full"}
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
