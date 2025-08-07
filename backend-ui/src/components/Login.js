import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Container, Link, Stack, Alert, CircularProgress } from '@mui/material';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    if (validateForm()) {
      try {
        setIsLoading(true);
        await onLogin(username, password);
        navigate('/'); // Navigate to dashboard on successful login
      } catch (error) {
        // Display error message from the authService
        const errorMessage = error.response?.data?.detail || 
                             error.message || 
                             'Invalid username or password';
        
        setLoginError(errorMessage);
        
        // Always highlight both fields for auth errors
        setErrors(prev => ({
          ...prev,
          username: ' ',
          password: ' '
        }));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleChange = (field) => (e) => {
    if (field === 'username') {
      setUsername(e.target.value);
    } else if (field === 'password') {
      setPassword(e.target.value);
    }
    // Clear field-specific error when user types
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    // Clear login error when user makes any change
    if (loginError) {
      setLoginError('');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(45deg, #1976d2 30%, #dc004e 90%)'
      }}
    >
      <Container maxWidth="xs">
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            Login
          </Typography>
          <Box 
            component="form" 
            onSubmit={handleSubmit} 
            sx={{ mt: 2 }}
            autoComplete="off"
          >
            {loginError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {loginError}
              </Alert>
            )}
            <TextField
              fullWidth
              margin="normal"
              label="Username"
              variant="outlined"
              value={username}
              onChange={handleChange('username')}
              error={!!errors.username}
              helperText={errors.username && errors.username !== ' ' ? errors.username : ''}
              autoComplete="username"
              inputProps={{
                autoComplete: "username"
              }}
              disabled={isLoading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: errors.username === ' ' ? '#d32f2f' : undefined
                  }
                }
              }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Password"
              type="password"
              variant="outlined"
              value={password}
              onChange={handleChange('password')}
              error={!!errors.password}
              helperText={errors.password && errors.password !== ' ' ? errors.password : ''}
              autoComplete="current-password"
              inputProps={{
                autoComplete: "current-password"
              }}
              disabled={isLoading}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: errors.password === ' ' ? '#d32f2f' : undefined
                  }
                }
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={isLoading}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
            </Button>
            <Stack 
              direction="row" 
              justifyContent="space-between" 
              alignItems="center"
              spacing={1}
              sx={{ mt: 1 }}
            >
              <Link 
                component={RouterLink}
                to="/signup" 
                variant="body2" 
                sx={{ 
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Sign Up
              </Link>
              <Link 
                component={RouterLink}
                to="/forgot-password" 
                variant="body2"
                sx={{ 
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Forgot Password?
              </Link>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default Login;
