from sqlalchemy.orm import Session, joinedload
from sqlalchemy import asc, desc, or_, select
from app.models.section import Section, SectionText, SectionImage, SectionAttachment, project_sections
from app.models.language import Language
from app.models.project import Project
from app.schemas.section import (
    SectionCreate, SectionUpdate, SectionTextCreate, Filter,
    SectionImageCreate, SectionAttachmentCreate, ProjectSectionCreate
)
from typing import List, Optional, Tuple
from app.core.logging import setup_logger
from app.core.db import db_transaction

# Set up logger using centralized logging
logger = setup_logger("app.crud.section")

# CRUD Functions
def get_section(db: Session, section_id: int):
    logger.debug(f"Fetching section with ID {section_id}")
    try:
        section = db.query(Section).options(
            joinedload(Section.section_texts).joinedload(SectionText.language)
        ).filter(Section.id == section_id).first()
        
        if section:
            logger.debug(f"Found section {section_id} with {len(section.section_texts)} texts")
        else:
            logger.debug(f"Section {section_id} not found")
            
        return section
    except Exception as e:
        logger.error(f"Error fetching section {section_id}: {e}")
        raise

def get_section_by_code(db: Session, code: str):
    logger.debug(f"Fetching section by code: {code}")
    try:
        section = db.query(Section).options(
            joinedload(Section.section_texts).joinedload(SectionText.language)
        ).filter(Section.code == code).first()
        
        if section:
            logger.debug(f"Found section with code {code}: ID {section.id}")
        else:
            logger.debug(f"Section with code {code} not found")
            
        return section
    except Exception as e:
        logger.error(f"Error fetching section by code {code}: {e}")
        raise

@db_transaction
def create_section(db: Session, section: SectionCreate):
    logger.debug(f"Starting section creation for {section.code}")
    
    try:
        # Create the section
        db_section = Section(
            code=section.code,
            # Set default values for user tracking fields
            created_by=1,  # Default user ID
            updated_by=1   # Default user ID
        )
        db.add(db_section)
        db.flush()  # Flush to get the section ID
        
        logger.debug(f"Created section with ID {db_section.id}")
        
        # Create section texts
        for text_data in section.section_texts:
            # Verify language exists
            language = db.query(Language).filter(Language.id == text_data.language_id).first()
            if not language:
                logger.error(f"Invalid language ID: {text_data.language_id}")
                raise ValueError(f"Language with ID {text_data.language_id} not found")
            
            section_text = SectionText(
                section_id=db_section.id,
                language_id=text_data.language_id,
                text=text_data.text,
                created_by=1,  # Default user ID
                updated_by=1   # Default user ID
            )
            db.add(section_text)
            logger.debug(f"Added text for language {text_data.language_id}")
        
        logger.info(f"Successfully created section {section.code} with ID {db_section.id}")
        return db_section
    except ValueError:
        # Re-raise validation errors
        raise
    except Exception as e:
        logger.error(f"Error creating section {section.code}: {e}")
        raise

