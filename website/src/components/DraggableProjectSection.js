import React from 'react';
import { Draggable } from '@hello-pangea/dnd';

/**
 * DraggableProjectSection Component
 * Wraps main project detail sections with drag and drop support in edit mode
 * 
 * Sections types:
 * - 'title': Project title
 * - 'image': Project main image
 * - 'description': Project description
 * - 'skills': Skills and technologies
 * - 'sections': Project sections container
 */
const DraggableProjectSection = ({
  sectionType,
  index,
  isEditMode,
  children,
  className = '',
}) => {
  // Generate a unique draggable ID
  const draggableId = `project-section-${sectionType}-${index}`;

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
            isEditMode ? 'cursor-move hover:ring-2 hover:ring-[#14C800]/40 rounded-xl' : ''
          } ${
            snapshot.isDragging 
              ? 'shadow-[0_25px_50px_rgba(20,200,0,0.5)] ring-2 ring-[#14C800] scale-[1.01] opacity-95 z-50 bg-gray-900/80 rounded-xl' 
              : ''
          } ${className}`}
          style={{
            ...provided.draggableProps.style,
          }}
          title={isEditMode ? "Drag to reorder section" : undefined}
        >
          {/* Drag Handle Indicator in Edit Mode */}
          {isEditMode && !snapshot.isDragging && (
            <div className="absolute -left-10 top-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="flex flex-col items-center gap-1 bg-gray-800 border border-[#14C800]/30 rounded-lg p-2 shadow-lg">
                <svg className="w-6 h-6 text-[#14C800]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
                </svg>
                <span className="text-[10px] text-[#14C800] font-bold uppercase">Drag</span>
              </div>
            </div>
          )}
          
          {/* Section Type Indicator in Edit Mode */}
          {isEditMode && !snapshot.isDragging && (
            <div className="absolute -top-3 left-4 bg-[#14C800] text-black text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
              {sectionType}
            </div>
          )}
          
          {children}
        </div>
      )}
    </Draggable>
  );
};

export default DraggableProjectSection;
