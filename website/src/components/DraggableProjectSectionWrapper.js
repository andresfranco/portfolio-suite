import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { FaPencil, FaTrash } from 'react-icons/fa6';
import EditableProjectSection from './EditableProjectSection';

/**
 * DraggableProjectSectionWrapper Component
 * Wraps an individual project section with drag and drop support
 * Each section can be reordered independently
 */
const DraggableProjectSectionWrapper = ({
  section,
  index,
  language,
  isEditMode,
  onContentReorder,
  onEdit,
  onDelete,
}) => {
  const [showActions, setShowActions] = useState(false);
  
  // Generate a unique draggable ID for this section
  const draggableId = `project-section-${section.id}`;

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
          className={`relative transition-all duration-200 group ${
            snapshot.isDragging 
              ? 'shadow-[0_20px_40px_rgba(20,200,0,0.5)] ring-2 ring-[#14C800] scale-[1.01] opacity-95 z-50 rounded-xl bg-gray-900/50' 
              : isEditMode 
              ? 'hover:ring-1 hover:ring-[#14C800]/30 rounded-xl' 
              : ''
          }`}
          style={{
            ...provided.draggableProps.style,
          }}
          onMouseEnter={() => isEditMode && setShowActions(true)}
          onMouseLeave={() => isEditMode && setShowActions(false)}
        >
          {/* Action Buttons - Edit Mode Only */}
          {isEditMode && showActions && !snapshot.isDragging && (
            <div className="absolute -top-3 right-4 z-20 flex gap-2">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(section);
                  }}
                  className="bg-[#14C800] hover:bg-[#12b000] text-black p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-110"
                  title="Edit section"
                >
                  <FaPencil className="w-3 h-3" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(section.id);
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-110"
                  title="Delete section"
                >
                  <FaTrash className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          
          {/* Drag Handle - Only in edit mode */}
          {isEditMode && !snapshot.isDragging && (
            <div
              {...provided.dragHandleProps}
              className="absolute -left-12 top-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-move z-20"
              title="Drag to reorder section"
            >
              <div className="flex flex-col items-center gap-1 bg-gray-800 border border-[#14C800]/30 rounded-lg p-2 shadow-lg">
                <svg className="w-6 h-6 text-[#14C800]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
                </svg>
                <span className="text-[10px] text-[#14C800] font-bold uppercase whitespace-nowrap">Section</span>
              </div>
            </div>
          )}
          
          {/* Section Badge - Shows section number */}
          {isEditMode && !snapshot.isDragging && (
            <div className="absolute -top-3 left-4 bg-[#14C800] text-black text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider opacity-0 hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
              Section {index + 1}
            </div>
          )}
          
          {/* The actual section content with nested drag and drop for content items */}
          <EditableProjectSection
            section={section}
            language={language}
            isEditMode={isEditMode}
            onContentReorder={onContentReorder}
          />
        </div>
      )}
    </Draggable>
  );
};

export default DraggableProjectSectionWrapper;
