import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, TextField, MenuItem, Paper, Stack, Alert } from '@mui/material';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { useAgentAdmin } from '../../contexts/AgentAdminContext';
import PermissionGate from '../common/PermissionGate';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

export default function AgentsIndex() {
  const { hasPermission, isSystemAdmin } = useAuthorization();
  const canManage = isSystemAdmin() || hasPermission('MANAGE_AGENTS');
  const {
    credentials,
    agents,
    selectedAgentId,
    setSelectedAgentId,
    refreshCredentials,
    refreshAgents,
    listTemplates,
    getTemplate,
    saveTemplate,
    runTest,
    createCredential,
    createAgent,
    upsertTemplate,
    testAgent,
  } = useAgentAdmin();

  const [credName, setCredName] = useState('');
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [credModel, setCredModel] = useState('gpt-4o-mini');
  const [agentName, setAgentName] = useState('Demo Agent');
  const [agentDesc, setAgentDesc] = useState('RAG-only agent');
  const [agentCredentialId, setAgentCredentialId] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant that answers strictly from the provided context.');
  const [testPrompt, setTestPrompt] = useState('What projects mention React?');
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    refreshCredentials();
    refreshAgents();
  }, [refreshCredentials, refreshAgents]);

  useEffect(() => {
    const loadTemplate = async () => {
      if (!selectedAgentId) return;
      try {
        const list = await listTemplates(selectedAgentId);
        setTemplates(list || []);
        if (list && list.length > 0) {
          const def = list.find(t => t.is_default) || list[0];
          setSelectedTemplateId(String(def.id));
          setTemplateName(def.name || '');
          setSystemPrompt(def.system_prompt || systemPrompt);
          return;
        }
        const tpl = await getTemplate(selectedAgentId);
        if (tpl?.system_prompt) setSystemPrompt(tpl.system_prompt);
      } catch (e) {
        // ignore; keep current prompt
      }
    };
    loadTemplate();
  }, [selectedAgentId, listTemplates, getTemplate]);

  const onCreateCredential = async () => {
    const payload = { name: credName, provider, api_key: apiKey, extra: { chat_model: credModel } };
    await createCredential(payload);
    setCredName('');
    setApiKey('');
    setCredModel('gpt-4o-mini');
  };

  const onCreateAgent = async () => {
    if (!agentCredentialId) return;
    const selectedCred = credentials.find(c => String(c.id) === String(agentCredentialId));
    const defaultChatModel = selectedCred?.extra?.chat_model || 'gpt-4o-mini';
    const agent = await createAgent({
      name: agentName,
      description: agentDesc,
      credential_id: Number(agentCredentialId),
      embedding_model: 'text-embedding-3-small',
      top_k: 8,
      max_context_tokens: 4000,
      chat_model: defaultChatModel,
      is_active: true,
    });
    await upsertTemplate({ agent_id: agent.id, system_prompt: systemPrompt, citation_format: 'markdown' });
  };

  const onTest = async () => {
    if (!selectedAgentId) {
      alert('Please select an agent for the quick test.');
      return;
    }
    setTestError('');
    setTestResult(null);
    setIsTesting(true);
    try {
      const res = await runTest({ agent_id: Number(selectedAgentId), prompt: testPrompt, template_id: selectedTemplateId ? Number(selectedTemplateId) : undefined });
      setTestResult(res);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to run test';
      setTestError(msg);
    } finally {
      setIsTesting(false);
    }
  };

  const onSaveTemplate = async () => {
    if (!selectedAgentId) {
      alert('Select an agent before saving its template.');
      return;
    }
    try {
      await saveTemplate({ agent_id: Number(selectedAgentId), name: templateName || 'default', is_default: !selectedTemplateId, system_prompt: systemPrompt, citation_format: 'markdown' });
      const list = await listTemplates(selectedAgentId);
      setTemplates(list || []);
      if (list && list.length > 0) {
        const def = list.find(t => t.is_default) || list[0];
        setSelectedTemplateId(String(def.id));
        setTemplateName(def.name || '');
      }
      alert('Template saved');
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to save template';
      setTestError(msg);
    }
  };

  if (!canManage) {
    return (
      <PermissionGate requiredPermission="MANAGE_AGENTS" />
    );
  }

  const cardSx = {
    p: 2,
    mb: 2,
    borderRadius: 1.5,
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
  };
  const controlMin = { minWidth: 220 };
  const primaryBtn = { textTransform: 'none', px: 2.5 };

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>Agents (Admin)</Typography>

      <Paper sx={cardSx}>
        <Typography variant="subtitle1" gutterBottom>Create Credential</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField label="Name" value={credName} onChange={(e) => setCredName(e.target.value)} size="small" sx={controlMin} />
          <TextField select label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} size="small" sx={{ minWidth: 160 }}>
            {PROVIDERS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          </TextField>
          <TextField label="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} size="small" type="password" sx={{ minWidth: 260 }} />
          <TextField label="Chat Model" placeholder="e.g., gpt-4o-mini, gpt-5-mini" value={credModel} onChange={(e) => setCredModel(e.target.value)} size="small" sx={{ minWidth: 200 }} />
          <Button variant="contained" onClick={onCreateCredential} sx={primaryBtn}>Save</Button>
        </Stack>
      </Paper>

      <Paper sx={cardSx}>
        <Typography variant="subtitle1" gutterBottom>Create Agent</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField label="Name" value={agentName} onChange={(e) => setAgentName(e.target.value)} size="small" sx={controlMin} />
          <TextField label="Description" value={agentDesc} onChange={(e) => setAgentDesc(e.target.value)} size="small" sx={{ minWidth: 280 }} />
          <TextField select label="Credential" value={agentCredentialId} onChange={(e) => setAgentCredentialId(e.target.value)} size="small" sx={{ minWidth: 260 }}>
            {credentials.map(c => <MenuItem key={c.id} value={c.id}>{c.name} ({c.provider})</MenuItem>)}
          </TextField>
          <Button variant="contained" onClick={onCreateAgent} sx={primaryBtn}>Save</Button>
        </Stack>
      </Paper>

      <Paper sx={cardSx}>
        <Typography variant="subtitle1" gutterBottom>Template & Quick Test</Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            fullWidth
            label="System Prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            size="small"
            multiline
            minRows={6}
          />
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }} alignItems="flex-start">
          <TextField select label="Agent" value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} size="small" sx={{ minWidth: 260 }}>
            {agents.map(a => (
              <MenuItem key={a.id} value={String(a.id)}>{a.name} {a.chat_model ? `(${a.chat_model})` : ''}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Template" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} size="small" sx={{ minWidth: 220 }}>
            {templates.map(t => (
              <MenuItem key={t.id} value={String(t.id)}>{t.name || '(unnamed)'} {t.is_default ? '(default)' : ''}</MenuItem>
            ))}
          </TextField>
          <TextField label="Template Name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} size="small" sx={{ minWidth: 220 }} placeholder="e.g., Retrieval-focused" />
          <TextField
            fullWidth
            label="Prompt"
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            size="small"
            multiline
            minRows={8}
            maxRows={20}
            placeholder="Enter your test prompt here..."
            sx={{
              '& .MuiOutlinedInput-root': {
                alignItems: 'flex-start'
              }
            }}
          />
          <Stack direction="column" spacing={1} sx={{ minWidth: 140 }}>
            <Button variant="contained" onClick={onTest} disabled={isTesting} sx={primaryBtn}>{isTesting ? 'Running…' : 'Run Test'}</Button>
            <Button variant="outlined" onClick={onSaveTemplate} disabled={!selectedAgentId} sx={primaryBtn}>Save Template</Button>
          </Stack>
        </Stack>
        {testError && (
          <Alert sx={{ mt: 2 }} severity="error">{testError}</Alert>
        )}
        {testResult && (
          <Box mt={2}>
            <Typography variant="body2">Latency: {testResult.latency_ms} ms</Typography>
            <Paper variant="outlined" sx={{ p: 2, mt: 1, borderRadius: 1.5 }}>
              <Typography variant="subtitle2" gutterBottom>Assistant</Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{testResult.answer}</Typography>
            </Paper>
          </Box>
        )}
      </Paper>
    </Box>
  );
}


