from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session, selectinload, joinedload, object_session
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
from app.models.portfolio import Portfolio as PortfolioModel, PortfolioImage, PortfolioAttachment
from app.models.category import Category
from app.api import deps
from app.core.config import settings
from app.core.logging import setup_logger
from app.core.security_decorators import require_permission, require_any_permission, permission_checker
from app import models
import traceback
from app.rag.rag_events import stage_event
from app.utils.file_utils import sanitize_filename

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
    elif file_path.startswith('/uploads/'):
        # Already has /uploads/ prefix, return as-is
        return file_path
    elif file_path.startswith('uploads/'):
        # Already has uploads prefix, just add leading slash
        return f"/{file_path}"
    elif file_path.startswith('/projects/') or file_path.startswith('/portfolios/'):
        # Path starts with /projects/ or /portfolios/ - prepend /uploads
        # This handles legacy/incorrect paths like /projects/project_1/...
        return f"/uploads{file_path}"
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
                "default_agent_id": getattr(portfolio, "default_agent_id", None),
                "default_agent": None,
                "created_at": portfolio.created_at,
                "updated_at": portfolio.updated_at,
                "categories": [],
                "experiences": [],
                "projects": [],
                "sections": [],
                "images": [],
                "attachments": []
            }

            if hasattr(portfolio, "default_agent") and portfolio.default_agent:
                portfolio_dict["default_agent"] = {
                    "id": portfolio.default_agent.id,
                    "name": portfolio.default_agent.name,
                    "description": portfolio.default_agent.description,
                    "is_active": portfolio.default_agent.is_active,
                    "chat_model": portfolio.default_agent.chat_model,
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
                        "experience_texts": [],
                        "images": []
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
                    
                    # Include experience images if present and already loaded (avoid lazy load when table unavailable)
                    images_collection = getattr(experience, "__dict__", {}).get("images")
                    if images_collection:
                        for image in images_collection:
                            exp_dict["images"].append({
                                "id": image.id,
                                "experience_id": image.experience_id,
                                "experience_text_id": getattr(image, "experience_text_id", None),
                                "image_path": image.image_path,
                                "image_url": get_file_url(image.image_path),
                                "file_name": getattr(image, "file_name", None),
                                "category": getattr(image, "category", None),
                                "language_id": getattr(image, "language_id", None),
                                "created_at": getattr(image, "created_at", None),
                                "updated_at": getattr(image, "updated_at", None)
                            })

                    portfolio_dict["experiences"].append(exp_dict)
            
            # Process projects
            if hasattr(portfolio, 'projects') and portfolio.projects:
                for project in portfolio.projects:
                    proj_dict = {
                        "id": project.id,
                        "repository_url": project.repository_url,
                        "website_url": project.website_url,
                        "project_date": project.project_date.isoformat() if hasattr(project, 'project_date') and project.project_date else None,
                        "created_at": project.created_at if hasattr(project, 'created_at') else None,
                        "project_texts": [],
                        "categories": [],
                        "skills": [],
                        "sections": [],
                        "images": [],
                        "attachments": []
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
                    
                    # Include project images if they exist
                    if include_images and hasattr(project, 'images') and project.images:
                        for image in project.images:
                            img_dict = {
                                "id": image.id,
                                "project_id": image.project_id,
                                "category": image.category,
                                "image_path": image.image_path,
                                "file_name": image.file_name if hasattr(image, 'file_name') else None,
                                "language_id": image.language_id if hasattr(image, 'language_id') else None,
                                "image_url": get_file_url(image.image_path) if image.image_path else None,
                                "created_at": image.created_at if hasattr(image, 'created_at') else None,
                                "updated_at": image.updated_at if hasattr(image, 'updated_at') else None
                            }
                            
                            # Include language if it exists
                            if hasattr(image, 'language') and image.language:
                                language = image.language
                                img_dict["language"] = {
                                    "id": language.id,
                                    "code": language.code,
                                    "name": language.name
                                }
                            else:
                                img_dict["language"] = None
                            
                            proj_dict["images"].append(img_dict)
                    
                    # Include project attachments if they exist
                    if include_attachments and hasattr(project, 'attachments') and project.attachments:
                        for attachment in project.attachments:
                            att_dict = {
                                "id": attachment.id,
                                "project_id": attachment.project_id,
                                "file_name": attachment.file_name,
                                "file_path": attachment.file_path,
                                "file_url": get_file_url(attachment.file_path) if attachment.file_path else None,
                                "category_id": attachment.category_id if hasattr(attachment, 'category_id') else None,
                                "language_id": attachment.language_id if hasattr(attachment, 'language_id') else None,
                                "created_at": attachment.created_at if hasattr(attachment, 'created_at') else None,
                                "updated_at": attachment.updated_at if hasattr(attachment, 'updated_at') else None
                            }
                            
                            # Include language if it exists
                            if hasattr(attachment, 'language') and attachment.language:
                                language = attachment.language
                                att_dict["language"] = {
                                    "id": language.id,
                                    "code": language.code,
                                    "name": language.name
                                }
                            else:
                                att_dict["language"] = None
                            
                            proj_dict["attachments"].append(att_dict)
                    
                    # Include project categories if they exist
                    if hasattr(project, 'categories') and project.categories:
                        for category in project.categories:
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
                                        "description": text.description if hasattr(text, 'description') else None
                                    }
                                    
                                    # Include language if it exists
                                    if hasattr(text, "language") and text.language is not None:
                                        language = text.language
                                        text_dict["language"] = {
                                            "id": language.id,
                                            "code": language.code,
                                            "name": language.name
                                        }
                                    
                                    cat_dict["category_texts"].append(text_dict)
                            
                            proj_dict["categories"].append(cat_dict)
                    
                    # Include project skills if they exist
                    if hasattr(project, 'skills') and project.skills:
                        for skill in project.skills:
                            skill_dict = {
                                "id": skill.id,
                                "type": skill.type if hasattr(skill, 'type') else None,
                                "type_code": skill.type_code if hasattr(skill, 'type_code') else None,
                                "skill_texts": []
                            }
                            
                            # Include skill texts if they exist
                            if hasattr(skill, 'skill_texts') and skill.skill_texts:
                                for text in skill.skill_texts:
                                    text_dict = {
                                        "id": text.id,
                                        "language_id": text.language_id,
                                        "name": text.name,
                                        "description": text.description if hasattr(text, 'description') else None
                                    }
                                    
                                    # Include language if it exists
                                    if hasattr(text, "language") and text.language is not None:
                                        language = text.language
                                        text_dict["language"] = {
                                            "id": language.id,
                                            "code": language.code,
                                            "name": language.name
                                        }
                                    
                                    skill_dict["skill_texts"].append(text_dict)
                            
                            proj_dict["skills"].append(skill_dict)

                    # Include project sections if they exist
                    # IMPORTANT: Load sections with display_order from association table
                    from app.crud import section as section_crud
                    if hasattr(project, 'id'):
                        # Get the database session from the project object's session
                        db_session = object_session(project)
                        if db_session:
                            sections_with_order = section_crud.get_project_sections(db_session, project.id)
                            for section in sections_with_order:
                                sect_dict = {
                                    "id": section.id,
                                    "code": section.code,
                                    "display_order": section.display_order if hasattr(section, 'display_order') else 0,
                                    "display_style": section.display_style if hasattr(section, 'display_style') else "bordered",
                                    "section_texts": [],
                                    "images": [],
                                    "attachments": []
                                }

                                # Include section texts if they exist
                                if hasattr(section, 'section_texts') and section.section_texts:
                                    for text in section.section_texts:
                                        text_dict = {
                                            "id": text.id,
                                            "language_id": text.language_id,
                                            "text": text.text
                                        }

                                        # Include language if it exists
                                        if hasattr(text, "language") and text.language is not None:
                                            language = text.language
                                            text_dict["language"] = {
                                                "id": language.id,
                                                "code": language.code,
                                                "name": language.name
                                            }

                                        sect_dict["section_texts"].append(text_dict)

                                # Include section images if they exist
                                if hasattr(section, 'images') and section.images:
                                    for image in section.images:
                                        img_dict = {
                                            "id": image.id,
                                            "section_id": image.section_id,
                                            "image_path": image.image_path,
                                            "display_order": image.display_order if hasattr(image, 'display_order') else 0,
                                            "language_id": image.language_id if hasattr(image, 'language_id') else None,
                                            "created_at": image.created_at if hasattr(image, 'created_at') else None,
                                            "updated_at": image.updated_at if hasattr(image, 'updated_at') else None
                                        }
                                        sect_dict["images"].append(img_dict)

                                # Include section attachments if they exist
                                if hasattr(section, 'attachments') and section.attachments:
                                    for attachment in section.attachments:
                                        att_dict = {
                                            "id": attachment.id,
                                            "section_id": attachment.section_id,
                                            "file_name": attachment.file_name,
                                            "file_path": attachment.file_path,
                                            "display_order": attachment.display_order if hasattr(attachment, 'display_order') else 0,
                                            "language_id": attachment.language_id if hasattr(attachment, 'language_id') else None,
                                            "created_at": attachment.created_at if hasattr(attachment, 'created_at') else None,
                                            "updated_at": attachment.updated_at if hasattr(attachment, 'updated_at') else None
                                        }
                                        sect_dict["attachments"].append(att_dict)

                                proj_dict["sections"].append(sect_dict)

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
                        "language_id": image.language_id if hasattr(image, 'language_id') else None,
                        "image_url": get_file_url(image.image_path) if image.image_path else None,
                        "created_at": image.created_at,
                        "updated_at": image.updated_at if hasattr(image, 'updated_at') else None
                    }
                    
                    # Include language if it exists
                    if hasattr(image, 'language') and image.language:
                        language = image.language
                        img_dict["language"] = {
                            "id": language.id,
                            "code": language.code,
                            "name": language.name,
                            "image": language.image if hasattr(language, 'image') else None
                        }
                    else:
                        img_dict["language"] = None
                    
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
                        "category_id": attachment.category_id if hasattr(attachment, 'category_id') else None,
                        "language_id": attachment.language_id if hasattr(attachment, 'language_id') else None,
                        "is_default": attachment.is_default if hasattr(attachment, 'is_default') else False,
                        "created_at": attachment.created_at,
                        "updated_at": attachment.updated_at if hasattr(attachment, 'updated_at') else None
                    }
                    
                    # Include category if it exists
                    if hasattr(attachment, 'category') and attachment.category:
                        category = attachment.category
                        cat_dict = {
                            "id": category.id,
                            "code": category.code,
                            "type_code": category.type_code if hasattr(category, 'type_code') else None,
                            "category_texts": []
                        }
                        
                        # Include category texts
                        if hasattr(category, 'category_texts') and category.category_texts:
                            for text in category.category_texts:
                                cat_dict["category_texts"].append({
                                    "language_id": text.language_id,
                                    "name": text.name,
                                    "description": text.description if hasattr(text, 'description') else None
                                })
                        
                        att_dict["category"] = cat_dict
                    else:
                        att_dict["category"] = None
                    
                    # Include language if it exists
                    if hasattr(attachment, 'language') and attachment.language:
                        language = attachment.language
                        att_dict["language"] = {
                            "id": language.id,
                            "code": language.code,
                            "name": language.name,
                            "image": language.image if hasattr(language, 'image') else None
                        }
                    else:
                        att_dict["language"] = None
                    
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
                "default_agent_id": portfolio.default_agent_id if hasattr(portfolio, 'default_agent_id') else None,
                "default_agent": None,
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
    sort_order: Optional[str] = Query("asc", pattern="^(asc|desc)$", description="Sort order"),
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
    current_user: models.User = Depends(deps.get_current_user),
    portfolio_in: PortfolioCreate,
) -> Any:
    portfolio = portfolio_crud.create_portfolio(db, portfolio_in)
    stage_event(db, {"op":"insert","source_table":"portfolios","source_id":str(portfolio.id),"changed_fields":["name"]})
    return portfolio

