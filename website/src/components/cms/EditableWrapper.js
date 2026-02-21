import React from 'react';
import { useEditMode } from '../../context/EditModeContext';

/**
 * Editable Wrapper Component
 * Wraps content that can be edited in edit mode
 * Shows visual indicators and handles click events for editing
 * Supports Ctrl/Cmd+Click to follow links even in edit mode
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Content to wrap
 * @param {Function} props.onEdit - Callback when content is clicked in edit mode
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.label - Label to show in edit indicator (default: "Click to edit")
 * @param {boolean} props.disabled - Disable editing (still shows indicator)
 */
export const EditableWrapper = ({
  children,
  onEdit,
  className = '',
  label = 'Click to edit',
  disabled = false,
}) => {
  const { isEditMode } = useEditMode();

  // If not in edit mode, render children without wrapper
  if (!isEditMode) {
    return <>{children}</>;
  }

  const handleClick = (e) => {
    // Allow Ctrl/Cmd+Click to propagate (for following links)
    const isModifierClick = e.ctrlKey || e.metaKey;
    
    if (isModifierClick) {
      // Let the click propagate for link following
      return;
    }
    
    if (!disabled && onEdit) {
      e.stopPropagation();
      e.preventDefault();
      onEdit();
    }
  };

  return (
    <div
      className={`relative group ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      onClick={handleClick}
    >
      {children}
      
      {/* Edit indicator overlay */}
      <div className={`
        absolute inset-0 
        border-2 border-blue-500 border-dashed 
        opacity-0 group-hover:opacity-100 
        pointer-events-none 
        transition-opacity duration-200
        rounded
        ${disabled ? 'border-gray-400' : 'border-blue-500'}
      `}>
        {/* Edit label */}
        <span className={`
          absolute top-0 right-0 
          text-xs px-2 py-1 
          rounded-bl
          font-medium
          shadow-sm
          ${disabled 
            ? 'bg-gray-400 text-white' 
            : 'bg-blue-500 text-white'
          }
        `}>
          {disabled ? 'View only' : `${label} • Ctrl+Click to follow link`}
        </span>
      </div>

      {/* Corner indicator (always visible in edit mode) */}
      <div className={`
        absolute top-0 left-0 
        w-0 h-0 
        border-t-8 border-l-8 
        opacity-30 group-hover:opacity-0
        transition-opacity duration-200
        ${disabled 
          ? 'border-t-gray-400 border-l-gray-400' 
          : 'border-t-blue-500 border-l-blue-500'
        }
      `} style={{ borderRightWidth: '8px', borderRightColor: 'transparent' }}></div>
    </div>
  );
};

/**
 * Editable Text Wrapper
 * Specialized wrapper for text content with optimized styling
 * Supports Ctrl/Cmd+Click to follow links even in edit mode
 */
export const EditableTextWrapper = ({
  children,
  onEdit,
  className = '',
  label = 'Edit text',
  disabled = false,
  block = false,
}) => {
  const { isEditMode } = useEditMode();

  if (!isEditMode) {
    return <>{children}</>;
  }

  const handleClick = (e) => {
    // Allow Ctrl/Cmd+Click to propagate (for following links)
    const isModifierClick = e.ctrlKey || e.metaKey;

    if (isModifierClick) {
      // Let the click propagate for link following
      return;
    }

    if (!disabled && onEdit) {
      e.stopPropagation();
      e.preventDefault();
      onEdit();
    }
  };

  const Element = block ? 'div' : 'span';
  const displayClass = block ? 'block' : 'inline-block';

  return (
    <Element
      className={`relative ${displayClass} group ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${className}`}
      onClick={handleClick}
      style={disabled ? { pointerEvents: 'none' } : {}}
    >
      {children}
      
      {/* Underline indicator */}
      <span className={`absolute bottom-0 left-0 right-0 h-0.5 ${disabled ? 'bg-gray-400' : 'bg-blue-500'} opacity-0 group-hover:opacity-100 transition-opacity`}></span>
      
      {/* Edit icon */}
      <span className={`
        absolute -top-1 -right-6
        opacity-0 group-hover:opacity-100
        transition-opacity
        ${disabled ? 'text-gray-400' : 'text-blue-500'}
      `}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </span>
    </Element>
  );
};

/**
 * Editable Image Wrapper
 * Specialized wrapper for images with upload indicator
 */
export const EditableImageWrapper = ({
  children,
  onEdit,
  className = '',
  label = 'Change image',
}) => {
  const { isEditMode } = useEditMode();

  if (!isEditMode) {
    return <>{children}</>;
  }

  const handleClick = (e) => {
    if (onEdit) {
      e.stopPropagation();
      onEdit();
    }
  };

  return (
    <div
      className={`group cursor-pointer ${className}`}
      onClick={handleClick}
    >
      {children}
      
      {/* Overlay with icon */}
      <div className="
        absolute inset-0
        bg-black bg-opacity-0 group-hover:bg-opacity-60
        flex items-center justify-center
        transition-all duration-200
        rounded
        pointer-events-none
      ">
        <div className="btn-image-change opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{label}</span>
        </div>
      </div>

      {/* Border indicator */}
      <div className="
        absolute inset-0
        border-2 border-[#14C800] border-dashed
        opacity-0 group-hover:opacity-100
        transition-opacity duration-200
        rounded
        pointer-events-none
      "></div>
    </div>
  );
};

/**
 * Editable Section Wrapper
 * Wrapper for larger sections/blocks of content
 */
export const EditableSectionWrapper = ({
  children,
  onEdit,
  className = '',
  label = 'Edit section',
  title,
}) => {
  const { isEditMode } = useEditMode();

  if (!isEditMode) {
    return <>{children}</>;
  }

  const handleClick = (e) => {
    if (onEdit) {
      e.stopPropagation();
      onEdit();
    }
  };

  return (
    <div
      className={`relative group ${className}`}
      onClick={handleClick}
    >
      {children}
      
      {/* Section overlay */}
      <div className="
        absolute inset-0 
        border-2 border-blue-500 border-dashed
        opacity-0 group-hover:opacity-100
        transition-opacity duration-200
        rounded-lg
        pointer-events-none
      ">
        {/* Section header */}
        <div className="
          absolute -top-3 left-4
          bg-blue-500 text-white
          px-3 py-1
          rounded-full
          text-xs font-medium
          shadow-md
          flex items-center gap-2
        ">
          {title && <span className="font-semibold">{title}</span>}
          {title && <span className="text-blue-200">•</span>}
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
};

export default EditableWrapper;
