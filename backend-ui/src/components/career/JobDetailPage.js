import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Tabs, Tab, Typography, Chip, Button, Paper, CircularProgress,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, IconButton,
  Autocomplete
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CheckCircle as RemoteIcon
} from '@mui/icons-material';
import * as careerApi from '../../services/careerApi';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import JobForm from './JobForm';

const TabPanel = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

const statusColor = (status) => {
  switch (status) {
    case 'offer': return 'success';
    case 'applied': return 'primary';
    case 'interviewing': return 'info';
    case 'rejected': return 'error';
    default: return 'default';
  }
};

const EditSkillsDialog = ({ open, onClose, job, onUpdated }) => {
  const [skills, setSkills] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && job) {
      setSkills(
        (job.skills || []).map((s) => ({
          skill_id: s.skill_id,
          name: s.name || `Skill ${s.skill_id}`,
        }))
      );
      setInputValue('');
      setOptions([]);
      setError(null);
    }
  }, [open, job]);

  // Debounced search
  useEffect(() => {
    if (!inputValue) { setOptions([]); return; }
    const timer = setTimeout(async () => {
      setOptionsLoading(true);
      try {
        const res = await careerApi.searchSkills(inputValue);
        setOptions(res.data || []);
      } catch {
        setOptions([]);
      } finally {
        setOptionsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const handleSelect = async (_, newValue) => {
    if (!newValue) return;
    const name = typeof newValue === 'string'
      ? newValue
      : newValue.inputValue || newValue.name;
    if (!name?.trim()) return;
    if (skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;

    setError(null);
    try {
      const res = await careerApi.ensureSkill(name.trim());
      const { id, name: resolvedName } = res.data;
      if (!skills.some((s) => s.skill_id === id)) {
        setSkills((prev) => [...prev, { skill_id: id, name: resolvedName }]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add skill');
    }
    setInputValue('');
  };

  const handleRemove = (skillId) => {
    setSkills((prev) => prev.filter((s) => s.skill_id !== skillId));
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await careerApi.updateJobSkills(
        job.id,
        skills.map((s) => ({ skill_id: s.skill_id, name: s.name }))
      );
      onUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update skills');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Required Skills</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <Autocomplete
          freeSolo
          value={null}
          options={options}
          getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.name || '')}
          filterOptions={(opts, params) => {
            const input = params.inputValue.toLowerCase();
            const filtered = opts.filter((o) => o.name.toLowerCase().includes(input));
            if (
              params.inputValue.trim() &&
              !filtered.some((o) => o.name.toLowerCase() === params.inputValue.toLowerCase())
            ) {
              filtered.push({ inputValue: params.inputValue, name: `Add "${params.inputValue}"` });
            }
            return filtered;
          }}
          loading={optionsLoading}
          inputValue={inputValue}
          onInputChange={(_, val) => setInputValue(val)}
          onChange={handleSelect}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Search or add skill"
              placeholder="Type a skill name…"
            />
          )}
        />

        {skills.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No skills added yet.</Typography>
        ) : (
          <Box display="flex" flexWrap="wrap" gap={1}>
            {skills.map((s) => (
              <Chip
                key={s.skill_id}
                label={s.name}
                onDelete={() => handleRemove(s.skill_id)}
              />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={submitting}>
          {submitting ? <CircularProgress size={20} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const DeleteConfirmDialog = ({ open, onClose, onConfirm, jobTitle }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Delete Job</DialogTitle>
    <DialogContent>
      <Typography>
        Are you sure you want to delete <strong>{jobTitle}</strong>? This cannot be undone.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="contained" color="error" onClick={onConfirm}>
        Delete
      </Button>
    </DialogActions>
  </Dialog>
);

const JobDetailPage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuthorization();

  const [tab, setTab] = useState(0);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      setLoading(true);
      const res = await careerApi.getJob(jobId);
      setJob(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const handleDelete = async () => {
    try {
      await careerApi.deleteJob(jobId);
      navigate('/career/jobs');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete job');
      setDeleteDialogOpen(false);
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

  if (!job) return null;

  if (editing) {
    return (
      <Box p={3}>
        <JobForm
          job={job}
          onSaved={() => {
            setEditing(false);
            fetchJob();
          }}
          onCancel={() => setEditing(false)}
        />
      </Box>
    );
  }

  const salaryRange = () => {
    if (job.salary_min && job.salary_max) {
      return `${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()} ${job.currency || 'USD'}`;
    }
    if (job.salary_min) return `${job.salary_min.toLocaleString()}+ ${job.currency || 'USD'}`;
    if (job.salary_max) return `Up to ${job.salary_max.toLocaleString()} ${job.currency || 'USD'}`;
    return 'N/A';
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h5">{job.title}</Typography>
          <Typography variant="subtitle1" color="text.secondary">{job.company}</Typography>
        </Box>
        {hasPermission('MANAGE_CAREER') && (
          <Box display="flex" gap={1}>
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          </Box>
        )}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Overview" />
        <Tab label="Required Skills" />
      </Tabs>

      {/* Tab 1: Overview */}
      <TabPanel value={tab} index={0}>
        <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} maxWidth={700}>
          <Box>
            <Typography variant="caption" color="text.secondary">Status</Typography>
            <Box mt={0.5}>
              <Chip label={job.status || 'saved'} size="small" color={statusColor(job.status)} />
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Remote</Typography>
            <Box mt={0.5}>
              {job.is_remote ? (
                <Chip icon={<RemoteIcon />} label="Remote" size="small" color="success" variant="outlined" />
              ) : (
                <Chip label="On-site" size="small" variant="outlined" />
              )}
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Location</Typography>
            <Typography>{job.location || '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Salary</Typography>
            <Typography>{salaryRange()}</Typography>
          </Box>
          {job.url && (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography variant="caption" color="text.secondary">URL</Typography>
              <Typography>
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  {job.url}
                </a>
              </Typography>
            </Box>
          )}
          {job.description && (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography variant="caption" color="text.secondary">Description</Typography>
              <Paper variant="outlined" sx={{ p: 2, mt: 0.5, maxHeight: 300, overflow: 'auto' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {job.description}
                </Typography>
              </Paper>
            </Box>
          )}
          {job.notes && (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography variant="caption" color="text.secondary">Notes</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                {job.notes}
              </Typography>
            </Box>
          )}
        </Box>
      </TabPanel>

      {/* Tab 2: Required Skills */}
      <TabPanel value={tab} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1">
            Required Skills ({(job.skills || []).length})
          </Typography>
          {hasPermission('MANAGE_CAREER') && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setSkillsDialogOpen(true)}
            >
              Edit Skills
            </Button>
          )}
        </Box>
        {(job.skills || []).length === 0 ? (
          <Typography color="text.secondary">No required skills defined.</Typography>
        ) : (
          <Box display="flex" flexWrap="wrap" gap={1}>
            {job.skills.map((skill) => (
              <Chip
                key={skill.id}
                label={skill.name || `Skill ${skill.skill_id}`}
                variant="outlined"
              />
            ))}
          </Box>
        )}
      </TabPanel>

      <EditSkillsDialog
        open={skillsDialogOpen}
        onClose={() => setSkillsDialogOpen(false)}
        job={job}
        onUpdated={() => fetchJob()}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        jobTitle={job.title}
      />
    </Box>
  );
};

export default JobDetailPage;
