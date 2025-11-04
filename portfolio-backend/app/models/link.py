from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Index, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class LinkCategoryType(Base):
    """
    Model representing link category types in the database.

    Link category types classify different categories of links (e.g., "SOCIAL", "BLOG", "PORTFOLIO")

    Attributes:
        code (str): Primary key, unique identifier for the link category type (max 5 chars)
        name (str): Human-readable name for the link category type
        created_at (datetime): Timestamp when the record was created
        updated_at (datetime): Timestamp when the record was last updated
        created_by (int): User ID who created the record
        updated_by (int): User ID who last updated the record

    Relationships:
        categories (list): One-to-many relationship with LinkCategory model
    """
    __tablename__ = "link_category_types"

    # Primary key and main fields
    code = Column(String(5), primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)

    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record

    # Relationships
    categories = relationship("LinkCategory", back_populates="category_type")

    # Define additional indexes
    __table_args__ = (
        Index('ix_link_category_types_name_code', 'name', 'code'),
    )

    def __repr__(self):
        """String representation of the link category type"""
        return f"<LinkCategoryType(code='{self.code}', name='{self.name}')>"


class LinkCategory(Base):
    """
    Model representing link categories in the database.

    Link categories are specific classifications within a type (e.g., "GITHUB", "LINKEDIN", "TWITTER" under "SOCIAL")

    Attributes:
        id (int): Primary key
        code (str): Unique code for the link category (e.g., "GITHUB", "LINKEDIN")
        type_code (str): Foreign key to link_category_types.code
        icon_name (str): Name of the icon to use (e.g., "FaGithub", "FaLinkedin")
        created_at (datetime): Timestamp when the record was created
        updated_at (datetime): Timestamp when the record was last updated
        created_by (int): User ID who created the record
        updated_by (int): User ID who last updated the record

    Relationships:
        category_type (LinkCategoryType): Many-to-one relationship with LinkCategoryType model
        category_texts (list): One-to-many relationship with LinkCategoryText model
        portfolio_links (list): One-to-many relationship with PortfolioLink model
    """
    __tablename__ = "link_categories"

    # Primary key and main fields
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    type_code = Column(String(5), ForeignKey("link_category_types.code"), nullable=False, index=True)
    icon_name = Column(String(100))  # Icon name for the link (e.g., "FaGithub", "FaLinkedin")

    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record

    # Relationships
    category_type = relationship("LinkCategoryType", back_populates="categories")
    category_texts = relationship("LinkCategoryText", back_populates="category", cascade="all, delete-orphan")
    portfolio_links = relationship("PortfolioLink", back_populates="category")

    # Define additional indexes
    __table_args__ = (
        Index('ix_link_categories_type_code_code', 'type_code', 'code'),
    )

    def __repr__(self):
        """String representation of the link category"""
        return f"<LinkCategory(id={self.id}, code='{self.code}', type_code='{self.type_code}')>"


class LinkCategoryText(Base):
    """
    Model representing multilingual text content for link categories.

    Each link category can have multiple texts in different languages.

    Attributes:
        id (int): Primary key
        category_id (int): Foreign key to link_categories.id
        language_id (int): Foreign key to languages.id
        name (str): Name of the link category in this language
        description (str): Description of the link category in this language
        created_at (datetime): Timestamp when the record was created
        updated_at (datetime): Timestamp when the record was last updated
        created_by (int): User ID who created the record
        updated_by (int): User ID who last updated the record

    Relationships:
        category (LinkCategory): Many-to-one relationship with LinkCategory model
        language (Language): Many-to-one relationship with Language model
    """
    __tablename__ = "link_category_texts"

    # Primary key and foreign keys
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("link_categories.id", ondelete="CASCADE"), nullable=False)
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
    category = relationship("LinkCategory", back_populates="category_texts")
    language = relationship("Language")

    # Define additional indexes and constraints
    __table_args__ = (
        Index('ix_link_category_texts_category_id', 'category_id'),
        Index('ix_link_category_texts_language_id', 'language_id'),
        UniqueConstraint('category_id', 'language_id', name='uq_link_category_texts_category_language'),
        Index('ix_link_category_texts_category_language', 'category_id', 'language_id', unique=True),
    )

    def __repr__(self):
        """String representation of the link category text"""
        return f"<LinkCategoryText(id={self.id}, category_id={self.category_id}, language_id={self.language_id}, name='{self.name}')>"


