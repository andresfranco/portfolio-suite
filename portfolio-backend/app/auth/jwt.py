from datetime import datetime, timedelta
import jwt
from app.core.config import settings


def _signing_key() -> str:
    """Return the key used to sign tokens (respects ALGORITHM setting)."""
    if settings.ALGORITHM == "RS256":
        return settings.get_private_key()
    return settings.SECRET_KEY


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _signing_key(), algorithm=settings.ALGORITHM)

def create_refresh_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(days=1))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _signing_key(), algorithm=settings.ALGORITHM)
