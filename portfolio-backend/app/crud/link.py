from sqlalchemy.orm import Session, joinedload
from sqlalchemy import asc, desc
from app.models.link import LinkCategoryType, LinkCategory, LinkCategoryText, PortfolioLink, PortfolioLinkText
from app.schemas.link import (
    LinkCategoryTypeCreate, LinkCategoryTypeUpdate,
    LinkCategoryCreate, LinkCategoryUpdate, LinkCategoryTextCreate,
    PortfolioLinkCreate, PortfolioLinkUpdate, PortfolioLinkTextCreate
)
from typing import List, Optional, Tuple
from app.core.logging import setup_logger
from app.core.db import db_transaction

# Set up logger using centralized logging
logger = setup_logger("app.crud.link")

# --- LinkCategoryType CRUD Functions ---

def get_link_category_type(db: Session, code: str) -> Optional[LinkCategoryType]:
    """Get a link category type by its code."""
    logger.debug(f"Fetching link category type with code {code}")
    return db.query(LinkCategoryType).filter(LinkCategoryType.code == code).first()


@db_transaction
def create_link_category_type(db: Session, category_type: LinkCategoryTypeCreate) -> LinkCategoryType:
    """Create a new link category type."""
    logger.debug(f"Creating link category type: {category_type.code}")

    # Check if already exists
    existing = get_link_category_type(db, category_type.code)
    if existing:
        error_msg = f"Link category type with code '{category_type.code}' already exists."
        logger.warning(error_msg)
        raise ValueError(error_msg)

    db_category_type = LinkCategoryType(
        code=category_type.code,
        name=category_type.name
    )
    db.add(db_category_type)
    db.flush()

    logger.info(f"Link category type created successfully: {db_category_type.code}")
    return db_category_type


@db_transaction
def update_link_category_type(db: Session, code: str, category_type: LinkCategoryTypeUpdate) -> Optional[LinkCategoryType]:
    """Update an existing link category type."""
    logger.debug(f"Updating link category type: {code}")

    db_category_type = get_link_category_type(db, code)
    if not db_category_type:
        logger.warning(f"Link category type not found for update: {code}")
        return None

    update_data = category_type.model_dump(exclude_unset=True)

    # Check if code is being updated and if it conflicts
    if "code" in update_data and update_data["code"] != code:
        existing = get_link_category_type(db, update_data["code"])
        if existing:
            error_msg = f"Cannot update: code '{update_data['code']}' already exists."
            logger.warning(error_msg)
            raise ValueError(error_msg)

    for field, value in update_data.items():
        setattr(db_category_type, field, value)

    db.flush()
    logger.info(f"Link category type updated successfully: {db_category_type.code}")
    return db_category_type


@db_transaction
def delete_link_category_type(db: Session, code: str) -> Optional[LinkCategoryType]:
    """Delete a link category type."""
    logger.debug(f"Deleting link category type: {code}")

    db_category_type = get_link_category_type(db, code)
    if not db_category_type:
        logger.warning(f"Link category type not found for deletion: {code}")
        return None

    db.delete(db_category_type)
    db.flush()

    logger.info(f"Link category type deleted successfully: {code}")
    return db_category_type


def get_link_category_types(db: Session, skip: int = 0, limit: int = 100) -> List[LinkCategoryType]:
    """Get all link category types."""
    logger.debug(f"Getting link category types with skip={skip}, limit={limit}")
    try:
        return db.query(LinkCategoryType).order_by(LinkCategoryType.code).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error retrieving link category types: {str(e)}", exc_info=True)
        return []


# --- LinkCategory CRUD Functions ---

def get_link_category(db: Session, category_id: int) -> Optional[LinkCategory]:
    """Get a link category by ID with its texts."""
    logger.debug(f"Fetching link category with ID {category_id}")
    return db.query(LinkCategory).options(
        joinedload(LinkCategory.category_texts),
        joinedload(LinkCategory.category_type)
    ).filter(LinkCategory.id == category_id).first()


def get_link_category_by_code(db: Session, code: str) -> Optional[LinkCategory]:
    """Get a link category by code with its texts."""
    logger.debug(f"Fetching link category with code {code}")
    return db.query(LinkCategory).options(
        joinedload(LinkCategory.category_texts),
        joinedload(LinkCategory.category_type)
    ).filter(LinkCategory.code == code).first()


