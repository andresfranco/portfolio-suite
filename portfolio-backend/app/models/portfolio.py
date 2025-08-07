from sqlalchemy import Column, Integer, String, Table, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# Association table for many-to-many relationship between portfolios and categories
portfolio_categories = Table(
    "portfolio_categories",
    Base.metadata,
    Column("portfolio_id", Integer, ForeignKey("portfolios.id")),
    Column("category_id", Integer, ForeignKey("categories.id"))
)

# Association table for many-to-many relationship between portfolios and experiences
portfolio_experiences = Table(
    "portfolio_experiences",
    Base.metadata,
    Column("portfolio_id", Integer, ForeignKey("portfolios.id")),
    Column("experience_id", Integer, ForeignKey("experiences.id"))
)

# Association table for many-to-many relationship between portfolios and projects
portfolio_projects = Table(
    "portfolio_projects",
    Base.metadata,
    Column("portfolio_id", Integer, ForeignKey("portfolios.id")),
    Column("project_id", Integer, ForeignKey("projects.id"))
)

# Association table for many-to-many relationship between portfolios and sections
portfolio_sections = Table(
    "portfolio_sections",
    Base.metadata,
    Column("portfolio_id", Integer, ForeignKey("portfolios.id")),
    Column("section_id", Integer, ForeignKey("sections.id"))
)

class Portfolio(Base):
    __tablename__ = "portfolios"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    categories = relationship("Category", secondary="portfolio_categories", back_populates="portfolios")
    experiences = relationship("Experience", secondary="portfolio_experiences", back_populates="portfolios")
    projects = relationship("Project", secondary="portfolio_projects", back_populates="portfolios")
    sections = relationship("Section", secondary="portfolio_sections", back_populates="portfolios")
    images = relationship("PortfolioImage", back_populates="portfolio", cascade="all, delete-orphan")
    attachments = relationship("PortfolioAttachment", back_populates="portfolio", cascade="all, delete-orphan")


class PortfolioImage(Base):
    __tablename__ = "portfolio_images"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    image_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)  # Original filename
    category = Column(String)  # e.g., 'main', 'thumbnail', 'gallery', 'background'
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="images")


class PortfolioAttachment(Base):
    __tablename__ = "portfolio_attachments"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    file_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="attachments")
