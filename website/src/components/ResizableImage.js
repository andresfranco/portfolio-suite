import React, { useState, useRef, useEffect } from 'react';
import './ResizableImage.css';

/**
 * ResizableImage Component
 * Displays an image with resize handles in edit mode
 * Maintains aspect ratio while resizing
 */
const ResizableImage = ({ src, alt, className, isEditMode, onError }) => {
  const [isSelected, setIsSelected] = useState(false);
  const [dimensions, setDimensions] = useState({ width: null, height: null });
  const imageRef = useRef(null);
  const resizeDataRef = useRef(null);

  // Initialize dimensions when image loads
  useEffect(() => {
    const img = imageRef.current;
    if (img && img.complete) {
      setDimensions({
        width: img.offsetWidth,
        height: img.offsetHeight
      });
    }
  }, [src]);

  const handleImageLoad = (e) => {
    setDimensions({
      width: e.target.offsetWidth,
      height: e.target.offsetHeight
    });
  };

  const handleImageClick = (e) => {
    if (isEditMode) {
      e.stopPropagation();
      setIsSelected(true);
    }
  };

  // Deselect when clicking outside
  useEffect(() => {
    if (!isEditMode) return;

    const handleClickOutside = (e) => {
      if (imageRef.current && !imageRef.current.parentElement.contains(e.target)) {
        setIsSelected(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditMode]);

  const startResize = (e, handle) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();

    const img = imageRef.current;
    if (!img) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = img.offsetWidth;
    const startHeight = img.offsetHeight;
    const aspectRatio = startWidth / startHeight;

    resizeDataRef.current = {
      startX,
      startY,
      startWidth,
      startHeight,
      aspectRatio,
      handle
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = window.getComputedStyle(e.target).cursor;
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e) => {
    if (!resizeDataRef.current) return;
    const { startX, startY, startWidth, startHeight, aspectRatio, handle } = resizeDataRef.current;

    let newWidth = startWidth;
    let newHeight = startHeight;

    switch (handle) {
      case 'se': // Southeast (bottom-right)
        newWidth = startWidth + (e.clientX - startX);
        newHeight = newWidth / aspectRatio;
        break;
      case 'sw': // Southwest (bottom-left)
        newWidth = startWidth - (e.clientX - startX);
        newHeight = newWidth / aspectRatio;
        break;
      case 'e': // East (right)
        newWidth = startWidth + (e.clientX - startX);
        newHeight = newWidth / aspectRatio;
        break;
      case 'w': // West (left)
        newWidth = startWidth - (e.clientX - startX);
        newHeight = newWidth / aspectRatio;
        break;
      default:
        break;
    }

    // Enforce minimum size
    if (newWidth < 100) newWidth = 100;
    if (newHeight < 100) newHeight = 100;

    setDimensions({ width: newWidth, height: newHeight });
  };

  const handleMouseUp = () => {
    resizeDataRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  return (
    <div
      className={`resizable-image-container ${isSelected && isEditMode ? 'image-selected' : ''}`}
      style={dimensions.width ? { width: `${dimensions.width}px`, height: `${dimensions.height}px` } : {}}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className={className}
        onClick={handleImageClick}
        onLoad={handleImageLoad}
        onError={onError}
        style={dimensions.width ? { width: '100%', height: '100%', objectFit: 'contain' } : {}}
      />
      {isSelected && isEditMode && (
        <>
          <div
            className="image-resize-handle image-resize-handle-se"
            onMouseDown={(e) => startResize(e, 'se')}
          />
          <div
            className="image-resize-handle image-resize-handle-sw"
            onMouseDown={(e) => startResize(e, 'sw')}
          />
          <div
            className="image-resize-handle image-resize-handle-e"
            onMouseDown={(e) => startResize(e, 'e')}
          />
          <div
            className="image-resize-handle image-resize-handle-w"
            onMouseDown={(e) => startResize(e, 'w')}
          />
        </>
      )}
    </div>
  );
};

export default ResizableImage;
