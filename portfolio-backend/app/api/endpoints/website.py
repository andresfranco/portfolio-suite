"""
Website API endpoints - Public facing endpoints for portfolio website.
No authentication required for viewing content.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Any, Optional, List
from pydantic import BaseModel, Field
from app.api import deps
from app.crud import portfolio as portfolio_crud, experience as experience_crud
from app.schemas.portfolio import PortfolioOut
from app.schemas.experience import Experience as ExperienceSchema
from app.api.endpoints.portfolios import process_portfolios_for_response
from app.core.logging import setup_logger
from app.services.chat_service import run_agent_chat
from app.models.agent import Agent

# Set up logger
logger = setup_logger("app.api.endpoints.website")

# Define router
router = APIRouter()


class PublicPortfolioChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: Optional[int] = None
    language_id: Optional[int] = None


def _get_active_fallback_agent_ids(db: Session, exclude_agent_ids: List[int], limit: int = 3) -> List[int]:
    query = db.query(Agent.id).filter(Agent.is_active == True)
    if exclude_agent_ids:
        query = query.filter(~Agent.id.in_(exclude_agent_ids))
    rows = query.order_by(Agent.id.asc()).limit(limit).all()
    return [int(row[0]) for row in rows]


@router.get("/experiences", response_model=List[ExperienceSchema])
def get_public_experiences(
    language_code: Optional[str] = Query(None, description="Filter by language code (en, es, etc.)"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(100, ge=1, le=200, description="Number of items per page (max 200)"),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get all experiences for public website display.
    This endpoint is public and does not require authentication.
    Used in edit mode to select experiences to add to portfolio.
    
    Returns:
        List of experiences with their texts for all or specified language.
    """
    logger.info(f"Fetching public experiences - page: {page}, page_size: {page_size}, language: {language_code}")
    
    try:
        # Get experiences with pagination
        experiences, total = experience_crud.get_experiences_paginated(
            db=db,
            page=page,
            page_size=page_size,
            filters=None,
            sort_field="code",
            sort_order="asc"
        )
        
        # Filter by language if specified
        if language_code:
            filtered_experiences = []
            for exp in experiences:
                # Keep experience but filter its texts
                exp_dict = {
                    "id": exp.id,
                    "code": exp.code,
                    "years": exp.years,
                    "created_at": exp.created_at,
                    "updated_at": exp.updated_at,
                    "experience_texts": [
                        text for text in exp.experience_texts
                        if text.language and text.language.code == language_code
                    ]
                }
                # Only include if has texts for this language (or include all if filtering by language is not strict)
                if exp_dict["experience_texts"]:
                    filtered_experiences.append(exp_dict)
            
            logger.info(f"Retrieved {len(filtered_experiences)} experiences (filtered by language {language_code}) out of {total} total")
            return filtered_experiences
        
        logger.info(f"Retrieved {len(experiences)} experiences out of {total} total")
        return experiences
        
    except Exception as e:
        logger.error(f"Error retrieving public experiences: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving experiences: {str(e)}"
        )


@router.get("/default", response_model=PortfolioOut)
def get_default_portfolio(
    language_code: str = Query("en", description="Language code (en, es, etc.)"),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get default portfolio for website display with specified language.
    This endpoint is public and does not require authentication.
    
    Returns:
        Default portfolio with all content (experiences, projects, sections, etc.)
        filtered by the specified language.
    """
    logger.info(f"Fetching default portfolio for language: {language_code}")
    
    try:
        # Get default portfolio
        portfolios = portfolio_crud.get_portfolios(db)
        default_portfolio = next((p for p in portfolios if p.is_default), None)
        
        if not default_portfolio:
            logger.warning("No default portfolio found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No default portfolio configured"
            )
        
        # Process portfolio data
        result = process_portfolios_for_response([default_portfolio])
        
        if not result or len(result) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process portfolio data"
            )
        
        portfolio_data = result[0]
        
        # Filter content by language if specified
        if language_code and language_code != "all":
            portfolio_data = filter_by_language(portfolio_data, language_code)
        
        logger.info(f"Successfully retrieved default portfolio: {default_portfolio.name}")
        return portfolio_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving default portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving default portfolio: {str(e)}"
        )


@router.get("/portfolios/{portfolio_id}/public", response_model=PortfolioOut)
def get_public_portfolio(
    portfolio_id: int,
    language_code: str = Query("en", description="Language code (en, es, etc.)"),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get specific portfolio for public website display.
    This endpoint is public and does not require authentication.
    
    Args:
        portfolio_id: ID of the portfolio to retrieve
        language_code: Language code for filtering content
    
    Returns:
        Portfolio with all content filtered by the specified language.
    """
    logger.info(f"Fetching public portfolio {portfolio_id} for language: {language_code}")
    
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        
        if not portfolio:
            logger.warning(f"Portfolio {portfolio_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Portfolio with ID {portfolio_id} not found"
            )
        
        # Process portfolio data
        result = process_portfolios_for_response([portfolio])
        
        if not result or len(result) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process portfolio data"
            )
        
        portfolio_data = result[0]
        
        # Filter content by language if specified
        if language_code and language_code != "all":
            portfolio_data = filter_by_language(portfolio_data, language_code)
        
        logger.info(f"Successfully retrieved portfolio: {portfolio.name}")
        return portfolio_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving portfolio: {str(e)}"
        )


