import React, { useState } from 'react';
import {
  Box, Button, Typography, Alert, Paper, CircularProgress, Chip, Divider, Stack
} from '@mui/material';
import {
  CheckCircle as OkIcon,
  Error as ErrorIcon,
  Speed as LatencyIcon,
  Storage as DbIcon,
  EnvBarChart as EnvIcon,
} from '@mui/icons-material';
import StorageIcon from '@mui/icons-material/Storage';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
import * as careerApi from '../../services/careerApi';
import { useAuthorization } from '../../contexts/AuthorizationContext';

const SourceBadge = ({ source, credentialName }) => {
  if (source === 'db') {
    return (
      <Chip
        icon={<StorageIcon sx={{ fontSize: 14 }} />}
        label={`DB credential: ${credentialName || '(unknown)'}`}
        size="small"
        color="primary"
        variant="outlined"
      />
    );
  }
  return (
    <Chip
      icon={<SettingsEthernetIcon sx={{ fontSize: 14 }} />}
      label="env vars"
      size="small"
      variant="outlined"
    />
  );
};

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
          <Stack direction="row" gap={1} mb={1} flexWrap="wrap">
            {result.source && (
              <SourceBadge source={result.source} credentialName={result.credential_name} />
            )}
            {result.provider && (
              <Chip label={`provider: ${result.provider}`} size="small" variant="outlined" />
            )}
            {result.model && (
              <Chip label={`model: ${result.model}`} size="small" variant="outlined" />
            )}
          </Stack>
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
        Configured credentials take priority over environment variables.
      </Typography>

      <Box display="flex" flexDirection="column" gap={2}>
        <ProviderTestCard
          title="Primary Career AI"
          description="The main model used for career assessments. Resolves in order: DB credential (career.credential_id) → CAREER_AI_API_KEY env var."
          onTest={careerApi.testCareerProviderConnectivity}
        />

        <Divider />

        <ProviderTestCard
          title="Fallback Career AI (rate-limit)"
          description="Used automatically when the primary returns a 429 rate-limit error. Resolves in order: DB credential (career.fallback_credential_id) → CAREER_AI_FALLBACK_API_KEY env var."
          onTest={careerApi.testCareerFallbackConnectivity}
        />

        <Divider />

        <ProviderTestCard
          title="Anthropic (last-resort fallback)"
          description="Tested directly via ANTHROPIC_API_KEY env var. Used as last resort when all CAREER_AI providers are unconfigured or fail."
          onTest={careerApi.testAnthropicConnectivity}
        />
      </Box>
    </Box>
  );
};

export default CareerDiagnosticsPage;
