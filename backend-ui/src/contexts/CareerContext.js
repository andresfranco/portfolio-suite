import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as careerApi from '../services/careerApi';
import { useAuthorization } from './AuthorizationContext';

const CareerContext = createContext(null);

export const useCareer = () => {
  const context = useContext(CareerContext);
  if (!context) throw new Error('useCareer must be used within CareerProvider');
  return context;
};

export const CareerProvider = ({ children }) => {
  const { hasPermission } = useAuthorization();
  const [objectives, setObjectives] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [totalObjectives, setTotalObjectives] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchObjectives = useCallback(async (params = {}) => {
    if (!hasPermission('VIEW_CAREER')) return;
    try {
      setLoading(true);
      const res = await careerApi.listObjectives({ limit: 50, offset: 0, ...params });
      setObjectives(res.data.items || []);
      setTotalObjectives(res.data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  const fetchJobs = useCallback(async (params = {}) => {
    if (!hasPermission('VIEW_CAREER')) return;
    try {
      setLoading(true);
      const res = await careerApi.listJobs({ limit: 50, offset: 0, ...params });
      setJobs(res.data.items || []);
      setTotalJobs(res.data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  // Pre-fetch on mount
  useEffect(() => {
    if (hasPermission('VIEW_CAREER')) {
      fetchObjectives();
      fetchJobs();
    }
  }, [hasPermission, fetchObjectives, fetchJobs]);

  // CRUD methods - call API then refresh list
  const createObjective = useCallback(async (data) => {
    const res = await careerApi.createObjective(data);
    await fetchObjectives();
    return res.data;
  }, [fetchObjectives]);

  const updateObjective = useCallback(async (id, data) => {
    const res = await careerApi.updateObjective(id, data);
    await fetchObjectives();
    return res.data;
  }, [fetchObjectives]);

  const deleteObjective = useCallback(async (id) => {
    await careerApi.deleteObjective(id);
    await fetchObjectives();
  }, [fetchObjectives]);

  const createJob = useCallback(async (data) => {
    const res = await careerApi.createJob(data);
    await fetchJobs();
    return res.data;
  }, [fetchJobs]);

  const updateJob = useCallback(async (id, data) => {
    const res = await careerApi.updateJob(id, data);
    await fetchJobs();
    return res.data;
  }, [fetchJobs]);

  const deleteJob = useCallback(async (id) => {
    await careerApi.deleteJob(id);
    await fetchJobs();
  }, [fetchJobs]);

  const linkJob = useCallback(async (objId, jobId) => {
    await careerApi.linkJobToObjective(objId, jobId);
    await fetchObjectives();
  }, [fetchObjectives]);

  const unlinkJob = useCallback(async (objId, jobId) => {
    await careerApi.unlinkJobFromObjective(objId, jobId);
    await fetchObjectives();
  }, [fetchObjectives]);

  return (
    <CareerContext.Provider value={{
      objectives, jobs, totalObjectives, totalJobs, loading, error,
      fetchObjectives, fetchJobs,
      createObjective, updateObjective, deleteObjective,
      createJob, updateJob, deleteJob,
      linkJob, unlinkJob,
    }}>
      {children}
    </CareerContext.Provider>
  );
};

export default CareerContext;
