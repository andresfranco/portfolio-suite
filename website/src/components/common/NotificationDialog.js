import React from 'react';

/**
 * Notification Dialog Component
 * Elegant dialog for displaying success, error, warning, or info messages
 * Matches the website's dark theme aesthetic
 */
const NotificationDialog = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  type = 'info', // 'success', 'error', 'warning', 'info'
  confirmText = 'OK',
  cancelText = null,
  onConfirm = null 
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: '✓',
          iconBg: 'bg-green-500',
          borderColor: 'border-green-500',
          buttonBg: 'bg-green-600 hover:bg-green-700'
        };
      case 'error':
        return {
          icon: '✕',
          iconBg: 'bg-red-500',
          borderColor: 'border-red-500',
          buttonBg: 'bg-red-600 hover:bg-red-700'
        };
      case 'warning':
        return {
          icon: '⚠',
          iconBg: 'bg-yellow-500',
          borderColor: 'border-yellow-500',
          buttonBg: 'bg-yellow-600 hover:bg-yellow-700'
        };
      default:
        return {
          icon: 'ℹ',
          iconBg: 'bg-blue-500',
          borderColor: 'border-blue-500',
          buttonBg: 'bg-blue-600 hover:bg-blue-700'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4 border-2 animate-fadeIn"
        style={{ 
          borderColor: styles.borderColor.replace('border-', ''),
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Header with icon */}
        <div className="flex items-center gap-4 p-6 border-b border-gray-700">
          <div 
            className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center text-white text-2xl font-bold flex-shrink-0`}
          >
            {styles.icon}
          </div>
          <h2 className="text-xl font-bold text-white">
            {title}
          </h2>
        </div>

        {/* Message body */}
        <div className="p-6">
          <p className="text-gray-300 text-base leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer with buttons */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700 bg-gray-900/50">
          {cancelText && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-6 py-2 text-white rounded-lg transition-all font-medium ${styles.buttonBg} shadow-lg hover:shadow-xl transform hover:-translate-y-0.5`}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default NotificationDialog;