@router.get("/{portfolio_id}", response_model=PortfolioOut)
@require_permission("VIEW_PORTFOLIOS")
def read_portfolio(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    include_full_details: bool = Query(False, description="Include full portfolio details"),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get portfolio by ID.
    """
    
    logger.info(f"========== GET PORTFOLIO {portfolio_id} - include_full_details={include_full_details} ==========")
    logger.debug(f"Getting portfolio with ID {portfolio_id}, include_full_details={include_full_details}")
    
    portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id, full_details=include_full_details)
    if not portfolio:
        logger.warning(f"Portfolio with ID {portfolio_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )
    
    logger.info(f"Portfolio found: {portfolio.name}")
    logger.info(f"Portfolio has {len(portfolio.categories) if hasattr(portfolio, 'categories') else 0} categories")
    logger.info(f"Portfolio has {len(portfolio.experiences) if hasattr(portfolio, 'experiences') else 0} experiences")
    logger.info(f"Portfolio has {len(portfolio.projects) if hasattr(portfolio, 'projects') else 0} projects")
    logger.info(f"Portfolio has {len(portfolio.sections) if hasattr(portfolio, 'sections') else 0} sections")
    
    # Process portfolio data
    can_view_images = permission_checker.user_has_permission(current_user, "VIEW_PORTFOLIO_IMAGES")
    can_view_attachments = permission_checker.user_has_permission(current_user, "VIEW_PORTFOLIO_ATTACHMENTS")
    result = process_portfolios_for_response(
        [portfolio],
        include_images=can_view_images,
        include_attachments=can_view_attachments,
    )
    
    logger.info(f"Processed result has {len(result[0]['categories']) if result and len(result) > 0 else 0} categories")
    logger.info(f"========== END GET PORTFOLIO {portfolio_id} ==========")
    
    return result[0] if result and len(result) > 0 else {
        "id": portfolio.id,
        "name": portfolio.name,
        "description": portfolio.description,
        "default_agent_id": portfolio.default_agent_id,
        "default_agent": None,
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
    current_user: models.User = Depends(deps.get_current_user),
    portfolio_id: int,
    portfolio_in: PortfolioUpdate,
) -> Any:
    portfolio = portfolio_crud.update_portfolio(db, portfolio_id, portfolio_in)
    stage_event(db, {"op":"update","source_table":"portfolios","source_id":str(portfolio_id),"changed_fields":list(portfolio_in.model_dump(exclude_unset=True).keys())})
    
    # Reload portfolio with full details to properly serialize relationships
    portfolio_full = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id, full_details=True)
    if not portfolio_full:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found after update"
        )
    
    # Process portfolio data properly
    can_view_images = permission_checker.user_has_permission(current_user, "VIEW_PORTFOLIO_IMAGES")
    can_view_attachments = permission_checker.user_has_permission(current_user, "VIEW_PORTFOLIO_ATTACHMENTS")
    result = process_portfolios_for_response(
        [portfolio_full],
        include_images=can_view_images,
        include_attachments=can_view_attachments,
    )
    
    return result[0] if result and len(result) > 0 else portfolio_full

@router.delete("/{portfolio_id}", response_model=PortfolioOut, status_code=status.HTTP_200_OK)
@require_permission("DELETE_PORTFOLIO")
def delete_portfolio(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    portfolio_id: int,
) -> Any:
    portfolio = portfolio_crud.delete_portfolio(db, portfolio_id)
    stage_event(db, {"op":"delete","source_table":"portfolios","source_id":str(portfolio_id),"changed_fields":[]})
    return portfolio

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
    language_id: Optional[int] = Query(None, description="Language ID"),
    file: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Upload an image for a portfolio.
    For 'main' category, replaces existing image if one exists.
    For other categories, creates new image entries.
    """
    logger.info(f"=== UPLOAD IMAGE DEBUG ===")
    logger.info(f"Portfolio ID: {portfolio_id}")
    logger.info(f"Category: {category} (type: {type(category)})")
    logger.info(f"Language ID: {language_id} (type: {type(language_id)})")
    logger.info(f"File: {file.filename}")
    logger.info(f"========================")
    
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
        
        # Define categories that should only have one image (optionally per language)
        # main, thumbnail, and background should be unique
        # gallery allows multiple images
        UNIQUE_CATEGORIES = ['main', 'thumbnail', 'background']
        
        # For unique categories, check if image already exists and replace it
        existing_image = None
        if category in UNIQUE_CATEGORIES:
            if language_id:
                # Look for existing image with the same language
                existing_image = db.query(PortfolioImage).filter(
                    PortfolioImage.portfolio_id == portfolio_id,
                    PortfolioImage.category == category,
                    PortfolioImage.language_id == language_id
                ).first()
            else:
                # Look for existing image with no language
                existing_image = db.query(PortfolioImage).filter(
                    PortfolioImage.portfolio_id == portfolio_id,
                    PortfolioImage.category == category,
                    PortfolioImage.language_id.is_(None)
                ).first()
            
            if existing_image:
                logger.info(f"Found existing {category} image (ID: {existing_image.id}) - will replace it")
        else:
            logger.info(f"Category '{category}' allows multiple images - no uniqueness check")
        
        # Validate category name before using it in a filesystem path.
        # Only allow alphanumeric characters, underscores, and hyphens to
        # prevent path traversal (e.g. category="../../etc").
        import re as _re
        if not _re.match(r'^[a-zA-Z0-9_-]+$', category):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category name: '{category}'. Only letters, numbers, underscores and hyphens are allowed."
            )

        # Use a fixed storage directory to avoid user-controlled path segments.
        upload_dir = Path(settings.UPLOADS_DIR) / "portfolio_images"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Use UUID-based physical filename to avoid conflicts, but keep original filename in database
        original_filename = sanitize_filename(file.filename, default="image.png")
        content_type = (file.content_type or "").lower()
        if content_type in {"image/jpeg", "image/jpg"}:
            image_extension = ".jpg"
        elif content_type == "image/png":
            image_extension = ".png"
        elif content_type == "image/gif":
            image_extension = ".gif"
        elif content_type == "image/webp":
            image_extension = ".webp"
        elif content_type == "image/svg+xml":
            image_extension = ".svg"
        else:
            image_extension = ".upload"
        physical_filename = f"{uuid.uuid4().hex}{image_extension}"
        
        file_path = upload_dir / physical_filename
        
        # Save the file
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Create URL path based on the fixed storage directory.
        url_path = f"/uploads/portfolio_images/{physical_filename}"
        
        # Update existing or create new image record
        if existing_image:
            # Delete old file if it exists
            if existing_image.image_path:
                old_file_path = existing_image.image_path
                # Convert URL path to absolute path
                old_abs_path = None
                if old_file_path.startswith('/uploads/'):
                    old_abs_path = Path(settings.BASE_DIR) / "static" / old_file_path.lstrip('/')
                elif old_file_path.startswith('static/'):
                    old_abs_path = Path(settings.BASE_DIR) / old_file_path
                if old_abs_path and old_abs_path.exists():
                    old_abs_path.unlink()
                    logger.info(f"Deleted old file: {old_abs_path}")
            
            # Update existing record
            existing_image.image_path = url_path
            existing_image.file_name = original_filename
            if language_id is not None:
                existing_image.language_id = language_id
            db.commit()
            db.refresh(existing_image)
            portfolio_image = existing_image
            logger.info(f"Updated existing {category} image for portfolio {portfolio_id}")
            stage_event(db, {"op":"update","source_table":"portfolio_images","source_id":str(portfolio_image.id),"changed_fields":["file_name","image_path","language_id"]})
        else:
            # Create new portfolio image in database
            logger.info(f"Creating new image with language_id={language_id}, category={category}, file_name={original_filename}")
            portfolio_image = portfolio_crud.add_portfolio_image(
                db, 
                portfolio_id=portfolio_id, 
                image=PortfolioImageCreate(
                    image_path=url_path,
                    file_name=original_filename,
                    category=category,
                    language_id=language_id
                )
            )
            logger.info(f"Created new {category} image for portfolio {portfolio_id} with ID {portfolio_image.id}, language_id={portfolio_image.language_id}")
            stage_event(db, {"op":"insert","source_table":"portfolio_images","source_id":str(portfolio_image.id),"changed_fields":["file_name","image_path","category","language_id"]})
        
        # Add image URL for frontend
        if portfolio_image.image_path:
            portfolio_image.image_url = get_file_url(portfolio_image.image_path)
        
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
        
        stage_event(db, {"op":"delete","source_table":"portfolio_images","source_id":str(image_id),"changed_fields":[]})
        return portfolio_image
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        
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
    logger.info(f"=== UPDATE IMAGE DEBUG ===")
    logger.info(f"Portfolio ID: {portfolio_id}")
    logger.info(f"Image ID: {image_id}")
    logger.info(f"Update data: {image_update.model_dump(exclude_unset=True)}")
    logger.info(f"Language ID in update: {image_update.language_id}")
    logger.info(f"========================")
    
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
        
        # Handle display-name update if new filename is provided.
        # The stored disk filename remains server-generated.
        if image_update.file_name and image_update.file_name != current_image.file_name:
            image_update.file_name = sanitize_filename(
                image_update.file_name,
                default=current_image.file_name or "image",
            )
            logger.info(f"Updated image display name to {image_update.file_name}")
        
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

