from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Any, List, Optional, Dict
import os
import uuid
from datetime import datetime
from pathlib import Path
from app.crud import portfolio as portfolio_crud
from app.schemas.portfolio import (
    PortfolioOut, 
    PaginatedPortfolioResponse, 
    PortfolioCreate, 
    PortfolioUpdate, 
    PortfolioImageOut, 
    PortfolioImageCreate,
    PortfolioImageUpdate,
    PortfolioAttachmentOut,
    PortfolioAttachmentCreate,
    Filter
)
from app.models.portfolio import Portfolio as PortfolioModel
from app.api import deps
from app.core.config import settings
from app.core.logging import setup_logger
from app.core.security_decorators import require_permission, require_any_permission, permission_checker
from app import models
import traceback

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.portfolios")

# Define router
router = APIRouter()

def get_file_url(file_path: str) -> str:
    """Generate file URL from file path"""
    # Files are served at /uploads/, not /static/
    # Database paths are like: static/uploads/portfolios/3/images/file.png
    # We need to strip 'static/uploads/' and serve from '/uploads/'
    if file_path.startswith('static/uploads/'):
        # Strip 'static/uploads/' prefix and serve from '/uploads/'
        relative_path = file_path[len('static/uploads/'):]
        return f"/uploads/{relative_path}"
    elif file_path.startswith('uploads/'):
        # Already has uploads prefix, just add leading slash
        return f"/{file_path}"
    else:
        # Fallback: assume it's a relative path under uploads
        return f"/uploads/{file_path}"

