import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Paper,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

/**
 * MfaBackupCodesDialog Component
 * Displays MFA backup codes with options to copy, download, or print
 * 
 * @param {Object} props
 * @param {boolean} props.open - Dialog open state
 * @param {Function} props.onClose - Close handler
 * @param {Array<string>} props.backupCodes - Array of backup codes
 * @param {string} props.username - Username for the codes
 */
const MfaBackupCodesDialog = ({ open, onClose, backupCodes = [], username }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const codesText = `MFA Backup Codes for ${username}\n` +
                     `Generated: ${new Date().toLocaleString()}\n` +
                     `\n` +
                     `IMPORTANT: Save these codes in a secure location.\n` +
                     `Each code can only be used once.\n` +
                     `\n` +
                     `Backup Codes:\n` +
                     `${backupCodes.join('\n')}`;
    
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mfa-backup-codes-${username}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=600,height=400');
    printWindow.document.write(`
      <html>
        <head>
          <title>MFA Backup Codes - ${username}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              font-size: 18px;
              margin-bottom: 10px;
            }
            .warning {
              background-color: #fff3cd;
              border: 1px solid #ffc107;
              padding: 10px;
              margin: 10px 0;
              border-radius: 4px;
            }
            .codes {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-top: 20px;
            }
            .code {
              font-family: monospace;
              font-size: 16px;
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <h1>MFA Backup Codes for ${username}</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <div class="warning">
            <strong>⚠️ IMPORTANT:</strong>
            <ul>
              <li>Save these codes in a secure location</li>
              <li>Each code can only be used once</li>
              <li>You will need these if you lose access to your authenticator app</li>
            </ul>
          </div>
          <div class="codes">
            ${backupCodes.map(code => `<div class="code">${code}</div>`).join('')}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        MFA Backup Codes
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, pt: 2 }}>
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ mb: 3 }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            Save these backup codes in a secure location!
          </Typography>
          <Typography variant="caption" display="block">
            • Each code can only be used once
          </Typography>
          <Typography variant="caption" display="block">
            • You'll need these if you lose access to your authenticator app
          </Typography>
          <Typography variant="caption" display="block">
            • These codes will not be shown again
          </Typography>
        </Alert>

        <Paper 
          elevation={0}
          sx={{ 
            p: 2, 
            bgcolor: '#f5f5f5',
            border: '1px solid #e0e0e0',
            borderRadius: 1
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
              Backup Codes for {username}
            </Typography>
            <Box>
              <Tooltip title={copied ? 'Copied!' : 'Copy all codes'}>
                <IconButton size="small" onClick={handleCopy}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download as text file">
                <IconButton size="small" onClick={handleDownload}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Print codes">
                <IconButton size="small" onClick={handlePrint}>
                  <PrintIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Grid container spacing={1.5}>
            {backupCodes.map((code, index) => (
              <Grid item xs={6} key={index}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: 'white',
                    border: '1px solid #ddd',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontWeight: 500,
                    letterSpacing: '2px',
                    borderRadius: 1
                  }}
                >
                  {code}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Generated: {new Date().toLocaleString()}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            textTransform: 'none'
          }}
        >
          I've Saved My Codes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MfaBackupCodesDialog;

