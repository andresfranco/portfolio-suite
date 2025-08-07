from datetime import datetime, timedelta
from typing import Any, Union, Optional
import hashlib
import hmac
import time
import base64

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT refresh token.
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_temp_token(resource_id: str, expires_in: int = 3600) -> str:
    """
    Create a temporary token for file access
    
    Args:
        resource_id: Unique identifier for the resource (e.g., "attachment_123")
        expires_in: Token expiration time in seconds (default: 1 hour)
    
    Returns:
        Base64 encoded temporary token
    """
    expire_time = int(time.time()) + expires_in
    
    # Create payload
    payload = f"{resource_id}:{expire_time}"
    
    # Create HMAC signature
    signature = hmac.new(
        settings.SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Combine payload and signature
    token_data = f"{payload}:{signature}"
    
    # Base64 encode for URL safety
    token = base64.urlsafe_b64encode(token_data.encode()).decode()
    
    return token

def verify_temp_token(token: str, expected_resource_id: str) -> bool:
    """
    Verify a temporary token
    
    Args:
        token: The token to verify
        expected_resource_id: Expected resource ID that should match the token
    
    Returns:
        True if token is valid and not expired, False otherwise
    """
    try:
        # Decode the token
        token_data = base64.urlsafe_b64decode(token.encode()).decode()
        
        # Split token data
        parts = token_data.split(':')
        if len(parts) != 3:
            return False
        
        resource_id, expire_time_str, signature = parts
        
        # Check if resource ID matches
        if resource_id != expected_resource_id:
            return False
        
        # Check if token is expired
        expire_time = int(expire_time_str)
        if time.time() > expire_time:
            return False
        
        # Verify signature
        payload = f"{resource_id}:{expire_time_str}"
        expected_signature = hmac.new(
            settings.SECRET_KEY.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            return False
        
        return True
        
    except Exception:
        return False

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hash.
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Hash a password.
    """
    return pwd_context.hash(password)
