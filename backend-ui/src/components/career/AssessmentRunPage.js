import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Tabs, Tab, Typography, LinearProgress, Skeleton, Accordion,
  AccordionSummary, AccordionDetails, Alert, Chip, Card, CardContent,
  Grid, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress,
  List, ListItem, ListItemText, Paper
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
    case 'BEST_FIT': return 'success';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getBannerConfig = (readiness, criticalCount, highCount) => {
  if (readiness == null) {
    return {
      label: 'ASSESSMENT IN PROGRESS',
      sublabel: 'Computing your readiness score…',
      borderColor: 'info.main',
      gradientColor: 'rgba(2,136,209,0.10)',
      narrative: null,
    };
  }
  if (readiness >= 80) {
    return {
      label: 'STRONG MATCH — READY TO APPLY',
      sublabel: `${Math.round(readiness)}% overall readiness`,
      borderColor: 'success.main',
      gradientColor: 'rgba(46,125,50,0.12)',
      narrative:
        criticalCount === 0
          ? `Your profile covers the required skills with strong evidence. You are in a competitive position for these roles. Focus on tailoring your resume and preparing for behavioral interviews.`
          : `You have strong overall coverage but ${criticalCount} critical gap${criticalCount > 1 ? 's' : ''} that could hold you back. Address ${criticalCount > 1 ? 'them' : 'it'} before applying to maximize your offer rate.`,
    };
  }
  if (readiness >= 60) {
    return {
      label: 'COMPETITIVE — GAPS TO CLOSE',
      sublabel: `${Math.round(readiness)}% overall readiness`,
      borderColor: 'warning.main',
      gradientColor: 'rgba(237,108,2,0.10)',
      narrative:
        `At ${Math.round(readiness)}% readiness you are a competitive candidate, but ${criticalCount} critical and ${highCount} high-priority gap${criticalCount + highCount !== 1 ? 's' : ''} are reducing your fit score. ` +
        `Closing the critical gaps first will have the highest impact on interview conversion rates.`,
    };
  }
  if (readiness >= 40) {
    return {
      label: 'POSSIBLE WITH FOCUSED WORK',
      sublabel: `${Math.round(readiness)}% overall readiness`,
      borderColor: 'warning.main',
      gradientColor: 'rgba(237,108,2,0.10)',
      narrative:
        `These roles are reachable with a structured 8–12 week preparation plan. Your ${Math.round(readiness)}% readiness reflects real experience, but significant gaps exist. ` +
        `Prioritize CRITICAL skills — they are the primary reason your applications may not advance to interviews.`,
    };
  }
  return {
    label: 'ASPIRATIONAL — SIGNIFICANT DEVELOPMENT NEEDED',
    sublabel: `${Math.round(readiness)}% overall readiness`,
    borderColor: 'error.main',
    gradientColor: 'rgba(183,28,28,0.10)',
    narrative:
      `These are stretch roles that require substantial skill development before you are competitive. ` +
      `Use this assessment as a 6–12 month roadmap. Start with the CRITICAL gaps — closing even 2–3 of them can dramatically improve your fit score.`,
  };
};

const StatCard = ({ label, value, sub, valueColor }) => (
  <Paper
    variant="outlined"
    sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 0.5 }}
  >
    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="h5" fontWeight={700} sx={valueColor ? { color: valueColor } : {}}>
      {value ?? '—'}
    </Typography>
    {sub && (
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
        {sub}
      </Typography>
    )}
  </Paper>
);

