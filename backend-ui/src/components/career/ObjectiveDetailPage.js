import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Tabs, Tab, Typography, Chip, Button, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox,
  TextField, Alert, Divider
} from '@mui/material';
import { Delete as DeleteIcon, PlayArrow as RunIcon, Add as AddIcon } from '@mui/icons-material';
import * as careerApi from '../../services/careerApi';
import { useCareer } from '../../contexts/CareerContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import ObjectiveForm from './ObjectiveForm';

const TabPanel = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

const AssessmentRunDialog = ({ open, onClose, objective, onCreated }) => {
  const navigate = useNavigate();
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [runName, setRunName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && objective?.jobs) {
      setSelectedJobs(objective.jobs.map((j) => j.id));
      setRunName('');
      setError(null);
    }
  }, [open, objective]);

  const toggleJob = (jobId) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleSubmit = async () => {
    if (selectedJobs.length === 0) {
      setError('Select at least one job.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await careerApi.createRun(objective.id, {
        name: runName || undefined,
        job_ids: selectedJobs,
      });
      const newRunId = res.data.id;
      onClose();
      navigate(`/career/runs/${newRunId}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create run');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Run Assessment</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Run Name (optional)"
          value={runName}
          onChange={(e) => setRunName(e.target.value)}
          fullWidth
        />
        <Typography variant="subtitle2">Select jobs to include:</Typography>
        {objective?.jobs?.length === 0 && (
          <Typography color="text.secondary" variant="body2">
            No jobs linked to this objective.
          </Typography>
        )}
        {objective?.jobs?.map((job) => (
          <FormControlLabel
            key={job.id}
            control={
              <Checkbox
                checked={selectedJobs.includes(job.id)}
                onChange={() => toggleJob(job.id)}
              />
            }
            label={`${job.title} — ${job.company}`}
          />
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || selectedJobs.length === 0}
          startIcon={submitting ? <CircularProgress size={16} /> : <RunIcon />}
        >
          Run
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const AddJobDialog = ({ open, onClose, objectiveId, existingJobIds, allJobs, onAdded }) => {
  const { linkJob } = useCareer();
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setError(null);
    }
  }, [open]);

  const available = allJobs.filter(
    (j) =>
      !existingJobIds.includes(j.id) &&
      (j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.company.toLowerCase().includes(search.toLowerCase()))
  );

  const handleLink = async (jobId) => {
    setSubmitting(true);
    setError(null);
    try {
      await linkJob(objectiveId, jobId);
      onAdded();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to link job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Job to Objective</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Search jobs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          size="small"
        />
        {available.length === 0 && (
          <Typography color="text.secondary" variant="body2">
            No available jobs to add.
          </Typography>
        )}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Company</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {available.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{job.title}</TableCell>
                  <TableCell>{job.company}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={submitting}
                      onClick={() => handleLink(job.id)}
                    >
                      Add
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const ObjectiveDetailPage = () => {
  const { objectiveId } = useParams();
  const navigate = useNavigate();
  const { unlinkJob, jobs: allJobs } = useCareer();
  const { hasPermission } = useAuthorization();

  const [tab, setTab] = useState(0);
  const [objective, setObjective] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [addJobOpen, setAddJobOpen] = useState(false);

  const fetchObjective = useCallback(async () => {
    try {
      setLoading(true);
      const [objRes, runsRes] = await Promise.all([
        careerApi.getObjective(objectiveId),
        careerApi.listRuns(objectiveId),
      ]);
      setObjective(objRes.data);
      setRuns(runsRes.data.items || runsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load objective');
    } finally {
      setLoading(false);
    }
  }, [objectiveId]);

  useEffect(() => {
    fetchObjective();
  }, [fetchObjective]);

  const handleUnlink = async (jobId) => {
    try {
      await unlinkJob(objectiveId, jobId);
      await fetchObjective();
    } catch (err) {
      console.error('Failed to unlink job:', err);
    }
  };

  if (!hasPermission('VIEW_CAREER')) {
    return (
      <Box p={3}>
        <Typography>You do not have permission to view Career OS.</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!objective) return null;

  const linkedJobIds = (objective.jobs || []).map((j) => j.id);

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h5">{objective.name}</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Portfolio #{objective.portfolio_id}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          {hasPermission('MANAGE_CAREER') && (
            <>
              <Button variant="outlined" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button
                variant="contained"
                startIcon={<RunIcon />}
                onClick={() => setRunDialogOpen(true)}
                disabled={(objective.jobs || []).length === 0}
              >
                Run Assessment
              </Button>
            </>
          )}
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Overview" />
        <Tab label="Jobs" />
        <Tab label="Runs" />
      </Tabs>

      {/* Tab 1: Overview */}
      <TabPanel value={tab} index={0}>
        <Box display="flex" flexDirection="column" gap={1.5} maxWidth={600}>
          <Box>
            <Typography variant="caption" color="text.secondary">Description</Typography>
            <Typography>{objective.description || '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Status</Typography>
            <Box mt={0.5}>
              <Chip
                label={objective.status}
                size="small"
                color={objective.status === 'active' ? 'success' : 'default'}
              />
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Created</Typography>
            <Typography>
              {objective.created_at ? new Date(objective.created_at).toLocaleDateString() : '—'}
            </Typography>
          </Box>
        </Box>
      </TabPanel>

      {/* Tab 2: Jobs */}
      <TabPanel value={tab} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1">Linked Jobs ({(objective.jobs || []).length})</Typography>
          {hasPermission('MANAGE_CAREER') && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setAddJobOpen(true)}
            >
              Add Job
            </Button>
          )}
        </Box>
        {(objective.jobs || []).length === 0 ? (
          <Typography color="text.secondary">No jobs linked to this objective.</Typography>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Fit %</TableCell>
                  {hasPermission('MANAGE_CAREER') && <TableCell />}
                </TableRow>
              </TableHead>
              <TableBody>
                {objective.jobs.map((job) => {
                  const latestRun = runs[0];
                  const fitScore = latestRun?.job_fit_summary?.find?.((jf) => jf.job_id === job.id)?.fit_score;
                  return (
                    <TableRow
                      key={job.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/career/jobs/${job.id}`)}
                    >
                      <TableCell>{job.title}</TableCell>
                      <TableCell>{job.company}</TableCell>
                      <TableCell>
                        <Chip label={job.status || 'saved'} size="small" />
                      </TableCell>
                      <TableCell>
                        {fitScore != null ? `${Math.round(fitScore)}%` : '—'}
                      </TableCell>
                      {hasPermission('MANAGE_CAREER') && (
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlink(job.id);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Tab 3: Runs */}
      <TabPanel value={tab} index={2}>
        <Typography variant="subtitle1" mb={2}>Assessment Runs</Typography>
        {runs.length === 0 ? (
          <Typography color="text.secondary">No assessment runs yet.</Typography>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Readiness</TableCell>
                  <TableCell>AI Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...runs]
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((run) => (
                    <TableRow
                      key={run.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/career/runs/${run.id}`)}
                    >
                      <TableCell>{run.name || `Run ${run.id}`}</TableCell>
                      <TableCell>
                        {run.created_at ? new Date(run.created_at).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        {run.readiness_score != null ? `${Math.round(run.readiness_score)}%` : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={run.ai_status || 'pending'}
                          size="small"
                          color={
                            run.ai_status === 'complete'
                              ? 'success'
                              : run.ai_status === 'failed'
                              ? 'error'
                              : 'default'
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Dialogs */}
      <ObjectiveForm
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          fetchObjective();
        }}
        objective={objective}
      />

      <AssessmentRunDialog
        open={runDialogOpen}
        onClose={() => setRunDialogOpen(false)}
        objective={objective}
      />

      <AddJobDialog
        open={addJobOpen}
        onClose={() => setAddJobOpen(false)}
        objectiveId={objectiveId}
        existingJobIds={linkedJobIds}
        allJobs={allJobs}
        onAdded={() => {
          setAddJobOpen(false);
          fetchObjective();
        }}
      />
    </Box>
  );
};

export default ObjectiveDetailPage;
