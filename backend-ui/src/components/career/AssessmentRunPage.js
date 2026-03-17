import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Tabs, Tab, Typography, LinearProgress, Skeleton, Accordion,
  AccordionSummary, AccordionDetails, Alert, Chip, Card, CardContent,
  Grid, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress,
  List, ListItem, ListItemText, Badge, Paper
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useAssessmentRun } from '../../hooks/useAssessmentRun';

const TabPanel = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const priorityColor = (priority) => {
  switch (priority) {
    case 'CRITICAL': return 'error';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'info';
    case 'LOW': return 'success';
    default: return 'default';
  }
};

const verdictColor = (verdict) => {
  switch (verdict) {
    case 'BEST_FIT': return 'info';
    case 'STRETCH': return 'warning';
    case 'ASPIRATIONAL': return 'error';
    default: return 'default';
  }
};

const readinessColor = (score) => {
  if (score >= 60) return 'success.main';
  if (score >= 40) return 'warning.main';
  return 'error.main';
};

const sortedSkills = (skills) =>
  [...(skills || [])].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );

// ─── Tab 1: Overview ─────────────────────────────────────────────────────────
const OverviewTab = ({ run, scorecard, jobFit }) => {
  if (!run) return <CircularProgress />;

  const readiness = run.readiness_score ?? scorecard?.readiness_score ?? null;
  const allSkills = scorecard?.skills || [];
  const skillGaps = allSkills.filter((s) => (s.level ?? 0) < 3);
  const criticalGaps = allSkills.filter((s) => s.priority === 'CRITICAL');
  const bottlenecks = sortedSkills(allSkills)
    .filter((s) => ['CRITICAL', 'HIGH'].includes(s.priority))
    .slice(0, 3);

  const verdict = jobFit?.overall_verdict || run.overall_verdict;

  return (
    <Box>
      {/* Readiness score */}
      <Box textAlign="center" mb={3}>
        <Typography
          variant="h2"
          sx={{ color: readiness != null ? readinessColor(readiness) : 'text.secondary', fontWeight: 700 }}
        >
          {readiness != null ? `${Math.round(readiness)}%` : '—'}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Overall Readiness
        </Typography>
      </Box>

      {/* Verdict */}
      {verdict && (
        <Alert severity={verdictColor(verdict) === 'error' ? 'error' : verdictColor(verdict) === 'warning' ? 'warning' : 'info'} sx={{ mb: 2 }}>
          Verdict: <strong>{verdict.replace('_', ' ')}</strong>
        </Alert>
      )}

      {/* Stats grid */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4">{(jobFit?.jobs || scorecard?.jobs || []).length}</Typography>
            <Typography variant="body2" color="text.secondary">Jobs Evaluated</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4">{skillGaps.length}</Typography>
            <Typography variant="body2" color="text.secondary">Skill Gaps</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4">{criticalGaps.length}</Typography>
            <Typography variant="body2" color="text.secondary">Critical Gaps</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Top bottlenecks */}
      {bottlenecks.length > 0 && (
        <Box>
          <Typography variant="subtitle1" mb={1}>Top Bottlenecks</Typography>
          <List dense>
            {bottlenecks.map((skill, i) => (
              <ListItem key={skill.skill_id || i} sx={{ pl: 0 }}>
                <ListItemText
                  primary={skill.skill_name || skill.name}
                  secondary={skill.gap}
                />
                <Chip
                  label={skill.priority}
                  size="small"
                  color={priorityColor(skill.priority)}
                  sx={{ ml: 1 }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
};

// ─── Tab 2: Skills Scorecard ──────────────────────────────────────────────────
const ScorecardTab = ({ scorecard }) => {
  if (!scorecard) {
    return (
      <Box>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={48} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  }

  const skills = sortedSkills(scorecard.skills || []);

  if (skills.length === 0) {
    return <Typography color="text.secondary">No skills data available.</Typography>;
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Skill</TableCell>
          <TableCell sx={{ width: 160 }}>Level</TableCell>
          <TableCell>Priority</TableCell>
          <TableCell>Evidence</TableCell>
          <TableCell>Gap</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {skills.map((skill, i) => (
          <TableRow key={skill.skill_id || i}>
            <TableCell>{skill.skill_name || skill.name}</TableCell>
            <TableCell>
              <Box display="flex" alignItems="center" gap={1}>
                <LinearProgress
                  variant="determinate"
                  value={(skill.level || 0) * 20}
                  sx={{ flex: 1, height: 8, borderRadius: 4 }}
                  color={skill.level >= 3 ? 'success' : 'warning'}
                />
                <Typography variant="caption">{skill.level ?? '?'}/5</Typography>
              </Box>
            </TableCell>
            <TableCell>
              <Chip
                label={skill.priority || 'N/A'}
                size="small"
                color={priorityColor(skill.priority)}
              />
            </TableCell>
            <TableCell>
              <Typography variant="body2">{skill.evidence || '—'}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2">{skill.gap || '—'}</Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

// ─── Tab 3: Job Fit Analysis ──────────────────────────────────────────────────
const JobFitTab = ({ jobFit }) => {
  if (!jobFit) {
    return (
      <Box>
        {[1, 2].map((i) => (
          <Skeleton key={i} height={120} sx={{ mb: 2 }} />
        ))}
      </Box>
    );
  }

  const jobs = jobFit.jobs || [];

  if (jobs.length === 0) {
    return <Typography color="text.secondary">No job fit data available.</Typography>;
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {jobs.map((jobEntry, i) => (
        <Card key={jobEntry.job_id || i} variant="outlined">
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Box>
                <Typography variant="h6">{jobEntry.title}</Typography>
                <Typography variant="body2" color="text.secondary">{jobEntry.company}</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h5" fontWeight={700}>
                  {jobEntry.fit_score != null ? `${Math.round(jobEntry.fit_score)}%` : '—'}
                </Typography>
                <Chip
                  label={jobEntry.verdict || 'N/A'}
                  size="small"
                  color={verdictColor(jobEntry.verdict)}
                />
              </Box>
            </Box>
            {(jobEntry.skills || []).length > 0 && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Skill</TableCell>
                    <TableCell>Level</TableCell>
                    <TableCell>Priority</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedSkills(jobEntry.skills).map((skill, j) => (
                    <TableRow key={skill.skill_id || j}>
                      <TableCell>{skill.skill_name || skill.name}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress
                            variant="determinate"
                            value={(skill.level || 0) * 20}
                            sx={{ width: 80, height: 6, borderRadius: 3 }}
                            color={skill.level >= 3 ? 'success' : 'warning'}
                          />
                          <Typography variant="caption">{skill.level ?? '?'}/5</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={skill.priority || 'N/A'}
                          size="small"
                          color={priorityColor(skill.priority)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

// ─── Tab 4: Resume Issues ─────────────────────────────────────────────────────
const ResumeIssuesTab = ({ aiStatus, resumeIssues, error }) => {
  if (error === 'timeout') {
    return (
      <Alert severity="warning">
        AI assessment is taking longer than expected. Please refresh the page later.
      </Alert>
    );
  }

  if (['pending', 'running'].includes(aiStatus)) {
    return (
      <Box>
        <LinearProgress sx={{ mb: 2 }} />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={64} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  }

  if (aiStatus === 'failed') {
    return (
      <Alert severity="error">AI analysis failed to complete. Please try running the assessment again.</Alert>
    );
  }

  if (!resumeIssues || resumeIssues.length === 0) {
    return <Typography color="text.secondary">No resume issues identified.</Typography>;
  }

  return (
    <Box>
      {resumeIssues.map((issue, i) => (
        <Accordion key={issue.id || i}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1} flex={1}>
              <Typography flex={1}>{issue.title || issue.issue}</Typography>
              {issue.impact && (
                <Chip
                  label={issue.impact}
                  size="small"
                  color={
                    issue.impact === 'HIGH'
                      ? 'error'
                      : issue.impact === 'MEDIUM'
                      ? 'warning'
                      : 'default'
                  }
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {issue.fix || issue.description || '—'}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

// ─── Tab 5: Action Plan ───────────────────────────────────────────────────────
const ActionPlanTab = ({ aiStatus, actionPlan, error }) => {
  if (error === 'timeout') {
    return (
      <Alert severity="warning">
        AI assessment is taking longer than expected. Please refresh the page later.
      </Alert>
    );
  }

  if (['pending', 'running'].includes(aiStatus)) {
    return (
      <Box>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={80} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  }

  if (aiStatus === 'failed') {
    return (
      <Alert severity="error">AI analysis failed to complete. Please try running the assessment again.</Alert>
    );
  }

  if (!actionPlan || actionPlan.length === 0) {
    return <Typography color="text.secondary">No action plan generated.</Typography>;
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {actionPlan.map((item, i) => (
        <Card key={i} variant="outlined">
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
              <Box>
                {item.week_range && (
                  <Typography variant="caption" color="text.secondary">
                    Week {item.week_range}
                  </Typography>
                )}
                <Typography variant="subtitle1" fontWeight={600}>
                  {item.focus}
                </Typography>
              </Box>
              {item.hours != null && (
                <Chip label={`${item.hours}h`} size="small" variant="outlined" />
              )}
            </Box>
            {(item.tasks || []).length > 0 && (
              <List dense sx={{ pl: 1 }}>
                {item.tasks.map((task, j) => (
                  <ListItem key={j} sx={{ pl: 0, py: 0.25 }}>
                    <ListItemText
                      primary={typeof task === 'string' ? task : task.description || task.task}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AssessmentRunPage = () => {
  const { runId } = useParams();
  const [tab, setTab] = useState(0);

  const { run, scorecard, jobFit, resumeIssues, actionPlan, loading, error, aiStatus } =
    useAssessmentRun(runId);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && error !== 'timeout') {
    return (
      <Box p={3}>
        <Alert severity="error">Failed to load assessment run: {error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box mb={2}>
        <Typography variant="h5">
          {run?.name || `Assessment Run ${runId}`}
        </Typography>
        {run?.created_at && (
          <Typography variant="body2" color="text.secondary">
            {new Date(run.created_at).toLocaleString()}
          </Typography>
        )}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Overview" />
        <Tab label="Skills Scorecard" />
        <Tab label="Job Fit Analysis" />
        <Tab label="Resume Issues" />
        <Tab label="Action Plan" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <OverviewTab run={run} scorecard={scorecard} jobFit={jobFit} />
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <ScorecardTab scorecard={scorecard} />
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <JobFitTab jobFit={jobFit} />
      </TabPanel>

      <TabPanel value={tab} index={3}>
        <ResumeIssuesTab aiStatus={aiStatus} resumeIssues={resumeIssues} error={error} />
      </TabPanel>

      <TabPanel value={tab} index={4}>
        <ActionPlanTab aiStatus={aiStatus} actionPlan={actionPlan} error={error} />
      </TabPanel>
    </Box>
  );
};

export default AssessmentRunPage;
