from sqlalchemy import Column, Integer, String, Table, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# Association table for many-to-many relationship between translations and languages
translation_languages = Table(
    "translation_languages",
    Base.metadata,
    Column("translation_id", Integer, ForeignKey("translations.id")),
    Column("language_id", Integer, ForeignKey("languages.id")),
    # Add a unique constraint to ensure the combination of translation_id and language_id is unique
    UniqueConstraint("translation_id", "language_id", name="uix_translation_language")
)

class Translation(Base):
    __tablename__ = "translations"
    id = Column(Integer, primary_key=True, index=True)
    # Remove the unique constraint from identifier alone
    identifier = Column(String, index=True)
    text = Column(Text)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    language = relationship("Language", secondary=translation_languages, back_populates="translations")
