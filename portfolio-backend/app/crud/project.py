from sqlalchemy.orm import Session, selectinload
from sqlalchemy import asc, desc, or_, func
from app.models.project import Project, ProjectText, ProjectImage, ProjectAttachment
from app.models.category import Category, CategoryText
from app.models.skill import Skill
from app.models.language import Language
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectTextCreate, ProjectTextUpdate, ProjectImageCreate, ProjectAttachmentCreate, Filter, ProjectOut
from typing import List, Optional, Tuple, Any, Dict
from app.core.logging import setup_logger

# Set up logger using centralized logging
logger = setup_logger("app.crud.project")

# CRUD Functions
def get_project(db: Session, project_id: int) -> Optional[Project]:
    """
    Retrieve a project by ID with all relationships loaded

    Args:
        db: Database session
        project_id: ID of the project to retrieve

    Returns:
        Project object if found, None otherwise
    """
    logger.debug(f"Fetching project with ID {project_id}")
    from app.models.section import Section, SectionText, SectionImage, SectionAttachment
    return db.query(Project).options(
        selectinload(Project.project_texts).selectinload(ProjectText.language),
        selectinload(Project.categories),
        selectinload(Project.skills).selectinload(Skill.skill_texts),
        selectinload(Project.images),
        selectinload(Project.attachments),
        selectinload(Project.sections).selectinload(Section.section_texts).selectinload(SectionText.language),
        selectinload(Project.sections).selectinload(Section.images),
        selectinload(Project.sections).selectinload(Section.attachments)
    ).filter(Project.id == project_id).first()

def create_project(db: Session, project: ProjectCreate):
    logger.debug(f"Starting project creation with {len(project.project_texts)} texts")

    try:
        # Create the project
        db_project = Project(
            repository_url=project.repository_url,
            website_url=project.website_url,
            project_date=project.project_date
        )
        db.add(db_project)
        db.flush()  # Flush to get the project ID
        logger.debug(f"Project created with ID: {db_project.id}")
        
        # Add categories if provided
        if project.categories:
            logger.debug(f"Adding categories: {project.categories}")
            categories = db.query(Category).filter(Category.id.in_(project.categories)).all()
            if len(categories) != len(project.categories):
                missing_categories = set(project.categories) - {cat.id for cat in categories}
                logger.error(f"Invalid category IDs: {missing_categories}")
                raise ValueError(f"Invalid category IDs: {missing_categories}")
            db_project.categories = categories
            logger.debug(f"Successfully added {len(categories)} categories to project")
        
        # Add skills if provided
        if project.skills:
            logger.debug(f"Adding skills: {project.skills}")
            try:
                skills = db.query(Skill).filter(Skill.id.in_(project.skills)).all()
                logger.debug(f"Found {len(skills)} skills in database for IDs: {[s.id for s in skills]}")
                
                if len(skills) != len(project.skills):
                    missing_skills = set(project.skills) - {skill.id for skill in skills}
                    logger.error(f"Invalid skill IDs: {missing_skills}")
                    raise ValueError(f"Invalid skill IDs: {missing_skills}")
                
                db_project.skills = skills
                logger.debug(f"Successfully added {len(skills)} skills to project")
            except Exception as e:
                logger.error(f"Error adding skills to project: {str(e)}", exc_info=True)
                raise
        
        # Create project texts
        for i, text_data in enumerate(project.project_texts):
            logger.debug(f"Processing project text {i+1}/{len(project.project_texts)}: language_id={text_data.language_id}")
            # Verify language exists
            language = db.query(Language).filter(Language.id == text_data.language_id).first()
            if not language:
                logger.error(f"Invalid language ID: {text_data.language_id}")
                raise ValueError(f"Invalid language ID: {text_data.language_id}")
            
            db_project_text = ProjectText(
                project_id=db_project.id,
                language_id=text_data.language_id,
                name=text_data.name,
                description=text_data.description
            )
            db.add(db_project_text)
        
        db.commit()
        logger.debug(f"Project created successfully with ID: {db_project.id}")
        
        # Refresh and reload the project with all relationships
        db.refresh(db_project)
        return get_project(db, db_project.id)
        
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}", exc_info=True)
        db.rollback()
        raise

