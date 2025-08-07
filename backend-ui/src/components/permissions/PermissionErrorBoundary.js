import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Typography, Box, Paper } from '@mui/material';
import { logError } from '../../utils/logger';
import { getErrorType, getErrorMessageByType, ERROR_TYPES } from '../../utils/errorUtils';

/**
 * Error boundary component specifically for Permission-related errors.
 * It catches errors in its child components tree and displays a fallback UI.
 */
class PermissionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorType: ERROR_TYPES.UNKNOWN
    };
  }

  static getDerivedStateFromError(error) {
    // Store the error and determine its type
    const errorType = getErrorType(error);
    return { 
      hasError: true, 
      error,
      errorType
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging
    const errorType = getErrorType(error);
    logError(`Permission component error (${errorType}):`, error, errorInfo);
    
    // Call onError prop if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null,
      errorType: ERROR_TYPES.UNKNOWN 
    });
    
    // Call onReset prop if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  }

  render() {
    if (this.state.hasError) {
      const { errorType, error } = this.state;
      const errorMessage = error?.message || 'An unknown error occurred';
      const enhancedMessage = getErrorMessageByType(errorType, errorMessage);
      
      // Get title and subtitle based on error type
      let title = 'Something went wrong';
      let subtitle = 'Please try again or contact support if the problem persists.';
      
      switch (errorType) {
        case ERROR_TYPES.VALIDATION:
          title = 'Invalid Data';
          subtitle = 'Please check your input and try again.';
          break;
        case ERROR_TYPES.PERMISSION:
          title = 'Permission Denied';
          subtitle = 'You don\'t have the necessary permissions for this action.';
          break;
        case ERROR_TYPES.NETWORK:
          title = 'Connection Problem';
          subtitle = 'Unable to connect to the server. Please check your internet connection.';
          break;
        case ERROR_TYPES.AUTHENTICATION:
          title = 'Authentication Error';
          subtitle = 'You may need to log in again to continue.';
          break;
        case ERROR_TYPES.CONFLICT:
          title = 'Conflict Error';
          subtitle = 'The operation couldn\'t be completed due to a conflict.';
          break;
        case ERROR_TYPES.NOT_FOUND:
          title = 'Not Found';
          subtitle = 'The requested resource could not be found.';
          break;
        case ERROR_TYPES.SERVER:
          title = 'Server Error';
          subtitle = 'The server encountered a problem. Please try again later.';
          break;
        default:
          // Use default values set above
      }
      
      return (
        <Paper 
          elevation={2} 
          sx={{ 
            p: 3, 
            maxWidth: '100%', 
            margin: '0 auto',
            borderLeft: '5px solid',
            borderColor: 'error.main' 
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Typography variant="h5" component="h2" color="error" gutterBottom>
              {title}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {subtitle}
            </Typography>
            <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
              {enhancedMessage}
            </Alert>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={this.handleReset}
            >
              Try Again
            </Button>
            {this.props.onHelp && (
              <Button 
                variant="outlined" 
                color="secondary" 
                onClick={this.props.onHelp}
              >
                Get Help
              </Button>
            )}
          </Box>
        </Paper>
      );
    }

    // When there's no error, render children normally
    return this.props.children;
  }
}

PermissionErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  onError: PropTypes.func,
  onReset: PropTypes.func,
  onHelp: PropTypes.func
};

export default PermissionErrorBoundary; 