@db_transaction
def update_section(db: Session, section_id: int, section: SectionUpdate):
    logger.debug(f"Starting section update for ID {section_id}")
    
    try:
        # Get the section
        db_section = db.query(Section).filter(Section.id == section_id).first()
        if not db_section:
            logger.error(f"Section with ID {section_id} not found")
            return None
        
        # Update section fields
        if section.code is not None:
            logger.debug(f"Updating code from {db_section.code} to {section.code}")
            db_section.code = section.code
        
        # Update user tracking
        db_section.updated_by = 1  # Default user ID
        
        # Update section texts
        if section.section_texts is not None:  # Check if section_texts is provided (even if empty)
            # Get existing texts
            existing_texts = db.query(SectionText).filter(SectionText.section_id == section_id).all()
            existing_texts_by_lang = {text.language_id: text for text in existing_texts}
            
            # Track which languages are in the update
            updated_language_ids = set()
            
            for text_data in section.section_texts:
                # Verify language exists
                language = db.query(Language).filter(Language.id == text_data.language_id).first()
                if not language:
                    logger.error(f"Invalid language ID: {text_data.language_id}")
                    raise ValueError(f"Language with ID {text_data.language_id} not found")
                
                # Add to set of updated languages
                updated_language_ids.add(text_data.language_id)
                
                # Update existing or create new
                if text_data.language_id in existing_texts_by_lang:
                    logger.debug(f"Updating text for language ID {text_data.language_id}")
                    existing_text = existing_texts_by_lang[text_data.language_id]
                    existing_text.text = text_data.text
                    existing_text.updated_by = 1  # Default user ID
                else:
                    logger.debug(f"Creating new text for language ID {text_data.language_id}")
                    new_text = SectionText(
                        section_id=section_id,
                        language_id=text_data.language_id,
                        text=text_data.text,
                        created_by=1,  # Default user ID
                        updated_by=1   # Default user ID
                    )
                    db.add(new_text)
            
            # Remove texts for languages that are not in the update
            for lang_id, text in existing_texts_by_lang.items():
                if lang_id not in updated_language_ids:
                    logger.debug(f"Removing text for language ID {lang_id}")
                    db.delete(text)
        
        logger.info(f"Successfully updated section {section_id}")
        return db_section
    except ValueError:
        # Re-raise validation errors
        raise
    except Exception as e:
        logger.error(f"Error updating section {section_id}: {e}")
        raise

@db_transaction
def delete_section(db: Session, section_id: int):
    logger.debug(f"Deleting section with ID {section_id}")
    
    try:
        # Get the section
        db_section = db.query(Section).filter(Section.id == section_id).first()
        if not db_section:
            logger.error(f"Section with ID {section_id} not found")
            return None
        
        # Delete associated section texts
        deleted_texts = db.query(SectionText).filter(SectionText.section_id == section_id).delete()
        logger.debug(f"Deleted {deleted_texts} section texts")
        
        # Delete the section
        db.delete(db_section)
        
        logger.info(f"Successfully deleted section {section_id}")
        return db_section
    except Exception as e:
        logger.error(f"Error deleting section {section_id}: {e}")
        raise

def get_sections(db: Session, skip: int = 0, limit: int = 100):
    logger.debug(f"Getting sections with skip={skip}, limit={limit}")
    try:
        sections = db.query(Section).offset(skip).limit(limit).all()
        logger.debug(f"Retrieved {len(sections)} sections")
        return sections
    except Exception as e:
        logger.error(f"Error getting sections: {e}")
        raise

