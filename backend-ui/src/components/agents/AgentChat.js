import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  Stack,
  Chip,
  Avatar,
  CircularProgress,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Button
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAgentAdmin } from '../../contexts/AgentAdminContext';
import agentAdminApi from '../../services/agentAdminApi';
import languagesApi from '../../services/languageApi';

/**
 * ChatGPT-like interface for Agent conversations
 * 
 * Features:
 * - Message bubbles (user/assistant)
 * - Citation chips with links
 * - Session persistence
 * - Agent & portfolio selection
 * - Language filtering
 * - Copy message functionality
 * - Auto-scroll to latest message
 * - Fixed input area (no scrolling required)
 */
export default function AgentChat() {
  const { agents, refreshAgents } = useAgentAdmin();
  
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [portfolioId, setPortfolioId] = useState('');
  const [languageId, setLanguageId] = useState('');
  const [portfolios, setPortfolios] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    refreshAgents();
    loadPortfolios();
    loadLanguages();
  }, [refreshAgents]);

  const loadPortfolios = async () => {
    try {
      const response = await agentAdminApi.listPortfolios();
      setPortfolios(response.items || []);
    } catch (err) {
      console.error('Error loading portfolios:', err);
    }
  };

  const loadLanguages = async () => {
    try {
      const response = await languagesApi.getLanguages({ page: 1, page_size: 100 });
      const langs = response.data?.items || response.data || [];
      setLanguages(langs);
      
      // Set default language if available
      const defaultLang = langs.find(lang => lang.is_default || lang.isDefault);
      if (defaultLang) {
        setLanguageId(String(defaultLang.id));
      }
    } catch (err) {
      console.error('Error loading languages:', err);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedAgentId || isLoading) {
      return;
    }

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    // Add user message to UI immediately
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setError('');
    setIsLoading(true);

    try {
      const payload = {
        message: currentInput,
        session_id: sessionId,
        portfolio_id: portfolioId ? parseInt(portfolioId) : undefined,
        language_id: languageId ? parseInt(languageId) : undefined
      };

      const response = await agentAdminApi.chat(selectedAgentId, payload);

      // Add assistant response
      const assistantMessage = {
        role: 'assistant',
        content: response.answer || '',
        citations: response.citations || [],
        tokenUsage: response.token_usage || {},
        latency: response.latency_ms || 0,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update session ID for continuity
      if (response.session_id) {
        setSessionId(response.session_id);
      }

    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = err?.response?.data?.detail || err?.message || 'Failed to get response';
      setError(errorMsg);
      
      // Add error message to chat
      const errorMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMsg}`,
        isError: true,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Focus back on input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Clear chat history? This will start a new conversation.')) {
      setMessages([]);
      setSessionId(null);
      setError('');
    }
  };

  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content);
  };

  const selectedAgent = agents.find(a => String(a.id) === String(selectedAgentId));
  const selectedPortfolio = portfolios.find(p => String(p.id) === portfolioId);
  const selectedLanguage = languages.find(l => String(l.id) === languageId);
  
  // Dynamic placeholder based on context
  const getPlaceholder = () => {
    if (!selectedAgentId) return "Select an agent first";
    if (portfolioId && selectedPortfolio) {
      return `Ask me about ${selectedPortfolio.name}...`;
    }
    return "Ask me anything about the portfolios...";
  };

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
      {/* Header */}
      <Paper sx={{ p: 1.5, borderRadius: 0, boxShadow: 2, flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={0.5}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Select Agent</InputLabel>
            <Select
              value={selectedAgentId}
              onChange={(e) => {
                setSelectedAgentId(e.target.value);
                // Reset session when switching agents
                setMessages([]);
                setSessionId(null);
              }}
              label="Select Agent"
            >
              {agents.map(agent => (
                <MenuItem key={agent.id} value={String(agent.id)}>
                  {agent.name} {agent.is_active ? '' : '(inactive)'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Portfolio</InputLabel>
            <Select
              value={portfolioId}
              onChange={(e) => {
                setPortfolioId(e.target.value);
                // Reset session when switching portfolios to start fresh context
                setMessages([]);
                setSessionId(null);
              }}
              label="Portfolio"
            >
              <MenuItem value="">
                <em>All Portfolios</em>
              </MenuItem>
              {portfolios.map(portfolio => (
                <MenuItem key={portfolio.id} value={String(portfolio.id)}>
                  {portfolio.name || `Portfolio ${portfolio.id}`}
                  {portfolio.title && portfolio.title !== portfolio.name ? ` - ${portfolio.title}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Language</InputLabel>
            <Select
              value={languageId}
              onChange={(e) => {
                setLanguageId(e.target.value);
                // Reset session when switching language
                setMessages([]);
                setSessionId(null);
              }}
              label="Language"
            >
              {languages.map(lang => (
                <MenuItem key={lang.id} value={String(lang.id)}>
                  {lang.name} {lang.code ? `(${lang.code})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flex: 1 }} />
          
          {selectedAgent && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Model: {selectedAgent.chat_model || 'gpt-4o-mini'}
              </Typography>
              {portfolioId && (
                <Chip 
                  label={`Portfolio: ${portfolios.find(p => String(p.id) === portfolioId)?.name || 'N/A'}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
              {selectedLanguage && (
                <Chip 
                  label={`Lang: ${selectedLanguage.name}`}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              )}
            </Stack>
          )}

          <Button
            size="small"
            startIcon={<DeleteIcon />}
            onClick={handleClearChat}
            disabled={messages.length === 0}
          >
            Clear
          </Button>
        </Stack>

        {error && (
          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
            {error}
          </Typography>
        )}
      </Paper>

      {/* Messages Container - with flex:1 and overflow */}
      <Box 
        sx={{ 
          flex: 1, 
          overflowY: 'auto', 
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0  // Critical for proper flex scrolling
        }}
      >
        {messages.length === 0 && (
          <Box sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
            <SmartToyIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              {selectedAgentId ? 'Start a conversation' : 'Select an agent to begin'}
            </Typography>
            <Typography variant="body2">
              {selectedAgentId 
                ? (portfolioId && selectedPortfolio
                    ? `I'll answer questions about "${selectedPortfolio.name}" using its projects, experiences, sections, and attachments in ${selectedLanguage?.name || 'the selected language'}.`
                    : `Ask me anything about the portfolios${selectedLanguage ? ` in ${selectedLanguage.name}` : ''}! You can scope to a specific portfolio above.`)
                : 'Choose an agent from the dropdown above'}
            </Typography>
          </Box>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble 
            key={idx} 
            message={msg} 
            onCopy={handleCopyMessage}
          />
        ))}

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Paper 
              sx={{ 
                p: 2, 
                maxWidth: '70%',
                bgcolor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Thinking...
              </Typography>
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area - Fixed at bottom with flexShrink: 0 */}
      <Paper 
        sx={{ 
          p: 1.5, 
          borderRadius: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          boxShadow: 3,
          flexShrink: 0  // Prevent input area from shrinking
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={getPlaceholder()}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!selectedAgentId || isLoading}
            inputRef={inputRef}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'white'
              }
            }}
          />
          <IconButton 
            color="primary" 
            onClick={handleSendMessage}
            disabled={!input.trim() || !selectedAgentId || isLoading}
            sx={{ 
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'grey.300' }
            }}
          >
            <SendIcon />
          </IconButton>
        </Stack>

        {sessionId && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Session: {sessionId}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

/**
 * Individual message bubble component
 */
function MessageBubble({ message, onCopy }) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 2
      }}
    >
      <Stack 
        direction={isUser ? 'row-reverse' : 'row'} 
        spacing={1}
        sx={{ maxWidth: '75%', alignItems: 'flex-start' }}
      >
        {/* Avatar */}
        <Avatar 
          sx={{ 
            bgcolor: isUser ? 'primary.main' : 'secondary.main',
            width: 32,
            height: 32
          }}
        >
          {isUser ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
        </Avatar>

        {/* Message Content */}
        <Paper
          elevation={isUser ? 1 : 0}
          sx={{
            p: 2,
            bgcolor: isUser ? 'primary.main' : (isError ? 'error.light' : 'grey.100'),
            color: isUser ? 'white' : 'text.primary',
            borderRadius: 2,
            position: 'relative'
          }}
        >
          {/* Message Text */}
          <Typography 
            variant="body1" 
            sx={{ 
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {message.content}
          </Typography>

          {/* Citations */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 1, bgcolor: 'grey.400' }} />
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Sources:
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                {message.citations.map((cite, idx) => (
                  <CitationChip key={idx} citation={cite} />
                ))}
              </Stack>
            </Box>
          )}

          {/* Metadata */}
          {!isUser && message.latency && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {message.latency}ms
            </Typography>
          )}

          {/* Copy Button */}
          <Tooltip title="Copy message">
            <IconButton
              size="small"
              onClick={() => onCopy(message.content)}
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                opacity: 0.5,
                '&:hover': { opacity: 1 }
              }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Paper>
      </Stack>
    </Box>
  );
}

/**
 * Citation chip with link to source
 */
function CitationChip({ citation }) {
  const handleClick = () => {
    if (citation.url) {
      // If URL is relative, construct full path
      const url = citation.url.startsWith('http') 
        ? citation.url 
        : window.location.origin + citation.url;
      window.open(url, '_blank');
    }
  };

  const title = citation.title || `${citation.type} #${citation.source_id}`;
  const preview = citation.preview || '';
  const score = citation.score ? ` (${(citation.score * 100).toFixed(0)}%)` : '';

  return (
    <Tooltip title={`${title}\n${preview}${score}`} arrow>
      <Chip
        size="small"
        label={title}
        icon={citation.url ? <OpenInNewIcon /> : undefined}
        onClick={citation.url ? handleClick : undefined}
        sx={{
          cursor: citation.url ? 'pointer' : 'default',
          maxWidth: 200,
          '& .MuiChip-label': {
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }
        }}
      />
    </Tooltip>
  );
}