import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Alert,
  Tooltip,
  InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import KeyIcon from '@mui/icons-material/Key';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditIcon from '@mui/icons-material/Edit';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

/**
 * CredentialManager - UI for managing API credentials
 * 
 * Features:
 * - List all credentials
 * - Create new credentials
 * - Provider selection
 * - Secure API key input
 */
export default function CredentialManager({ credentials = [], onCreate, loading = false }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    provider: 'openai',
    api_key: '',
    base_url: ''
  });
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleOpen = () => {
    setFormData({ name: '', provider: 'openai', api_key: '', base_url: '' });
    setErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.api_key?.trim()) {
      newErrors.api_key = 'API Key is required';
    }
    
    if (formData.provider === 'custom' && !formData.base_url?.trim()) {
      newErrors.base_url = 'Base URL is required for custom providers';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    
    const payload = {
      name: formData.name,
      provider: formData.provider,
      api_key: formData.api_key,
      extra: formData.base_url ? { base_url: formData.base_url } : null
    };
    
    await onCreate(payload);
    setDialogOpen(false);
  };

  const getProviderColor = (provider) => {
    const colors = {
      openai: 'success',
      anthropic: 'warning',
      google: 'info',
      mistral: 'secondary',
      custom: 'default'
    };
    return colors[provider?.toLowerCase()] || 'default';
  };

  const handleViewCredential = (credential) => {
    setSelectedCredential(credential);
    setShowApiKey(false);
    setViewDialogOpen(true);
  };

  const maskApiKey = (key) => {
    if (!key) return '••••••••••••••••';
    if (key.length <= 8) return '••••••••';
    return `${key.substring(0, 4)}••••••••${key.substring(key.length - 4)}`;
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          <KeyIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          API Credentials
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpen}
          size="small"
        >
          Add Credential
        </Button>
      </Box>

      {/* Credentials Table */}
      {credentials.length === 0 ? (
        <Alert severity="info">
          No credentials configured yet. Create your first credential to get started!
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Provider</strong></TableCell>
                <TableCell><strong>API Key</strong></TableCell>
                <TableCell><strong>Created</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {credentials.map((cred) => (
                <TableRow key={cred.id} hover>
                  <TableCell>{cred.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={cred.provider.toUpperCase()}
                      size="small"
                      color={getProviderColor(cred.provider)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {maskApiKey(cred.api_key_encrypted)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {cred.created_at ? new Date(cred.created_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => handleViewCredential(cred)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* View Credential Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Credential Details</DialogTitle>
        <DialogContent dividers>
          {selectedCredential && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Name"
                  value={selectedCredential.name}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Provider"
                  value={selectedCredential.provider.toUpperCase()}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="API Key"
                  type={showApiKey ? 'text' : 'password'}
                  value={showApiKey ? (selectedCredential.api_key || '(Encrypted - cannot view)') : maskApiKey(selectedCredential.api_key)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowApiKey(!showApiKey)}
                          edge="end"
                        >
                          {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  For security reasons, API keys are encrypted and cannot be retrieved after creation.
                </Typography>
              </Grid>
              {selectedCredential.extra?.base_url && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Base URL"
                    value={selectedCredential.extra.base_url}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Created"
                  value={selectedCredential.created_at ? new Date(selectedCredential.created_at).toLocaleString() : '—'}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Credential</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Credential Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={Boolean(errors.name)}
                helperText={errors.name || 'A unique name for this credential'}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Provider"
                value={formData.provider}
                onChange={(e) => handleChange('provider', e.target.value)}
                required
              >
                {PROVIDERS.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API Key"
                type="password"
                value={formData.api_key}
                onChange={(e) => handleChange('api_key', e.target.value)}
                error={Boolean(errors.api_key)}
                helperText={errors.api_key || 'Your API key will be securely encrypted'}
                required
              />
            </Grid>
            {formData.provider === 'custom' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Base URL"
                  value={formData.base_url}
                  onChange={(e) => handleChange('base_url', e.target.value)}
                  error={Boolean(errors.base_url)}
                  helperText={errors.base_url || 'e.g., https://api.example.com/v1'}
                  placeholder="https://api.example.com/v1"
                  required
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Credential'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
