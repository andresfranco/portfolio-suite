"""
Citation enrichment service for RAG responses.

Transforms raw citations (source_table + source_id + chunk_id) into user-friendly
metadata with titles, previews, URLs, and types for display in the chat UI.
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text


def enrich_citations(
    db: Session, 
    citations: List[Dict[str, Any]],
    language_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Transform raw citations into user-friendly metadata.
    
    Args:
        db: Database session
        citations: Raw citations from RAG service with:
            - source_table: Table name
            - source_id: Record ID
            - chunk_id: Chunk ID
            - score: Similarity score
        language_id: Optional language ID to filter multi-language content
            
    Returns:
        Enriched citations with:
            - title: Human-readable title
            - type: Source type (Project, Experience, etc.)
            - url: Link to view source (if applicable)
            - preview: Short description/context
            - metadata: Additional source-specific data
            - All original fields preserved
    """
    enriched = []
    
    for cite in citations:
        source_table = cite.get("source_table", "")
        source_id = cite.get("source_id", "")
        
        if not source_table or not source_id:
            # Skip malformed citations
            continue
        
        # Fetch metadata for this source (wrapped in try/catch for safety)
        try:
            metadata = _get_source_metadata(db, source_table, source_id, language_id=language_id)
        except Exception as e:
            # If metadata fetch fails, use defaults and continue
            metadata = {
                "title": f"{source_table} #{source_id}",
                "type": source_table.replace("_", " ").title(),
                "preview": ""
            }
        
        # Build enriched citation
        enriched.append({
            # Original fields
            "chunk_id": cite.get("chunk_id"),
            "source_table": source_table,
            "source_id": source_id,
            "score": cite.get("score", 0.0),
            
            # Enriched fields
            "title": metadata.get("title", f"{source_table} #{source_id}"),
            "type": metadata.get("type", source_table.replace("_", " ").title()),
            "url": metadata.get("url") or _build_source_url(source_table, source_id),
            "preview": metadata.get("preview", ""),
            "metadata": metadata
        })
    
    return enriched


