from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import asc, desc, or_, and_
from app.models.skill import Skill, SkillText
from app.models.category import Category, CategoryText
from app.models.language import Language
from app.models.skill_type import SkillType
from app.schemas.skill import SkillCreate, SkillUpdate, SkillTextCreate, Filter
from typing import List, Optional, Tuple
from app.core.logging import setup_logger

# Set up logger using centralized logging
logger = setup_logger("app.crud.skill")

# CRUD Functions
def get_skill(db: Session, skill_id: int):
    logger.debug(f"Fetching skill with ID {skill_id}")
    return db.query(Skill).options(
        # Load skill_texts with their languages
        selectinload(Skill.skill_texts).selectinload(SkillText.language),
        # Load categories with their category_texts and languages  
        selectinload(Skill.categories).selectinload(Category.category_texts).selectinload(CategoryText.language),
        # Load skill_type
        selectinload(Skill.skill_type)
    ).filter(Skill.id == skill_id).first()

# Added function to get skill by name and language
def get_skill_by_name_and_language(db: Session, name: str, language_id: int):
    """
    Get a skill by name in a specific language
    """
    logger.debug(f"Fetching skill with name '{name}' for language ID {language_id}")
    return db.query(Skill).join(SkillText).filter(
        SkillText.name == name,
        SkillText.language_id == language_id
    ).first()

def create_skill(db: Session, skill: SkillCreate):
    logger.debug(f"Starting skill creation with type_code {skill.type_code}")
    
    # Get the skill type to populate the type field
    skill_type = db.query(SkillType).filter(SkillType.code == skill.type_code).first()
    if not skill_type:
        logger.error(f"Invalid skill type code: {skill.type_code}")
        raise ValueError(f"Invalid skill type code: {skill.type_code}")
    
    # Create the skill
    db_skill = Skill(
        type=skill_type.name.lower(),  # Set type from the name of the skill type
        type_code=skill.type_code      # Set type_code from the request
    )
    db.add(db_skill)
    db.flush()  # Flush to get the skill ID
    
    # Add categories if provided
    if skill.categories:
        categories = db.query(Category).filter(Category.id.in_(skill.categories)).all()
        if len(categories) != len(skill.categories):
            missing_categories = set(skill.categories) - {cat.id for cat in categories}
            logger.error(f"Invalid category IDs: {missing_categories}")
            raise ValueError(f"Invalid category IDs: {missing_categories}")
        db_skill.categories = categories
    
    # Create skill texts
    for text_data in skill.skill_texts:
        # Verify language exists
        language = db.query(Language).filter(Language.id == text_data.language_id).first()
        if not language:
            logger.error(f"Invalid language ID: {text_data.language_id}")
            raise ValueError(f"Invalid language ID: {text_data.language_id}")
        
        db_skill_text = SkillText(
            skill_id=db_skill.id,
            language_id=text_data.language_id,
            name=text_data.name,
            description=text_data.description
        )
        db.add(db_skill_text)
    
    logger.debug("Skill added to session")
    return db_skill

def update_skill(db: Session, skill_id: int, skill: SkillUpdate):
    logger.debug(f"Updating skill with ID {skill_id}")
    db_skill = get_skill(db, skill_id)
    
    if not db_skill:
        return None
    
    # Update type_code and type if provided
    if skill.type_code is not None:
        # Get the skill type to populate the type field
        skill_type = db.query(SkillType).filter(SkillType.code == skill.type_code).first()
        if not skill_type:
            logger.error(f"Invalid skill type code: {skill.type_code}")
            raise ValueError(f"Invalid skill type code: {skill.type_code}")
        
        db_skill.type_code = skill.type_code
        db_skill.type = skill_type.name.lower()  # Set type from the name of the skill type
    
    # Update categories if provided
    if skill.categories is not None:
        categories = db.query(Category).filter(Category.id.in_(skill.categories)).all()
        if len(categories) != len(skill.categories):
            missing_categories = set(skill.categories) - {cat.id for cat in categories}
            logger.error(f"Invalid category IDs: {missing_categories}")
            raise ValueError(f"Invalid category IDs: {missing_categories}")
        db_skill.categories = categories
    
    # Update skill texts if provided
    if skill.skill_texts is not None:
        # First, remove existing texts
        db.query(SkillText).filter(SkillText.skill_id == skill_id).delete()
        
        # Then add new texts
        for text_data in skill.skill_texts:
            # Verify language exists
            language = db.query(Language).filter(Language.id == text_data.language_id).first()
            if not language:
                logger.error(f"Invalid language ID: {text_data.language_id}")
                raise ValueError(f"Invalid language ID: {text_data.language_id}")
            
            db_skill_text = SkillText(
                skill_id=db_skill.id,
                language_id=text_data.language_id,
                name=text_data.name,
                description=text_data.description
            )
            db.add(db_skill_text)
    
    return db_skill

