"""
CMS API endpoints - Content Management System endpoints for editing website content.
Requires authentication and EDIT_CONTENT permission.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Any, Optional, List
from pydantic import BaseModel
from pathlib import Path
from app.api import deps
from app.models import User
from app.crud import project as project_crud
from app.crud import experience as experience_crud
from app.crud import section as section_crud
from app.schemas.project import ProjectTextUpdate
from app.schemas.experience import ExperienceTextUpdate
from app.schemas.section import SectionTextUpdate
from app.core.security_decorators import require_permission
from app.core.logging import setup_logger
from app.api.utils import file_utils

# Set up logger
logger = setup_logger("app.api.endpoints.cms")

# Define router
router = APIRouter()


# Request/Response Models
class ContentTextUpdateRequest(BaseModel):
    """Request model for updating text content."""
    name: Optional[str] = None
    description: Optional[str] = None
    text: Optional[str] = None


class ContentOrderRequest(BaseModel):
    """Request model for reordering content."""
    entity_type: str  # 'project', 'experience', 'section'
    entity_ids: List[int]  # New order of IDs
    portfolio_id: int


class ContentOrderResponse(BaseModel):
    """Response model for reorder operation."""
    message: str
    reordered_count: int


@router.patch("/content/project-text/{text_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_CONTENT")
def update_project_text(
    text_id: int,
    content: ContentTextUpdateRequest,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Update project text content (name, description).
    Requires EDIT_CONTENT permission.
    
    Args:
        text_id: ID of the project text to update
        content: Updated content (name and/or description)
    
    Returns:
        Updated project text
    """
    logger.info(f"User {current_user.username} updating project text {text_id}")
    
    try:
        # Get the project text
        from app.models.project import ProjectText
        project_text = db.query(ProjectText).filter(ProjectText.id == text_id).first()
        
        if not project_text:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project text with ID {text_id} not found"
            )
        
        # Update fields
        if content.name is not None:
            project_text.name = content.name
        if content.description is not None:
            project_text.description = content.description
        
        db.commit()
        db.refresh(project_text)
        
        logger.info(f"Successfully updated project text {text_id}")
        return {
            "id": project_text.id,
            "project_id": project_text.project_id,
            "language_id": project_text.language_id,
            "name": project_text.name,
            "description": project_text.description,
            "message": "Project text updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating project text {text_id}: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating project text: {str(e)}"
        )


@router.patch("/content/experience-text/{text_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_CONTENT")
def update_experience_text(
    text_id: int,
    content: ContentTextUpdateRequest,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Update experience text content (name, description).
    Requires EDIT_CONTENT permission.
    
    Args:
        text_id: ID of the experience text to update
        content: Updated content (name and/or description)
    
    Returns:
        Updated experience text
    """
    logger.info(f"User {current_user.username} updating experience text {text_id}")
    
    try:
        # Get the experience text
        from app.models.experience import ExperienceText
        experience_text = db.query(ExperienceText).filter(ExperienceText.id == text_id).first()
        
        if not experience_text:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Experience text with ID {text_id} not found"
            )
        
        # Update fields
        if content.name is not None:
            experience_text.name = content.name
        if content.description is not None:
            experience_text.description = content.description
        
        db.commit()
        db.refresh(experience_text)
        
        logger.info(f"Successfully updated experience text {text_id}")
        return {
            "id": experience_text.id,
            "experience_id": experience_text.experience_id,
            "language_id": experience_text.language_id,
            "name": experience_text.name,
            "description": experience_text.description,
            "message": "Experience text updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating experience text {text_id}: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating experience text: {str(e)}"
        )


@router.patch("/content/section-text/{text_id}", status_code=status.HTTP_200_OK)
@require_permission("EDIT_CONTENT")
def update_section_text(
    text_id: int,
    content: ContentTextUpdateRequest,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Update section text content.
    Requires EDIT_CONTENT permission.
    
    Args:
        text_id: ID of the section text to update
        content: Updated content (text field)
    
    Returns:
        Updated section text
    """
    logger.info(f"User {current_user.username} updating section text {text_id}")
    
    try:
        # Get the section text
        from app.models.section import SectionText
        section_text = db.query(SectionText).filter(SectionText.id == text_id).first()
        
        if not section_text:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Section text with ID {text_id} not found"
            )
        
        # Update text field
        if content.text is not None:
            section_text.text = content.text
        
        db.commit()
        db.refresh(section_text)
        
        logger.info(f"Successfully updated section text {text_id}")
        return {
            "id": section_text.id,
            "section_id": section_text.section_id,
            "language_id": section_text.language_id,
            "text": section_text.text,
            "message": "Section text updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating section text {text_id}: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating section text: {str(e)}"
        )


