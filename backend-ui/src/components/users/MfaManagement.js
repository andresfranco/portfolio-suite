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
  Tooltip
} from '@mui/material';
import {
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  QrCode as QrCodeIcon,
  Refresh as RefreshIcon,
  VpnKey as VpnKeyIcon
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

  const handleDisableClick = async () => {
    if (!window.confirm(`Are you sure you want to disable MFA for ${user.username}? This will remove their two-factor authentication protection.`)) {
      return;
    }

    // In a real app, you'd want to prompt for admin password
    const password = window.prompt('Enter your admin password to confirm:');
    if (!password) return;

    try {
      setLoading(true);
      setError('');
      await mfaApi.disableMfa(user.id, password);
      await fetchMfaStatus();
      if (onMfaChange) onMfaChange();
      alert('MFA has been disabled successfully');
    } catch (err) {
      logError('Error disabling MFA:', err);
      setError(err.response?.data?.detail || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!window.confirm('Are you sure you want to regenerate backup codes? This will invalidate all existing backup codes.')) {
      return;
    }

    const password = window.prompt('Enter your admin password to confirm:');
    if (!password) return;

    try {
      setLoading(true);
      setError('');
      const response = await mfaApi.regenerateBackupCodes(user.id, password);
      setBackupCodesToShow(response.data.backup_codes);
      setBackupCodesDialogOpen(true);
      await fetchMfaStatus();
      if (onMfaChange) onMfaChange();
    } catch (err) {
      logError('Error regenerating backup codes:', err);
      setError(err.response?.data?.detail || 'Failed to regenerate backup codes');
    } finally {
      setLoading(false);
    }
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
          <Stack direction="row" spacing={1}>
            {mfaStatus?.mfa_enabled ? (
              <>
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
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleRegenerateBackupCodes}
                  disabled={loading}
                  startIcon={<RefreshIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  Regenerate Backup Codes
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
    </Box>
  );
};

export default MfaManagement;

