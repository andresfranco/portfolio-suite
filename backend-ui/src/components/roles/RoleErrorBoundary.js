import React, { Component } from 'react';
import { Alert, AlertTitle, Button, Box } from '@mui/material';
import { logError } from '../../utils/logger'; // Assuming logger exists

class RoleErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    logError('Role Module ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Optionally, call a prop function to reset the parent component's state if needed
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">
            <AlertTitle>Something went wrong in the Roles section</AlertTitle>
            There was an error processing your request in the Roles module.
            {this.state.error && <p><strong>Error:</strong> {this.state.error.toString()}</p>}
            {/* Optionally show more details during development */} 
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details style={{ whiteSpace: 'pre-wrap' }}>
                <summary>Error Details</summary>
                {this.state.errorInfo.componentStack}
              </details>
            )}
            <Box sx={{ mt: 2 }}>
              <Button variant="outlined" color="error" onClick={this.handleReset}>
                Try Again
              </Button>
            </Box>
          </Alert>
        </Box>
      );
    }

    return this.props.children; 
  }
}

export default RoleErrorBoundary; 