#!/usr/bin/env python3
"""
Script to check and create PROJ type categories
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import get_db
from app.models.category import Category, CategoryText
from app.models.language import Language
from app.core.logging import setup_logger

logger = setup_logger("scripts.check_proj_categories")

def main():
    db = next(get_db())
    
    try:
        # Check existing categories
        all_categories = db.query(Category).all()
        logger.info(f"Total categories in database: {len(all_categories)}")
        
        # Group by type_code
        type_counts = {}
        proj_categories = []
        
        for cat in all_categories:
            type_code = cat.type_code or 'NULL'
            type_counts[type_code] = type_counts.get(type_code, 0) + 1
            if cat.type_code == 'PROJ':
                proj_categories.append(cat)
                logger.info(f"  Found PROJ category: {cat.id} - {cat.code}")
        
        logger.info("\nCategories by type:")
        for type_code, count in sorted(type_counts.items()):
            logger.info(f"  {type_code}: {count}")
        
        # If no PROJ categories exist, create default ones
        if len(proj_categories) == 0:
            logger.warning("No PROJ categories found! Creating default project categories...")
            
            # Get default language (English)
            default_language = db.query(Language).filter(Language.is_default == True).first()
            if not default_language:
                default_language = db.query(Language).filter(Language.code == 'en').first()
            if not default_language:
                default_language = db.query(Language).first()
            
            if not default_language:
                logger.error("No languages found in database! Cannot create category texts.")
                return
            
            logger.info(f"Using language: {default_language.code} (ID: {default_language.id})")
            
            default_proj_categories = [
                {"code": "PROJ-WEB", "name": "Web Development", "description": "Web development projects"},
                {"code": "PROJ-MOBILE", "name": "Mobile Development", "description": "Mobile app development projects"},
                {"code": "PROJ-DATA", "name": "Data Science", "description": "Data science and analytics projects"},
                {"code": "PROJ-ML", "name": "Machine Learning", "description": "Machine learning and AI projects"},
                {"code": "PROJ-BACKEND", "name": "Backend Development", "description": "Backend and API development projects"},
                {"code": "PROJ-FRONTEND", "name": "Frontend Development", "description": "Frontend development projects"},
                {"code": "PROJ-FULLSTACK", "name": "Full Stack Development", "description": "Full stack development projects"},
                {"code": "PROJ-CLOUD", "name": "Cloud Computing", "description": "Cloud infrastructure projects"},
            ]
            
            created_count = 0
            for cat_data in default_proj_categories:
                # Check if already exists
                existing = db.query(Category).filter(Category.code == cat_data["code"]).first()
                if not existing:
                    # Create category
                    new_category = Category(
                        code=cat_data["code"],
                        type_code="PROJ"
                    )
                    db.add(new_category)
                    db.flush()  # Get the ID
                    
                    # Create category text
                    category_text = CategoryText(
                        category_id=new_category.id,
                        language_id=default_language.id,
                        name=cat_data["name"],
                        description=cat_data["description"]
                    )
                    db.add(category_text)
                    
                    created_count += 1
                    logger.info(f"  Created: {cat_data['code']} - {cat_data['name']}")
                else:
                    logger.info(f"  Already exists: {cat_data['code']}")
            
            db.commit()
            logger.info(f"\nCreated {created_count} new PROJ categories")
            logger.info("✅ Project categories are now available!")
        else:
            logger.info(f"\n✅ Found {len(proj_categories)} PROJ categories")
            
    except Exception as e:
        logger.error(f"Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
