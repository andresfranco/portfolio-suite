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
  InputAdornment,
  Card,
  CardContent,
  Stack,
  Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import KeyIcon from '@mui/icons-material/Key';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

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
 * - Edit existing credentials (name, provider, extra fields)
 * - Delete credentials (if not in use)
 * - Provider selection
 * - Secure API key input
 */
export default function CredentialManager({ credentials = [], onCreate, onUpdate, onDelete, loading = false }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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

  const handleOpenEdit = (credential) => {
    setSelectedCredential(credential);
    setFormData({
      name: credential.name,
      provider: credential.provider,
      api_key: '', // Cannot edit API key
      base_url: credential.extra?.base_url || ''
    });
    setErrors({});
    setEditDialogOpen(true);
  };

  const validate = (isEdit = false) => {
    const newErrors = {};
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    
    // API key only required for create, not edit
    if (!isEdit && !formData.api_key?.trim()) {
      newErrors.api_key = 'API Key is required';
    }
    
    if (formData.provider === 'custom' && !formData.base_url?.trim()) {
      newErrors.base_url = 'Base URL is required for custom providers';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate(false)) return;
    
    const payload = {
      name: formData.name,
      provider: formData.provider,
      api_key: formData.api_key,
      extra: formData.base_url ? { base_url: formData.base_url } : null
    };
    
    await onCreate(payload);
    setDialogOpen(false);
  };

  const handleUpdateSubmit = async () => {
    if (!validate(true)) return;
    
    const payload = {
      name: formData.name,
      provider: formData.provider,
      extra: formData.base_url ? { base_url: formData.base_url } : null
    };
    
    await onUpdate(selectedCredential.id, payload);
    setEditDialogOpen(false);
    setSelectedCredential(null);
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

  const handleDeleteCredential = async (credential) => {
    setSelectedCredential(credential);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await onDelete(selectedCredential.id);
      setDeleteDialogOpen(false);
      setSelectedCredential(null);
    } catch (error) {
      // Error handling is done in the parent component
      console.error('Error deleting credential:', error);
      // Keep dialog open so user can see the error from parent
    }
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <KeyIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            API Credentials
          </Typography>
          <Chip 
            label={credentials.length} 
            size="small" 
            color="primary" 
            variant="outlined"
          />
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpen}
          disabled={loading}
        >
          Add Credential
        </Button>
      </Stack>

      {/* Credentials Table */}
      {credentials.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
          <KeyIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No credentials configured yet
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Create your first credential to enable agent functionality
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpen}
          >
            Add Your First Credential
          </Button>
        </Paper>
      ) : (
        <TableContainer 
          component={Paper} 
          variant="outlined"
          sx={{ 
            borderRadius: 2,
            '& .MuiTableHead-root': {
              bgcolor: 'grey.50'
            }
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><Typography variant="subtitle2" fontWeight={600}>Name</Typography></TableCell>
                <TableCell><Typography variant="subtitle2" fontWeight={600}>Provider</Typography></TableCell>
                <TableCell><Typography variant="subtitle2" fontWeight={600}>API Key</Typography></TableCell>
                <TableCell><Typography variant="subtitle2" fontWeight={600}>Created</Typography></TableCell>
                <TableCell align="right"><Typography variant="subtitle2" fontWeight={600}>Actions</Typography></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {credentials.map((cred) => (
                <TableRow 
                  key={cred.id} 
                  hover
                  sx={{
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {cred.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={cred.provider.toUpperCase()}
                      size="small"
                      color={getProviderColor(cred.provider)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                      {maskApiKey(cred.api_key_encrypted)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {cred.created_at ? new Date(cred.created_at).toLocaleDateString() : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton 
                        size="small" 
                        onClick={() => handleViewCredential(cred)}
                        sx={{ 
                          '&:hover': { 
                            bgcolor: 'primary.lighter',
                            color: 'primary.main'
                          } 
                        }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Credential">
                      <IconButton 
                        size="small" 
                        onClick={() => handleOpenEdit(cred)}
                        sx={{ 
                          '&:hover': { 
                            bgcolor: 'info.lighter',
                            color: 'info.main'
                          } 
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Credential">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteCredential(cred)}
                        sx={{ 
                          '&:hover': { 
                            bgcolor: 'error.lighter',
                            color: 'error.main'
                          } 
                        }}
                      >
                        <DeleteIcon fontSize="small" />
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
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <KeyIcon color="primary" />
            <Typography variant="h6" component="span">
              Credential Details
            </Typography>
          </Stack>
        </DialogTitle>
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
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AddIcon color="primary" />
            <Typography variant="h6" component="span">
              Add New Credential
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Alert severity="info" icon={<InfoOutlinedIcon />}>
              <Typography variant="body2">
                API keys are securely encrypted at rest using PostgreSQL's pgcrypto extension.
              </Typography>
            </Alert>
            
            <TextField
              fullWidth
              label="Credential Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={Boolean(errors.name)}
              helperText={errors.name || 'A unique name to identify this credential'}
              required
            />
            
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
            
            <TextField
              fullWidth
              label="API Key"
              type="password"
              value={formData.api_key}
              onChange={(e) => handleChange('api_key', e.target.value)}
              error={Boolean(errors.api_key)}
              helperText={errors.api_key || 'Your API key will be securely encrypted'}
              required
              autoComplete="off"
            />
            
            {formData.provider === 'custom' && (
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
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSubmit} 
            disabled={loading}
            startIcon={<AddIcon />}
          >
            {loading ? 'Creating...' : 'Create Credential'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedCredential(null);
        }} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EditIcon color="primary" />
            <Typography variant="h6" component="span">
              Edit Credential
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Alert severity="info" icon={<InfoOutlinedIcon />}>
              <Typography variant="body2">
                You can update the name, provider, and additional settings. The API key cannot be changed for security reasons.
              </Typography>
            </Alert>
            
            <TextField
              fullWidth
              label="Credential Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={Boolean(errors.name)}
              helperText={errors.name || 'A unique name to identify this credential'}
              required
            />
            
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
            
            {formData.provider === 'custom' && (
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
            )}

            <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Note:</strong> API keys cannot be updated for security reasons. If you need to change the API key, please create a new credential.
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            onClick={() => {
              setEditDialogOpen(false);
              setSelectedCredential(null);
            }} 
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateSubmit} 
            disabled={loading}
            startIcon={<EditIcon />}
          >
            {loading ? 'Updating...' : 'Update Credential'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 24
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <WarningAmberIcon color="error" />
            <Typography variant="h6" component="span">
              Delete Credential
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedCredential && (
            <Stack spacing={2}>
              <Typography variant="body1">
                Are you sure you want to delete this credential?
              </Typography>
              
              <Card variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" color="text.secondary">
                        Name
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {selectedCredential.name}
                      </Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" color="text.secondary">
                        Provider
                      </Typography>
                      <Chip
                        label={selectedCredential.provider.toUpperCase()}
                        size="small"
                        color={getProviderColor(selectedCredential.provider)}
                        variant="outlined"
                      />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Alert severity="warning" icon={<InfoOutlinedIcon />}>
                <Typography variant="body2">
                  <strong>Note:</strong> This action cannot be undone. The credential can only be deleted if it's not currently associated with any agents.
                </Typography>
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            onClick={() => {
              setDeleteDialogOpen(false);
              setSelectedCredential(null);
            }} 
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={confirmDelete} 
            disabled={loading}
            startIcon={<DeleteIcon />}
          >
            {loading ? 'Deleting...' : 'Delete Credential'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
