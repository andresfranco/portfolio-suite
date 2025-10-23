from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.config import settings
from app import models, schemas
from app.core.logging import setup_logger
from app.core.secure_cookies import SecureCookieManager

# Set up logger for debugging
logger = setup_logger("app.api.deps")

# Keep OAuth2PasswordBearer for backward compatibility, but make it optional
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user(
    request: Request,
    db: Session = Depends(get_db), 
    token_from_header: Optional[str] = Depends(oauth2_scheme)
) -> models.User:
    """
    Validate and decode the JWT token to get the current user.
    Loads roles and permissions for authorization checks.
    
    Token extraction priority:
    1. httpOnly cookie (secure, recommended)
    2. Authorization header (backward compatibility)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Try to get token from cookie first (secure method)
    token = SecureCookieManager.get_access_token(request)
    
    # Fall back to Authorization header for backward compatibility
    if not token:
        token = token_from_header
    
    if not token:
        logger.warning("No authentication token found in cookie or header")
        raise credentials_exception
    
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenPayload(username=username)
    except JWTError as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise credentials_exception
    except ValidationError as e:
        logger.error(f"Token validation error: {str(e)}")
        raise credentials_exception
    
    # Load user with roles and permissions for authorization checks
    user = db.query(models.User).options(
        selectinload(models.User.roles).selectinload(models.Role.permissions)
    ).filter(models.User.username == token_data.username).first()
    
    if user is None:
        raise credentials_exception
    
    # Verify token fingerprint for additional security (only for cookie-based auth)
    if SecureCookieManager.get_access_token(request):
        if not SecureCookieManager.verify_token_fingerprint(request):
            logger.warning(f"Token fingerprint mismatch for user: {username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session validation failed",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
    return user

def get_current_active_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """
    Get the current active user.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
