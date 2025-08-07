from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.permission import role_permissions

class Role(Base):
    """Role model for representing user roles in the system.
    
    Roles are used for authorization and can be assigned multiple permissions.
    Each user can have multiple roles, and each role can have multiple permissions.
    """
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Back-reference to users via the association table
    users = relationship("User", secondary="user_roles", back_populates="roles")
    # Add permissions relationship
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    
    @property
    def permission_names(self) -> list:
        """Get the permission names as a list of strings."""
        return [perm.name for perm in self.permissions] if self.permissions else []
