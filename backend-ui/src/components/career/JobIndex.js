import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Chip, CircularProgress, TextField,
  MenuItem, Select, FormControl, InputLabel, InputAdornment, Alert
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, CheckCircle as RemoteIcon } from '@mui/icons-material';
import * as careerApi from '../../services/careerApi';
import { useAuthorization } from '../../contexts/AuthorizationContext';

const STATUS_OPTIONS = ['all', 'saved', 'applied', 'interviewing', 'offer', 'rejected'];

const statusColor = (status) => {
  switch (status) {
    case 'offer': return 'success';
    case 'applied': return 'primary';
    case 'interviewing': return 'info';
    case 'rejected': return 'error';
    default: return 'default';
  }
};

const JobIndex = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuthorization();

  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [companySearch, setCompanySearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchJobs = useCallback(async () => {
    if (!hasPermission('VIEW_CAREER')) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: pageSize,
        offset: page * pageSize,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (companySearch) params.company = companySearch;

      const res = await careerApi.listJobs(params);
      setJobs(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [hasPermission, statusFilter, page, companySearch]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  if (!hasPermission('VIEW_CAREER')) {
    return (
      <Box p={3}>
        <Typography>You do not have permission to view Career OS.</Typography>
      </Box>
    );
  }

  const salaryRange = (job) => {
    if (job.salary_min && job.salary_max) {
      return `${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()} ${job.currency || 'USD'}`;
    }
    if (job.salary_min) return `${job.salary_min.toLocaleString()}+ ${job.currency || 'USD'}`;
    if (job.salary_max) return `Up to ${job.salary_max.toLocaleString()} ${job.currency || 'USD'}`;
    return 'N/A';
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Job Listings</Typography>
        {hasPermission('MANAGE_CAREER') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/career/jobs/new')}
          >
            New Job
          </Button>
        )}
      </Box>

      {/* Filters */}
      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Search company"
          value={companySearch}
          onChange={(e) => {
            setCompanySearch(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : jobs.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography color="text.secondary" mb={2}>No jobs found.</Typography>
          {hasPermission('MANAGE_CAREER') && (
            <Button variant="outlined" onClick={() => navigate('/career/jobs/new')}>
              Add your first job
            </Button>
          )}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Salary</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Remote</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/career/jobs/${job.id}`)}
                >
                  <TableCell>{job.title}</TableCell>
                  <TableCell>{job.company}</TableCell>
                  <TableCell>{salaryRange(job)}</TableCell>
                  <TableCell>{job.location || '—'}</TableCell>
                  <TableCell>
                    {job.is_remote ? (
                      <Chip icon={<RemoteIcon />} label="Remote" size="small" color="success" variant="outlined" />
                    ) : (
                      <Chip label="On-site" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={job.status || 'saved'}
                      size="small"
                      color={statusColor(job.status)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Simple pagination */}
      {total > pageSize && (
        <Box display="flex" justifyContent="center" gap={1} mt={2}>
          <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Typography sx={{ alignSelf: 'center' }}>
            Page {page + 1} of {Math.ceil(total / pageSize)}
          </Typography>
          <Button disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default JobIndex;