class PortfolioLink(Base):
    """
    Model representing links associated with a portfolio.

    Links can be social media profiles, blog links, project repositories, or internal website routes.

    Attributes:
        id (int): Primary key
        portfolio_id (int): Foreign key to portfolios.id
        category_id (int): Foreign key to link_categories.id
        url (str): The actual URL of the link or internal route path
        is_route (bool): Whether this is an internal route (True) or external URL (False)
        image_path (str): Optional path to custom image/icon
        order (int): Display order of the link
        is_active (bool): Whether the link is currently active/visible
        created_at (datetime): Timestamp when the record was created
        updated_at (datetime): Timestamp when the record was last updated
        created_by (int): User ID who created the record
        updated_by (int): User ID who last updated the record

    Relationships:
        portfolio (Portfolio): Many-to-one relationship with Portfolio model
        category (LinkCategory): Many-to-one relationship with LinkCategory model
        link_texts (list): One-to-many relationship with PortfolioLinkText model
    """
    __tablename__ = "portfolio_links"

    # Primary key and foreign keys
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("link_categories.id"), nullable=False, index=True)

    # Content fields
    url = Column(String(500), nullable=False)
    is_route = Column(Boolean, default=False, nullable=False)  # True for internal routes, False for external URLs
    image_path = Column(String(500))  # Optional custom image/icon path
    order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record

    # Relationships
    portfolio = relationship("Portfolio", back_populates="links")
    category = relationship("LinkCategory", back_populates="portfolio_links")
    link_texts = relationship("PortfolioLinkText", back_populates="link", cascade="all, delete-orphan")

    # Define additional indexes
    __table_args__ = (
        Index('ix_portfolio_links_portfolio_id_order', 'portfolio_id', 'order'),
        Index('ix_portfolio_links_category_id', 'category_id'),
    )

    def __repr__(self):
        """String representation of the portfolio link"""
        return f"<PortfolioLink(id={self.id}, portfolio_id={self.portfolio_id}, category_id={self.category_id}, url='{self.url}')>"


class PortfolioLinkText(Base):
    """
    Model representing multilingual text content for portfolio links.

    Each portfolio link can have multiple texts in different languages for name and description.

    Attributes:
        id (int): Primary key
        link_id (int): Foreign key to portfolio_links.id
        language_id (int): Foreign key to languages.id
        name (str): Display name of the link in this language
        description (str): Description of the link in this language
        created_at (datetime): Timestamp when the record was created
        updated_at (datetime): Timestamp when the record was last updated
        created_by (int): User ID who created the record
        updated_by (int): User ID who last updated the record

    Relationships:
        link (PortfolioLink): Many-to-one relationship with PortfolioLink model
        language (Language): Many-to-one relationship with Language model
    """
    __tablename__ = "portfolio_link_texts"

    # Primary key and foreign keys
    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("portfolio_links.id", ondelete="CASCADE"), nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)

    # Content fields
    name = Column(String(200), nullable=False)
    description = Column(Text)

    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record

    # Relationships
    link = relationship("PortfolioLink", back_populates="link_texts")
    language = relationship("Language")

    # Define additional indexes and constraints
    __table_args__ = (
        Index('ix_portfolio_link_texts_link_id', 'link_id'),
        Index('ix_portfolio_link_texts_language_id', 'language_id'),
        UniqueConstraint('link_id', 'language_id', name='uq_portfolio_link_texts_link_language'),
        Index('ix_portfolio_link_texts_link_language', 'link_id', 'language_id', unique=True),
    )

    def __repr__(self):
        """String representation of the portfolio link text"""
        return f"<PortfolioLinkText(id={self.id}, link_id={self.link_id}, language_id={self.language_id}, name='{self.name}')>"
