from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import asc, desc, or_, select, func
from app.models.portfolio import Portfolio, PortfolioImage, PortfolioAttachment
from app.models.link import PortfolioLink, LinkCategory, LinkCategoryText, LinkCategoryType
from app.models.language import Language
from app.models.category import Category, CategoryText
from app.models.experience import Experience, ExperienceText
from app.models.project import Project, ProjectText
from app.models.section import Section, SectionText
from app.schemas.portfolio import PortfolioCreate, PortfolioUpdate, PortfolioImageCreate, PortfolioImageUpdate, PortfolioAttachmentCreate, Filter
from typing import List, Optional, Tuple
from app.core.logging import setup_logger
from app.core.db import db_transaction
from app.crud import experience as experience_crud

# Set up logger using centralized logging
logger = setup_logger("app.crud.portfolio")

# CRUD Functions
def get_portfolio(db: Session, portfolio_id: int, full_details: bool = False) -> Optional[Portfolio]:
    """Get portfolio by ID, with optional loading of all relationships"""
    logger.debug(f"Fetching portfolio with ID {portfolio_id}, full_details={full_details}")
    try:
        supports_experience_images = False
        query = db.query(Portfolio)
        if full_details:
            supports_experience_images = experience_crud.experience_images_supported(db)
            loader_options = [
                selectinload(Portfolio.categories).selectinload(Category.category_texts).selectinload(CategoryText.language),
                selectinload(Portfolio.experiences).selectinload(Experience.experience_texts).selectinload(ExperienceText.language),
                selectinload(Portfolio.projects).selectinload(Project.project_texts).selectinload(ProjectText.language),
                selectinload(Portfolio.sections).selectinload(Section.section_texts).selectinload(SectionText.language),
                joinedload(Portfolio.images).joinedload(PortfolioImage.language),
                selectinload(Portfolio.attachments).selectinload(PortfolioAttachment.category).selectinload(Category.category_texts).selectinload(CategoryText.language),
                selectinload(Portfolio.attachments).selectinload(PortfolioAttachment.language),
                selectinload(Portfolio.links).selectinload(PortfolioLink.category).selectinload(LinkCategory.category_texts),
                selectinload(Portfolio.links).selectinload(PortfolioLink.category).selectinload(LinkCategory.category_type),
                selectinload(Portfolio.links).selectinload(PortfolioLink.link_texts)
            ]
            if supports_experience_images:
                loader_options.append(selectinload(Portfolio.experiences).selectinload(Experience.images))
            query = query.options(*loader_options)
        
        portfolio = query.filter(Portfolio.id == portfolio_id).first()
        
        if portfolio and full_details:
            # Force load all relationships to materialize them in memory
            _ = len(portfolio.categories)
            for category in portfolio.categories:
                _ = len(category.category_texts)
                for text in category.category_texts:
                    if hasattr(text, 'language'):
                        _ = text.language.id if text.language else None
            
            _ = len(portfolio.experiences)
            for experience in portfolio.experiences:
                _ = len(experience.experience_texts)
                for text in experience.experience_texts:
                    if hasattr(text, 'language'):
                        _ = text.language.id if text.language else None
                if supports_experience_images:
                    images_collection = getattr(experience, "__dict__", {}).get("images", [])
                    _ = len(images_collection)
            
            _ = len(portfolio.projects)
            for project in portfolio.projects:
                _ = len(project.project_texts)
                for text in project.project_texts:
                    if hasattr(text, 'language'):
                        _ = text.language.id if text.language else None
            
            _ = len(portfolio.sections)
            for section in portfolio.sections:
                _ = len(section.section_texts)
                for text in section.section_texts:
                    if hasattr(text, 'language'):
                        _ = text.language.id if text.language else None
            
            _ = len(portfolio.images)
            for image in portfolio.images:
                if hasattr(image, 'language') and image.language:
                    _ = image.language.id
            
            _ = len(portfolio.attachments)
            logger.debug(f"Found {len(portfolio.attachments)} attachments")
            for attachment in portfolio.attachments:
                logger.debug(f"Attachment {attachment.id}: category_id={attachment.category_id}, language_id={attachment.language_id}")
                if hasattr(attachment, 'category') and attachment.category:
                    logger.debug(f"  Category loaded: {attachment.category.id}, code={attachment.category.code}")
                    _ = attachment.category.id
                    if hasattr(attachment.category, 'category_texts'):
                        logger.debug(f"  Category has {len(attachment.category.category_texts)} texts")
                        _ = len(attachment.category.category_texts)
                else:
                    logger.debug(f"  Category NOT loaded (category_id={attachment.category_id})")
                if hasattr(attachment, 'language') and attachment.language:
                    logger.debug(f"  Language loaded: {attachment.language.id}, name={attachment.language.name}")
                    _ = attachment.language.id
                else:
                    logger.debug(f"  Language NOT loaded (language_id={attachment.language_id})")

            _ = len(portfolio.links)
            logger.debug(f"Found {len(portfolio.links)} links")
            for link in portfolio.links:
                if hasattr(link, 'category') and link.category:
                    _ = link.category.id
                    if hasattr(link.category, 'category_texts'):
                        _ = len(link.category.category_texts)
                    if hasattr(link.category, 'category_type'):
                        _ = link.category.category_type
                if hasattr(link, 'link_texts'):
                    _ = len(link.link_texts)

            logger.debug(f"Portfolio found: {portfolio.name} with {len(portfolio.categories or [])} categories, {len(portfolio.experiences or [])} experiences, {len(portfolio.projects or [])} projects, {len(portfolio.sections or [])} sections, {len(portfolio.links or [])} links")
        elif portfolio:
            logger.debug(f"Portfolio found: {portfolio.name} (basic details only)")
        else:
            logger.warning(f"Portfolio with ID {portfolio_id} not found")
        return portfolio
    except Exception as e:
        logger.error(f"Error fetching portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def create_portfolio(db: Session, portfolio: PortfolioCreate) -> Portfolio:
    """Create new portfolio"""
    logger.debug(f"Starting portfolio creation with name {portfolio.name}")
    
    try:
        # Create the portfolio
        db_portfolio = Portfolio(
            name=portfolio.name,
            description=portfolio.description
        )
        db.add(db_portfolio)
        db.flush()  # Flush to get the portfolio ID
        
        # Create portfolio images if provided
        if portfolio.images:
            for image_data in portfolio.images:
                db_portfolio_image = PortfolioImage(
                    portfolio_id=db_portfolio.id,
                    image_path=image_data.image_path,
                    category=image_data.category
                )
                db.add(db_portfolio_image)
        
        # Create portfolio attachments if provided
        if portfolio.attachments:
            for attachment_data in portfolio.attachments:
                db_portfolio_attachment = PortfolioAttachment(
                    portfolio_id=db_portfolio.id,
                    file_path=attachment_data.file_path,
                    file_name=attachment_data.file_name
                )
                db.add(db_portfolio_attachment)
        
        logger.info(f"Portfolio created successfully with ID {db_portfolio.id}")
        return db_portfolio
    except Exception as e:
        logger.error(f"Error creating portfolio: {str(e)}", exc_info=True)
        raise

@db_transaction
def update_portfolio(db: Session, portfolio_id: int, portfolio: PortfolioUpdate) -> Optional[Portfolio]:
    """Update portfolio"""
    logger.debug(f"Updating portfolio with ID {portfolio_id}")
    
    try:
        db_portfolio = get_portfolio(db, portfolio_id)
        
        if not db_portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found for update")
            return None
        
        # Update fields if provided
        update_data = portfolio.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(db_portfolio, field):
                setattr(db_portfolio, field, value)
        
        logger.info(f"Portfolio {portfolio_id} updated successfully")
        return db_portfolio
    except Exception as e:
        logger.error(f"Error updating portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def delete_portfolio(db: Session, portfolio_id: int) -> Optional[Portfolio]:
    """Delete portfolio and associated images"""
    logger.debug(f"Deleting portfolio with ID {portfolio_id}")
    
    try:
        db_portfolio = get_portfolio(db, portfolio_id)
        
        if not db_portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found for deletion")
            return None
        
        # Delete associated images
        deleted_images = db.query(PortfolioImage).filter(PortfolioImage.portfolio_id == portfolio_id).delete()
        logger.debug(f"Deleted {deleted_images} images for portfolio {portfolio_id}")
        
        # Delete associated attachments
        deleted_attachments = db.query(PortfolioAttachment).filter(PortfolioAttachment.portfolio_id == portfolio_id).delete()
        logger.debug(f"Deleted {deleted_attachments} attachments for portfolio {portfolio_id}")
        
        # Delete the portfolio
        db.delete(db_portfolio)
        logger.info(f"Portfolio {portfolio_id} deleted successfully")
        return db_portfolio
    except Exception as e:
        logger.error(f"Error deleting portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def add_portfolio_image(db: Session, portfolio_id: int, image: PortfolioImageCreate) -> Optional[PortfolioImage]:
    """Add image to portfolio"""
    logger.debug(f"Adding image to portfolio with ID {portfolio_id}")
    logger.debug(f"Image data: {image.model_dump()}")
    
    try:
        db_portfolio = get_portfolio(db, portfolio_id)
        
        if not db_portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found for image addition")
            return None
        
        db_portfolio_image = PortfolioImage(
            portfolio_id=portfolio_id,
            image_path=image.image_path,
            file_name=image.file_name,
            category=image.category,
            language_id=image.language_id
        )
        db.add(db_portfolio_image)
        db.flush()
        
        logger.info(f"Image added to portfolio {portfolio_id} with ID {db_portfolio_image.id}, language_id={db_portfolio_image.language_id}")
        return db_portfolio_image
    except Exception as e:
        logger.error(f"Error adding image to portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def delete_portfolio_image(db: Session, image_id: int) -> Optional[PortfolioImage]:
    """Delete portfolio image"""
    logger.debug(f"Deleting portfolio image with ID {image_id}")
    
    try:
        # Eagerly load the language relationship to avoid DetachedInstanceError
        db_image = db.query(PortfolioImage).options(
            joinedload(PortfolioImage.language)
        ).filter(PortfolioImage.id == image_id).first()
        
        if not db_image:
            logger.warning(f"Portfolio image with ID {image_id} not found for deletion")
            return None
        
        # Force load the language relationship before deletion
        if db_image.language:
            _ = db_image.language.id
        
        db.delete(db_image)
        logger.info(f"Portfolio image {image_id} deleted successfully")
        return db_image
    except Exception as e:
        logger.error(f"Error deleting portfolio image {image_id}: {str(e)}", exc_info=True)
        raise

def get_portfolio_images(db: Session, portfolio_id: int) -> List[PortfolioImage]:
    """Get all images for a portfolio"""
    logger.debug(f"Fetching images for portfolio {portfolio_id}")
    try:
        images = db.query(PortfolioImage).filter(PortfolioImage.portfolio_id == portfolio_id).all()
        logger.debug(f"Retrieved {len(images)} images for portfolio {portfolio_id}")
        return images
    except Exception as e:
        logger.error(f"Error fetching images for portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

def get_portfolio_image(db: Session, image_id: int) -> Optional[PortfolioImage]:
    """Get portfolio image by ID"""
    logger.debug(f"Fetching portfolio image with ID {image_id}")
    try:
        image = db.query(PortfolioImage).filter(PortfolioImage.id == image_id).first()
        if image:
            logger.debug(f"Portfolio image found: {image.file_name}")
        else:
            logger.warning(f"Portfolio image with ID {image_id} not found")
        return image
    except Exception as e:
        logger.error(f"Error fetching portfolio image {image_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def update_portfolio_image(db: Session, image_id: int, image_update: PortfolioImageUpdate) -> Optional[PortfolioImage]:
    """Update portfolio image (e.g., rename)"""
    logger.debug(f"Updating portfolio image with ID {image_id}")
    logger.debug(f"Update data: {image_update.model_dump(exclude_unset=True)}")
    
    try:
        db_image = db.query(PortfolioImage).filter(PortfolioImage.id == image_id).first()
        
        if not db_image:
            logger.warning(f"Portfolio image with ID {image_id} not found for update")
            return None
        
        # Use model_dump to get only the fields that were explicitly set
        update_data = image_update.model_dump(exclude_unset=True)
        
        # Update fields that were provided
        for field, value in update_data.items():
            if hasattr(db_image, field):
                setattr(db_image, field, value)
                logger.debug(f"Updated {field} to {value}")
        
        db.flush()
        logger.info(f"Portfolio image {image_id} updated successfully with fields: {list(update_data.keys())}")
        return db_image
    except Exception as e:
        logger.error(f"Error updating portfolio image {image_id}: {str(e)}", exc_info=True)
        raise

def get_portfolios(db: Session, skip: int = 0, limit: int = 100) -> List[Portfolio]:
    """Get portfolios with basic pagination"""
    logger.debug(f"Fetching portfolios with skip={skip}, limit={limit}")
    try:
        portfolios = db.query(Portfolio).offset(skip).limit(limit).all()
        logger.debug(f"Retrieved {len(portfolios)} portfolios")
        return portfolios
    except Exception as e:
        logger.error(f"Error fetching portfolios: {str(e)}", exc_info=True)
        raise

def get_portfolios_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: Optional[List[Filter]] = None,
    sort_field: Optional[str] = None,
    sort_order: str = "asc"
) -> Tuple[List[Portfolio], int]:
    """Get paginated portfolios with filtering and sorting"""
    logger.debug(f"Getting paginated portfolios: page={page}, page_size={page_size}")
    
    try:
        query = db.query(Portfolio)
        
        # Apply filters
        if filters:
            for filter_item in filters:
                logger.debug(f"Applying filter: {filter_item.field} {filter_item.operator} {filter_item.value}")
                if hasattr(Portfolio, filter_item.field):
                    column = getattr(Portfolio, filter_item.field)
                    if filter_item.operator == "contains":
                        query = query.filter(column.ilike(f"%{filter_item.value}%"))
                    elif filter_item.operator == "equals":
                        query = query.filter(column == filter_item.value)
                    elif filter_item.operator == "startsWith":
                        query = query.filter(column.ilike(f"{filter_item.value}%"))
                    elif filter_item.operator == "endsWith":
                        query = query.filter(column.ilike(f"%{filter_item.value}"))
        
        total = query.count()
        logger.debug(f"Total portfolios matching filters: {total}")
        
        # Apply sorting
        if sort_field and hasattr(Portfolio, sort_field):
            sort_func = asc if sort_order.lower() == "asc" else desc
            query = query.order_by(sort_func(getattr(Portfolio, sort_field)))
            logger.debug(f"Applied sorting: {sort_field} {sort_order}")
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        portfolios = query.all()
        logger.debug(f"Retrieved {len(portfolios)} portfolios for page {page}")
        
        return portfolios, total
    except Exception as e:
        logger.error(f"Error getting paginated portfolios: {str(e)}", exc_info=True)
        raise

def get_portfolio_attachments(db: Session, portfolio_id: int) -> List[PortfolioAttachment]:
    """Get all attachments for a portfolio"""
    logger.debug(f"Fetching attachments for portfolio {portfolio_id}")
    try:
        attachments = db.query(PortfolioAttachment).filter(PortfolioAttachment.portfolio_id == portfolio_id).all()
        logger.debug(f"Retrieved {len(attachments)} attachments for portfolio {portfolio_id}")
        return attachments
    except Exception as e:
        logger.error(f"Error fetching attachments for portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

def get_portfolio_attachment(db: Session, attachment_id: int) -> Optional[PortfolioAttachment]:
    """Get portfolio attachment by ID"""
    logger.debug(f"Fetching portfolio attachment with ID {attachment_id}")
    try:
        attachment = db.query(PortfolioAttachment).filter(PortfolioAttachment.id == attachment_id).first()
        if attachment:
            logger.debug(f"Portfolio attachment found: {attachment.file_name}")
        else:
            logger.warning(f"Portfolio attachment with ID {attachment_id} not found")
        return attachment
    except Exception as e:
        logger.error(f"Error fetching portfolio attachment {attachment_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def add_portfolio_attachment(db: Session, portfolio_id: int, attachment: PortfolioAttachmentCreate) -> Optional[PortfolioAttachment]:
    """Add attachment to portfolio"""
    logger.debug(f"Adding attachment to portfolio with ID {portfolio_id}: category_id={attachment.category_id}, is_default={attachment.is_default}, language_id={attachment.language_id}")
    
    try:
        db_portfolio = get_portfolio(db, portfolio_id)
        
        if not db_portfolio:
            logger.warning(f"Portfolio with ID {portfolio_id} not found for attachment addition")
            return None
        
        db_portfolio_attachment = PortfolioAttachment(
            portfolio_id=portfolio_id,
            file_path=attachment.file_path,
            file_name=attachment.file_name,
            category_id=attachment.category_id,
            is_default=attachment.is_default,
            language_id=attachment.language_id
        )
        db.add(db_portfolio_attachment)
        db.flush()
        
        logger.info(f"Attachment added to portfolio {portfolio_id} with ID {db_portfolio_attachment.id}, category_id={attachment.category_id}, is_default={attachment.is_default}, language_id={attachment.language_id}")
        return db_portfolio_attachment
    except Exception as e:
        logger.error(f"Error adding attachment to portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def update_portfolio_attachment(db: Session, attachment_id: int, category_id: Optional[int] = None, language_id: Optional[int] = None, is_default: Optional[bool] = None) -> Optional[PortfolioAttachment]:
    """Update portfolio attachment category, language, and is_default flag"""
    logger.debug(f"Updating attachment {attachment_id}: category_id={category_id}, language_id={language_id}, is_default={is_default}")
    
    try:
        db_attachment = db.query(PortfolioAttachment).filter(PortfolioAttachment.id == attachment_id).first()
        
        if not db_attachment:
            logger.warning(f"Portfolio attachment with ID {attachment_id} not found for update")
            return None
        
        # Update fields only if provided (not None)
        if category_id is not None:
            # Validate category exists if provided (and not 0)
            if category_id > 0:
                category = db.query(Category).filter(Category.id == category_id).first()
                if not category:
                    logger.error(f"Category with ID {category_id} not found - aborting update")
                    raise ValueError(f"Category with ID {category_id} not found")
            db_attachment.category_id = category_id if category_id > 0 else None
            logger.debug(f"Updated category_id to {db_attachment.category_id}")
            
        if language_id is not None:
            # Validate language exists if provided (and not 0)
            if language_id > 0:
                language = db.query(Language).filter(Language.id == language_id).first()
                if not language:
                    logger.error(f"Language with ID {language_id} not found - aborting update")
                    raise ValueError(f"Language with ID {language_id} not found")
            db_attachment.language_id = language_id if language_id > 0 else None
            logger.debug(f"Updated language_id to {db_attachment.language_id}")
            
        if is_default is not None:
            db_attachment.is_default = is_default
            logger.debug(f"Updated is_default to {db_attachment.is_default}")
        
        db.flush()
        db.refresh(db_attachment)
        
        logger.info(f"Attachment {attachment_id} updated successfully: category_id={db_attachment.category_id}, language_id={db_attachment.language_id}, is_default={db_attachment.is_default}")
        return db_attachment
    except Exception as e:
        logger.error(f"Error updating attachment {attachment_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def update_portfolio_image_metadata(db: Session, image_id: int, category: Optional[str] = None, language_id: Optional[int] = None) -> Optional[PortfolioImage]:
    """Update portfolio image category and language"""
    logger.debug(f"Updating image {image_id}: category={category}, language_id={language_id}")
    
    try:
        db_image = db.query(PortfolioImage).filter(PortfolioImage.id == image_id).first()
        
        if not db_image:
            logger.warning(f"Portfolio image with ID {image_id} not found for update")
            return None
        
        # Update fields only if provided (not None)
        if category is not None:
            db_image.category = category if category else None
            logger.debug(f"Updated category to {db_image.category}")
            
        if language_id is not None:
            # Validate language exists if provided (and not 0)
            if language_id > 0:
                language = db.query(Language).filter(Language.id == language_id).first()
                if not language:
                    logger.error(f"Language with ID {language_id} not found - aborting update")
                    raise ValueError(f"Language with ID {language_id} not found")
            db_image.language_id = language_id if language_id > 0 else None
            logger.debug(f"Updated language_id to {db_image.language_id}")
        
        db.flush()
        db.refresh(db_image)
        
        logger.info(f"Image {image_id} updated successfully: category={db_image.category}, language_id={db_image.language_id}")
        return db_image
    except Exception as e:
        logger.error(f"Error updating image {image_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def delete_portfolio_attachment(db: Session, attachment_id: int) -> Optional[PortfolioAttachment]:
    """Delete portfolio attachment"""
    logger.debug(f"Deleting portfolio attachment with ID {attachment_id}")
    
    try:
        # Eagerly load the language and category relationships to avoid DetachedInstanceError
        db_attachment = db.query(PortfolioAttachment).options(
            joinedload(PortfolioAttachment.language),
            joinedload(PortfolioAttachment.category)
        ).filter(PortfolioAttachment.id == attachment_id).first()
        
        if not db_attachment:
            logger.warning(f"Portfolio attachment with ID {attachment_id} not found for deletion")
            return None
        
        # Force load relationships before deletion
        if db_attachment.language:
            _ = db_attachment.language.id
        if db_attachment.category:
            _ = db_attachment.category.id
        
        db.delete(db_attachment)
        logger.info(f"Portfolio attachment {attachment_id} deleted successfully")
        return db_attachment
    except Exception as e:
        logger.error(f"Error deleting portfolio attachment {attachment_id}: {str(e)}", exc_info=True)
        raise

# Portfolio Association Functions

@db_transaction
def add_portfolio_category(db: Session, portfolio_id: int, category_id: int) -> bool:
    """Add a category to a portfolio"""
    logger.debug(f"Adding category {category_id} to portfolio {portfolio_id}")
    
    try:
        # Verify both portfolio and category exist
        portfolio = get_portfolio(db, portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio {portfolio_id} not found")
            return False
            
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            logger.warning(f"Category {category_id} not found")
            return False
        
        # Check if already associated
        if category in portfolio.categories:
            logger.info(f"Category {category_id} already associated with portfolio {portfolio_id}")
            return True
        
        # Add the association
        portfolio.categories.append(category)
        logger.info(f"Category {category_id} added to portfolio {portfolio_id} successfully")
        return True
    except Exception as e:
        logger.error(f"Error adding category {category_id} to portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def remove_portfolio_category(db: Session, portfolio_id: int, category_id: int) -> bool:
    """Remove a category from a portfolio"""
    logger.debug(f"Removing category {category_id} from portfolio {portfolio_id}")
    
    try:
        # Verify portfolio exists
        portfolio = get_portfolio(db, portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio {portfolio_id} not found")
            return False
            
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            logger.warning(f"Category {category_id} not found")
            return False
        
        # Check if associated
        if category not in portfolio.categories:
            logger.info(f"Category {category_id} not associated with portfolio {portfolio_id}")
            return True
        
        # Remove the association
        portfolio.categories.remove(category)
        logger.info(f"Category {category_id} removed from portfolio {portfolio_id} successfully")
        return True
    except Exception as e:
        logger.error(f"Error removing category {category_id} from portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def add_portfolio_experience(db: Session, portfolio_id: int, experience_id: int) -> bool:
    """Add an experience to a portfolio"""
    logger.debug(f"Adding experience {experience_id} to portfolio {portfolio_id}")
    
    try:
        # Verify both portfolio and experience exist
        portfolio = get_portfolio(db, portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio {portfolio_id} not found")
            return False
            
        experience = db.query(Experience).filter(Experience.id == experience_id).first()
        if not experience:
            logger.warning(f"Experience {experience_id} not found")
            return False
        
        # Check if already associated
        if experience in portfolio.experiences:
            logger.info(f"Experience {experience_id} already associated with portfolio {portfolio_id}")
            return True
        
        # Get the next order number
        from app.models.portfolio import portfolio_experiences
        max_order_result = db.execute(
            select(func.max(portfolio_experiences.c.order))
            .where(portfolio_experiences.c.portfolio_id == portfolio_id)
        ).scalar()
        next_order = (max_order_result or 0) + 1
        
        # Add the association with order
        stmt = portfolio_experiences.insert().values(
            portfolio_id=portfolio_id,
            experience_id=experience_id,
            order=next_order
        )
        db.execute(stmt)
        db.flush()
        
        logger.info(f"Experience {experience_id} added to portfolio {portfolio_id} with order {next_order}")
        return True
    except Exception as e:
        logger.error(f"Error adding experience {experience_id} to portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def remove_portfolio_experience(db: Session, portfolio_id: int, experience_id: int) -> bool:
    """Remove an experience from a portfolio"""
    logger.debug(f"Removing experience {experience_id} from portfolio {portfolio_id}")
    
    try:
        # Verify portfolio exists
        portfolio = get_portfolio(db, portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio {portfolio_id} not found")
            return False
            
        experience = db.query(Experience).filter(Experience.id == experience_id).first()
        if not experience:
            logger.warning(f"Experience {experience_id} not found")
            return False
        
        # Check if associated
        if experience not in portfolio.experiences:
            logger.info(f"Experience {experience_id} not associated with portfolio {portfolio_id}")
            return True
        
        # Remove the association
        portfolio.experiences.remove(experience)
        logger.info(f"Experience {experience_id} removed from portfolio {portfolio_id} successfully")
        return True
    except Exception as e:
        logger.error(f"Error removing experience {experience_id} from portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def add_portfolio_project(db: Session, portfolio_id: int, project_id: int) -> bool:
    """Add a project to a portfolio"""
    logger.debug(f"Adding project {project_id} to portfolio {portfolio_id}")
    
    try:
        # Verify both portfolio and project exist
        portfolio = get_portfolio(db, portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio {portfolio_id} not found")
            return False
            
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            logger.warning(f"Project {project_id} not found")
            return False
        
        # Check if already associated
        if project in portfolio.projects:
            logger.info(f"Project {project_id} already associated with portfolio {portfolio_id}")
            return True
        
        # Get the next order number
        from app.models.portfolio import portfolio_projects
        max_order_result = db.execute(
            select(func.max(portfolio_projects.c.order))
            .where(portfolio_projects.c.portfolio_id == portfolio_id)
        ).scalar()
        next_order = (max_order_result or 0) + 1
        
        # Add the association with order
        stmt = portfolio_projects.insert().values(
            portfolio_id=portfolio_id,
            project_id=project_id,
            order=next_order
        )
        db.execute(stmt)
        db.flush()
        
        logger.info(f"Project {project_id} added to portfolio {portfolio_id} with order {next_order}")
        return True
    except Exception as e:
        logger.error(f"Error adding project {project_id} to portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def remove_portfolio_project(db: Session, portfolio_id: int, project_id: int) -> bool:
    """Remove a project from a portfolio"""
    logger.debug(f"Removing project {project_id} from portfolio {portfolio_id}")
    
    try:
        # Verify portfolio exists
        portfolio = get_portfolio(db, portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio {portfolio_id} not found")
            return False
            
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            logger.warning(f"Project {project_id} not found")
            return False
        
        # Check if associated
        if project not in portfolio.projects:
            logger.info(f"Project {project_id} not associated with portfolio {portfolio_id}")
            return True
        
        # Remove the association
        portfolio.projects.remove(project)
        logger.info(f"Project {project_id} removed from portfolio {portfolio_id} successfully")
        return True
    except Exception as e:
        logger.error(f"Error removing project {project_id} from portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def add_portfolio_section(db: Session, portfolio_id: int, section_id: int) -> bool:
    """Add a section to a portfolio"""
    logger.debug(f"Adding section {section_id} to portfolio {portfolio_id}")
    
    try:
        # Verify both portfolio and section exist
        portfolio = get_portfolio(db, portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio {portfolio_id} not found")
            return False
            
        section = db.query(Section).filter(Section.id == section_id).first()
        if not section:
            logger.warning(f"Section {section_id} not found")
            return False
        
        # Check if already associated
        if section in portfolio.sections:
            logger.info(f"Section {section_id} already associated with portfolio {portfolio_id}")
            return True
        
        # Get the next order number
        from app.models.portfolio import portfolio_sections
        max_order_result = db.execute(
            select(func.max(portfolio_sections.c.order))
            .where(portfolio_sections.c.portfolio_id == portfolio_id)
        ).scalar()
        next_order = (max_order_result or 0) + 1
        
        # Add the association with order
        stmt = portfolio_sections.insert().values(
            portfolio_id=portfolio_id,
            section_id=section_id,
            order=next_order
        )
        db.execute(stmt)
        db.flush()
        
        logger.info(f"Section {section_id} added to portfolio {portfolio_id} with order {next_order}")
        return True
    except Exception as e:
        logger.error(f"Error adding section {section_id} to portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise

@db_transaction
def remove_portfolio_section(db: Session, portfolio_id: int, section_id: int) -> bool:
    """Remove a section from a portfolio"""
    logger.debug(f"Removing section {section_id} from portfolio {portfolio_id}")
    
    try:
        # Verify portfolio exists
        portfolio = get_portfolio(db, portfolio_id)
        if not portfolio:
            logger.warning(f"Portfolio {portfolio_id} not found")
            return False
            
        section = db.query(Section).filter(Section.id == section_id).first()
        if not section:
            logger.warning(f"Section {section_id} not found")
            return False
        
        # Check if associated
        if section not in portfolio.sections:
            logger.info(f"Section {section_id} not associated with portfolio {portfolio_id}")
            return True
        
        # Remove the association
        portfolio.sections.remove(section)
        logger.info(f"Section {section_id} removed from portfolio {portfolio_id} successfully")
        return True
    except Exception as e:
        logger.error(f"Error removing section {section_id} from portfolio {portfolio_id}: {str(e)}", exc_info=True)
        raise
