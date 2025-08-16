from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Any, List, Optional, Dict
import os
import uuid
from datetime import datetime
import logging
import sys
import traceback
from pathlib import Path


from app import crud, models, schemas
from app.crud import project as project_crud  # Direct import as a fallback
from app.api import deps
from app.core.config import settings
from app.core.logging import setup_logger
from app.core.security_decorators import require_permission
from app.utils.file_utils import save_upload_file, save_project_image, PROJECT_IMAGES_DIR, get_file_url, delete_file
from app.crud import category as category_crud
from app.crud import image as image_crud
from app.core.security import create_temp_token, verify_temp_token
from app.rag.rag_events import stage_event

router = APIRouter()

# Use centralized logging
logger = setup_logger("app.api.endpoints.projects")

# Log debug information about imports
logger.info(f"Available crud modules: {dir(crud)}")
logger.info(f"Project module available: {'project' in dir(crud)}")
logger.info(f"Direct project_crud import: {project_crud is not None}")


@router.get("/", response_model=Dict[str, Any])
@require_permission("VIEW_PROJECTS")
def read_projects(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = "asc",
    name_filter: Optional[str] = None,
    include_full_details: bool = Query(False),
    filter_field: Optional[List[str]] = Query(None),
    filter_value: Optional[List[str]] = Query(None),
    filter_operator: Optional[List[str]] = Query(None),
) -> Any:
    """
    Retrieve projects with pagination and optional filtering.
    Set include_full_details=True to get the same behavior as the /full endpoint.
    """
    logger.debug(f"Getting projects with page={page}, page_size={page_size}")
    
    try:
        # Process filter parameters if they exist
        parsed_filters = []
        if filter_field and filter_value:
            operators = filter_operator if filter_operator else ['contains'] * len(filter_field)
            for i, field in enumerate(filter_field):
                if i < len(filter_value):
                    try:
                        op = operators[i] if i < len(operators) else "contains"
                        parsed_filters.append(schemas.project.Filter.from_params(
                            field=field, 
                            value=filter_value[i],
                            operator=op
                        ))
                    except ValueError as e:
                        logger.warning(f"Invalid filter parameter {field}={filter_value[i]}: {e}")
                        continue
        
        # Get projects with all parameters
        try:
            projects, total = crud.project.get_projects_paginated(
                db=db,
                page=page,
                page_size=page_size,
                filters=parsed_filters,
                name_filter=name_filter,
                sort_field=sort_field,
                sort_order=sort_order
            )
        except (AttributeError, ImportError) as e:
            logger.warning(f"Failed to use crud.project, falling back to direct import: {e}")
            projects, total = project_crud.get_projects_paginated(
                db=db,
                page=page,
                page_size=page_size,
                filters=parsed_filters,
                name_filter=name_filter,
                sort_field=sort_field,
                sort_order=sort_order
            )
        
        if include_full_details:
            processed_projects = process_projects_for_response(projects)
            return {
                "items": processed_projects,
                "total": total,
                "page": page,
                "page_size": page_size
            }
        else:
            # Convert SQLAlchemy models to Pydantic models for serialization
            serialized_projects = []
            for project in projects:
                # Convert to Pydantic model for proper serialization
                project_dict = {
                    "id": project.id,
                    "repository_url": project.repository_url or "",
                    "website_url": project.website_url or "",
                    "project_texts": [],
                    "images": [],
                    "attachments": [],
                    "categories": [],
                    "skills": []
                }
                serialized_projects.append(project_dict)
            
            return {
                "items": serialized_projects,
                "total": total,
                "page": page,
                "page_size": page_size
            }
            
    except ValueError as e:
        logger.error(f"Validation error in read_projects: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error in read_projects: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error occurred"
        )


