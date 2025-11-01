from sqlalchemy import Column, Integer, String, Table, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# Association table for many-to-many relationship between projects and sections
project_sections = Table(
    "project_sections",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE")),
    Column("section_id", Integer, ForeignKey("sections.id", ondelete="CASCADE")),
    Column("display_order", Integer, default=0)
)

class Section(Base):
    __tablename__ = "sections"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)

    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record

    # Relationships
    portfolios = relationship("Portfolio", secondary="portfolio_sections", back_populates="sections")
    projects = relationship("Project", secondary="project_sections", back_populates="sections")
    section_texts = relationship("SectionText", back_populates="section", cascade="all, delete-orphan")
    images = relationship("SectionImage", back_populates="section", cascade="all, delete-orphan")
    attachments = relationship("SectionAttachment", back_populates="section", cascade="all, delete-orphan")


class SectionText(Base):
    __tablename__ = "section_texts"
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"))
    language_id = Column(Integer, ForeignKey("languages.id"))
    text = Column(Text)

    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record

    # Relationships
    section = relationship("Section", back_populates="section_texts")
    language = relationship("Language", back_populates="section_texts")


class SectionImage(Base):
    __tablename__ = "section_images"
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"))
    image_path = Column(String, nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)
    display_order = Column(Integer, default=0)

    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)
    updated_by = Column(Integer)

    # Relationships
    section = relationship("Section", back_populates="images")
    language = relationship("Language")


class SectionAttachment(Base):
    __tablename__ = "section_attachments"
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"))
    file_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)
    display_order = Column(Integer, default=0)

    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)
    updated_by = Column(Integer)

    # Relationships
    section = relationship("Section", back_populates="attachments")
    language = relationship("Language")
