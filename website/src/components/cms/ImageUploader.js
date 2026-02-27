import React, { useState, useRef, useContext } from 'react';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { LanguageContext } from '../../context/LanguageContext';
import { portfolioApi } from '../../services/portfolioApi';
import { EditableImageWrapper } from './EditableWrapper';
import {
  compressImage,
  getCompressionHint,
  getDimensionsForCategory,
  formatBytes,
} from '../../utils/imageCompression';

/**
 * ImageUploader Component
 * Allows uploading and replacing images for content entities
 * Supports drag-and-drop, click to upload, and preview
 * 
 * @param {string} currentImage - Current image URL
 * @param {string} entityType - Entity type ('portfolio', 'project', 'experience')
 * @param {number} entityId - Entity ID
 * @param {string} category - Image category ('main', 'thumbnail', 'gallery', 'background')
 * @param {string} alt - Alt text for the image
 * @param {string} className - CSS classes for the image
 * @param {Function} onUploadSuccess - Callback after successful upload
 */
export const ImageUploader = ({ 
  currentImage, 
  entityType, 
  entityId, 
  category,
  alt = '',
  className = '',
  onUploadSuccess 
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const [compressionHint, setCompressionHint] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('Uploading...');
  const fileInputRef = useRef(null);
  
  const { authToken, isEditMode, showNotification } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  const { language } = useContext(LanguageContext);
  
  /**
   * Validate file before upload
   */
  const validateFile = (file) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      return 'Invalid file type. Please upload JPEG, PNG, GIF, or WebP images.';
    }
    
    if (file.size > maxSize) {
      return 'File size too large. Maximum size is 5MB.';
    }
    
    return null;
  };
  
  /**
   * Handle file upload
   */
  const handleUpload = async (file) => {
    if (!file) return;

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      showNotification('Upload Error', validationError, 'error');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    // Create preview from original file
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);

    try {
      // ── Compress image before upload ──────────────────────────────────────
      const hint = getCompressionHint(file);
      if (hint.willCompress) {
        setUploadStatus('Optimising image…');
      }
      const [maxWidth, maxHeight] = getDimensionsForCategory(category);
      const { file: fileToUpload, originalSize, compressedSize } = await compressImage(
        file,
        { maxWidth, maxHeight, quality: 0.85 }
      );
      if (compressedSize < originalSize) {
        setCompressionHint({
          originalSize,
          compressedSize,
          label: `Optimised: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)}`,
        });
      }
      setUploadStatus('Uploading…');
      // ─────────────────────────────────────────────────────────────────────

      // Simulate progress (since fetch doesn't provide upload progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await portfolioApi.uploadImage(
        fileToUpload,
        entityType,
        entityId,
        category,
        authToken,
        language  // Pass current language
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Refresh portfolio data to get new image URL
      await refreshPortfolio();

      // Show success notification
      showNotification(
        'Image Uploaded',
        'Your image has been uploaded successfully',
        'success'
      );

      // Call success callback
      if (onUploadSuccess) {
        onUploadSuccess(response);
      }

      // Clear preview after a moment
      setTimeout(() => {
        setPreviewUrl(null);
        setUploadProgress(0);
        setCompressionHint(null);
        setUploadStatus('Uploading…');
      }, 1000);

    } catch (err) {
      console.error('Upload failed:', err);
      const errorMessage = err.message || 'Failed to upload image';
      setError(errorMessage);

      showNotification(
        'Upload Failed',
        errorMessage,
        'error'
      );

      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };
  
  /**
   * Handle file input change
   */
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleUpload(file);
    }
  };
  
  /**
   * Handle drag events
   */
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditMode && !uploading) {
      setDragOver(true);
    }
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    if (isEditMode && !uploading) {
      const file = e.dataTransfer.files[0];
      if (file) {
        handleUpload(file);
      }
    }
  };
  
  /**
   * Trigger file input click
   */
  const handleClick = () => {
    if (fileInputRef.current && !uploading) {
      fileInputRef.current.click();
    }
  };
  
  // If not in edit mode, just display the image
  if (!isEditMode) {
    return (
      <img 
        src={currentImage} 
        alt={alt} 
        className={className}
      />
    );
  }
  
  // Display URL for the image (handle both relative and absolute URLs)
  const imageUrl = previewUrl || currentImage;
  
  return (
    <div 
      className="absolute inset-0 w-full h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <EditableImageWrapper 
        onEdit={handleClick}
        className="absolute inset-0 w-full h-full"
        label={uploading ? 'Uploading...' : 'Change image'}
      >
        <img 
          src={imageUrl} 
          alt={alt} 
          className={`
            ${className}
            ${uploading ? 'opacity-50' : 'opacity-100'}
            transition-opacity duration-200
          `}
        />
      </EditableImageWrapper>
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {/* Upload progress overlay */}
      {uploading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center rounded">
          <div className="bg-white rounded-lg p-4 max-w-xs w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{uploadStatus}</span>
              <span className="text-sm text-gray-500">{uploadProgress}%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>

            {/* Compression info */}
            {compressionHint && (
              <p className="text-xs text-green-600 mt-2 text-center">{compressionHint.label}</p>
            )}

            {/* Upload icon */}
            <div className="flex justify-center mt-3">
              <svg className="animate-bounce w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
          </div>
        </div>
      )}
      
      {/* Drag overlay */}
      {dragOver && !uploading && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-4 border-blue-500 border-dashed flex items-center justify-center rounded">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <svg className="w-16 h-16 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-center text-blue-600 font-medium">Drop image to upload</p>
            <p className="text-center text-gray-400 text-xs mt-1">Large images will be automatically optimised</p>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-red-50 border-t-2 border-red-300 rounded-b">
          <p className="text-red-700 text-sm text-center">{error}</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
