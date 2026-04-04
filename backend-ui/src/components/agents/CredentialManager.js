import React, { useState, useEffect } from 'react';
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
  Select,
  FormControl,
  InputLabel,
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
  Divider,
  FormControlLabel,
  Switch,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import KeyIcon from '@mui/icons-material/Key';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

const PURPOSE_OPTIONS = [
  { value: 'chat', label: 'Chat' },
  { value: 'career_primary', label: 'Career (primary)' },
  { value: 'career_fallback', label: 'Career (fallback)' },
  { value: 'embedding', label: 'Embedding' },
];

const EMPTY_FORM = {
  name: '',
  provider: 'openai',
  api_key: '',
  base_url: '',
  model_default: '',
  purpose: [],
  is_active: true,
};

/**
 * CredentialManager - UI for managing API credentials
 */
export default function CredentialManager({
  credentials = [],
  onCreate,
  onUpdate,
  onDelete,
  onTest,
  onRotate,
  onGetAssignments,
  onSaveAssignments,
  loading = false,
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [rotateKey, setRotateKey] = useState('');
  const [errors, setErrors] = useState({});
  const [testResults, setTestResults] = useState({}); // {credId: {success, latency_ms, error}}
  const [testingId, setTestingId] = useState(null);
  const [assignments, setAssignments] = useState({
    career_credential_id: null,
    career_model: '',
    career_fallback_id: null,
    career_fallback_model: '',
    embed_credential_id: null,
    anthropic_credential_id: null,
  });
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsSaving, setAssignmentsSaving] = useState(false);

  useEffect(() => {
    if (!onGetAssignments) return;
    setAssignmentsLoading(true);
    onGetAssignments()
      .then(data => setAssignments({
        career_credential_id: data.career_credential_id ?? null,
        career_model: data.career_model ?? '',
        career_fallback_id: data.career_fallback_id ?? null,
        career_fallback_model: data.career_fallback_model ?? '',
        embed_credential_id: data.embed_credential_id ?? null,
        anthropic_credential_id: data.anthropic_credential_id ?? null,
      }))
      .catch(() => {})
      .finally(() => setAssignmentsLoading(false));
  }, [onGetAssignments]);

  const handleSaveAssignments = async () => {
    if (!onSaveAssignments) return;
    setAssignmentsSaving(true);
    try {
      const updated = await onSaveAssignments({
        career_credential_id: assignments.career_credential_id || null,
        career_model: assignments.career_model || null,
        career_fallback_id: assignments.career_fallback_id || null,
        career_fallback_model: assignments.career_fallback_model || null,
        embed_credential_id: assignments.embed_credential_id || null,
        anthropic_credential_id: assignments.anthropic_credential_id || null,
      });
      if (updated) {
        setAssignments({
          career_credential_id: updated.career_credential_id ?? null,
          career_model: updated.career_model ?? '',
          career_fallback_id: updated.career_fallback_id ?? null,
          career_fallback_model: updated.career_fallback_model ?? '',
          embed_credential_id: updated.embed_credential_id ?? null,
          anthropic_credential_id: updated.anthropic_credential_id ?? null,
        });
      }
    } finally {
      setAssignmentsSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleOpen = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    setDialogOpen(true);
  };

  const handleOpenEdit = (cred) => {
    setSelectedCredential(cred);
    setFormData({
      name: cred.name,
      provider: cred.provider,
      api_key: '',
      base_url: cred.base_url || cred.extra?.base_url || '',
      model_default: cred.model_default || '',
      purpose: cred.purpose || [],
      is_active: cred.is_active !== false,
    });
    setErrors({});
    setEditDialogOpen(true);
  };

  const handleOpenRotate = (cred) => {
    setSelectedCredential(cred);
    setRotateKey('');
    setRotateDialogOpen(true);
  };

  const validate = (isEdit = false) => {
    const newErrors = {};
    if (!formData.name?.trim()) newErrors.name = 'Name is required';
    if (!isEdit && !formData.api_key?.trim()) newErrors.api_key = 'API Key is required';
    if (formData.provider === 'custom' && !formData.base_url?.trim())
      newErrors.base_url = 'Base URL is required for custom providers';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate(false)) return;
    const payload = {
      name: formData.name,
      provider: formData.provider,
      api_key: formData.api_key,
      base_url: formData.base_url || null,
      model_default: formData.model_default || null,
      purpose: formData.purpose.length ? formData.purpose : null,
      is_active: formData.is_active,
    };
    await onCreate(payload);
    setDialogOpen(false);
  };

  const handleUpdateSubmit = async () => {
    if (!validate(true)) return;
    const payload = {
      name: formData.name,
      provider: formData.provider,
      base_url: formData.base_url || null,
      model_default: formData.model_default || null,
      purpose: formData.purpose.length ? formData.purpose : null,
      is_active: formData.is_active,
    };
    await onUpdate(selectedCredential.id, payload);
    setEditDialogOpen(false);
    setSelectedCredential(null);
  };

  const handleRotateSubmit = async () => {
    if (!rotateKey.trim()) return;
    await onRotate(selectedCredential.id, rotateKey);
    setRotateDialogOpen(false);
    setSelectedCredential(null);
    setRotateKey('');
  };

  const handleTest = async (cred) => {
    setTestingId(cred.id);
    try {
      const result = await onTest(cred.id);
      setTestResults(prev => ({ ...prev, [cred.id]: result }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [cred.id]: { success: false, error: 'Request failed' } }));
    } finally {
      setTestingId(null);
    }
  };

  const getProviderColor = (provider) => {
    const colors = { openai: 'success', anthropic: 'warning', google: 'info', mistral: 'secondary', custom: 'default' };
    return colors[provider?.toLowerCase()] || 'default';
  };

  const maskApiKey = () => '••••••••••••••••';

  const handleViewCredential = (cred) => {
    setSelectedCredential(cred);
    setShowApiKey(false);
    setViewDialogOpen(true);
  };

  const handleDeleteCredential = (cred) => {
    setSelectedCredential(cred);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await onDelete(selectedCredential.id);
      setDeleteDialogOpen(false);
      setSelectedCredential(null);
    } catch (error) {
      console.error('Error deleting credential:', error);
    }
  };

  const PurposeChip = ({ value }) => {
    const opt = PURPOSE_OPTIONS.find(o => o.value === value);
    return <Chip label={opt ? opt.label : value} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />;
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <KeyIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>API Credentials</Typography>
          <Chip label={credentials.length} size="small" color="primary" variant="outlined" />
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen} disabled={loading}>
          Add Credential
        </Button>
      </Stack>

      {/* Table */}
      {credentials.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
          <KeyIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>No credentials configured yet</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>Create your first credential to enable agent functionality</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>Add Your First Credential</Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, '& .MuiTableHead-root': { bgcolor: 'grey.50' } }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><Typography variant="subtitle2" fontWeight={600}>Name</Typography></TableCell>
                <TableCell><Typography variant="subtitle2" fontWeight={600}>Provider</Typography></TableCell>
                <TableCell><Typography variant="subtitle2" fontWeight={600}>Purpose</Typography></TableCell>
                <TableCell><Typography variant="subtitle2" fontWeight={600}>Model</Typography></TableCell>
                <TableCell><Typography variant="subtitle2" fontWeight={600}>Active</Typography></TableCell>
                <TableCell><Typography variant="subtitle2" fontWeight={600}>Last Used</Typography></TableCell>
                <TableCell><Typography variant="subtitle2" fontWeight={600}>Status</Typography></TableCell>
                <TableCell align="right"><Typography variant="subtitle2" fontWeight={600}>Actions</Typography></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {credentials.map((cred) => {
                const testResult = testResults[cred.id];
                return (
                  <TableRow key={cred.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{cred.name}</Typography>
                      {cred.base_url && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {cred.base_url}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={cred.provider.toUpperCase()} size="small" color={getProviderColor(cred.provider)} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                        {(cred.purpose || []).map(p => <PurposeChip key={p} value={p} />)}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{cred.model_default || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={cred.is_active !== false ? 'Active' : 'Inactive'}
                        size="small"
                        color={cred.is_active !== false ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {cred.last_used_at ? new Date(cred.last_used_at).toLocaleDateString() : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {testResult && (
                        testResult.success
                          ? <Tooltip title={`${testResult.latency_ms}ms`}><CheckCircleOutlineIcon color="success" fontSize="small" /></Tooltip>
                          : <Tooltip title={testResult.error || 'Failed'}><ErrorOutlineIcon color="error" fontSize="small" /></Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Test connectivity">
                        <span>
                          <IconButton size="small" onClick={() => handleTest(cred)} disabled={testingId === cred.id}>
                            {testingId === cred.id ? <CircularProgress size={16} /> : <PlayArrowIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Rotate API key">
                        <IconButton size="small" onClick={() => handleOpenRotate(cred)}>
                          <AutorenewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleViewCredential(cred)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Credential">
                        <IconButton size="small" onClick={() => handleOpenEdit(cred)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Credential">
                        <IconButton size="small" onClick={() => handleDeleteCredential(cred)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Credential Assignments */}
      {onGetAssignments && (
        <Paper variant="outlined" sx={{ mt: 3, p: 3, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <Typography variant="h6">Credential Assignments</Typography>
            {assignmentsLoading && <CircularProgress size={16} />}
          </Stack>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Configure which credential powers each AI role. These settings override environment variables.
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            Only active credentials appear in the lists below. Select &quot;None&quot; to fall back to
            environment variables (<code>OPENAI_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>, etc.).
          </Alert>

          <Grid container spacing={3}>
            {/* Career AI – Primary */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Career AI – Primary Credential</InputLabel>
                <Select
                  label="Career AI – Primary Credential"
                  value={assignments.career_credential_id ?? ''}
                  onChange={e => setAssignments(prev => ({ ...prev, career_credential_id: e.target.value || null }))}
                >
                  <MenuItem value=""><em>— None (use env vars) —</em></MenuItem>
                  {credentials.filter(c => c.is_active).map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name} ({c.provider})</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Career AI – Primary Model override"
                placeholder="e.g. claude-3-5-sonnet-20241022"
                value={assignments.career_model || ''}
                onChange={e => setAssignments(prev => ({ ...prev, career_model: e.target.value }))}
                helperText="Leave blank to use the credential's default model"
              />
            </Grid>

            {/* Career AI – Fallback */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Career AI – Fallback Credential</InputLabel>
                <Select
                  label="Career AI – Fallback Credential"
                  value={assignments.career_fallback_id ?? ''}
                  onChange={e => setAssignments(prev => ({ ...prev, career_fallback_id: e.target.value || null }))}
                >
                  <MenuItem value=""><em>— None —</em></MenuItem>
                  {credentials.filter(c => c.is_active).map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name} ({c.provider})</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Career AI – Fallback Model override"
                placeholder="e.g. gpt-4o"
                value={assignments.career_fallback_model || ''}
                onChange={e => setAssignments(prev => ({ ...prev, career_fallback_model: e.target.value }))}
                helperText="Leave blank to use the credential's default model"
              />
            </Grid>

            {/* Embedding */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Embedding Credential</InputLabel>
                <Select
                  label="Embedding Credential"
                  value={assignments.embed_credential_id ?? ''}
                  onChange={e => setAssignments(prev => ({ ...prev, embed_credential_id: e.target.value || null }))}
                >
                  <MenuItem value=""><em>— None (use env vars) —</em></MenuItem>
                  {credentials.filter(c => c.is_active).map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name} ({c.provider})</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                The embedding model is read from the credential&apos;s <em>Default Model</em> field.
              </Typography>
            </Grid>

            {/* Anthropic last-resort */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}><Typography variant="caption" color="text.secondary">Last-resort fallback</Typography></Divider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Anthropic Credential</InputLabel>
                <Select
                  label="Anthropic Credential"
                  value={assignments.anthropic_credential_id ?? ''}
                  onChange={e => setAssignments(prev => ({ ...prev, anthropic_credential_id: e.target.value || null }))}
                >
                  <MenuItem value=""><em>— None (use ANTHROPIC_API_KEY env var) —</em></MenuItem>
                  {credentials.filter(c => c.is_active && c.provider === 'anthropic').map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Used when all CAREER_AI providers are unavailable. Only Anthropic credentials are shown.
              </Typography>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleSaveAssignments}
              disabled={assignmentsSaving || assignmentsLoading}
              startIcon={assignmentsSaving ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {assignmentsSaving ? 'Saving…' : 'Save Assignments'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <KeyIcon color="primary" />
            <Typography variant="h6" component="span">Credential Details</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedCredential && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Name" value={selectedCredential.name} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Provider" value={selectedCredential.provider.toUpperCase()} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="API Key" type="password" value={maskApiKey()} InputProps={{ readOnly: true }} />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  API keys are encrypted and cannot be retrieved. Use "Rotate Key" to replace it.
                </Typography>
              </Grid>
              {(selectedCredential.base_url || selectedCredential.extra?.base_url) && (
                <Grid item xs={12}>
                  <TextField fullWidth label="Base URL" value={selectedCredential.base_url || selectedCredential.extra?.base_url} InputProps={{ readOnly: true }} />
                </Grid>
              )}
              {selectedCredential.model_default && (
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Default Model" value={selectedCredential.model_default} InputProps={{ readOnly: true }} />
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Status" value={selectedCredential.is_active !== false ? 'Active' : 'Inactive'} InputProps={{ readOnly: true }} />
              </Grid>
              {selectedCredential.purpose?.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Purpose</Typography>
                  <Box>{selectedCredential.purpose.map(p => <PurposeChip key={p} value={p} />)}</Box>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Created" value={selectedCredential.created_at ? new Date(selectedCredential.created_at).toLocaleString() : '—'} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Last Used" value={selectedCredential.last_used_at ? new Date(selectedCredential.last_used_at).toLocaleString() : '—'} InputProps={{ readOnly: true }} />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AddIcon color="primary" />
            <Typography variant="h6" component="span">Add New Credential</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Alert severity="info" icon={<InfoOutlinedIcon />}>
              <Typography variant="body2">API keys are securely encrypted at rest using PostgreSQL's pgcrypto extension.</Typography>
            </Alert>
            <TextField fullWidth label="Credential Name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} error={Boolean(errors.name)} helperText={errors.name || 'A unique name to identify this credential'} required />
            <TextField fullWidth select label="Provider" value={formData.provider} onChange={(e) => handleChange('provider', e.target.value)} required>
              {PROVIDERS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </TextField>
            <TextField fullWidth label="API Key" type="password" value={formData.api_key} onChange={(e) => handleChange('api_key', e.target.value)} error={Boolean(errors.api_key)} helperText={errors.api_key || 'Your API key will be securely encrypted'} required autoComplete="off" />
            <TextField
              fullWidth
              label="Base URL"
              value={formData.base_url}
              onChange={(e) => handleChange('base_url', e.target.value)}
              error={Boolean(errors.base_url)}
              helperText={errors.base_url || 'Optional — required for custom/OpenAI-compatible endpoints'}
              placeholder="https://api.groq.com/openai/v1"
            />
            <TextField fullWidth label="Default Model" value={formData.model_default} onChange={(e) => handleChange('model_default', e.target.value)} helperText="e.g. gpt-4o, claude-haiku-4-5-20251001" placeholder="gpt-4o" />
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>Purpose (select all that apply)</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {PURPOSE_OPTIONS.map(opt => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    clickable
                    color={formData.purpose.includes(opt.value) ? 'primary' : 'default'}
                    variant={formData.purpose.includes(opt.value) ? 'filled' : 'outlined'}
                    onClick={() => {
                      const next = formData.purpose.includes(opt.value)
                        ? formData.purpose.filter(v => v !== opt.value)
                        : [...formData.purpose, opt.value];
                      handleChange('purpose', next);
                    }}
                  />
                ))}
              </Stack>
            </Box>
            <FormControlLabel
              control={<Switch checked={formData.is_active} onChange={(e) => handleChange('is_active', e.target.checked)} />}
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={loading} startIcon={<AddIcon />}>
            {loading ? 'Creating...' : 'Create Credential'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => { setEditDialogOpen(false); setSelectedCredential(null); }} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EditIcon color="primary" />
            <Typography variant="h6" component="span">Edit Credential</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Alert severity="info" icon={<InfoOutlinedIcon />}>
              <Typography variant="body2">The API key cannot be edited here. Use "Rotate Key" to replace it.</Typography>
            </Alert>
            <TextField fullWidth label="Credential Name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} error={Boolean(errors.name)} helperText={errors.name} required />
            <TextField fullWidth select label="Provider" value={formData.provider} onChange={(e) => handleChange('provider', e.target.value)} required>
              {PROVIDERS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </TextField>
            <TextField
              fullWidth
              label="Base URL"
              value={formData.base_url}
              onChange={(e) => handleChange('base_url', e.target.value)}
              error={Boolean(errors.base_url)}
              helperText={errors.base_url || 'Optional — required for custom/OpenAI-compatible endpoints'}
              placeholder="https://api.groq.com/openai/v1"
            />
            <TextField fullWidth label="Default Model" value={formData.model_default} onChange={(e) => handleChange('model_default', e.target.value)} helperText="e.g. gpt-4o, claude-haiku-4-5-20251001" placeholder="gpt-4o" />
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>Purpose (select all that apply)</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {PURPOSE_OPTIONS.map(opt => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    clickable
                    color={formData.purpose.includes(opt.value) ? 'primary' : 'default'}
                    variant={formData.purpose.includes(opt.value) ? 'filled' : 'outlined'}
                    onClick={() => {
                      const next = formData.purpose.includes(opt.value)
                        ? formData.purpose.filter(v => v !== opt.value)
                        : [...formData.purpose, opt.value];
                      handleChange('purpose', next);
                    }}
                  />
                ))}
              </Stack>
            </Box>
            <FormControlLabel
              control={<Switch checked={formData.is_active} onChange={(e) => handleChange('is_active', e.target.checked)} />}
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setEditDialogOpen(false); setSelectedCredential(null); }} disabled={loading}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateSubmit} disabled={loading} startIcon={<EditIcon />}>
            {loading ? 'Updating...' : 'Update Credential'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rotate Key Dialog */}
      <Dialog open={rotateDialogOpen} onClose={() => { setRotateDialogOpen(false); setSelectedCredential(null); }} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AutorenewIcon color="warning" />
            <Typography variant="h6" component="span">Rotate API Key</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2">
              Enter the new API key for <strong>{selectedCredential?.name}</strong>. The existing key will be immediately replaced.
            </Typography>
            <TextField
              fullWidth
              label="New API Key"
              type="password"
              value={rotateKey}
              onChange={(e) => setRotateKey(e.target.value)}
              required
              autoComplete="off"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowApiKey(v => !v)} edge="end">
                      {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              inputProps={{ type: showApiKey ? 'text' : 'password' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setRotateDialogOpen(false); setSelectedCredential(null); }} disabled={loading}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleRotateSubmit} disabled={loading || !rotateKey.trim()} startIcon={<AutorenewIcon />}>
            {loading ? 'Rotating...' : 'Rotate Key'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2, boxShadow: 24 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <WarningAmberIcon color="error" />
            <Typography variant="h6" component="span">Delete Credential</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedCredential && (
            <Stack spacing={2}>
              <Typography variant="body1">Are you sure you want to delete this credential?</Typography>
              <Card variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                      <Typography variant="body2" fontWeight="medium">{selectedCredential.name}</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" color="text.secondary">Provider</Typography>
                      <Chip label={selectedCredential.provider.toUpperCase()} size="small" color={getProviderColor(selectedCredential.provider)} variant="outlined" />
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
          <Button onClick={() => { setDeleteDialogOpen(false); setSelectedCredential(null); }} disabled={loading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={loading} startIcon={<DeleteIcon />}>
            {loading ? 'Deleting...' : 'Delete Credential'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

