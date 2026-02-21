import React, { useState, useContext } from 'react';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { LanguageContext } from '../../context/LanguageContext';

/**
 * Edit Mode Indicator Component
 * Collapsible indicator shown when in edit mode (triggered from backend)
 * Shows Save and Exit buttons, current language, and user info
 */
export const EditModeIndicator = () => {
  const {
    isEditMode,
    exitEditMode,
    user,
    showNotification,
  } = useEditMode();
  
  const { refreshPortfolio } = usePortfolio();
  const { language } = useContext(LanguageContext);
  const [isSaving, setIsSaving] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

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

  // Language display names
  const languageNames = {
    'en': 'English',
    'es': 'Español'
  };

  return (
    <>
      {/* Minimized version - just a small tab */}
      {isMinimized ? (
        <div className="fixed top-24 right-4 z-[70] md:top-28">
          <button
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg p-3 border-2 border-blue-700 transition-all"
            title="Expand edit mode controls"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      ) : (
        /* Full version - all controls visible */
        <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 bg-blue-600 rounded-lg shadow-lg p-3 border-2 border-blue-700 min-w-[300px]">
          {/* Header with minimize button */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm text-white font-medium">
                Edit Mode Active
              </span>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 hover:bg-blue-700 rounded transition-colors"
              title="Minimize"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          </div>

          {/* Info section */}
          <div className="flex flex-col gap-1 text-xs text-blue-100 bg-blue-700 rounded p-2">
            {user?.email && (
              <div className="flex items-center gap-2">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span>{user.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.49 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">Editing: {languageNames[language] || language.toUpperCase()}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed font-medium shadow-sm text-sm"
              title="Save changes"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
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

            <button
              onClick={handleExit}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed font-medium shadow-sm text-sm"
              title="Exit edit mode"
            >
              Exit
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default EditModeIndicator;
