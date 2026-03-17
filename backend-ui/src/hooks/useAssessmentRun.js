import { useState, useEffect, useRef, useCallback } from 'react';
import * as careerApi from '../services/careerApi';

const POLL_INTERVAL_MS = 3000;
const HARD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const useAssessmentRun = (runId) => {
  const [run, setRun] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [jobFit, setJobFit] = useState(null);
  const [resumeIssues, setResumeIssues] = useState(null);
  const [actionPlan, setActionPlan] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pollingRef = useRef(null);
  const timeoutRef = useRef(null);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const fetchSections = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const [riRes, apRes] = await Promise.all([
        careerApi.getResumeIssues(runId),
        careerApi.getActionPlan(runId),
      ]);
      if (!mountedRef.current) return;

      const status = riRes.data.status;
      setAiStatus(status);

      if (status === 'complete') {
        setResumeIssues(riRes.data.data || null);
        setActionPlan(apRes.data.data || null);
        stopPolling();
      } else if (status === 'failed') {
        stopPolling();
      }
    } catch (err) {
      // Polling errors are non-fatal; keep polling
    }
  }, [runId, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      try {
        const [runRes, scorecardRes, jobFitRes] = await Promise.all([
          careerApi.getRun(runId),
          careerApi.getScorecard(runId),
          careerApi.getJobFit(runId),
        ]);

        if (!mountedRef.current) return;

        setRun(runRes.data);
        setScorecard(scorecardRes.data);
        setJobFit(jobFitRes.data);
        setAiStatus(runRes.data.ai_status);

        // Start polling if AI is not done
        if (['pending', 'running'].includes(runRes.data.ai_status)) {
          await fetchSections();

          pollingRef.current = setInterval(fetchSections, POLL_INTERVAL_MS);

          // Hard timeout: stop polling after 5 minutes
          timeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            stopPolling();
            setError('timeout');
          }, HARD_TIMEOUT_MS);
        } else {
          // Already done — fetch section data once
          await fetchSections();
        }
      } catch (err) {
        if (mountedRef.current) setError(err.message || 'Failed to load run');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [runId, fetchSections, stopPolling]);

  return { run, scorecard, jobFit, resumeIssues, actionPlan, loading, error, aiStatus };
};

export default useAssessmentRun;
