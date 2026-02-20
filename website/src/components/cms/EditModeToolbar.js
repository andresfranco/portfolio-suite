import React, { useState } from 'react';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';

/**
 * Edit Mode Toolbar Component
 * Displays at the top of the page when user is authenticated with editor permissions
 * Provides controls for toggling edit mode, saving changes, and logging out
 */
export const EditModeToolbar = () => {
  const {
    isEditMode,
    toggleEditMode,
    canEdit,
    user,
    logout,
    isAuthenticated,
  } = useEditMode();
  
  const { refreshPortfolio } = usePortfolio();
  const [isSaving, setIsSaving] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Don't show toolbar if user is not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <button
          onClick={() => setShowLoginModal(true)}
          className="fixed top-4 right-4 z-[70] px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
        >
          Editor Login
        </button>
        {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      </>
    );
  }

  // Don't show edit controls if user doesn't have permissions
  if (!canEdit) {
    return (
      <div className="fixed top-4 right-4 z-[70] flex items-center gap-2 bg-white rounded-lg shadow-lg p-2">
        <span className="px-4 py-2 text-gray-700">
          Logged in as {user?.email}
        </span>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Logout
        </button>
      </div>
    );
  }

  /**
   * Handle save changes - refreshes portfolio data from API
   */
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await refreshPortfolio();
      alert('Changes saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle cancel - refreshes portfolio and exits edit mode
   */
  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? Unsaved changes will be lost.')) {
      refreshPortfolio();
      toggleEditMode();
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[70] flex items-center gap-2 bg-white rounded-lg shadow-lg p-2 border-2 border-gray-200">
      {/* User info */}
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-sm text-gray-700 font-medium">
          {user?.email}
        </span>
      </div>

      {/* Edit mode toggle */}
      <button
        onClick={toggleEditMode}
        className={`px-4 py-2 rounded font-medium transition-all ${
          isEditMode
            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
        }`}
        title={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
      >
        {isEditMode ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse"></span>
            Edit Mode Active
          </span>
        ) : (
          'Edit Page'
        )}
      </button>

      {/* Edit mode actions */}
      {isEditMode && (
        <>
          <div className="w-px h-8 bg-gray-300"></div>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed font-medium"
            title="Refresh and save changes"
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
          
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            title="Cancel and discard changes"
          >
            Cancel
          </button>
        </>
      )}

      {/* Logout */}
      <div className="w-px h-8 bg-gray-300"></div>
      <button
        onClick={logout}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium"
        title="Logout"
      >
        Logout
      </button>
    </div>
  );
};

/**
 * Login Modal Component
 * Simple modal for editor authentication
 */
const LoginModal = ({ onClose }) => {
  const { login, error, clearError, isAuthenticating } = useEditMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    
    try {
      await login(email, password);
      onClose();
    } catch (err) {
      // Error is handled in context
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Editor Login</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="editor@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isAuthenticating}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed font-medium"
            >
              {isAuthenticating ? 'Logging in...' : 'Login'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          Only authorized editors can access the CMS
        </p>
      </div>
    </div>
  );
};

export default EditModeToolbar;