def get_sections_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: List[Filter] = None,
    sort_field: str = None,
    sort_order: str = "asc",
    code_filter: str = None,
    text_filter: str = None,
    language_filter_values: List[str] = None
) -> Tuple[List[Section], int]:
    logger.debug(f"Getting paginated sections with page={page}, page_size={page_size}")
    
    try:
        query = db.query(Section).options(
            joinedload(Section.section_texts).joinedload(SectionText.language)
        )
        
        # Apply direct filters
        if code_filter:
            logger.debug(f"Applying code filter: {code_filter}")
            query = query.filter(Section.code.ilike(f"%{code_filter}%"))
        
        # Apply text filter to search in section texts
        if text_filter:
            logger.debug(f"Applying text filter: {text_filter}")
            query = query.join(Section.section_texts, isouter=True).filter(SectionText.text.ilike(f"%{text_filter}%")).distinct()
        
        if language_filter_values:
            logger.debug(f"Applying language filters: {language_filter_values}")
            # Convert string IDs to integers and validate
            language_ids = []
            for lang_id in language_filter_values:
                try:
                    language_ids.append(int(lang_id))
                except (ValueError, TypeError):
                    logger.warning(f"Invalid language ID: {lang_id}")
                    continue
            
            if language_ids:
                # Join with the section_texts and filter by language_id
                # Use distinct to avoid duplicate results when joining
                query = query.join(Section.section_texts).filter(SectionText.language_id.in_(language_ids)).distinct()
        
        # Apply generic filters
        if filters:
            logger.debug(f"Applying {len(filters)} generic filters")
            for filter_item in filters:
                if hasattr(Section, filter_item.field):
                    column = getattr(Section, filter_item.field)
                    if filter_item.operator == "contains":
                        query = query.filter(column.ilike(f"%{filter_item.value}%"))
                    elif filter_item.operator == "equals":
                        query = query.filter(column == filter_item.value)
                    elif filter_item.operator == "startsWith":
                        query = query.filter(column.ilike(f"{filter_item.value}%"))
                    elif filter_item.operator == "endsWith":
                        query = query.filter(column.ilike(f"%{filter_item.value}"))
        
        # Get total count before pagination
        # Use a separate count query to avoid issues with distinct and joins
        count_query = db.query(Section.id)
        
        # Apply the same filters to the count query
        if code_filter:
            count_query = count_query.filter(Section.code.ilike(f"%{code_filter}%"))
        
        if text_filter:
            count_query = count_query.join(Section.section_texts, isouter=True).filter(SectionText.text.ilike(f"%{text_filter}%")).distinct()
        
        if language_filter_values and language_ids:
            count_query = count_query.join(Section.section_texts, isouter=True).filter(SectionText.language_id.in_(language_ids)).distinct()
        
        # Apply generic filters to count query
        if filters:
            for filter_item in filters:
                if hasattr(Section, filter_item.field):
                    column = getattr(Section, filter_item.field)
                    if filter_item.operator == "contains":
                        count_query = count_query.filter(column.ilike(f"%{filter_item.value}%"))
                    elif filter_item.operator == "equals":
                        count_query = count_query.filter(column == filter_item.value)
                    elif filter_item.operator == "startsWith":
                        count_query = count_query.filter(column.ilike(f"{filter_item.value}%"))
                    elif filter_item.operator == "endsWith":
                        count_query = count_query.filter(column.ilike(f"%{filter_item.value}"))
        
        total = count_query.distinct().count()
        logger.debug(f"Total sections found: {total}")
        
        # Apply sorting
        if sort_field:
            logger.debug(f"Sorting by {sort_field} {sort_order}")
            if sort_field == 'language':
                # Sort by the language name
                query = query.join(Section.section_texts, isouter=True).join(SectionText.language, isouter=True).order_by(
                    desc(Language.name) if sort_order == 'desc' else asc(Language.name)
                ).distinct()
            else:
                sort_column = getattr(Section, sort_field, None)
                if sort_column is not None:
                    query = query.order_by(desc(sort_column) if sort_order == 'desc' else asc(sort_column))
        else:
            # Default sorting by id
            query = query.order_by(Section.id)
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        sections = query.all()
        logger.debug(f"Returning {len(sections)} sections for page {page}")
        
        return sections, total
    except Exception as e:
        logger.error(f"Error in get_sections_paginated: {e}")
        raise


# Project Section Association Functions
@db_transaction
def add_section_to_project(db: Session, project_id: int, section_id: int, display_order: int = 0):
    """Add a section to a project"""
    logger.debug(f"Adding section {section_id} to project {project_id} with order {display_order}")

    try:
        # Check if association already exists
        stmt = select(project_sections).where(
            project_sections.c.project_id == project_id,
            project_sections.c.section_id == section_id
        )
        existing = db.execute(stmt).first()

        if existing:
            logger.warning(f"Section {section_id} already associated with project {project_id}")
            return False

        # Insert association
        stmt = project_sections.insert().values(
            project_id=project_id,
            section_id=section_id,
            display_order=display_order
        )
        db.execute(stmt)
        logger.info(f"Successfully added section {section_id} to project {project_id}")
        return True
    except Exception as e:
        logger.error(f"Error adding section to project: {e}")
        raise


