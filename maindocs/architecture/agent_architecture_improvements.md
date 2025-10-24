# Agent Admin Architecture Review & Improvements

> **Goal:** Transform the Agent admin module into a production-ready RAG assistant that provides clear, natural language answers like ChatGPT, with proper citations, source verification, and excellent UX.

---

## Current Architecture Analysis

### Backend (FastAPI) ✅ Strong Foundation

**Current Structure:**
```
portfolio-backend/
├── app/
│   ├── api/endpoints/agents.py         # CRUD endpoints for agents, credentials, templates
│   ├── services/
│   │   ├── chat_service.py             # Main chat orchestration
│   │   ├── rag_service.py              # Vector search & embedding
│   │   └── llm/providers.py            # Multi-provider LLM support
│   ├── models/agent.py                 # SQLAlchemy models
│   ├── schemas/agent.py                # Pydantic request/response models
│   └── rag/indexer.py                  # Content indexing pipeline
```

**Strengths:**
- ✅ Multi-provider LLM support (OpenAI, Anthropic, Google, Mistral)
- ✅ PostgreSQL vector search with pgvector
- ✅ Encrypted credential storage (pgcrypto)
- ✅ RAG pipeline with embedding → retrieval → context assembly
- ✅ Session and message persistence
- ✅ Portfolio-scoped retrieval
- ✅ RBAC with `MANAGE_AGENTS` permission

**Gaps Identified:**
- ❌ No response streaming (long waits for users)
- ❌ Limited response formatting (returns raw LLM output)
- ❌ Basic citation format (just source_table + source_id)
- ❌ No conversation context management
- ❌ Missing retry logic for failed LLM calls
- ❌ No source document preview/linking

---

### Frontend (React) ⚠️ Needs Enhancement

**Current Structure:**
```
backend-ui/src/
├── components/agents/
│   └── AgentsIndex.js                  # Basic admin panel for testing
├── contexts/
│   └── AgentAdminContext.js            # State management
└── services/
    └── agentAdminApi.js                # API client
```

**Strengths:**
- ✅ Permission-gated access
- ✅ Credential and agent management UI
- ✅ Template configuration
- ✅ Basic test interface

**Gaps Identified:**
- ❌ No dedicated chat interface (only test panel)
- ❌ No conversation history display
- ❌ No message bubbles (user/assistant)
- ❌ No citation linking to source documents
- ❌ No streaming support
- ❌ No typing indicators
- ❌ No copy/share functionality
- ❌ No markdown rendering for formatted responses

---

## Improvement Plan

### Phase 1: Enhanced Response Generation (Backend)

#### 1.1 Improved Prompt Engineering

**Problem:** Current system prompts are generic and don't guide the LLM to produce ChatGPT-quality answers.

**Solution:** Create specialized prompt templates that:
- Guide natural, conversational tone
- Enforce citation formatting
- Handle edge cases (no context, partial matches)
- Structure answers with sections when appropriate

