import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: 'calc(100vh - 120px)'
      }}
    >
      <Paper 
        elevation={3} 
        sx={{ 
          p: 5, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          maxWidth: 400
        }}
      >
        <Typography variant="h1" component="h1" sx={{ mb: 2, fontSize: '5rem' }}>
          404
        </Typography>
        <Typography variant="h5" component="h2" sx={{ mb: 3, textAlign: 'center' }}>
          Page Not Found
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, textAlign: 'center' }}>
          The page you are looking for doesn't exist or has been moved.
        </Typography>
        <Button 
          component={Link} 
          to="/" 
          variant="contained" 
          color="primary"
        >
          Back to Dashboard
        </Button>
      </Paper>
    </Box>
  );
};

export default NotFound; 