@router.post("/content/images", status_code=status.HTTP_201_CREATED)
@require_permission("EDIT_CONTENT")
async def upload_content_image(
    file: UploadFile = File(...),
    entity_type: str = Query(..., description="Entity type: portfolio, project, experience"),
    entity_id: int = Query(..., description="Entity ID"),
    category: str = Query("main", description="Image category: main, thumbnail, gallery, background"),
    language_id: Optional[int] = Query(None, description="Language ID for the image"),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Upload or replace image for content entity (portfolio, project, experience).
    Requires EDIT_CONTENT permission.
    
    Args:
        file: Image file to upload
        entity_type: Type of entity (portfolio, project, experience)
        entity_id: ID of the entity
        category: Image category (main, thumbnail, gallery, background)
        language_id: Optional language ID for language-specific images
    
    Returns:
        Uploaded image details
    """
    logger.info(f"User {current_user.username} uploading {category} image for {entity_type} {entity_id} with language_id={language_id}")
    
    try:
        # Validate entity type
        if entity_type not in ["portfolio", "project", "experience", "section"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid entity type: {entity_type}. Must be portfolio, project, experience, or section"
            )
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only image files are allowed"
            )
        
        # Save the file using existing file utils
        # Construct directory path for the entity
        from app.core.config import settings
        upload_dir = Path(settings.UPLOADS_DIR) / f"{entity_type}s" / str(entity_id) / category
        absolute_file_path = await file_utils.save_upload_file(file, directory=upload_dir)
        
        # Convert absolute path to URL-friendly relative path
        file_path = file_utils.get_file_url(absolute_file_path)
        
        # Handle image record based on entity type
        if entity_type == "portfolio":
            from app.models.portfolio import PortfolioImage
            
            # Check if image already exists for this portfolio + category + language
            # For language-specific images (main/hero), check category AND language_id
            # This allows multiple main images, one per language
            if language_id is not None:
                existing_image = db.query(PortfolioImage).filter(
                    PortfolioImage.portfolio_id == entity_id,
                    PortfolioImage.category == category,
                    PortfolioImage.language_id == language_id
                ).first()
            else:
                # For images without language, only check category
                existing_image = db.query(PortfolioImage).filter(
                    PortfolioImage.portfolio_id == entity_id,
                    PortfolioImage.category == category,
                    PortfolioImage.language_id.is_(None)
                ).first()
            
            if existing_image:
                # Delete old file if it exists
                old_file_path = existing_image.image_path
                if old_file_path:
                    # Convert URL path back to absolute path for deletion
                    if old_file_path.startswith('/uploads/'):
                        old_abs_path = str(Path(settings.UPLOADS_DIR).parent / old_file_path.lstrip('/'))
                        file_utils.delete_file(old_abs_path)
                
                # Update existing record
                existing_image.image_path = file_path
                existing_image.file_name = file.filename
                existing_image.updated_by = current_user.id
                if language_id is not None:
                    existing_image.language_id = language_id
                image = existing_image
                logger.info(f"Updated existing {category} image for portfolio {entity_id} with language_id={language_id}")
            else:
                # Create new record
                image = PortfolioImage(
                    portfolio_id=entity_id,
                    image_path=file_path,
                    file_name=file.filename,
                    category=category,
                    language_id=language_id,
                    created_by=current_user.id,
                    updated_by=current_user.id
                )
                db.add(image)
                logger.info(f"Created new {category} image for portfolio {entity_id}")
            
        elif entity_type == "project":
            from app.models.project import ProjectImage
            
            # Check if image already exists for this project + category
            existing_image = db.query(ProjectImage).filter(
                ProjectImage.project_id == entity_id,
                ProjectImage.category == category
            ).first()
            
            if existing_image:
                # Delete old file if it exists
                old_file_path = existing_image.image_path
                if old_file_path:
                    # Convert URL path back to absolute path for deletion
                    if old_file_path.startswith('/uploads/'):
                        old_abs_path = str(Path(settings.UPLOADS_DIR).parent / old_file_path.lstrip('/'))
                        file_utils.delete_file(old_abs_path)
                
                # Update existing record
                existing_image.image_path = file_path
                existing_image.file_name = file.filename
                existing_image.updated_by = current_user.id
                image = existing_image
                logger.info(f"Updated existing {category} image for project {entity_id}")
            else:
                # Create new record
                image = ProjectImage(
                    project_id=entity_id,
                    image_path=file_path,
                    file_name=file.filename,
                    category=category,
                    created_by=current_user.id,
                    updated_by=current_user.id
                )
                db.add(image)
                logger.info(f"Created new {category} image for project {entity_id}")
            
        elif entity_type == "experience":
            # Note: Experience images might not exist in schema yet
            # This would need to be added to the Experience model
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Experience images not yet implemented"
            )

        elif entity_type == "section":
            # Section images are handled separately - just save the file
            # The actual SectionImage record is created via the section image endpoint
            logger.info(f"File saved for section {entity_id}, path: {file_path}")
            return {
                "entity_type": entity_type,
                "entity_id": entity_id,
                "image_path": file_path,
                "path": file_path,  # Alternative field name
                "file_name": file.filename,
                "category": category,
                "message": "Section image file uploaded successfully. Use addSectionImage API to link it."
            }

        db.commit()
        db.refresh(image)
        
        logger.info(f"Successfully uploaded {category} image for {entity_type} {entity_id}")
        return {
            "id": image.id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "image_path": file_path,
            "file_name": file.filename,
            "category": category,
            "message": f"{entity_type.capitalize()} image uploaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading image: {str(e)}"
        )


@router.post("/content/attachments")
@require_permission("EDIT_CONTENT")
async def upload_attachment(
    file: UploadFile,
    entity_type: str = Query(...),
    entity_id: int = Query(...),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Upload an attachment (file) for a content entity.
    Requires EDIT_CONTENT permission.

    Currently supports: section

    Args:
        file: File to upload
        entity_type: Type of entity (section)
        entity_id: ID of the entity

    Returns:
        Uploaded file details
    """
    logger.info(f"User {current_user.username} uploading attachment for {entity_type} {entity_id}")

    try:
        # Validate entity type
        if entity_type not in ["section"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid entity type: {entity_type}. Currently only 'section' is supported for attachments"
            )

        # Save the file
        from app.core.config import settings
        upload_dir = Path(settings.UPLOADS_DIR) / f"{entity_type}s" / str(entity_id) / "attachments"
        absolute_file_path = await file_utils.save_upload_file(file, directory=upload_dir)

        # Convert absolute path to URL-friendly relative path
        file_path = file_utils.get_file_url(absolute_file_path)

        # For sections, just return the file path
        # The actual SectionAttachment record is created via the section attachment endpoint
        logger.info(f"File saved for {entity_type} {entity_id}, path: {file_path}")
        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "file_path": file_path,
            "path": file_path,  # Alternative field name
            "file_name": file.filename,
            "message": f"{entity_type.capitalize()} attachment uploaded successfully. Use addSectionAttachment API to link it."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading attachment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading attachment: {str(e)}"
        )


