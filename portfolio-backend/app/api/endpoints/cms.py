"""
CMS API endpoints - Content Management System endpoints for editing website content.
Requires authentication and EDIT_CONTENT permission.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Any, Optional, List
from pydantic import BaseModel
from pathlib import Path
from app.api import deps
from app.models import User
from app.crud import project as project_crud
from app.crud import experience as experience_crud
from app.crud import section as section_crud
from app.crud import portfolio as portfolio_crud
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


class ProjectSectionsOrderRequest(BaseModel):
    """Request model for reordering project sections."""
    section_ids: List[int]  # New order of section IDs for this project


class SectionContentOrderRequest(BaseModel):
    """Request model for reordering content within a section."""
    content_items: List[dict]  # List of {type, id, display_order}


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
        resolved_language_id = language_id
        resolved_experience_id = None
        experience_text_id = None
        storage_entity_id = entity_id
        experience_obj = None
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

        storage_entity_id = entity_id
        resolved_experience_id = None
        resolved_language_id = language_id
        experience_text_id = None

        # Resolve experience metadata before saving so files land under the experience ID
        if entity_type == "experience":
            if not experience_crud.experience_images_supported(db):
                raise HTTPException(
                    status_code=status.HTTP_501_NOT_IMPLEMENTED,
                    detail="Experience images are not available until the latest migrations are applied."
                )

            from app.models.experience import Experience, ExperienceText

            experience_text_row = db.query(ExperienceText).filter(ExperienceText.id == entity_id).first()

            if experience_text_row:
                resolved_experience_id = experience_text_row.experience_id
                resolved_language_id = language_id if language_id is not None else experience_text_row.language_id
                experience_text_id = experience_text_row.id
            else:
                resolved_experience_id = entity_id

            experience_obj = db.query(Experience).filter(Experience.id == resolved_experience_id).first()
            if not experience_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Experience with ID {entity_id} not found"
                )

            storage_entity_id = resolved_experience_id

        # Save file in fixed storage bucket to avoid user-controlled path segments.
        from app.core.config import settings
        upload_dir = Path(settings.UPLOADS_DIR) / "content_images"
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
            from app.models.experience import ExperienceImage

            image = ExperienceImage(
                experience_id=resolved_experience_id,
                experience_text_id=experience_text_id,
                image_path=file_path,
                file_name=file.filename,
                category=category,
                language_id=resolved_language_id,
                created_by=current_user.id,
                updated_by=current_user.id,
            )
            db.add(image)
            logger.info(
                "Created new %s image for experience %s (experience_text_id=%s, language_id=%s)",
                category,
                resolved_experience_id,
                experience_text_id,
                resolved_language_id,
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
        response_payload = {
            "id": image.id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "image_path": image.image_path,
            "file_path": image.image_path,
            "image_url": file_utils.get_file_url(image.image_path),
            "file_name": getattr(image, "file_name", file.filename),
            "category": category,
            "language_id": getattr(image, "language_id", resolved_language_id),
            "message": f"{entity_type.capitalize()} image uploaded successfully"
        }

        if entity_type == "experience":
            response_payload.update({
                "experience_id": resolved_experience_id,
                "experience_text_id": experience_text_id,
            })

        return response_payload
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading image: {str(e)}"
        )


@router.get("/content/images", status_code=status.HTTP_200_OK)
@require_permission("EDIT_CONTENT")
def list_content_images(
    entity_type: str = Query(..., description="Entity type: portfolio, project, experience, section"),
    entity_id: int = Query(..., description="Entity identifier (ID or text ID for experiences)"),
    category: Optional[str] = Query(None, description="Optional image category filter"),
    language_id: Optional[int] = Query(None, description="Optional language filter"),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    List previously uploaded content images for supported entities.
    Allows the CMS editor to reuse existing assets.
    """
    logger.info(
        "User %s listing images for entity %s %s (category=%s, language_id=%s)",
        current_user.username,
        entity_type,
        entity_id,
        category,
        language_id,
    )

    try:
        from app.models.portfolio import PortfolioImage
        from app.models.project import ProjectImage
        from app.models.section import SectionImage
        from app.models.experience import Experience, ExperienceText, ExperienceImage

        items: List[dict] = []

        if entity_type == "portfolio":
            query = db.query(PortfolioImage).filter(PortfolioImage.portfolio_id == entity_id)
            if category:
                query = query.filter(PortfolioImage.category == category)
            if language_id is not None:
                query = query.filter(
                    or_(
                        PortfolioImage.language_id == language_id,
                        PortfolioImage.language_id.is_(None),
                    )
                )
            images = query.order_by(PortfolioImage.created_at.desc()).all()
            for image in images:
                items.append({
                    "id": image.id,
                    "portfolio_id": image.portfolio_id,
                    "image_path": image.image_path,
                    "image_url": file_utils.get_file_url(image.image_path),
                    "file_name": getattr(image, "file_name", None),
                    "category": getattr(image, "category", None),
                    "language_id": getattr(image, "language_id", None),
                })

        elif entity_type == "project":
            query = db.query(ProjectImage).filter(ProjectImage.project_id == entity_id)
            if category:
                query = query.filter(ProjectImage.category == category)
            if language_id is not None:
                query = query.filter(ProjectImage.language_id == language_id)
            images = query.order_by(ProjectImage.created_at.desc()).all()
            for image in images:
                items.append({
                    "id": image.id,
                    "project_id": image.project_id,
                    "image_path": image.image_path,
                    "image_url": file_utils.get_file_url(image.image_path),
                    "file_name": getattr(image, "file_name", None),
                    "category": getattr(image, "category", None),
                    "language_id": getattr(image, "language_id", None),
                })

        elif entity_type == "experience":
            if not experience_crud.experience_images_supported(db):
                logger.info("Experience images requested but table unavailable; returning empty list")
                return {"items": []}

            experience_text = db.query(ExperienceText).filter(ExperienceText.id == entity_id).first()
            if experience_text:
                resolved_experience_id = experience_text.experience_id
                resolved_language_id = language_id if language_id is not None else experience_text.language_id
                resolved_text_id = experience_text.id
            else:
                experience_obj = db.query(Experience).filter(Experience.id == entity_id).first()
                if not experience_obj:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Experience with ID {entity_id} not found"
                    )
                resolved_experience_id = experience_obj.id
                resolved_language_id = language_id
                resolved_text_id = None

            query = db.query(ExperienceImage).filter(ExperienceImage.experience_id == resolved_experience_id)
            if category:
                query = query.filter(ExperienceImage.category == category)

            if resolved_language_id is not None:
                query = query.filter(
                    or_(
                        ExperienceImage.language_id == resolved_language_id,
                        ExperienceImage.language_id.is_(None),
                    )
                )

            if resolved_text_id is not None:
                query = query.filter(
                    or_(
                        ExperienceImage.experience_text_id == resolved_text_id,
                        ExperienceImage.experience_text_id.is_(None),
                    )
                )

            images = query.order_by(ExperienceImage.created_at.desc()).all()
            for image in images:
                items.append({
                    "id": image.id,
                    "experience_id": image.experience_id,
                    "experience_text_id": image.experience_text_id,
                    "image_path": image.image_path,
                    "image_url": file_utils.get_file_url(image.image_path),
                    "file_name": getattr(image, "file_name", None),
                    "category": getattr(image, "category", None),
                    "language_id": getattr(image, "language_id", None),
                })

        elif entity_type == "section":
            query = db.query(SectionImage).filter(SectionImage.section_id == entity_id)
            if category:
                query = query.filter(SectionImage.category == category)
            images = query.order_by(SectionImage.created_at.desc()).all()
            for image in images:
                items.append({
                    "id": image.id,
                    "section_id": image.section_id,
                    "image_path": image.image_path,
                    "image_url": file_utils.get_file_url(image.image_path),
                    "file_name": getattr(image, "file_name", None),
                    "category": getattr(image, "category", None),
                    "language_id": getattr(image, "language_id", None),
                })
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported entity type: {entity_type}",
            )

        return {"items": items}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing content images: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing images: {str(e)}",
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

        # Save file in fixed storage bucket to avoid user-controlled path segments.
        from app.core.config import settings
        upload_dir = Path(settings.UPLOADS_DIR) / "section_attachments"
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
        
        # Validate portfolio exists
        portfolio = portfolio_crud.get_portfolio(db, portfolio_id=reorder_request.portfolio_id)
        if not portfolio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Portfolio with ID {reorder_request.portfolio_id} not found"
            )
        
        # Determine the association table based on entity type
        if reorder_request.entity_type == "experience":
            from app.models.portfolio import portfolio_experiences
            table = portfolio_experiences
            entity_column = "experience_id"
        elif reorder_request.entity_type == "project":
            from app.models.portfolio import portfolio_projects
            table = portfolio_projects
            entity_column = "project_id"
        else:  # section
            from app.models.portfolio import portfolio_sections
            table = portfolio_sections
            entity_column = "section_id"
        
        # Update the order for each entity
        updated_count = 0
        for new_order, entity_id in enumerate(reorder_request.entity_ids, start=1):
            stmt = (
                table.update()
                .where(table.c.portfolio_id == reorder_request.portfolio_id)
                .where(table.c[entity_column] == entity_id)
                .values(order=new_order)
            )
            result = db.execute(stmt)
            updated_count += result.rowcount
        
        db.commit()
        
        logger.info(
            f"Successfully reordered {updated_count} {reorder_request.entity_type}(s) "
            f"in portfolio {reorder_request.portfolio_id}"
        )
        
        return ContentOrderResponse(
            message=f"Successfully reordered {updated_count} {reorder_request.entity_type}(s)",
            reordered_count=updated_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
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


@router.patch("/content/project/{project_id}/sections/order", response_model=ContentOrderResponse)
@require_permission("EDIT_CONTENT")
def reorder_project_sections(
    project_id: int,
    reorder_request: ProjectSectionsOrderRequest,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Reorder sections within a specific project.
    Updates the display_order in the project_sections association table.
    Requires EDIT_CONTENT permission.
    
    Args:
        project_id: ID of the project
        reorder_request: List of section IDs in new order
    
    Returns:
        Confirmation of reorder operation
    """
    logger.info(
        f"User {current_user.username} reordering sections for project {project_id}"
    )
    logger.info(f"Received section IDs for reordering: {reorder_request.section_ids}")
    
    try:
        # Validate project exists
        project = project_crud.get_project(db, project_id=project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )
        
        logger.info(f"Project found: {project.id}, current sections: {[s.id for s in project.sections]}")
        
        # Update the display_order for each section in the project
        from app.models.section import project_sections
        
        updated_count = 0
        for new_order, section_id in enumerate(reorder_request.section_ids, start=0):
            logger.debug(f"Updating section {section_id} to display_order {new_order}")
            stmt = (
                project_sections.update()
                .where(project_sections.c.project_id == project_id)
                .where(project_sections.c.section_id == section_id)
                .values(display_order=new_order)
            )
            result = db.execute(stmt)
            updated_count += result.rowcount
            logger.debug(f"Update affected {result.rowcount} row(s)")
        
        db.commit()
        
        logger.info(
            f"Successfully reordered {updated_count} section(s) for project {project_id}"
        )
        
        return ContentOrderResponse(
            message=f"Successfully reordered {updated_count} section(s)",
            reordered_count=updated_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error reordering project sections: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reordering project sections: {str(e)}"
        )


@router.patch("/content/project/{project_id}/section/{section_id}/order")
@require_permission("EDIT_CONTENT")
def update_section_display_order_in_project(
    project_id: int,
    section_id: int,
    request_body: dict,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Update display_order for a specific section within a project.
    This updates the project_sections association table.
    Requires EDIT_CONTENT permission.
    
    Args:
        project_id: ID of the project
        section_id: ID of the section
        request_body: JSON body with display_order field
    
    Returns:
        Confirmation of update
    """
    display_order = request_body.get("display_order")
    if display_order is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="display_order is required in request body"
        )
    
    logger.info(
        f"User {current_user.username} updating display_order for section {section_id} "
        f"in project {project_id} to {display_order}"
    )
    
    try:
        # Validate project exists
        project = project_crud.get_project(db, project_id=project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )
        
        # Validate section exists and is associated with the project
        from app.models.section import project_sections
        existing = db.execute(
            project_sections.select().where(
                project_sections.c.project_id == project_id,
                project_sections.c.section_id == section_id
            )
        ).first()
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Section {section_id} is not associated with project {project_id}"
            )
        
        # Update display_order
        stmt = (
            project_sections.update()
            .where(project_sections.c.project_id == project_id)
            .where(project_sections.c.section_id == section_id)
            .values(display_order=display_order)
        )
        result = db.execute(stmt)
        db.commit()
        
        logger.info(
            f"Successfully updated display_order to {display_order} for section {section_id} "
            f"in project {project_id}"
        )
        
        return {
            "message": f"Successfully updated display order to {display_order}",
            "project_id": project_id,
            "section_id": section_id,
            "display_order": display_order
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating section display order: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating section display order: {str(e)}"
        )


