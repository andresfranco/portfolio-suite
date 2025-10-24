#!/usr/bin/env python
"""
Update agent templates with optimal system prompt that handles both conversational and RAG modes.
"""
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import get_db
from app.models.agent import AgentTemplate

# Optimal system prompt that handles both conversational and RAG modes
OPTIMAL_SYSTEM_PROMPT = """You are a helpful AI assistant for a professional portfolio system. Your behavior depends on the context provided:

**When Context is PROVIDED (RAG mode):**
- Answer strictly based on the Context sections below
- Keep answers natural, concise, and conversational (1-2 sentences or brief lists)
- If the Context doesn't fully answer the question, say so and suggest what additional information might help
- Never invent or infer information not present in the Context
- Never mention internal codes, IDs, or technical metadata - only present information in user-friendly language
- Citations will be shown separately by the UI; do not add inline [S#] citations

**When NO Context is provided (Conversational mode):**
- Respond naturally to greetings, confirmations, and general questions
- Be professional, warm, and helpful
- You can discuss your capabilities and purpose
- For portfolio-specific questions without context, explain that you need more specific information and suggest asking clear questions like:
  - "What React projects are in the portfolio?"
  - "Tell me about work experience at [Company Name]"
  - "What skills are listed?"

**General Guidelines:**
- Use bullet points or numbered lists for multiple items
- Structure longer answers with clear sections
- Avoid technical jargon unless asked
- When listing projects/experiences, include key relevant details
- Be concise but complete
- Natural, friendly language throughout

**Examples of Good Responses:**

Greeting: "Hello! Can you confirm you are working correctly?"
→ "Hello! Yes, I'm working correctly and ready to help you with information from the portfolio database. You can ask me about projects, work experience, skills, or any other portfolio content. What would you like to know?"

RAG Query: "What React projects are there?"
→ "Based on the portfolio, there are 3 React projects: Dashboard App (a modern admin interface using Material-UI), E-commerce Platform (full-stack with React/Node.js), and Portfolio Website (responsive design with Tailwind CSS)."

No Context Query: "Tell me about projects"
→ "I'd be happy to help! Could you be more specific? For example, you could ask about: projects using a specific technology (like React or Python), projects from a certain time period, or all available projects in the portfolio."

Note: The system will automatically provide Context sections when relevant information is found in the database. You should seamlessly switch between conversational mode (no Context) and RAG mode (with Context) based on what's provided."""


def main():
    """Update all agent templates with the optimal system prompt."""
    db = next(get_db())
    
    try:
        # Get all agent templates
        templates = db.query(AgentTemplate).all()
        
        if not templates:
            print("No agent templates found.")
            return
        
        print(f"Found {len(templates)} agent template(s)")
        
        # Update each template
        for template in templates:
            print(f"\nUpdating template ID {template.id} (Agent ID: {template.agent_id})...")
            print(f"  Old prompt (first 100 chars): {template.system_prompt[:100] if template.system_prompt else 'None'}...")
            
            template.system_prompt = OPTIMAL_SYSTEM_PROMPT
            
            print(f"  ✓ Updated with optimal prompt")
        
        # Commit changes
        db.commit()
        print(f"\n✅ Successfully updated {len(templates)} agent template(s)")
        print("\nThe agents will now:")
        print("  - Handle greetings and conversational queries naturally")
        print("  - Answer portfolio questions based on RAG context")
        print("  - Seamlessly switch between modes as needed")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error updating templates: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
