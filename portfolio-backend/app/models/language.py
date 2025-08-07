from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.translation import translation_languages

class Language(Base):
    """Language model for database storage"""
    __tablename__ = "languages"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    image = Column(String(255), nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    translations = relationship("Translation", secondary=translation_languages, back_populates="language")
    section_texts = relationship("SectionText", back_populates="language")
    project_texts = relationship("ProjectText", back_populates="language")
    experience_texts = relationship("ExperienceText", back_populates="language")
    category_texts = relationship("CategoryText", back_populates="language")
    skill_texts = relationship("SkillText", back_populates="language")
    
    def __repr__(self):
        return f"<Language(id={self.id}, code='{self.code}', name='{self.name}', is_default={self.is_default})>"
