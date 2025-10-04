"""
Prompt building service for natural, ChatGPT-like RAG responses.

Provides specialized prompt templates and context formatting for clear,
conversational answers with proper citations.
"""

from typing import List, Dict, Any, Optional


# System prompts optimized for different interaction styles
SYSTEM_PROMPTS = {
    "conversational": """You are a helpful AI assistant with access to a professional portfolio database.

Your role:
- Answer questions clearly and naturally, as if speaking to a colleague
- Always base your answers ONLY on the provided Context sections
- If the Context doesn't contain the answer, politely say "I don't have information about that in the portfolio"
- When listing items, use clear, readable formatting
- Provide specific details from the Context when available

Guidelines for responses:
- Be concise but complete
- Use bullet points or numbered lists for multiple items
- Structure longer answers with clear sections
- Never make up or infer information not in the Context
- Use natural, friendly language (avoid technical jargon unless asked)
- When mentioning projects or experiences, include key details like technologies used
- NEVER mention internal codes, IDs, or technical metadata (like category codes, section codes, etc.)
- Only present information in natural, user-friendly language

Example good answers:
- "Based on the portfolio, there are 3 React projects: [specific names with brief details]"
- "The experience at Company X involved [specific responsibilities from context]"
- "I don't have information about Python projects in this portfolio"
""",
    
    "technical": """You are a technical documentation assistant for a professional portfolio.

Your role:
- Provide precise, technical answers based strictly on the Context
- Include relevant details like technologies, frameworks, methodologies, and architectures
- Structure technical answers clearly with proper terminology
- Always cite specific projects or experiences when providing examples
- Use technical accuracy over simplicity
- NEVER mention internal codes, IDs, or database metadata (like category codes, section codes, etc.)

Guidelines:
- List technologies and tools explicitly mentioned
- Include version numbers, frameworks, and platforms when available
- Describe technical implementations when asked
- Acknowledge gaps: if technical details aren't in Context, say so
- Use industry-standard terminology
- Focus on technical content, not internal database identifiers

Example good answers:
- "The React Dashboard project uses React 19, Material-UI, and TanStack Query for state management. The backend is FastAPI with PostgreSQL and SQLAlchemy 2.x async sessions."
- "Based on the Context, the authentication uses JWT tokens with OAuth2 Bearer flow and argon2 password hashing."
""",
    
    "summary": """You are an executive summary assistant for a professional portfolio.

Your role:
- Provide high-level overviews and summaries based on the Context
- Focus on key accomplishments, skills, and impact
- Use clear, professional language suitable for recruiters or executives
- Highlight patterns across multiple projects/experiences when relevant
- Synthesize information rather than listing everything
- NEVER mention internal codes, IDs, or database metadata

Guidelines:
- Emphasize results and impact when available
- Group similar experiences or skills
- Use business-friendly language
- Keep summaries concise (2-4 sentences for brief, 1-2 paragraphs for detailed)
- If Context lacks strategic details, focus on what's available
- Present information naturally without revealing internal identifiers

Example good answers:
- "The portfolio demonstrates strong full-stack expertise, with 5+ projects using React/TypeScript frontends paired with FastAPI/Python backends. Key strengths include API design, database optimization, and cloud deployment."
- "Experience spans 3 companies over 5 years, with progressive responsibility from junior developer to technical lead. Consistent focus on scalable architecture and team collaboration."
""",

    "default": """You are a helpful portfolio assistant. Answer questions clearly and accurately based on the provided Context. If the Context doesn't contain the answer, say so. Be natural and conversational. Never mention internal codes, IDs, or technical metadata - only present information in user-friendly language."""
}


def build_rag_prompt(
    user_message: str,
    context: str,
    citations: List[Dict[str, Any]],
    template_style: str = "conversational",
    conversation_history: Optional[List[Dict[str, str]]] = None,
    language_name: Optional[str] = None
) -> List[Dict[str, str]]:
    """
    Build an optimized prompt for natural RAG responses.
    
    Args:
        user_message: The user's current question
        context: Assembled context text from RAG retrieval
        citations: List of citation metadata
        template_style: One of 'conversational', 'technical', 'summary', 'default'
        conversation_history: Optional recent conversation turns for context
        language_name: Optional language name to enforce response language (e.g., "English", "Spanish")
        
    Returns:
        List of message dicts in OpenAI chat format
    """
    # Select system prompt
    system_prompt = SYSTEM_PROMPTS.get(template_style, SYSTEM_PROMPTS["default"])
    
    # Add language enforcement if specified
    if language_name:
        system_prompt = f"""{system_prompt}

CRITICAL LANGUAGE REQUIREMENT:
You MUST respond ONLY in {language_name}. This is MANDATORY and NON-NEGOTIABLE:
- ALL text in your response must be in {language_name}
- Translate ALL project titles, names, headings, and descriptions to {language_name}
- Translate ALL content from the Context to {language_name}, regardless of its original language
- Do NOT keep any text in other languages, even if they appear to be proper names or titles
- Do NOT mix languages under any circumstances
- If the Context contains text in Spanish/English/other languages, you MUST translate it to {language_name}
- Your ENTIRE response from start to finish must be readable by someone who ONLY speaks {language_name}"""
    
    # Format context with source labels for better citation
    formatted_context = _format_context_with_sources(context, citations)
    
    # Build message list
    messages = [
        {"role": "system", "content": system_prompt}
    ]
    
    # Add recent conversation history (last 2-3 turns) for context
    if conversation_history:
        # Only include recent turns to avoid token bloat
        recent_history = conversation_history[-6:]  # Last 3 exchanges (user + assistant)
        messages.extend(recent_history)
    
    # Add current query with context
    user_prompt = f"""Context from portfolio database:

{formatted_context}

---

User Question: {user_message}

Please provide a clear, helpful answer based on the Context above. Remember to only use information from the Context."""
    
    messages.append({"role": "user", "content": user_prompt})
    
    return messages