# Helper function to process projects before sending them in the response
def process_projects_for_response(projects: List[models.project.Project]) -> List[Dict[str, Any]]:
    """
    Process the project objects to ensure they can be properly serialized.
    Returns repository_url, website_url, project_texts, categories, and skills fields.
    """
    processed_projects = []
    
    for project in projects:
        try:
            # Create a dictionary with the requested attributes
            project_dict = {
                "id": project.id,
                "repository_url": project.repository_url or "",
                "website_url": project.website_url or "",
                "project_texts": [
                    {
                        "id": text.id,
                        "language_id": text.language_id,
                        "name": text.name,
                        "description": text.description
                    }
                    for text in (project.project_texts or [])
                ],
                # Process categories to be dictionaries
                "categories": [
                    {
                        "id": category.id,
                        "code": category.code,
                        "type_code": category.type_code
                    }
                    for category in (project.categories or [])
                    if category.type_code == "PROJ"  # Only include PROJ categories
                ],
                # Process skills to be dictionaries
                "skills": [
                    {
                        "id": skill.id,
                        "type": skill.type or "",
                        "type_code": skill.type_code or "",
                        "name": skill.skill_texts[0].name if skill.skill_texts else f"Skill {skill.id}"
                    }
                    for skill in (project.skills or [])
                ]
            }
                
            processed_projects.append(project_dict)
        except Exception as e:
            logger.error(f"Error processing project {project.id if hasattr(project, 'id') else 'unknown'}: {e}")
            # Add basic info without the problematic fields
            project_dict = {
                "id": project.id if hasattr(project, 'id') else None,
                "repository_url": project.repository_url if hasattr(project, 'repository_url') else "",
                "website_url": project.website_url if hasattr(project, 'website_url') else "",
                "project_texts": [],
                "categories": [],
                "skills": []
            }
            processed_projects.append(project_dict)
    
    return processed_projects


