/**
 * Security Dashboard Component
 * 
 * Displays security monitoring information including:
 * - Real-time security metrics
 * - Recent security events
 * - Suspicious activities
 * - Blocked IPs
 * - Anomaly detection
 * 
 * Accessible only to users with SYSTEM_ADMIN permission
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import securityApi from '../../services/securityApi';
import PermissionGate from '../common/PermissionGate';

const SecurityDashboard = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [suspicious, setSuspicious] = useState([]);
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');

  // Fetch all security data
  const fetchSecurityData = async () => {
    try {
      setRefreshing(true);
      
      // Calculate time range
      const hours = timeRange === '1h' ? 1 : 
                    timeRange === '6h' ? 6 : 
                    timeRange === '24h' ? 24 : 
                    timeRange === '7d' ? 168 : 720; // 30d

      const [
        statsData,
        eventsData,
        suspiciousData,
        blockedIPsData,
        anomaliesData,
        metricsData
      ] = await Promise.all([
        securityApi.getStats(),
        securityApi.getEvents({ limit: 50, hours }),
        securityApi.getSuspiciousActivities({ limit: 20, hours }),
        securityApi.getBlockedIPs({ limit: 20 }),
        securityApi.getAnomalies({ limit: 20, hours }),
        securityApi.getMetrics({ hours })
      ]);

      setStats(statsData);
      setEvents(eventsData.events || []);
      setSuspicious(suspiciousData.activities || []);
      setBlockedIPs(blockedIPsData.blocked_ips || []);
      setAnomalies(anomaliesData.anomalies || []);
      setMetrics(metricsData);
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch security data:', error);
      enqueueSnackbar('Failed to load security data', { variant: 'error' });
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSecurityData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const handleRefresh = () => {
    fetchSecurityData();
  };

  const handleViewEventDetails = async (eventId) => {
    try {
      const event = await securityApi.getEvent(eventId);
      setSelectedEvent(event);
      setEventDetailOpen(true);
    } catch (error) {
      enqueueSnackbar('Failed to load event details', { variant: 'error' });
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return <ErrorIcon />;
      case 'high': return <WarningIcon />;
      case 'warning': return <WarningIcon />;
      case 'info': return <InfoIcon />;
      default: return <CheckCircleIcon />;
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PermissionGate permission="SYSTEM_ADMIN" showError>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <SecurityIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant="h4" component="h1">
              Security Dashboard
            </Typography>
          </Box>
          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                label="Time Range"
              >
                <MenuItem value="1h">Last Hour</MenuItem>
                <MenuItem value="6h">Last 6 Hours</MenuItem>
                <MenuItem value="24h">Last 24 Hours</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={refreshing}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stats Overview */}
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Events
                    </Typography>
                    <Typography variant="h4">
                      {stats?.total_events || 0}
                    </Typography>
                  </Box>
                  <InfoIcon sx={{ fontSize: 40, color: 'info.main', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Suspicious Activities
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {stats?.suspicious_count || 0}
                    </Typography>
                  </Box>
                  <WarningIcon sx={{ fontSize: 40, color: 'warning.main', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Blocked IPs
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      {stats?.blocked_ips_count || 0}
                    </Typography>
                  </Box>
                  <BlockIcon sx={{ fontSize: 40, color: 'error.main', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Anomalies Detected
                    </Typography>
                    <Typography variant="h4" color="error.main">
                      {stats?.anomalies_count || 0}
                    </Typography>
                  </Box>
                  <ErrorIcon sx={{ fontSize: 40, color: 'error.main', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Metrics Summary */}
        {metrics && (
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Security Metrics ({timeRange})
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Failed Logins
                </Typography>
                <Typography variant="h6">
                  {metrics.failed_logins || 0}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Injection Attempts
                </Typography>
                <Typography variant="h6">
                  {metrics.injection_attempts || 0}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Rate Limit Hits
                </Typography>
                <Typography variant="h6">
                  {metrics.rate_limit_exceeded || 0}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="textSecondary">
                  Average Response Time
                </Typography>
                <Typography variant="h6">
                  {metrics.avg_response_time ? `${metrics.avg_response_time.toFixed(0)}ms` : 'N/A'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Tabs for Different Views */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label={`Events (${events.length})`} />
            <Tab label={`Suspicious (${suspicious.length})`} />
            <Tab label={`Blocked IPs (${blockedIPs.length})`} />
            <Tab label={`Anomalies (${anomalies.length})`} />
          </Tabs>
        </Paper>

        {/* Events Tab */}
        {activeTab === 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Event Type</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="textSecondary">No security events found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatTimestamp(event.timestamp)}</TableCell>
                      <TableCell>
                        <Chip label={event.event_type} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          icon={getSeverityIcon(event.severity)}
                          label={event.severity} 
                          color={getSeverityColor(event.severity)}
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>{event.ip_address || 'N/A'}</TableCell>
                      <TableCell>{event.user_id || 'Anonymous'}</TableCell>
                      <TableCell>{event.description || 'No description'}</TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            onClick={() => handleViewEventDetails(event.id)}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Suspicious Activities Tab */}
        {activeTab === 1 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Activity Type</TableCell>
                  <TableCell>Risk Score</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suspicious.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="textSecondary">No suspicious activities detected</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  suspicious.map((activity, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatTimestamp(activity.timestamp)}</TableCell>
                      <TableCell>
                        <Chip label={activity.activity_type} size="small" color="warning" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={activity.risk_score} 
                          color={activity.risk_score > 7 ? 'error' : 'warning'}
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>{activity.ip_address || 'N/A'}</TableCell>
                      <TableCell>{activity.user_id || 'Anonymous'}</TableCell>
                      <TableCell>{activity.reason}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Blocked IPs Tab */}
        {activeTab === 2 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Blocked Since</TableCell>
                  <TableCell>Expires At</TableCell>
                  <TableCell>Attempts</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {blockedIPs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="textSecondary">No blocked IPs</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  blockedIPs.map((ip, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Chip label={ip.ip_address} icon={<BlockIcon />} color="error" />
                      </TableCell>
                      <TableCell>{ip.reason}</TableCell>
                      <TableCell>{formatTimestamp(ip.blocked_at)}</TableCell>
                      <TableCell>{formatTimestamp(ip.expires_at)}</TableCell>
                      <TableCell>
                        <Chip label={ip.attempts} size="small" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Anomalies Tab */}
        {activeTab === 3 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Anomaly Type</TableCell>
                  <TableCell>Confidence</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {anomalies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="textSecondary">No anomalies detected</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  anomalies.map((anomaly, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatTimestamp(anomaly.timestamp)}</TableCell>
                      <TableCell>
                        <Chip label={anomaly.anomaly_type} size="small" color="error" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`${(anomaly.confidence * 100).toFixed(0)}%`} 
                          color={anomaly.confidence > 0.8 ? 'error' : 'warning'}
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>{anomaly.ip_address || 'N/A'}</TableCell>
                      <TableCell>{anomaly.description}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Event Detail Dialog */}
        <Dialog 
          open={eventDetailOpen} 
          onClose={() => setEventDetailOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Security Event Details</DialogTitle>
          <DialogContent>
            {selectedEvent && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Event ID
                    </Typography>
                    <Typography variant="body1">{selectedEvent.id}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Timestamp
                    </Typography>
                    <Typography variant="body1">
                      {formatTimestamp(selectedEvent.timestamp)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Event Type
                    </Typography>
                    <Chip label={selectedEvent.event_type} size="small" />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Severity
                    </Typography>
                    <Chip 
                      label={selectedEvent.severity} 
                      color={getSeverityColor(selectedEvent.severity)}
                      size="small" 
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      IP Address
                    </Typography>
                    <Typography variant="body1">
                      {selectedEvent.ip_address || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      User ID
                    </Typography>
                    <Typography variant="body1">
                      {selectedEvent.user_id || 'Anonymous'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Description
                    </Typography>
                    <Typography variant="body1">
                      {selectedEvent.description || 'No description'}
                    </Typography>
                  </Grid>
                  {selectedEvent.details && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Additional Details
                      </Typography>
                      <Paper sx={{ p: 2, bgcolor: 'grey.100', mt: 1 }}>
                        <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                          {JSON.stringify(selectedEvent.details, null, 2)}
                        </pre>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEventDetailOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionGate>
  );
};

export default SecurityDashboard;