**Implementation:**
```python
# portfolio-backend/app/services/prompt_builder.py

SYSTEM_PROMPTS = {
    "conversational": """You are a helpful AI assistant with access to a professional portfolio database.

Your role:
- Answer questions clearly and naturally, as if speaking to a colleague
- Always base your answers ONLY on the provided Context
- If the Context doesn't contain the answer, say "I don't have information about that in the portfolio"
- When listing items, use a clear, readable format
- Cite your sources naturally (e.g., "According to the React Dashboard project...")

Guidelines:
- Be concise but complete
- Use bullet points for lists
- Structure longer answers with clear sections
- Never make up information
""",
    
    "technical": """You are a technical documentation assistant for a professional portfolio.

Your role:
- Provide precise, technical answers based on the Context
- Include relevant details like technologies, frameworks, and methodologies
- Structure technical answers clearly
- Always cite specific projects or experiences

If the Context lacks details, acknowledge it rather than speculating.
""",
    
    "summary": """You are an executive summary assistant for a professional portfolio.

Your role:
- Provide high-level overviews and summaries
- Focus on key accomplishments and skills
- Use clear, professional language
- Highlight relevant experience patterns

Base all summaries strictly on the Context provided.
"""
}

def build_rag_prompt(
    user_message: str,
    context: str,
    citations: List[Dict],
    template_style: str = "conversational"
) -> List[Dict[str, str]]:
    """Build a prompt optimized for natural RAG responses."""
    
    system_prompt = SYSTEM_PROMPTS.get(template_style, SYSTEM_PROMPTS["conversational"])
    
    # Format context with source hints
    formatted_context = _format_context_with_sources(context, citations)
    
    user_prompt = f"""Context (from portfolio database):
{formatted_context}

Question: {user_message}

Please provide a clear, natural answer based on the Context above."""
    
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

def _format_context_with_sources(context: str, citations: List[Dict]) -> str:
    """Add source metadata to context chunks for better citation."""
    # Split context by separator and pair with citations
    chunks = context.split("\n\n---\n\n")
    formatted = []
    
    for i, (chunk, cite) in enumerate(zip(chunks, citations)):
        source_label = f"[Source: {cite['source_table']} #{cite['source_id']}]"
        formatted.append(f"{source_label}\n{chunk}")
    
    return "\n\n---\n\n".join(formatted)
```

#### 1.2 Enhanced Citation System

**Problem:** Citations are just `{source_table, source_id, chunk_id}` — not user-friendly.

**Solution:** Enrich citations with human-readable metadata:

```python
# portfolio-backend/app/services/citation_service.py

def enrich_citations(db: Session, citations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Transform raw citations into user-friendly metadata."""
    enriched = []
    
    for cite in citations:
        source_table = cite["source_table"]
        source_id = cite["source_id"]
        
        metadata = _get_source_metadata(db, source_table, source_id)
        
        enriched.append({
            "chunk_id": cite["chunk_id"],
            "source_type": source_table,
            "source_id": source_id,
            "title": metadata.get("title") or metadata.get("name"),
            "url": _build_source_url(source_table, source_id),
            "preview": metadata.get("preview", ""),
            "score": cite["score"],
            "metadata": metadata
        })
    
    return enriched

def _get_source_metadata(db: Session, source_table: str, source_id: str) -> Dict[str, Any]:
    """Fetch human-readable metadata for a source."""
    
    if source_table == "projects":
        result = db.execute(text("""
            SELECT p.id, pt.title, pt.short_description, p.url
            FROM projects p
            LEFT JOIN project_texts pt ON pt.project_id = p.id AND pt.language_id = 1
            WHERE p.id = :id
        """), {"id": source_id}).mappings().first()
        
        if result:
            return {
                "title": result["title"] or f"Project {source_id}",
                "preview": result["short_description"],
                "url": result["url"],
                "type": "Project"
            }
    
    elif source_table == "experiences":
        result = db.execute(text("""
            SELECT e.id, e.title, e.company, e.start_date, e.end_date
            FROM experiences e
            WHERE e.id = :id
        """), {"id": source_id}).mappings().first()
        
        if result:
            return {
                "title": f"{result['title']} at {result['company']}",
                "preview": f"{result['start_date']} - {result['end_date'] or 'Present'}",
                "type": "Experience"
            }
    
    elif source_table == "portfolio_attachments":
        result = db.execute(text("""
            SELECT id, file_name, file_path
            FROM portfolio_attachments
            WHERE id = :id
        """), {"id": source_id}).mappings().first()
        
        if result:
            return {
                "title": result["file_name"],
                "preview": "Attached document",
                "file_path": result["file_path"],
                "type": "Document"
            }
    
    # Fallback
    return {
        "title": f"{source_table} #{source_id}",
        "preview": "",
        "type": source_table.replace("_", " ").title()
    }

def _build_source_url(source_table: str, source_id: str) -> Optional[str]:
    """Generate a link to view the source (if applicable)."""
    
    url_map = {
        "projects": f"/admin/projects/{source_id}",
        "experiences": f"/admin/experiences/{source_id}",
        "portfolios": f"/admin/portfolios/{source_id}",
        "project_attachments": f"/admin/attachments/project/{source_id}",
        "portfolio_attachments": f"/admin/attachments/portfolio/{source_id}"
    }
    
    return url_map.get(source_table)
```

