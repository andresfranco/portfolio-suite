/**
 * Security Dashboard API Service
 * 
 * Provides access to security monitoring endpoints for admin users
 */

import { api } from './api';

const securityApi = {
  /**
   * Get recent security events with optional filtering
   */
  getEvents: async (params = {}) => {
    const response = await api.get('/api/admin/security/events', { params });
    return response.data;
  },

  /**
   * Get security metrics for a time period
   */
  getMetrics: async (params = {}) => {
    const response = await api.get('/api/admin/security/metrics', { params });
    return response.data;
  },

  /**
   * Get suspicious activities detected by the system
   */
  getSuspiciousActivities: async (params = {}) => {
    const response = await api.get('/api/admin/security/suspicious-activities', { params });
    return response.data;
  },

  /**
   * Get real-time security statistics
   */
  getStats: async () => {
    const response = await api.get('/api/admin/security/stats');
    return response.data;
  },

  /**
   * Get blocked IPs and their block reasons
   */
  getBlockedIPs: async (params = {}) => {
    const response = await api.get('/api/admin/security/blocked-ips', { params });
    return response.data;
  },

  /**
   * Get anomaly detection results
   */
  getAnomalies: async (params = {}) => {
    const response = await api.get('/api/admin/security/anomalies', { params });
    return response.data;
  },

  /**
   * Get specific event by ID
   */
  getEvent: async (eventId) => {
    const response = await api.get(`/api/admin/security/events/${eventId}`);
    return response.data;
  },

  /**
   * Clear old security events (admin only)
   */
  clearOldEvents: async (olderThanDays) => {
    const response = await api.delete('/api/admin/security/events/clear', {
      params: { older_than_days: olderThanDays }
    });
    return response.data;
  }
};

export default securityApi;

