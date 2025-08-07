import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { logError } from '../../utils/logger';

class SkillErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error
    logError('SkillErrorBoundary', 'Component error caught:', { error, errorInfo });
    
    // Save error details in state
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleRetry = () => {
    // Reset the error state
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box 
          sx={{ 
            p: 4, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            backgroundColor: '#ffebee',
            borderRadius: '4px',
            border: '1px solid #ffcdd2'
          }}
        >
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3, 
              width: '100%',
              maxWidth: '600px'
            }}
          >
            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
              Something went wrong with Skills Management
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              An error occurred while loading the skills interface. This might be a temporary issue.
            </Typography>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  <strong>Error:</strong> {this.state.error.toString()}
                </Typography>
                {this.state.errorInfo && this.state.errorInfo.componentStack && (
                  <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mt: 1 }}>
                    <strong>Component Stack:</strong>
                    <pre style={{ fontSize: '0.7rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </Typography>
                )}
              </Box>
            )}
          </Alert>
          
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={this.handleRetry}
            sx={{
              borderRadius: '4px',
              textTransform: 'none',
              fontWeight: 400,
              py: 0.5,
              height: '36px',
              fontSize: '14px',
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              color: '#1976d2',
              border: '1px solid #1976d2',
              '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.04)',
                borderColor: '#1976d2'
              }
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

export default SkillErrorBoundary; 