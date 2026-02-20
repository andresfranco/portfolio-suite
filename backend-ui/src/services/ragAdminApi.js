import axios from './axiosWithAuth';

const ragAdminApi = {
  getSettings() {
    return axios.get('/api/rag/settings');
  },
  updateSettings(payload) {
    return axios.put('/api/rag/settings', payload);
  },
  reindexAll({ tables = null, limit = null, offset = 0 } = {}) {
    const body = { tables, limit, offset };
    return axios.post('/api/rag/reindex', body);
  },
  getStatus(params) {
    return axios.get('/api/rag/status', { params });
  },
  listDeadLetters(limit = 50) {
    return axios.get('/api/rag/dead_letters', { params: { limit } });
  },
  retryDeadLetters({ ids = null, job_type = null, max = 20 } = {}) {
    return axios.post('/api/rag/dead_letters/retry', { ids, job_type, max });
  },
  getMetricsSummary() {
    return axios.get('/api/rag/metrics_summary');
  },
};

export default ragAdminApi;