@router.get("/{portfolio_id}/attachments/default-resume", response_model=PortfolioAttachmentOut)
def get_default_resume(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    language_id: Optional[int] = Query(None, description="Language ID to filter resume by language"),
    category_id: Optional[int] = Query(None, description="Category ID (e.g., Technical Resume)"),
) -> Any:
    """
    Get the default resume attachment for a portfolio (public endpoint for website).
    Optionally filter by language_id and category_id.
    Priority:
    1. Default resume with matching language and category
    2. Default resume with matching language (any RESU category)
    3. Default resume with matching category (any language)
    4. Any default resume
    Returns 404 if no default resume is found.
    """
    logger.debug(f"Getting default resume for portfolio {portfolio_id}, language_id={language_id}, category_id={category_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Build query for default resume
        query = db.query(PortfolioAttachment).filter(
            PortfolioAttachment.portfolio_id == portfolio_id,
            PortfolioAttachment.is_default == True
        )
        
        # Try to find with both language and category match
        if language_id and category_id:
            default_resume = query.filter(
                PortfolioAttachment.language_id == language_id,
                PortfolioAttachment.category_id == category_id
            ).first()
            if default_resume:
                logger.debug(f"Found default resume with language {language_id} and category {category_id}")
            else:
                # Try language match only
                default_resume = query.filter(
                    PortfolioAttachment.language_id == language_id
                ).first()
                if default_resume:
                    logger.debug(f"Found default resume with language {language_id} (any category)")
                else:
                    # Try category match only
                    default_resume = query.filter(
                        PortfolioAttachment.category_id == category_id
                    ).first()
                    if default_resume:
                        logger.debug(f"Found default resume with category {category_id} (any language)")
        elif language_id:
            # Language specified, no category
            default_resume = query.filter(
                PortfolioAttachment.language_id == language_id
            ).first()
            if default_resume:
                logger.debug(f"Found default resume with language {language_id}")
        elif category_id:
            # Category specified, no language
            default_resume = query.filter(
                PortfolioAttachment.category_id == category_id
            ).first()
            if default_resume:
                logger.debug(f"Found default resume with category {category_id}")
        else:
            # No filters, get any default resume
            default_resume = query.first()
        
        # Fallback: if still not found, get any default resume
        if not default_resume:
            default_resume = db.query(PortfolioAttachment).filter(
                PortfolioAttachment.portfolio_id == portfolio_id,
                PortfolioAttachment.is_default == True
            ).first()
        
        if not default_resume:
            logger.warning(f"No default resume found for portfolio {portfolio_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No default resume found for this portfolio"
            )
        
        # Add file URL for frontend
        if default_resume.file_path:
            default_resume.file_url = get_file_url(default_resume.file_path)
        
        logger.debug(f"Found default resume {default_resume.id} for portfolio {portfolio_id}")
        return default_resume
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting default resume: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting default resume: {str(e)}"
        )

