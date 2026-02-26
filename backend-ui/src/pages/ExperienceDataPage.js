import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  Paper,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  TextField,
  Container,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Info as InfoIcon,
  Language as LanguageIcon,
} from '@mui/icons-material';
import DOMPurify from 'dompurify';
import { useSnackbar } from 'notistack';
import { experiencesApi, languagesApi } from '../services/api';
import PermissionGate from '../components/common/PermissionGate';
import ProseEditor from '../components/common/ProseEditor';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`experience-tabpanel-${index}`}
      aria-labelledby={`experience-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function ExperienceDataPage() {
  const { experienceId } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [experienceData, setExperienceData] = useState(null);

  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [languagesLoading, setLanguagesLoading] = useState(false);

  // Edit state
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [savingOverview, setSavingOverview] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [editedYears, setEditedYears] = useState('');
  const [languageTexts, setLanguageTexts] = useState({});
  const [selectedLanguageTab, setSelectedLanguageTab] = useState(0);

  const fetchExperienceData = useCallback(async () => {
    if (!experienceId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await experiencesApi.getExperienceById(experienceId);
      setExperienceData(response.data);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load experience';
      setError(msg);
      enqueueSnackbar(`Error: ${msg}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [experienceId, enqueueSnackbar]);

  const fetchLanguages = useCallback(async () => {
    setLanguagesLoading(true);
    try {
      const response = await languagesApi.getLanguages({ page: 1, page_size: 100 });
      const all = response.data?.items || response.data || [];
      setAvailableLanguages(all.filter(l => l.enabled === true || l.enabled === 1));
    } catch (_) {
      setAvailableLanguages([]);
    } finally {
      setLanguagesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExperienceData();
    fetchLanguages();
  }, [fetchExperienceData, fetchLanguages]);

  const getExperienceTitle = () => {
    if (!experienceData) return `Experience #${experienceId}`;
    return experienceData.code || `Experience #${experienceId}`;
  };

  const handleEditOverview = () => {
    if (!experienceData) return;
    setEditedCode(experienceData.code || '');
    setEditedYears(String(experienceData.years ?? ''));

    const texts = {};
    if (Array.isArray(experienceData.experience_texts)) {
      experienceData.experience_texts.forEach(t => {
        const langId = t.language_id || t.language?.id;
        if (langId) {
          texts[langId] = { name: t.name || '', description: t.description || '' };
        }
      });
    }
    setLanguageTexts(texts);
    setSelectedLanguageTab(0);
    setIsEditingOverview(true);
  };

  const handleCancelEditOverview = () => {
    setIsEditingOverview(false);
    setEditedCode('');
    setEditedYears('');
    setLanguageTexts({});
    setSelectedLanguageTab(0);
  };

  const handleSaveOverview = async () => {
    if (!editedCode.trim()) {
      enqueueSnackbar('Code is required', { variant: 'error' });
      return;
    }
    const years = parseInt(editedYears, 10);
    if (isNaN(years) || years < 0) {
      enqueueSnackbar('Years must be a non-negative number', { variant: 'error' });
      return;
    }
    if (Object.keys(languageTexts).length === 0) {
      enqueueSnackbar('At least one language translation is required', { variant: 'error' });
      return;
    }

    for (const [langId, text] of Object.entries(languageTexts)) {
      if (!text.name?.trim()) {
        const lang = availableLanguages.find(l => l.id === parseInt(langId));
        enqueueSnackbar(`Name is required for ${lang?.name || `Language ${langId}`}`, { variant: 'error' });
        return;
      }
    }

    try {
      setSavingOverview(true);
      const experience_texts = Object.entries(languageTexts).map(([langId, text]) => ({
        language_id: parseInt(langId),
        name: text.name.trim(),
        description: text.description?.trim() || '',
      }));

      await experiencesApi.updateExperience(experienceId, {
        code: editedCode.trim(),
        years,
        experience_texts,
      });

      enqueueSnackbar('Experience updated successfully', { variant: 'success' });
      setIsEditingOverview(false);
      await fetchExperienceData();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to update experience';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSavingOverview(false);
    }
  };

  return (
    <Container
      maxWidth={false}
      disableGutters
      sx={{ ml: 0, mr: 0, pl: { xs: 2, sm: 3 }, pr: { xs: 2, sm: 3 }, mt: 2, mb: 4 }}
    >
      <Paper>
        {/* Header */}
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="div">
            {getExperienceTitle()}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/experiences')}
          >
            Back to Experiences
          </Button>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
            <Tab icon={<InfoIcon />} label="Overview" />
          </Tabs>
        </Box>

        {/* Content */}
        <Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          ) : (
            <TabPanel value={tabValue} index={0}>
              <PermissionGate
                permission="VIEW_EXPERIENCES"
                showError
                errorMessage="You do not have permission to see Experience information."
              >
                <Box sx={{ mb: 3 }}>
                  {/* Overview header with Edit/Save/Cancel */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                      <InfoIcon sx={{ mr: 1 }} />
                      Overview
                    </Typography>
                    <PermissionGate permissions={['EDIT_EXPERIENCE', 'MANAGE_EXPERIENCES']}>
                      {!isEditingOverview ? (
                        <Button
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={handleEditOverview}
                          size="small"
                          disabled={!experienceData}
                        >
                          Edit
                        </Button>
                      ) : (
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="outlined"
                            onClick={handleCancelEditOverview}
                            disabled={savingOverview}
                            size="small"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="contained"
                            onClick={handleSaveOverview}
                            disabled={savingOverview}
                            size="small"
                          >
                            {savingOverview ? <CircularProgress size={18} /> : 'Save'}
                          </Button>
                        </Stack>
                      )}
                    </PermissionGate>
                  </Box>

                  <Card>
                    <CardContent>
                      <Grid container spacing={3}>
                        {/* ID */}
                        <Grid item xs={12} md={4}>
                          <Typography variant="subtitle2" color="text.secondary">ID</Typography>
                          <Typography variant="body1" sx={{ mb: 2 }}>{experienceData?.id || '-'}</Typography>
                        </Grid>

                        {/* Code */}
                        <Grid item xs={12} md={4}>
                          <Typography variant="subtitle2" color="text.secondary">Code</Typography>
                          {isEditingOverview ? (
                            <TextField
                              fullWidth
                              value={editedCode}
                              onChange={e => setEditedCode(e.target.value)}
                              size="small"
                              sx={{ mt: 1 }}
                              required
                            />
                          ) : (
                            <Typography variant="body1" sx={{ mb: 2 }}>{experienceData?.code || '-'}</Typography>
                          )}
                        </Grid>

                        {/* Years */}
                        <Grid item xs={12} md={4}>
                          <Typography variant="subtitle2" color="text.secondary">Years of Experience</Typography>
                          {isEditingOverview ? (
                            <TextField
                              fullWidth
                              type="number"
                              value={editedYears}
                              onChange={e => setEditedYears(e.target.value)}
                              size="small"
                              sx={{ mt: 1 }}
                              inputProps={{ min: 0 }}
                              required
                            />
                          ) : (
                            <Typography variant="body1" sx={{ mb: 2 }}>{experienceData?.years ?? '-'}</Typography>
                          )}
                        </Grid>

                        {/* Language Translations */}
                        <Grid item xs={12}>
                          <Divider sx={{ mb: 2 }} />
                          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                            Translations (Multilingual)
                          </Typography>

                          {isEditingOverview ? (
                            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                              {languagesLoading ? (
                                <Alert severity="info">Loading languages...</Alert>
                              ) : availableLanguages.length === 0 ? (
                                <Alert severity="warning">No enabled languages found.</Alert>
                              ) : (
                                <>
                                  <Tabs
                                    value={selectedLanguageTab}
                                    onChange={(_, v) => setSelectedLanguageTab(v)}
                                    variant="scrollable"
                                    scrollButtons="auto"
                                    sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
                                  >
                                    {availableLanguages.map((lang) => (
                                      <Tab
                                        key={lang.id}
                                        label={
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <LanguageIcon fontSize="small" />
                                            {lang.name}
                                            {languageTexts[lang.id] && (
                                              <Chip
                                                label="✓"
                                                size="small"
                                                color="success"
                                                sx={{ height: 16, minWidth: 16, '& .MuiChip-label': { px: 0.5 } }}
                                              />
                                            )}
                                          </Box>
                                        }
                                      />
                                    ))}
                                  </Tabs>

                                  {availableLanguages.map((lang, index) => (
                                    <Box
                                      key={lang.id}
                                      sx={{ display: selectedLanguageTab === index ? 'block' : 'none' }}
                                    >
                                      <Stack spacing={2}>
                                        <TextField
                                          fullWidth
                                          label={`Name (${lang.name})`}
                                          value={languageTexts[lang.id]?.name || ''}
                                          onChange={e => setLanguageTexts({
                                            ...languageTexts,
                                            [lang.id]: { ...languageTexts[lang.id], name: e.target.value },
                                          })}
                                          placeholder={`Enter experience name in ${lang.name}`}
                                          size="small"
                                          required
                                        />
                                        <Box>
                                          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                            Description ({lang.name})
                                          </Typography>
                                          <ProseEditor
                                            value={languageTexts[lang.id]?.description || ''}
                                            onChange={html => setLanguageTexts(prev => ({
                                              ...prev,
                                              [lang.id]: { ...prev[lang.id], description: html },
                                            }))}
                                            placeholder={`Enter experience description in ${lang.name}`}
                                          />
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                          {!languageTexts[lang.id] && (
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              onClick={() => setLanguageTexts({
                                                ...languageTexts,
                                                [lang.id]: { name: '', description: '' },
                                              })}
                                            >
                                              Add {lang.name} Translation
                                            </Button>
                                          )}
                                          {languageTexts[lang.id] && (
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              color="error"
                                              onClick={() => {
                                                const next = { ...languageTexts };
                                                delete next[lang.id];
                                                setLanguageTexts(next);
                                              }}
                                            >
                                              Remove {lang.name}
                                            </Button>
                                          )}
                                        </Box>
                                      </Stack>
                                    </Box>
                                  ))}
                                </>
                              )}
                            </Box>
                          ) : (
                            <Box>
                              {experienceData?.experience_texts?.length > 0 ? (
                                experienceData.experience_texts.map((text, index) => {
                                  const langName = text.language?.name || `Language ${text.language_id}`;
                                  return (
                                    <Box
                                      key={text.language_id || index}
                                      sx={{
                                        mb: 2,
                                        pb: 2,
                                        borderBottom: index < experienceData.experience_texts.length - 1 ? 1 : 0,
                                        borderColor: 'divider',
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <LanguageIcon fontSize="small" color="primary" />
                                        <Typography variant="subtitle2" color="primary">{langName}</Typography>
                                      </Box>
                                      <Typography variant="body2" color="text.secondary">Name:</Typography>
                                      <Typography variant="body1" sx={{ mb: 1 }}>{text.name || '-'}</Typography>
                                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Description:</Typography>
                                      {text.description ? (
                                        <Box
                                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(text.description) }}
                                          sx={{
                                            fontSize: '0.9375rem',
                                            lineHeight: 1.7,
                                            color: 'text.primary',
                                            '& h1,& h2,& h3,& h4,& h5,& h6': { fontWeight: 700, mt: 2, mb: 1 },
                                            '& h1': { fontSize: '1.4rem' },
                                            '& h2': { fontSize: '1.2rem' },
                                            '& h3': { fontSize: '1.05rem' },
                                            '& p': { mt: 0, mb: 1 },
                                            '& ul': { pl: 3, mb: 1, listStyleType: 'disc' },
                                            '& ol': { pl: 3, mb: 1, listStyleType: 'decimal' },
                                            '& li': { mb: 0.5 },
                                            '& a': { color: 'primary.main', textDecoration: 'underline', '&:hover': { opacity: 0.8 } },
                                            '& blockquote': { borderLeft: '3px solid', borderColor: 'primary.light', pl: 2, ml: 0, my: 1.5, color: 'text.secondary', fontStyle: 'italic' },
                                            '& .prose-image-remove, & .prose-image-resize, & .prose-code-actions, & .prose-code-header button': {
                                              display: 'none !important',
                                            },
                                            '& .prose-code-pre button, & pre button, & code button': {
                                              display: 'none !important',
                                            },
                                            '& .prose-code-block': {
                                              my: 1.5,
                                              border: '1px solid rgba(148,163,184,0.45)',
                                              borderRadius: 1,
                                              overflow: 'hidden',
                                            },
                                            '& .prose-code-header': {
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              px: 1,
                                              py: 0.5,
                                              bgcolor: '#111827',
                                              borderBottom: '1px solid rgba(148,163,184,0.35)',
                                            },
                                            '& .prose-code-lang': {
                                              fontSize: '0.75rem',
                                              fontWeight: 700,
                                              letterSpacing: '0.02em',
                                              textTransform: 'uppercase',
                                              color: '#e5e7eb',
                                            },
                                            '& .prose-code-pre': {
                                              m: 0,
                                              p: 1.5,
                                              bgcolor: '#020617',
                                              overflowX: 'auto',
                                            },
                                            '& .prose-code-pre code': {
                                              color: '#e5e7eb',
                                              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                                              fontSize: '0.84rem',
                                              lineHeight: 1.6,
                                              whiteSpace: 'pre',
                                              backgroundColor: 'transparent',
                                              p: 0,
                                            },
                                            '& pre': { bgcolor: '#020617', p: 1.5, borderRadius: 1, overflowX: 'auto', my: 1.5 },
                                            '& code': { bgcolor: 'rgba(0,0,0,0.06)', px: 0.5, borderRadius: 0.5, fontFamily: 'monospace', fontSize: '0.875em' },
                                            '& pre code': { bgcolor: 'transparent', p: 0, color: '#e5e7eb' },
                                            '& code .token.comment, & code .token.prolog, & code .token.doctype, & code .token.cdata': { color: '#6a9955', fontStyle: 'italic' },
                                            '& code .token.punctuation': { color: '#ffd700' },
                                            '& code .token.property, & code .token.tag, & code .token.boolean, & code .token.number, & code .token.constant, & code .token.symbol, & code .token.deleted': { color: '#b5cea8' },
                                            '& code .token.selector, & code .token.attr-name, & code .token.string, & code .token.char, & code .token.builtin, & code .token.inserted': { color: '#ce9178' },
                                            '& code .token.operator, & code .token.entity, & code .token.url, & code .token.variable': { color: '#d4d4d4' },
                                            '& code .token.atrule, & code .token.attr-value, & code .token.keyword': { color: '#569cd6' },
                                            '& code .token.function, & code .token.class-name': { color: '#dcdcaa' },
                                            '& code .token.regex, & code .token.important': { color: '#d16969' },
                                            '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1, my: 1 },
                                            '& hr': { border: 'none', borderTop: '1px solid', borderColor: 'divider', my: 2 },
                                          }}
                                        />
                                      ) : (
                                        <Typography variant="body1" color="text.secondary">No description provided</Typography>
                                      )}
                                    </Box>
                                  );
                                })
                              ) : (
                                <Typography variant="body1" color="text.secondary">No translations available</Typography>
                              )}
                            </Box>
                          )}
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 3 }} />

                      {/* Quick Stats */}
                      <Typography variant="h6" sx={{ mb: 2 }}>Quick Stats</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={4} md={3}>
                          <Paper sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                              {experienceData?.experience_texts?.length ?? 0}
                            </Typography>
                            <Typography variant="caption">Languages</Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={3}>
                          <Paper sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h4" color="primary">
                              {experienceData?.years ?? 0}
                            </Typography>
                            <Typography variant="caption">Years</Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Box>
              </PermissionGate>
            </TabPanel>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

export default ExperienceDataPage;
