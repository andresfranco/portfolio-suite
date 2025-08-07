from sqlalchemy.orm import Session
from app.models.permission import Permission
import uuid

def create_test_permission(db: Session, name: str = None, description: str = None) -> Permission:
    """
    Create a test permission in the database.
    
    Args:
        db: Database session
        name: Optional name for the permission (will generate a unique one if not provided)
        description: Optional description for the permission
        
    Returns:
        The created Permission object
    """
    if name is None:
        name = f"TEST_PERMISSION_{uuid.uuid4().hex[:8].upper()}"
    if description is None:
        description = f"Description for {name}"
        
    permission = Permission(name=name, description=description)
    db.add(permission)
    db.commit()
    db.refresh(permission)
    
    return permission

def get_or_create_permission(db: Session, name: str, description: str = None) -> Permission:
    """
    Get an existing permission by name or create a new one if it doesn't exist.
    
    Args:
        db: Database session
        name: Name of the permission
        description: Optional description for the permission (used only if creating new)
        
    Returns:
        The Permission object
    """
    permission = db.query(Permission).filter(Permission.name == name).first()
    
    if permission is None:
        if description is None:
            description = f"Description for {name}"
            
        permission = Permission(name=name, description=description)
        db.add(permission)
        db.commit()
        db.refresh(permission)
    
    return permission 