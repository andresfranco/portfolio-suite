from sqlalchemy import Column, Integer, String, Table, ForeignKey, DateTime, Text, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# Association table for many-to-many relationship between categories and skills
category_skills = Table(
    "category_skills",
    Base.metadata,
    Column("category_id", Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", Integer, ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_category_skills_skill_id", "skill_id"),
    Index("ix_category_skills_category_id", "category_id")
)

class Category(Base):
    """
    Model representing categories in the database.
    
    Categories are used to organize and classify various entities like skills, projects, etc.
    
    Attributes:
        id (int): Primary key
        code (str): Unique code for the category (e.g., "BACKEND", "FRONTEND")
        type_code (str): Foreign key to category_types.code (e.g., "TECH", "SOFT")
        created_at (datetime): Timestamp when the record was created
        updated_at (datetime): Timestamp when the record was last updated
        created_by (int): User ID who created the record
        updated_by (int): User ID who last updated the record
        
    Relationships:
        portfolios (list): Many-to-many relationship with Portfolio model
        projects (list): Many-to-many relationship with Project model
        skills (list): Many-to-many relationship with Skill model
        category_texts (list): One-to-many relationship with CategoryText model
        category_type (CategoryType): Many-to-one relationship with CategoryType model
    """
    __tablename__ = "categories"
    
    # Primary key and main fields
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    type_code = Column(String(5), ForeignKey("category_types.code"), default="GEN", nullable=False, index=True)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships  
    portfolios = relationship("Portfolio", secondary="portfolio_categories", back_populates="categories")
    projects = relationship("Project", secondary="project_categories", back_populates="categories")
    skills = relationship("Skill", secondary=category_skills, back_populates="categories")
    category_texts = relationship("CategoryText", back_populates="category", cascade="all, delete-orphan")
    category_type = relationship("CategoryType")
    
    # Define additional indexes
    __table_args__ = (
        Index('ix_categories_type_code_code', 'type_code', 'code'),
    )
    
    def __repr__(self):
        """String representation of the category"""
        return f"<Category(id={self.id}, code='{self.code}', type_code='{self.type_code}')>"


class CategoryText(Base):
    """
    Model representing multilingual text content for categories.
    
    Each category can have multiple texts in different languages.
    
    Attributes:
        id (int): Primary key
        category_id (int): Foreign key to categories.id
        language_id (int): Foreign key to languages.id
        name (str): Name of the category in this language
        description (str): Description of the category in this language
        created_at (datetime): Timestamp when the record was created
        updated_at (datetime): Timestamp when the record was last updated
        created_by (int): User ID who created the record
        updated_by (int): User ID who last updated the record
        
    Relationships:
        category (Category): Many-to-one relationship with Category model
        language (Language): Many-to-one relationship with Language model
    """
    __tablename__ = "category_texts"
    
    # Primary key and foreign keys
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    
    # Content fields
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    category = relationship("Category", back_populates="category_texts")
    language = relationship("Language", back_populates="category_texts")
    
    # Define additional indexes and constraints
    __table_args__ = (
        Index('ix_category_texts_category_id', 'category_id'),
        Index('ix_category_texts_language_id', 'language_id'),
        UniqueConstraint('category_id', 'language_id', name='uq_category_texts_category_language'),
        Index('ix_category_texts_category_language', 'category_id', 'language_id', unique=True),
    )
    
    def __repr__(self):
        """String representation of the category text"""
        return f"<CategoryText(id={self.id}, category_id={self.category_id}, language_id={self.language_id}, name='{self.name}')>"