@router.post("/{portfolio_id}/attachments", response_model=PortfolioAttachmentOut, status_code=status.HTTP_201_CREATED)
@require_permission("UPLOAD_PORTFOLIO_ATTACHMENTS")
async def upload_portfolio_attachment(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    file: UploadFile = File(...),
    category_id: Optional[int] = Query(None, description="Category ID (for PORTFOLIO_DOCUMENT or RESUME)"),
    is_default: bool = Query(False, description="Mark as default resume (only for RESUME category)"),
    language_id: Optional[int] = Query(None, description="Language ID for the attachment"),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Upload an attachment for a portfolio.
    Supported file types: PDF, Word docs, Excel, CSV, text files, JSON, XML, ZIP
    
    Use category_id to associate attachment with PORTFOLIO_DOCUMENT or RESUME category.
    Set is_default=true to mark a resume as the default one (only one default resume per portfolio).
    Use language_id to associate the attachment with a specific language.
    """
    logger.info(f"Uploading attachment for portfolio {portfolio_id}: {file.filename}, category_id={category_id}, is_default={is_default}, language_id={language_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Validate language if provided
        if language_id:
            language = db.query(models.Language).filter(models.Language.id == language_id).first()
            if not language:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Language with ID {language_id} not found"
                )
        
        # Validate category if provided
        if category_id:
            category = db.query(models.Category).filter(models.Category.id == category_id).first()
            if not category:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Category with ID {category_id} not found"
                )
            
            # Verify category is of type PDOC or RESU
            if category.type_code not in ["PDOC", "RESU"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Category must be of type PDOC (Portfolio Document) or RESU (Resume). Got type: {category.type_code}"
                )
            
            # If marking as default and category is RESU, unset any existing default resume
            if is_default and category.type_code == "RESU":
                existing_defaults = db.query(PortfolioAttachment).filter(
                    PortfolioAttachment.portfolio_id == portfolio_id,
                    PortfolioAttachment.is_default == True
                ).all()
                
                for existing in existing_defaults:
                    existing.is_default = False
                    logger.info(f"Unmarked attachment {existing.id} as default resume")
                
                db.commit()
        
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
        upload_dir = Path(settings.UPLOADS_DIR) / "portfolio_attachments"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Use UUID-based filename to avoid conflicts
        filename = f"{uuid.uuid4().hex}.upload"
        
        file_path = upload_dir / filename
        
        # Save the file
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # Create URL path based on the fixed storage directory.
        url_path = f"/uploads/portfolio_attachments/{filename}"
        
        # Create attachment in database
        attachment_data = PortfolioAttachmentCreate(
            file_path=url_path,
            file_name=file.filename or filename,  # Keep original filename for display
            category_id=category_id,
            is_default=is_default,
            language_id=language_id
        )
        
        # Add portfolio attachment to database
        portfolio_attachment = portfolio_crud.add_portfolio_attachment(
            db, 
            portfolio_id=portfolio_id, 
            attachment=attachment_data
        )
        
        # Add file URL for frontend
        portfolio_attachment.file_url = get_file_url(portfolio_attachment.file_path)
        
        logger.info(f"Attachment uploaded successfully for portfolio {portfolio_id}, ID={portfolio_attachment.id}")
        stage_event(db, {"op":"insert","source_table":"portfolio_attachments","source_id":str(portfolio_attachment.id),"changed_fields":["file_name","file_path","category_id","is_default"]})
        return portfolio_attachment
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading attachment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading attachment: {str(e)}"
        )

@router.put("/{portfolio_id}/attachments/{attachment_id}", response_model=PortfolioAttachmentOut)
@require_permission("MANAGE_PORTFOLIO_ATTACHMENTS")
def update_portfolio_attachment(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    attachment_id: int,
    category_id: Optional[int] = None,
    language_id: Optional[int] = None,
    is_default: Optional[bool] = None,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Update a portfolio attachment's category, language, and is_default flag.
    """
    logger.info(f"Updating attachment {attachment_id} for portfolio {portfolio_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )
        
        # Verify attachment belongs to the portfolio
        attachment = db.query(PortfolioAttachment).filter(
            PortfolioAttachment.id == attachment_id,
            PortfolioAttachment.portfolio_id == portfolio_id
        ).first()
        
        if not attachment:
            logger.warning(f"Attachment {attachment_id} not found in portfolio {portfolio_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found in this portfolio"
            )
        
        updated_attachment = portfolio_crud.update_portfolio_attachment(
            db,
            attachment_id=attachment_id,
            category_id=category_id,
            language_id=language_id,
            is_default=is_default
        )
        
        if not updated_attachment:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update attachment"
            )
        
        logger.info(f"Attachment {attachment_id} updated successfully")
        stage_event(db, {"op":"update","source_table":"portfolio_attachments","source_id":str(attachment_id),"changed_fields":["category_id", "language_id", "is_default"]})
        
        # Reload with relationships - need to query again with eager loading
        updated_attachment = db.query(PortfolioAttachment).options(
            selectinload(PortfolioAttachment.category).selectinload(Category.category_texts),
            selectinload(PortfolioAttachment.language)
        ).filter(PortfolioAttachment.id == attachment_id).first()
        
        if not updated_attachment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found after update"
            )
        
        # Add file URL for frontend
        updated_attachment.file_url = get_file_url(updated_attachment.file_path)
        
        return updated_attachment
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating portfolio attachment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating portfolio attachment: {str(e)}"
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
        
        stage_event(db, {"op":"delete","source_table":"portfolio_attachments","source_id":str(attachment_id),"changed_fields":[]})
        return portfolio_attachment
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        
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
        stage_event(db, {"op":"update","source_table":"portfolios","source_id":str(portfolio_id),"changed_fields":["categories"]})
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
        stage_event(db, {"op":"update","source_table":"portfolios","source_id":str(portfolio_id),"changed_fields":["categories"]})
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
        stage_event(db, {"op":"update","source_table":"portfolios","source_id":str(portfolio_id),"changed_fields":["experiences"]})
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
        stage_event(db, {"op":"update","source_table":"portfolios","source_id":str(portfolio_id),"changed_fields":["experiences"]})
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
        stage_event(db, {"op":"update","source_table":"portfolios","source_id":str(portfolio_id),"changed_fields":["projects"]})
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
        stage_event(db, {"op":"update","source_table":"portfolios","source_id":str(portfolio_id),"changed_fields":["projects"]})
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
        stage_event(db, {"op":"update","source_table":"portfolios","source_id":str(portfolio_id),"changed_fields":["sections"]})
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
        stage_event(db, {"op":"update","source_table":"portfolios","source_id":str(portfolio_id),"changed_fields":["sections"]})
        return {"message": "Section removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing section from portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing section from portfolio: {str(e)}"
        )


