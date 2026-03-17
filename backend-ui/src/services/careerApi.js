import { api } from './api';

// Jobs
export const createJob = (data) => api.post('/api/career/jobs', data);
export const listJobs  = (params) => api.get('/api/career/jobs', { params });
export const getJob    = (id) => api.get(`/api/career/jobs/${id}`);
export const updateJob = (id, data) => api.put(`/api/career/jobs/${id}`, data);
export const deleteJob = (id) => api.delete(`/api/career/jobs/${id}`);
export const updateJobSkills = (id, skills) => api.put(`/api/career/jobs/${id}/skills`, { skills });

// Objectives
export const createObjective  = (data) => api.post('/api/career/objectives', data);
export const listObjectives   = (params) => api.get('/api/career/objectives', { params });
export const getObjective     = (id) => api.get(`/api/career/objectives/${id}`);
export const updateObjective  = (id, data) => api.put(`/api/career/objectives/${id}`, data);
export const deleteObjective  = (id) => api.delete(`/api/career/objectives/${id}`);
export const linkJobToObjective   = (objId, jobId) => api.post(`/api/career/objectives/${objId}/jobs/${jobId}`);
export const unlinkJobFromObjective = (objId, jobId) => api.delete(`/api/career/objectives/${objId}/jobs/${jobId}`);

// Assessment runs
export const createRun   = (objectiveId, data) => api.post(`/api/career/objectives/${objectiveId}/runs`, data);
export const listRuns    = (objectiveId) => api.get(`/api/career/objectives/${objectiveId}/runs`);
export const getRun      = (runId) => api.get(`/api/career/runs/${runId}`);
export const getScorecard    = (runId) => api.get(`/api/career/runs/${runId}/scorecard`);
export const getJobFit       = (runId) => api.get(`/api/career/runs/${runId}/job-fit`);
export const getResumeIssues = (runId) => api.get(`/api/career/runs/${runId}/resume-issues`);
export const getActionPlan   = (runId) => api.get(`/api/career/runs/${runId}/action-plan`);

// Skills
export const searchSkills = (q) => api.get('/api/career/skills/search', { params: { q, limit: 20 } });
export const ensureSkill  = (name) => api.post('/api/career/skills/ensure', { name });

// Run readiness
export const getRunReadiness = (objectiveId) => api.get(`/api/career/objectives/${objectiveId}/run-readiness`);

// Diagnostics
export const testAnthropicConnectivity = () => api.post('/api/career/diagnostics/anthropic');

// Portfolio attachments (for resume selection in run dialog)
export const getPortfolioAttachments = (portfolioId) => api.get(`/api/portfolios/${portfolioId}/attachments`);
export const uploadPortfolioAttachment = (portfolioId, formData) =>
  api.post(`/api/portfolios/${portfolioId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
