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
  CardActions,
  Grid,
  TextField,
  Container,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Info as InfoIcon,
  Language as LanguageIcon,
  PhotoLibrary as PhotoLibraryIcon,
  AttachFile as AttachFileIcon,
  Folder as ProjectsIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { sectionsApi, languagesApi, api } from '../services/api';
import PermissionGate from '../components/common/PermissionGate';
import SERVER_URL from '../components/common/BackendServerData';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`section-tabpanel-${index}`}
      aria-labelledby={`section-tab-${index}`}
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

function SectionDataPage() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sectionData, setSectionData] = useState(null);

  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [languagesLoading, setLanguagesLoading] = useState(false);

  // Overview edit state
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [savingOverview, setSavingOverview] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [editedDisplayStyle, setEditedDisplayStyle] = useState('bordered');
  const [languageTexts, setLanguageTexts] = useState({});
  const [selectedLanguageTab, setSelectedLanguageTab] = useState(0);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Projects tab state
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [relatedProjects, setRelatedProjects] = useState([]);

  // Attachment download state
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchSectionData = useCallback(async () => {
    if (!sectionId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await sectionsApi.getSectionById(sectionId);
      setSectionData(response.data);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load section';
      setError(msg);
      enqueueSnackbar(`Error: ${msg}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [sectionId, enqueueSnackbar]);

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

  const fetchRelatedProjects = useCallback(async () => {
    if (projectsLoaded) return;
    setProjectsLoading(true);
    try {
      const response = await api.get('/api/projects/', {
        params: { include_full_details: true, page: 1, page_size: 200 }
      });
      const allProjects = response.data?.items || response.data || [];
      const sid = parseInt(sectionId, 10);
      const filtered = allProjects.filter(p =>
        Array.isArray(p.sections) && p.sections.some(s => s.id === sid)
      );
      setRelatedProjects(filtered);
      setProjectsLoaded(true);
    } catch (_) {
      setRelatedProjects([]);
      setProjectsLoaded(true);
    } finally {
      setProjectsLoading(false);
    }
  }, [sectionId, projectsLoaded]);

  useEffect(() => {
    fetchSectionData();
    fetchLanguages();
  }, [fetchSectionData, fetchLanguages]);

  // Load projects lazily when Projects tab is selected
  useEffect(() => {
    if (tabValue === 3 && !projectsLoaded) {
      fetchRelatedProjects();
    }
  }, [tabValue, projectsLoaded, fetchRelatedProjects]);

  const getSectionTitle = () => {
    if (!sectionData) return `Section #${sectionId}`;
    return sectionData.code || `Section #${sectionId}`;
  };

  const getProjectTitle = (project) => {
    if (project.project_texts?.length > 0) {
      return project.project_texts[0].name || project.project_texts[0].title || `Project #${project.id}`;
    }
    return `Project #${project.id}`;
  };

  // ---- Overview edit handlers ----
  const handleEditOverview = () => {
    if (!sectionData) return;
    setEditedCode(sectionData.code || '');
    setEditedDisplayStyle(sectionData.display_style || 'bordered');

    const texts = {};
    if (Array.isArray(sectionData.section_texts)) {
      sectionData.section_texts.forEach(t => {
        const langId = t.language_id || t.language?.id;
        if (langId) {
          texts[langId] = t.text || '';
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
    setEditedDisplayStyle('bordered');
    setLanguageTexts({});
    setSelectedLanguageTab(0);
  };

  const handleSaveOverview = async () => {
    if (!editedCode.trim()) {
      enqueueSnackbar('Code is required', { variant: 'error' });
      return;
    }
    if (Object.keys(languageTexts).length === 0) {
      enqueueSnackbar('At least one language translation is required', { variant: 'error' });
      return;
    }

    try {
      setSavingOverview(true);
      const section_texts = Object.entries(languageTexts).map(([langId, text]) => ({
        language_id: parseInt(langId),
        text: text || '',
      }));

      await sectionsApi.updateSection(sectionId, {
        code: editedCode.trim(),
        display_style: editedDisplayStyle,
        section_texts,
      });

      enqueueSnackbar('Section updated successfully', { variant: 'success' });
      setIsEditingOverview(false);
      await fetchSectionData();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to update section';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSavingOverview(false);
    }
  };

  // ---- Delete handlers ----
  const handleDeleteImage = (image) => {
    setItemToDelete(image);
    setDeleteType('image');
    setDeleteDialogOpen(true);
  };

  const handleDeleteAttachment = (attachment) => {
    setItemToDelete(attachment);
    setDeleteType('attachment');
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      setDeleting(true);
      if (deleteType === 'image') {
        await sectionsApi.deleteSectionImage(itemToDelete.id);
        enqueueSnackbar('Image deleted successfully', { variant: 'success' });
      } else if (deleteType === 'attachment') {
        await sectionsApi.deleteSectionAttachment(itemToDelete.id);
        enqueueSnackbar('Attachment deleted successfully', { variant: 'success' });
      }
      await fetchSectionData();
      handleDeleteCancel();
    } catch (err) {
      const msg = err.response?.data?.detail || `Failed to delete ${deleteType}`;
      enqueueSnackbar(`Error: ${msg}`, { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
    setDeleteType(null);
    setDeleting(false);
  };

  const buildAssetUrl = (pathValue) => {
    if (!pathValue) return null;
    if (pathValue.startsWith('http://') || pathValue.startsWith('https://')) {
      return pathValue;
    }
    if (pathValue.startsWith('/uploads/')) {
      return `${SERVER_URL}${pathValue}`;
    }
    if (pathValue.startsWith('uploads/')) {
      return `${SERVER_URL}/${pathValue}`;
    }
    if (pathValue.startsWith('static/')) {
      return `${SERVER_URL}/${pathValue}`;
    }
    return `${SERVER_URL}/static/${pathValue}`;
  };

  // ---- Attachment download ----
  const handleDownloadAttachment = async (attachment) => {
    if (!attachment) return;
    try {
      setDownloadingId(attachment.id);
      const url = buildAssetUrl(attachment.file_path);
      if (!url) {
        throw new Error('Invalid attachment path');
      }

      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();

      let filename = attachment.file_name || 'download';
      const disposition = response.headers.get('content-disposition');
      if (disposition) {
        const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
        if (match) filename = decodeURIComponent(match[1] || match[2] || filename);
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      enqueueSnackbar(`Error: ${err?.message || 'Failed to download file'}`, { variant: 'error' });
    } finally {
      setDownloadingId(null);
    }
  };

  const buildImageUrl = (image) => {
    if (!image?.image_path) return null;
    return buildAssetUrl(image.image_path);
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
            {getSectionTitle()}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/sections')}
          >
            Back to Sections
          </Button>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
            <Tab icon={<InfoIcon />} label="Overview" />
            <Tab icon={<PhotoLibraryIcon />} label={`Images (${sectionData?.images?.length ?? 0})`} />
            <Tab icon={<AttachFileIcon />} label={`Attachments (${sectionData?.attachments?.length ?? 0})`} />
            <Tab icon={<ProjectsIcon />} label="Projects" />
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
            <>
              {/* ---- OVERVIEW TAB ---- */}
              <TabPanel value={tabValue} index={0}>
                <PermissionGate
                  permission="VIEW_SECTIONS"
                  showError
                  errorMessage="You do not have permission to see Section information."
                >
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                        <InfoIcon sx={{ mr: 1 }} />
                        Overview
                      </Typography>
                      <PermissionGate permissions={['EDIT_SECTION', 'MANAGE_SECTIONS']}>
                        {!isEditingOverview ? (
                          <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={handleEditOverview}
                            size="small"
                            disabled={!sectionData}
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
                          <Grid item xs={12} md={3}>
                            <Typography variant="subtitle2" color="text.secondary">ID</Typography>
                            <Typography variant="body1" sx={{ mb: 2 }}>{sectionData?.id || '-'}</Typography>
                          </Grid>

                          {/* Code */}
                          <Grid item xs={12} md={5}>
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
                              <Typography variant="body1" sx={{ mb: 2 }}>{sectionData?.code || '-'}</Typography>
                            )}
                          </Grid>

                          {/* Display Style */}
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" color="text.secondary">Display Style</Typography>
                            {isEditingOverview ? (
                              <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                                <InputLabel>Display Style</InputLabel>
                                <Select
                                  value={editedDisplayStyle}
                                  onChange={e => setEditedDisplayStyle(e.target.value)}
                                  label="Display Style"
                                >
                                  <MenuItem value="bordered">Bordered</MenuItem>
                                  <MenuItem value="borderless">Borderless</MenuItem>
                                </Select>
                              </FormControl>
                            ) : (
                              <Box sx={{ mb: 2 }}>
                                <Chip
                                  label={sectionData?.display_style || 'bordered'}
                                  size="small"
                                  variant="outlined"
                                  color={sectionData?.display_style === 'borderless' ? 'default' : 'primary'}
                                />
                              </Box>
                            )}
                          </Grid>

                          {/* Language Texts */}
                          <Grid item xs={12}>
                            <Divider sx={{ mb: 2 }} />
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                              Content (Multilingual)
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
                                              {languageTexts[lang.id] !== undefined && (
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
                                            multiline
                                            rows={6}
                                            label={`Text content (${lang.name})`}
                                            value={languageTexts[lang.id] ?? ''}
                                            onChange={e => setLanguageTexts({
                                              ...languageTexts,
                                              [lang.id]: e.target.value,
                                            })}
                                            placeholder={`Enter section text in ${lang.name}`}
                                            size="small"
                                          />
                                          <Box sx={{ display: 'flex', gap: 1 }}>
                                            {languageTexts[lang.id] === undefined && (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => setLanguageTexts({
                                                  ...languageTexts,
                                                  [lang.id]: '',
                                                })}
                                              >
                                                Add {lang.name} Translation
                                              </Button>
                                            )}
                                            {languageTexts[lang.id] !== undefined && (
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
                                {sectionData?.section_texts?.length > 0 ? (
                                  sectionData.section_texts.map((text, index) => {
                                    const langName = text.language?.name || `Language ${text.language_id}`;
                                    return (
                                      <Box
                                        key={text.language_id || index}
                                        sx={{
                                          mb: 2,
                                          pb: 2,
                                          borderBottom: index < sectionData.section_texts.length - 1 ? 1 : 0,
                                          borderColor: 'divider',
                                        }}
                                      >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                          <LanguageIcon fontSize="small" color="primary" />
                                          <Typography variant="subtitle2" color="primary">{langName}</Typography>
                                        </Box>
                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                          {text.text || 'No content provided'}
                                        </Typography>
                                      </Box>
                                    );
                                  })
                                ) : (
                                  <Typography variant="body1" color="text.secondary">
                                    No translations available
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </Grid>
                        </Grid>

                        <Divider sx={{ my: 3 }} />

                        {/* Quick Stats */}
                        <Typography variant="h6" sx={{ mb: 2 }}>Quick Stats</Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6} sm={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="primary">
                                {sectionData?.section_texts?.length ?? 0}
                              </Typography>
                              <Typography variant="caption">Languages</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="primary">
                                {sectionData?.images?.length ?? 0}
                              </Typography>
                              <Typography variant="caption">Images</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="primary">
                                {sectionData?.attachments?.length ?? 0}
                              </Typography>
                              <Typography variant="caption">Attachments</Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Box>
                </PermissionGate>
              </TabPanel>

              {/* ---- IMAGES TAB ---- */}
              <TabPanel value={tabValue} index={1}>
                <PermissionGate
                  permission="VIEW_SECTIONS"
                  showError
                  errorMessage="You do not have permission to see Section Images."
                >
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                        <PhotoLibraryIcon sx={{ mr: 1 }} />
                        Images ({sectionData?.images?.length ?? 0})
                      </Typography>
                    </Box>

                    <Alert severity="info" sx={{ mb: 2 }}>
                      Section images are managed through the CMS website edit mode. You can delete existing images here.
                    </Alert>

                    {!sectionData?.images?.length ? (
                      <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <ImageIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography color="text.secondary">No images associated with this section.</Typography>
                      </Paper>
                    ) : (
                      <Grid container spacing={2}>
                        {sectionData.images.map((image) => {
                          const imgUrl = buildImageUrl(image);
                          return (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={image.id}>
                              <Card>
                                <Box
                                  sx={{
                                    height: 160,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: '#f5f5f5',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt={`Section image ${image.id}`}
                                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                      onError={e => { e.target.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <ImageIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                                  )}
                                </Box>
                                <CardContent sx={{ pb: 1, pt: 1 }}>
                                  <Typography variant="caption" color="text.secondary" noWrap>
                                    {image.image_path?.split('/').pop() || `Image ${image.id}`}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                                    <Chip label={`Order: ${image.display_order}`} size="small" variant="outlined" />
                                    {image.language_id && (
                                      <Chip label={`Lang: ${image.language_id}`} size="small" variant="outlined" />
                                    )}
                                  </Box>
                                </CardContent>
                                <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                                  <PermissionGate permissions={['EDIT_SECTION', 'MANAGE_SECTIONS']}>
                                    <Tooltip title="Delete Image">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteImage(image)}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </PermissionGate>
                                </CardActions>
                              </Card>
                            </Grid>
                          );
                        })}
                      </Grid>
                    )}
                  </Box>
                </PermissionGate>
              </TabPanel>

              {/* ---- ATTACHMENTS TAB ---- */}
              <TabPanel value={tabValue} index={2}>
                <PermissionGate
                  permission="VIEW_SECTIONS"
                  showError
                  errorMessage="You do not have permission to see Section Attachments."
                >
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                        <AttachFileIcon sx={{ mr: 1 }} />
                        Attachments ({sectionData?.attachments?.length ?? 0})
                      </Typography>
                    </Box>

                    <Alert severity="info" sx={{ mb: 2 }}>
                      Section attachments are managed through the CMS website edit mode. You can delete existing attachments here.
                    </Alert>

                    {!sectionData?.attachments?.length ? (
                      <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <AttachFileIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography color="text.secondary">No attachments associated with this section.</Typography>
                      </Paper>
                    ) : (
                      <List>
                        {sectionData.attachments.map((attachment, index) => (
                          <React.Fragment key={attachment.id}>
                            <ListItem
                              sx={{ px: 2, py: 1.5 }}
                              secondaryAction={
                                <Stack direction="row" spacing={0.5}>
                                  <Tooltip title="Download">
                                    <span>
                                      <IconButton
                                        size="small"
                                        onClick={() => handleDownloadAttachment(attachment)}
                                        disabled={downloadingId === attachment.id}
                                      >
                                        {downloadingId === attachment.id
                                          ? <CircularProgress size={16} />
                                          : <DownloadIcon fontSize="small" />
                                        }
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <PermissionGate permissions={['EDIT_SECTION', 'MANAGE_SECTIONS']}>
                                    <Tooltip title="Delete Attachment">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteAttachment(attachment)}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </PermissionGate>
                                </Stack>
                              }
                            >
                              <ListItemIcon>
                                <AttachFileIcon />
                              </ListItemIcon>
                              <ListItemText
                                primary={attachment.file_name || `Attachment ${attachment.id}`}
                                secondary={
                                  <Stack direction="row" spacing={0.5} component="span">
                                    <Chip label={`Order: ${attachment.display_order}`} size="small" variant="outlined" />
                                    {attachment.language_id && (
                                      <Chip label={`Lang: ${attachment.language_id}`} size="small" variant="outlined" />
                                    )}
                                  </Stack>
                                }
                              />
                            </ListItem>
                            {index < sectionData.attachments.length - 1 && <Divider />}
                          </React.Fragment>
                        ))}
                      </List>
                    )}
                  </Box>
                </PermissionGate>
              </TabPanel>

              {/* ---- PROJECTS TAB ---- */}
              <TabPanel value={tabValue} index={3}>
                <PermissionGate
                  permission="VIEW_SECTIONS"
                  showError
                  errorMessage="You do not have permission to see related Projects."
                >
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                        <ProjectsIcon sx={{ mr: 1 }} />
                        Projects using this Section
                      </Typography>
                    </Box>

                    <Alert severity="info" sx={{ mb: 2 }}>
                      To manage which projects use this section, navigate to each project's Sections tab.
                    </Alert>

                    {projectsLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                      </Box>
                    ) : !projectsLoaded ? null : relatedProjects.length === 0 ? (
                      <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <ProjectsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                        <Typography color="text.secondary">This section is not used in any projects.</Typography>
                      </Paper>
                    ) : (
                      <Grid container spacing={2}>
                        {relatedProjects.map((project) => (
                          <Grid item xs={12} sm={6} md={4} key={project.id}>
                            <Card>
                              <CardContent>
                                <Typography variant="subtitle1" fontWeight={500} noWrap>
                                  {getProjectTitle(project)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  ID: {project.id}
                                </Typography>
                                {project.project_texts?.length > 0 && (
                                  <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                                    {project.project_texts.map(t => (
                                      <Chip
                                        key={t.language_id}
                                        label={t.language?.code || `Lang ${t.language_id}`}
                                        size="small"
                                        variant="outlined"
                                      />
                                    ))}
                                  </Stack>
                                )}
                              </CardContent>
                              <CardActions>
                                <Button
                                  size="small"
                                  startIcon={<OpenInNewIcon />}
                                  onClick={() => navigate(`/projects/${project.id}`)}
                                >
                                  Open Project
                                </Button>
                              </CardActions>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    )}
                  </Box>
                </PermissionGate>
              </TabPanel>
            </>
          )}
        </Box>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this {deleteType}? This action cannot be undone.
          </Typography>
          {itemToDelete && deleteType === 'attachment' && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              File: <strong>{itemToDelete.file_name}</strong>
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={18} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default SectionDataPage;