@db_transaction
def create_link_category(db: Session, category: LinkCategoryCreate) -> LinkCategory:
    """Create a new link category with optional multilingual texts."""
    logger.debug(f"Creating link category: {category.code}")

    # Check if already exists
    existing = get_link_category_by_code(db, category.code)
    if existing:
        error_msg = f"Link category with code '{category.code}' already exists."
        logger.warning(error_msg)
        raise ValueError(error_msg)

    # Check if type exists
    type_exists = get_link_category_type(db, category.type_code)
    if not type_exists:
        error_msg = f"Link category type '{category.type_code}' does not exist."
        logger.warning(error_msg)
        raise ValueError(error_msg)

    db_category = LinkCategory(
        code=category.code,
        type_code=category.type_code,
        icon_name=category.icon_name
    )
    db.add(db_category)
    db.flush()

    # Add texts if provided
    if category.texts:
        for text_data in category.texts:
            db_text = LinkCategoryText(
                category_id=db_category.id,
                language_id=text_data.language_id,
                name=text_data.name,
                description=text_data.description
            )
            db.add(db_text)
        db.flush()

    logger.info(f"Link category created successfully: {db_category.code}")

    # Refresh to load relationships
    db.refresh(db_category)
    return db_category


@db_transaction
def update_link_category(db: Session, category_id: int, category: LinkCategoryUpdate) -> Optional[LinkCategory]:
    """Update an existing link category."""
    logger.debug(f"Updating link category ID: {category_id}")

    db_category = get_link_category(db, category_id)
    if not db_category:
        logger.warning(f"Link category not found for update: {category_id}")
        return None

    update_data = category.model_dump(exclude_unset=True)

    # Check if code is being updated and if it conflicts
    if "code" in update_data and update_data["code"] != db_category.code:
        existing = get_link_category_by_code(db, update_data["code"])
        if existing and existing.id != category_id:
            error_msg = f"Cannot update: code '{update_data['code']}' already exists."
            logger.warning(error_msg)
            raise ValueError(error_msg)

    # Check if type_code exists
    if "type_code" in update_data:
        type_exists = get_link_category_type(db, update_data["type_code"])
        if not type_exists:
            error_msg = f"Link category type '{update_data['type_code']}' does not exist."
            logger.warning(error_msg)
            raise ValueError(error_msg)

    for field, value in update_data.items():
        setattr(db_category, field, value)

    db.flush()
    logger.info(f"Link category updated successfully: {db_category.id}")

    db.refresh(db_category)
    return db_category


@db_transaction
def delete_link_category(db: Session, category_id: int) -> Optional[LinkCategory]:
    """Delete a link category."""
    logger.debug(f"Deleting link category ID: {category_id}")

    db_category = get_link_category(db, category_id)
    if not db_category:
        logger.warning(f"Link category not found for deletion: {category_id}")
        return None

    db.delete(db_category)
    db.flush()

    logger.info(f"Link category deleted successfully: {category_id}")
    return db_category


def get_link_categories(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    type_code: Optional[str] = None
) -> List[LinkCategory]:
    """Get all link categories, optionally filtered by type."""
    logger.debug(f"Getting link categories with skip={skip}, limit={limit}, type_code={type_code}")
    try:
        query = db.query(LinkCategory).options(
            joinedload(LinkCategory.category_texts),
            joinedload(LinkCategory.category_type)
        )

        if type_code:
            query = query.filter(LinkCategory.type_code == type_code)

        return query.order_by(LinkCategory.code).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error retrieving link categories: {str(e)}", exc_info=True)
        return []


# --- LinkCategoryText CRUD Functions ---

@db_transaction
def create_link_category_text(db: Session, category_id: int, text: LinkCategoryTextCreate) -> LinkCategoryText:
    """Create or update a link category text for a specific language."""
    logger.debug(f"Creating link category text for category {category_id}, language {text.language_id}")

    # Check if text already exists for this language
    existing = db.query(LinkCategoryText).filter(
        LinkCategoryText.category_id == category_id,
        LinkCategoryText.language_id == text.language_id
    ).first()

    if existing:
        # Update existing text
        existing.name = text.name
        existing.description = text.description
        db.flush()
        logger.info(f"Link category text updated for category {category_id}, language {text.language_id}")
        return existing
    else:
        # Create new text
        db_text = LinkCategoryText(
            category_id=category_id,
            language_id=text.language_id,
            name=text.name,
            description=text.description
        )
        db.add(db_text)
        db.flush()
        logger.info(f"Link category text created for category {category_id}, language {text.language_id}")
        return db_text


# --- PortfolioLink CRUD Functions ---

def get_portfolio_link(db: Session, link_id: int) -> Optional[PortfolioLink]:
    """Get a portfolio link by ID with all relationships."""
    logger.debug(f"Fetching portfolio link with ID {link_id}")
    return db.query(PortfolioLink).options(
        joinedload(PortfolioLink.category).joinedload(LinkCategory.category_texts),
        joinedload(PortfolioLink.category).joinedload(LinkCategory.category_type),
        joinedload(PortfolioLink.link_texts)
    ).filter(PortfolioLink.id == link_id).first()


