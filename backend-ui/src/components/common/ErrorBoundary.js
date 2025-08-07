import React, { Component } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

/**
 * ErrorBoundary component
 * Catches JavaScript errors in child component tree and displays fallback UI
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to a service here
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI
      const { fallback: FallbackComponent } = this.props;
      
      if (FallbackComponent) {
        return <FallbackComponent error={this.state.error} retry={this.handleRetry} />;
      }

      // Default error UI
      return (
        <Box sx={{ 
          p: 4, 
          textAlign: 'center',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Alert 
            severity="error" 
            variant="outlined"
            sx={{ 
              mb: 3,
              maxWidth: '600px',
              width: '100%'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              An unexpected error occurred while loading this component. 
              Please try again or contact support if the problem persists.
            </Typography>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Typography 
                variant="body2" 
                component="pre" 
                sx={{ 
                  fontSize: '0.75rem',
                  mt: 2,
                  p: 1,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 1,
                  overflow: 'auto',
                  maxHeight: '200px',
                  textAlign: 'left'
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </Typography>
            )}
          </Alert>
          
          <Button
            variant="outlined"
            onClick={this.handleRetry}
            startIcon={<RefreshIcon />}
            sx={{
              textTransform: 'none',
              borderRadius: '4px'
            }}
          >
            Try Again
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 