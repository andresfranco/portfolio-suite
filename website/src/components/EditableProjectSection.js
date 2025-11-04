import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { DraggableTextContent, DraggableImageContent, DraggableFileContent } from './DraggableSectionContent';
import { useEditMode } from '../context/EditModeContext';
import portfolioApi from '../services/portfolioApi';

/**
 * EditableProjectSection Component
 * Renders a project section in edit mode with nested drag and drop for its content
 */
const EditableProjectSection = ({ section, language, isEditMode, onContentReorder }) => {
  const { token } = useEditMode();
  const isReorderingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  
  // Get section text in current language
  const sectionText = section.section_texts?.find(
    text => text.language?.code === language
  ) || section.section_texts?.[0];

  if (!sectionText) return null;

  const isBordered = section.display_style !== 'borderless';

  // Build content items array with their types and order
  const buildContentItems = () => {
    const items = [];
    
    // Add text as first item (always display_order 0)
    items.push({
      type: 'text',
      id: 'text',
      display_order: 0,
      data: sectionText.text
    });

    // Add images
    if (section.images && section.images.length > 0) {
      section.images.forEach(image => {
        items.push({
          type: 'image',
          id: image.id,
          display_order: image.display_order || 999,
          data: image
        });
      });
    }

    // Add attachments
    if (section.attachments && section.attachments.length > 0) {
      section.attachments.forEach(attachment => {
        items.push({
          type: 'file',
          id: attachment.id,
          display_order: attachment.display_order || 999,
          data: attachment
        });
      });
    }

    // Sort by display_order
    return items.sort((a, b) => a.display_order - b.display_order);
  };

  const [contentItems, setContentItems] = useState(buildContentItems());

  // Update content items when section data changes
  useEffect(() => {
    setContentItems(buildContentItems());
  }, [section, language]);

  /**
   * Handle drag end for section content
   */
  const handleContentDragEnd = async (result) => {
    console.log('Section content drag end:', result);
    
    if (!result.destination) {
      console.log('No destination - dropped outside');
      return;
    }
    
    if (result.destination.index === result.source.index) {
      console.log('No movement - same position');
      return;
    }

    // Prevent concurrent reordering operations
    if (isReorderingRef.current) {
      console.log('Reordering already in progress, skipping...');
      return;
    }

    isReorderingRef.current = true;

    console.log(`Moving content from index ${result.source.index} to ${result.destination.index}`);

    // Reorder the content items
    const reorderedItems = Array.from(contentItems);
    const [movedItem] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, movedItem);
    
    console.log('New content order:', reorderedItems);
    
    // Update local state immediately for instant feedback
    setContentItems(reorderedItems);
    
    // Notify parent component of the reorder
    if (onContentReorder) {
      onContentReorder(section.id, reorderedItems);
    }
    
    // Persist to backend API
    if (isEditMode && token) {
      setIsSaving(true);
      setSaveError(null);
      
      try {
        // Format content items for API (with display_order)
        const contentItemsWithOrder = reorderedItems.map((item, index) => ({
          type: item.type,
          id: item.id,
          display_order: index
        }));

        await portfolioApi.reorderSectionContent(section.id, contentItemsWithOrder, token);
        console.log('Successfully saved content order to backend');
        
        // Show success feedback briefly
        setTimeout(() => setIsSaving(false), 800);
      } catch (error) {
        console.error('Failed to save content order:', error);
        setIsSaving(false);
        setSaveError('Failed to save changes. Please try again.');
        
        // Clear error after 5 seconds
        setTimeout(() => setSaveError(null), 5000);
      }
    }

    // Small delay before allowing next reorder
    setTimeout(() => {
      isReorderingRef.current = false;
    }, 500);
  };

  return (
    <div className={`relative ${isBordered ? "bg-gray-800/50 rounded-xl p-6 border border-gray-700/50" : ""}`}>
      {/* Saving indicator overlay */}
      {isSaving && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-[#14C800]/10 border border-[#14C800]/30 rounded-lg px-3 py-1.5 backdrop-blur-sm">
          <div className="w-3 h-3 border-2 border-[#14C800] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-[#14C800] font-medium">Saving...</span>
        </div>
      )}
      
      {/* Error indicator */}
      {saveError && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 backdrop-blur-sm">
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-xs text-red-500 font-medium">{saveError}</span>
        </div>
      )}
      
      <DragDropContext onDragEnd={handleContentDragEnd}>
        <Droppable droppableId={`section-${section.id}-content`} isDropDisabled={!isEditMode}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`space-y-6 transition-all duration-300 ${
                snapshot.isDraggingOver && isEditMode 
                  ? 'droppable-container is-dragging-over bg-[#14C800]/5 ring-1 ring-[#14C800]/30 ring-inset p-4 rounded-lg' 
                  : ''
              }`}
              style={{
                minHeight: snapshot.isDraggingOver ? '200px' : 'auto',
              }}
            >
              {contentItems.map((item, index) => {
                switch (item.type) {
                  case 'text':
                    return (
                      <DraggableTextContent
                        key={`text-${item.id}`}
                        text={item.data}
                        index={index}
                        isEditMode={isEditMode}
                        sectionId={section.id}
                        isBordered={isBordered}
                      />
                    );
                  
                  case 'image':
                    return (
                      <DraggableImageContent
                        key={`image-${item.id}`}
                        image={item.data}
                        index={index}
                        isEditMode={isEditMode}
                        sectionId={section.id}
                        isBordered={isBordered}
                      />
                    );
                  
                  case 'file':
                    return (
                      <DraggableFileContent
                        key={`file-${item.id}`}
                        attachment={item.data}
                        index={index}
                        isEditMode={isEditMode}
                        sectionId={section.id}
                      />
                    );
                  
                  default:
                    return null;
                }
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default EditableProjectSection;
