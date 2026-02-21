import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar
} from '@mui/material';
import {
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  QrCode as QrCodeIcon,
  Refresh as RefreshIcon,
  VpnKey as VpnKeyIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import mfaApi from '../../services/mfaApi';
import MfaEnrollmentDialog from './MfaEnrollmentDialog';
import MfaBackupCodesDialog from './MfaBackupCodesDialog';
import { logError, logInfo } from '../../utils/logger';

/**
 * MfaManagement Component
 * Manages MFA configuration for a user (admin view)
 * 
 * @param {Object} props
 * @param {Object} props.user - User object with id, username, etc.
 * @param {Function} props.onMfaChange - Callback when MFA status changes
 */
const MfaManagement = ({ user, onMfaChange }) => {
  const [mfaStatus, setMfaStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
  const [backupCodesDialogOpen, setBackupCodesDialogOpen] = useState(false);
  const [backupCodesToShow, setBackupCodesToShow] = useState([]);
  
  // Disable MFA dialog states
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableError, setDisableError] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  
  // Regenerate backup codes dialog states
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState('');
  const [regenerateMfaCode, setRegenerateMfaCode] = useState('');
  const [regenerateError, setRegenerateError] = useState('');
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  
  // Reset device dialog states
  const [resetDeviceDialogOpen, setResetDeviceDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetData, setResetData] = useState(null);
  
  // Success snackbar
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch MFA status when component mounts or user changes
  useEffect(() => {
    if (user?.id) {
      fetchMfaStatus();
    }
  }, [user?.id]);

  const fetchMfaStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await mfaApi.getMfaStatus(user.id);
      setMfaStatus(response.data);
      logInfo('MFA status fetched:', response.data);
    } catch (err) {
      logError('Error fetching MFA status:', err);
      setError('Failed to load MFA status');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableClick = () => {
    setEnrollmentDialogOpen(true);
  };

  const handleDisableClick = () => {
    setDisableDialogOpen(true);
    setDisablePassword('');
    setDisableError('');
  };

  const handleDisableConfirm = async () => {
    if (!disablePassword.trim()) {
      setDisableError('Please enter your admin password');
      return;
    }

    try {
      setDisableLoading(true);
      setDisableError('');
      await mfaApi.disableMfa(user.id, disablePassword);
      await fetchMfaStatus();
      if (onMfaChange) onMfaChange();
      
      // Close dialog and show success
      setDisableDialogOpen(false);
      setDisablePassword('');
      setSuccessMessage('MFA has been disabled successfully');
      setShowSuccess(true);
    } catch (err) {
      logError('Error disabling MFA:', err);
      setDisableError(err.response?.data?.detail || 'Failed to disable MFA. Please check your password.');
    } finally {
      setDisableLoading(false);
    }
  };

  const handleDisableCancel = () => {
    setDisableDialogOpen(false);
    setDisablePassword('');
    setDisableError('');
  };

  const handleRegenerateBackupCodesClick = () => {
    setRegenerateDialogOpen(true);
    setRegeneratePassword('');
    setRegenerateMfaCode('');
    setRegenerateError('');
  };

  const handleRegenerateConfirm = async () => {
    if (!regeneratePassword.trim()) {
      setRegenerateError('Please enter your admin password');
      return;
    }

    try {
      setRegenerateLoading(true);
      setRegenerateError('');
      // Pass MFA code only if provided (backend will check if admin needs MFA)
      const response = await mfaApi.regenerateBackupCodes(
        user.id, 
        regeneratePassword, 
        regenerateMfaCode.trim() || null
      );
      setBackupCodesToShow(response.data.backup_codes);
      setBackupCodesDialogOpen(true);
      await fetchMfaStatus();
      if (onMfaChange) onMfaChange();
      
      // Close regenerate dialog
      setRegenerateDialogOpen(false);
      setRegeneratePassword('');
      setRegenerateMfaCode('');
    } catch (err) {
      logError('Error regenerating backup codes:', err);
      setRegenerateError(err.response?.data?.detail || 'Failed to regenerate backup codes. Please check your credentials.');
    } finally {
      setRegenerateLoading(false);
    }
  };

  const handleRegenerateCancel = () => {
    setRegenerateDialogOpen(false);
    setRegeneratePassword('');
    setRegenerateMfaCode('');
    setRegenerateError('');
  };

  const handleResetDeviceClick = () => {
    setResetDeviceDialogOpen(true);
    setResetPassword('');
    setResetError('');
    setResetData(null);
  };

  const handleResetDeviceConfirm = async () => {
    if (!resetPassword.trim()) {
      setResetError('Please enter your admin password');
      return;
    }

    try {
      setResetLoading(true);
      setResetError('');
      const response = await mfaApi.resetDevice(user.id, resetPassword);
      setResetData(response.data);
      await fetchMfaStatus();
      if (onMfaChange) onMfaChange();
      
      // Don't close dialog yet - show QR code and backup codes
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

  const handleEnrollmentComplete = async (backupCodes) => {
    setEnrollmentDialogOpen(false);
    setBackupCodesToShow(backupCodes);
    setBackupCodesDialogOpen(true);
    await fetchMfaStatus();
    if (onMfaChange) onMfaChange();
  };

  if (loading && !mfaStatus) {
    return (
      <Paper sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  return (
    <Box>
      <Paper 
        elevation={0}
        sx={{ 
          p: 2.5, 
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '6px'
        }}
      >
        <Stack spacing={2}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon color="primary" />
              <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 500 }}>
                Multi-Factor Authentication (MFA)
              </Typography>
            </Box>
            {mfaStatus?.mfa_enabled ? (
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

          <Divider />

          {/* Error Display */}
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Status Information */}
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {mfaStatus?.mfa_enabled 
                ? 'This user has two-factor authentication enabled for enhanced account security.'
                : 'Enable two-factor authentication to add an extra layer of security to this user account.'}
            </Typography>

            {mfaStatus?.mfa_enabled && mfaStatus?.mfa_enrolled_at && (
              <Typography variant="caption" color="text.secondary">
                Enrolled: {new Date(mfaStatus.mfa_enrolled_at).toLocaleDateString()}
              </Typography>
            )}
          </Box>

          {/* Action Buttons */}
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {mfaStatus?.mfa_enabled ? (
              <>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  onClick={handleResetDeviceClick}
                  disabled={loading}
                  startIcon={<QrCodeIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  Reset Device
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleRegenerateBackupCodesClick}
                  disabled={loading}
                  startIcon={<RefreshIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  Regenerate Backup Codes
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={handleDisableClick}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <CancelIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  Disable MFA
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handleEnableClick}
                disabled={loading}
                startIcon={<QrCodeIcon />}
                sx={{ textTransform: 'none' }}
              >
                Enable MFA
              </Button>
            )}
            
            <Tooltip title="Refresh status">
              <IconButton size="small" onClick={fetchMfaStatus} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Additional Info */}
          {mfaStatus?.mfa_enabled && (
            <Alert severity="info" icon={<VpnKeyIcon />}>
              <Typography variant="caption">
                User will need their authenticator app and backup codes to sign in.
                Make sure they have saved their backup codes securely.
              </Typography>
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Enrollment Dialog */}
      {enrollmentDialogOpen && (
        <MfaEnrollmentDialog
          open={enrollmentDialogOpen}
          onClose={() => setEnrollmentDialogOpen(false)}
          user={user}
          onComplete={handleEnrollmentComplete}
        />
      )}

      {/* Backup Codes Dialog */}
      {backupCodesDialogOpen && (
        <MfaBackupCodesDialog
          open={backupCodesDialogOpen}
          onClose={() => {
            setBackupCodesDialogOpen(false);
            setBackupCodesToShow([]);
          }}
          backupCodes={backupCodesToShow}
          username={user.username}
        />
      )}

      {/* Disable MFA Confirmation Dialog */}
      <Dialog
        open={disableDialogOpen}
        onClose={handleDisableCancel}
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
          <WarningIcon color="warning" sx={{ fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.125rem' }}>
            Disable MFA for {user.username}?
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ px: 3, pt: 2, pb: 1 }}>
          <Alert severity="warning" sx={{ mb: 2.5 }}>
            This will remove two-factor authentication protection from this user account. 
            They will only need their password to log in.
          </Alert>

          {disableError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDisableError('')}>
              {disableError}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter your admin password to confirm this action:
          </Typography>

          <TextField
            fullWidth
            type="password"
            label="Your Admin Password"
            value={disablePassword}
            onChange={(e) => {
              setDisablePassword(e.target.value);
              setDisableError('');
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleDisableConfirm()}
            disabled={disableLoading}
            autoFocus
            size="medium"
            sx={{ mb: 1 }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5 }}>
          <Button
            onClick={handleDisableCancel}
            disabled={disableLoading}
            sx={{ textTransform: 'none', color: '#757575' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDisableConfirm}
            variant="contained"
            color="error"
            disabled={disableLoading}
            startIcon={disableLoading ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
            sx={{ textTransform: 'none', minWidth: 120 }}
          >
            {disableLoading ? 'Disabling...' : 'Disable MFA'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Regenerate Backup Codes Confirmation Dialog */}
      <Dialog
        open={regenerateDialogOpen}
        onClose={handleRegenerateCancel}
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
          <RefreshIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.125rem' }}>
            Regenerate Backup Codes
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ px: 3, pt: 2, pb: 1 }}>
          <Alert severity="warning" sx={{ mb: 2.5 }}>
            This will invalidate all existing backup codes for {user.username}. 
            New backup codes will be generated and must be saved.
          </Alert>

          {regenerateError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRegenerateError('')}>
              {regenerateError}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter your admin credentials to confirm this action:
          </Typography>

          <TextField
            fullWidth
            type="password"
            label="Your Admin Password"
            value={regeneratePassword}
            onChange={(e) => {
              setRegeneratePassword(e.target.value);
              setRegenerateError('');
            }}
            disabled={regenerateLoading}
            autoFocus
            size="medium"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Your MFA Code (Optional)"
            value={regenerateMfaCode}
            onChange={(e) => {
              setRegenerateMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              setRegenerateError('');
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleRegenerateConfirm()}
            disabled={regenerateLoading}
            placeholder="000000"
            helperText="Only required if your admin account has MFA enabled"
            inputProps={{
              maxLength: 6,
              style: { 
                textAlign: 'center', 
                fontSize: '18px',
                letterSpacing: '6px',
                fontFamily: 'monospace'
              }
            }}
            sx={{ mb: 1 }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5 }}>
          <Button
            onClick={handleRegenerateCancel}
            disabled={regenerateLoading}
            sx={{ textTransform: 'none', color: '#757575' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRegenerateConfirm}
            variant="contained"
            color="primary"
            disabled={regenerateLoading}
            startIcon={regenerateLoading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            sx={{ textTransform: 'none', minWidth: 140 }}
          >
            {regenerateLoading ? 'Regenerating...' : 'Regenerate Codes'}
          </Button>
        </DialogActions>
      </Dialog>

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
                This will generate a new QR code and backup codes for {user.username}. 
                The user will need to scan the new QR code with their authenticator app.
              </Alert>

              {resetError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setResetError('')}>
                  {resetError}
                </Alert>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter your admin password to confirm this action:
              </Typography>

              <TextField
                fullWidth
                type="password"
                label="Your Admin Password"
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

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={4000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowSuccess(false)} 
          severity="success" 
          sx={{ 
            width: '100%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            borderRadius: '6px'
          }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MfaManagement;

