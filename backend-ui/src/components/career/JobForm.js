import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, TextField, MenuItem, Select, FormControl,
  InputLabel, CircularProgress, Paper, FormControlLabel, Checkbox, Alert,
  Grid
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import * as careerApi from '../../services/careerApi';

const STATUS_OPTIONS = ['saved', 'applied', 'interviewing', 'offer', 'rejected'];

const JobForm = ({ job = null, onSaved, onCancel }) => {
  const navigate = useNavigate();
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors }
  } = useForm({
    defaultValues: {
      title: '',
      company: '',
      salary_min: '',
      salary_max: '',
      currency: 'USD',
      location: '',
      is_remote: false,
      url: '',
      description: '',
      status: 'saved',
      notes: '',
    }
  });

  useEffect(() => {
    if (job) {
      reset({
        title: job.title || '',
        company: job.company || '',
        salary_min: job.salary_min ?? '',
        salary_max: job.salary_max ?? '',
        currency: job.currency || 'USD',
        location: job.location || '',
        is_remote: job.is_remote || false,
        url: job.url || '',
        description: job.description || '',
        status: job.status || 'saved',
        notes: job.notes || '',
      });
    }
  }, [job, reset]);

  const [submitError, setSubmitError] = React.useState(null);

  const onSubmit = async (data) => {
    setSubmitError(null);
    try {
      const payload = {
        ...data,
        salary_min: data.salary_min !== '' ? parseInt(data.salary_min, 10) : null,
        salary_max: data.salary_max !== '' ? parseInt(data.salary_max, 10) : null,
      };

      if (job) {
        await careerApi.updateJob(job.id, payload);
        if (onSaved) {
          onSaved();
        } else {
          navigate(`/career/jobs/${job.id}`);
        }
      } else {
        const res = await careerApi.createJob(payload);
        const newId = res.data.id;
        navigate(`/career/jobs/${newId}`);
      }
    } catch (err) {
      setSubmitError(err.response?.data?.message || err.message || 'Failed to save job');
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else if (job) {
      navigate(`/career/jobs/${job.id}`);
    } else {
      navigate('/career/jobs');
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 800 }}>
      <Typography variant="h5" mb={3}>
        {job ? `Edit Job: ${job.title}` : 'New Job'}
      </Typography>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {submitError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="title"
              control={control}
              rules={{ required: 'Title is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Title"
                  required
                  fullWidth
                  error={!!errors.title}
                  helperText={errors.title?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="company"
              control={control}
              rules={{ required: 'Company is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Company"
                  required
                  fullWidth
                  error={!!errors.company}
                  helperText={errors.company?.message}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <Controller
              name="salary_min"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Salary Min" type="number" fullWidth />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Controller
              name="salary_max"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Salary Max" type="number" fullWidth />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Currency" fullWidth />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="location"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Location" fullWidth />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Controller
              name="is_remote"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={!!field.value} />}
                  label="Remote"
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select {...field} label="Status">
                    {STATUS_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="url"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Job URL" fullWidth type="url" />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Job Description"
                  multiline
                  rows={6}
                  fullWidth
                  placeholder="Paste the full job description here for best AI analysis results."
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Notes"
                  multiline
                  rows={3}
                  fullWidth
                  placeholder="Personal notes about this opportunity."
                />
              )}
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={3} justifyContent="flex-end">
          <Button onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} /> : job ? 'Save' : 'Create'}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

export default JobForm;
