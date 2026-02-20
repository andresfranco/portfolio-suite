import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  Typography,
  Box,
  Divider,
  FormControlLabel,
  Switch,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';

const PROVIDERS = [
  { 
    value: 'openai', 
    label: 'OpenAI', 
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ] 
  },
  { 
    value: 'anthropic', 
    label: 'Anthropic', 
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ] 
  },
  { 
    value: 'google', 
    label: 'Google', 
    models: [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro'
    ] 
  },
  { 
    value: 'mistral', 
    label: 'Mistral', 
    models: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest'
    ] 
  },
  { value: 'custom', label: 'Custom (OpenAI-compatible)', models: [] }
];

const EMBEDDING_MODELS = [
  'text-embedding-3-small',
  'text-embedding-3-large',
  'text-embedding-ada-002'
];

/**
 * AgentFormDialog - Comprehensive form for creating/editing agents
 * 
 * Features:
 * - All agent configuration fields
 * - Multi-vendor support
 * - Validation
 * - Organized sections (Basic, RAG, Advanced)
 * - Helpful tooltips
 */
export default function AgentFormDialog({
  open,
  onClose,
  onSave,
  agent = null,
  credentials = [],
  loading = false
}) {
  const isEdit = Boolean(agent);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    credential_id: '',
    embedding_model: 'text-embedding-3-small',
    top_k: 8,
    score_threshold: null,
    max_context_tokens: 4000,
    chat_model: '',
    is_active: true,
    rerank_provider: '',
    rerank_model: '',
    system_prompt: 'You are a helpful AI assistant that answers questions based strictly on the provided context. If the context does not contain the answer, say you don\'t know.',
    usage_limit: null,
    budget_limit: null
  });

  const [errors, setErrors] = useState({});
  const [selectedProvider, setSelectedProvider] = useState('');

  // Initialize form when agent changes
  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || '',
        description: agent.description || '',
        credential_id: agent.credential_id || '',
        embedding_model: agent.embedding_model || 'text-embedding-3-small',
        top_k: agent.top_k || 8,
        score_threshold: agent.score_threshold || null,
        max_context_tokens: agent.max_context_tokens || 4000,
        chat_model: agent.chat_model || '',
        is_active: agent.is_active ?? true,
        rerank_provider: agent.rerank_provider || '',
        rerank_model: agent.rerank_model || '',
        system_prompt: agent.system_prompt || 'You are a helpful AI assistant that answers questions based strictly on the provided context. If the context does not contain the answer, say you don\'t know.',
        usage_limit: agent.usage_limit || null,
        budget_limit: agent.budget_limit || null
      });
      
      // Set selected provider based on credential
      if (agent.credential_id) {
        const cred = credentials.find(c => c.id === agent.credential_id);
        if (cred) {
          setSelectedProvider(cred.provider);
        }
      }
    } else {
      // Reset form for new agent
      setFormData({
        name: '',
        description: '',
        credential_id: '',
        embedding_model: 'text-embedding-3-small',
        top_k: 8,
        score_threshold: null,
        max_context_tokens: 4000,
        chat_model: '',
        is_active: true,
        rerank_provider: '',
        rerank_model: '',
        system_prompt: 'You are a helpful AI assistant that answers questions based strictly on the provided context. If the context does not contain the answer, say you don\'t know.',
        usage_limit: null,
        budget_limit: null
      });
      setSelectedProvider('');
    }
    setErrors({});
  }, [agent, credentials, open]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleCredentialChange = (credentialId) => {
    handleChange('credential_id', credentialId);
    const cred = credentials.find(c => c.id === parseInt(credentialId));
    if (cred) {
      setSelectedProvider(cred.provider);
      
      // When changing credential in edit mode, only suggest a default model if current model is not valid
      const provider = PROVIDERS.find(p => p.value === cred.provider);
      if (provider) {
        const currentModel = formData.chat_model;
        const isCurrentModelValid = !currentModel || 
                                    provider.models.includes(currentModel) || 
                                    provider.value === 'custom';
        
        // Only change the model if it's not set or not valid for the new provider
        if (!isCurrentModelValid && provider.models.length > 0) {
          handleChange('chat_model', provider.models[0]);
        }
      }
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.credential_id) {
      newErrors.credential_id = 'Credential is required';
    }
    
    if (formData.top_k < 1 || formData.top_k > 100) {
      newErrors.top_k = 'Top K must be between 1 and 100';
    }
    
    if (formData.score_threshold !== null && (formData.score_threshold < 0 || formData.score_threshold > 1)) {
      newErrors.score_threshold = 'Score threshold must be between 0 and 1';
    }
    
    if (formData.max_context_tokens < 100 || formData.max_context_tokens > 100000) {
      newErrors.max_context_tokens = 'Max context tokens must be between 100 and 100,000';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    
    // Prepare payload
    const payload = {
      ...formData,
      credential_id: parseInt(formData.credential_id),
      score_threshold: formData.score_threshold === '' || formData.score_threshold === null 
        ? null 
        : parseFloat(formData.score_threshold)
    };
    
    await onSave(payload);
  };

  const getSuggestedModels = () => {
    if (!selectedProvider) return [];
    const provider = PROVIDERS.find(p => p.value === selectedProvider);
    const models = provider?.models || [];
    
    // If current model exists but isn't in the list, add it to preserve existing values
    if (formData.chat_model && !models.includes(formData.chat_model) && selectedProvider !== 'custom') {
      return [...models, formData.chat_model];
    }
    
    return models;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            {isEdit ? `Edit Agent: ${agent?.name}` : 'Create New Agent'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Basic Information */}
        <Box mb={3}>
          <Typography variant="subtitle1" gutterBottom fontWeight={600}>
            Basic Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Agent Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={Boolean(errors.name)}
                helperText={errors.name || 'A unique name for this agent'}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                multiline
                rows={2}
                helperText="Brief description of what this agent does"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Credential"
                value={formData.credential_id}
                onChange={(e) => handleCredentialChange(e.target.value)}
                error={Boolean(errors.credential_id)}
                helperText={errors.credential_id || 'Select the API credential this agent will use'}
                required
              >
                {credentials.length === 0 ? (
                  <MenuItem disabled>No credentials available - create one first</MenuItem>
                ) : (
                  credentials.map((cred) => (
                    <MenuItem key={cred.id} value={cred.id}>
                      {cred.name} ({cred.provider.toUpperCase()})
                    </MenuItem>
                  ))
                )}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Chat Model"
                value={formData.chat_model || ''}
                onChange={(e) => handleChange('chat_model', e.target.value)}
                helperText={selectedProvider === 'custom' ? 'Enter any OpenAI-compatible model name' : 'The LLM model for generating responses'}
                select={getSuggestedModels().length > 0 && selectedProvider !== 'custom'}
              >
                {getSuggestedModels().length > 0 && selectedProvider !== 'custom' ? (
                  getSuggestedModels().map((model) => (
                    <MenuItem key={model} value={model}>
                      {model}
                    </MenuItem>
                  ))
                ) : null}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* RAG Configuration */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight={600}>
              RAG Configuration
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Embedding Model"
                  value={formData.embedding_model}
                  onChange={(e) => handleChange('embedding_model', e.target.value)}
                  helperText="Model for generating embeddings"
                >
                  {EMBEDDING_MODELS.map((model) => (
                    <MenuItem key={model} value={model}>
                      {model}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <TextField
                    fullWidth
                    label="Top K"
                    type="number"
                    value={formData.top_k}
                    onChange={(e) => handleChange('top_k', parseInt(e.target.value) || 0)}
                    error={Boolean(errors.top_k)}
                    helperText={errors.top_k || 'Number of chunks to retrieve'}
                    inputProps={{ min: 1, max: 100 }}
                  />
                  <Tooltip title="Number of most relevant chunks to retrieve from the database">
                    <HelpOutlineIcon fontSize="small" color="action" />
                  </Tooltip>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <TextField
                    fullWidth
                    label="Score Threshold"
                    type="number"
                    value={formData.score_threshold || ''}
                    onChange={(e) => handleChange('score_threshold', e.target.value ? parseFloat(e.target.value) : null)}
                    error={Boolean(errors.score_threshold)}
                    helperText={errors.score_threshold || 'Minimum similarity score (0-1, optional)'}
                    inputProps={{ min: 0, max: 1, step: 0.01 }}
                  />
                  <Tooltip title="Filter out chunks with similarity score below this threshold">
                    <HelpOutlineIcon fontSize="small" color="action" />
                  </Tooltip>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={1}>
                  <TextField
                    fullWidth
                    label="Max Context Tokens"
                    type="number"
                    value={formData.max_context_tokens}
                    onChange={(e) => handleChange('max_context_tokens', parseInt(e.target.value) || 0)}
                    error={Boolean(errors.max_context_tokens)}
                    helperText={errors.max_context_tokens || 'Maximum tokens to use for context'}
                    inputProps={{ min: 100, max: 100000 }}
                  />
                  <Tooltip title="Maximum number of tokens to include in the context sent to the LLM">
                    <HelpOutlineIcon fontSize="small" color="action" />
                  </Tooltip>
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* System Prompt */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight={600}>
              System Prompt
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Alert severity="info" sx={{ mb: 2 }}>
              The system prompt guides how the agent responds. Customize it to match your use case.
            </Alert>
            <TextField
              fullWidth
              label="System Prompt"
              value={formData.system_prompt}
              onChange={(e) => handleChange('system_prompt', e.target.value)}
              multiline
              rows={6}
              helperText="Instructions for how the agent should behave and respond"
              placeholder="You are a helpful AI assistant..."
            />
          </AccordionDetails>
        </Accordion>

        {/* Usage & Budget */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight={600}>
              Usage Limits & Budget
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Alert severity="info" sx={{ mb: 2 }}>
              Set limits to control API usage and costs. Leave empty for no limits.
            </Alert>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Monthly Usage Limit (requests)"
                  type="number"
                  value={formData.usage_limit || ''}
                  onChange={(e) => handleChange('usage_limit', e.target.value ? parseInt(e.target.value) : null)}
                  helperText="Maximum requests per month"
                  inputProps={{ min: 0 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Monthly Budget Limit (USD)"
                  type="number"
                  value={formData.budget_limit || ''}
                  onChange={(e) => handleChange('budget_limit', e.target.value ? parseFloat(e.target.value) : null)}
                  helperText="Maximum spend per month"
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Advanced (Optional) */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight={600}>
              Advanced (Optional)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Alert severity="info" sx={{ mb: 2 }}>
              Re-ranking is an advanced feature to improve retrieval quality. Leave empty if not needed.
            </Alert>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Rerank Provider"
                  value={formData.rerank_provider}
                  onChange={(e) => handleChange('rerank_provider', e.target.value)}
                  helperText="Optional rerank provider"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Rerank Model"
                  value={formData.rerank_model}
                  onChange={(e) => handleChange('rerank_model', e.target.value)}
                  helperText="Optional rerank model"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Saving...' : (isEdit ? 'Update Agent' : 'Create Agent')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
