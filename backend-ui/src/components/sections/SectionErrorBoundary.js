import React, { Component } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console and potentially to an error reporting service
    console.error('SectionErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ 
          height: '100%', 
          width: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center',
          p: 3
        }}>
          <Alert 
            severity="error" 
            variant="outlined"
            sx={{ 
              p: 3,
              borderRadius: '4px',
              border: '1px solid #ffcdd2',
              backgroundColor: '#ffebee',
              mb: 3,
              maxWidth: '600px',
              width: '100%'
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 500,
                color: '#e53935',
                mb: 1
              }}
            >
              Something went wrong with the sections module
            </Typography>
            
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#e53935',
                mb: 2
              }}
            >
              An unexpected error occurred while loading the sections. This could be due to a 
              network issue, server problem, or a bug in the application.
            </Typography>
            
            {this.state.error && (
              <Box sx={{ 
                p: 2, 
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                mb: 2
              }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontFamily: 'monospace',
                    color: '#666',
                    display: 'block',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {this.state.error.toString()}
                </Typography>
              </Box>
            )}
            
            <Button 
              variant="outlined" 
              color="error"
              startIcon={<RefreshIcon />}
              onClick={() => this.setState({ hasError: false, error: null })}
              sx={{
                borderRadius: '4px',
                textTransform: 'none',
                fontWeight: 400
              }}
            >
              Try Again
            </Button>
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default SectionErrorBoundary; 