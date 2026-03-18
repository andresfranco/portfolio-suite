import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Chip, CircularProgress,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useCareer } from '../../contexts/CareerContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import ObjectiveForm from './ObjectiveForm';

const CareerIndex = () => {
  const { objectives, loading, error } = useCareer();
  const { hasPermission } = useAuthorization();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);

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
        <Typography color="error">Error loading objectives: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Career Objectives</Typography>
        {hasPermission('MANAGE_CAREER') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
          >
            New Objective
          </Button>
        )}
      </Box>

      {objectives.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography color="text.secondary" mb={2}>No objectives yet.</Typography>
          {hasPermission('MANAGE_CAREER') && (
            <Button variant="outlined" onClick={() => setFormOpen(true)}>
              Create your first objective
            </Button>
          )}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Portfolio</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Jobs</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {objectives.map((obj) => (
                <TableRow
                  key={obj.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/career/objectives/${obj.id}`)}
                >
                  <TableCell>{obj.name}</TableCell>
                  <TableCell>Portfolio #{obj.portfolio_id}</TableCell>
                  <TableCell>
                    <Chip
                      label={obj.status}
                      size="small"
                      color={obj.status === 'active' ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{obj.jobs?.length || 0}</TableCell>
                  <TableCell>
                    {obj.created_at ? new Date(obj.created_at).toLocaleDateString() : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ObjectiveForm open={formOpen} onClose={() => setFormOpen(false)} />
    </Box>
  );
};

export default CareerIndex;
