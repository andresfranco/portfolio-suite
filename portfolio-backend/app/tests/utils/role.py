from sqlalchemy.orm import Session
from app.models.role import Role
import uuid

def create_test_role(db: Session, name: str = None, description: str = None) -> Role:
    """
    Create a test role in the database.
    
    Args:
        db: Database session
        name: Optional name for the role (will generate a unique one if not provided)
        description: Optional description for the role
        
    Returns:
        The created Role object
    """
    if name is None:
        name = f"Test Role {uuid.uuid4()}"
    if description is None:
        description = f"Description for {name}"
        
    role = Role(name=name, description=description)
    db.add(role)
    db.commit()
    db.refresh(role)
    
    return role

def assign_permissions_to_role(db: Session, role: Role, permissions: list) -> Role:
    """
    Assign permissions to a role.
    
    Args:
        db: Database session
        role: The Role object to update
        permissions: List of Permission objects to assign
        
    Returns:
        The updated Role object
    """
    role.permissions = permissions
    db.commit()
    db.refresh(role)
    
    return role 