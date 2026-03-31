import React, { useState } from 'react';
import {
  Box, Button, Typography, Alert, Paper, CircularProgress, Chip, Divider
} from '@mui/material';
import {
  CheckCircle as OkIcon,
  Error as ErrorIcon,
  Speed as LatencyIcon,
} from '@mui/icons-material';
import * as careerApi from '../../services/careerApi';
import { useAuthorization } from '../../contexts/AuthorizationContext';

const ProviderTestCard = ({ title, description, onTest }) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await onTest();
      setResult(res.data);
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.detail || err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{description}</Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={handleTest}
          disabled={testing}
          startIcon={testing ? <CircularProgress size={14} /> : null}
          sx={{ ml: 2, flexShrink: 0 }}
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </Button>
      </Box>

      {result && (
        <Box mt={1.5}>
          {result.provider && (
            <Box display="flex" gap={1} mb={1} flexWrap="wrap">
              <Chip label={`provider: ${result.provider}`} size="small" variant="outlined" />
              <Chip label={`model: ${result.model}`} size="small" variant="outlined" />
            </Box>
          )}
          <Alert
            severity={result.success ? 'success' : 'error'}
            icon={result.success ? <OkIcon fontSize="small" /> : <ErrorIcon fontSize="small" />}
          >
            {result.success ? (
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                <span>Connected — response: <em>"{result.response}"</em></span>
                {result.latency_ms != null && (
                  <Chip
                    icon={<LatencyIcon sx={{ fontSize: 14 }} />}
                    label={`${result.latency_ms}ms`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                )}
              </Box>
            ) : (
              `Failed: ${result.error}`
            )}
          </Alert>
        </Box>
      )}
    </Paper>
  );
};

const CareerDiagnosticsPage = () => {
  const { hasPermission } = useAuthorization();

  if (!hasPermission('VIEW_CAREER')) {
    return (
      <Box p={3}>
        <Typography>You do not have permission to view Career OS.</Typography>
      </Box>
    );
  }

  return (
    <Box p={3} maxWidth={700}>
      <Typography variant="h5" mb={0.5}>AI Diagnostics</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Test connectivity to the AI providers used for career assessments.
      </Typography>

      <Box display="flex" flexDirection="column" gap={2}>
        <ProviderTestCard
          title="Anthropic"
          description="Tests ANTHROPIC_API_KEY using claude-haiku-4-5."
          onTest={careerApi.testAnthropicConnectivity}
        />

        <Divider />

        <ProviderTestCard
          title="Career AI Provider"
          description="Tests the active career AI provider configured via CAREER_AI_* settings (e.g. Groq, Gemini, Anthropic)."
          onTest={careerApi.testCareerProviderConnectivity}
        />
      </Box>
    </Box>
  );
};

export default CareerDiagnosticsPage;
