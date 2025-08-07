from fastapi import HTTPException, status
from app.models.user import User

def check_admin_access(user: User) -> None:
    """
    Check if the user has admin access.
    Raises HTTPException if the user doesn't have admin role.
    """
    is_admin = False
    for role in user.roles:
        if role.name.lower() == "admin":
            is_admin = True
            break
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )
