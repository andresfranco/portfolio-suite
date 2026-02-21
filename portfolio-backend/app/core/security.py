from datetime import datetime, timedelta
from typing import Any, Union, Optional
import hashlib
import hmac
import time
import base64

import jwt
from jwt.exceptions import PyJWTError as JWTError
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _get_jwt_key_for_operation(operation: str = "encode") -> str:
    """
    Get the appropriate key for JWT operations based on algorithm.
    
    Args:
        operation: 'encode' for signing, 'decode' for verification
        
    Returns:
        Secret key (HS256) or private/public key (RS256)
    """
    if settings.ALGORITHM == "RS256":
        if operation == "encode":
            return settings.get_private_key()
        else:  # decode/verify
            return settings.get_public_key()
    else:  # HS256 or other symmetric algorithms
        return settings.SECRET_KEY


def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.
    
    Supports both HS256 (symmetric) and RS256 (asymmetric) algorithms.
    Algorithm is configured via settings.ALGORITHM.
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    
    # Get appropriate key based on algorithm
    key = _get_jwt_key_for_operation("encode")
    encoded_jwt = jwt.encode(to_encode, key, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT refresh token.
    
    Supports both HS256 (symmetric) and RS256 (asymmetric) algorithms.
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    
    # Get appropriate key based on algorithm
    key = _get_jwt_key_for_operation("encode")
    encoded_jwt = jwt.encode(to_encode, key, algorithm=settings.ALGORITHM)
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