// ─── Tab 1: Overview ─────────────────────────────────────────────────────────
const OverviewTab = ({ run, scorecard, jobFit, resumeIssues, actionPlan, aiStatus, error }) => {
  if (!run) return <CircularProgress />;

  const readiness = scorecard?.overall_readiness ?? null;
  const allSkills = scorecard?.skills || [];
  const criticalSkills = allSkills.filter((s) => s.priority === 'CRITICAL');
  const highSkills = allSkills.filter((s) => s.priority === 'HIGH');
  // Any skill with at least one project (level > 0), sorted best first
  const strongSkills = [...allSkills]
    .sort((a, b) => (b.level || 0) - (a.level || 0))
    .filter((s) => (s.level || 0) > 0);
  const bottlenecks = sortedSkills(allSkills)
    .filter((s) => ['CRITICAL', 'HIGH'].includes(s.priority))
    .slice(0, 3);

  const jobs = jobFit?.jobs || [];
  const bestFitJob = [...jobs].sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0))[0];

  const banner = getBannerConfig(readiness, criticalSkills.length, highSkills.length);

  // Next steps: prefer first 3 action plan items, fall back to top resume issues
  const nextSteps = [];
  if (actionPlan && actionPlan.length > 0) {
    actionPlan.slice(0, 3).forEach((item) => {
      nextSteps.push(item.focus || item.tasks?.[0] || '');
    });
  } else if (resumeIssues && resumeIssues.length > 0) {
    resumeIssues
      .filter((i) => ['CRITICAL', 'HIGH'].includes(i.impact))
      .slice(0, 3)
      .forEach((issue) => nextSteps.push(issue.fix || issue.issue));
  }

  // Top skills with any project evidence (up to 4)
  const topStrong = strongSkills.filter((s) => s.evidence && s.evidence !== '—').slice(0, 4);

  return (
    <Box>
      {/* ── Banner ── */}
      <Box
        sx={{
          borderLeft: '4px solid',
          borderLeftColor: banner.borderColor,
          background: banner.gradientColor,
          borderRadius: 1,
          p: 2.5,
          mb: 3,
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={800}
          sx={{ color: banner.borderColor, mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}
        >
          Readiness Assessment:{' '}
          <Box component="span" sx={{ color: banner.borderColor }}>
            {banner.label}
          </Box>
        </Typography>
        {banner.narrative && (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {banner.narrative}{' '}
            {bestFitJob && (
              <>
                <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Best-fit role: {bestFitJob.job_title} at {bestFitJob.company}
                </Box>{' '}
                ({Math.round(bestFitJob.fit_score ?? 0)}% match).
              </>
            )}
          </Typography>
        )}
      </Box>

      {/* ── 6 Stat Cards ── */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={4}>
          <StatCard
            label="Overall Readiness"
            value={readiness != null ? `${Math.round(readiness)}%` : '—'}
            sub={
              readiness != null
                ? readiness >= 60
                  ? 'Competitive profile'
                  : readiness >= 40
                  ? 'Development needed'
                  : 'Significant gaps remain'
                : 'Computing…'
            }
            valueColor={readiness != null ? readinessColor(readiness) : undefined}
          />
        </Grid>

        <Grid item xs={6} sm={4}>
          <StatCard
            label="Best Fit JD Match"
            value={bestFitJob ? `${Math.round(bestFitJob.fit_score ?? 0)}%` : `${jobs.length} jobs`}
            sub={
              bestFitJob
                ? `${bestFitJob.job_title} — ${bestFitJob.company}`
                : jobs.length === 0
                ? 'No job data yet'
                : undefined
            }
          />
        </Grid>

        <Grid item xs={6} sm={4}>
          <StatCard
            label="Critical Gaps"
            value={criticalSkills.length}
            sub={
              criticalSkills.length > 0
                ? criticalSkills
                    .slice(0, 2)
                    .map((s) => s.skill_name || s.name)
                    .join(' + ') + (criticalSkills.length > 2 ? ` +${criticalSkills.length - 2} more` : '')
                : 'No critical gaps — great coverage'
            }
            valueColor={criticalSkills.length > 0 ? 'error.main' : 'success.main'}
          />
        </Grid>

        <Grid item xs={6} sm={4}>
          <StatCard
            label="Jobs Evaluated"
            value={jobs.length}
            sub={
              jobs.length > 0
                ? (() => {
                    const bestFitCount = jobs.filter((j) => j.verdict === 'BEST_FIT').length;
                    const stretchCount = jobs.filter((j) => j.verdict === 'STRETCH').length;
                    const parts = [];
                    if (bestFitCount) parts.push(`${bestFitCount} best fit`);
                    if (stretchCount) parts.push(`${stretchCount} stretch`);
                    return parts.join(', ') || 'All aspirational';
                  })()
                : 'No job fit data'
            }
          />
        </Grid>

        <Grid item xs={6} sm={4}>
          <StatCard
            label="Skills Assessed"
            value={allSkills.length}
            sub={
              allSkills.length > 0
                ? `${strongSkills.length} with strong evidence, ${criticalSkills.length + highSkills.length} gaps`
                : 'No skill data yet'
            }
          />
        </Grid>

        <Grid item xs={6} sm={4}>
          <StatCard
            label="Key Strength"
            value={strongSkills[0] ? strongSkills[0].skill_name || strongSkills[0].name : '—'}
            sub={
              strongSkills[0]
                ? `Level ${strongSkills[0].level}/5 · ${strongSkills[0].evidence || 'evidence in portfolio'}`
                : allSkills.length > 0
                ? 'No skills linked to projects yet'
                : 'No skill data yet'
            }
          />
        </Grid>
      </Grid>

      {/* ── Skills with Evidence ── */}
      {topStrong.length > 0 && (
        <Box
          sx={{
            borderLeft: '4px solid',
            borderLeftColor: 'success.main',
            background: 'rgba(46,125,50,0.07)',
            borderRadius: 1,
            p: 2.5,
            mb: 3,
          }}
        >
          <Typography
            variant="subtitle2"
            fontWeight={800}
            sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.5, color: 'success.main' }}
          >
            {topStrong[0]?.level >= 3 ? 'Your Biggest Assets' : 'Skills With Portfolio Evidence'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {topStrong[0]?.level >= 3
              ? 'These skills have strong project evidence and set you apart.'
              : `These ${topStrong.length} skill${topStrong.length !== 1 ? 's' : ''} appear in your projects — link more projects to each skill to raise the evidence level and improve your fit score.`}
          </Typography>
          {topStrong.map((s, i) => (
            <Box key={s.skill_id || i} display="flex" alignItems="flex-start" gap={1.5} mb={i < topStrong.length - 1 ? 1.5 : 0}>
              <Box sx={{ minWidth: 52, pt: 0.25 }}>
                <LinearProgress
                  variant="determinate"
                  value={(s.level || 0) * 20}
                  sx={{ height: 6, borderRadius: 3 }}
                  color={s.level >= 3 ? 'success' : s.level >= 2 ? 'warning' : 'info'}
                />
                <Typography variant="caption" color="text.secondary">{s.level}/5</Typography>
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={700} sx={{ color: 'text.primary' }}>
                  {s.skill_name || s.name}
                </Typography>
                {s.evidence && s.evidence !== '—' && (
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                    {s.evidence}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* ── Top 3 Bottlenecks ── */}
      {bottlenecks.length > 0 && (
        <Box
          sx={{
            borderLeft: '4px solid',
            borderLeftColor: 'error.main',
            background: 'rgba(183,28,28,0.07)',
            borderRadius: 1,
            p: 2.5,
            mb: 3,
          }}
        >
          <Typography
            variant="subtitle2"
            fontWeight={800}
            sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}
          >
            Top {bottlenecks.length} Bottlenecks{' '}
            <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', textTransform: 'none', fontSize: '0.75rem' }}>
              (ranked by impact)
            </Box>
          </Typography>
          {bottlenecks.map((skill, i) => (
            <Box key={skill.skill_id || i} display="flex" gap={2} mb={i < bottlenecks.length - 1 ? 2 : 0}>
              <Box
                sx={{
                  minWidth: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: i === 0 ? 'error.main' : i === 1 ? 'warning.main' : 'text.disabled',
                  bgcolor: i === 0 ? 'error.main' : i === 1 ? 'warning.main' : 'action.disabled',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mt: 0.25,
                  flexShrink: 0,
                }}
              >
                <Typography variant="caption" fontWeight={700} sx={{ color: '#fff' }}>
                  {i + 1}
                </Typography>
              </Box>
              <Box>
                <Box display="flex" alignItems="center" gap={1} mb={0.25}>
                  <Typography variant="body2" fontWeight={700}>
                    {skill.skill_name || skill.name}
                  </Typography>
                  <Chip label={skill.priority} size="small" color={priorityColor(skill.priority)} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  {skill.gap || skill.evidence || '—'}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* ── Immediate Next Steps ── */}
      {(nextSteps.length > 0 || (['pending', 'running'].includes(aiStatus) && !error)) && (
        <Box
          sx={{
            borderLeft: '4px solid',
            borderLeftColor: 'info.main',
            background: 'rgba(2,136,209,0.07)',
            borderRadius: 1,
            p: 2.5,
          }}
        >
          <Typography
            variant="subtitle2"
            fontWeight={800}
            sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5, color: 'info.main' }}
          >
            Immediate Next Steps
          </Typography>
          {['pending', 'running'].includes(aiStatus) && !error && nextSteps.length === 0 ? (
            <Box display="flex" alignItems="center" gap={1}>
              <CircularProgress size={14} />
              <Typography variant="body2" color="text.secondary">
                AI is generating your personalised action plan…
              </Typography>
            </Box>
          ) : (
            <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
              {nextSteps.map((step, i) => (
                <Box component="li" key={i} sx={{ mb: 0.75 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {step}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
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
                <Typography variant="h6">{jobEntry.job_title}</Typography>
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
            {(jobEntry.scorecard || []).length > 0 && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Skill</TableCell>
                    <TableCell>Level</TableCell>
                    <TableCell>Priority</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedSkills(jobEntry.scorecard).map((skill, j) => (
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

// ─── Helpers: grouping ────────────────────────────────────────────────────────

/** Group an array of items by their `job` field. Items without a `job` field
 *  are placed under a "General" key. Returns an ordered array of
 *  [jobLabel, items[]] pairs so rendering order is deterministic. */
const groupByJob = (items) => {
  const map = {};
  const order = [];
  for (const item of items) {
    const key = (item.job || 'General').trim();
    if (!map[key]) { map[key] = []; order.push(key); }
    map[key].push(item);
  }
  return order.map((k) => [k, map[k]]);
};

const JobGroupHeader = ({ label, count }) => (
  <Box
    display="flex"
    alignItems="center"
    gap={1.5}
    sx={{ mt: 3, mb: 1.5, pb: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}
  >
    <Typography variant="subtitle1" fontWeight={700}>
      {label}
    </Typography>
    <Chip label={`${count} item${count !== 1 ? 's' : ''}`} size="small" variant="outlined" />
  </Box>
);

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

  // Detect whether job grouping is available (at least one item has a `job` field)
  const hasJobField = resumeIssues.some((i) => i.job);
  const groups = hasJobField ? groupByJob(resumeIssues) : [['All Issues', resumeIssues]];

  return (
    <Box>
      {!hasJobField && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This run was generated before per-job grouping was available. Create a new assessment run to see resume issues grouped by job.
        </Alert>
      )}
      {groups.map(([jobLabel, issues], gi) => (
        <Box key={jobLabel}>
          {(hasJobField || groups.length > 1) && (
            <JobGroupHeader label={jobLabel} count={issues.length} />
          )}
          {issues.map((issue, i) => (
            <Accordion key={`${gi}-${i}`} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1} flex={1} pr={1}>
                  <Typography flex={1} variant="body2">
                    {issue.title || issue.issue}
                  </Typography>
                  {issue.impact && (
                    <Chip
                      label={issue.impact}
                      size="small"
                      color={
                        issue.impact === 'CRITICAL' || issue.impact === 'HIGH'
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
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {issue.fix || issue.description || '—'}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
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

  const hasJobField = actionPlan.some((i) => i.job);
  const groups = hasJobField ? groupByJob(actionPlan) : [['Action Plan', actionPlan]];

  return (
    <Box>
      {!hasJobField && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This run was generated before per-job grouping was available. Create a new assessment run to see the action plan grouped by job.
        </Alert>
      )}
      {groups.map(([jobLabel, items], gi) => (
        <Box key={jobLabel}>
          {(hasJobField || groups.length > 1) && (
            <JobGroupHeader label={jobLabel} count={items.length} />
          )}
          <Box display="flex" flexDirection="column" gap={2} mb={1}>
            {items.map((item, i) => (
              <Card key={`${gi}-${i}`} variant="outlined">
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
        </Box>
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
        <OverviewTab
          run={run}
          scorecard={scorecard}
          jobFit={jobFit}
          resumeIssues={resumeIssues}
          actionPlan={actionPlan}
          aiStatus={aiStatus}
          error={error}
        />
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
