from sqlalchemy import Column, Integer, String, Table, ForeignKey, DateTime, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# Association table for many-to-many relationship between projects and categories
project_categories = Table(
    "project_categories",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id")),
    Column("category_id", Integer, ForeignKey("categories.id"))
)

# Association table for many-to-many relationship between projects and skills
project_skills = Table(
    "project_skills",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id")),
    Column("skill_id", Integer, ForeignKey("skills.id"))
)

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    repository_url = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    project_date = Column(Date, nullable=True)

    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    portfolios = relationship("Portfolio", secondary="portfolio_projects", back_populates="projects")
    categories = relationship("Category", secondary=project_categories, back_populates="projects")
    skills = relationship("Skill", secondary=project_skills, back_populates="projects")
    sections = relationship(
        "Section", 
        secondary="project_sections", 
        back_populates="projects",
        order_by="project_sections.c.display_order"
    )
    project_texts = relationship("ProjectText", back_populates="project")
    images = relationship("ProjectImage", back_populates="project")
    attachments = relationship("ProjectAttachment", back_populates="project")


class ProjectText(Base):
    __tablename__ = "project_texts"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    language_id = Column(Integer, ForeignKey("languages.id"))
    name = Column(String)
    description = Column(Text)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    project = relationship("Project", back_populates="project_texts")
    language = relationship("Language", back_populates="project_texts")


class ProjectImage(Base):
    __tablename__ = "project_images"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    image_path = Column(String)
    category = Column(String)  # e.g., "diagram", "main", "gallery"
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)  # Link to language
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    project = relationship("Project", back_populates="images")
    language = relationship("Language")


class ProjectAttachment(Base):
    __tablename__ = "project_attachments"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    file_path = Column(String)
    file_name = Column(String)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # Link to category (PDOC, RESU, etc)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)  # Link to language
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    project = relationship("Project", back_populates="attachments")
    category = relationship("Category")
    language = relationship("Language")
