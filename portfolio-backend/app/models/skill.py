from sqlalchemy import Column, Integer, String, Table, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Skill(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)  # e.g., "soft", "hard", "technical"
    type_code = Column(String(5), ForeignKey("skill_types.code"), nullable=True)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    categories = relationship("Category", secondary="category_skills", back_populates="skills")
    projects = relationship("Project", secondary="project_skills", back_populates="skills")
    skill_texts = relationship("SkillText", back_populates="skill")
    skill_type = relationship("SkillType")


class SkillText(Base):
    __tablename__ = "skill_texts"
    id = Column(Integer, primary_key=True, index=True)
    skill_id = Column(Integer, ForeignKey("skills.id"))
    language_id = Column(Integer, ForeignKey("languages.id"))
    name = Column(String)
    description = Column(Text)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    skill = relationship("Skill", back_populates="skill_texts")
    language = relationship("Language", back_populates="skill_texts")
