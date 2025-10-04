import { api } from './api';

const agentAdminApi = {
  createCredential: async (payload) => {
    const { data } = await api.post('/api/agents/credentials', payload);
    return data;
  },
  listCredentials: async () => {
    const { data } = await api.get('/api/agents/credentials');
    return data;
  },
  createAgent: async (payload) => {
    const { data } = await api.post('/api/agents', payload);
    return data;
  },
  listAgents: async () => {
    const { data } = await api.get('/api/agents');
    return data;
  },
  getAgentTemplate: async (agentId) => {
    const { data } = await api.get(`/api/agents/${agentId}/template`);
    return data;
  },
  listAgentTemplates: async (agentId) => {
    const { data } = await api.get(`/api/agents/${agentId}/templates`);
    return data;
  },
  updateAgent: async (agentId, payload) => {
    const { data } = await api.put(`/api/agents/${agentId}`, payload);
    return data;
  },
  deleteAgent: async (agentId) => {
    const { data } = await api.delete(`/api/agents/${agentId}`);
    return data;
  },
  upsertTemplate: async (payload) => {
    const { data } = await api.post('/api/agents/templates', payload);
    return data;
  },
  testAgent: async (payload) => {
    // Allow longer time for RAG + LLM on first run
    const { data } = await api.post('/api/agents/test', payload, { timeout: 90000 });
    return data;
  },
  chat: async (agentId, payload) => {
    const { data } = await api.post(`/api/agents/${agentId}/chat`, payload, { timeout: 90000 });
    return data;
  },
  listPortfolios: async () => {
    // Fetch all portfolios (no pagination for dropdown)
    const { data } = await api.get('/api/portfolios?page=1&page_size=100');
    return data;
  },
};

export default agentAdminApi;


