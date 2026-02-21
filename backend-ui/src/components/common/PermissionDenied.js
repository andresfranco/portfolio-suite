import React from 'react';
import { Alert } from '@mui/material';

/**
 * Present a consistent, friendly permission denied message.
 * Props:
 * - message: full string to display
 * - sx: optional MUI sx overrides
 */
const PermissionDenied = ({ message, sx }) => {
  return (
    <Alert severity="error" sx={{ m: 2, ...sx }}>
      {message}
    </Alert>
  );
};

export default PermissionDenied;
