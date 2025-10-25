import React, { useState } from 'react';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';

/**
 * Edit Mode Indicator Component
 * Minimal indicator shown when in edit mode (triggered from backend)
 * Only shows Save and Exit buttons - no login functionality
 */
export const EditModeIndicator = () => {
  const {
    isEditMode,
    exitEditMode,
    user,
    showNotification,
  } = useEditMode();
  
  const { refreshPortfolio } = usePortfolio();
  const [isSaving, setIsSaving] = useState(false);

  // Don't show anything if not in edit mode
  if (!isEditMode) {
    return null;
  }

  /**
   * Handle save changes - refreshes portfolio data from API
   */
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await refreshPortfolio();
      showNotification(
        'Changes Saved',
        'Your changes have been saved successfully.',
        'success'
      );
    } catch (error) {
      console.error('Save failed:', error);
      showNotification(
        'Save Failed',
        'Failed to save changes. Please try again or contact support if the issue persists.',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle exit - exits edit mode (confirmation handled by user awareness)
   */
  const handleExit = () => {
    showNotification(
      'Exiting Edit Mode',
      'You are exiting edit mode. Make sure you have saved all your changes.',
      'warning'
    );
    // Give user time to read the notification before redirect
    setTimeout(() => {
      exitEditMode();
    }, 2000);
  };

  return (
    <div className="fixed top-4 right-4 z-[70] flex items-center gap-2 bg-blue-600 rounded-lg shadow-lg p-2 border-2 border-blue-700">
      {/* Edit mode active indicator */}
      <div className="flex items-center gap-2 px-3 py-1 bg-blue-700 rounded">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        <span className="text-sm text-white font-medium">
          Edit Mode Active
        </span>
      </div>

      {/* User info */}
      {user?.email && (
        <span className="text-xs text-blue-100 px-2">
          {user.email}
        </span>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed font-medium shadow-sm"
        title="Save changes"
      >
        {isSaving ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Saving...
          </span>
        ) : (
          'Save'
        )}
      </button>

      {/* Exit button */}
      <button
        onClick={handleExit}
        disabled={isSaving}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed font-medium shadow-sm"
        title="Exit edit mode"
      >
        Exit
      </button>
    </div>
  );
};

export default EditModeIndicator;
