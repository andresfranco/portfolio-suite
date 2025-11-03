import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { linksApi } from '../../services/api';

export default function PortfolioLinks({ portfolioId }) {
  const { enqueueSnackbar } = useSnackbar();
  const [links, setLinks] = useState([]);
  const [linkCategories, setLinkCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [formData, setFormData] = useState({
    category_id: '',
    url: '',
    is_active: true,
    texts: [
      { language_id: 1, name: '', description: '' }, // English
      { language_id: 2, name: '', description: '' }  // Spanish
    ]
  });

  useEffect(() => {
    fetchLinks();
    fetchLinkCategories();
  }, [portfolioId]);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const response = await linksApi.getPortfolioLinks(portfolioId);
      setLinks(response.data || []);
    } catch (error) {
      console.error('Error fetching links:', error);
      enqueueSnackbar('Failed to load links', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkCategories = async () => {
    try {
      const response = await linksApi.getLinkCategories();
      setLinkCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching link categories:', error);
    }
  };

  const handleOpenDialog = (link = null) => {
    if (link) {
      setEditingLink(link);
      setFormData({
        category_id: link.category_id,
        url: link.url,
        is_active: link.is_active,
        texts: link.link_texts?.length > 0 ? link.link_texts : [
          { language_id: 1, name: '', description: '' },
          { language_id: 2, name: '', description: '' }
        ]
      });
    } else {
      setEditingLink(null);
      setFormData({
        category_id: '',
        url: '',
        is_active: true,
        texts: [
          { language_id: 1, name: '', description: '' },
          { language_id: 2, name: '', description: '' }
        ]
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLink(null);
  };

  const handleSave = async () => {
    try {
      if (editingLink) {
        await linksApi.updatePortfolioLink(editingLink.id, {
          category_id: formData.category_id,
          url: formData.url,
          is_active: formData.is_active
        });

        // Update texts
        for (const text of formData.texts) {
          if (text.name) {
            await linksApi.createPortfolioLinkText(editingLink.id, text);
          }
        }

        enqueueSnackbar('Link updated successfully', { variant: 'success' });
      } else {
        const createData = {
          portfolio_id: parseInt(portfolioId),
          category_id: formData.category_id,
          url: formData.url,
          is_active: formData.is_active,
          order: links.length,
          texts: formData.texts.filter(t => t.name)
        };
        await linksApi.createPortfolioLink(createData);
        enqueueSnackbar('Link created successfully', { variant: 'success' });
      }

      fetchLinks();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving link:', error);
      enqueueSnackbar(error.response?.data?.detail || 'Failed to save link', { variant: 'error' });
    }
  };

  const handleDelete = async (linkId) => {
    if (!window.confirm('Are you sure you want to delete this link?')) {
      return;
    }

    try {
      await linksApi.deletePortfolioLink(linkId);
      enqueueSnackbar('Link deleted successfully', { variant: 'success' });
      fetchLinks();
    } catch (error) {
      console.error('Error deleting link:', error);
      enqueueSnackbar('Failed to delete link', { variant: 'error' });
    }
  };

  const updateLinksOrder = async (newLinks) => {
    try {
      const linkOrders = newLinks.map((link, index) => ({
        id: link.id,
        order: index
      }));

      await linksApi.updatePortfolioLinksOrder(portfolioId, { link_orders: linkOrders });
      enqueueSnackbar('Link order updated', { variant: 'success' });
    } catch (error) {
      console.error('Error updating order:', error);
      enqueueSnackbar('Failed to update order', { variant: 'error' });
      fetchLinks(); // Revert on error
    }
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const newLinks = [...links];
    [newLinks[index - 1], newLinks[index]] = [newLinks[index], newLinks[index - 1]];
    setLinks(newLinks);
    await updateLinksOrder(newLinks);
  };

  const handleMoveDown = async (index) => {
    if (index === links.length - 1) return;
    const newLinks = [...links];
    [newLinks[index], newLinks[index + 1]] = [newLinks[index + 1], newLinks[index]];
    setLinks(newLinks);
    await updateLinksOrder(newLinks);
  };

  const getCategoryName = (categoryId) => {
    const category = linkCategories.find(c => c.id === categoryId);
    return category?.texts?.[0]?.name || category?.code || 'Unknown';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <LinkIcon sx={{ mr: 1 }} />
          Portfolio Links
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Link
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Manage the social media and external links for this portfolio. These will be displayed on the contact page of your website.
      </Alert>

      {links.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center">
              No links added yet. Click "Add Link" to create your first link.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <List>
          {links.map((link, index) => (
            <Card key={link.id} sx={{ mb: 1 }}>
              <ListItem>
                <Box sx={{ display: 'flex', flexDirection: 'column', mr: 1 }}>
                  <Tooltip title="Move Up">
                    <span>
                      <IconButton
                        onClick={() => handleMoveUp(index)}
                        size="small"
                        disabled={index === 0}
                      >
                        <ArrowUpIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move Down">
                    <span>
                      <IconButton
                        onClick={() => handleMoveDown(index)}
                        size="small"
                        disabled={index === links.length - 1}
                      >
                        <ArrowDownIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        {link.link_texts?.[0]?.name || link.url}
                      </Typography>
                      <Chip
                        label={getCategoryName(link.category_id)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      {!link.is_active && (
                        <Chip label="Inactive" size="small" color="warning" />
                      )}
                    </Box>
                  }
                  secondary={link.url}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Edit">
                    <IconButton onClick={() => handleOpenDialog(link)} size="small">
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton onClick={() => handleDelete(link.id)} size="small" color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            </Card>
          ))}
        </List>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingLink ? 'Edit Link' : 'Add Link'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Link Category</InputLabel>
              <Select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                label="Link Category"
              >
                {linkCategories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.texts?.[0]?.name || category.code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="URL"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://..."
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Active"
            />

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2">Link Text (Multilingual)</Typography>

            {/* English */}
            <Typography variant="caption" color="text.secondary">English</Typography>
            <TextField
              fullWidth
              label="Name (English)"
              value={formData.texts[0]?.name || ''}
              onChange={(e) => {
                const newTexts = [...formData.texts];
                newTexts[0] = { ...newTexts[0], name: e.target.value };
                setFormData({ ...formData, texts: newTexts });
              }}
              size="small"
            />

            {/* Spanish */}
            <Typography variant="caption" color="text.secondary">Spanish</Typography>
            <TextField
              fullWidth
              label="Name (Spanish)"
              value={formData.texts[1]?.name || ''}
              onChange={(e) => {
                const newTexts = [...formData.texts];
                newTexts[1] = { ...newTexts[1], name: e.target.value };
                setFormData({ ...formData, texts: newTexts });
              }}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.category_id || !formData.url}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
