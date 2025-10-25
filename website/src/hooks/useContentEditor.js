import { useState, useCallback } from 'react';
import { useEditMode } from '../context/EditModeContext';
import { usePortfolio } from '../context/PortfolioContext';
import { portfolioApi } from '../services/portfolioApi';

/**
 * useContentEditor Hook
 * Custom hook to manage content editing state and operations
 * Provides unified interface for editing content across different entity types
 * 
 * @param {string} entityType - Type of entity ('project', 'experience', 'section')
 * @returns {Object} - Editor state and methods
 */
export const useContentEditor = (entityType) => {
  const [editingItem, setEditingItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const { authToken, isEditMode, showNotification, activeEditor, setActiveEditor } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  
  /**
   * Start editing an item
   */
  const startEditing = useCallback((item) => {
    if (!isEditMode) {
      console.warn('Cannot edit: not in edit mode');
      return;
    }
    
    // Check if another editor is already active
    const editorId = `${entityType}-modal-${item.id}`;
    if (activeEditor && activeEditor !== editorId) {
      showNotification(
        'Editor Active',
        'Please save or cancel the current editor before opening another one.',
        'warning'
      );
      return;
    }
    
    setEditingItem(item);
    setIsModalOpen(true);
    setActiveEditor(editorId); // Lock this editor as active
    setError(null);
  }, [isEditMode, entityType, activeEditor, setActiveEditor, showNotification]);
  
  /**
   * Stop editing and close modal
   */
  const stopEditing = useCallback(() => {
    setEditingItem(null);
    setIsModalOpen(false);
    setActiveEditor(null); // Clear active editor lock
    setError(null);
  }, [setActiveEditor]);
  
  /**
   * Update text content for an entity
   */
  const updateText = useCallback(async (textId, updates) => {
    if (!authToken) {
      throw new Error('Not authenticated');
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      let response;
      
      switch (entityType) {
        case 'project':
          response = await portfolioApi.updateProjectText(textId, updates, authToken);
          break;
        case 'experience':
          response = await portfolioApi.updateExperienceText(textId, updates, authToken);
          break;
        case 'section':
          response = await portfolioApi.updateSectionText(textId, updates, authToken);
          break;
        default:
          throw new Error(`Unknown entity type: ${entityType}`);
      }
      
      await refreshPortfolio();
      
      showNotification(
        'Content Updated',
        'Your changes have been saved successfully',
        'success'
      );
      
      return response;
    } catch (err) {
      console.error('Failed to update text:', err);
      const errorMessage = err.message || 'Failed to update content';
      setError(errorMessage);
      
      showNotification(
        'Update Failed',
        errorMessage,
        'error'
      );
      
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [entityType, authToken, refreshPortfolio, showNotification]);
  
  /**
   * Update project metadata (only for projects)
   */
  const updateMetadata = useCallback(async (projectId, metadata) => {
    if (entityType !== 'project') {
      throw new Error('Metadata updates only supported for projects');
    }
    
    if (!authToken) {
      throw new Error('Not authenticated');
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await portfolioApi.updateProjectMetadata(
        projectId,
        metadata,
        authToken
      );
      
      await refreshPortfolio();
      
      showNotification(
        'Metadata Updated',
        'Project metadata has been updated successfully',
        'success'
      );
      
      return response;
    } catch (err) {
      console.error('Failed to update metadata:', err);
      const errorMessage = err.message || 'Failed to update metadata';
      setError(errorMessage);
      
      showNotification(
        'Update Failed',
        errorMessage,
        'error'
      );
      
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [entityType, authToken, refreshPortfolio, showNotification]);
  
  /**
   * Upload image for an entity
   */
  const uploadImage = useCallback(async (file, entityId, category) => {
    if (!authToken) {
      throw new Error('Not authenticated');
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await portfolioApi.uploadImage(
        file,
        entityType,
        entityId,
        category,
        authToken
      );
      
      await refreshPortfolio();
      
      showNotification(
        'Image Uploaded',
        'Your image has been uploaded successfully',
        'success'
      );
      
      return response;
    } catch (err) {
      console.error('Failed to upload image:', err);
      const errorMessage = err.message || 'Failed to upload image';
      setError(errorMessage);
      
      showNotification(
        'Upload Failed',
        errorMessage,
        'error'
      );
      
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [entityType, authToken, refreshPortfolio, showNotification]);
  
  /**
   * Reorder content items
   */
  const reorderItems = useCallback(async (entityIds, portfolioId) => {
    if (!authToken) {
      throw new Error('Not authenticated');
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await portfolioApi.reorderContent(
        entityType,
        entityIds,
        portfolioId,
        authToken
      );
      
      await refreshPortfolio();
      
      showNotification(
        'Order Updated',
        'Content order has been updated successfully',
        'success'
      );
      
      return response;
    } catch (err) {
      console.error('Failed to reorder items:', err);
      const errorMessage = err.message || 'Failed to reorder content';
      setError(errorMessage);
      
      showNotification(
        'Reorder Failed',
        errorMessage,
        'error'
      );
      
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [entityType, authToken, refreshPortfolio, showNotification]);
  
  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return {
    // State
    editingItem,
    isModalOpen,
    isSaving,
    error,
    isEditMode,
    
    // Actions
    startEditing,
    stopEditing,
    updateText,
    updateMetadata,
    uploadImage,
    reorderItems,
    clearError,
  };
};

export default useContentEditor;
