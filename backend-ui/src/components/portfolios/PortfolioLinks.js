import React, { useState, useEffect, useRef } from 'react';
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
  Tooltip,
  ListSubheader
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Close as CloseIcon,
  UploadFile as UploadFileIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { linksApi, languagesApi } from '../../services/api';

export default function PortfolioLinks({ portfolioId }) {
  const { enqueueSnackbar } = useSnackbar();
  const [links, setLinks] = useState([]);
  const [linkCategories, setLinkCategories] = useState([]);
  const [linkCategoryTypes, setLinkCategoryTypes] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [formData, setFormData] = useState({
    category_id: '',
    url: '',
    is_active: true,
    texts: [],
    image_path: null
  });
  const [imagePreview, setImagePreview] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [linkPendingDelete, setLinkPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef(null);
  const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchLinks();
    fetchLinkCategories();
    fetchLinkCategoryTypes();
    fetchLanguages();
  }, [portfolioId]);

  useEffect(() => {
    if (!dialogOpen) {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
      if (imagePreview) {
        setImagePreview('');
      }
      if (selectedImageFile) {
        setSelectedImageFile(null);
      }
      if (removeImage) {
        setRemoveImage(false);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [dialogOpen, imagePreview, selectedImageFile, removeImage]);

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

  const fetchLinkCategoryTypes = async () => {
    try {
      const response = await linksApi.getLinkCategoryTypes();
      setLinkCategoryTypes(response.data || []);
    } catch (error) {
      console.error('Error fetching link category types:', error);
    }
  };

  const fetchLanguages = async () => {
    try {
      const response = await languagesApi.getLanguages();

      // Handle the various response shapes returned by languages endpoints
      const data = response.data;
      let languagesData = [];

      if (Array.isArray(data)) {
        languagesData = data;
      } else if (Array.isArray(data?.items)) {
        languagesData = data.items;
      } else if (Array.isArray(data?.data)) {
        languagesData = data.data;
      } else if (Array.isArray(data?.data?.items)) {
        languagesData = data.data.items;
      } else if (Array.isArray(data?.results)) {
        languagesData = data.results;
      }

      setLanguages(languagesData);
    } catch (error) {
      console.error('Error fetching languages:', error);
      setLanguages([]); // Ensure it's always an array
    }
  };

  const buildImageUrl = (path) => {
    if (!path) return '';
    if (typeof path !== 'string') return '';
    if (path.startsWith('blob:') || path.startsWith('data:')) {
      return path;
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const normalizedPath = path.startsWith('/') ? path : `/uploads/${path}`;
    return `${apiBaseUrl}${normalizedPath}`;
  };

  const normalizeLinkTexts = (linkData) => {
    const rawTexts = linkData?.link_texts ?? linkData?.texts ?? [];
    if (!Array.isArray(rawTexts)) {
      return [];
    }
    return rawTexts
      .filter((text) => text && text.language_id != null)
      .map((text) => ({
        language_id: text.language_id,
        name: text.name || '',
        description: text.description || ''
      }));
  };

  const ensureTextEntries = (texts) => {
    if (Array.isArray(texts) && texts.length > 0) {
      return texts;
    }
    if (Array.isArray(languages) && languages.length > 0) {
      return [{
        language_id: languages[0].id,
        name: '',
        description: ''
      }];
    }
    return [];
  };

  const clearImagePreview = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    if (imagePreview) {
      setImagePreview('');
    }
  };

  const handleOpenDialog = async (link = null) => {
    clearImagePreview();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSelectedImageFile(null);
    setRemoveImage(false);
    setDialogOpen(true);

    if (link) {
      try {
        const response = await linksApi.getPortfolioLink(link.id);
        const linkData = response.data || link;
        setEditingLink(linkData);

        const normalizedTexts = ensureTextEntries(normalizeLinkTexts(linkData));
        setFormData({
          category_id: linkData?.category_id ?? '',
          url: linkData?.url ?? '',
          is_active: linkData?.is_active ?? true,
          texts: normalizedTexts,
          image_path: linkData?.image_path ?? null
        });

        const previewUrl = buildImageUrl(linkData?.image_url || linkData?.image_path);
        setImagePreview(previewUrl);
      } catch (error) {
        console.error('Error loading link details:', error);
        enqueueSnackbar('Failed to load latest link details. Showing cached data.', { variant: 'warning' });

        const fallbackTexts = ensureTextEntries(normalizeLinkTexts(link));
        setEditingLink(link);
        setFormData({
          category_id: link?.category_id ?? '',
          url: link?.url ?? '',
          is_active: link?.is_active ?? true,
          texts: fallbackTexts,
          image_path: link?.image_path ?? null
        });
        setImagePreview(buildImageUrl(link?.image_url || link?.image_path));
      }
    } else {
      setEditingLink(null);
      setFormData({
        category_id: '',
        url: '',
        is_active: true,
        texts: ensureTextEntries([]),
        image_path: null
      });
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLink(null);
    setFormData({
      category_id: '',
      url: '',
      is_active: true,
      texts: ensureTextEntries([]),
      image_path: null
    });
  };

  const handleImageChange = (event) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) {
      return;
    }

    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedImageFile(file);
    setImagePreview(previewUrl);
    setRemoveImage(false);
  };

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview('');
    setSelectedImageFile(null);
    setRemoveImage(true);
    setFormData((prev) => ({
      ...prev,
      image_path: null
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    try {
      const categoryId = Number(formData.category_id);
      const sanitizedUrl = formData.url ? formData.url.trim() : '';
      const sanitizedTexts = (formData.texts || [])
        .map((text) => ({
          ...text,
          language_id: Number(text.language_id),
          name: (text.name || '').trim(),
          description: text.description
        }))
        .filter((text) => text.language_id && text.name);

      if (!categoryId || Number.isNaN(categoryId)) {
        enqueueSnackbar('Please select a link category before saving.', { variant: 'warning' });
        return;
      }

      if (!sanitizedUrl) {
        enqueueSnackbar('Please provide a valid link URL.', { variant: 'warning' });
        return;
      }

      if (editingLink) {
        await linksApi.updatePortfolioLink(editingLink.id, {
          category_id: categoryId,
          url: sanitizedUrl,
          is_active: formData.is_active
        });

        if (sanitizedTexts.length > 0) {
          await Promise.all(
            sanitizedTexts.map((text) => linksApi.createPortfolioLinkText(editingLink.id, text))
          );
        }

        if (removeImage && !selectedImageFile && editingLink?.image_path) {
          await linksApi.deletePortfolioLinkImage(editingLink.id);
        }

        if (selectedImageFile) {
          await linksApi.uploadPortfolioLinkImage(editingLink.id, selectedImageFile);
        }

        enqueueSnackbar('Link updated successfully', { variant: 'success' });
      } else {
        const createData = {
          portfolio_id: parseInt(portfolioId),
          category_id: categoryId,
          url: sanitizedUrl,
          is_active: formData.is_active,
          order: links.length,
          texts: sanitizedTexts
        };

        const response = await linksApi.createPortfolioLink(createData);
        const createdLink = response?.data;

        if (createdLink?.id && selectedImageFile) {
          await linksApi.uploadPortfolioLinkImage(createdLink.id, selectedImageFile);
        }

        enqueueSnackbar('Link created successfully', { variant: 'success' });
      }

      await fetchLinks();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving link:', error);
      enqueueSnackbar(error.response?.data?.detail || 'Failed to save link', { variant: 'error' });
    }
  };

  const openDeleteDialog = (link) => {
    setLinkPendingDelete(link);
    setConfirmDeleteOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    if (isDeleting) return;
    setConfirmDeleteOpen(false);
    setLinkPendingDelete(null);
  };

  const handleDelete = async () => {
    if (!linkPendingDelete) return;

    setIsDeleting(true);
    try {
      await linksApi.deletePortfolioLink(linkPendingDelete.id);
      enqueueSnackbar('Link deleted successfully', { variant: 'success' });
      await fetchLinks();
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting link:', error);
      enqueueSnackbar('Failed to delete link', { variant: 'error' });
    } finally {
      setIsDeleting(false);
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

  const handleAddLanguage = () => {
    // Ensure languages is an array
    if (!Array.isArray(languages) || languages.length === 0) {
      enqueueSnackbar('No languages available', { variant: 'warning' });
      return;
    }

    // Find languages not yet added
    const usedLanguageIds = formData.texts.map(t => t.language_id);
    const availableLanguage = languages.find(lang => !usedLanguageIds.includes(lang.id));

    if (availableLanguage) {
      setFormData((prev) => ({
        ...prev,
        texts: [...prev.texts, { language_id: availableLanguage.id, name: '', description: '' }]
      }));
    } else {
      enqueueSnackbar('All languages have been added', { variant: 'info' });
    }
  };

  const handleRemoveLanguage = (index) => {
    setFormData((prev) => {
      const newTexts = prev.texts.filter((_, i) => i !== index);
      return { ...prev, texts: newTexts };
    });
  };

  const handleTextChange = (index, field, value) => {
    setFormData((prev) => {
      const newTexts = [...prev.texts];
      const parsedValue = field === 'language_id' ? Number(value) : value;
      newTexts[index] = { ...newTexts[index], [field]: parsedValue };
      return { ...prev, texts: newTexts };
    });
  };

  const getLanguageName = (languageId) => {
    const language = languages.find(l => l.id === languageId);
    return language?.name || `Language ${languageId}`;
  };

  const getCategoryName = (categoryId) => {
    const category = linkCategories.find(c => c.id === categoryId);
    return category?.texts?.[0]?.name || category?.code || 'Unknown';
  };

  const getLinkDisplayName = (link) => {
    if (!link) return '';
    const texts = Array.isArray(link.link_texts)
      ? link.link_texts
      : (Array.isArray(link.texts) ? link.texts : []);
    return texts?.[0]?.name || '';
  };

  let groupedCategories = [];
  if (Array.isArray(linkCategoryTypes) && linkCategoryTypes.length > 0) {
    groupedCategories = linkCategoryTypes
      .map((type) => ({
        type: type.code,
        typeName: type.name,
        categories: linkCategories.filter((cat) => cat.type_code === type.code)
      }))
      .filter((group) => group.categories.length > 0);
  }

  if ((!groupedCategories || groupedCategories.length === 0) && linkCategories.length > 0) {
    groupedCategories = [{
      type: 'ALL',
      typeName: 'All Categories',
      categories: linkCategories
    }];
  }

  const hasCategoryOptions = groupedCategories.some(
    (group) => Array.isArray(group.categories) && group.categories.length > 0
  );

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
                {(link.image_url || link.image_path) && (
                  <Box
                    component="img"
                    src={buildImageUrl(link.image_url || link.image_path)}
                    alt={getLinkDisplayName(link) || 'Link image'}
                    sx={{
                      width: 48,
                      height: 48,
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      backgroundColor: 'background.paper',
                      mr: 2
                    }}
                  />
                )}
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        {getLinkDisplayName(link) || link.url}
                      </Typography>
                      <Chip
                        label={getCategoryName(link.category_id)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      <Chip
                        label={link.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        color={link.is_active ? 'success' : 'warning'}
                        variant={link.is_active ? 'outlined' : 'filled'}
                      />
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
                    <IconButton
                      onClick={() => openDeleteDialog(link)}
                      size="small"
                      color="error"
                      disabled={isDeleting && linkPendingDelete?.id === link.id}
                    >
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
                onChange={(e) => setFormData((prev) => ({ ...prev, category_id: e.target.value }))}
                label="Link Category"
              >
                {hasCategoryOptions ? (
                  groupedCategories.map((group) => [
                    <ListSubheader key={group.type}>{group.typeName}</ListSubheader>,
                    ...group.categories.map((category) => (
                      <MenuItem key={category.id} value={category.id} sx={{ pl: 4 }}>
                        {category.texts?.[0]?.name || category.code}
                      </MenuItem>
                    ))
                  ])
                ) : (
                  <MenuItem value="" disabled>
                    No link categories available
                  </MenuItem>
                )}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="URL"
              value={formData.url}
              onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://..."
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
              }
              label="Active"
            />

            <Divider sx={{ my: 2 }} />

            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ImageIcon fontSize="small" />
                Link Image (Optional)
              </Typography>

              <input
                id="portfolio-link-image-upload"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageChange}
              />

              {imagePreview ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box
                    component="img"
                    src={imagePreview}
                    alt="Link preview"
                    sx={{
                      width: 96,
                      height: 96,
                      objectFit: 'cover',
                      borderRadius: 2,
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      backgroundColor: 'background.paper',
                      boxShadow: 1
                    }}
                  />
                  <Stack direction="row" spacing={1}>
                    <label htmlFor="portfolio-link-image-upload">
                      <Button
                        component="span"
                        size="small"
                        variant="outlined"
                        startIcon={<UploadFileIcon />}
                      >
                        Replace Image
                      </Button>
                    </label>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={handleRemoveImage}
                    >
                      Remove Image
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Stack spacing={1}>
                  <Alert severity={removeImage ? 'warning' : 'info'}>
                    {removeImage
                      ? 'The existing image will be removed when you save this link.'
                      : 'No image has been uploaded for this link yet.'}
                  </Alert>
                  <label htmlFor="portfolio-link-image-upload">
                    <Button
                      component="span"
                      size="small"
                      variant="outlined"
                      startIcon={<UploadFileIcon />}
                    >
                      Upload Image
                    </Button>
                  </label>
                </Stack>
              )}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2">Link Names (Multilingual)</Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddLanguage}
                disabled={!Array.isArray(languages) || formData.texts.length >= languages.length}
              >
                Add Language
              </Button>
            </Box>

            {formData.texts.length === 0 && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Click "Add Language" to add link names in different languages. At least one language is recommended.
              </Alert>
            )}

            {formData.texts.map((text, index) => (
              <Card key={index} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      {getLanguageName(text.language_id)}
                    </Typography>
                    {formData.texts.length > 1 && (
                      <Tooltip title="Remove this language">
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveLanguage(index)}
                          color="error"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  <FormControl fullWidth size="small">
                    <InputLabel>Language</InputLabel>
                    <Select
                      value={text.language_id}
                      onChange={(e) => handleTextChange(index, 'language_id', e.target.value)}
                      label="Language"
                    >
                      {Array.isArray(languages) && languages.map((lang) => (
                        <MenuItem
                          key={lang.id}
                          value={lang.id}
                          disabled={formData.texts.some((t, i) => i !== index && t.language_id === lang.id)}
                        >
                          {lang.name} ({lang.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    label="Link Name"
                    value={text.name}
                    onChange={(e) => handleTextChange(index, 'name', e.target.value)}
                    size="small"
                    placeholder={`Enter link name in ${getLanguageName(text.language_id)}`}
                  />
                </Stack>
              </Card>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={
              !formData.category_id ||
              !((formData.url || '').trim())
            }
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={handleCloseDeleteDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Portfolio Link</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="warning">
              This action cannot be undone. The selected link will be permanently removed.
            </Alert>
            {linkPendingDelete && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Link
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {getLinkDisplayName(linkPendingDelete) || linkPendingDelete.url}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {linkPendingDelete.url}
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
