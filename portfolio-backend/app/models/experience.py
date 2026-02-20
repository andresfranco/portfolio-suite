from sqlalchemy import Column, Integer, String, Table, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Experience(Base):
    __tablename__ = "experiences"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    years = Column(Integer)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    portfolios = relationship("Portfolio", secondary="portfolio_experiences", back_populates="experiences")
    experience_texts = relationship("ExperienceText", back_populates="experience")
    images = relationship(
        "ExperienceImage",
        back_populates="experience",
        cascade="all, delete-orphan"
    )


class ExperienceText(Base):
    __tablename__ = "experience_texts"
    id = Column(Integer, primary_key=True, index=True)
    experience_id = Column(Integer, ForeignKey("experiences.id"))
    language_id = Column(Integer, ForeignKey("languages.id"))
    name = Column(String)
    description = Column(Text)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    
    # Relationships
    experience = relationship("Experience", back_populates="experience_texts")
    language = relationship("Language", back_populates="experience_texts")


class ExperienceImage(Base):
    __tablename__ = "experience_images"
    id = Column(Integer, primary_key=True, index=True)
    experience_id = Column(Integer, ForeignKey("experiences.id"), nullable=False)
    experience_text_id = Column(Integer, ForeignKey("experience_texts.id"), nullable=True)
    image_path = Column(String, nullable=False)
    file_name = Column(String, nullable=True)
    category = Column(String, nullable=False, default="content")
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)
    updated_by = Column(Integer)

    experience = relationship("Experience", back_populates="images")
    experience_text = relationship("ExperienceText", backref="images")
    language = relationship("Language")
