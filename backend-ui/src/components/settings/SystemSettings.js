import React, { useEffect, useState, useCallback } from 'react';
import { Box, Card, CardHeader, CardContent, Grid, TextField, Button, CircularProgress, Alert } from '@mui/material';
import { useSnackbar } from 'notistack';
import systemSettingsApi from '../../services/systemSettingsApi';
import PermissionGate from '../common/PermissionGate';

function SystemSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [accessMinutes, setAccessMinutes] = useState('30');
  const [refreshMinutes, setRefreshMinutes] = useState('10080');
  const [idleMinutes, setIdleMinutes] = useState('30');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await systemSettingsApi.getAll();
      const data = res.data || {};
      if (data['auth.access_token_expire_minutes']) setAccessMinutes(String(data['auth.access_token_expire_minutes']));
      if (data['auth.refresh_token_expire_minutes']) setRefreshMinutes(String(data['auth.refresh_token_expire_minutes']));
      if (data['frontend.idle_timeout_minutes']) setIdleMinutes(String(data['frontend.idle_timeout_minutes']));
    } catch (e) {
      setError('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      setSaving(true);
      await systemSettingsApi.upsert('auth.access_token_expire_minutes', accessMinutes, 'Access token expiry in minutes');
      await systemSettingsApi.upsert('auth.refresh_token_expire_minutes', refreshMinutes, 'Refresh token expiry in minutes (7 days)');
      await systemSettingsApi.upsert('frontend.idle_timeout_minutes', idleMinutes, 'Frontend idle timeout in minutes');
      enqueueSnackbar('Settings saved', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar('Failed to save settings', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PermissionGate permission="SYSTEM_ADMIN" showError errorMessage="You do not have permission to access System Settings.">
      <Card>
        <CardHeader title="System Settings" subheader="Authentication and session configuration" />
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Access token expiry (minutes)"
                    value={accessMinutes}
                    type="number"
                    fullWidth
                    onChange={(e) => setAccessMinutes(e.target.value)}
                    inputProps={{ min: 5 }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Refresh token expiry (minutes)"
                    value={refreshMinutes}
                    type="number"
                    fullWidth
                    onChange={(e) => setRefreshMinutes(e.target.value)}
                    inputProps={{ min: 60 }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Idle logout timeout (minutes)"
                    value={idleMinutes}
                    type="number"
                    fullWidth
                    onChange={(e) => setIdleMinutes(e.target.value)}
                    inputProps={{ min: 5 }}
                  />
                </Grid>
              </Grid>
              <Box mt={3}>
                <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={16} /> : null}>
                  {saving ? 'Saving…' : 'Save Settings'}
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </PermissionGate>
  );
}

export default SystemSettings;


