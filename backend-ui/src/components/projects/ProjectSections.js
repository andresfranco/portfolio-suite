import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Card,
  CardContent,
  CardActions,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Image as ImageIcon,
  AttachFile as AttachFileIcon
} from '@mui/icons-material';
import ModuleGate from '../common/ModuleGate';
import PermissionGate from '../common/PermissionGate';
import ErrorBoundary from '../common/ErrorBoundary';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { api } from '../../services/api';

function ProjectSectionsContent() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission, isSystemAdmin } = useAuthorization();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState([]);
  const [project, setProject] = useState(null);
  const [allSections, setAllSections] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [defaultLanguage, setDefaultLanguage] = useState(null);

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);

  // Form states for creating new section
  const [newSectionCode, setNewSectionCode] = useState('');
  const [newSectionText, setNewSectionText] = useState('');
  const [newSectionLanguageId, setNewSectionLanguageId] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);

  // Form states for adding existing section
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [addDisplayOrder, setAddDisplayOrder] = useState(0);

  // Check permissions
  const canView = hasAnyPermission(['VIEW_SECTIONS', 'EDIT_SECTIONS', 'MANAGE_SECTIONS', 'EDIT_PROJECT', 'MANAGE_PROJECTS', 'SYSTEM_ADMIN']);
  const canEdit = hasAnyPermission(['EDIT_SECTIONS', 'MANAGE_SECTIONS', 'EDIT_PROJECT', 'MANAGE_PROJECTS', 'SYSTEM_ADMIN']);
  const canDelete = hasAnyPermission(['DELETE_SECTIONS', 'MANAGE_SECTIONS', 'EDIT_PROJECT', 'MANAGE_PROJECTS', 'SYSTEM_ADMIN']);

  // Fetch project and sections
  useEffect(() => {
    if (!canView) {
      setError('You do not have permission to view project sections');
      setLoading(false);
      return;
    }

    fetchData();
  }, [projectId, canView]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch project details
      const projectResponse = await api.get(`/api/projects/${projectId}`);
      setProject(projectResponse.data);

      // Fetch project sections
      const sectionsResponse = await api.get(`/api/projects/${projectId}/sections`);
      setSections(sectionsResponse.data || []);

      // Fetch all available sections
      const allSectionsResponse = await api.get('/api/sections', {
        params: { page: 1, page_size: 100 }
      });
      const sectionsList = allSectionsResponse.data?.items || allSectionsResponse.data || [];
      setAllSections(sectionsList);

      // Fetch languages
      const languagesResponse = await api.get('/api/languages', {
        params: { page: 1, page_size: 100 }
      });
      const langsList = languagesResponse.data?.items || languagesResponse.data || [];
      setLanguages(langsList);

      const defaultLang = langsList.find(lang => lang.is_default || lang.isDefault) || langsList[0];
      setDefaultLanguage(defaultLang);
      setNewSectionLanguageId(defaultLang?.id || '');

    } catch (err) {
      console.error('Error fetching project sections:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load project sections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSection = async () => {
    try {
      if (!newSectionCode || !newSectionText || !newSectionLanguageId) {
        setError('Please fill in all required fields');
        return;
      }

      await api.post(`/api/projects/${projectId}/sections`, {
        code: newSectionCode,
        section_texts: [{
          language_id: parseInt(newSectionLanguageId),
          text: newSectionText
        }],
        display_order: displayOrder
      });

      // Reset form and close dialog
      setNewSectionCode('');
      setNewSectionText('');
      setDisplayOrder(0);
      setIsCreateDialogOpen(false);

      // Refresh sections
      await fetchData();
    } catch (err) {
      console.error('Error creating section:', err);
      setError(err.response?.data?.detail || 'Failed to create section');
    }
  };

  const handleAddExistingSection = async () => {
    try {
      if (!selectedSectionId) {
        setError('Please select a section');
        return;
      }

      await api.post(`/api/projects/${projectId}/sections/${selectedSectionId}`, {
        section_id: parseInt(selectedSectionId),
        display_order: addDisplayOrder
      });

      // Reset form and close dialog
      setSelectedSectionId('');
      setAddDisplayOrder(0);
      setIsAddDialogOpen(false);

      // Refresh sections
      await fetchData();
    } catch (err) {
      console.error('Error adding section:', err);
      setError(err.response?.data?.detail || 'Failed to add section');
    }
  };

  const handleDeleteSection = async () => {
    try {
      await api.delete(`/api/projects/${projectId}/sections/${selectedSection.id}`);

      setIsDeleteDialogOpen(false);
      setSelectedSection(null);

      // Refresh sections
      await fetchData();
    } catch (err) {
      console.error('Error deleting section:', err);
      setError(err.response?.data?.detail || 'Failed to remove section');
    }
  };

  const getSectionText = (section) => {
    if (!section.section_texts || section.section_texts.length === 0) return '';

    // Try to find text in default language
    if (defaultLanguage) {
      const defaultText = section.section_texts.find(t => t.language_id === defaultLanguage.id);
      if (defaultText) return defaultText.text;
    }

    // Fallback to first available
    return section.section_texts[0].text;
  };

  const getAvailableSectionsForAdding = () => {
    const currentSectionIds = new Set(sections.map(s => s.id));
    return allSections.filter(s => !currentSectionIds.has(s.id));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!canView) {
    return (
      <Box p={3}>
        <Alert severity="error">
          You do not have permission to view project sections.
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/projects')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          Project Sections: {project?.project_texts?.[0]?.name || 'Unknown Project'}
        </Typography>
        {canEdit && (
          <Box>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setIsAddDialogOpen(true)}
              sx={{ mr: 1 }}
            >
              Add Existing Section
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsCreateDialogOpen(true)}
            >
              Create New Section
            </Button>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Sections Grid */}
      {sections.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No sections added to this project yet.
          </Typography>
          {canEdit && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Click "Create New Section" or "Add Existing Section" to get started.
            </Typography>
          )}
        </Paper>
      ) : (
        <Box>
          {sections
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            .map((section) => (
              <Card key={section.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="flex-start" mb={2}>
                    <Box flexGrow={1}>
                      <Typography variant="h6" component="div" gutterBottom>
                        {section.code}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {getSectionText(section).substring(0, 200)}
                        {getSectionText(section).length > 200 ? '...' : ''}
                      </Typography>
                      <Box display="flex" gap={1}>
                        <Chip
                          size="small"
                          icon={<ImageIcon />}
                          label={`${section.images?.length || 0} images`}
                        />
                        <Chip
                          size="small"
                          icon={<AttachFileIcon />}
                          label={`${section.attachments?.length || 0} files`}
                        />
                        <Chip
                          size="small"
                          label={`Order: ${section.display_order || 0}`}
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                    {canDelete && (
                      <Tooltip title="Remove from project">
                        <IconButton
                          onClick={() => {
                            setSelectedSection(section);
                            setIsDeleteDialogOpen(true);
                          }}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
        </Box>
      )}

      {/* Create New Section Dialog */}
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Section</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Section Code"
              value={newSectionCode}
              onChange={(e) => setNewSectionCode(e.target.value)}
              placeholder="e.g., technical-architecture"
              required
              fullWidth
            />
            <FormControl fullWidth required>
              <InputLabel>Language</InputLabel>
              <Select
                value={newSectionLanguageId}
                onChange={(e) => setNewSectionLanguageId(e.target.value)}
                label="Language"
              >
                {languages.map((lang) => (
                  <MenuItem key={lang.id} value={lang.id}>
                    {lang.name} ({lang.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Section Text"
              value={newSectionText}
              onChange={(e) => setNewSectionText(e.target.value)}
              multiline
              rows={6}
              placeholder="Enter section content..."
              required
              fullWidth
            />
            <TextField
              label="Display Order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateSection} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Add Existing Section Dialog */}
      <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Existing Section</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth required>
              <InputLabel>Section</InputLabel>
              <Select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                label="Section"
              >
                {getAvailableSectionsForAdding().map((section) => (
                  <MenuItem key={section.id} value={section.id}>
                    {section.code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Display Order"
              type="number"
              value={addDisplayOrder}
              onChange={(e) => setAddDisplayOrder(parseInt(e.target.value) || 0)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddExistingSection} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
        <DialogTitle>Remove Section from Project</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove the section "{selectedSection?.code}" from this project?
            This will not delete the section itself, only remove it from this project.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteSection} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Main component with gates
function ProjectSections() {
  return (
    <ModuleGate moduleName="projects" showError={true}>
      <ErrorBoundary>
        <ProjectSectionsContent />
      </ErrorBoundary>
    </ModuleGate>
  );
}

export default ProjectSections;
