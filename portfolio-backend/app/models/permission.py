from sqlalchemy import Column, Integer, String, Table, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
import logging

# Set up logger
logger = logging.getLogger("app.models.permission")

# Association table for role-permission many-to-many relationship
role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', Integer, ForeignKey('roles.id', ondelete='CASCADE')),
    Column('permission_id', Integer, ForeignKey('permissions.id', ondelete='CASCADE')),
)

class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)  # e.g. "CREATE_USER"
    description = Column(String)  # e.g. "Allows creating new users"
    
    # Back-reference to roles via the association table
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")
    
    @property
    def role_names(self) -> list:
        """Get the role names as a list of strings."""
        try:
            if not hasattr(self, 'roles') or self.roles is None:
                return []
                
            result = []
            for role in self.roles:
                if hasattr(role, 'name') and role.name:
                    result.append(role.name)
            return result
        except Exception as e:
            logger.exception(f"Error in role_names property for permission {getattr(self, 'id', 'unknown')}: {str(e)}")
            # Return empty list if there's any issue
            return []