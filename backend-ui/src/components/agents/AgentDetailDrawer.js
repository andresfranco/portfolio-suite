import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Chip,
  Grid,
  Paper,
  Stack,
  Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

/**
 * AgentDetailDrawer - Side drawer showing full agent configuration
 * 
 * Features:
 * - Full agent details in organized sections
 * - Credential information
 * - RAG settings
 * - Quick actions (edit, test)
 */
export default function AgentDetailDrawer({ open, onClose, agent, credentials = [], onEdit, onTest }) {
  if (!agent) return null;

  const credential = credentials.find(c => c.id === agent.credential_id) || {};

  const InfoRow = ({ label, value, chip = false, chipColor = 'default' }) => (
    <Grid container spacing={1} sx={{ mb: 1.5 }}>
      <Grid item xs={5}>
        <Typography variant="body2" color="text.secondary">
          {label}:
        </Typography>
      </Grid>
      <Grid item xs={7}>
        {chip ? (
          <Chip label={value} size="small" color={chipColor} />
        ) : (
          <Typography variant="body2" fontWeight={500}>
            {value || '—'}
          </Typography>
        )}
      </Grid>
    </Grid>
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 500 } }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6">Agent Details</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {/* Basic Info */}
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              {agent.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {agent.description || 'No description'}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip
                label={agent.is_active ? 'Active' : 'Inactive'}
                size="small"
                color={agent.is_active ? 'success' : 'default'}
              />
              <Chip
                label={`ID: ${agent.id}`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Paper>

          {/* Credential Information */}
          <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 3 }}>
            Credential
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <InfoRow label="Name" value={credential.name} />
            <InfoRow 
              label="Provider" 
              value={credential.provider?.toUpperCase()} 
              chip 
              chipColor={credential.provider === 'openai' ? 'success' : 'primary'} 
            />
          </Paper>

          {/* Generation Settings */}
          <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 3 }}>
            Generation Settings
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <InfoRow label="Chat Model" value={agent.chat_model || 'Default'} />
            <InfoRow label="Embedding Model" value={agent.embedding_model} />
          </Paper>

          {/* RAG Configuration */}
          <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 3 }}>
            RAG Configuration
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <InfoRow label="Top K" value={agent.top_k} />
            <InfoRow 
              label="Score Threshold" 
              value={agent.score_threshold !== null ? agent.score_threshold.toFixed(2) : 'None'} 
            />
            <InfoRow label="Max Context Tokens" value={agent.max_context_tokens?.toLocaleString()} />
          </Paper>

          {/* Usage & Budget */}
          {(agent.usage_limit || agent.budget_limit) && (
            <>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 3 }}>
                Usage Limits & Budget
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <InfoRow 
                  label="Monthly Usage Limit" 
                  value={agent.usage_limit ? `${agent.usage_limit.toLocaleString()} requests` : 'No limit'} 
                />
                <InfoRow 
                  label="Monthly Budget Limit" 
                  value={agent.budget_limit ? `$${agent.budget_limit.toFixed(2)}` : 'No limit'} 
                />
                {agent.current_usage !== undefined && (
                  <InfoRow 
                    label="Current Usage" 
                    value={`${agent.current_usage.toLocaleString()} requests`} 
                  />
                )}
                {agent.current_cost !== undefined && (
                  <InfoRow 
                    label="Current Cost" 
                    value={`$${agent.current_cost.toFixed(2)}`} 
                  />
                )}
              </Paper>
            </>
          )}

          {/* Advanced Settings */}
          {(agent.rerank_provider || agent.rerank_model) && (
            <>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 3 }}>
                Advanced Settings
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <InfoRow label="Rerank Provider" value={agent.rerank_provider} />
                <InfoRow label="Rerank Model" value={agent.rerank_model} />
              </Paper>
            </>
          )}
        </Box>

        {/* Actions */}
        <Divider />
        <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => {
              onClose();
              onEdit?.(agent);
            }}
            fullWidth
          >
            Edit
          </Button>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={() => {
              onClose();
              onTest?.(agent);
            }}
            fullWidth
          >
            Test
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
