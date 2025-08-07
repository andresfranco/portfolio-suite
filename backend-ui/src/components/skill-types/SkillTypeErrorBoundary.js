import React from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { logError } from '../../utils/logger';

class SkillTypeErrorBoundary extends React.Component {
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
    // Log the error for debugging purposes
    logError('SkillType Error Boundary caught an error:', error, errorInfo);
    
    // Update state with error info
    this.setState({
      error,
      errorInfo
    });
  }

  handleRetry = () => {
    // Reset the error boundary state
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            p: 4,
            backgroundColor: alpha('#ffebee', 0.3),
            borderRadius: '4px',
            border: '1px solid #ffcdd2',
            textAlign: 'center'
          }}
        >
          <ErrorOutlineIcon 
            sx={{ 
              fontSize: 64, 
              color: '#e53935', 
              mb: 2 
            }} 
          />
          
          <Typography 
            variant="h5" 
            component="h1" 
            sx={{ 
              color: '#e53935',
              fontWeight: 500,
              mb: 1,
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif'
            }}
          >
            Something went wrong
          </Typography>
          
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#666',
              mb: 2,
              maxWidth: '500px',
              lineHeight: 1.6,
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              fontSize: '14px'
            }}
          >
            An error occurred in the Skill Types module. This might be due to a temporary issue or a network problem.
          </Typography>

          {this.state.error && (
            <Alert 
              severity="error" 
              variant="outlined"
              sx={{ 
                mb: 3, 
                maxWidth: '600px',
                width: '100%',
                backgroundColor: alpha('#ffebee', 0.2),
                border: '1px solid #ffcdd2',
                '& .MuiAlert-icon': {
                  color: '#e53935'
                }
              }}
            >
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                  fontSize: '13px',
                  color: '#e53935'
                }}
              >
                <strong>Error Details:</strong> {this.state.error.message || 'Unknown error occurred'}
              </Typography>
            </Alert>
          )}

          <Button
            variant="outlined"
            startIcon={<RefreshIcon fontSize="small" />}
            onClick={this.handleRetry}
            sx={{
              borderRadius: '4px',
              textTransform: 'none',
              fontWeight: 400,
              fontSize: '14px',
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              px: 3,
              py: 1,
              color: '#1976d2',
              borderColor: '#1976d2',
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: alpha('#1976d2', 0.04),
                borderColor: '#1976d2',
                boxShadow: 'none'
              }
            }}
          >
            Try Again
          </Button>

          {/* Development-only error details */}
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <Box 
              sx={{ 
                mt: 3, 
                p: 2, 
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                border: '1px solid #e0e0e0',
                maxWidth: '800px',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'monospace',
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '200px'
              }}
            >
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 500, 
                  color: '#666',
                  display: 'block',
                  mb: 1
                }}
              >
                Development Error Details:
              </Typography>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '11px' }}>
                {this.state.error && this.state.error.stack}
                {this.state.errorInfo.componentStack}
              </pre>
            </Box>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

export default SkillTypeErrorBoundary; 