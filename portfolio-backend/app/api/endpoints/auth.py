from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi.responses import JSONResponse

from app.core.database import get_db
from app.core.config import settings
from app.auth.jwt import create_access_token, create_refresh_token
from app.models.user import User
from app.schemas.token import Token
from app.core.logging import setup_logger
from app.models.system_setting import SystemSetting
from sqlalchemy import text, inspect as sa_inspect
from sqlalchemy.exc import ProgrammingError, OperationalError
from app.core.security import verify_password
from app.core.audit_logger import audit_logger
from jose import jwt, JWTError

# Set up logger
logger = setup_logger("app.api.endpoints.auth")

router = APIRouter()

# System admin users who bypass certain checks
SYSTEM_ADMIN_USERS = ["systemadmin"]

@router.post("/login", response_model=Token)
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Enhanced OAuth2 login with comprehensive security features
    """
    # Get client information for security logging
    client_ip = request.client.host
    user_agent = request.headers.get("user-agent", "unknown")
    
    try:
        # Find user by username
        user = db.query(User).filter(User.username == form_data.username).first()
        
        # Validate username and password
        if not user or not verify_password(form_data.password, user.hashed_password):
            # Record failed attempt
            audit_logger.log_login_attempt(
                form_data.username, False, client_ip, user_agent,
                {"reason": "invalid_credentials"}
            )
            
            logger.warning(f"Failed login attempt for username: {form_data.username} from IP: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Incorrect username or password"},
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active (systemadmin bypass)
        if not user.is_active and user.username not in SYSTEM_ADMIN_USERS:
            audit_logger.log_login_attempt(
                form_data.username, False, client_ip, user_agent,
                {"reason": "account_inactive"}
            )
            logger.warning(f"Inactive user attempted login: {user.username} from IP: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Account is inactive"},
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Helper to read int setting robustly even if table doesn't exist yet
        def _get_int_setting(key: str, default_value: int) -> int:
            try:
                # Check table existence first to avoid errors in fresh DBs
                inspector = sa_inspect(db.bind)
                if not inspector.has_table('system_settings'):
                    return default_value
                result = db.execute(text("SELECT value FROM system_settings WHERE key = :k"), {"k": key})
                val = result.scalar()
                return int(val) if val is not None and str(val).strip().isdigit() else default_value
            except (ProgrammingError, OperationalError, Exception):
                try:
                    db.rollback()
                except Exception:
                    pass
                return default_value

        # Resolve access token expiry minutes from DB settings (fallback to env)
        minutes = _get_int_setting('auth.access_token_expire_minutes', settings.ACCESS_TOKEN_EXPIRE_MINUTES)

        # Create access token
        access_token_expires = timedelta(minutes=minutes)
        access_token = create_access_token(
            data={"sub": user.username}, 
            expires_delta=access_token_expires
        )
        
        # Resolve refresh token expiry (minutes) from DB settings (fallback)
        refresh_minutes = _get_int_setting('auth.refresh_token_expire_minutes', settings.REFRESH_TOKEN_EXPIRE_MINUTES)

        refresh_token = create_refresh_token(
            data={"sub": user.username},
            expires_delta=timedelta(minutes=refresh_minutes)
        )
        
        # Log successful login
        audit_logger.log_login_attempt(
            user.username, True, client_ip, user_agent,
            {
                "user_id": user.id,
                "is_systemadmin": user.username in SYSTEM_ADMIN_USERS,
                "roles": [role.name for role in user.roles]
            }
        )
        
        # Special logging for systemadmin
        if user.username in SYSTEM_ADMIN_USERS:
            audit_logger.log_security_event(
                "SYSTEMADMIN_LOGIN",
                user=user,
                details={"login_source": "direct"},
                ip_address=client_ip
            )
        
        logger.info(f"Successful login: {user.username} from IP: {client_ip}")
        
        # Return tokens and user info
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_active": user.is_active,
                "is_systemadmin": user.username in SYSTEM_ADMIN_USERS,
                "roles": [{"id": role.id, "name": role.name} for role in user.roles]
            }
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Database error during login: {str(e)}", exc_info=True)
        audit_logger.log_security_event(
            "LOGIN_DATABASE_ERROR",
            details={"error": str(e)},
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    except Exception as e:
        logger.error(f"Unexpected error during login: {str(e)}", exc_info=True)
        audit_logger.log_security_event(
            "LOGIN_UNEXPECTED_ERROR",
            details={"error": str(e)},
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )


@router.post("/refresh-token")
async def refresh_access_token(
    body: dict = Body(...),
    db: Session = Depends(get_db)
):
    """Issue a new access token (and optionally new refresh token) from a valid refresh token."""
    refresh_token = body.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token is required")

    try:
        # Decode refresh token (tokens created with HS256 in app/auth/jwt.py)
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=["HS256"])
        username = payload.get("sub")
        exp_ts = payload.get("exp")
        if not username or not exp_ts:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        # Check expiry explicitly
        if datetime.now(timezone.utc).timestamp() >= float(exp_ts):
            raise HTTPException(status_code=401, detail="Refresh token expired")

        # Lookup user
        user = db.query(User).filter(User.username == username).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid user for refresh token")

        # Read settings for expiries
        def _get_int_setting_refresh(key: str, default_value: int) -> int:
            try:
                inspector = sa_inspect(db.bind)
                if not inspector.has_table('system_settings'):
                    return default_value
                result = db.execute(text("SELECT value FROM system_settings WHERE key = :k"), {"k": key})
                val = result.scalar()
                return int(val) if val is not None and str(val).strip().isdigit() else default_value
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
                return default_value

        access_minutes = _get_int_setting_refresh('auth.access_token_expire_minutes', settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_minutes = _get_int_setting_refresh('auth.refresh_token_expire_minutes', settings.REFRESH_TOKEN_EXPIRE_MINUTES)

        # Create new tokens
        new_access = create_access_token(data={"sub": user.username}, expires_delta=timedelta(minutes=access_minutes))
        new_refresh = create_refresh_token(data={"sub": user.username}, expires_delta=timedelta(minutes=refresh_minutes))

        return {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "token_type": "bearer"
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to refresh token") 