# Helper function to process portfolios before sending them in the response
def process_portfolios_for_response(
    portfolios: List[PortfolioModel],
    *,
    include_images: bool = True,
    include_attachments: bool = True,
) -> List[Dict[str, Any]]:
    """
    Process the portfolio objects to ensure they can be properly serialized.
    Particularly important for handling relationships like categories, experiences, projects, etc.
    """
    processed_portfolios = []
    
    for portfolio in portfolios:
        try:
            # Create a dictionary with the portfolio's attributes
            portfolio_dict = {
                "id": portfolio.id,
                "name": portfolio.name,
                "description": portfolio.description,
                "created_at": portfolio.created_at,
                "updated_at": portfolio.updated_at,
                "categories": [],
                "experiences": [],
                "projects": [],
                "sections": [],
                "images": [],
                "attachments": []
            }
            
            # Process categories
            if hasattr(portfolio, 'categories') and portfolio.categories:
                for category in portfolio.categories:
                    cat_dict = {
                        "id": category.id,
                        "code": category.code,
                        "type_code": category.type_code,
                        "category_texts": []
                    }
                    
                    # Include category texts if they exist
                    if hasattr(category, 'category_texts') and category.category_texts:
                        for text in category.category_texts:
                            text_dict = {
                                "id": text.id,
                                "language_id": text.language_id,
                                "name": text.name,
                                "description": text.description
                            }
                            
                            # Convert the language object to a dictionary if it exists
                            if hasattr(text, "language") and text.language is not None:
                                language = text.language
                                text_dict["language"] = {
                                    "id": language.id,
                                    "code": language.code,
                                    "name": language.name,
                                    "is_default": language.is_default if hasattr(language, "is_default") else False,
                                    "created_at": language.created_at if hasattr(language, "created_at") else None,
                                    "updated_at": language.updated_at if hasattr(language, "updated_at") else None
                                }
                            
                            cat_dict["category_texts"].append(text_dict)
                    
                    portfolio_dict["categories"].append(cat_dict)
            
            # Process experiences
            if hasattr(portfolio, 'experiences') and portfolio.experiences:
                for experience in portfolio.experiences:
                    exp_dict = {
                        "id": experience.id,
                        "code": experience.code,
                        "years": experience.years,
                        "experience_texts": []
                    }
                    
                    # Include experience texts if they exist
                    if hasattr(experience, 'experience_texts') and experience.experience_texts:
                        for text in experience.experience_texts:
                            text_dict = {
                                "id": text.id,
                                "language_id": text.language_id,
                                "name": text.name,
                                "description": text.description
                            }
                            
                            # Convert the language object to a dictionary if it exists
                            if hasattr(text, "language") and text.language is not None:
                                language = text.language
                                text_dict["language"] = {
                                    "id": language.id,
                                    "code": language.code,
                                    "name": language.name,
                                    "is_default": language.is_default if hasattr(language, "is_default") else False,
                                    "created_at": language.created_at if hasattr(language, "created_at") else None,
                                    "updated_at": language.updated_at if hasattr(language, "updated_at") else None
                                }
                            
                            exp_dict["experience_texts"].append(text_dict)
                    
                    portfolio_dict["experiences"].append(exp_dict)
            
            # Process projects
            if hasattr(portfolio, 'projects') and portfolio.projects:
                for project in portfolio.projects:
                    proj_dict = {
                        "id": project.id,
                        "repository_url": project.repository_url,
                        "website_url": project.website_url,
                        "project_texts": [],
                        "categories": [],
                        "skills": []
                    }
                    
                    # Include project texts if they exist
                    if hasattr(project, 'project_texts') and project.project_texts:
                        for text in project.project_texts:
                            text_dict = {
                                "id": text.id,
                                "language_id": text.language_id,
                                "name": text.name,
                                "description": text.description
                            }
                            
                            # Convert the language object to a dictionary if it exists
                            if hasattr(text, "language") and text.language is not None:
                                language = text.language
                                text_dict["language"] = {
                                    "id": language.id,
                                    "code": language.code,
                                    "name": language.name,
                                    "is_default": language.is_default if hasattr(language, "is_default") else False,
                                    "created_at": language.created_at if hasattr(language, "created_at") else None,
                                    "updated_at": language.updated_at if hasattr(language, "updated_at") else None
                                }
                            
                            proj_dict["project_texts"].append(text_dict)
                    
                    portfolio_dict["projects"].append(proj_dict)
            
            # Process sections
            if hasattr(portfolio, 'sections') and portfolio.sections:
                for section in portfolio.sections:
                    sect_dict = {
                        "id": section.id,
                        "code": section.code,
                        "section_texts": []
                    }
                    
                    # Include section texts if they exist
                    if hasattr(section, 'section_texts') and section.section_texts:
                        for text in section.section_texts:
                            text_dict = {
                                "id": text.id,
                                "language_id": text.language_id,
                                "text": text.text
                            }
                            
                            # Convert the language object to a dictionary if it exists
                            if hasattr(text, "language") and text.language is not None:
                                language = text.language
                                text_dict["language"] = {
                                    "id": language.id,
                                    "code": language.code,
                                    "name": language.name,
                                    "is_default": language.is_default if hasattr(language, "is_default") else False,
                                    "created_at": language.created_at if hasattr(language, "created_at") else None,
                                    "updated_at": language.updated_at if hasattr(language, "updated_at") else None
                                }
                            
                            sect_dict["section_texts"].append(text_dict)
                    
                    portfolio_dict["sections"].append(sect_dict)
            
            # Process images (permission-aware)
            if include_images and hasattr(portfolio, 'images') and portfolio.images:
                for image in portfolio.images:
                    img_dict = {
                        "id": image.id,
                        "portfolio_id": image.portfolio_id,
                        "category": image.category,
                        "image_path": image.image_path,
                        "file_name": image.file_name,
                        "image_url": get_file_url(image.image_path) if image.image_path else None,
                        "created_at": image.created_at,
                        "updated_at": image.updated_at if hasattr(image, 'updated_at') else None
                    }
                    portfolio_dict["images"].append(img_dict)
            
            # Process attachments (permission-aware)
            if include_attachments and hasattr(portfolio, 'attachments') and portfolio.attachments:
                for attachment in portfolio.attachments:
                    att_dict = {
                        "id": attachment.id,
                        "portfolio_id": attachment.portfolio_id,
                        "file_name": attachment.file_name,
                        "file_path": attachment.file_path,
                        "file_url": get_file_url(attachment.file_path) if attachment.file_path else None,
                        "created_at": attachment.created_at,
                        "updated_at": attachment.updated_at if hasattr(attachment, 'updated_at') else None
                    }
                    portfolio_dict["attachments"].append(att_dict)
                
            processed_portfolios.append(portfolio_dict)
        except Exception as e:
            logger.error(f"Error processing portfolio {portfolio.id if hasattr(portfolio, 'id') else 'unknown'}: {e}")
            logger.error(f"Exception details: {traceback.format_exc()}")
            # Add basic info without the problematic fields
            portfolio_dict = {
                "id": portfolio.id if hasattr(portfolio, 'id') else None,
                "name": portfolio.name if hasattr(portfolio, 'name') else "",
                "description": portfolio.description if hasattr(portfolio, 'description') else "",
                "created_at": portfolio.created_at if hasattr(portfolio, 'created_at') else None,
                "updated_at": portfolio.updated_at if hasattr(portfolio, 'updated_at') else None,
                "categories": [],
                "experiences": [],
                "projects": [],
                "sections": [],
                "images": [],
                "attachments": []
            }
            processed_portfolios.append(portfolio_dict)
    
    return processed_portfolios

