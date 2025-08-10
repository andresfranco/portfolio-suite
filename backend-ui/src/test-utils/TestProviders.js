import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../theme';

export const TestProviders = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
);

export default TestProviders;
