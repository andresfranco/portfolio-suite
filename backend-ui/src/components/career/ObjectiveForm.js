import React, { useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Select, FormControl,
  InputLabel, CircularProgress
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useCareer } from '../../contexts/CareerContext';

const ObjectiveForm = ({ open, onClose, objective = null }) => {
  const { createObjective, updateObjective } = useCareer();
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors }
  } = useForm({
    defaultValues: {
      name: '',
      description: '',
      portfolio_id: '',
      status: 'active'
    }
  });

  useEffect(() => {
    if (objective) {
      reset({
        name: objective.name,
        description: objective.description || '',
        portfolio_id: objective.portfolio_id,
        status: objective.status
      });
    } else {
      reset({ name: '', description: '', portfolio_id: '', status: 'active' });
    }
  }, [objective, open, reset]);

  const onSubmit = async (data) => {
    try {
      const payload = { ...data, portfolio_id: parseInt(data.portfolio_id, 10) };
      if (objective) {
        await updateObjective(objective.id, payload);
      } else {
        await createObjective(payload);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save objective:', err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{objective ? 'Edit Objective' : 'New Objective'}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Name is required' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Name"
                required
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Description" multiline rows={3} />
            )}
          />
          <Controller
            name="portfolio_id"
            control={control}
            rules={{ required: 'Portfolio ID is required' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Portfolio ID"
                type="number"
                required
                error={!!errors.portfolio_id}
                helperText={errors.portfolio_id?.message}
              />
            )}
          />
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select {...field} label="Status">
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} /> : objective ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ObjectiveForm;
