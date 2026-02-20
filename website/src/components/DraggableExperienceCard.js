import React from 'react';
import { Draggable } from '@hello-pangea/dnd';

/**
 * DraggableExperienceCard Component
 * Renders an experience card with drag and drop support in edit mode
 */
const DraggableExperienceCard = ({
  experience,
  index,
  isEditMode,
  experienceText,
  yearsLabel,
  onCardClick,
  onDelete,
  getIconComponent,
}) => {
  const Icon = getIconComponent(experience.icon);

  return (
    <Draggable
      draggableId={`experience-${experience.id}`}
      index={index}
      isDragDisabled={!isEditMode}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={(e) => {
            // Don't trigger click while dragging
            if (snapshot.isDragging) return;
            onCardClick(experience.id, e);
          }}
          className={`relative flex flex-col gap-3 items-start bg-white/10 p-5 min-h-[180px] backdrop-blur-sm shadow-[0_15px_35px_rgba(5,10,30,0.4)] transition-all duration-300 group ${
            isEditMode ? 'cursor-move' : 'cursor-pointer'
          } ${
            snapshot.isDragging 
              ? 'shadow-[0_30px_60px_rgba(20,200,0,0.5)] ring-4 ring-[#14C800] scale-110 opacity-95 z-50 bg-white/20' 
              : 'hover:-translate-y-1 hover:bg-white/20 hover:shadow-[0_20px_40px_rgba(5,10,30,0.5)]'
          }`}
          style={{
            ...provided.draggableProps.style,
          }}
          title={isEditMode ? "Drag anywhere to reorder • Click to edit • Ctrl/Cmd+Click to view details" : "View experience details"}
        >

          <div className="flex items-center justify-center w-14 h-14 bg-[#14C800]/10 text-[#14C800] text-2xl group-hover:scale-105 group-hover:bg-[#14C800]/25 transition-all duration-300 self-start">
            <Icon />
          </div>
          
          <div className="flex-1 flex flex-col items-start justify-center">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{experience.years_experience || experience.years}+</span>
              {/* Use editable years label */}
              <span className="text-white/60 text-xs uppercase tracking-wide">
                {yearsLabel.renderEditable('text-white/60 text-xs uppercase tracking-wide')}
              </span>
            </div>
            <p className="mt-1 text-white font-semibold leading-relaxed">
              {experienceText.name}
            </p>
          </div>

          {/* Edit mode controls */}
          {isEditMode && !snapshot.isDragging && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(experience.id, e);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-1.5 bg-red-500/80 hover:bg-red-600 text-white transition-colors"
                title="Remove experience"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}

          {/* Edit indicator in edit mode */}
          {isEditMode && !snapshot.isDragging && (
            <div 
              className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default DraggableExperienceCard;
