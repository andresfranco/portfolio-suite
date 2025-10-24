import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Snackbar
} from '@mui/material';
import {
  AccountCircle as AccountCircleIcon,
  VpnKey as VpnKeyIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  QrCode as QrCodeIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import userApi from '../services/userApi';
import mfaApi from '../services/mfaApi';
import { decodeJwt, isTokenExpired } from '../utils/jwt';
import { logError, logInfo } from '../utils/logger';

const MySettings = () => {
  // User info
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Password change states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // MFA states
  const [mfaStatus, setMfaStatus] = useState(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  
  // Reset MFA Device dialog states
  const [resetDeviceDialogOpen, setResetDeviceDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetData, setResetData] = useState(null);
  
  // Enable MFA dialog states
  const [enableMfaDialogOpen, setEnableMfaDialogOpen] = useState(false);
  const [enableMfaPassword, setEnableMfaPassword] = useState('');
  const [enableMfaError, setEnableMfaError] = useState('');
  const [enableMfaLoading, setEnableMfaLoading] = useState(false);
  const [enableMfaData, setEnableMfaData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  
  // Disable MFA dialog states
  const [disableMfaDialogOpen, setDisableMfaDialogOpen] = useState(false);
  const [disableMfaPassword, setDisableMfaPassword] = useState('');
  const [disableMfaError, setDisableMfaError] = useState('');
  const [disableMfaLoading, setDisableMfaLoading] = useState(false);
  
  useEffect(() => {
    // With httpOnly cookies, we can't decode the token
    // Fetch user info directly from the API
    fetchCurrentUser();
  }, []);
  
  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      // Get current user info (no special permission required)
      const response = await userApi.getCurrentUser();
      const currentUser = response.data;
      
      if (currentUser) {
        setUsername(currentUser.username); // Set username from API response
        setUserId(currentUser.id);
        
        // Fetch MFA status
        if (currentUser.id) {
          const mfaResponse = await mfaApi.getMfaStatus(currentUser.id);
          setMfaStatus(mfaResponse.data);
        }
      }
    } catch (err) {
      logError('Error fetching user data:', err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setSuccessMessage('');
    
    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    
    try {
      setPasswordLoading(true);
      const payload = {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      };
      
      await userApi.changeOwnPassword(payload);
      
      setSuccessMessage('Password changed successfully!');
      setShowSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        setSuccessMessage('');
        setShowSuccess(false);
      }, 5000);
    } catch (err) {
      logError('Error changing password:', err);
      setPasswordError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };
  
  const handleResetDeviceClick = () => {
    setResetDeviceDialogOpen(true);
    setResetPassword('');
    setResetError('');
    setResetData(null);
  };
  
  const handleResetDeviceConfirm = async () => {
    if (!resetPassword.trim()) {
      setResetError('Please enter your password');
      return;
    }
    
    try {
      setResetLoading(true);
      setResetError('');
      // Don't pass userId for current user (self-service)
      const response = await mfaApi.resetDevice(null, resetPassword);
      setResetData(response.data);
      
      // Refresh MFA status
      if (userId) {
        const mfaResponse = await mfaApi.getMfaStatus(userId);
        setMfaStatus(mfaResponse.data);
      }
    } catch (err) {
      logError('Error resetting MFA device:', err);
      setResetError(err.response?.data?.detail || 'Failed to reset MFA device. Please check your password.');
    } finally {
      setResetLoading(false);
    }
  };
  
  const handleResetDeviceClose = () => {
    setResetDeviceDialogOpen(false);
    setResetPassword('');
    setResetError('');
    setResetData(null);
  };
  
  const handleEnableMfaClick = () => {
    setEnableMfaDialogOpen(true);
    setEnableMfaPassword('');
    setEnableMfaError('');
    setEnableMfaData(null);
    setVerificationCode('');
  };
  
  const handleEnableMfaConfirm = async () => {
    if (!enableMfaPassword.trim()) {
      setEnableMfaError('Please enter your password');
      return;
    }
    
    try {
      setEnableMfaLoading(true);
      setEnableMfaError('');
      // Self-service enrollment (no userId parameter)
      const response = await mfaApi.enroll(enableMfaPassword);
      setEnableMfaData(response.data);
    } catch (err) {
      logError('Error enrolling in MFA:', err);
      setEnableMfaError(err.response?.data?.detail || 'Failed to start MFA enrollment. Please check your password.');
    } finally {
      setEnableMfaLoading(false);
    }
  };
  
  const handleVerifyEnrollment = async () => {
    if (!verificationCode.trim()) {
      setEnableMfaError('Please enter the verification code');
      return;
    }
    
    if (!enableMfaData?.secret) {
      setEnableMfaError('No enrollment data found');
      return;
    }
    
    try {
      setEnableMfaLoading(true);
      setEnableMfaError('');
      // Self-service verification
      await mfaApi.verifyEnrollmentSelf(enableMfaData.secret, verificationCode);
      
      // Refresh MFA status
      if (userId) {
        const mfaResponse = await mfaApi.getMfaStatus(userId);
        setMfaStatus(mfaResponse.data);
      }
      
      setSuccessMessage('MFA enabled successfully!');
      setShowSuccess(true);
      handleEnableMfaClose();
      
      setTimeout(() => {
        setSuccessMessage('');
        setShowSuccess(false);
      }, 5000);
    } catch (err) {
      logError('Error verifying MFA enrollment:', err);
      setEnableMfaError(err.response?.data?.detail || 'Invalid verification code. Please try again.');
    } finally {
      setEnableMfaLoading(false);
    }
  };
  
  const handleEnableMfaClose = () => {
    setEnableMfaDialogOpen(false);
    setEnableMfaPassword('');
    setEnableMfaError('');
    setEnableMfaData(null);
    setVerificationCode('');
  };
  
  const handleDisableMfaClick = () => {
    setDisableMfaDialogOpen(true);
    setDisableMfaPassword('');
    setDisableMfaError('');
  };
  
  const handleDisableMfaConfirm = async () => {
    if (!disableMfaPassword.trim()) {
      setDisableMfaError('Please enter your password');
      return;
    }
    
    try {
      setDisableMfaLoading(true);
      setDisableMfaError('');
      // Self-service disable (no userId parameter)
      await mfaApi.disable(disableMfaPassword);
      
      // Refresh MFA status
      if (userId) {
        const mfaResponse = await mfaApi.getMfaStatus(userId);
        setMfaStatus(mfaResponse.data);
      }
      
      setSuccessMessage('MFA disabled successfully');
      setShowSuccess(true);
      handleDisableMfaClose();
      
      setTimeout(() => {
        setSuccessMessage('');
        setShowSuccess(false);
      }, 5000);
    } catch (err) {
      logError('Error disabling MFA:', err);
      setDisableMfaError(err.response?.data?.detail || 'Failed to disable MFA. Please check your password.');
    } finally {
      setDisableMfaLoading(false);
    }
  };
  
  const handleDisableMfaClose = () => {
    setDisableMfaDialogOpen(false);
    setDisableMfaPassword('');
    setDisableMfaError('');
  };
  
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 500, mb: 1 }}>
          My Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your account settings and security
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}
      
      {/* Account Information */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '6px'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AccountCircleIcon color="primary" />
          <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 500 }}>
            Account Information
          </Typography>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Username
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {username}
            </Typography>
          </Box>
        </Stack>
      </Paper>
      
      {/* Change Password */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '6px'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <VpnKeyIcon color="primary" />
          <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 500 }}>
            Change Password
          </Typography>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        {passwordError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPasswordError('')}>
            {passwordError}
          </Alert>
        )}
        
        <form onSubmit={handlePasswordChange}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              type="password"
              label="Current Password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              disabled={passwordLoading}
              required
            />
            
            <TextField
              fullWidth
              type="password"
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordLoading}
              required
              helperText="Must be at least 8 characters"
            />
            
            <TextField
              fullWidth
              type="password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordLoading}
              required
            />
            
            <Box>
              <Button
                type="submit"
                variant="contained"
                disabled={passwordLoading}
                startIcon={passwordLoading ? <CircularProgress size={20} color="inherit" /> : <VpnKeyIcon />}
                sx={{ textTransform: 'none' }}
              >
                {passwordLoading ? 'Changing Password...' : 'Change Password'}
              </Button>
            </Box>
          </Stack>
        </form>
      </Paper>
      
      {/* MFA Security */}
      {mfaStatus && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '6px'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon color="primary" />
              <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 500 }}>
                Multi-Factor Authentication
              </Typography>
            </Box>
            {mfaStatus.mfa_enabled ? (
              <Chip
                icon={<CheckCircleIcon />}
                label="Enabled"
                color="success"
                size="small"
                sx={{ fontWeight: 500 }}
              />
            ) : (
              <Chip
                icon={<CancelIcon />}
                label="Disabled"
                color="default"
                size="small"
                sx={{ fontWeight: 500 }}
              />
            )}
          </Box>
          
          <Divider sx={{ mb: 2 }} />
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {mfaStatus.mfa_enabled
              ? 'Your account has two-factor authentication enabled for enhanced security.'
              : 'Two-factor authentication is not enabled. You can enable it to add an extra layer of security to your account.'}
          </Typography>
          
          {mfaStatus.mfa_enabled ? (
            <Stack spacing={2}>
              <Box>
                <Button
                  variant="outlined"
                  color="primary"
                  size="medium"
                  onClick={handleResetDeviceClick}
                  startIcon={<QrCodeIcon />}
                  sx={{ textTransform: 'none', mr: 2 }}
                >
                  Reset MFA Device
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="medium"
                  onClick={handleDisableMfaClick}
                  startIcon={<CancelIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  Disable MFA
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Reset device if you lost access to your authenticator app, or disable MFA completely
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Box>
              <Button
                variant="contained"
                color="primary"
                size="medium"
                onClick={handleEnableMfaClick}
                startIcon={<SecurityIcon />}
                sx={{ textTransform: 'none' }}
              >
                Enable MFA
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Protect your account with two-factor authentication
              </Typography>
            </Box>
          )}
        </Paper>
      )}
      
      {/* Reset MFA Device Dialog */}
      <Dialog
        open={resetDeviceDialogOpen}
        onClose={resetData ? handleResetDeviceClose : null}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 1,
          pt: 2.5,
          px: 3
        }}>
          <QrCodeIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.125rem' }}>
            Reset MFA Device
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ px: 3, pt: 2, pb: 2 }}>
          {!resetData ? (
            <>
              <Alert severity="info" sx={{ mb: 2.5 }}>
                This will generate a new QR code and backup codes for your account. 
                You will need to scan the new QR code with your authenticator app.
              </Alert>

              {resetError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setResetError('')}>
                  {resetError}
                </Alert>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter your password to confirm:
              </Typography>

              <TextField
                fullWidth
                type="password"
                label="Your Password"
                value={resetPassword}
                onChange={(e) => {
                  setResetPassword(e.target.value);
                  setResetError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleResetDeviceConfirm()}
                disabled={resetLoading}
                autoFocus
                size="medium"
              />
            </>
          ) : (
            <>
              <Alert severity="success" sx={{ mb: 2.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {resetData.message}
                </Typography>
              </Alert>

              {/* QR Code */}
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 500 }}>
                  Scan this QR code with your authenticator app:
                </Typography>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  p: 2,
                  border: '2px solid',
                  borderColor: 'divider',
                  borderRadius: '8px',
                  backgroundColor: 'background.paper'
                }}>
                  <img
                    src={resetData.qr_code_url}
                    alt="QR Code"
                    style={{ maxWidth: '200px', width: '100%' }}
                  />
                </Box>
              </Box>

              {/* Backup Codes */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 500 }}>
                  New Backup Codes:
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    backgroundColor: '#f5f5f5',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '6px'
                  }}
                >
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 1
                  }}>
                    {resetData.backup_codes.map((code, index) => (
                      <Box
                        key={index}
                        sx={{
                          p: 1,
                          backgroundColor: 'white',
                          borderRadius: '4px',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                      >
                        {code}
                      </Box>
                    ))}
                  </Box>
                </Paper>
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="caption">
                    Save these backup codes securely. They cannot be recovered if lost.
                  </Typography>
                </Alert>
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5 }}>
          {!resetData ? (
            <>
              <Button
                onClick={handleResetDeviceClose}
                disabled={resetLoading}
                sx={{ textTransform: 'none', color: '#757575' }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetDeviceConfirm}
                variant="contained"
                color="primary"
                disabled={resetLoading || !resetPassword.trim()}
                startIcon={resetLoading ? <CircularProgress size={16} color="inherit" /> : <QrCodeIcon />}
                sx={{ textTransform: 'none', minWidth: 120 }}
              >
                {resetLoading ? 'Resetting...' : 'Reset Device'}
              </Button>
            </>
          ) : (
            <Button
              onClick={handleResetDeviceClose}
              variant="contained"
              color="primary"
              sx={{ textTransform: 'none' }}
            >
              Done
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Enable MFA Dialog */}
      <Dialog
        open={enableMfaDialogOpen}
        onClose={enableMfaData ? handleEnableMfaClose : null}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 1,
          pt: 2.5,
          px: 3
        }}>
          <SecurityIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600 }}>
            Enable Multi-Factor Authentication
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ px: 3, pb: 2 }}>
          {!enableMfaData ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                To enable MFA, please confirm your password first.
              </Typography>
              
              {enableMfaError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEnableMfaError('')}>
                  {enableMfaError}
                </Alert>
              )}
              
              <TextField
                fullWidth
                type="password"
                label="Your Password"
                value={enableMfaPassword}
                onChange={(e) => setEnableMfaPassword(e.target.value)}
                disabled={enableMfaLoading}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleEnableMfaConfirm();
                  }
                }}
              />
            </>
          ) : (
            <>
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                  MFA Enrollment Started Successfully!
                </Typography>
                <Typography variant="caption">
                  Follow the steps below to complete setup.
                </Typography>
              </Alert>
              
              {enableMfaError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEnableMfaError('')}>
                  {enableMfaError}
                </Alert>
              )}
              
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                Step 1: Scan the QR Code
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Open your authenticator app (Google Authenticator, Authy, etc.) and scan this QR code:
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, p: 2, bgcolor: 'background.default', borderRadius: '8px' }}>
                <img 
                  src={enableMfaData.qr_code_url} 
                  alt="MFA QR Code"
                  style={{ maxWidth: '200px', height: 'auto' }}
                />
              </Box>
              
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                Step 2: Save Your Backup Codes
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Store these backup codes in a safe place. You can use them to access your account if you lose your device:
              </Typography>
              
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 3,
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '6px'
                }}
              >
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                  {enableMfaData.backup_codes?.map((code, index) => (
                    <Typography
                      key={index}
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        p: 1,
                        bgcolor: 'white',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      {code}
                    </Typography>
                  ))}
                </Box>
              </Paper>
              
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                Step 3: Verify Setup
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter the 6-digit code from your authenticator app to complete setup:
              </Typography>
              
              <TextField
                fullWidth
                label="Verification Code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={enableMfaLoading}
                placeholder="000000"
                inputProps={{
                  maxLength: 6,
                  style: { fontSize: '20px', letterSpacing: '8px', textAlign: 'center', fontFamily: 'monospace' }
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && verificationCode.length === 6) {
                    handleVerifyEnrollment();
                  }
                }}
              />
            </>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          {!enableMfaData ? (
            <>
              <Button
                onClick={handleEnableMfaClose}
                disabled={enableMfaLoading}
                sx={{ textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEnableMfaConfirm}
                variant="contained"
                disabled={enableMfaLoading || !enableMfaPassword.trim()}
                startIcon={enableMfaLoading ? <CircularProgress size={20} color="inherit" /> : null}
                sx={{ textTransform: 'none' }}
              >
                {enableMfaLoading ? 'Confirming...' : 'Continue'}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleEnableMfaClose}
                disabled={enableMfaLoading}
                sx={{ textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerifyEnrollment}
                variant="contained"
                disabled={enableMfaLoading || verificationCode.length !== 6}
                startIcon={enableMfaLoading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                sx={{ textTransform: 'none' }}
              >
                {enableMfaLoading ? 'Verifying...' : 'Complete Setup'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Disable MFA Dialog */}
      <Dialog
        open={disableMfaDialogOpen}
        onClose={disableMfaLoading ? null : handleDisableMfaClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 1,
          pt: 2.5,
          px: 3
        }}>
          <CancelIcon color="error" sx={{ fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600 }}>
            Disable Multi-Factor Authentication
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ px: 3, pb: 2 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Disabling MFA will make your account less secure. Are you sure you want to continue?
            </Typography>
          </Alert>
          
          {disableMfaError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDisableMfaError('')}>
              {disableMfaError}
            </Alert>
          )}
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please enter your password to confirm:
          </Typography>
          
          <TextField
            fullWidth
            type="password"
            label="Your Password"
            value={disableMfaPassword}
            onChange={(e) => setDisableMfaPassword(e.target.value)}
            disabled={disableMfaLoading}
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleDisableMfaConfirm();
              }
            }}
          />
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={handleDisableMfaClose}
            disabled={disableMfaLoading}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDisableMfaConfirm}
            variant="contained"
            color="error"
            disabled={disableMfaLoading || !disableMfaPassword.trim()}
            startIcon={disableMfaLoading ? <CircularProgress size={20} color="inherit" /> : <CancelIcon />}
            sx={{ textTransform: 'none' }}
          >
            {disableMfaLoading ? 'Disabling...' : 'Disable MFA'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Success Snackbar */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={5000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowSuccess(false)}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default MySettings;

