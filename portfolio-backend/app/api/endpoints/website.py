"""
Website API endpoints - Public facing endpoints for portfolio website.
No authentication required for viewing content.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Any, Optional
from app.api import deps
from app.crud import portfolio as portfolio_crud
from app.schemas.portfolio import PortfolioOut
from app.api.endpoints.portfolios import process_portfolios_for_response
from app.core.logging import setup_logger

# Set up logger
logger = setup_logger("app.api.endpoints.website")

# Define router
router = APIRouter()


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
