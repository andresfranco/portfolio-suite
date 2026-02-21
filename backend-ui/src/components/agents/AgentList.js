import React, { useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Chip,
  TextField,
  InputAdornment,
  Stack,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import SmartToyIcon from '@mui/icons-material/SmartToy';

/**
 * AgentList component - Modern table view for agents
 * 
 * Features:
 * - Searchable table with agent information
 * - Action menu for each agent (edit, delete, view details, test, toggle active)
 * - Provider badges
 * - Active status indicators
 */
export default function AgentList({
  agents = [],
  credentials = [],
  onEdit,
  onDelete,
  onView,
  onTest,
  onToggleActive,
  loading = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);

  const handleMenuOpen = (event, agent) => {
    setAnchorEl(event.currentTarget);
    setSelectedAgent(agent);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAgent(null);
  };

  const handleAction = (action) => {
    if (!selectedAgent) return;
    
    switch (action) {
      case 'edit':
        onEdit?.(selectedAgent);
        break;
      case 'delete':
        onDelete?.(selectedAgent);
        break;
      case 'view':
        onView?.(selectedAgent);
        break;
      case 'test':
        onTest?.(selectedAgent);
        break;
      case 'toggle':
        onToggleActive?.(selectedAgent);
        break;
      default:
        break;
    }
    handleMenuClose();
  };

  // Get credential info for an agent
  const getCredentialInfo = (credentialId) => {
    const cred = credentials.find(c => c.id === credentialId);
    return cred || { name: 'Unknown', provider: 'unknown' };
  };

  // Filter agents by search term
  const filteredAgents = agents.filter(agent => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      agent.name?.toLowerCase().includes(search) ||
      agent.description?.toLowerCase().includes(search) ||
      getCredentialInfo(agent.credential_id).provider.toLowerCase().includes(search)
    );
  });

  // Get provider color
  const getProviderColor = (provider) => {
    const colors = {
      openai: 'success',
      anthropic: 'warning',
      google: 'info',
      mistral: 'secondary',
      custom: 'default'
    };
    return colors[provider?.toLowerCase()] || 'default';
  };

  if (agents.length === 0 && !loading) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No agents configured yet. Create your first agent to get started!
      </Alert>
    );
  }

  return (
    <Box>
      {/* Search Bar */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search agents by name, description, or provider..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Agent Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="5%">
                <SmartToyIcon fontSize="small" sx={{ verticalAlign: 'middle' }} />
              </TableCell>
              <TableCell width="25%"><strong>Name</strong></TableCell>
              <TableCell width="30%"><strong>Description</strong></TableCell>
              <TableCell width="15%"><strong>Provider</strong></TableCell>
              <TableCell width="10%"><strong>Model</strong></TableCell>
              <TableCell width="10%"><strong>Status</strong></TableCell>
              <TableCell width="5%" align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAgents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchTerm ? 'No agents match your search' : 'No agents available'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredAgents.map((agent) => {
                const credential = getCredentialInfo(agent.credential_id);
                return (
                  <TableRow 
                    key={agent.id}
                    hover
                    sx={{ 
                      cursor: 'pointer',
                      opacity: agent.is_active ? 1 : 0.6
                    }}
                    onClick={() => onView?.(agent)}
                  >
                    <TableCell>
                      <SmartToyIcon 
                        fontSize="small" 
                        color={agent.is_active ? 'primary' : 'disabled'} 
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {agent.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 300
                        }}
                      >
                        {agent.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip 
                          label={credential.provider.toUpperCase()}
                          size="small"
                          color={getProviderColor(credential.provider)}
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                          ({credential.name})
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {agent.chat_model || agent.embedding_model || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={agent.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        color={agent.is_active ? 'success' : 'default'}
                        variant={agent.is_active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Actions">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, agent)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleAction('view')}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleAction('edit')}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleAction('test')}>
          <ListItemIcon>
            <PlayArrowIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Test Agent</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleAction('toggle')}>
          <ListItemIcon>
            {selectedAgent?.is_active ? (
              <ToggleOffIcon fontSize="small" />
            ) : (
              <ToggleOnIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {selectedAgent?.is_active ? 'Deactivate' : 'Activate'}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleAction('delete')} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