@router.get("/full", response_model=schemas.project.PaginatedProjectResponse)
@require_permission("VIEW_PROJECTS")
def read_projects_full(
    page: int = Query(1, gt=0),
    pageSize: int = Query(10, gt=0, le=100),
    name: Optional[str] = None,
    filterField: Optional[List[str]] = Query(None),
    filterValue: Optional[List[str]] = Query(None),
    filterOperator: Optional[List[str]] = Query(None),
    sortField: Optional[str] = None,
    sortOrder: Optional[str] = Query(None, pattern="^(asc|desc)$"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get paginated list of projects with full details.
    Returns only repository_url, website_url, and project_texts fields.
    Supports filter parameters (filterField, filterValue, filterOperator).
    """
    logger.debug(f"Fetching projects with page={page}, pageSize={pageSize}, name={name}, filterField={filterField}, filterValue={filterValue}, sort={sortField} {sortOrder}")
    
    name_filter = name
    
    # Initialize parsed_filters with an empty list
    parsed_filters = []
    
    # If filter parameters are provided, use them
    if filterField and filterValue:
        operators = filterOperator if filterOperator else ['contains'] * len(filterField)
        
        logger.debug(f"Processing filter parameters:")
        logger.debug(f"  Fields: {filterField}")
        logger.debug(f"  Values: {filterValue}")
        logger.debug(f"  Operators: {operators}")
        
        for i, field in enumerate(filterField):
            if i < len(filterValue):
                try:
                    # Parse the filter with proper operator
                    op = operators[i] if i < len(operators) else "contains"
                    
                    logger.debug(f"Creating filter: field={field}, value={filterValue[i]}, operator={op}")
                    
                    # Handle special case for name field - prefer direct name_filter over filterField
                    if field == 'name' and not name_filter:
                        name_filter = filterValue[i]
                        logger.debug(f"Using name={name_filter} from filterField as direct name filter")
                        continue  # Skip adding this as a filter object since we'll use name_filter directly
                    
                    # Create a filter object for other fields
                    filter_obj = schemas.project.Filter.from_params(
                        field=field, 
                        value=filterValue[i],
                        operator=op
                    )
                    
                    # Add to parsed filters list
                    parsed_filters.append(filter_obj)
                    
                except (ValueError, AttributeError) as e:
                    # Log the error but don't fail completely - we'll skip this filter
                    logger.error(f"Error parsing filter parameter {field}={filterValue[i]}: {e}")
                    continue
        
        logger.debug(f"Parsed {len(parsed_filters)} filters")
        
    # Debug log the name filter 
    if name_filter:
        logger.debug(f"Using direct name filter: {name_filter}")
    
    try:
        # Try to use the crud.project attribute, if available
        try:
            logger.debug("Attempting to use crud.project module...")
            projects, total = crud.project.get_projects_paginated(
                db=db,
                page=page,
                page_size=pageSize,
                filters=parsed_filters,
                name_filter=name_filter,
                sort_field=sortField,
                sort_order=sortOrder
            )
        except (AttributeError, ImportError) as e:
            # Fall back to the directly imported project_crud
            logger.debug(f"Failed to use crud.project, falling back to direct import: {e}")
            projects, total = project_crud.get_projects_paginated(
                db=db,
                page=page,
                page_size=pageSize,
                filters=parsed_filters,
                name_filter=name_filter,
                sort_field=sortField,
                sort_order=sortOrder
            )
        
        logger.debug(f"Successfully fetched {len(projects)} projects with total={total}")
        
        # Process projects to ensure they can be serialized properly
        processed_projects = process_projects_for_response(projects)
        
        return {
            "items": processed_projects,
            "total": total,
            "page": page,
            "pageSize": pageSize
        }
    except Exception as e:
        logger.error(f"Error fetching projects: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/", response_model=Dict[str, Any])
@require_permission("CREATE_PROJECT")
def create_project(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    project_in: schemas.ProjectCreate,
) -> Any:
    """
    Create new project.
    Project must have repository_url, website_url, project_texts, and categories.
    """
    try:
        # Log the incoming data for debugging
        logger.debug(f"Creating project with: repo={project_in.repository_url}, texts={len(project_in.project_texts)}, categories={len(project_in.categories)}")
        
        try:
            project = crud.project.create_project(db, project=project_in)
        except (AttributeError, ImportError):
            project = project_crud.create_project(db, project=project_in)
        
        # Stage RAG index event
        stage_event(db, {
            "op": "insert",
            "source_table": "projects",
            "source_id": str(project.id),
            "changed_fields": ["repository_url", "website_url"]
        })
        
        # Convert to dictionary for proper serialization
        project_dict = {
            "id": project.id,
            "repository_url": project.repository_url or "",
            "website_url": project.website_url or "",
            "project_texts": [
                {
                    "id": text.id,
                    "language_id": text.language_id,
                    "name": text.name,
                    "description": text.description
                }
                for text in (project.project_texts or [])
            ],
            "images": [],
            "attachments": [],
            "categories": [
                {
                    "id": category.id,
                    "code": category.code,
                    "type_code": category.type_code
                }
                for category in (project.categories or [])
            ],
            "skills": [
                {
                    "id": skill.id,
                    "type": skill.type or "",
                    "type_code": skill.type_code or "",
                    "name": skill.skill_texts[0].name if skill.skill_texts else f"Skill {skill.id}"
                }
                for skill in (project.skills or [])
            ]
        }
        
        return project_dict
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/{project_id}", response_model=Dict[str, Any])
@require_permission("VIEW_PROJECTS")
def read_project(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    project_id: int,
) -> Any:
    """
    Get project by ID.
    """
    try:
        try:
            project = crud.project.get_project(db, project_id=project_id)
        except (AttributeError, ImportError):
            project = project_crud.get_project(db, project_id=project_id)
            
        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project not found",
            )
        
        # Convert to dictionary for proper serialization
        project_dict = {
            "id": project.id,
            "repository_url": project.repository_url or "",
            "website_url": project.website_url or "",
            "project_texts": [
                {
                    "id": text.id,
                    "language_id": text.language_id,
                    "name": text.name,
                    "description": text.description
                }
                for text in (project.project_texts or [])
            ],
            "images": [],
            "attachments": [],
            "categories": [
                {
                    "id": category.id,
                    "code": category.code,
                    "type_code": category.type_code
                }
                for category in (project.categories or [])
            ],
            "skills": [
                {
                    "id": skill.id,
                    "type": skill.type or "",
                    "type_code": skill.type_code or "",
                    "name": skill.skill_texts[0].name if skill.skill_texts else f"Skill {skill.id}"
                }
                for skill in (project.skills or [])
            ]
        }
        
        return project_dict
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.put("/{project_id}", response_model=Dict[str, Any])
@require_permission("EDIT_PROJECT")
def update_project(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    project_id: int,
    project_in: schemas.ProjectUpdate,
) -> Any:
    """
    Update a project.
    Can update repository_url, website_url, project_texts, and categories.
    """
    try:
        # Log the incoming data for debugging
        logger.debug(f"Updating project {project_id} with: repo={project_in.repository_url}, website={project_in.website_url}")
        if project_in.project_texts is not None:
            logger.debug(f"Updating texts: {len(project_in.project_texts)} entries")
        if project_in.categories is not None:
            logger.debug(f"Updating categories: {len(project_in.categories)} entries")
            
        # Check if project exists
        try:
            project = crud.project.get_project(db, project_id=project_id)
        except (AttributeError, ImportError):
            project = project_crud.get_project(db, project_id=project_id)
            
        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project not found",
            )
        
        # Update the project
        try:
            updated_project = crud.project.update_project(db, project_id=project_id, project=project_in)
        except (AttributeError, ImportError):
            updated_project = project_crud.update_project(db, project_id=project_id, project=project_in)
        
        # Stage RAG update event
        stage_event(db, {
            "op": "update",
            "source_table": "projects",
            "source_id": str(project_id),
            "changed_fields": list(project_in.model_dump(exclude_unset=True).keys())
        })
        
        # Convert to dictionary for proper serialization
        project_dict = {
            "id": updated_project.id,
            "repository_url": updated_project.repository_url or "",
            "website_url": updated_project.website_url or "",
            "project_texts": [
                {
                    "id": text.id,
                    "language_id": text.language_id,
                    "name": text.name,
                    "description": text.description
                }
                for text in (updated_project.project_texts or [])
            ],
            "images": [],
            "attachments": [],
            "categories": [
                {
                    "id": category.id,
                    "code": category.code,
                    "type_code": category.type_code
                }
                for category in (updated_project.categories or [])
            ],
            "skills": [
                {
                    "id": skill.id,
                    "type": skill.type or "",
                    "type_code": skill.type_code or "",
                    "name": skill.skill_texts[0].name if skill.skill_texts else f"Skill {skill.id}"
                }
                for skill in (updated_project.skills or [])
            ]
        }
        
        return project_dict
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.delete("/{project_id}", response_model=Dict[str, Any])
@require_permission("DELETE_PROJECT")
def delete_project(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    project_id: int,
) -> Any:
    """
    Delete a project.
    """
    try:
        # Check if project exists
        try:
            project = crud.project.get_project(db, project_id=project_id)
        except (AttributeError, ImportError):
            project = project_crud.get_project(db, project_id=project_id)
            
        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project not found",
            )
        
        # Delete the project
        try:
            deleted_project = crud.project.delete_project(db, project_id=project_id)
        except (AttributeError, ImportError):
            deleted_project = project_crud.delete_project(db, project_id=project_id)
        
        # Stage RAG delete event
        stage_event(db, {
            "op": "delete",
            "source_table": "projects",
            "source_id": str(project_id),
            "changed_fields": []
        })
        
        # Convert to dictionary for proper serialization
        project_dict = {
            "id": deleted_project.id,
            "repository_url": deleted_project.repository_url or "",
            "website_url": deleted_project.website_url or "",
            "project_texts": [
                {
                    "id": text.id,
                    "language_id": text.language_id,
                    "name": text.name,
                    "description": text.description
                }
                for text in (deleted_project.project_texts or [])
            ],
            "images": [],
            "attachments": [],
            "categories": [
                {
                    "id": category.id,
                    "code": category.code,
                    "type_code": category.type_code
                }
                for category in (deleted_project.categories or [])
            ],
            "skills": [
                {
                    "id": skill.id,
                    "type": skill.type or "",
                    "type_code": skill.type_code or "",
                    "name": skill.skill_texts[0].name if skill.skill_texts else f"Skill {skill.id}"
                }
                for skill in (deleted_project.skills or [])
            ]
        }
        
        return project_dict
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/{project_id}/images", response_model=List[schemas.project.ProjectImageOut])
@require_permission("VIEW_PROJECT_IMAGES")
def read_project_images(
    *,
    db: Session = Depends(deps.get_db),
    project_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve images associated with a project.
    """
    logger.debug(f"Fetching images for project {project_id}")
    try:
        # Ensure that project image categories exist
        category_crud.ensure_project_image_category_exists(db)
        
        project = project_crud.get_project(db, project_id=project_id)
        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project not found",
            )
            
        # Get project images using project crud instead of image crud for consistency
        images = project_crud.get_project_images(db, project_id=project_id)
        
        # Process images to ensure URLs are properly set
        processed_images = []
        for image in images:
            # Create response dict with all required fields
            image_dict = {
                "id": image.id,
                "image_path": image.image_path,
                "category": image.category,
                "created_at": image.created_at,
                "updated_at": image.updated_at
            }
            
            # Add URL using the file utils function
            if image.image_path:
                image_dict["image_url"] = get_file_url(image.image_path)
            else:
                image_dict["image_url"] = None
                
            processed_images.append(image_dict)
        
        logger.debug(f"Returning {len(processed_images)} images for project {project_id}")
        return processed_images
        
    except Exception as e:
        logger.error(f"Error reading project images: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while fetching images: {str(e)}"
        )

@router.post("/{project_id}/images", response_model=schemas.ProjectImageOut)
@require_permission("UPLOAD_PROJECT_IMAGES")
async def upload_project_image(
    project_id: int,
    file: UploadFile = File(...),  # Image file
    category_code: str = Form(...),  # Category code 
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Upload an image for a project. 
    Requires category_code as form data.
    """
    logger.info(f"Uploading image for project {project_id} with category {category_code}")
    logger.info(f"File: {file.filename}, content_type: {file.content_type}")
    
    try:
        # Ensure PROI categories exist
        category_crud.ensure_project_image_category_exists(db)
        
        # Check if project exists
        project = crud.project.get_project(db, project_id=project_id)
        if not project:
            logger.error(f"Project not found: {project_id}")
            raise HTTPException(status_code=404, detail="Project not found")
            
        # Validate file type
        content_type = file.content_type
        if not content_type or not content_type.startswith('image/'):
            logger.error(f"Invalid file type: {content_type}")
            raise HTTPException(status_code=400, detail="File must be an image")
            
        # Check if the category exists
        category = crud.category.get_category_by_code(db, code=category_code)
        if not category:
            # Try to find any PROI category as fallback
            from sqlalchemy import or_, func
            from app.models.category import Category
            
            logger.warning(f"Category {category_code} not found, looking for fallback PROI category")
            proi_category = db.query(Category).filter(
                or_(
                    func.trim(Category.code).contains("PROI"),
                    Category.type_code == "PROI"
                )
            ).first()
            
            if proi_category:
                category_code = proi_category.code
                logger.warning(f"Using fallback PROI category: {category_code}")
            else:
                logger.error(f"No PROI category found and category {category_code} is invalid")
                raise HTTPException(status_code=400, detail=f"Category not found: {category_code}")
        
        logger.info(f"Using category code: {category_code}")
        
        # Process and save the file
        original_filename = file.filename
        logger.info(f"Saving file: {original_filename}")
        
        # Save the file using the new organized function
        file_path = await save_project_image(
            upload_file=file, 
            project_id=project_id,
            category=category_code,
            keep_original_filename=True
        )
        
        logger.info(f"File saved successfully at: {file_path}")
        
        # Get the file URL
        file_url = get_file_url(file_path)
        logger.info(f"Generated file URL: {file_url}")
            
        # Calculate relative path for database storage (use the full path returned by save_project_image)
        image_path = file_path  # save_project_image already returns full path
        
        logger.debug(f"Image path for database: {image_path}")
        
        # Create image record in database using the correct field names
        image_in = schemas.project.ProjectImageCreate(
            image_path=str(file_path),  # Store the full path
            category=category_code,    # Match the DB column name (category, not category_code)
        )
        
        logger.info(f"Creating DB record with: {image_in}")
        image = crud.project.create_project_image(
            db=db, 
            project_id=project_id, 
            image_path=str(file_path),
            category=category_code
        )
        
        # Add URL to the image response
        image.image_url = file_url
        
        logger.info(f"Successfully created image record with ID: {image.id}")
        return image
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        logger.error(f"HTTP Exception: {e.detail}")
        raise
        
    except Exception as e:
        # Log the full exception with traceback
        logger.error(f"Error uploading project image: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while uploading the image: {str(e)}"
        )

@router.put("/{project_id}/images/{image_id}", response_model=schemas.ProjectImageOut)
@require_permission("EDIT_PROJECT_IMAGES")
async def update_project_image(
    project_id: int,
    image_id: int,
    category: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Update a project image. Max file size: 2MB
    """
    logger.debug(f"Updating image {image_id} for project {project_id}")
    
    # Check if project exists
    project = crud.project.get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get the existing image
    db_project_image = crud.project.get_project_image(db, project_image_id=image_id)
    if not db_project_image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Verify the image belongs to the specified project
    if db_project_image.project_id != project_id:
        raise HTTPException(status_code=400, detail="Image does not belong to the specified project")
    
    # Variables for update
    image_path = None
    old_image_path = db_project_image.image_path
    
    # Process image if provided
    if image and image.filename:
        # Validate image file type
        valid_image_types = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"]
        if image.content_type not in valid_image_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image type. Supported types: {', '.join(valid_image_types)}"
            )
        
        # Check file size - limit to 2MB
        file_size_limit = 2 * 1024 * 1024  # 2MB in bytes
        contents = await image.read()
        actual_size = len(contents)
        await image.seek(0)  # Reset file cursor after reading
        
        if actual_size > file_size_limit:
            raise HTTPException(
                status_code=400,
                detail=f"File too large: {actual_size / (1024 * 1024):.2f}MB. Maximum size: 2MB"
            )
        
        # Save the new image
        try:
            image_path = await save_project_image(
                upload_file=image, 
                project_id=project_id,
                category=category or db_project_image.category,
                keep_original_filename=True
            )
            
            logger.debug(f"New image saved at: {image_path}")
        except Exception as e:
            logger.error(f"Error saving image: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to save image")
        
        # Delete the old image if applicable
        if old_image_path:
            try:
                delete_file(old_image_path)
                logger.debug(f"Deleted old image: {old_image_path}")
            except Exception as e:
                logger.warning(f"Could not delete old image {old_image_path}: {str(e)}")
    
    # Update the project image
    db_project_image = crud.project.update_project_image(
        db, 
        project_image_id=image_id, 
        image_path=image_path, 
        category=category
    )
    
    # Add URL for the frontend
    if db_project_image.image_path:
        db_project_image.image_url = get_file_url(db_project_image.image_path)
    
    return db_project_image

@router.delete("/{project_id}/images/{image_id}", response_model=schemas.ProjectImageOut)
@require_permission("DELETE_PROJECT_IMAGES")
def delete_project_image(
    project_id: int,
    image_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Delete a project image
    """
    logger.debug(f"Deleting image {image_id} for project {project_id}")
    
    # Check if project exists
    project = crud.project.get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get the existing image
    db_project_image = crud.project.get_project_image(db, project_image_id=image_id)
    if not db_project_image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Verify the image belongs to the specified project
    if db_project_image.project_id != project_id:
        raise HTTPException(status_code=400, detail="Image does not belong to the specified project")
    
    # Store the image path before deleting
    image_path = db_project_image.image_path
    
    # Delete the image from the database
    db_project_image = crud.project.delete_project_image(db, project_image_id=image_id)
    
    # Delete the file
    if image_path:
        try:
            delete_file(image_path)
            logger.debug(f"Deleted image file: {image_path}")
        except Exception as e:
            logger.warning(f"Could not delete image file {image_path}: {str(e)}")
    
    # Add URL for the frontend
    if db_project_image.image_path:
        db_project_image.image_url = get_file_url(db_project_image.image_path)
    
    return db_project_image


@router.get("/{project_id}/attachments", response_model=Dict[str, Any])
@require_permission("VIEW_PROJECT_ATTACHMENTS")
def read_project_attachments(
    *,
    db: Session = Depends(deps.get_db),
    project_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    filename_filter: Optional[str] = Query(None),
    extension_filter: Optional[str] = Query(None),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get paginated attachments for a project with optional filtering.
    """
    logger.debug(f"Getting attachments for project {project_id}, page={page}, page_size={page_size}")
    
    # Check if project exists
    project = crud.project.get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get paginated attachments for the project
    attachments, total = crud.project.get_project_attachments_paginated(
        db, 
        project_id=project_id,
        page=page,
        page_size=page_size,
        filename_filter=filename_filter,
        extension_filter=extension_filter
    )
    
    # Convert to response format and add file URLs
    attachment_list = []
    for attachment in attachments:
        attachment_dict = {
            "id": attachment.id,
            "file_path": attachment.file_path,
            "file_name": attachment.file_name,
            "created_at": attachment.created_at,
            "updated_at": attachment.updated_at,
        }
        if attachment.file_path:
            attachment_dict["file_url"] = get_file_url(attachment.file_path)
        attachment_list.append(attachment_dict)
    
    return {
        "items": attachment_list,
        "total": total,
        "page": page,
        "page_size": page_size,
        "filename_filter": filename_filter,
        "extension_filter": extension_filter
    }


@router.post("/{project_id}/attachments", response_model=schemas.ProjectAttachmentOut)
@require_permission("UPLOAD_PROJECT_ATTACHMENTS")
async def upload_project_attachment(
    *,
    db: Session = Depends(deps.get_db),
    project_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Upload an attachment for a project.
    Supported file types: PDF, Word docs, Excel, CSV, text files
    """
    logger.info(f"Uploading attachment for project {project_id}: {file.filename}")
    
    try:
        # Check if project exists
        project = crud.project.get_project(db, project_id=project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
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
                status_code=400,
                detail=f"Invalid file type '{file.content_type}'. Supported types: PDF, Word documents, Excel files, CSV, text files, JSON, XML, ZIP"
            )
        
        # Check file size (limit to 10MB for attachments)
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large ({len(contents) / (1024 * 1024):.2f}MB). Maximum size: 10MB"
            )
        
        # Reset file pointer for saving
        await file.seek(0)
        
        # Create upload directory if it doesn't exist
        upload_dir = Path(settings.UPLOADS_DIR) / "projects" / str(project_id) / "attachments"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Use original filename
        original_filename = file.filename
        file_path = upload_dir / original_filename
        
        # Check if file already exists
        if file_path.exists():
            raise HTTPException(
                status_code=400,
                detail=f"File '{original_filename}' already exists. Please rename the file or delete the existing one."
            )
        
        # Save the file
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # Create relative path for database storage
        relative_path = str(file_path.relative_to(Path(settings.BASE_DIR)))
        
        # Create attachment in database
        attachment_data = schemas.ProjectAttachmentCreate(
            file_path=relative_path,
            file_name=file.filename  # Keep original filename for display
        )
        
        # Add project attachment to database
        project_attachment = crud.project.add_project_attachment(
            db, 
            project_id=project_id, 
            attachment=attachment_data
        )
        
        # Add file URL for frontend
        project_attachment.file_url = get_file_url(project_attachment.file_path)
        
        # Stage RAG index event for attachment
        try:
            stage_event(db, {
                "op": "insert",
                "source_table": "project_attachments",
                "source_id": str(project_attachment.id),
                "changed_fields": ["file_name", "file_path"]
            })
        except Exception:
            pass
        
        logger.info(f"Attachment uploaded successfully: {file.filename}")
        return project_attachment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading attachment for project {project_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.delete("/{project_id}/attachments/{attachment_id}", response_model=schemas.ProjectAttachmentOut)
@require_permission("DELETE_PROJECT_ATTACHMENTS")
def delete_project_attachment(
    *,
    db: Session = Depends(deps.get_db),
    project_id: int,
    attachment_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete a project attachment.
    """
    logger.info(f"Deleting attachment {attachment_id} for project {project_id}")
    
    try:
        # Check if project exists
        project = crud.project.get_project(db, project_id=project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get the attachment
        attachment = crud.project.get_project_attachment(db, attachment_id=attachment_id)
        if not attachment:
            raise HTTPException(status_code=404, detail="Project attachment not found")
        
        # Verify the attachment belongs to the specified project
        if attachment.project_id != project_id:
            raise HTTPException(status_code=400, detail="Attachment does not belong to the specified project")
        
        # Store file path before deletion
        file_path = attachment.file_path
        
        # Delete the project attachment from database
        deleted_attachment = crud.project.delete_project_attachment(db, attachment_id=attachment_id)
        
        # Delete the file from filesystem
        if file_path:
            full_file_path = Path(settings.BASE_DIR) / file_path
            if full_file_path.exists():
                try:
                    full_file_path.unlink()
                    logger.debug(f"Deleted attachment file: {full_file_path}")
                except Exception as e:
                    logger.warning(f"Could not delete attachment file {full_file_path}: {str(e)}")
        
        # Add file URL for response
        if deleted_attachment.file_path:
            deleted_attachment.file_url = get_file_url(deleted_attachment.file_path)
        
        logger.info(f"Attachment {attachment_id} deleted successfully")
        
        # Stage RAG delete event for attachment
        try:
            stage_event(db, {
                "op": "delete",
                "source_table": "project_attachments",
                "source_id": str(attachment_id),
                "changed_fields": []
            })
        except Exception:
            pass
        
        return deleted_attachment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting attachment for project {project_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/{project_id}/attachments/{attachment_id}/public")
async def get_attachment_public_url(
    project_id: int,
    attachment_id: int,
    token: str = Query(..., description="Temporary access token"),
    db: Session = Depends(deps.get_db)
):
    """
    Get public URL for an attachment using a temporary token
    This endpoint allows external viewers (Google Docs, Office) to access files
    """
    try:
        # Verify the temporary token
        if not verify_temp_token(token, f"attachment_{attachment_id}"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token"
            )
        
        # Get the attachment
        attachment = crud.project.get_project_attachment(db, attachment_id)
        if not attachment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found"
            )
        
        # Verify the attachment belongs to the specified project
        if attachment.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found"
            )
        
        # Construct the file path
        file_path = Path(settings.UPLOADS_DIR) / attachment.file_path.lstrip("/uploads/")
        
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Return the file directly
        return FileResponse(
            path=str(file_path),
            filename=attachment.file_name,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "*",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving public attachment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to serve attachment"
        )

@router.post("/{project_id}/attachments/{attachment_id}/preview-token")
@require_permission("VIEW_PROJECT_ATTACHMENTS")
async def generate_preview_token(
    project_id: int,
    attachment_id: int,
    request: Request,
    current_user: models.User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """
    Generate a temporary token for external preview services
    """
    # Get the attachment
    attachment = crud.project.get_project_attachment(db, attachment_id)
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Verify the attachment belongs to the specified project
    if attachment.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Generate temporary token (valid for 1 hour)
    token = create_temp_token(f"attachment_{attachment_id}", expires_in=3600)
    
    # Construct public URL
    public_url = f"/api/projects/{project_id}/attachments/{attachment_id}/public?token={token}"
    
    # Get base URL - use simple approach
    base_url = "http://127.0.0.1:8000"
    
    return {
        "public_url": public_url,
        "full_url": f"{base_url}{public_url}",
        "expires_in": 3600,
        "token": token
    }