def process_single_portfolio_for_response(
    portfolio: PortfolioModel,
    *,
    include_images: bool = True,
    include_attachments: bool = True,
) -> Dict[str, Any]:
    """
    Process a single portfolio object for serialization.
    """
    processed_portfolios = process_portfolios_for_response(
        [portfolio],
        include_images=include_images,
        include_attachments=include_attachments,
    )
    return processed_portfolios[0] if processed_portfolios else None

@router.get("/", response_model=PaginatedPortfolioResponse)
@require_permission("VIEW_PORTFOLIOS")
def read_portfolios(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    name_filter: Optional[str] = Query(None, description="Filter by name"),
    description_filter: Optional[str] = Query(None, description="Filter by description"),
    filter_field: Optional[List[str]] = Query(None, description="Filter fields"),
    filter_value: Optional[List[str]] = Query(None, description="Filter values"),
    filter_operator: Optional[List[str]] = Query(None, description="Filter operators"),
    sort_field: Optional[str] = Query(None, description="Sort field"),
    sort_order: Optional[str] = Query("asc", regex="^(asc|desc)$", description="Sort order"),
    include_full_details: bool = Query(False, description="Include full portfolio details"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve portfolios with pagination and filtering.
    Supports both direct name/description filters and generic filter arrays.
    """
    logger.debug(f"Getting portfolios: page={page}, page_size={page_size}")
    
    try:
        # Build filters list
        filters = []
        
        # Add direct name and description filters
        if name_filter:
            filters.append(Filter(field="name", value=name_filter, operator="contains"))
        
        if description_filter:
            filters.append(Filter(field="description", value=description_filter, operator="contains"))
        
        # Add generic filters if provided
        if filter_field and filter_value:
            operators = filter_operator or ['contains'] * len(filter_field)
            for i, field in enumerate(filter_field):
                if i < len(filter_value):
                    operator = operators[i] if i < len(operators) else "contains"
                    try:
                        filters.append(Filter.from_params(
                            field=field,
                            value=filter_value[i], 
                            operator=operator
                        ))
                    except ValueError as e:
                        logger.warning(f"Invalid filter parameter: {str(e)}")
                        raise HTTPException(status_code=400, detail=str(e))
        
        # Get portfolios with pagination and filtering
        portfolios, total = portfolio_crud.get_portfolios_paginated(
            db=db,
            page=page,
            page_size=page_size,
            filters=filters,
            sort_field=sort_field,
            sort_order=sort_order
        )
        
        logger.info(f"Retrieved {len(portfolios)} portfolios (total: {total})")
        
        # Process portfolios to ensure proper serialization
        # Permission-aware inclusion of images/attachments
        can_view_images = permission_checker.user_has_permission(current_user, "VIEW_PORTFOLIO_IMAGES")
        can_view_attachments = permission_checker.user_has_permission(current_user, "VIEW_PORTFOLIO_ATTACHMENTS")
        processed_portfolios = process_portfolios_for_response(
            portfolios,
            include_images=can_view_images,
            include_attachments=can_view_attachments,
        )
        
        return {
            "items": processed_portfolios,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting portfolios: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting portfolios: {str(e)}"
        )

@router.get("/names", response_model=List[str])
@require_permission("VIEW_PORTFOLIOS")
def list_portfolio_names(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get list of all portfolio names.
    """
    logger.debug("Fetching all portfolio names")
    try:
        portfolios = portfolio_crud.get_portfolios(db)
        names = [portfolio.name for portfolio in portfolios if portfolio.name]
        logger.debug(f"Retrieved {len(names)} portfolio names")
        return names
    except Exception as e:
        logger.error(f"Error getting portfolio names: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting portfolio names: {str(e)}"
        )

@router.post("/", response_model=PortfolioOut, status_code=status.HTTP_201_CREATED)
@require_permission("CREATE_PORTFOLIO")
def create_portfolio(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_in: PortfolioCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Create new portfolio.
    """
    logger.info(f"Creating portfolio: {portfolio_in.name}")
    try:
        portfolio = portfolio_crud.create_portfolio(db, portfolio=portfolio_in)
        logger.info(f"Portfolio created successfully with ID {portfolio.id}")
        return process_single_portfolio_for_response(portfolio)
    except ValueError as e:
        logger.warning(f"Validation error creating portfolio: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating portfolio: {str(e)}"
        )

@router.get("/{portfolio_id}", response_model=PortfolioOut)
@require_permission("VIEW_PORTFOLIOS")
def read_portfolio(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get portfolio by ID.
    """
    logger.debug(f"Getting portfolio with ID {portfolio_id}")
    
    portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
    if not portfolio:
        logger.warning(f"Portfolio with ID {portfolio_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )
    
    # Process portfolio data
    can_view_images = permission_checker.user_has_permission(current_user, "VIEW_PORTFOLIO_IMAGES")
    can_view_attachments = permission_checker.user_has_permission(current_user, "VIEW_PORTFOLIO_ATTACHMENTS")
    result = process_portfolios_for_response(
        [portfolio],
        include_images=can_view_images,
        include_attachments=can_view_attachments,
    )
    return result[0] if result and len(result) > 0 else {
        "id": portfolio.id,
        "name": portfolio.name,
        "description": portfolio.description,
        "created_at": portfolio.created_at,
        "updated_at": portfolio.updated_at,
        "categories": [],
        "experiences": [],
        "projects": [],
        "sections": [],
        "images": [],
        "attachments": []
    }

@router.put("/{portfolio_id}", response_model=PortfolioOut)
@require_permission("EDIT_PORTFOLIO")
def update_portfolio(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    portfolio_in: PortfolioUpdate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Update a portfolio.
    """
    logger.info(f"Updating portfolio with ID {portfolio_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found for update")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        portfolio = portfolio_crud.update_portfolio(db, portfolio_id=portfolio_id, portfolio=portfolio_in)
        logger.info(f"Portfolio {portfolio_id} updated successfully")
        return process_single_portfolio_for_response(portfolio)
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error updating portfolio {portfolio_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating portfolio: {str(e)}"
        )

@router.delete("/{portfolio_id}", response_model=PortfolioOut, status_code=status.HTTP_200_OK)
@require_permission("DELETE_PORTFOLIO")
def delete_portfolio(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete a portfolio.
    """
    logger.info(f"Deleting portfolio with ID {portfolio_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found for deletion")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        portfolio = portfolio_crud.delete_portfolio(db, portfolio_id=portfolio_id)
        logger.info(f"Portfolio {portfolio_id} deleted successfully")
        return process_single_portfolio_for_response(portfolio)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting portfolio: {str(e)}"
        )

@router.get("/{portfolio_id}/images", response_model=List[PortfolioImageOut])
@require_permission("VIEW_PORTFOLIO_IMAGES")
def read_portfolio_images(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get all images for a portfolio.
    """
    logger.debug(f"Getting images for portfolio {portfolio_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Get all images for the portfolio
        images = portfolio_crud.get_portfolio_images(db, portfolio_id=portfolio_id)
        
        # Add image URLs for frontend
        for image in images:
            if image.image_path:
                image.image_url = get_file_url(image.image_path)
        
        return images
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting portfolio images: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting portfolio images: {str(e)}"
        )

@router.post("/{portfolio_id}/images", response_model=PortfolioImageOut, status_code=status.HTTP_201_CREATED)
@require_permission("UPLOAD_PORTFOLIO_IMAGES")
async def upload_portfolio_image(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    category: str = Query(..., description="Image category"),
    file: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Upload an image for a portfolio.
    """
    logger.info(f"Uploading image for portfolio {portfolio_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an image"
            )
        
        # Create upload directory with structure: portfolios/{portfolio_id}/images/
        upload_dir = os.path.join(settings.UPLOADS_DIR, "portfolios", str(portfolio_id), "images")
        os.makedirs(upload_dir, exist_ok=True)
        
        # Use original filename, but handle duplicates
        original_filename = file.filename or "untitled"
        filename = original_filename
        counter = 1
        
        # Check for duplicates and add counter if needed
        while os.path.exists(os.path.join(upload_dir, filename)):
            name, ext = os.path.splitext(original_filename)
            filename = f"{name}_{counter}{ext}"
            counter += 1
        
        file_path = os.path.join(upload_dir, filename)
        
        # Save the file
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Create relative path for database
        relative_path = os.path.relpath(file_path, settings.BASE_DIR)
        
        # Create portfolio image in database
        portfolio_image = portfolio_crud.add_portfolio_image(
            db, 
            portfolio_id=portfolio_id, 
            image=PortfolioImageCreate(
                image_path=relative_path,
                file_name=filename,
                category=category
            )
        )
        
        # Add image URL for frontend
        if portfolio_image.image_path:
            portfolio_image.image_url = get_file_url(portfolio_image.image_path)
        
        logger.info(f"Image uploaded successfully for portfolio {portfolio_id}")
        return portfolio_image
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading image: {str(e)}"
        )

@router.delete("/{portfolio_id}/images/{image_id}", response_model=PortfolioImageOut)
@require_permission("DELETE_PORTFOLIO_IMAGES")
def delete_portfolio_image(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    image_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete a portfolio image.
    """
    logger.info(f"Deleting image {image_id} from portfolio {portfolio_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        portfolio_image = portfolio_crud.delete_portfolio_image(db, image_id=image_id)
        if not portfolio_image:
            logger.warning(f"Portfolio image with ID {image_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio image not found"
            )
        
        # Delete the file from the filesystem
        if portfolio_image.image_path:
            file_path = os.path.join(settings.BASE_DIR, portfolio_image.image_path)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.debug(f"Deleted image file: {file_path}")
                except OSError as e:
                    logger.warning(f"Could not delete image file {file_path}: {str(e)}")
        
        logger.info(f"Image {image_id} deleted successfully")
        return portfolio_image
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting portfolio image: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting portfolio image: {str(e)}"
        )

@router.put("/{portfolio_id}/images/{image_id}", response_model=PortfolioImageOut)
@require_permission("EDIT_PORTFOLIO_IMAGES")
async def rename_portfolio_image(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    image_id: int,
    image_update: PortfolioImageUpdate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Rename a portfolio image or update its category.
    """
    logger.info(f"Updating image {image_id} from portfolio {portfolio_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Get the current image
        current_image = portfolio_crud.get_portfolio_image(db, image_id=image_id)
        if not current_image:
            logger.warning(f"Portfolio image with ID {image_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio image not found"
            )
        
        # Check if portfolio owns this image
        if current_image.portfolio_id != portfolio_id:
            logger.warning(f"Image {image_id} does not belong to portfolio {portfolio_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Image does not belong to this portfolio"
            )
        
        # Handle file rename if new filename is provided
        if image_update.file_name and image_update.file_name != current_image.file_name:
            old_file_path = os.path.join(settings.BASE_DIR, current_image.image_path)
            if os.path.exists(old_file_path):
                # Get directory and create new path
                upload_dir = os.path.dirname(old_file_path)
                new_file_path = os.path.join(upload_dir, image_update.file_name)
                
                # Check if new filename already exists
                if os.path.exists(new_file_path):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"A file with name '{image_update.file_name}' already exists"
                    )
                
                try:
                    # Rename the file
                    os.rename(old_file_path, new_file_path)
                    
                    # Update the image_path in the update data
                    new_relative_path = os.path.relpath(new_file_path, settings.BASE_DIR)
                    image_update.image_path = new_relative_path
                    
                    logger.info(f"File renamed from {current_image.file_name} to {image_update.file_name}")
                except OSError as e:
                    logger.error(f"Failed to rename file: {str(e)}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Failed to rename file: {str(e)}"
                    )
        
        # Update the image in database
        updated_image = portfolio_crud.update_portfolio_image(db, image_id=image_id, image_update=image_update)
        if not updated_image:
            logger.warning(f"Failed to update portfolio image {image_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update image"
            )
        
        # Add image URL for frontend
        if updated_image.image_path:
            updated_image.image_url = get_file_url(updated_image.image_path)
        
        logger.info(f"Image {image_id} updated successfully")
        return updated_image
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating portfolio image: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating portfolio image: {str(e)}"
        )

@router.get("/{portfolio_id}/attachments", response_model=List[PortfolioAttachmentOut])
@require_permission("VIEW_PORTFOLIO_ATTACHMENTS")
def read_portfolio_attachments(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get all attachments for a portfolio.
    """
    logger.debug(f"Getting attachments for portfolio {portfolio_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Get all attachments for the portfolio
        attachments = portfolio_crud.get_portfolio_attachments(db, portfolio_id=portfolio_id)
        
        # Add file URLs for frontend
        for attachment in attachments:
            if attachment.file_path:
                attachment.file_url = get_file_url(attachment.file_path)
        
        return attachments
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting portfolio attachments: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting portfolio attachments: {str(e)}"
        )

@router.post("/{portfolio_id}/attachments", response_model=PortfolioAttachmentOut, status_code=status.HTTP_201_CREATED)
@require_permission("UPLOAD_PORTFOLIO_ATTACHMENTS")
async def upload_portfolio_attachment(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Upload an attachment for a portfolio.
    Supported file types: PDF, Word docs, Excel, CSV, text files, JSON, XML, ZIP
    """
    logger.info(f"Uploading attachment for portfolio {portfolio_id}: {file.filename}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Validate file type
        allowed_types = [
            "application/pdf",                                      # PDF
            "application/msword",                                   # DOC
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # DOCX
            "application/vnd.ms-excel",                            # XLS
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # XLSX
            "text/csv",                                            # CSV
            "text/plain",                                          # TXT
            "application/json",                                    # JSON
            "application/xml",                                     # XML
            "text/xml",                                           # XML
            "application/zip",                                     # ZIP
            "application/x-zip-compressed",                        # ZIP
        ]
        
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type '{file.content_type}'. Supported types: PDF, Word documents, Excel files, CSV, text files, JSON, XML, ZIP"
            )
        
        # Check file size (limit to 10MB for attachments)
        MAX_FILE_SIZE = 10 * 1024 * 1024
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large ({len(contents) / (1024 * 1024):.2f}MB). Maximum size: 10MB"
            )
        
        # Reset file pointer for saving
        await file.seek(0)
        
        # Create upload directory if it doesn't exist
        upload_dir = Path(settings.UPLOADS_DIR) / "portfolios" / str(portfolio_id) / "attachments"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Use original filename, but handle duplicates
        original_filename = file.filename or "untitled"
        filename = original_filename
        counter = 1
        
        # Check for duplicates and add counter if needed
        while (upload_dir / filename).exists():
            name, ext = os.path.splitext(original_filename)
            filename = f"{name}_{counter}{ext}"
            counter += 1
        
        file_path = upload_dir / filename
        
        # Save the file
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # Create relative path for database storage
        relative_path = str(file_path.relative_to(Path(settings.BASE_DIR)))
        
        # Create attachment in database
        attachment_data = PortfolioAttachmentCreate(
            file_path=relative_path,
            file_name=filename  # Keep actual filename used (may have counter)
        )
        
        # Add portfolio attachment to database
        portfolio_attachment = portfolio_crud.add_portfolio_attachment(
            db, 
            portfolio_id=portfolio_id, 
            attachment=attachment_data
        )
        
        # Add file URL for frontend
        portfolio_attachment.file_url = get_file_url(portfolio_attachment.file_path)
        
        logger.info(f"Attachment uploaded successfully for portfolio {portfolio_id}")
        return portfolio_attachment
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading attachment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading attachment: {str(e)}"
        )

@router.delete("/{portfolio_id}/attachments/{attachment_id}", response_model=PortfolioAttachmentOut)
@require_permission("DELETE_PORTFOLIO_ATTACHMENTS")
def delete_portfolio_attachment(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    attachment_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete a portfolio attachment.
    """
    logger.info(f"Deleting attachment {attachment_id} from portfolio {portfolio_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        portfolio_attachment = portfolio_crud.delete_portfolio_attachment(db, attachment_id=attachment_id)
        if not portfolio_attachment:
            logger.warning(f"Portfolio attachment with ID {attachment_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio attachment not found"
            )
        
        # Delete the file from the filesystem
        if portfolio_attachment.file_path:
            file_path = Path(settings.BASE_DIR) / portfolio_attachment.file_path
            if file_path.exists():
                try:
                    os.remove(file_path)
                    logger.debug(f"Deleted attachment file: {file_path}")
                except OSError as e:
                    logger.warning(f"Could not delete attachment file {file_path}: {str(e)}")
        
        logger.info(f"Attachment {attachment_id} deleted successfully")
        return portfolio_attachment
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting portfolio attachment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting portfolio attachment: {str(e)}"
        )

# Portfolio Association Endpoints

@router.post("/{portfolio_id}/categories/{category_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_PORTFOLIO")
def add_portfolio_category(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    category_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Add a category to a portfolio.
    """
    logger.info(f"Adding category {category_id} to portfolio {portfolio_id}")
    try:
        # Verify portfolio exists
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Add category to portfolio
        result = portfolio_crud.add_portfolio_category(db, portfolio_id=portfolio_id, category_id=category_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to add category to portfolio"
            )
        
        logger.info(f"Category {category_id} added to portfolio {portfolio_id} successfully")
        return {"message": "Category added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding category to portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding category to portfolio: {str(e)}"
        )

@router.delete("/{portfolio_id}/categories/{category_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_PORTFOLIO")
def remove_portfolio_category(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    category_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Remove a category from a portfolio.
    """
    logger.info(f"Removing category {category_id} from portfolio {portfolio_id}")
    try:
        # Verify portfolio exists
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Remove category from portfolio
        result = portfolio_crud.remove_portfolio_category(db, portfolio_id=portfolio_id, category_id=category_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to remove category from portfolio"
            )
        
        logger.info(f"Category {category_id} removed from portfolio {portfolio_id} successfully")
        return {"message": "Category removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing category from portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing category from portfolio: {str(e)}"
        )

@router.post("/{portfolio_id}/experiences/{experience_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_PORTFOLIO")
def add_portfolio_experience(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    experience_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Add an experience to a portfolio.
    """
    logger.info(f"Adding experience {experience_id} to portfolio {portfolio_id}")
    try:
        # Verify portfolio exists
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Add experience to portfolio
        result = portfolio_crud.add_portfolio_experience(db, portfolio_id=portfolio_id, experience_id=experience_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to add experience to portfolio"
            )
        
        logger.info(f"Experience {experience_id} added to portfolio {portfolio_id} successfully")
        return {"message": "Experience added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding experience to portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding experience to portfolio: {str(e)}"
        )

@router.delete("/{portfolio_id}/experiences/{experience_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_PORTFOLIO")
def remove_portfolio_experience(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    experience_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Remove an experience from a portfolio.
    """
    logger.info(f"Removing experience {experience_id} from portfolio {portfolio_id}")
    try:
        # Verify portfolio exists
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Remove experience from portfolio
        result = portfolio_crud.remove_portfolio_experience(db, portfolio_id=portfolio_id, experience_id=experience_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to remove experience from portfolio"
            )
        
        logger.info(f"Experience {experience_id} removed from portfolio {portfolio_id} successfully")
        return {"message": "Experience removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing experience from portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing experience from portfolio: {str(e)}"
        )

@router.post("/{portfolio_id}/projects/{project_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_PORTFOLIO")
def add_portfolio_project(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    project_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Add a project to a portfolio.
    """
    logger.info(f"Adding project {project_id} to portfolio {portfolio_id}")
    try:
        # Verify portfolio exists
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Add project to portfolio
        result = portfolio_crud.add_portfolio_project(db, portfolio_id=portfolio_id, project_id=project_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to add project to portfolio"
            )
        
        logger.info(f"Project {project_id} added to portfolio {portfolio_id} successfully")
        return {"message": "Project added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding project to portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding project to portfolio: {str(e)}"
        )

@router.delete("/{portfolio_id}/projects/{project_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_PORTFOLIO")
def remove_portfolio_project(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    project_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Remove a project from a portfolio.
    """
    logger.info(f"Removing project {project_id} from portfolio {portfolio_id}")
    try:
        # Verify portfolio exists
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Remove project from portfolio
        result = portfolio_crud.remove_portfolio_project(db, portfolio_id=portfolio_id, project_id=project_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to remove project from portfolio"
            )
        
        logger.info(f"Project {project_id} removed from portfolio {portfolio_id} successfully")
        return {"message": "Project removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing project from portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing project from portfolio: {str(e)}"
        )

@router.post("/{portfolio_id}/sections/{section_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_PORTFOLIO")
def add_portfolio_section(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    section_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Add a section to a portfolio.
    """
    logger.info(f"Adding section {section_id} to portfolio {portfolio_id}")
    try:
        # Verify portfolio exists
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Add section to portfolio
        result = portfolio_crud.add_portfolio_section(db, portfolio_id=portfolio_id, section_id=section_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to add section to portfolio"
            )
        
        logger.info(f"Section {section_id} added to portfolio {portfolio_id} successfully")
        return {"message": "Section added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding section to portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding section to portfolio: {str(e)}"
        )

@router.delete("/{portfolio_id}/sections/{section_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_PORTFOLIO")
def remove_portfolio_section(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    section_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Remove a section from a portfolio.
    """
    logger.info(f"Removing section {section_id} from portfolio {portfolio_id}")
    try:
        # Verify portfolio exists
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Remove section from portfolio
        result = portfolio_crud.remove_portfolio_section(db, portfolio_id=portfolio_id, section_id=section_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to remove section from portfolio"
            )
        
        logger.info(f"Section {section_id} removed from portfolio {portfolio_id} successfully")
        return {"message": "Section removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing section from portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing section from portfolio: {str(e)}"
        )