def update_project(db: Session, project_id: int, project: ProjectUpdate):
    logger.debug(f"Updating project with ID {project_id}")
    db_project = get_project(db, project_id)
    
    if not db_project:
        return None
    
    # Update fields if provided
    if project.repository_url is not None:
        db_project.repository_url = project.repository_url

    if project.website_url is not None:
        db_project.website_url = project.website_url

    if project.project_date is not None:
        db_project.project_date = project.project_date

    # Update categories if provided
    if project.categories is not None:
        categories = db.query(Category).filter(Category.id.in_(project.categories)).all()
        if len(categories) != len(project.categories):
            missing_categories = set(project.categories) - {cat.id for cat in categories}
            logger.error(f"Invalid category IDs: {missing_categories}")
            raise ValueError(f"Invalid category IDs: {missing_categories}")
        db_project.categories = categories
    
    # Update skills if provided
    if project.skills is not None:
        skills = db.query(Skill).filter(Skill.id.in_(project.skills)).all()
        if len(skills) != len(project.skills):
            missing_skills = set(project.skills) - {skill.id for skill in skills}
            logger.error(f"Invalid skill IDs: {missing_skills}")
            raise ValueError(f"Invalid skill IDs: {missing_skills}")
        db_project.skills = skills
    
    # Update project texts if provided
    if project.project_texts is not None:
        # First, remove existing texts
        db.query(ProjectText).filter(ProjectText.project_id == project_id).delete()
        
        # Then add new texts
        for text_data in project.project_texts:
            # Verify language exists
            language = db.query(Language).filter(Language.id == text_data.language_id).first()
            if not language:
                logger.error(f"Invalid language ID: {text_data.language_id}")
                raise ValueError(f"Invalid language ID: {text_data.language_id}")
            
            db_project_text = ProjectText(
                project_id=db_project.id,
                language_id=text_data.language_id,
                name=text_data.name,
                description=text_data.description
            )
            db.add(db_project_text)
    
    db.commit()
    logger.debug(f"Project updated successfully: {db_project.id}")
    return db_project

def delete_project(db: Session, project_id: int):
    logger.debug(f"Deleting project with ID {project_id}")
    db_project = get_project(db, project_id)
    
    if not db_project:
        return None
    
    # Delete associated texts, images, and attachments
    db.query(ProjectText).filter(ProjectText.project_id == project_id).delete()
    db.query(ProjectImage).filter(ProjectImage.project_id == project_id).delete()
    db.query(ProjectAttachment).filter(ProjectAttachment.project_id == project_id).delete()
    
    # Delete the project
    db.delete(db_project)
    db.commit()
    logger.debug(f"Project with ID {project_id} successfully deleted")
    return db_project

def add_project_image(db: Session, project_id: int, image: ProjectImageCreate):
    logger.debug(f"Adding image to project with ID {project_id}")
    db_project = get_project(db, project_id)
    
    if not db_project:
        return None
    
    db_project_image = ProjectImage(
        project_id=project_id,
        image_path=image.image_path,
        category=image.category
    )
    db.add(db_project_image)
    db.flush()
    
    return db_project_image

def delete_project_image(db: Session, image_id: int):
    logger.debug(f"Deleting project image with ID {image_id}")
    db_image = db.query(ProjectImage).filter(ProjectImage.id == image_id).first()
    
    if not db_image:
        return None
    
    db.delete(db_image)
    db.commit()
    logger.debug(f"Project image with ID {image_id} successfully deleted")
    return db_image

def add_project_attachment(db: Session, project_id: int, attachment: ProjectAttachmentCreate, created_by: int = None):
    logger.debug(f"Adding attachment to project with ID {project_id}")
    db_project = get_project(db, project_id)
    
    if not db_project:
        return None
    
    db_project_attachment = ProjectAttachment(
        project_id=project_id,
        file_path=attachment.file_path,
        file_name=attachment.file_name,
        category_id=attachment.category_id,
        language_id=attachment.language_id,
        created_by=created_by,
        updated_by=created_by
    )
    db.add(db_project_attachment)
    db.commit()  # Commit the transaction to save to database
    db.refresh(db_project_attachment)  # Refresh to get updated fields like timestamps
    
    return db_project_attachment

def get_project_attachments(db: Session, project_id: int) -> List[ProjectAttachment]:
    """
    Get all attachments for a project
    """
    logger.debug(f"Fetching attachments for project {project_id}")
    return db.query(ProjectAttachment).filter(ProjectAttachment.project_id == project_id).all()