def filter_by_language(portfolio_data: dict, language_code: str) -> dict:
    """
    Filter portfolio content to only include texts for the specified language.
    
    Args:
        portfolio_data: Portfolio dictionary with all content
        language_code: Language code to filter by (e.g., "en", "es")
    
    Returns:
        Portfolio data with content filtered by language
    """
    logger.debug(f"Filtering portfolio content for language: {language_code}")
    
    # Filter category texts
    if "categories" in portfolio_data:
        for category in portfolio_data["categories"]:
            if "category_texts" in category:
                category["category_texts"] = [
                    text for text in category["category_texts"]
                    if text.get("language", {}).get("code") == language_code
                ]
    
    # Filter experience texts
    if "experiences" in portfolio_data:
        for experience in portfolio_data["experiences"]:
            if "experience_texts" in experience:
                experience["experience_texts"] = [
                    text for text in experience["experience_texts"]
                    if text.get("language", {}).get("code") == language_code
                ]
    
    # Filter project texts
    if "projects" in portfolio_data:
        for project in portfolio_data["projects"]:
            if "project_texts" in project:
                project["project_texts"] = [
                    text for text in project["project_texts"]
                    if text.get("language", {}).get("code") == language_code
                ]

            # Filter skill texts within projects
            if "skills" in project:
                for skill in project["skills"]:
                    if "skill_texts" in skill:
                        skill["skill_texts"] = [
                            text for text in skill["skill_texts"]
                            if text.get("language", {}).get("code") == language_code
                        ]

            # Filter section texts within projects
            if "sections" in project:
                for section in project["sections"]:
                    if "section_texts" in section:
                        section["section_texts"] = [
                            text for text in section["section_texts"]
                            if text.get("language", {}).get("code") == language_code
                        ]
    
    # Filter section texts
    if "sections" in portfolio_data:
        for section in portfolio_data["sections"]:
            if "section_texts" in section:
                section["section_texts"] = [
                    text for text in section["section_texts"]
                    if text.get("language", {}).get("code") == language_code
                ]
    
    logger.debug(f"Filtered portfolio content for language: {language_code}")
    return portfolio_data


@router.post("/chat/portfolios/{portfolio_id}")
def chat_with_portfolio_agent(
    portfolio_id: int,
    payload: PublicPortfolioChatRequest,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Public chat endpoint for website visitors.
    Uses the portfolio's configured default agent.
    """
    logger.info(f"Website chat requested for portfolio {portfolio_id}")

    portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id, full_details=True)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio with ID {portfolio_id} not found"
        )

    candidate_agent_ids: List[int] = []
    if portfolio.default_agent_id:
        candidate_agent_ids.append(int(portfolio.default_agent_id))

    candidate_agent_ids.extend(
        _get_active_fallback_agent_ids(db, exclude_agent_ids=candidate_agent_ids, limit=5)
    )

    if not candidate_agent_ids:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No active AI agent is available for this portfolio"
        )

    attempt_errors: List[str] = []
    for attempt_index, candidate_agent_id in enumerate(candidate_agent_ids):
        try:
            result = run_agent_chat(
                db,
                agent_id=candidate_agent_id,
                user_message=payload.message,
                session_id=payload.session_id if attempt_index == 0 else None,
                portfolio_id=portfolio_id,
                language_id=payload.language_id,
                raise_on_provider_error=True,
            )
            result["agent_id"] = candidate_agent_id
            result["used_default_agent"] = bool(portfolio.default_agent_id) and candidate_agent_id == int(portfolio.default_agent_id)
            result["fallback_agent_used"] = bool(portfolio.default_agent_id) and candidate_agent_id != int(portfolio.default_agent_id)
            return result
        except ValueError as exc:
            err = f"agent={candidate_agent_id} value_error={str(exc)}"
            attempt_errors.append(err)
            logger.warning(f"Website chat attempt failed for portfolio {portfolio_id}: {err}")
            continue
        except Exception as exc:
            err = f"agent={candidate_agent_id} runtime_error={str(exc)}"
            attempt_errors.append(err)
            logger.warning(f"Website chat attempt failed for portfolio {portfolio_id}: {err}")
            continue

    logger.error(
        f"All agent chat attempts failed for portfolio {portfolio_id}. "
        f"default_agent_id={portfolio.default_agent_id}, attempts={attempt_errors}"
    )
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="AI assistant is temporarily unavailable. Please try again."
    )
