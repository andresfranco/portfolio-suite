import React, { useState, useEffect, useRef } from 'react';
import { FaPlus, FaTrash, FaTimes, FaImage, FaFile, FaEdit, FaUpload, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { portfolioApi } from '../../services/portfolioApi';
import { useEditMode } from '../../context/EditModeContext';

/**
 * ConfirmDialog Component
 * Elegant confirmation dialog with theme styling
 */
const ConfirmDialog = ({ isOpen, onConfirm, onCancel, title, message, confirmText = 'Delete', cancelText = 'Cancel', isDanger = true }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700/50 rounded-xl p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${isDanger ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
            <FaExclamationTriangle size={24} />
          </div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>

        <p className="text-gray-300 mb-6 leading-relaxed">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded font-semibold transition-all duration-200 ${
              isDanger
                ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 hover:border-red-500 text-red-400 hover:text-red-300'
                : 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 hover:border-blue-500 text-blue-400 hover:text-blue-300'
            }`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded font-semibold bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 text-gray-300 hover:text-white transition-all duration-200"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * ProjectSectionManager Component
 * Manages sections for a project in edit mode with image and file upload
 */
const ProjectSectionManager = ({ project, onUpdate }) => {
  const { authToken } = useEditMode();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Load project sections
  useEffect(() => {
    if (project?.id) {
      loadSections();
    }
  }, [project?.id]);

  const loadSections = async () => {
    try {
      setLoading(true);
      const data = await portfolioApi.getProjectSections(project.id, authToken);
      // Add timestamp to images to prevent caching issues
      const sectionsWithTimestamp = (data || []).map(section => ({
        ...section,
        images: (section.images || []).map(img => ({
          ...img,
          _loadTimestamp: Date.now()
        }))
      }));
      setSections(sectionsWithTimestamp);
    } catch (err) {
      console.error('Error loading sections:', err);
      setError('Failed to load sections');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSection = (sectionId) => {
    setConfirmDelete({
      type: 'section',
      id: sectionId,
      title: 'Remove Section',
      message: 'Are you sure you want to remove this section from the project? This will not delete the section itself, only remove it from this project.',
    });
  };

  const confirmRemoveSection = async () => {
    if (!confirmDelete) return;

    try {
      await portfolioApi.removeSectionFromProject(project.id, confirmDelete.id, authToken);
      await loadSections();
      if (onUpdate) onUpdate();
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error removing section:', err);
      setError('Failed to remove section');
      setConfirmDelete(null);
    }
  };

  const handleEditSection = (section) => {
    setEditingSection(section);
  };

  const handleSectionUpdated = async () => {
    await loadSections();
    if (onUpdate) onUpdate();
    setEditingSection(null);
  };

  // Force refresh sections when dialog closes (to get updated images)
  const handleCloseDialog = () => {
    setShowAddDialog(false);
    loadSections(); // Refresh to get latest data
  };

  const handleEditClose = () => {
    setEditingSection(null);
    loadSections(); // Refresh to get latest data
  };

  return (
    <div className="mt-8 border-t border-gray-700/50 pt-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Project Sections</h3>
        <button
          onClick={() => setShowAddDialog(true)}
          className="btn-flat btn-flat-sm flex items-center gap-2"
        >
          <FaPlus />
          <span>Add Section</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400">Loading sections...</div>
      ) : sections.length === 0 ? (
        <div className="bg-gray-800/30 rounded-xl p-8 text-center border border-gray-700/50">
          <p className="text-gray-400 mb-2">No sections added yet.</p>
          <p className="text-sm text-gray-500">Sections allow you to add rich content with text, images, and downloadable files.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sections
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            .map((section) => {
              const sectionText = section.section_texts?.[0];
              
              // Determine if section should have borders
              const isBordered = section.display_style !== 'borderless';
              const containerClasses = isBordered
                ? "bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 relative"
                : "relative p-6";
              
              return (
                <div
                  key={section.id}
                  className={containerClasses}
                >
                  {/* Edit controls */}
                  <div className="absolute top-4 right-4 flex gap-2 bg-gray-900/90 p-2 rounded border border-gray-700/50">
                    <button
                      onClick={() => handleEditSection(section)}
                      className="text-blue-400 hover:text-blue-300 p-2"
                      title="Edit section"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleRemoveSection(section.id)}
                      className="text-red-400 hover:text-red-300 p-2"
                      title="Remove section"
                    >
                      <FaTrash />
                    </button>
                  </div>

                  {/* Section metadata */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
                      {section.code}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
                      Order: {section.display_order || 0}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      isBordered 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    }`}>
                      {isBordered ? 'Bordered' : 'Borderless'}
                    </span>
                  </div>

                  {/* Section content preview */}
                  {sectionText && (
                    <div className="prose prose-lg prose-invert max-w-none mb-4">
                      <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {sectionText.text}
                      </p>
                    </div>
                  )}

                  {/* Section images */}
                  {section.images && section.images.length > 0 && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {section.images
                        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                        .map((image) => {
                          // Remove leading slash to avoid double slashes
                          const cleanPath = image.image_path.startsWith('/') 
                            ? image.image_path.substring(1) 
                            : image.image_path;
                          const imageUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${cleanPath}`;
                          // Add timestamp to prevent caching issues
                          const timestamp = image._uploadTimestamp || image._loadTimestamp || Date.now();
                          const timestampedUrl = `${imageUrl}?t=${timestamp}`;
                          
                          return (
                            <img
                              key={image.id}
                              src={timestampedUrl}
                              alt="Section diagram"
                              className="w-full rounded-lg border border-gray-700/50"
                              onError={(e) => {
                                console.error('Failed to load section image:', image.image_path, 'URL:', timestampedUrl);
                              }}
                            />
                          );
                        })}
                    </div>
                  )}

                  {/* Section attachments */}
                  {section.attachments && section.attachments.length > 0 && (
                    <div className="mt-6 space-y-2">
                      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Downloads</h4>
                      <div className="flex flex-wrap gap-3">
                        {section.attachments
                          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                          .map((attachment) => {
                            // Remove leading slash to avoid double slashes
                            const cleanPath = attachment.file_path.startsWith('/') 
                              ? attachment.file_path.substring(1) 
                              : attachment.file_path;
                            const fileUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${cleanPath}`;
                            
                            return (
                              <a
                                key={attachment.id}
                                href={fileUrl}
                                download={attachment.file_name}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 border border-[#14C800]/30 hover:border-[#14C800]/60 rounded text-[#14C800] hover:text-white transition-all duration-200"
                              >
                                <FaFile size={14} />
                                <span className="text-sm">{attachment.file_name}</span>
                              </a>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {showAddDialog && (
        <SectionEditorDialog
          projectId={project.id}
          authToken={authToken}
          onClose={handleCloseDialog}
          onSuccess={async () => {
            setShowAddDialog(false);
            await loadSections();
            if (onUpdate) onUpdate();
          }}
        />
      )}

      {editingSection && (
        <SectionEditorDialog
          projectId={project.id}
          section={editingSection}
          authToken={authToken}
          onClose={handleEditClose}
          onSuccess={handleSectionUpdated}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDelete && confirmDelete.type === 'section'}
        onConfirm={confirmRemoveSection}
        onCancel={() => setConfirmDelete(null)}
        title={confirmDelete?.title || 'Confirm'}
        message={confirmDelete?.message || 'Are you sure?'}
      />
    </div>
  );
};

/**
 * SectionEditorDialog Component
 * Dialog for creating/editing sections with image and file upload
 */
const SectionEditorDialog = ({ projectId, section, authToken, onClose, onSuccess }) => {
  const isEditing = !!section;
  const [formData, setFormData] = useState({
    code: section?.code || '',
    section_texts: section?.section_texts || [{ language_id: 1, text: '' }],
    display_order: section?.display_order || 0,
    display_style: section?.display_style || 'bordered', // New field
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Image upload state
  const [images, setImages] = useState(section?.images || []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef(null);

  // File upload state
  const [attachments, setAttachments] = useState(section?.attachments || []);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.code.trim()) {
      setError('Section code is required');
      return;
    }

    if (!formData.section_texts[0].text.trim()) {
      setError('Section text is required');
      return;
    }

    try {
      setLoading(true);
      if (isEditing) {
        // Update existing section
        await portfolioApi.updateSection(section.id, formData, authToken);
      } else {
        // Create new section
        await portfolioApi.createProjectSection(projectId, formData, authToken);
      }
      onSuccess();
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} section:`, err);
      setError(err.message || `Failed to ${isEditing ? 'update' : 'create'} section`);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      setError('Invalid image type. Please upload JPEG, PNG, GIF, or WebP images.');
      return;
    }

    if (file.size > maxSize) {
      setError('Image size too large. Maximum size is 5MB.');
      return;
    }

    if (!isEditing) {
      setError('Please create the section first, then add images.');
      return;
    }

    try {
      setUploadingImage(true);
      setError('');

      // Upload image to section
      const response = await portfolioApi.uploadImage(
        file,
        'section',
        section.id,
        'section',
        authToken
      );

      // Add image to section
      const imageData = {
        image_path: response.image_path || response.path,
        display_order: images.length
      };

      const newImage = await portfolioApi.addSectionImage(section.id, imageData, authToken);
      // Add timestamp to force image refresh on newly uploaded images
      newImage._uploadTimestamp = Date.now();
      setImages([...images, newImage]);

      // Clear input
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (imageId) => {
    setConfirmDelete({
      type: 'image',
      id: imageId,
      title: 'Remove Image',
      message: 'Are you sure you want to remove this image? This action cannot be undone.',
    });
  };

  const confirmRemoveImage = async () => {
    if (!confirmDelete || confirmDelete.type !== 'image') return;

    try {
      await portfolioApi.deleteSectionImage(confirmDelete.id, authToken);
      setImages(images.filter(img => img.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error removing image:', err);
      setError('Failed to remove image');
      setConfirmDelete(null);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (file.size > maxSize) {
      setError('File size too large. Maximum size is 10MB.');
      return;
    }

    if (!isEditing) {
      setError('Please create the section first, then add files.');
      return;
    }

    try {
      setUploadingFile(true);
      setError('');

      // Upload file
      const response = await portfolioApi.uploadAttachment(
        file,
        'section',
        section.id,
        authToken
      );

      // Add attachment to section
      const attachmentData = {
        file_path: response.file_path || response.path,
        file_name: file.name,
        display_order: attachments.length
      };

      const newAttachment = await portfolioApi.addSectionAttachment(section.id, attachmentData, authToken);
      setAttachments([...attachments, newAttachment]);

      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = (attachmentId, fileName) => {
    setConfirmDelete({
      type: 'attachment',
      id: attachmentId,
      title: 'Remove File',
      message: `Are you sure you want to remove "${fileName}"? This action cannot be undone.`,
    });
  };

  const confirmRemoveAttachment = async () => {
    if (!confirmDelete || confirmDelete.type !== 'attachment') return;

    try {
      await portfolioApi.deleteSectionAttachment(confirmDelete.id, authToken);
      setAttachments(attachments.filter(att => att.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error removing attachment:', err);
      setError('Failed to remove attachment');
      setConfirmDelete(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-[#14C800]/30 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? 'Edit Section' : 'Add New Section'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={loading}
          >
            <FaTimes size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section Code */}
          <div>
            <label className="block mb-2 font-semibold text-white text-sm uppercase tracking-wide">
              Section Code *
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, code: e.target.value }))
              }
              className="w-full px-4 py-3 bg-white/5 border border-[#14C800]/50 rounded-none focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 text-white placeholder-white/50"
              placeholder="e.g., technical-architecture"
              disabled={loading || isEditing}
            />
            {isEditing && (
              <p className="text-xs text-gray-500 mt-1">Section code cannot be changed after creation</p>
            )}
          </div>

          {/* Section Content */}
          <div>
            <label className="block mb-2 font-semibold text-white text-sm uppercase tracking-wide">
              Section Content *
            </label>
            <textarea
              value={formData.section_texts[0].text}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  section_texts: [{ language_id: 1, text: e.target.value }],
                }))
              }
              rows={8}
              className="w-full px-4 py-3 bg-white/5 border border-[#14C800]/50 rounded-none focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 text-white placeholder-white/50 font-mono text-sm"
              placeholder="Enter section content..."
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Supports line breaks and formatting</p>
          </div>

          {/* Display Order */}
          <div>
            <label className="block mb-2 font-semibold text-white text-sm uppercase tracking-wide">
              Display Order
            </label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  display_order: parseInt(e.target.value) || 0,
                }))
              }
              className="w-full px-4 py-3 bg-white/5 border border-[#14C800]/50 rounded-none focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 text-white placeholder-white/50"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Lower numbers appear first (0 = first)</p>
          </div>

          {/* Display Style Toggle */}
          <div>
            <label className="block mb-3 font-semibold text-white text-sm uppercase tracking-wide">
              Display Style
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, display_style: 'bordered' }))}
                className={`flex-1 px-4 py-3 rounded font-semibold transition-all duration-200 ${
                  formData.display_style === 'bordered'
                    ? 'bg-[#14C800]/20 border-2 border-[#14C800] text-[#14C800]'
                    : 'bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
                disabled={loading}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full h-12 border-2 border-current rounded bg-current/10"></div>
                  <span className="text-sm">With Border</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, display_style: 'borderless' }))}
                className={`flex-1 px-4 py-3 rounded font-semibold transition-all duration-200 ${
                  formData.display_style === 'borderless'
                    ? 'bg-[#14C800]/20 border-2 border-[#14C800] text-[#14C800]'
                    : 'bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
                disabled={loading}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full h-12 border-0 bg-transparent">
                    <div className="w-full h-full bg-current/10"></div>
                  </div>
                  <span className="text-sm">Borderless</span>
                </div>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Choose how this section appears: with a bordered box or seamlessly integrated into the page
            </p>
          </div>

          {/* Images Section - Only for editing */}
          {isEditing && (
            <div className="border-t border-gray-700/50 pt-6">
              <div className="flex justify-between items-center mb-4">
                <label className="font-semibold text-white text-sm uppercase tracking-wide">
                  Images
                </label>
                <label className="btn-flat btn-flat-sm flex items-center gap-2 cursor-pointer">
                  <FaUpload />
                  <span>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              </div>

              {images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((image) => {
                    // Remove leading slash from image_path if present to avoid double slashes
                    const cleanPath = image.image_path.startsWith('/') ? image.image_path.substring(1) : image.image_path;
                    const imageUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${cleanPath}`;
                    const timestampedUrl = image._uploadTimestamp ? `${imageUrl}?t=${image._uploadTimestamp}` : imageUrl;

                    return (
                      <div key={image.id} className="relative group">
                        <img
                          src={timestampedUrl}
                          alt="Section image"
                          className="w-full h-32 object-cover rounded border border-gray-700/50"
                          onError={(e) => {
                            console.error('Failed to load image:', image.image_path, 'URL:', timestampedUrl);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(image.id)}
                          className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-800/30 rounded border border-gray-700/50">
                  No images added yet. Click "Upload Image" to add diagrams or screenshots.
                </p>
              )}
            </div>
          )}

          {/* Files Section - Only for editing */}
          {isEditing && (
            <div className="border-t border-gray-700/50 pt-6">
              <div className="flex justify-between items-center mb-4">
                <label className="font-semibold text-white text-sm uppercase tracking-wide">
                  Downloadable Files
                </label>
                <label className="btn-flat btn-flat-sm flex items-center gap-2 cursor-pointer">
                  <FaUpload />
                  <span>{uploadingFile ? 'Uploading...' : 'Upload File'}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploadingFile}
                  />
                </label>
              </div>

              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex justify-between items-center p-3 bg-gray-800/50 rounded border border-gray-700/50"
                    >
                      <div className="flex items-center gap-2">
                        <FaFile className="text-gray-400" />
                        <span className="text-sm text-white">{attachment.file_name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(attachment.id, attachment.file_name)}
                        className="text-red-400 hover:text-red-300 p-2"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-800/30 rounded border border-gray-700/50">
                  No files added yet. Click "Upload File" to add downloadable documents.
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6 border-t border-gray-700/50">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <>Saving...</>
              ) : isEditing ? (
                <><FaCheck /> Update Section</>
              ) : (
                <><FaPlus /> Create Section</>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 btn-flat"
            >
              {isEditing ? 'Close' : 'Cancel'}
            </button>
          </div>

          {!isEditing && (
            <p className="text-xs text-gray-500 text-center">
              Note: Images and files can be added after creating the section
            </p>
          )}
        </form>

        {/* Confirmation Dialog */}
        <ConfirmDialog
          isOpen={!!confirmDelete}
          onConfirm={confirmDelete?.type === 'image' ? confirmRemoveImage : confirmRemoveAttachment}
          onCancel={() => setConfirmDelete(null)}
          title={confirmDelete?.title || 'Confirm'}
          message={confirmDelete?.message || 'Are you sure?'}
        />
      </div>
    </div>
  );
};

export default ProjectSectionManager;