def get_project_attachments_paginated(
    db: Session, 
    project_id: int, 
    page: int = 1, 
    page_size: int = 10,
    filename_filter: Optional[str] = None,
    extension_filter: Optional[str] = None
) -> Tuple[List[ProjectAttachment], int]:
    """
    Get paginated attachments for a project with optional filtering
    """
    logger.debug(f"Fetching paginated attachments for project {project_id}, page={page}, page_size={page_size}")
    
    # Eagerly load language and category relationships
    query = db.query(ProjectAttachment)\
        .options(selectinload(ProjectAttachment.language))\
        .options(selectinload(ProjectAttachment.category).selectinload(Category.category_texts).selectinload(CategoryText.language))\
        .filter(ProjectAttachment.project_id == project_id)
    
    # Apply filename filter
    if filename_filter:
        query = query.filter(ProjectAttachment.file_name.ilike(f"%{filename_filter}%"))
    
    # Apply extension filter
    if extension_filter:
        # Remove leading dot if present
        ext = extension_filter.lstrip('.')
        query = query.filter(ProjectAttachment.file_name.ilike(f"%.{ext}"))
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    attachments = query.offset(offset).limit(page_size).all()
    
    logger.debug(f"Found {len(attachments)} attachments out of {total} total for project {project_id}")
    return attachments, total

def get_project_attachment(db: Session, attachment_id: int) -> Optional[ProjectAttachment]:
    """
    Get a project attachment by ID
    """
    logger.debug(f"Fetching attachment with ID {attachment_id}")
    return db.query(ProjectAttachment).filter(ProjectAttachment.id == attachment_id).first()

def update_project_attachment(
    db: Session, 
    attachment_id: int, 
    category_id: Optional[int] = None,
    language_id: Optional[int] = None,
    is_default: Optional[bool] = None,
    updated_by: Optional[int] = None
) -> Optional[ProjectAttachment]:
    """
    Update a project attachment's metadata (category, language, is_default)
    """
    logger.debug(f"Updating attachment {attachment_id}: category_id={category_id}, language_id={language_id}, is_default={is_default}")
    
    attachment = db.query(ProjectAttachment).filter(ProjectAttachment.id == attachment_id).first()
    if not attachment:
        logger.warning(f"Attachment {attachment_id} not found")
        return None
    
    # Update fields if provided
    if category_id is not None:
        attachment.category_id = category_id
    if language_id is not None:
        attachment.language_id = language_id
    if is_default is not None:
        attachment.is_default = is_default
    if updated_by is not None:
        attachment.updated_by = updated_by
    
    db.commit()
    db.refresh(attachment)
    
    logger.info(f"Successfully updated attachment {attachment_id}")
    return attachment

def delete_project_attachment(db: Session, attachment_id: int):
    logger.debug(f"Deleting project attachment with ID {attachment_id}")
    db_attachment = db.query(ProjectAttachment).filter(ProjectAttachment.id == attachment_id).first()
    
    if not db_attachment:
        return None
    
    db.delete(db_attachment)
    db.commit()
    logger.debug(f"Project attachment with ID {attachment_id} successfully deleted")
    return db_attachment

def get_projects(db: Session, skip: int = 0, limit: int = 100):
    logger.debug(f"Fetching projects with skip={skip}, limit={limit}")
    return db.query(Project).offset(skip).limit(limit).all()

