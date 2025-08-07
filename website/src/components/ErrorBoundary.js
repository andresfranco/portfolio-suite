import React from 'react';
import { FaTriangleExclamation } from 'react-icons/fa6';  // Changed from FaExclamationTriangle

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="text-center">
            <FaTriangleExclamation className="text-6xl text-[#14C800] mb-4 mx-auto" />
            <h1 className="text-2xl font-bold text-white mb-4">Something went wrong</h1>
            <p className="text-gray-300 mb-6">We apologize for the inconvenience.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#14C800] text-white px-6 py-3 rounded-lg transition-all duration-300 hover:bg-[#14C800]/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
