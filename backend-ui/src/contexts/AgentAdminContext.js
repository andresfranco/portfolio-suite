import React, { createContext, useContext, useState, useCallback } from 'react';
import agentAdminApi from '../services/agentAdminApi';
import { logError } from '../utils/logger';

const AgentAdminContext = createContext(null);

export const useAgentAdmin = () => {
  const ctx = useContext(AgentAdminContext);
  if (!ctx) throw new Error('useAgentAdmin must be used within AgentAdminProvider');
  return ctx;
};

export const AgentAdminProvider = ({ children }) => {
  const [credentials, setCredentials] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshCredentials = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await agentAdminApi.listCredentials();
      setCredentials(list);
    } catch (e) {
      setError(e);
      logError('Failed to load credentials', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await agentAdminApi.listAgents();
      setAgents(list || []);
    } catch (e) {
      setError(e);
      logError('Failed to load agents', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const listTemplates = useCallback(async (agentId) => {
    return agentAdminApi.listAgentTemplates(agentId);
  }, []);

  const getTemplate = useCallback(async (agentId) => {
    return agentAdminApi.getAgentTemplate(agentId);
  }, []);

  const saveTemplate = useCallback(async ({ agent_id, name, is_default, system_prompt, user_prefix, citation_format }) => {
    return agentAdminApi.upsertTemplate({ agent_id, name, is_default, system_prompt, user_prefix, citation_format });
  }, []);

  const runTest = useCallback(async ({ agent_id, prompt, template_id, portfolio_id }) => {
    return agentAdminApi.testAgent({ agent_id, prompt, template_id, portfolio_id });
  }, []);

  const value = {
    credentials,
    agents,
    selectedAgentId,
    setSelectedAgentId,
    loading,
    error,
    refreshCredentials,
    refreshAgents,
    listTemplates,
    getTemplate,
    saveTemplate,
    runTest,
    createCredential: async (payload) => {
      const res = await agentAdminApi.createCredential(payload);
      await refreshCredentials();
      return res;
    },
    createAgent: async (payload) => {
      const res = await agentAdminApi.createAgent(payload);
      await refreshAgents();
      return res;
    },
    updateAgent: async (agentId, payload) => {
      const res = await agentAdminApi.updateAgent(agentId, payload);
      await refreshAgents();
      return res;
    },
    deleteAgent: async (agentId) => {
      const res = await agentAdminApi.deleteAgent(agentId);
      await refreshAgents();
      return res;
    },
    upsertTemplate: agentAdminApi.upsertTemplate,
    testAgent: agentAdminApi.testAgent,
    chat: agentAdminApi.chat,
  };

  return (
    <AgentAdminContext.Provider value={value}>
      {children}
    </AgentAdminContext.Provider>
  );
};