def get_projects_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: List[Filter] = None,
    name_filter: Optional[str] = None,
    sort_field: str = None,
    sort_order: str = "asc"
) -> Tuple[List[Project], int]:
    """
    Get paginated projects with filters and sorting using improved query patterns
    """
    logger.debug(f"get_projects_paginated called with page={page}, page_size={page_size}, filters={len(filters) if filters else 0}")
    
    try:
        # Create base query with eager loading
        query = db.query(Project).options(
            selectinload(Project.project_texts).selectinload(ProjectText.language),
            selectinload(Project.categories),
            selectinload(Project.skills).selectinload(Skill.skill_texts),
            selectinload(Project.images),
            selectinload(Project.attachments)
        )
        
        # Track whether ProjectText is already joined to avoid duplicate joins
        project_text_joined = False
        
        # Separate category, language, and text filters from other filters
        category_filter_values = []
        language_id_values = []
        skill_id_values = []
        text_filters = []
        other_filters = []
        
        if filters:
            for filter_item in filters:
                if hasattr(filter_item, 'field') and hasattr(filter_item, 'value'):
                    if filter_item.field == "category_id" or filter_item.field == "categories":
                        logger.debug(f"Found category filter with value: {filter_item.value}")
                        category_filter_values.append(filter_item.value)
                    elif filter_item.field == "skill_id" or filter_item.field == "skills":
                        logger.debug(f"Found skill filter with value: {filter_item.value}")
                        skill_id_values.append(filter_item.value)
                    elif filter_item.field == "language_id":
                        logger.debug(f"Found language filter with value: {filter_item.value}")
                        language_id_values.append(filter_item.value)
                    elif filter_item.field == "name" or filter_item.field == "description":
                        text_filters.append(filter_item)
                    elif hasattr(Project, filter_item.field):
                        column = getattr(Project, filter_item.field)
                        if hasattr(filter_item, 'operator'):
                            op = filter_item.operator
                            if op == "contains":
                                other_filters.append(column.ilike(f"%{filter_item.value}%"))
                            elif op == "equals":
                                other_filters.append(column == filter_item.value)
                            elif op == "startsWith":
                                other_filters.append(column.ilike(f"{filter_item.value}%"))
                            elif op == "endsWith":
                                other_filters.append(column.ilike(f"%{filter_item.value}"))
                        else:
                            # Default to contains if operator is not specified
                            other_filters.append(column.ilike(f"%{filter_item.value}%"))
        
        # Apply direct name filter if provided
        if name_filter:
            logger.debug(f"Applying direct name filter: '{name_filter}'")
            if not project_text_joined:
                logger.debug("Joining ProjectText table for name filtering")
                query = query.join(ProjectText)
                project_text_joined = True
            
            query = query.filter(ProjectText.name.ilike(f"%{name_filter}%"))
            logger.debug(f"Applied ILIKE filter for name: %{name_filter}%")
        
        if other_filters:
            query = query.filter(*other_filters)
        
        # Apply category filters
        if category_filter_values:
            logger.debug(f"Filtering by categories: {category_filter_values}")
            conditions = [Category.id == int(cat_id) for cat_id in category_filter_values]
            query = query.join(Project.categories).filter(or_(*conditions)).distinct()
        
        # Apply skill filters
        if skill_id_values:
            logger.debug(f"Filtering by skills: {skill_id_values}")
            skill_conditions = []
            
            for skill_id in skill_id_values:
                # Check if it's a valid integer
                try:
                    skill_id_int = int(skill_id)
                    skill_conditions.append(Skill.id == skill_id_int)
                except (ValueError, TypeError):
                    logger.warning(f"Invalid skill_id value: {skill_id}")
                    continue
            
            # If we have valid skill conditions
            if skill_conditions:
                query = query.join(Project.skills).filter(or_(*skill_conditions)).distinct()
        
        # Apply language filters
        if language_id_values:
            logger.debug(f"Filtering by languages: {language_id_values}")
            language_conditions = []
            
            for lang_id in language_id_values:
                # Check if it's a valid integer
                try:
                    lang_id_int = int(lang_id)
                    language_conditions.append(ProjectText.language_id == lang_id_int)
                except (ValueError, TypeError):
                    logger.warning(f"Invalid language_id value: {lang_id}")
                    continue
            
            # If we have valid language conditions
            if language_conditions:
                if not project_text_joined:
                    logger.debug("Joining ProjectText table for language filtering")
                    query = query.join(Project.project_texts)
                    project_text_joined = True
                
                query = query.filter(or_(*language_conditions)).distinct()
        
        # Apply text filters
        if text_filters:
            for filter_item in text_filters:
                if not project_text_joined:
                    logger.debug("Joining ProjectText table for text filtering")
                    query = query.join(ProjectText)
                    project_text_joined = True
                
                if hasattr(filter_item, 'field') and hasattr(filter_item, 'value'):
                    # Check if the attribute actually exists on ProjectText
                    if not hasattr(ProjectText, filter_item.field):
                        logger.warning(f"Field {filter_item.field} does not exist on ProjectText model, skipping this filter")
                        continue
                        
                    column = getattr(ProjectText, filter_item.field)
                    if hasattr(filter_item, 'operator'):
                        op = filter_item.operator
                        if op == "contains":
                            query = query.filter(column.ilike(f"%{filter_item.value}%"))
                        elif op == "equals":
                            query = query.filter(column == filter_item.value)
                        elif op == "startsWith":
                            query = query.filter(column.ilike(f"{filter_item.value}%"))
                        elif op == "endsWith":
                            query = query.filter(column.ilike(f"%{filter_item.value}"))
                    else:
                        # Default to contains if operator is not specified
                        query = query.filter(column.ilike(f"%{filter_item.value}%"))
                    query = query.distinct()
        
        total = query.count()
        
        if sort_field:
            if hasattr(Project, sort_field):
                sort_func = asc if sort_order == "asc" else desc
                query = query.order_by(sort_func(getattr(Project, sort_field)))
            elif sort_field in ["name", "description"]:
                # Sort by name or description in the default language
                default_language = db.query(Language).filter(Language.is_default == True).first()
                if default_language:
                    if not project_text_joined:
                        logger.debug("Joining ProjectText table for sorting")
                        query = query.join(ProjectText)
                        project_text_joined = True
                    
                    query = query.filter(ProjectText.language_id == default_language.id)
                    sort_func = asc if sort_order == "asc" else desc
                    query = query.order_by(sort_func(getattr(ProjectText, sort_field)))
        
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        items = query.all()
        logger.debug(f"Successfully retrieved {len(items)} projects out of {total} total")
        
        return items, total
        
    except Exception as e:
        logger.error(f"Error in get_projects_paginated: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to retrieve projects: {str(e)}")

