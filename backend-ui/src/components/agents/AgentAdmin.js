import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Stack, Tabs, Tab, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { useAgentAdmin } from '../../contexts/AgentAdminContext';
import PermissionGate from '../common/PermissionGate';
import AgentList from './AgentList';
import AgentFormDialog from './AgentFormDialog';
import AgentDetailDrawer from './AgentDetailDrawer';
import CredentialManager from './CredentialManager';
import TestAgentDialog from './TestAgentDialog';
import { useSnackbar } from 'notistack';

/**
 * AgentAdmin - Main component for Agent Administration
 * 
 * Features:
 * - Tabbed interface (Agents / Credentials)
 * - Complete CRUD for agents
 * - Credential management
 * - Modern, user-friendly UI
 */
export default function AgentAdmin() {
  const { isSystemAdmin, hasPermission } = useAuthorization();
  const canManage = isSystemAdmin() || hasPermission('MANAGE_AGENTS');
  
  const {
    credentials,
    agents,
    loading,
    refreshCredentials,
    refreshAgents,
    createCredential,
    updateCredential,
    createAgent,
    updateAgent,
    deleteAgent,
    deleteCredential,
    upsertTemplate,
    getTemplate,
    testAgent
  } = useAgentAdmin();

  const { enqueueSnackbar } = useSnackbar();

  const [currentTab, setCurrentTab] = useState(0);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    refreshCredentials();
    refreshAgents();
  }, [refreshCredentials, refreshAgents]);

  // Handler: Create/Edit Agent
  const handleSaveAgent = async (payload) => {
    try {
      setFormLoading(true);
      
      // Extract system prompt from payload (not part of agent model)
      const { system_prompt, ...agentPayload } = payload;
      
      if (selectedAgent) {
        // Update existing agent
        await updateAgent(selectedAgent.id, agentPayload);
        
        // Update system prompt via template if provided
        if (system_prompt) {
          try {
            await upsertTemplate({
              agent_id: selectedAgent.id,
              system_prompt,
              citation_format: 'markdown',
              is_default: true
            });
          } catch (err) {
            console.error('Error updating template:', err);
          }
        }
        
        enqueueSnackbar('Agent updated successfully!', { variant: 'success' });
      } else {
        // Create new agent
        const newAgent = await createAgent(agentPayload);
        
        // Create system prompt template if provided
        if (system_prompt && newAgent?.id) {
          try {
            await upsertTemplate({
              agent_id: newAgent.id,
              system_prompt,
              citation_format: 'markdown',
              is_default: true
            });
          } catch (err) {
            console.error('Error creating template:', err);
          }
        }
        
        enqueueSnackbar('Agent created successfully!', { variant: 'success' });
      }
      
      setFormDialogOpen(false);
      setSelectedAgent(null);
      await refreshAgents();
    } catch (error) {
      console.error('Error saving agent:', error);
      enqueueSnackbar(
        error?.response?.data?.detail || 'Failed to save agent',
        { variant: 'error' }
      );
    } finally {
      setFormLoading(false);
    }
  };

  // Handler: Delete Agent
  const handleDeleteAgent = async (agent) => {
    if (!window.confirm(`Are you sure you want to delete agent "${agent.name}"?`)) {
      return;
    }

    try {
      await deleteAgent(agent.id);
      enqueueSnackbar('Agent deleted successfully!', { variant: 'success' });
      await refreshAgents();
    } catch (error) {
      console.error('Error deleting agent:', error);
      enqueueSnackbar(
        error?.response?.data?.detail || 'Failed to delete agent',
        { variant: 'error' }
      );
    }
  };

  // Handler: Toggle Agent Active Status
  const handleToggleActive = async (agent) => {
    try {
      await updateAgent(agent.id, { is_active: !agent.is_active });
      enqueueSnackbar(
        `Agent ${agent.is_active ? 'deactivated' : 'activated'} successfully!`,
        { variant: 'success' }
      );
      await refreshAgents();
    } catch (error) {
      console.error('Error toggling agent:', error);
      enqueueSnackbar('Failed to update agent status', { variant: 'error' });
    }
  };

  // Handler: Open Form for New Agent
  const handleCreateNew = () => {
    if (credentials.length === 0) {
      enqueueSnackbar('Please create a credential first', { variant: 'warning' });
      setCurrentTab(1); // Switch to credentials tab
      return;
    }
    setSelectedAgent(null);
    setFormDialogOpen(true);
  };

  // Handler: Open Form for Edit
  const handleEdit = async (agent) => {
    try {
      // Load system prompt from template
      const template = await getTemplate(agent.id);
      const agentWithPrompt = {
        ...agent,
        system_prompt: template?.system_prompt || agent.system_prompt
      };
      setSelectedAgent(agentWithPrompt);
      setFormDialogOpen(true);
    } catch (err) {
      console.error('Error loading template:', err);
      setSelectedAgent(agent);
      setFormDialogOpen(true);
    }
  };

  // Handler: Open Detail Drawer
  const handleView = (agent) => {
    setSelectedAgent(agent);
    setDetailDrawerOpen(true);
  };

  // Handler: Test Agent
  const handleTest = (agent) => {
    setSelectedAgent(agent);
    setTestDialogOpen(true);
  };

  // Handler: Run Test
  const handleRunTest = async (testPayload) => {
    try {
      const result = await testAgent(testPayload);
      return result;
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }
  };

  // Handler: Create Credential
  const handleCreateCredential = async (payload) => {
    try {
      await createCredential(payload);
      enqueueSnackbar('Credential created successfully!', { variant: 'success' });
      await refreshCredentials();
    } catch (error) {
      console.error('Error creating credential:', error);
      enqueueSnackbar(
        error?.response?.data?.detail || 'Failed to create credential',
        { variant: 'error' }
      );
      throw error;
    }
  };

  // Handler: Delete Credential
  const handleDeleteCredential = async (credentialId) => {
    try {
      await deleteCredential(credentialId);
      enqueueSnackbar('Credential deleted successfully!', { variant: 'success' });
      await refreshCredentials();
    } catch (error) {
      console.error('Error deleting credential:', error);
      const errorMessage = error?.response?.data?.detail || 'Failed to delete credential';
      enqueueSnackbar(errorMessage, { variant: 'error' });
      throw error;
    }
  };

  // Handler: Update Credential
  const handleUpdateCredential = async (credentialId, payload) => {
    try {
      await updateCredential(credentialId, payload);
      enqueueSnackbar('Credential updated successfully!', { variant: 'success' });
      await refreshCredentials();
    } catch (error) {
      console.error('Error updating credential:', error);
      const errorMessage = error?.response?.data?.detail || 'Failed to update credential';
      enqueueSnackbar(errorMessage, { variant: 'error' });
      throw error;
    }
  };

  return (
    <PermissionGate permissions={['MANAGE_AGENTS', 'SYSTEM_ADMIN']} requireAll={false}>
      <Box p={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Agent Administration</Typography>
          {currentTab === 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateNew}
              disabled={!canManage || loading}
            >
              New Agent
            </Button>
          )}
        </Stack>

        {!canManage && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You don't have permission to manage agents. Contact your administrator.
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
            <Tab label={`Agents (${agents.length})`} />
            <Tab label={`Credentials (${credentials.length})`} />
          </Tabs>
        </Box>

        {/* Tab Content */}
        {currentTab === 0 && (
          <AgentList
            agents={agents}
            credentials={credentials}
            onEdit={handleEdit}
            onDelete={handleDeleteAgent}
            onView={handleView}
            onTest={handleTest}
            onToggleActive={handleToggleActive}
            loading={loading}
          />
        )}

        {currentTab === 1 && (
          <CredentialManager
            credentials={credentials}
            onCreate={handleCreateCredential}
            onUpdate={handleUpdateCredential}
            onDelete={handleDeleteCredential}
            loading={loading}
          />
        )}

        {/* Dialogs & Drawers */}
        <AgentFormDialog
          open={formDialogOpen}
          onClose={() => {
            setFormDialogOpen(false);
            setSelectedAgent(null);
          }}
          onSave={handleSaveAgent}
          agent={selectedAgent}
          credentials={credentials}
          loading={formLoading}
        />

        <AgentDetailDrawer
          open={detailDrawerOpen}
          onClose={() => {
            setDetailDrawerOpen(false);
            setSelectedAgent(null);
          }}
          agent={selectedAgent}
          credentials={credentials}
          onEdit={handleEdit}
          onTest={handleTest}
        />

        <TestAgentDialog
          open={testDialogOpen}
          onClose={() => {
            setTestDialogOpen(false);
            setSelectedAgent(null);
          }}
          agent={selectedAgent}
          onTest={handleRunTest}
        />
      </Box>
    </PermissionGate>
  );
}
