import React, { Component } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

/**
 * UserErrorBoundary - Error boundary component specific to the User module
 * Catches and handles errors that occur in the user components
 */
class UserErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console or an error reporting service
    console.error('Error caught by UserErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      // Render error UI
      return (
        <Paper 
          sx={{ 
            padding: 3, 
            backgroundColor: '#ffebee', 
            borderRadius: 2,
            maxWidth: '100%',
            margin: '16px auto'
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <ErrorOutlineIcon color="error" sx={{ fontSize: 48 }} />
            
            <Typography variant="h5" component="h2" color="error">
              Something went wrong
            </Typography>
            
            <Typography variant="body1" align="center">
              There was an error loading the user management component
            </Typography>
            
            {this.state.error && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {this.state.error.toString()}
              </Typography>
            )}
            
            <Button 
              variant="contained" 
              color="primary" 
              onClick={this.handleReset}
              sx={{ mt: 2 }}
            >
              Try Again
            </Button>
          </Box>
        </Paper>
      );
    }

    // If no error, render children normally
    return this.props.children;
  }
}

export default UserErrorBoundary;