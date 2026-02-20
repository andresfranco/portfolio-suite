import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Container, Link, Stack, Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Backdrop, LinearProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import authService from '../services/authService';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [mfaSuccess, setMfaSuccess] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
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
        const result = await onLogin(username, password);
        
        // Check if MFA is required
        if (result && result.mfa_required) {
          setMfaRequired(true);
          setSessionToken(result.session_token);
          setIsLoading(false);
          return;
        }
        
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

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setMfaError('');
    
    if (!mfaCode.trim()) {
      setMfaError('Please enter your MFA code');
      return;
    }
    
    try {
      setIsLoading(true);
      setMfaVerifying(true);
      
      await authService.verifyMfaLogin(sessionToken, mfaCode);
      
      // Show success state
      setMfaSuccess(true);
      
      // Start redirect process
      setTimeout(() => {
        setRedirecting(true);
        // Navigate after a brief moment
        setTimeout(() => {
          navigate('/');
        }, 500);
      }, 1200);
    } catch (error) {
      const errorMessage = error.message || 'Invalid MFA code';
      setMfaError(errorMessage);
      setMfaVerifying(false);
      setIsLoading(false);
    }
  };

  const handleMfaClose = () => {
    setMfaRequired(false);
    setMfaCode('');
    setMfaError('');
    setSessionToken('');
    setMfaVerifying(false);
    setMfaSuccess(false);
    setIsLoading(false);
    setRedirecting(false);
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

      {/* MFA Verification Dialog */}
      <Dialog
        open={mfaRequired}
        onClose={isLoading ? undefined : handleMfaClose}
        maxWidth="xs"
        fullWidth
        disableEscapeKeyDown={isLoading}
      >
        <DialogTitle>
          {mfaSuccess ? 'Verification Successful!' : 'Two-Factor Authentication Required'}
        </DialogTitle>
        
        {mfaVerifying && <LinearProgress />}
        
        <DialogContent>
          {mfaSuccess ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircleIcon 
                sx={{ 
                  fontSize: 64, 
                  color: 'success.main',
                  mb: 2
                }} 
              />
              <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
                Code verified successfully!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Redirecting to dashboard...
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Enter the 6-digit code from your authenticator app or use one of your backup codes.
              </Typography>
              
              {mfaError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {mfaError}
                </Alert>
              )}
              
              {mfaVerifying && (
                <Alert severity="info" sx={{ mb: 2 }} icon={<CircularProgress size={20} />}>
                  Verifying your code...
                </Alert>
              )}
              
              <TextField
                fullWidth
                label="MFA Code"
                value={mfaCode}
                onChange={(e) => {
                  setMfaCode(e.target.value);
                  setMfaError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleMfaSubmit(e)}
                disabled={isLoading}
                autoFocus
                placeholder="000000 or XXXX-XXXX"
                inputProps={{
                  maxLength: 9,
                  style: { 
                    textAlign: 'center', 
                    fontSize: '20px',
                    letterSpacing: '4px',
                    fontFamily: 'monospace'
                  }
                }}
              />
            </>
          )}
        </DialogContent>
        
        {!mfaSuccess && (
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleMfaClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleMfaSubmit}
              variant="contained"
              disabled={isLoading || !mfaCode.trim()}
            >
              {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Verify'}
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* Full-page loading overlay during redirect */}
      <Backdrop
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 2000,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          flexDirection: 'column',
          gap: 3
        }}
        open={redirecting}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CheckCircleIcon 
            sx={{ 
              fontSize: 80, 
              color: 'success.main',
              mb: 2,
              animation: 'pulse 1.5s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                '50%': { transform: 'scale(1.05)', opacity: 0.9 }
              }
            }} 
          />
          <Typography 
            variant="h5" 
            sx={{ 
              color: 'text.primary',
              fontWeight: 600,
              mb: 1
            }}
          >
            Logging you in...
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              mb: 3
            }}
          >
            Please wait while we redirect you to your dashboard
          </Typography>
          <CircularProgress size={48} sx={{ color: 'primary.main' }} />
        </Box>
      </Backdrop>
    </Box>
  );
}

export default Login;
