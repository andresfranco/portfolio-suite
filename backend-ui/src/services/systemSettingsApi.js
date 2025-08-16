import { api } from './api';

const systemSettingsApi = {
  getAll: async () => api.get('/api/settings/'),
  get: async (key) => api.get(`/api/settings/${encodeURIComponent(key)}`),
  upsert: async (key, value, description) => api.put(`/api/settings/${encodeURIComponent(key)}`, { value, description }),
  delete: async (key) => api.delete(`/api/settings/${encodeURIComponent(key)}`),
};

export default systemSettingsApi;

