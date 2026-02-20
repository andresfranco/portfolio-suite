import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Box, Typography, Paper, Button, Stack, Chip, Divider, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, TextField, FormControl, InputLabel, Select, MenuItem, IconButton, TablePagination } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import { useSnackbar } from 'notistack';
import ragAdminApi from '../../services/ragAdminApi';

// Helpers: robustly parse server timestamps and normalize booleans
const parseServerDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string') {
    let s = v.trim();
    // Insert "T" between date and time if missing (e.g., "2025-08-16 12:34:56" -> "2025-08-16T12:34:56")
    if (s && !s.includes('T') && s.includes(' ')) {
      s = s.replace(' ', 'T');
    }
    // Trim microseconds to milliseconds (.123456 -> .123)
    s = s.replace(/(\.\d{3})\d+/, '$1');
    // Ensure timezone if missing; assume Z (UTC)
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
      s += 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const toBool = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
  return undefined;
};
const formatMaybeDate = (v) => {
  const d = parseServerDate(v);
  return d ? d.toLocaleString() : '—';
};

const Stat = ({ label, value }) => (
  <Paper variant="outlined" sx={{ p: 2, minWidth: 220 }}>
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
    <Typography variant="h6" sx={{ mt: 0.5 }}>{value ?? '—'}</Typography>
  </Paper>
);