def delete_skill(db: Session, skill_id: int):
    logger.debug(f"Deleting skill with ID {skill_id}")
    db_skill = get_skill(db, skill_id)
    
    if not db_skill:
        return None
    
    # Delete associated texts
    db.query(SkillText).filter(SkillText.skill_id == skill_id).delete()
    
    # Delete the skill
    db.delete(db_skill)
    return db_skill

def get_skills(db: Session, skip: int = 0, limit: int = 100):
    logger.debug(f"Fetching skills with skip={skip}, limit={limit}")
    return db.query(Skill).offset(skip).limit(limit).all()

def get_skills_by_type(db: Session, skill_type: str, skip: int = 0, limit: int = 100):
    logger.debug(f"Fetching skills of type {skill_type} with skip={skip}, limit={limit}")
    return db.query(Skill).options(
        # Load skill_texts with their languages
        selectinload(Skill.skill_texts).selectinload(SkillText.language),
        # Load categories with their category_texts and languages
        selectinload(Skill.categories).selectinload(Category.category_texts).selectinload(CategoryText.language),
        # Load skill_type
        selectinload(Skill.skill_type)
    ).filter(Skill.type == skill_type).offset(skip).limit(limit).all()

def get_skills_by_type_code(db: Session, type_code: str, skip: int = 0, limit: int = 100):
    logger.debug(f"Fetching skills with type_code {type_code} with skip={skip}, limit={limit}")
    return db.query(Skill).options(
        # Load skill_texts with their languages
        selectinload(Skill.skill_texts).selectinload(SkillText.language),
        # Load categories with their category_texts and languages
        selectinload(Skill.categories).selectinload(Category.category_texts).selectinload(CategoryText.language),
        # Load skill_type
        selectinload(Skill.skill_type)
    ).filter(Skill.type_code == type_code).offset(skip).limit(limit).all()

