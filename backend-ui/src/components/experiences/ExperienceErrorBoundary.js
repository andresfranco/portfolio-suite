import React, { Component } from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import { Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';

class ExperienceErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for monitoring purposes
    console.error('ExperienceErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo,
      retryCount: this.state.retryCount + 1
    });

    // You can also log the error to an error reporting service here
    // Example: errorReportingService.log(error, errorInfo);
  }

  handleTryAgain = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  handleGoHome = () => {
    // Navigate to home or refresh the page
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, retryCount } = this.state;
      const maxRetries = 3;

      return (
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '400px',
            p: 3
          }}
        >
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              maxWidth: '600px', 
              width: '100%',
              textAlign: 'center',
              backgroundColor: '#ffebee',
              border: '1px solid #e57373'
            }}
          >
            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Something went wrong in the Experience module
              </Typography>
            </Alert>

            <Typography variant="body1" paragraph>
              An unexpected error occurred while displaying the experiences. 
              This could be due to a temporary issue or a problem with the data.
            </Typography>

            {retryCount < maxRetries ? (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Retry attempt: {retryCount} of {maxRetries}
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleTryAgain}
                  sx={{ mr: 2 }}
                >
                  Try Again
                </Button>
              </Box>
            ) : (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="error" gutterBottom>
                  Maximum retry attempts reached. Please refresh the page or contact support.
                </Typography>
              </Box>
            )}

            <Button
              variant="outlined"
              color="secondary"
              startIcon={<HomeIcon />}
              onClick={this.handleGoHome}
            >
              Go to Home
            </Button>

            {/* Show error details in development mode */}
            {process.env.NODE_ENV === 'development' && error && (
              <Box sx={{ mt: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Error Details (Development Mode):
                </Typography>
                <Typography variant="body2" component="pre" sx={{ 
                  textAlign: 'left', 
                  fontSize: '0.8rem',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {error.toString()}
                  {errorInfo && errorInfo.componentStack}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ExperienceErrorBoundary; 