export default function RagAdmin() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [deadLetters, setDeadLetters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [jobType, setJobType] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  // Reindex indicators
  const [reindexStartedAt, setReindexStartedAt] = useState(null);
  const [reindexFinishedAt, setReindexFinishedAt] = useState(null);
  const [reindexActive, setReindexActive] = useState(false);
  const [reindexProcessed, setReindexProcessed] = useState(null);
  const [reindexPolling, setReindexPolling] = useState(false);
  // legacy state kept for minimal diffs but not relied upon for logic
  const [reindexBaseline, setReindexBaseline] = useState(null);
  const [reindexLastObserved, setReindexLastObserved] = useState(null);
  const [reindexStableTicks, setReindexStableTicks] = useState(0);
  const [reindexTimer, setReindexTimer] = useState(null);
  // Refs to avoid stale closures in interval
  const pollTimerRef = useRef(null);
  const baselineValueRef = useRef(0);
  const lastValueRef = useRef(null);
  const increasedObservedRef = useRef(false);
  const noChangeTicksRef = useRef(0);
  const deadlineRef = useRef(0);
  const startedAtRef = useRef(null);
  const lastFinishedRef = useRef(null);

  const activityValue = useCallback((m) => {
    if (!m) return 0;
    const a = Number(m.index_jobs_total || 0);
    const b = Number(m.retire_jobs_total || 0);
    const c = Number(m.chunks_retired_total || 0);
    return a + b + c;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, d, s] = await Promise.all([
        ragAdminApi.getMetricsSummary(),
        ragAdminApi.listDeadLetters(200),
        ragAdminApi.getSettings(),
      ]);
      const mm = m.data || {};
      setMetrics(mm);
      // consume authoritative fields with normalization; reset to null if missing
      const started = parseServerDate(mm.last_reindex_started_at);
      const finishedRaw = parseServerDate(mm.last_reindex_finished_at);
      const active = toBool(mm.reindex_active);
      setReindexStartedAt(started);
      let finished = finishedRaw;
      if (!finished && active === false) {
        // Preserve last known finished if API omits it and no active job
        finished = lastFinishedRef.current || null;
      }
      setReindexFinishedAt(finished);
      lastFinishedRef.current = finished;
      // Normalize active flag if finished >= started
      let activeNorm = typeof active === 'boolean' ? active : false;
      if (finished && started && finished.getTime() >= started.getTime()) {
        activeNorm = false;
      }
      setReindexActive(activeNorm);
      setReindexProcessed(typeof mm.last_reindex_processed !== 'undefined' ? mm.last_reindex_processed : null);
      setDeadLetters(d.data?.items || []);
      setSettings(s.data?.settings || {});
      // Clear any leftover polling on load to avoid spinners across sessions
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setReindexPolling(false);
    } catch (e) {
      enqueueSnackbar('Failed to load RAG admin data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  // Compute a safe, static "in progress" indicator without auto-polling on page open.
  const isInProgress = useMemo(() => {
    if (!reindexActive) return false;
    const started = parseServerDate(reindexStartedAt);
    const finished = parseServerDate(reindexFinishedAt);
    if (!started) return false;
    if (finished && finished.getTime() >= started.getTime()) return false;
    return true; // active and not finished
  }, [reindexActive, reindexStartedAt, reindexFinishedAt]);

  const onRetryAll = async () => {
    setBusy(true);
    try {
      const r = await ragAdminApi.retryDeadLetters({ max: 50 });
      const n = r.data?.retried?.length || 0;
      enqueueSnackbar(`Retried ${n} jobs`, { variant: 'success' });
      await load();
    } catch (e) {
      enqueueSnackbar('Retry failed', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onReindexAll = async () => {
    setBusy(true);
    try {
      // capture baseline metrics before scheduling
      let baseline = null;
      try {
        const m0 = await ragAdminApi.getMetricsSummary();
        baseline = m0.data || null;
        setReindexBaseline(baseline);
      } catch {}

      // Initialize polling refs
      const baselineValue = activityValue(baseline);
      baselineValueRef.current = baselineValue;
      lastValueRef.current = baselineValue;
      increasedObservedRef.current = false;
      noChangeTicksRef.current = 0;

  await ragAdminApi.reindexAll({ tables: null, limit: null, offset: 0 });
      enqueueSnackbar('Reindex scheduled', { variant: 'info' });
  const started = new Date();
  setReindexStartedAt(started);
      setReindexFinishedAt(null);
  setReindexPolling(true);
      startedAtRef.current = started;
      const NOOP_GRACE_MS = 8000;
      const HARD_TIMEOUT_MS = 60000;
      deadlineRef.current = Date.now() + HARD_TIMEOUT_MS;
      // Clear any prior timer
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      // Start polling loop
      pollTimerRef.current = setInterval(async () => {
        try {
          const m = await ragAdminApi.getMetricsSummary();
          const cur = m.data || {};
          setMetrics(cur);
          const parsedStarted = parseServerDate(cur.last_reindex_started_at);
          const parsedFinished = parseServerDate(cur.last_reindex_finished_at);
          setReindexStartedAt(parsedStarted);
          setReindexFinishedAt(parsedFinished);
          if (parsedFinished) lastFinishedRef.current = parsedFinished;
          const activeRaw = toBool(cur.reindex_active);
          let activeNorm = typeof activeRaw === 'boolean' ? activeRaw : false;
          if (parsedFinished && parsedStarted && parsedFinished.getTime() >= parsedStarted.getTime()) {
            activeNorm = false;
          }
          setReindexActive(activeNorm);
          if (typeof cur.last_reindex_processed !== 'undefined') setReindexProcessed(cur.last_reindex_processed);
          const v = activityValue(cur);
          if (v > baselineValueRef.current) {
            increasedObservedRef.current = true;
          }
          if (v === lastValueRef.current) {
            noChangeTicksRef.current += 1;
          } else {
            noChangeTicksRef.current = 0;
          }
          lastValueRef.current = v;
          const elapsedMs = Date.now() - (startedAtRef.current?.getTime?.() || Date.now());
          const finished = (
            (increasedObservedRef.current && noChangeTicksRef.current >= 2) ||
            (!increasedObservedRef.current && elapsedMs >= NOOP_GRACE_MS) ||
            Date.now() >= deadlineRef.current
          );
          // Stop if heuristically finished, or backend inactive, or backend provided finished timestamp
          if (finished || activeNorm === false || parsedFinished) {
            setReindexFinishedAt(parsedFinished || new Date());
            setReindexPolling(false);
            setReindexActive(false);
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
          }
        } catch {
          // ignore transient errors
        }
      }, 2000);
      // Also perform an immediate poll once to update UI promptly without waiting for the first interval tick
      try {
        const m = await ragAdminApi.getMetricsSummary();
        const cur = m.data || {};
        setMetrics(cur);
        const parsedStarted = parseServerDate(cur.last_reindex_started_at);
        const parsedFinished = parseServerDate(cur.last_reindex_finished_at);
        setReindexStartedAt(parsedStarted);
        setReindexFinishedAt(parsedFinished);
        if (parsedFinished) lastFinishedRef.current = parsedFinished;
        const activeRaw = toBool(cur.reindex_active);
        let activeNorm = typeof activeRaw === 'boolean' ? activeRaw : false;
        if (parsedFinished && parsedStarted && parsedFinished.getTime() >= parsedStarted.getTime()) {
          activeNorm = false;
        }
        setReindexActive(activeNorm);
        if (typeof cur.last_reindex_processed !== 'undefined') setReindexProcessed(cur.last_reindex_processed);
        const v = activityValue(cur);
        if (v > baselineValueRef.current) {
          increasedObservedRef.current = true;
        }
        if (v === lastValueRef.current) {
          noChangeTicksRef.current += 1;
        } else {
          noChangeTicksRef.current = 0;
        }
        lastValueRef.current = v;
        const elapsedMs = Date.now() - (startedAtRef.current?.getTime?.() || Date.now());
        const finished = (
          (increasedObservedRef.current && noChangeTicksRef.current >= 2) ||
          (!increasedObservedRef.current && elapsedMs >= NOOP_GRACE_MS) ||
          Date.now() >= deadlineRef.current
        );
        if (finished || activeNorm === false || parsedFinished) {
          setReindexFinishedAt(parsedFinished || new Date());
          setReindexPolling(false);
          setReindexActive(false);
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }
      } catch {}
    } catch (e) {
      enqueueSnackbar('Failed to schedule reindex', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      // Only send whitelisted keys
      const payload = {
        'rag.chunk_chars': String(settings['rag.chunk_chars'] ?? ''),
        'rag.chunk_overlap': String(settings['rag.chunk_overlap'] ?? ''),
        'rag.debounce_seconds': String(settings['rag.debounce_seconds'] ?? ''),
        'rag.allow_fields': String(settings['rag.allow_fields'] ?? ''),
        'rag.redact_regex': String(settings['rag.redact_regex'] ?? ''),
      };
      await ragAdminApi.updateSettings(payload);
      enqueueSnackbar('Settings saved', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar('Failed to save settings', { variant: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  const onRetryOne = async (id) => {
    setBusy(true);
    try {
      await ragAdminApi.retryDeadLetters({ ids: [id] });
      enqueueSnackbar(`Retried #${id}`, { variant: 'success' });
      await load();
    } catch (e) {
      enqueueSnackbar(`Retry failed for #${id}`, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const filtered = jobType === 'all' ? deadLetters : (deadLetters || []).filter(r => r.job_type === jobType);
  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>RAG Admin</Typography>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Button onClick={onReindexAll} variant="contained" disabled={busy || reindexPolling}>
          {busy || reindexPolling ? (
            <>
              <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} />
              Reindexing…
            </>
          ) : (
            'Reindex All'
          )}
        </Button>
        <Button onClick={onRetryAll} variant="outlined" disabled={busy || reindexPolling || deadLetters.length === 0}>
          {busy ? (
            <>
              <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} />
              Retrying…
            </>
          ) : (
            'Retry Dead Letters'
          )}
        </Button>
      </Stack>

      {/* Settings */}
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Settings</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        {!settings ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading settings…</Typography>
        ) : (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
            <TextField
              label="Chunk chars"
              size="small"
              value={settings['rag.chunk_chars'] || ''}
              onChange={(e) => setSettings({ ...settings, 'rag.chunk_chars': e.target.value })}
            />
            <TextField
              label="Chunk overlap"
              size="small"
              value={settings['rag.chunk_overlap'] || ''}
              onChange={(e) => setSettings({ ...settings, 'rag.chunk_overlap': e.target.value })}
            />
            <TextField
              label="Debounce seconds"
              size="small"
              value={settings['rag.debounce_seconds'] || ''}
              onChange={(e) => setSettings({ ...settings, 'rag.debounce_seconds': e.target.value })}
            />
            <TextField
              label="Allow fields (comma-separated)"
              size="small"
              sx={{ minWidth: 320 }}
              value={settings['rag.allow_fields'] || ''}
              onChange={(e) => setSettings({ ...settings, 'rag.allow_fields': e.target.value })}
            />
            <TextField
              label="Redact regex"
              size="small"
              sx={{ minWidth: 320 }}
              value={settings['rag.redact_regex'] || ''}
              onChange={(e) => setSettings({ ...settings, 'rag.redact_regex': e.target.value })}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button variant="contained" onClick={onSaveSettings} disabled={savingSettings}>
                {savingSettings ? (
                  <>
                    <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} />
                    Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </Box>
          </Stack>
        )}
      </Paper>

      <Typography variant="subtitle1" sx={{ mb: 1 }}>Metrics</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Stat label="Index Jobs" value={metrics?.index_jobs_total} />
        <Stat label="Retire Jobs" value={metrics?.retire_jobs_total} />
  <Stat label="Chunks Retired" value={metrics?.chunks_retired_total} />
  <Stat label="Last Reindex Processed" value={reindexProcessed ?? '—'} />
      </Stack>
      {/* Reindex indicators */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Last reindex started: {formatMaybeDate(reindexStartedAt)}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {(reindexActive && isInProgress) ? (
            <>
              In progress <CircularProgress size={12} sx={{ ml: 1, verticalAlign: 'middle' }} />
            </>
          ) : (
            <>Last reindex finished: {formatMaybeDate(reindexFinishedAt)}</>
          )}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" sx={{ mb: 1, gap: 1 }}>
        <Typography variant="subtitle1">Dead Letters</Typography>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="job-type-label">Job Type</InputLabel>
          <Select
            labelId="job-type-label"
            label="Job Type"
            value={jobType}
            onChange={(e) => { setJobType(e.target.value); setPage(0); }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="index">index</MenuItem>
            <MenuItem value="retire">retire</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      {loading ? (
        <CircularProgress />
      ) : filtered.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>No dead letters</Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Error</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip size="small" label={row.job_type} color={row.job_type === 'retire' ? 'warning' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.source_table} / {row.source_id}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.error}>
                      {row.error}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => onRetryOne(row.id)} disabled={busy} title="Retry">
                      <ReplayIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </Paper>
      )}
    </Box>
  );
}