#### 1.3 Streaming Response Support

**Problem:** Long responses cause 30-90 second waits with no feedback.

**Solution:** Implement Server-Sent Events (SSE) for streaming:

```python
# portfolio-backend/app/api/endpoints/agents.py

from fastapi.responses import StreamingResponse
import json

@router.post("/{agent_id}/chat/stream")
async def agent_chat_stream(
    *,
    db: Session = Depends(deps.get_db),
    agent_id: int,
    payload: ChatRequest,
    current_user=Depends(deps.get_current_user),
):
    """Stream agent responses token-by-token (SSE)."""
    
    async def generate():
        try:
            # Yield initial metadata
            yield f"data: {json.dumps({'type': 'start'})}\n\n"
            
            # Stream LLM response
            async for chunk in run_agent_chat_streaming(
                db, 
                agent_id=agent_id, 
                user_message=payload.message,
                session_id=payload.session_id,
                portfolio_id=payload.portfolio_id
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
            
            # Yield completion
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")
```

---

### Phase 2: Dedicated Chat Interface (Frontend)

#### 2.1 ChatGPT-like Conversation UI

**Create:** `backend-ui/src/components/agents/AgentChatInterface.js`

**Features:**
- Message bubbles (user/assistant)
- Typing indicators
- Citation pills/cards
- Markdown rendering
- Copy/share buttons
- Session switching
- Mobile-responsive

**Key Components:**

```jsx
// backend-ui/src/components/agents/AgentChatInterface.js

import React, { useState, useEffect, useRef } from 'react';
import {
  Box, TextField, IconButton, Paper, Typography, Stack,
  Chip, Tooltip, CircularProgress, Avatar
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReactMarkdown from 'react-markdown';

export default function AgentChatInterface({ agentId, portfolioId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    // Add placeholder for assistant
    const assistantMessage = {
      role: 'assistant',
      content: '',
      citations: [],
      isStreaming: true,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch(
        `/api/agents/${agentId}/chat/stream`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: input,
            session_id: sessionId,
            portfolio_id: portfolioId
          })
        }
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'token') {
              // Append token to last message
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                last.content += data.content;
                return updated;
              });
            } else if (data.type === 'citations') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                last.citations = data.citations;
                return updated;
              });
            } else if (data.type === 'done') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                last.isStreaming = false;
                return updated;
              });
              if (data.session_id) setSessionId(data.session_id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        last.content = 'Sorry, an error occurred. Please try again.';
        last.isStreaming = false;
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Messages */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Paper sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            placeholder="Ask me anything about the portfolio..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            multiline
            maxRows={4}
            disabled={isStreaming}
          />
          <IconButton 
            color="primary" 
            onClick={sendMessage} 
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </Stack>
      </Paper>
    </Box>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', mb: 2 }}>
      <Paper
        sx={{
          p: 2,
          maxWidth: '70%',
          backgroundColor: isUser ? 'primary.main' : 'grey.100',
          color: isUser ? 'white' : 'text.primary'
        }}
      >
        {isUser ? (
          <Typography variant="body1">{message.content}</Typography>
        ) : (
          <>
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {message.isStreaming && <CircularProgress size={16} sx={{ ml: 1 }} />}
            {message.citations && message.citations.length > 0 && (
              <CitationChips citations={message.citations} />
            )}
          </>
        )}
      </Paper>
    </Box>
  );
}

function CitationChips({ citations }) {
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
      {citations.map((cite, idx) => (
        <Tooltip key={idx} title={cite.preview || cite.title}>
          <Chip
            size="small"
            label={cite.title || `Source ${idx + 1}`}
            icon={<OpenInNewIcon />}
            onClick={() => cite.url && window.open(cite.url, '_blank')}
            sx={{ cursor: cite.url ? 'pointer' : 'default' }}
          />
        </Tooltip>
      ))}
    </Stack>
  );
}
```

#### 2.2 Enhanced Agent Selection Panel

**Create:** `backend-ui/src/components/agents/AgentSelector.js`

