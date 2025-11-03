from sqlalchemy import Column, Integer, String, Table, ForeignKey, DateTime, Text, Boolean
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
    Column("experience_id", Integer, ForeignKey("experiences.id")),
    Column("order", Integer, nullable=False, default=0)
)

# Association table for many-to-many relationship between portfolios and projects
portfolio_projects = Table(
    "portfolio_projects",
    Base.metadata,
    Column("portfolio_id", Integer, ForeignKey("portfolios.id")),
    Column("project_id", Integer, ForeignKey("projects.id")),
    Column("order", Integer, nullable=False, default=0)
)

# Association table for many-to-many relationship between portfolios and sections
portfolio_sections = Table(
    "portfolio_sections",
    Base.metadata,
    Column("portfolio_id", Integer, ForeignKey("portfolios.id")),
    Column("section_id", Integer, ForeignKey("sections.id")),
    Column("order", Integer, nullable=False, default=0)
)

class Portfolio(Base):
    __tablename__ = "portfolios"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text)
    is_default = Column(Boolean, default=False, nullable=False, index=True)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    categories = relationship("Category", secondary="portfolio_categories", back_populates="portfolios")
    experiences = relationship(
        "Experience",
        secondary="portfolio_experiences",
        back_populates="portfolios",
        order_by="portfolio_experiences.c.order"
    )
    projects = relationship(
        "Project",
        secondary="portfolio_projects",
        back_populates="portfolios",
        order_by="portfolio_projects.c.order"
    )
    sections = relationship(
        "Section",
        secondary="portfolio_sections",
        back_populates="portfolios",
        order_by="portfolio_sections.c.order"
    )
    images = relationship("PortfolioImage", back_populates="portfolio", cascade="all, delete-orphan")
    attachments = relationship("PortfolioAttachment", back_populates="portfolio", cascade="all, delete-orphan")
    links = relationship("PortfolioLink", back_populates="portfolio", cascade="all, delete-orphan", order_by="PortfolioLink.order")


class PortfolioImage(Base):
    __tablename__ = "portfolio_images"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    image_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)  # Original filename
    category = Column(String)  # e.g., 'main', 'thumbnail', 'gallery', 'background'
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)  # Link to language
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="images")
    language = relationship("Language")


class PortfolioAttachment(Base):
    __tablename__ = "portfolio_attachments"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    file_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # Link to category (PDOC, RESU, etc)
    is_default = Column(Boolean, default=False, nullable=False)  # For marking default resume
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)  # Link to language
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="attachments")
    category = relationship("Category")
    language = relationship("Language")