@router.post("/{portfolio_id}/agent/{agent_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_PORTFOLIO")
def set_portfolio_default_agent(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    agent_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Set the default AI agent for a portfolio.
    """
    logger.info(f"Setting default agent {agent_id} for portfolio {portfolio_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )

        result = portfolio_crud.set_portfolio_default_agent(db, portfolio_id=portfolio_id, agent_id=agent_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to set default agent for portfolio"
            )

        stage_event(db, {"op": "update", "source_table": "portfolios", "source_id": str(portfolio_id), "changed_fields": ["default_agent_id"]})
        return {"message": "Default agent set successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting default agent for portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error setting default agent for portfolio: {str(e)}"
        )


@router.delete("/{portfolio_id}/agent", status_code=status.HTTP_200_OK)
@require_permission("EDIT_PORTFOLIO")
def clear_portfolio_default_agent(
    *,
    db: Session = Depends(deps.get_db),
    portfolio_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Remove the default AI agent for a portfolio.
    """
    logger.info(f"Clearing default agent for portfolio {portfolio_id}")
    try:
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=portfolio_id)
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Portfolio not found"
            )

        result = portfolio_crud.clear_portfolio_default_agent(db, portfolio_id=portfolio_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to clear default agent for portfolio"
            )

        stage_event(db, {"op": "update", "source_table": "portfolios", "source_id": str(portfolio_id), "changed_fields": ["default_agent_id"]})
        return {"message": "Default agent removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing default agent for portfolio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing default agent for portfolio: {str(e)}"
        )
