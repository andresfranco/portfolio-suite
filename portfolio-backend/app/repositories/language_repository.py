from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc, func, or_, and_

from app.models.language import Language
from app.schemas.language import LanguageCreate, LanguageUpdate, Filter


class LanguageRepository:
    def create(self, db: Session, *, obj_in: LanguageCreate) -> Language:
        """Create a new language in the database"""
        db_obj = Language(
            code=obj_in.code.lower(),
            name=obj_in.name,
            image=obj_in.image,
            is_default=obj_in.is_default
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get(self, db: Session, id: int) -> Optional[Language]:
        """Get a language by ID"""
        return db.query(Language).filter(Language.id == id).first()
    
    def get_by_code(self, db: Session, code: str) -> Optional[Language]:
        """Get a language by code"""
        return db.query(Language).filter(Language.code == code.lower()).first()

    def get_default(self, db: Session) -> Optional[Language]:
        """Get the default language"""
        return db.query(Language).filter(Language.is_default == True).first()

    def get_multi(
        self, 
        db: Session, 
        *, 
        page: int = 1, 
        page_size: int = 100,
        filters: Optional[List[Filter]] = None,
        sort_by: Optional[str] = None,
        sort_desc: bool = False
    ) -> Tuple[List[Language], int]:
        """
        Get multiple languages with pagination, filtering and sorting
        Returns a tuple of (languages, total_count)
        """
        query = db.query(Language)
        
        # Apply filters
        if filters:
            for filter_item in filters:
                column = getattr(Language, filter_item.field)
                
                if filter_item.operator == "eq":
                    query = query.filter(column == filter_item.value)
                elif filter_item.operator == "neq":
                    query = query.filter(column != filter_item.value)
                elif filter_item.operator == "gt":
                    query = query.filter(column > filter_item.value)
                elif filter_item.operator == "gte":
                    query = query.filter(column >= filter_item.value)
                elif filter_item.operator == "lt":
                    query = query.filter(column < filter_item.value)
                elif filter_item.operator == "lte":
                    query = query.filter(column <= filter_item.value)
                elif filter_item.operator == "contains":
                    query = query.filter(column.ilike(f"%{filter_item.value}%"))
                elif filter_item.operator == "startswith":
                    query = query.filter(column.ilike(f"{filter_item.value}%"))
                elif filter_item.operator == "endswith":
                    query = query.filter(column.ilike(f"%{filter_item.value}"))
                elif filter_item.operator == "in" and isinstance(filter_item.value, list):
                    query = query.filter(column.in_(filter_item.value))
        
        # Get total count before pagination
        total_count = query.count()
        
        # Apply sorting
        if sort_by:
            column = getattr(Language, sort_by)
            if sort_desc:
                query = query.order_by(desc(column))
            else:
                query = query.order_by(asc(column))
        else:
            # Default sorting by name
            query = query.order_by(asc(Language.name))
        
        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        return query.all(), total_count

    def update(
        self, db: Session, *, db_obj: Language, obj_in: LanguageUpdate
    ) -> Language:
        """Update a language"""
        update_data = obj_in.dict(exclude_unset=True)
        
        # Ensure code is always lowercase
        if "code" in update_data:
            update_data["code"] = update_data["code"].lower()
            
        for field, value in update_data.items():
            setattr(db_obj, field, value)
            
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, *, id: int) -> Optional[Language]:
        """Delete a language by ID"""
        obj = db.query(Language).get(id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj

    def set_as_default(self, db: Session, *, id: int) -> Optional[Language]:
        """Set a language as default and unset any previous default"""
        # First, unset any existing default
        db.query(Language).filter(Language.is_default == True).update(
            {"is_default": False}
        )
        
        # Then set the new default
        language = db.query(Language).filter(Language.id == id).first()
        if language:
            language.is_default = True
            db.add(language)
            db.commit()
            db.refresh(language)
        
        return language 