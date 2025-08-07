from sqlalchemy.orm import Session
from app.models.project import ProjectImage
from typing import List, Optional
from app.core.logging import setup_logger

# Set up logger using centralized logging
logger = setup_logger("app.crud.image")

def get_image(db: Session, image_id: int):
    """
    Get an image by ID
    """
    logger.debug(f"Fetching image with ID {image_id}")
    return db.query(ProjectImage).filter(ProjectImage.id == image_id).first()

def get_images_by_project_id(db: Session, project_id: int) -> List[ProjectImage]:
    """
    Get all images for a project
    """
    logger.debug(f"Fetching images for project {project_id}")
    images = db.query(ProjectImage).filter(ProjectImage.project_id == project_id).all()
    
    # Add URLs for convenience
    from app.utils.file_utils import get_file_url
    for image in images:
        if image.image_path:
            image.image_url = get_file_url(image.image_path)
    
    return images

def create_image(db: Session, project_id: int, image_path: str, category: str = "gallery", original_filename: Optional[str] = None):
    """
    Create a new project image
    """
    logger.debug(f"Creating image for project {project_id} with category {category}")
    db_image = ProjectImage(
        project_id=project_id,
        image_path=image_path,
        category=category,
        original_filename=original_filename
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image

def update_image(db: Session, image_id: int, image_path: Optional[str] = None, category: Optional[str] = None):
    """
    Update a project image
    """
    logger.debug(f"Updating image {image_id}")
    db_image = get_image(db, image_id)
    if not db_image:
        return None
    
    if image_path:
        db_image.image_path = image_path
    
    if category:
        db_image.category = category
    
    db.commit()
    db.refresh(db_image)
    return db_image

def delete_image(db: Session, image_id: int):
    """
    Delete a project image
    """
    logger.debug(f"Deleting image {image_id}")
    db_image = get_image(db, image_id)
    if not db_image:
        return None
    
    db.delete(db_image)
    db.commit()
    return db_image 