@router.patch("/content/order", response_model=ContentOrderResponse)
@require_permission("EDIT_CONTENT")
def reorder_content(
    reorder_request: ContentOrderRequest,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Reorder projects, experiences, or sections within a portfolio.
    Requires EDIT_CONTENT permission.
    
    Note: This is a placeholder implementation. Full implementation would require
    adding an 'order' or 'position' field to the association tables.
    
    Args:
        reorder_request: Entity type, entity IDs in new order, and portfolio ID
    
    Returns:
        Confirmation of reorder operation
    """
    logger.info(
        f"User {current_user.username} reordering {reorder_request.entity_type} "
        f"in portfolio {reorder_request.portfolio_id}"
    )
    
    try:
        # Validate entity type
        if reorder_request.entity_type not in ["project", "experience", "section"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid entity type: {reorder_request.entity_type}"
            )
        
        # TODO: Implement actual reordering logic
        # This would require:
        # 1. Adding an 'order' column to portfolio_projects, portfolio_experiences, portfolio_sections tables
        # 2. Updating the order values based on the entity_ids list
        # 3. Committing the changes
        
        logger.warning(
            f"Reorder operation requested but not fully implemented for {reorder_request.entity_type}"
        )
        
        return ContentOrderResponse(
            message=f"Reorder operation acknowledged for {reorder_request.entity_type}. "
                    "Full implementation requires database schema update.",
            reordered_count=len(reorder_request.entity_ids)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reordering content: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reordering content: {str(e)}"
        )


@router.patch("/content/project/{project_id}")
@require_permission("EDIT_CONTENT")
def update_project_metadata(
    project_id: int,
    repository_url: Optional[str] = None,
    website_url: Optional[str] = None,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Update project metadata (repository_url, website_url).
    Requires EDIT_CONTENT permission.
    
    Args:
        project_id: ID of the project to update
        repository_url: New repository URL
        website_url: New website URL
    
    Returns:
        Updated project
    """
    logger.info(f"User {current_user.username} updating project {project_id} metadata")
    
    try:
        project = project_crud.get_project(db, project_id=project_id)
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )
        
        # Update fields
        if repository_url is not None:
            project.repository_url = repository_url
        if website_url is not None:
            project.website_url = website_url
        
        project.updated_by = current_user.id
        
        db.commit()
        db.refresh(project)
        
        logger.info(f"Successfully updated project {project_id} metadata")
        return {
            "id": project.id,
            "repository_url": project.repository_url,
            "website_url": project.website_url,
            "message": "Project metadata updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating project metadata: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating project metadata: {str(e)}"
        )
