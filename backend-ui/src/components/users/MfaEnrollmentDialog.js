import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  alpha
} from '@mui/material';
import {
  Close as CloseIcon,
  Check as CheckIcon,
  QrCode2 as QrCodeIcon
} from '@mui/icons-material';
import mfaApi from '../../services/mfaApi';
import { logError, logInfo } from '../../utils/logger';

/**
 * MfaEnrollmentDialog Component
 * Handles the MFA enrollment process with QR code display and verification
 * 
 * @param {Object} props
 * @param {boolean} props.open - Dialog open state
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.user - User object
 * @param {Function} props.onComplete - Called when enrollment is complete with backup codes
 */
const MfaEnrollmentDialog = ({ open, onClose, user, onComplete }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);

  const steps = [
    {
      label: 'Verify Admin Password',
      description: 'Enter your admin password to proceed with MFA enrollment'
    },
    {
      label: 'Scan QR Code',
      description: 'Scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.)'
    },
    {
      label: 'Verify Code',
      description: 'Enter the 6-digit code from the authenticator app to complete setup'
    }
  ];

  const handleStartEnrollment = async () => {
    if (!adminPassword.trim()) {
      setError('Please enter your admin password');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await mfaApi.startEnrollment(user.id, adminPassword);
      
      setQrCodeUrl(response.data.qr_code_url);
      setSecret(response.data.secret);
      setBackupCodes(response.data.backup_codes || []);
      setActiveStep(1);
      
      logInfo('MFA enrollment started successfully');
    } catch (err) {
      logError('Error starting MFA enrollment:', err);
      setError(err.response?.data?.detail || 'Failed to start MFA enrollment. Please check your password.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await mfaApi.verifyEnrollment(user.id, verificationCode);
      
      logInfo('MFA enrollment verified successfully');
      
      // Pass backup codes to parent (from enrollment response, not verification)
      if (onComplete) {
        onComplete(backupCodes);
      }
      
      onClose();
    } catch (err) {
      logError('Error verifying MFA code:', err);
      setError(err.response?.data?.detail || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (activeStep === 0) {
      handleStartEnrollment();
    } else if (activeStep === 1) {
      setActiveStep(2);
    } else if (activeStep === 2) {
      handleVerifyCode();
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setError('');
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '6px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
        }
      }}
    >
      <DialogTitle sx={{
        pb: 1.5,
        pt: 2.5,
        px: 2.5,
        fontWeight: 500,
        fontSize: '1.125rem',
        color: '#333333',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
      }}>
        Enable MFA for {user.username}
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {step.description}
                </Typography>

                {/* Step 0: Admin Password */}
                {index === 0 && (
                  <TextField
                    fullWidth
                    type="password"
                    label="Your Admin Password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleNext()}
                    disabled={loading}
                    size="small"
                    autoFocus
                    sx={{ mb: 2 }}
                  />
                )}

                {/* Step 1: QR Code */}
                {index === 1 && qrCodeUrl && (
                  <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Box
                      sx={{
                        display: 'inline-block',
                        p: 2,
                        bgcolor: 'white',
                        borderRadius: 1,
                        border: '1px solid #e0e0e0'
                      }}
                    >
                      <img
                        src={qrCodeUrl}
                        alt="MFA QR Code"
                        style={{ 
                          width: '200px', 
                          height: '200px',
                          display: 'block'
                        }}
                      />
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                      Or enter this key manually:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        mt: 0.5,
                        fontFamily: 'monospace',
                        bgcolor: alpha('#000', 0.05),
                        p: 1,
                        borderRadius: 1,
                        wordBreak: 'break-all'
                      }}
                    >
                      {secret}
                    </Typography>
                  </Box>
                )}

                {/* Step 2: Verification Code */}
                {index === 2 && (
                  <TextField
                    fullWidth
                    label="6-Digit Code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyPress={(e) => e.key === 'Enter' && handleNext()}
                    disabled={loading}
                    size="small"
                    autoFocus
                    placeholder="000000"
                    inputProps={{ 
                      maxLength: 6,
                      style: { 
                        textAlign: 'center', 
                        fontSize: '24px',
                        letterSpacing: '8px',
                        fontFamily: 'monospace'
                      }
                    }}
                    sx={{ mb: 2 }}
                  />
                )}

                {/* Step Navigation */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {index > 0 && (
                    <Button
                      size="small"
                      onClick={handleBack}
                      disabled={loading}
                      sx={{ textTransform: 'none' }}
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleNext}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : index === 2 ? <CheckIcon /> : null}
                    sx={{ textTransform: 'none' }}
                  >
                    {loading ? 'Processing...' : index === 2 ? 'Complete Setup' : 'Next'}
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          startIcon={<CloseIcon fontSize="small" />}
          sx={{
            textTransform: 'none',
            color: '#757575'
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MfaEnrollmentDialog;