@db_transaction
def remove_section_from_project(db: Session, project_id: int, section_id: int):
    """Remove a section from a project"""
    logger.debug(f"Removing section {section_id} from project {project_id}")

    try:
        stmt = project_sections.delete().where(
            project_sections.c.project_id == project_id,
            project_sections.c.section_id == section_id
        )
        result = db.execute(stmt)

        if result.rowcount == 0:
            logger.warning(f"Section {section_id} not found in project {project_id}")
            return False

        logger.info(f"Successfully removed section {section_id} from project {project_id}")
        return True
    except Exception as e:
        logger.error(f"Error removing section from project: {e}")
        raise


def get_project_sections(db: Session, project_id: int) -> List[Section]:
    """Get all sections for a project with display_order from the association table"""
    logger.debug(f"Getting sections for project {project_id}")

    try:
        # Query sections with display_order from the association table
        results = db.query(Section, project_sections.c.display_order).join(
            project_sections,
            Section.id == project_sections.c.section_id
        ).filter(
            project_sections.c.project_id == project_id
        ).options(
            joinedload(Section.section_texts).joinedload(SectionText.language),
            joinedload(Section.images),
            joinedload(Section.attachments)
        ).order_by(project_sections.c.display_order).all()

        # Add display_order as an attribute to each section object
        sections = []
        for section, display_order in results:
            section.display_order = display_order
            sections.append(section)

        logger.debug(f"Found {len(sections)} sections for project {project_id}")
        return sections
    except Exception as e:
        logger.error(f"Error getting project sections: {e}")
        raise


# Section Image Functions
@db_transaction
def add_section_image(db: Session, section_id: int, image_data: SectionImageCreate, created_by: int = 1):
    """Add an image to a section"""
    logger.debug(f"Adding image to section {section_id}")

    try:
        image = SectionImage(
            section_id=section_id,
            image_path=image_data.image_path,
            language_id=image_data.language_id,
            display_order=image_data.display_order,
            created_by=created_by,
            updated_by=created_by
        )
        db.add(image)
        logger.info(f"Successfully added image to section {section_id}")
        return image
    except Exception as e:
        logger.error(f"Error adding section image: {e}")
        raise


@db_transaction
def delete_section_image(db: Session, image_id: int):
    """Delete a section image"""
    logger.debug(f"Deleting section image {image_id}")

    try:
        image = db.query(SectionImage).filter(SectionImage.id == image_id).first()
        if not image:
            logger.warning(f"Section image {image_id} not found")
            return None

        db.delete(image)
        logger.info(f"Successfully deleted section image {image_id}")
        return image
    except Exception as e:
        logger.error(f"Error deleting section image: {e}")
        raise


# Section Attachment Functions
@db_transaction
def add_section_attachment(db: Session, section_id: int, attachment_data: SectionAttachmentCreate, created_by: int = 1):
    """Add an attachment to a section"""
    logger.debug(f"Adding attachment to section {section_id}")

    try:
        attachment = SectionAttachment(
            section_id=section_id,
            file_path=attachment_data.file_path,
            file_name=attachment_data.file_name,
            language_id=attachment_data.language_id,
            display_order=attachment_data.display_order,
            created_by=created_by,
            updated_by=created_by
        )
        db.add(attachment)
        logger.info(f"Successfully added attachment to section {section_id}")
        return attachment
    except Exception as e:
        logger.error(f"Error adding section attachment: {e}")
        raise


@db_transaction
def delete_section_attachment(db: Session, attachment_id: int):
    """Delete a section attachment"""
    logger.debug(f"Deleting section attachment {attachment_id}")

    try:
        attachment = db.query(SectionAttachment).filter(SectionAttachment.id == attachment_id).first()
        if not attachment:
            logger.warning(f"Section attachment {attachment_id} not found")
            return None

        db.delete(attachment)
        logger.info(f"Successfully deleted section attachment {attachment_id}")
        return attachment
    except Exception as e:
        logger.error(f"Error deleting section attachment: {e}")
        raise