def get_portfolio_links(
    db: Session,
    portfolio_id: int,
    is_active: Optional[bool] = None
) -> List[PortfolioLink]:
    """Get all links for a portfolio, ordered by order field."""
    logger.debug(f"Getting portfolio links for portfolio {portfolio_id}")
    try:
        query = db.query(PortfolioLink).options(
            joinedload(PortfolioLink.category).joinedload(LinkCategory.category_texts),
            joinedload(PortfolioLink.category).joinedload(LinkCategory.category_type),
            joinedload(PortfolioLink.link_texts)
        ).filter(PortfolioLink.portfolio_id == portfolio_id)

        if is_active is not None:
            query = query.filter(PortfolioLink.is_active == is_active)

        return query.order_by(PortfolioLink.order).all()
    except Exception as e:
        logger.error(f"Error retrieving portfolio links: {str(e)}", exc_info=True)
        return []


@db_transaction
def create_portfolio_link(db: Session, link: PortfolioLinkCreate) -> PortfolioLink:
    """Create a new portfolio link with optional multilingual texts."""
    logger.debug(f"Creating portfolio link for portfolio {link.portfolio_id}")

    # Check if category exists
    category = get_link_category(db, link.category_id)
    if not category:
        error_msg = f"Link category with ID '{link.category_id}' does not exist."
        logger.warning(error_msg)
        raise ValueError(error_msg)

    db_link = PortfolioLink(
        portfolio_id=link.portfolio_id,
        category_id=link.category_id,
        url=link.url,
        image_path=link.image_path,
        order=link.order,
        is_active=link.is_active
    )
    db.add(db_link)
    db.flush()

    # Add texts if provided
    if link.texts:
        for text_data in link.texts:
            db_text = PortfolioLinkText(
                link_id=db_link.id,
                language_id=text_data.language_id,
                name=text_data.name,
                description=text_data.description
            )
            db.add(db_text)
        db.flush()

    logger.info(f"Portfolio link created successfully: {db_link.id}")

    # Refresh to load relationships
    db.refresh(db_link)
    return db_link


@db_transaction
def update_portfolio_link(db: Session, link_id: int, link: PortfolioLinkUpdate) -> Optional[PortfolioLink]:
    """Update an existing portfolio link."""
    logger.debug(f"Updating portfolio link ID: {link_id}")

    db_link = get_portfolio_link(db, link_id)
    if not db_link:
        logger.warning(f"Portfolio link not found for update: {link_id}")
        return None

    update_data = link.model_dump(exclude_unset=True)

    # Check if category exists if being updated
    if "category_id" in update_data:
        category = get_link_category(db, update_data["category_id"])
        if not category:
            error_msg = f"Link category with ID '{update_data['category_id']}' does not exist."
            logger.warning(error_msg)
            raise ValueError(error_msg)

    for field, value in update_data.items():
        setattr(db_link, field, value)

    db.flush()
    logger.info(f"Portfolio link updated successfully: {db_link.id}")

    db.refresh(db_link)
    return db_link


@db_transaction
def delete_portfolio_link(db: Session, link_id: int) -> Optional[PortfolioLink]:
    """Delete a portfolio link."""
    logger.debug(f"Deleting portfolio link ID: {link_id}")

    db_link = get_portfolio_link(db, link_id)
    if not db_link:
        logger.warning(f"Portfolio link not found for deletion: {link_id}")
        return None

    db.delete(db_link)
    db.flush()

    logger.info(f"Portfolio link deleted successfully: {link_id}")
    return db_link


@db_transaction
def update_portfolio_links_order(db: Session, portfolio_id: int, link_orders: List[dict]) -> bool:
    """Update the order of multiple portfolio links."""
    logger.debug(f"Updating order for {len(link_orders)} links in portfolio {portfolio_id}")

    try:
        for item in link_orders:
            link_id = item['id']
            order = item['order']

            db_link = db.query(PortfolioLink).filter(
                PortfolioLink.id == link_id,
                PortfolioLink.portfolio_id == portfolio_id
            ).first()

            if db_link:
                db_link.order = order

        db.flush()
        logger.info(f"Successfully updated order for links in portfolio {portfolio_id}")
        return True
    except Exception as e:
        logger.error(f"Error updating link orders: {str(e)}", exc_info=True)
        raise


# --- PortfolioLinkText CRUD Functions ---

@db_transaction
def create_portfolio_link_text(db: Session, link_id: int, text: PortfolioLinkTextCreate) -> PortfolioLinkText:
    """Create or update a portfolio link text for a specific language."""
    logger.debug(f"Creating portfolio link text for link {link_id}, language {text.language_id}")

    # Check if text already exists for this language
    existing = db.query(PortfolioLinkText).filter(
        PortfolioLinkText.link_id == link_id,
        PortfolioLinkText.language_id == text.language_id
    ).first()

    if existing:
        # Update existing text
        existing.name = text.name
        existing.description = text.description
        db.flush()
        logger.info(f"Portfolio link text updated for link {link_id}, language {text.language_id}")
        return existing
    else:
        # Create new text
        db_text = PortfolioLinkText(
            link_id=link_id,
            language_id=text.language_id,
            name=text.name,
            description=text.description
        )
        db.add(db_text)
        db.flush()
        logger.info(f"Portfolio link text created for link {link_id}, language {text.language_id}")
        return db_text