@router.patch("/content/section/{section_id}/content/order", response_model=ContentOrderResponse)
@require_permission("EDIT_CONTENT")
def reorder_section_content(
    section_id: int,
    reorder_request: SectionContentOrderRequest,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Reorder content within a specific section (images and attachments).
    Updates the display_order for section images and attachments.
    Requires EDIT_CONTENT permission.
    
    Note: Section text always has display_order 0 and appears first.
    
    Args:
        section_id: ID of the section
        reorder_request: List of content items with type, id, and display_order
    
    Returns:
        Confirmation of reorder operation
    """
    logger.info(
        f"User {current_user.username} reordering content for section {section_id}"
    )
    
    try:
        # Validate section exists
        from app.models.section import Section, SectionImage, SectionAttachment
        
        section = db.query(Section).filter(Section.id == section_id).first()
        if not section:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Section with ID {section_id} not found"
            )
        
        # Update display_order for each content item
        updated_count = 0
        
        for item in reorder_request.content_items:
            content_type = item.get('type')
            content_id = item.get('id')
            display_order = item.get('display_order', 0)
            
            # Skip text items (they're not reorderable in the same way)
            if content_type == 'text':
                continue
            
            if content_type == 'image':
                # Update section image
                stmt = (
                    SectionImage.__table__.update()
                    .where(SectionImage.id == content_id)
                    .where(SectionImage.section_id == section_id)
                    .values(display_order=display_order, updated_by=current_user.id)
                )
                result = db.execute(stmt)
                updated_count += result.rowcount
                
            elif content_type == 'file':
                # Update section attachment
                stmt = (
                    SectionAttachment.__table__.update()
                    .where(SectionAttachment.id == content_id)
                    .where(SectionAttachment.section_id == section_id)
                    .values(display_order=display_order, updated_by=current_user.id)
                )
                result = db.execute(stmt)
                updated_count += result.rowcount
        
        db.commit()
        
        logger.info(
            f"Successfully reordered {updated_count} content item(s) for section {section_id}"
        )
        
        return ContentOrderResponse(
            message=f"Successfully reordered {updated_count} content item(s)",
            reordered_count=updated_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error reordering section content: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reordering section content: {str(e)}"
        )
