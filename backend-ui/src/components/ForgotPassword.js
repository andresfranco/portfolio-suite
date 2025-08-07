import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Container, Link } from '@mui/material';

function ForgotPassword({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = (email) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    onSubmit(email);
    setSubmitted(true);
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
            Reset Password
          </Typography>
          {!submitted ? (
            <>
              <Typography variant="body1" align="center" sx={{ mb: 3 }}>
                Enter your email address and we'll send you instructions to reset your password.
              </Typography>
              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  margin="normal"
                  label="Email"
                  type="email"
                  variant="outlined"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  error={!!error}
                  helperText={error}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{ mt: 3, mb: 2 }}
                >
                  Send Reset Link
                </Button>
              </Box>
            </>
          ) : (
            <Typography variant="body1" align="center" sx={{ mb: 3 }}>
              If an account exists with this email, you will receive password reset instructions.
            </Typography>
          )}
          <Box textAlign="center">
            <Link
              component={RouterLink}
              to="/login"
              variant="body2"
              sx={{
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              Back to Login
            </Link>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default ForgotPassword;