def _format_context_with_sources(context: str, citations: List[Dict[str, Any]]) -> str:
    """
    Add source metadata to context chunks for better LLM citation.
    
    The context assembly service joins chunks with '\n\n---\n\n'.
    We pair each chunk with its citation metadata so the LLM knows which
    source each piece came from.
    """
    if not context or not citations:
        return context or ""
    
    # Split context by the standard separator
    chunks = context.split("\n\n---\n\n")
    
    # Pair chunks with citations (may have fewer chunks than citations due to truncation)
    formatted = []
    for i, chunk in enumerate(chunks):
        if i < len(citations):
            cite = citations[i]
            source_label = _format_source_label(cite)
            formatted.append(f"{source_label}\n{chunk}")
        else:
            # Chunk without citation (shouldn't happen, but handle gracefully)
            formatted.append(chunk)
    
    return "\n\n---\n\n".join(formatted)


def _format_source_label(citation: Dict[str, Any]) -> str:
    """
    Create a human-readable source label for the LLM.
    
    Examples:
    - [Source: Project #123]
    - [Source: Experience - Software Engineer at TechCorp]
    - [Source: Document - Resume.pdf]
    """
    source_table = citation.get("source_table", "unknown")
    source_id = citation.get("source_id", "?")
    
    # Basic label format
    label = f"[Source: {source_table} #{source_id}]"
    
    # If we have enriched metadata (added by citation service), use it
    if "title" in citation and citation["title"]:
        label = f"[Source: {citation['title']}]"
    elif "metadata" in citation and citation["metadata"].get("title"):
        label = f"[Source: {citation['metadata']['title']}]"
    
    return label


def build_fallback_prompt(user_message: str) -> str:
    """
    Generate a friendly fallback response when RAG retrieval returns no results.
    
    Args:
        user_message: The user's question
        
    Returns:
        A polite, helpful fallback message
    """
    # Check if question is asking about specific types of content
    lower_msg = user_message.lower()
    
    if any(word in lower_msg for word in ["project", "work", "built", "developed"]):
        return """I don't have information about that in the portfolio. 

The portfolio may not include projects matching your query, or the content might not be indexed yet. Try asking about:
- Specific project names you know exist
- Technologies or skills (e.g., "What React projects are there?")
- General experience or background

If this portfolio is new, some content may still be processing."""
    
    elif any(word in lower_msg for word in ["experience", "worked", "job", "company"]):
        return """I don't have information about that work experience in the portfolio.

Try asking about:
- Specific company names
- Job titles or roles
- Time periods (e.g., "What did you do in 2023?")"""
    
    elif any(word in lower_msg for word in ["skill", "technology", "framework", "language"]):
        return """I don't have information about that technology or skill in the portfolio.

The portfolio may not include projects using that technology, or it might not be indexed yet. Try asking about:
- General skill areas (frontend, backend, cloud, etc.)
- Specific projects to see what technologies they use"""
    
    else:
        return """I don't have information about that in the portfolio.

This could mean:
- The information isn't in the portfolio yet
- The content hasn't been indexed
- The question is outside the portfolio scope

Try rephrasing your question or asking about specific projects, experiences, or skills."""


def extract_conversational_history(
    messages: List[Any], 
    max_turns: int = 3
) -> List[Dict[str, str]]:
    """
    Extract recent conversation history from AgentMessage objects.
    
    Args:
        messages: List of AgentMessage SQLAlchemy objects
        max_turns: Maximum number of exchanges to include (user + assistant pairs)
        
    Returns:
        List of message dicts in chat format
    """
    if not messages:
        return []
    
    # Take most recent messages
    recent = messages[-(max_turns * 2):]
    
    # Convert to chat format
    history = []
    for msg in recent:
        history.append({
            "role": msg.role,
            "content": msg.content
        })
    
    return history