def _get_source_metadata(
    db: Session, 
    source_table: str, 
    source_id: str,
    language_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Fetch human-readable metadata for a source.
    
    Args:
        db: Database session
        source_table: Name of the source table
        source_id: ID of the source record
        language_id: Optional language ID to filter multi-language content
    
    Returns a dict with: title, type, preview, url, and any other relevant fields.
    Always returns a valid dict, never raises exceptions.
    
    Each query uses its own savepoint to prevent transaction poisoning.
    """
    
    # Projects
    if source_table == "projects":
        savepoint = None
        try:
            # Create a savepoint to isolate this query
            savepoint = db.begin_nested()
            
            # Build language filter
            lang_filter = "AND pt.language_id = :lang_id" if language_id else ""
            params = {"id": source_id}
            if language_id:
                params["lang_id"] = language_id
            
            # Use correct column names: name and description (not title/short_description)
            result = db.execute(text(f"""  # nosec B608 - lang_filter is a hardcoded parameterized SQL fragment or empty string, no user data
                SELECT
                    p.id,
                    p.website_url as url,
                    pt.name as title,
                    pt.description
                FROM projects p
                LEFT JOIN project_texts pt ON pt.project_id = p.id {lang_filter}
                WHERE p.id = :id
                LIMIT 1
            """), params).mappings().first()
            
            if result:
                savepoint.commit()
                return {
                    "title": result["title"] or f"Project {source_id}",
                    "preview": (result["description"] or "")[:200],
                    "url": result["url"],
                    "type": "Project",
                    "project_id": result["id"]
                }
            else:
                savepoint.commit()
        except Exception as e:
            # Rollback the savepoint to clear the failed transaction state
            if savepoint:
                try:
                    savepoint.rollback()
                except Exception:
                    pass
            # Log error but continue with fallback
    
    # Experiences
    elif source_table == "experiences":
        savepoint = None
        try:
            savepoint = db.begin_nested()
            
            # Build language filter
            lang_filter = "AND et.language_id = :lang_id" if language_id else ""
            params = {"id": source_id}
            if language_id:
                params["lang_id"] = language_id
            
            # Use correct columns: code and years from experiences, name and description from experience_texts
            result = db.execute(text(f"""  # nosec B608 - lang_filter is a hardcoded parameterized SQL fragment or empty string, no user data
                SELECT
                    e.id,
                    e.code,
                    e.years,
                    et.name,
                    et.description
                FROM experiences e
                LEFT JOIN experience_texts et ON et.experience_id = e.id {lang_filter}
                WHERE e.id = :id
                LIMIT 1
            """), params).mappings().first()
            
            if result:
                savepoint.commit()
                years_text = f"{result['years']} years" if result.get('years') else ""
                return {
                    "title": result.get('name') or result.get('code') or f"Experience {source_id}",
                    "preview": f"{years_text}. {(result.get('description') or '')[:150]}".strip(),
                    "type": "Experience",
                    "code": result.get("code"),
                    "years": result.get("years")
                }
            else:
                savepoint.commit()
        except Exception as e:
            if savepoint:
                try:
                    savepoint.rollback()
                except Exception:
                    pass
    
    # Portfolios
    elif source_table == "portfolios":
        savepoint = None
        try:
            savepoint = db.begin_nested()
            result = db.execute(text("""
                SELECT 
                    id, 
                    name,
                    description
                FROM portfolios
                WHERE id = :id
            """), {"id": source_id}).mappings().first()
            
            if result:
                savepoint.commit()
                return {
                    "title": result["name"] or f"Portfolio {source_id}",
                    "preview": (result.get("description") or "")[:200],
                    "type": "Portfolio"
                }
            else:
                savepoint.commit()
        except Exception as e:
            if savepoint:
                try:
                    savepoint.rollback()
                except Exception:
                    pass
    
    # Sections
    elif source_table == "sections":
        savepoint = None
        try:
            savepoint = db.begin_nested()
            
            # Build language filter
            lang_filter = "AND st.language_id = :lang_id" if language_id else ""
            params = {"id": source_id}
            if language_id:
                params["lang_id"] = language_id
            
            # Use correct column names: code from sections, text from section_texts
            result = db.execute(text(f"""  # nosec B608 - lang_filter is a hardcoded parameterized SQL fragment or empty string, no user data
                SELECT
                    s.id,
                    s.code,
                    st.text
                FROM sections s
                LEFT JOIN section_texts st ON st.section_id = s.id {lang_filter}
                WHERE s.id = :id
                LIMIT 1
            """), params).mappings().first()
            
            if result:
                savepoint.commit()
                return {
                    "title": result["code"] or f"Section {source_id}",
                    "preview": (result.get("text") or "")[:200],
                    "type": "Section"
                }
            else:
                savepoint.commit()
        except Exception as e:
            if savepoint:
                try:
                    savepoint.rollback()
                except Exception:
                    pass
    
    # Portfolio Attachments
    elif source_table == "portfolio_attachments":
        savepoint = None
        try:
            savepoint = db.begin_nested()
            result = db.execute(text("""
                SELECT 
                    id, 
                    file_name, 
                    file_path
                FROM portfolio_attachments
                WHERE id = :id
            """), {"id": source_id}).mappings().first()
            
            if result:
                savepoint.commit()
                return {
                    "title": result["file_name"] or f"Document {source_id}",
                    "preview": "Attached document",
                    "type": "Document",
                    "file_name": result["file_name"],
                    "file_path": result["file_path"]
                }
            else:
                savepoint.commit()
        except Exception as e:
            if savepoint:
                try:
                    savepoint.rollback()
                except Exception:
                    pass
    
    # Project Attachments
    elif source_table == "project_attachments":
        savepoint = None
        try:
            savepoint = db.begin_nested()
            
            # Use provided language_id or default to 1
            lang_id = language_id or 1
            
            result = db.execute(text("""
                SELECT 
                    pa.id, 
                    pa.file_name, 
                    pa.file_path,
                    p.id as project_id,
                    COALESCE(pt.name, p.id::text) as project_title
                FROM project_attachments pa
                LEFT JOIN projects p ON pa.project_id = p.id
                LEFT JOIN project_texts pt ON pt.project_id = p.id AND pt.language_id = :lang_id
                WHERE pa.id = :id
            """), {"id": source_id, "lang_id": lang_id}).mappings().first()
            
            if result:
                savepoint.commit()
                return {
                    "title": result["file_name"] or f"Document {source_id}",
                    "preview": f"From project: {result.get('project_title', 'Unknown')}",
                    "type": "Project Document",
                    "file_name": result["file_name"],
                    "file_path": result["file_path"],
                    "project_id": result.get("project_id")
                }
            else:
                savepoint.commit()
        except Exception as e:
            if savepoint:
                try:
                    savepoint.rollback()
                except Exception:
                    pass
    
    # Skills
    elif source_table == "skills":
        savepoint = None
        try:
            savepoint = db.begin_nested()
            
            # Build language filter
            lang_filter = "AND st.language_id = :lang_id" if language_id else ""
            params = {"id": source_id}
            if language_id:
                params["lang_id"] = language_id
            
            # Simplified query
            result = db.execute(text(f"""  # nosec B608 - lang_filter is a hardcoded parameterized SQL fragment or empty string, no user data
                SELECT
                    s.id,
                    st.name,
                    st.description,
                    s.proficiency_level
                FROM skills s
                LEFT JOIN skill_texts st ON st.skill_id = s.id {lang_filter}
                WHERE s.id = :id
                LIMIT 1
            """), params).mappings().first()
            
            if result:
                savepoint.commit()
                level = result.get("proficiency_level") or "Unknown level"
                return {
                    "title": result["name"] or f"Skill {source_id}",
                    "preview": f"Proficiency: {level}. {(result.get('description') or '')[:100]}",
                    "type": "Skill"
                }
            else:
                savepoint.commit()
        except Exception as e:
            if savepoint:
                try:
                    savepoint.rollback()
                except Exception:
                    pass
    
    # Fallback for unknown or unsupported source types
    return {
        "title": f"{source_table.replace('_', ' ').title()} #{source_id}",
        "preview": "",
        "type": source_table.replace("_", " ").title()
    }


def _build_source_url(source_table: str, source_id: str) -> Optional[str]:
    """
    Generate an admin panel link to view the source (if applicable).
    
    Returns relative URL path or None if not viewable.
    """
    url_map = {
        "projects": f"/admin/projects/{source_id}",
        "experiences": f"/admin/experiences/{source_id}",
        "portfolios": f"/admin/portfolios/{source_id}",
        "sections": f"/admin/sections/{source_id}",
        "skills": f"/admin/skills/{source_id}",
        "project_attachments": f"/admin/attachments/project/{source_id}",
        "portfolio_attachments": f"/admin/attachments/portfolio/{source_id}"
    }
    
    return url_map.get(source_table)


def deduplicate_citations(citations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove duplicate citations based on source_table + source_id.
    
    Keeps the citation with the highest score for each unique source.
    
    Args:
        citations: List of citation dicts
        
    Returns:
        Deduplicated list
    """
    if not citations:
        return []
    
    # Group by (source_table, source_id)
    seen = {}
    for cite in citations:
        key = (cite.get("source_table"), cite.get("source_id"))
        score = cite.get("score", 0.0)
        
        if key not in seen or score > seen[key].get("score", 0.0):
            seen[key] = cite
    
    # Return sorted by score (descending)
    return sorted(seen.values(), key=lambda c: c.get("score", 0.0), reverse=True)