```jsx
// Dropdown to select agent + portfolio scope
// Shows agent name, description, and active status
// Option to scope to specific portfolio
```

---

### Phase 3: Conversation Context Management

#### 3.1 Multi-Turn Conversations

**Problem:** Each query is independent; no memory of previous questions.

**Solution:** Include recent conversation history in context:

```python
# portfolio-backend/app/services/chat_service.py

def run_agent_chat(db: Session, *, agent_id: int, user_message: str, session_id: int | None, ...) -> Dict[str, Any]:
    # ... existing code ...
    
    # Load recent conversation history
    history = _load_session_history(db, session_id, limit=5) if session_id else []
    
    # Build messages with history
    messages = []
    if history:
        messages.extend([
            {"role": msg.role, "content": msg.content}
            for msg in history[-4:]  # Last 2 turns (user + assistant)
        ])
    
    # Add current query with context
    messages.append({
        "role": "user",
        "content": f"Context:\n{context}\n\nQuestion: {user_text}"
    })
    
    # ... LLM call ...
```

---

## Implementation Roadmap

### Week 1: Backend Enhancements
- [ ] Day 1-2: Implement `prompt_builder.py` with specialized templates
- [ ] Day 3-4: Create `citation_service.py` with metadata enrichment
- [ ] Day 5: Add streaming endpoint `/chat/stream`

### Week 2: Frontend Chat UI
- [ ] Day 1-2: Build `AgentChatInterface.js` with message bubbles
- [ ] Day 3: Add streaming support in frontend
- [ ] Day 4: Implement citation chips with links
- [ ] Day 5: Add markdown rendering and copy buttons

### Week 3: Polish & Testing
- [ ] Day 1-2: Conversation history management
- [ ] Day 3: Mobile responsive design
- [ ] Day 4-5: End-to-end testing and bug fixes

---

## Success Metrics

1. **Response Quality**
   - Natural language answers (vs technical JSON)
   - Accurate citations with titles (not just IDs)
   - Proper handling of "I don't know" cases

2. **User Experience**
   - <2 second time-to-first-token (streaming)
   - Clear citation links to source documents
   - Mobile-friendly interface

3. **System Reliability**
   - 95%+ successful RAG retrievals
   - Graceful fallbacks on LLM errors
   - Session persistence across page refreshes

---

## Example Interaction (Target State)

**User:** "What projects have I worked on with React?"

**Assistant:** "Based on your portfolio, you've worked on several React projects:

1. **React Dashboard** - A modern admin dashboard using React 19, Material-UI, and TanStack Query for data management. This project features role-based access control and multi-language support.

2. **Portfolio Suite** - A full-stack monorepo with a React admin panel that implements JWT authentication, file upload management, and an AI chat assistant.

3. **E-Commerce Platform** - Built with React and TypeScript, featuring a shopping cart, checkout flow, and integration with Stripe for payments.

All projects demonstrate proficiency in modern React patterns, state management, and component architecture.

*Sources: [React Dashboard](#), [Portfolio Suite](#), [E-Commerce Platform](#)*"

---

## Security Considerations

- ✅ All chat endpoints require authentication
- ✅ RBAC enforced (`MANAGE_AGENTS` or public chat permission)
- ✅ API keys encrypted at rest (pgcrypto)
- ✅ Rate limiting on chat endpoints (prevent abuse)
- ✅ Portfolio-scoped access (users only see their data)
- ✅ Input sanitization (prevent injection)
- ✅ No PII in logs or embeddings

---

## Next Steps

1. **Review this plan** with the team
2. **Prioritize phases** based on immediate needs
3. **Spike on streaming** (FastAPI SSE + React EventSource)
4. **Design mockups** for chat UI
5. **Set up feature branch** for Agent improvements

---

## References

- [FastAPI Streaming Responses](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)
- [React Markdown](https://remarkjs.github.io/react-markdown/)
- [Material-UI Chat Examples](https://mui.com/material-ui/react-app-bar/)
- [OpenAI Streaming Best Practices](https://platform.openai.com/docs/api-reference/streaming)