# Project images CRUD operations

def get_project_image(db: Session, project_image_id: int):
    """
    Get a project image by ID
    """
    return db.query(ProjectImage).filter(ProjectImage.id == project_image_id).first()

def get_project_images(db: Session, project_id: int):
    """
    Get all images for a project
    """
    return db.query(ProjectImage).filter(ProjectImage.project_id == project_id).all()

def get_project_images_by_category_and_language(
    db: Session, 
    project_id: int, 
    category: str, 
    language_id: int = None
):
    """
    Get project images filtered by category and optionally by language.
    This is useful for enforcing uniqueness constraints (one image per category per language).
    
    Args:
        db: Database session
        project_id: Project ID
        category: Image category code (e.g., 'PROI-LOGO', 'PROI-THUMBNAIL')
        language_id: Optional language ID. If None, will match images with NULL language_id
    
    Returns:
        List of ProjectImage objects matching the criteria
    """
    query = db.query(ProjectImage).filter(
        ProjectImage.project_id == project_id,
        ProjectImage.category == category
    )
    
    # Handle language_id filter
    if language_id is not None:
        query = query.filter(ProjectImage.language_id == language_id)
    else:
        query = query.filter(ProjectImage.language_id.is_(None))
    
    return query.all()

def create_project_image(db: Session, project_id: int, image_path: str, category: str = "gallery", language_id: int = None, created_by: int = None):
    """
    Create a new project image
    """
    db_project_image = ProjectImage(
        project_id=project_id,
        image_path=image_path,
        category=category,
        language_id=language_id,
        created_by=created_by,
        updated_by=created_by  # Same user for initial creation
    )
    db.add(db_project_image)
    db.commit()
    db.refresh(db_project_image)
    return db_project_image

def update_project_image(db: Session, project_image_id: int, image_path: str = None, category: str = None, language_id: int = None, updated_by: int = None):
    """
    Update a project image
    """
    db_project_image = get_project_image(db, project_image_id)
    if not db_project_image:
        return None
    
    if image_path:
        db_project_image.image_path = image_path
    
    if category:
        db_project_image.category = category
    
    if language_id is not None:
        db_project_image.language_id = language_id
    
    if updated_by:
        db_project_image.updated_by = updated_by
    
    db.commit()
    db.refresh(db_project_image)
    return db_project_image

def delete_project_image(db: Session, project_image_id: int):
    """
    Delete a project image
    """
    db_project_image = get_project_image(db, project_image_id)
    if not db_project_image:
        return None
    
    db.delete(db_project_image)
    db.commit()
    return db_project_image
