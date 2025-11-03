import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { ProjectImageSelector, ProjectActionButtons } from './cms';

/**
 * DraggableProjectCard Component
 * Renders a project card with drag and drop support in edit mode
 */
const DraggableProjectCard = ({
  project,
  index,
  isEditMode,
  projectText,
  projectImage,
  description,
  tags,
  language,
  translations,
  viewProjectLabel,
  onProjectClick,
  onViewDetails,
  onEdit,
  onDelete,
}) => {
  return (
    <Draggable
      draggableId={`project-${project.id}`}
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
            
            // Don't open modal if event was already handled (defaultPrevented)
            if (e.defaultPrevented) return;
            
            // Check if Ctrl/Cmd key is pressed
            const isCtrlClick = e.ctrlKey || e.metaKey;
            
            // Call handler with Ctrl/Cmd flag
            onProjectClick(project, isCtrlClick);
          }}
          className={`relative group overflow-hidden border border-white/10 bg-gradient-to-br from-black/80 via-[#0c1624]/70 to-[#050b12]/70 shadow-[0_25px_60px_rgba(8,12,20,0.4)] transition-all duration-300 ${
            isEditMode ? 'cursor-move' : 'cursor-pointer'
          } ${
            snapshot.isDragging 
              ? 'shadow-[0_30px_70px_rgba(20,200,0,0.5)] ring-4 ring-[#14C800] scale-105 opacity-95 z-50 bg-gradient-to-br from-black/90 via-[#0c1624]/80 to-[#050b12]/80' 
              : 'hover:scale-[1.01] hover:shadow-[0_30px_70px_rgba(20,200,0,0.18)]'
          }`}
          style={{
            ...provided.draggableProps.style,
          }}
          title={isEditMode ? "Drag anywhere to reorder • Click to view • Ctrl/Cmd+Click to open modal" : "View project"}
        >
          {/* Edit/Delete Action Buttons (visible in edit mode) */}
          <div 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <ProjectActionButtons
              project={project}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>

          <div className="flex flex-col lg:flex-row">
            <div className="relative lg:w-2/5 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#14C800]/15 via-transparent to-black/60 pointer-events-none mix-blend-screen" />
              {/* Project Thumbnail with Edit Capability */}
              <ProjectImageSelector
                project={project}
                category="thumbnail"
                currentImagePath={projectImage}
                alt={projectText.name}
                className="w-full h-64 lg:h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            <div className="flex-1 bg-black/40 backdrop-blur-sm p-6 lg:p-10 flex flex-col gap-6">
              <div className="space-y-3">
                <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                  {projectText.name}
                </h3>
                <p className="text-white/70 text-base md:text-lg leading-relaxed">
                  {description}
                </p>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {tags.map((tag) => (
                    <span
                      key={`${project.id}-${tag}`}
                      className="chip chip-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-white/60 text-sm uppercase tracking-[0.2em]">
                  {translations[language]?.project_cta_hint || 'Discover the details'}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onViewDetails(project.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="btn-flat btn-flat-lg inline-flex items-center justify-center gap-2 font-semibold cursor-pointer"
                >
                  {viewProjectLabel.renderEditable('font-semibold text-white')}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default DraggableProjectCard;
