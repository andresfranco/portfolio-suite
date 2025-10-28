import React, { useState, useRef, useContext, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { LanguageContext } from '../../context/LanguageContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * ProjectImageSelector Component
 * Allows selecting from existing project images or uploading new ones
 * Filters images by category (thumbnail, logo) and language
 * 
 * @param {Object} project - The project object
 * @param {string} category - Image category ('thumbnail' or 'logo')
 * @param {string} currentImagePath - Current image path
 * @param {string} alt - Alt text for the image
 * @param {string} className - CSS classes for the image
 * @param {Function} onImageChange - Callback after image change
 */
export const ProjectImageSelector = ({ 
  project,
  category = 'thumbnail',
  currentImagePath,
  alt = '',
  className = '',
  onImageChange
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [availableImages, setAvailableImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const fileInputRef = useRef(null);
  
  const { authToken, isEditMode, showNotification } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  const { language } = useContext(LanguageContext);

  // Get current language ID
  const getCurrentLanguageId = () => {
    // This is a simplified version - you may need to adjust based on your language setup
    return language === 'en' ? 1 : 2;
  };

  // Get the current image for this category and language
  const getCurrentImage = () => {
    if (!project?.images) return currentImagePath;
    
    const languageId = getCurrentLanguageId();
    // Map category to backend code
    const categoryCode = category === 'thumbnail' ? 'PROI-THUMBNAIL' : 'PROI-LOGO';
    
    // Find image matching category and language
    const matchingImage = project.images.find(img => 
      img.category === categoryCode && 
      (!img.language_id || img.language_id === languageId)
    );
    
    if (matchingImage) {
      // Use image_url if available (preferred), otherwise construct from image_path
      return matchingImage.image_url 
        ? `${API_BASE_URL}${matchingImage.image_url}`
        : `${API_BASE_URL}/uploads/${matchingImage.image_path}`;
    }
    
    // Fallback to any image with this category (no language filter)
    const fallbackImage = project.images.find(img => img.category === categoryCode);
    if (fallbackImage) {
      return fallbackImage.image_url 
        ? `${API_BASE_URL}${fallbackImage.image_url}`
        : `${API_BASE_URL}/uploads/${fallbackImage.image_path}`;
    }
    
    return currentImagePath;
  };

  // Load available images when modal opens
  useEffect(() => {
    if (isModalOpen && project?.images) {
      const languageId = getCurrentLanguageId();
      // Map category to backend code
      const categoryCode = category === 'thumbnail' ? 'PROI-THUMBNAIL' : 'PROI-LOGO';
      
      // Filter images by category (and optionally by language)
      const filtered = project.images.filter(img => {
        if (img.category !== categoryCode) return false;
        // Show images with matching language or no language set
        if (img.language_id && img.language_id !== languageId) return false;
        return true;
      });
      
      setAvailableImages(filtered);
    }
  }, [isModalOpen, project, category, language]);

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
    if (!file || !project?.id) return;
    
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
    
    try {
      // Map category to backend code: thumbnail -> PROI-THUMBNAIL, logo -> PROI-LOGO
      const categoryCode = category === 'thumbnail' ? 'PROI-THUMBNAIL' : 'PROI-LOGO';
      const languageId = getCurrentLanguageId();
      
      // For unique categories (logo, thumbnail), delete existing image before uploading new one
      // Note: Gallery and other multi-image categories should use a different component
      const existingImage = project.images?.find(img => 
        img.category === categoryCode && 
        img.language_id === languageId
      );
      
      // If an existing image exists, delete it first
      // This is intentional for logo/thumbnail to maintain one image per language
      if (existingImage) {
        try {
          console.log(`Deleting existing ${category} image (ID: ${existingImage.id}) before uploading new one`);
          const deleteResponse = await fetch(
            `${API_BASE_URL}/api/projects/${project.id}/images/${existingImage.id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${authToken}`,
              },
            }
          );
          
          if (!deleteResponse.ok) {
            console.warn('Failed to delete old image, backend will handle it');
          } else {
            console.log('Successfully deleted old image');
          }
        } catch (deleteErr) {
          console.warn('Error deleting old image, backend will handle it:', deleteErr);
        }
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category_code', categoryCode);
      formData.append('language_id', languageId.toString());
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);
      
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${project.id}/images`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
          body: formData,
        }
      );
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }
      
      const result = await response.json();
      setUploadProgress(100);
      
      // Refresh portfolio data
      await refreshPortfolio();
      
      showNotification(
        'Image Uploaded',
        `${category} image uploaded successfully`,
        'success'
      );
      
      if (onImageChange) {
        onImageChange(result);
      }
      
      setIsModalOpen(false);
      setTimeout(() => {
        setUploadProgress(0);
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
   * Handle selecting an existing image
   */
  const handleSelectImage = async (image) => {
    // Since we filter by category and language, the displayed images are already
    // the ones being shown. Clicking on them doesn't change anything.
    // If you want to switch between images, you'd need to upload a new one
    // or delete the current one.
    console.log('Image already displayed:', image);
    setIsModalOpen(false);
  };

  /**
   * Handle deleting an image
   */
  const handleDeleteImage = async (image, event) => {
    // Stop event propagation to prevent triggering the select handler
    event.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete this ${category} image?`)) {
      return;
    }
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${project.id}/images/${image.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Delete failed');
      }
      
      showNotification(
        'Image Deleted',
        `${category} image deleted successfully`,
        'success'
      );
      
      // Refresh portfolio data
      await refreshPortfolio();
      
    } catch (err) {
      console.error('Delete failed:', err);
      showNotification(
        'Delete Failed',
        err.message || 'Failed to delete image',
        'error'
      );
    }
  };

  /**
   * Trigger file input click
   */
  const handleUploadClick = () => {
    if (fileInputRef.current && !uploading) {
      fileInputRef.current.click();
    }
  };

  // If not in edit mode, just display the image
  if (!isEditMode) {
    return (
      <img 
        src={getCurrentImage()} 
        alt={alt} 
        className={className}
      />
    );
  }

  const imageUrl = getCurrentImage();

  return (
    <>
      {/* Image with edit overlay */}
      <div 
        className="relative group"
        onClick={(e) => {
          // Only stop propagation if clicking on the image itself, not the button
          // The button will handle its own stopPropagation
          if (e.target.tagName === 'IMG' || e.target === e.currentTarget) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <img 
          src={imageUrl} 
          alt={alt} 
          className={className}
        />
        
        {/* Edit overlay - only visible in edit mode */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsModalOpen(true);
            }}
            className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white text-gray-800 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-100 flex items-center gap-2 pointer-events-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Change {category}
          </button>
        </div>
      </div>

      {/* Image Selector Modal - Rendered as portal */}
      {isModalOpen && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Close modal when clicking backdrop
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => {
              // Stop propagation from modal content to backdrop
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div className="border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">
                Manage {category === 'thumbnail' ? 'Thumbnail' : 'Logo'} Image
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Upload Section */}
              <div className="mb-8">
                <h4 className="text-lg font-semibold text-gray-700 mb-4">Upload New Image</h4>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <button
                    onClick={handleUploadClick}
                    disabled={uploading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading...' : 'Choose File'}
                  </button>
                  <p className="text-sm text-gray-500 mt-2">
                    or drag and drop an image here
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PNG, JPG, GIF, WebP up to 5MB
                  </p>
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Uploading...</span>
                      <span className="text-sm text-gray-500">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-2.5 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}
              </div>

              {/* Existing Images Section */}
              <div>
                <h4 className="text-lg font-semibold text-gray-700 mb-4">
                  Current {category === 'thumbnail' ? 'Thumbnail' : 'Logo'} Images
                  <span className="text-sm text-gray-500 font-normal ml-2">
                    ({language.toUpperCase()})
                  </span>
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  Uploading a new image will replace the current one.
                </p>
                
                {availableImages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>No {category} images available for this language</p>
                    <p className="text-sm mt-1">Upload a new image above</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {availableImages.map((image) => {
                      const isSelected = imageUrl.includes(image.image_path);
                      // Use image_url if available, otherwise construct from image_path
                      const imgSrc = image.image_url 
                        ? `${API_BASE_URL}${image.image_url}`
                        : `${API_BASE_URL}/uploads/${image.image_path}`;
                      
                      return (
                        <div
                          key={image.id}
                          className={`
                            relative aspect-square rounded-lg overflow-hidden border-2
                            ${isSelected 
                              ? 'border-blue-500 ring-2 ring-blue-200' 
                              : 'border-gray-200'
                            }
                          `}
                        >
                          <img 
                            src={imgSrc}
                            alt={`${category} option`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error('Failed to load image:', imgSrc);
                              e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23ddd" width="200" height="200"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">No Image</text></svg>';
                            }}
                          />
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                          {/* Delete button */}
                          <button
                            onClick={(e) => handleDeleteImage(image, e)}
                            className="absolute bottom-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-colors"
                            title="Delete this image"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
};

export default ProjectImageSelector;