def get_skills_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: List[Filter] = None,
    sort_field: str = None,
    sort_order: str = "asc",
    type_filter: str = None,
    name_filter: str = None
) -> Tuple[List[Skill], int]:
    logger.debug(f"Getting paginated skills with filters: {filters}, type={type_filter}, name={name_filter}")
    
    # Create base query with eager loading of relationships
    query = db.query(Skill).options(
        # Load skill_texts with their languages
        selectinload(Skill.skill_texts).selectinload(SkillText.language),
        # Load categories with their category_texts and languages
        selectinload(Skill.categories).selectinload(Category.category_texts).selectinload(CategoryText.language),
        # Load skill_type
        selectinload(Skill.skill_type)
    )
    
    # Track whether we've already joined SkillText
    skill_text_joined = False
    
    # Separate category and text filters from other filters
    category_filter_values = []
    language_filter_values = []
    text_filters = []
    other_filters = []
    
    # Check if we need to join SkillText based on filters
    needs_skill_text_join = False
    
    # Check legacy name_filter
    if name_filter:
        needs_skill_text_join = True
    
    # Analyze filters to determine what we need
    if filters:
        for filter_item in filters:
            if filter_item.field == "category" or filter_item.field == "categories" or filter_item.field == "category_id":
                logger.debug(f"Found category filter with value: {filter_item.value}")
                try:
                    # Ensure category ID is an integer
                    category_id = int(filter_item.value)
                    category_filter_values.append(category_id)
                    logger.debug(f"Added category filter with ID: {category_id}")
                except (ValueError, TypeError) as e:
                    logger.error(f"Invalid category ID: {filter_item.value} - {e}")
            elif filter_item.field == "language_id":
                # Collect language IDs for later processing
                logger.debug(f"Found language filter with value: {filter_item.value}")
                needs_skill_text_join = True
                try:
                    language_id = int(filter_item.value)
                    language_filter_values.append(language_id)
                except (ValueError, TypeError) as e:
                    logger.error(f"Invalid language_id value: {filter_item.value} - {e}")
            elif filter_item.field == "name" or filter_item.field == "description":
                needs_skill_text_join = True
                text_filters.append(filter_item)
            elif hasattr(Skill, filter_item.field):
                column = getattr(Skill, filter_item.field)
                if filter_item.operator == "contains":
                    other_filters.append(column.ilike(f"%{filter_item.value}%"))
                elif filter_item.operator == "equals":
                    other_filters.append(column == filter_item.value)
                elif filter_item.operator == "startsWith":
                    other_filters.append(column.ilike(f"{filter_item.value}%"))
                elif filter_item.operator == "endsWith":
                    other_filters.append(column.ilike(f"%{filter_item.value}"))
    
    # Join SkillText once if needed
    if needs_skill_text_join:
        logger.debug("Joining SkillText table for filtering")
        query = query.join(SkillText, Skill.id == SkillText.skill_id, isouter=False)
        skill_text_joined = True
    
    # Build conditions for SkillText filters
    skill_text_conditions = []
    
    # Apply language filters if any were found
    if language_filter_values:
        logger.debug(f"Adding language filter conditions for language IDs: {language_filter_values}")
        language_conditions = [SkillText.language_id == language_id for language_id in language_filter_values]
        skill_text_conditions.extend(language_conditions)
    
    # Apply direct name filter if provided
    if name_filter:
        logger.debug(f"Adding direct name filter condition: {name_filter}")
        skill_text_conditions.append(SkillText.name.ilike(f"%{name_filter}%"))
    
    # Apply text filters
    if text_filters:
        logger.debug(f"Adding text filter conditions: {text_filters}")
        for filter_item in text_filters:
            column = getattr(SkillText, filter_item.field)
            if filter_item.operator == "contains":
                skill_text_conditions.append(column.ilike(f"%{filter_item.value}%"))
            elif filter_item.operator == "equals":
                skill_text_conditions.append(column == filter_item.value)
            elif filter_item.operator == "startsWith":
                skill_text_conditions.append(column.ilike(f"{filter_item.value}%"))
            elif filter_item.operator == "endsWith":
                skill_text_conditions.append(column.ilike(f"%{filter_item.value}"))
    
    # Apply all SkillText conditions
    if skill_text_conditions:
        logger.debug(f"Applying {len(skill_text_conditions)} SkillText conditions")
        
        # Special handling for combined language and text filters
        if language_filter_values and (name_filter or text_filters):
            # When we have both language and text filters, we need to combine them properly
            # Each language should be checked against the text conditions
            combined_conditions = []
            
            for language_id in language_filter_values:
                language_condition = SkillText.language_id == language_id
                
                # Combine language condition with text conditions for this language
                text_conditions_for_lang = []
                if name_filter:
                    text_conditions_for_lang.append(SkillText.name.ilike(f"%{name_filter}%"))
                
                for filter_item in text_filters:
                    column = getattr(SkillText, filter_item.field)
                    if filter_item.operator == "contains":
                        text_conditions_for_lang.append(column.ilike(f"%{filter_item.value}%"))
                    elif filter_item.operator == "equals":
                        text_conditions_for_lang.append(column == filter_item.value)
                    elif filter_item.operator == "startsWith":
                        text_conditions_for_lang.append(column.ilike(f"{filter_item.value}%"))
                    elif filter_item.operator == "endsWith":
                        text_conditions_for_lang.append(column.ilike(f"%{filter_item.value}"))
                
                if text_conditions_for_lang:
                    # This language must match ALL text conditions (AND)
                    combined_conditions.append(and_(language_condition, *text_conditions_for_lang))
            
            if combined_conditions:
                # At least one language must match all its conditions (OR between languages)
                query = query.filter(or_(*combined_conditions))
        else:
            # Simple case: apply all conditions with OR for language filters and AND for others
            if language_filter_values and not (name_filter or text_filters):
                # Only language filters - use OR
                query = query.filter(or_(*skill_text_conditions))
            else:
                # Only text filters or mixed - use AND
                query = query.filter(and_(*skill_text_conditions))
        
        query = query.distinct()
    
    # Apply direct type filter if provided
    if type_filter:
        logger.debug(f"Applying direct type filter: {type_filter}")
        # First try to match by type_code which is more precise
        type_code_match = db.query(Skill).filter(Skill.type_code == type_filter).first()
        if type_code_match:
            logger.debug(f"Found exact type_code match for {type_filter}")
            other_filters.append(Skill.type_code == type_filter)
        else:
            # Fall back to matching by type (case-insensitive)
            logger.debug(f"No exact type_code match, using partial type match for {type_filter}")
            other_filters.append(Skill.type.ilike(f"%{type_filter}%"))
    
    # Apply other filters
    if other_filters:
        query = query.filter(*other_filters)
    
    # Apply category filters
    if category_filter_values:
        logger.debug(f"Filtering by categories: {category_filter_values}")
        conditions = [Category.id == int(cat_id) for cat_id in category_filter_values]
        query = query.join(Skill.categories).filter(or_(*conditions)).distinct()
    
    # Get the total count before applying pagination
    total = query.count()
    logger.debug(f"Total matching skills: {total}")
    
    # Apply sorting if specified
    if sort_field:
        if hasattr(Skill, sort_field):
            sort_func = asc if sort_order == "asc" else desc
            query = query.order_by(sort_func(getattr(Skill, sort_field)))
        elif sort_field in ["name", "description"]:
            # Sort by name or description in the default language
            default_language = db.query(Language).filter(Language.is_default == True).first()
            if default_language:
                # Only join SkillText for sorting if we haven't already joined it
                if not skill_text_joined:
                    query = query.join(SkillText).filter(SkillText.language_id == default_language.id)
                else:
                    # We already joined, but we need to filter for default language for sorting
                    # This might conflict with other filters, so we'll skip sorting in this case
                    logger.warning(f"Cannot sort by {sort_field} when SkillText is already filtered")
                sort_func = asc if sort_order == "asc" else desc
                if not skill_text_joined:
                    query = query.order_by(sort_func(getattr(SkillText, sort_field)))
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    return query.all(), total
