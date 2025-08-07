from sqlalchemy import Column, String, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base

class SkillType(Base):
    """
    Model representing skill types in the database.
    
    Attributes:
        code: Primary key, unique identifier for the skill type (max 5 chars)
        name: Human-readable name for the skill type
        created_at: Timestamp when the record was created
        updated_at: Timestamp when the record was last updated
        created_by: User ID who created the record
        updated_by: User ID who last updated the record
    """
    __tablename__ = "skill_types"
    
    # Primary key and main fields
    code = Column(String(5), primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String(50))  # user id who created the record
    updated_by = Column(String(50))  # user id who last updated the record
    
    # Define additional indexes
    __table_args__ = (
        Index('ix_skill_types_name_code', 'name', 'code'),
    )
    
    def __repr__(self):
        """String representation of the skill type"""
        return f"<SkillType(code='{self.code}', name='{self.name}')>" 